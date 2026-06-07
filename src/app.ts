import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sql } from 'drizzle-orm'
import { ZodError } from 'zod'
import { config } from './config.ts'
import { db } from './db/client.ts'
import { HttpError, zodToValidationError } from './lib/http.ts'
import { requireAuth, type AuthUser } from './middleware/auth.ts'
import { authRouter, rawUserHandler } from './modules/auth/routes.ts'
import { fieldsRouter } from './modules/fields/routes.ts'
import { cyclesRouter } from './modules/cycles/routes.ts'
import { warehousesRouter } from './modules/warehouses/routes.ts'
import { itemsRouter } from './modules/items/routes.ts'
import { movementsRouter } from './modules/movements/routes.ts'
import { tasksRouter } from './modules/tasks/routes.ts'
import { notificationsRouter } from './modules/notifications/routes.ts'
import { weatherRouter } from './modules/weather/routes.ts'
import { cropTemplatesRouter } from './modules/crop-templates/routes.ts'

// Variabel context lintas-handler (mis. user terautentikasi).
export type Env = { Variables: { user: AuthUser } }

export function createApp() {
  const app = new Hono<Env>()

  app.use('*', logger())
  app.use(
    '*',
    cors({
      origin: config.corsOrigins,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    }),
  )

  // Healthcheck — padanan /up Laravel; sekalian ping DB.
  app.get('/up', async (c) => {
    try {
      await db.execute(sql`select 1`)
      return c.json({ status: 'ok', db: 'connected' })
    } catch (e) {
      return c.json({ status: 'degraded', db: 'error', error: String(e) }, 500)
    }
  })

  // Catatan: penyajian file lokal /storage/* didaftarkan di entry Bun (index.ts),
  // karena khusus runtime Bun. Di serverless, file dilayani oleh Supabase Storage.

  // === Module routers — semua di bawah prefix /api (parity Laravel) ===
  app.route('/api/auth', authRouter) // M1–M2
  app.get('/api/user', requireAuth, rawUserHandler) // fallback kompatibilitas
  app.route('/api', fieldsRouter) // M3 — myfields
  app.route('/api', cyclesRouter) // M3 — cycles
  app.route('/api', warehousesRouter) // M4 — warehouses
  app.route('/api', itemsRouter) // M4 — items
  app.route('/api', movementsRouter) // M4 — movements
  app.route('/api', tasksRouter) // M5 — tasks + dashboard
  app.route('/api', notificationsRouter) // M5 — notifications
  app.route('/api', weatherRouter) // M5 — weather
  app.route('/api', cropTemplatesRouter) // M5 — crop-templates

  // 404 default ala-Laravel.
  app.notFound((c) => c.json({ message: 'Not Found.' }, 404))

  // Error handler global → bentuk respons konsisten dengan Laravel.
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json(err.body, err.status as any)
    if (err instanceof ZodError) {
      const e = zodToValidationError(err)
      return c.json(e.body, e.status as any)
    }
    console.error('[unhandled]', err)
    return c.json({ message: 'Server Error.' }, 500)
  })

  return app
}
