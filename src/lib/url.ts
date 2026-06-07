import { config } from '../config.ts'

// Padanan helper url() Laravel: bila path sudah berupa URL absolut, kembalikan
// apa adanya; selain itu prefiks dengan APP_URL.
export function url(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${config.appUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

// Timestamp DB ('YYYY-MM-DD HH:MM:SS', UTC) → format serialisasi Laravel/Carbon:
// 'YYYY-MM-DDTHH:MM:SS.000000Z'. null tetap null.
export function laravelDate(value: string | null | undefined): string | null {
  if (!value) return null
  // sudah ISO?
  if (value.includes('T') && value.endsWith('Z')) return value
  const [datePart, timePartRaw = '00:00:00'] = value.split(' ')
  const [timePart, frac] = timePartRaw.split('.')
  const micros = (frac ?? '').padEnd(6, '0').slice(0, 6)
  return `${datePart}T${timePart}.${micros}Z`
}

// numeric Postgres → number (Laravel cast float). null tetap null.
export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}
