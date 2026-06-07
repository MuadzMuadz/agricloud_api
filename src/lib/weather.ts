import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { lands } from '../db/schema.ts'
import { config } from '../config.ts'
import { num } from './url.ts'
import type { AuthUser } from '../middleware/auth.ts'

const HOURLY_HOURS = 12

export interface ResolvedLocation {
  name: string
  lat: number
  lon: number
  source: string
}

// Cache in-memory per lokasi (dev/server). Catatan: di serverless tidak persist
// antar-invocation → ganti ke KV/tabel saat cutover (lihat plan §6).
const cache = new Map<string, { value: Record<string, unknown> | null; expires: number }>()

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return null
}

export function codeToCondition(code: number): string {
  if (code === 0) return 'Cerah'
  if (code === 1) return 'Cerah berawan'
  if (code === 2) return 'Berawan sebagian'
  if (code === 3) return 'Berawan'
  if ([45, 48].includes(code)) return 'Berkabut'
  if ([51, 53, 55].includes(code)) return 'Gerimis'
  if ([56, 57].includes(code)) return 'Gerimis beku'
  if ([61, 63, 65].includes(code)) return 'Hujan'
  if ([66, 67].includes(code)) return 'Hujan beku'
  if ([71, 73, 75].includes(code)) return 'Salju'
  if (code === 77) return 'Butiran salju'
  if ([80, 81, 82].includes(code)) return 'Hujan lokal'
  if ([85, 86].includes(code)) return 'Hujan salju'
  if (code === 95) return 'Badai petir'
  if ([96, 99].includes(code)) return 'Badai petir disertai es'
  return 'Tidak diketahui'
}

function isPrivateIp(ip: string | null): boolean {
  if (!ip) return true
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) return true
  if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  if (/^(fc|fd)/.test(ip)) return true
  return false
}

async function ipLocation(ip: string | null): Promise<ResolvedLocation | null> {
  if (isPrivateIp(ip)) return null
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,lat,lon`, {
      signal: AbortSignal.timeout(5000),
    })
    const j: any = await res.json()
    if (j?.status === 'success') {
      const name = [j.city, j.regionName].filter(Boolean).join(', ')
      return { name: name || 'Lokasi IP', lat: Number(j.lat), lon: Number(j.lon), source: 'ip' }
    }
  } catch {
    /* mundur ke default */
  }
  return null
}

export async function resolveLocation(
  user: AuthUser | null,
  ip: string | null,
  lat: number | null,
  lon: number | null,
): Promise<ResolvedLocation> {
  if (lat !== null && lon !== null) {
    return { name: 'Lokasi perangkat', lat, lon, source: 'device' }
  }
  if (user && user.weatherMode === 'manual' && user.weatherLat !== null && user.weatherLon !== null) {
    return {
      name: user.weatherDistrict ?? 'Lokasi tersimpan',
      lat: num(user.weatherLat)!,
      lon: num(user.weatherLon)!,
      source: 'manual',
    }
  }
  if (user) {
    const land = await db
      .select({ name: lands.name, lat: lands.latitude, lon: lands.longitude })
      .from(lands)
      .where(and(eq(lands.farmerId, user.id), isNotNull(lands.latitude), isNotNull(lands.longitude)))
      .orderBy(desc(lands.createdAt))
      .limit(1)
    if (land[0]) {
      return { name: land[0].name ?? 'Lahan utama', lat: num(land[0].lat)!, lon: num(land[0].lon)!, source: 'field' }
    }
  }
  const ipLoc = await ipLocation(ip)
  if (ipLoc) return ipLoc
  return {
    name: config.weather.defaultDistrict,
    lat: config.weather.defaultLat,
    lon: config.weather.defaultLon,
    source: 'default',
  }
}

function fetchedAt(offsetSec: number): string {
  const d = new Date(Date.now() + offsetSec * 1000)
  const base = d.toISOString().slice(0, 19)
  const sign = offsetSec >= 0 ? '+' : '-'
  const abs = Math.abs(offsetSec)
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0')
  return `${base}${sign}${hh}:${mm}`
}

function normalize(json: any): Record<string, unknown> {
  const current = json.current ?? {}
  const hourly = json.hourly ?? {}
  const daily = json.daily ?? {}
  const times: string[] = hourly.time ?? []

  let idx = 0
  if (current.time && times.length) {
    const currentHour = String(current.time).slice(0, 13)
    for (let i = 0; i < times.length; i++) {
      if (String(times[i]).slice(0, 13) === currentHour) {
        idx = i
        break
      }
    }
  }

  const code = Number(current.weather_code ?? hourly.weather_code?.[idx] ?? 0)

  const forecast: Record<string, unknown>[] = []
  const count = times.length
  for (let i = idx; i < Math.min(idx + HOURLY_HOURS, count); i++) {
    forecast.push({
      time: String(times[i]).slice(11, 16),
      temp_c: numOrNull(hourly.temperature_2m?.[i]),
      weather_code: Number(hourly.weather_code?.[i] ?? 0),
      is_day: hourly.is_day?.[i] !== undefined ? Boolean(hourly.is_day[i]) : null,
      rain_prob: numOrNull(hourly.precipitation_probability?.[i]),
    })
  }

  const forecastDaily: Record<string, unknown>[] = []
  const dCount = (daily.time ?? []).length
  for (let i = 0; i < dCount; i++) {
    const dc = Number(daily.weather_code?.[i] ?? 0)
    forecastDaily.push({
      date: daily.time?.[i] ?? null,
      weather_code: dc,
      condition: codeToCondition(dc),
      temp_max_c: numOrNull(daily.temperature_2m_max?.[i]),
      temp_min_c: numOrNull(daily.temperature_2m_min?.[i]),
      sunrise: daily.sunrise?.[i] ?? null,
      sunset: daily.sunset?.[i] ?? null,
      uv_index_max: numOrNull(daily.uv_index_max?.[i]),
      rain_prob_max: numOrNull(daily.precipitation_probability_max?.[i]),
      precip_sum_mm: numOrNull(daily.precipitation_sum?.[i]),
      et0_mm: numOrNull(daily.et0_fao_evapotranspiration?.[i]),
    })
  }

  return {
    current: {
      temp_c: numOrNull(current.temperature_2m),
      feels_like_c: numOrNull(current.apparent_temperature),
      condition: codeToCondition(code),
      weather_code: code,
      is_day: current.is_day !== undefined ? Boolean(current.is_day) : null,
      humidity: numOrNull(current.relative_humidity_2m),
      wind_kph: numOrNull(current.wind_speed_10m),
      wind_deg: numOrNull(current.wind_direction_10m),
      rain_prob: numOrNull(hourly.precipitation_probability?.[idx]),
      precip_mm: numOrNull(current.precipitation),
      cloud_cover: numOrNull(current.cloud_cover),
    },
    agri: {
      et0_mm: numOrNull(hourly.et0_fao_evapotranspiration?.[idx]),
      evapotranspiration_mm: numOrNull(hourly.evapotranspiration?.[idx]),
      vpd_kpa: numOrNull(hourly.vapour_pressure_deficit?.[idx]),
      soil_temp_0cm: numOrNull(hourly.soil_temperature_0cm?.[idx]),
      soil_temp_6cm: numOrNull(hourly.soil_temperature_6cm?.[idx]),
      soil_temp_18cm: numOrNull(hourly.soil_temperature_18cm?.[idx]),
      soil_moisture_0_1cm: numOrNull(hourly.soil_moisture_0_to_1cm?.[idx]),
      soil_moisture_1_3cm: numOrNull(hourly.soil_moisture_1_to_3cm?.[idx]),
      soil_moisture_3_9cm: numOrNull(hourly.soil_moisture_3_to_9cm?.[idx]),
      soil_moisture_9_27cm: numOrNull(hourly.soil_moisture_9_to_27cm?.[idx]),
      soil_moisture_27_81cm: numOrNull(hourly.soil_moisture_27_to_81cm?.[idx]),
    },
    hourly: forecast,
    daily: forecastDaily,
    fetched_at: fetchedAt(Number(json.utc_offset_seconds ?? 0)),
  }
}

async function fetchWeather(lat: number, lon: number): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m',
    hourly:
      'temperature_2m,weather_code,is_day,precipitation_probability,et0_fao_evapotranspiration,evapotranspiration,vapour_pressure_deficit,soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,et0_fao_evapotranspiration',
    timezone: 'auto',
    forecast_days: '3',
  })
  try {
    const res = await fetch(`${config.weather.baseUrl}/forecast?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return normalize(await res.json())
  } catch {
    return null
  }
}

// Ambil cuaca dgn cache per lokasi (key presisi 4 desimal, sama dgn Laravel).
export async function getWeather(lat: number, lon: number): Promise<Record<string, unknown> | null> {
  const key = `weather:${lat.toFixed(4)}:${lon.toFixed(4)}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  const value = await fetchWeather(lat, lon)
  if (value !== null) cache.set(key, { value, expires: Date.now() + config.weather.cacheTtl * 1000 })
  return value
}

export function composeDistrict(r: any): string {
  return [r.name, r.admin1].filter(Boolean).join(', ')
}

export async function geocodeSearch(q: string): Promise<Record<string, unknown>[]> {
  try {
    const params = new URLSearchParams({ name: q, count: '8', language: 'id', format: 'json' })
    const res = await fetch(`${config.weather.geocodingUrl}/search?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const j: any = await res.json()
    const results: any[] = j.results ?? []
    return results.map((r) => ({
      id: r.id ?? null,
      name: r.name ?? null,
      district: composeDistrict(r),
      admin1: r.admin1 ?? null,
      admin2: r.admin2 ?? null,
      country: r.country ?? null,
      lat: r.latitude !== undefined ? Number(r.latitude) : null,
      lon: r.longitude !== undefined ? Number(r.longitude) : null,
    }))
  } catch {
    return []
  }
}
