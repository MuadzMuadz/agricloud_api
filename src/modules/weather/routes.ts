import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../../app.ts'
import { validate } from '../../lib/request.ts'
import { optionalUser } from '../../middleware/auth.ts'
import { resolveLocation, getWeather, geocodeSearch } from '../../lib/weather.ts'

const indexSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).nullish(),
  lon: z.coerce.number().min(-180).max(180).nullish(),
})
const searchSchema = z.object({
  q: z.string({ required_error: 'The q field is required.' }).min(2, 'The q field must be at least 2 characters.').max(120),
})

// IP klien dari header proxy umum (fallback null).
function clientIp(c: any): string | null {
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return c.req.header('x-real-ip') ?? null
}

export const weatherRouter = new Hono<Env>()

// GET /weather?lat=&lon=  (publik, Bearer opsional)
weatherRouter.get('/weather', async (c) => {
  const input = validate(indexSchema, c.req.query())
  const user = await optionalUser(c)
  const location = await resolveLocation(user, clientIp(c), input.lat ?? null, input.lon ?? null)

  const weather = await getWeather(location.lat, location.lon)
  if (weather === null) return c.json({ message: 'Gagal mengambil data cuaca.' }, 502)

  return c.json({ data: { location, ...weather } })
})

// GET /weather/search?q=  (publik)
weatherRouter.get('/weather/search', async (c) => {
  const input = validate(searchSchema, c.req.query())
  return c.json({ data: await geocodeSearch(input.q) })
})
