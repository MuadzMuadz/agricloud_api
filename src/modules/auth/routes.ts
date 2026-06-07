import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import type { Env } from '../../app.ts'
import { config } from '../../config.ts'
import { db } from '../../db/client.ts'
import { users, roles, passwordResetTokens } from '../../db/schema.ts'
import { readBody, validate, toBool } from '../../lib/request.ts'
import { data, validationError, unauthorized } from '../../lib/http.ts'
import { hashPassword, verifyPassword } from '../../lib/password.ts'
import { issueToken, revokeToken } from '../../lib/token.ts'
import { verifyGoogleIdToken } from '../../lib/google.ts'
import { sendResetPasswordEmail } from '../../lib/mail.ts'
import { userResource, rawUser } from '../../serializers/user.ts'
import { requireAuth } from '../../middleware/auth.ts'
import {
  registerSchema,
  loginSchema,
  googleSchema,
  updateUserSchema,
  settingsSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './validators.ts'

const RESET_EXPIRE_MIN = 60

function dbNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

async function roleNameOf(roleId: number): Promise<string | null> {
  const r = await db.select({ name: roles.name }).from(roles).where(eq(roles.id, roleId)).limit(1)
  return r[0]?.name ?? null
}

async function roleIdByName(name: string): Promise<number | null> {
  const r = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1)
  return r[0]?.id ?? null
}

export const authRouter = new Hono<Env>()

// POST /auth/register (publik)
authRouter.post('/register', async (c) => {
  const body = await readBody(c)
  const input = validate(registerSchema, body)

  const errors: Record<string, string[]> = {}
  const [emailHit, phoneHit] = await Promise.all([
    db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1),
    db.select({ id: users.id }).from(users).where(eq(users.phoneNumber, input.phone_number)).limit(1),
  ])
  if (emailHit.length) errors.email = ['The email has already been taken.']
  if (phoneHit.length) errors.phone_number = ['The phone number has already been taken.']
  if (Object.keys(errors).length) throw validationError(errors)

  const roleName = input.role ?? 'farmer'
  const roleId = await roleIdByName(roleName)
  if (!roleId) throw validationError({ role: [`Role '${roleName}' tidak tersedia.`] })

  const now = dbNow()
  const inserted = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      phoneNumber: input.phone_number,
      password: await hashPassword(input.password),
      roleId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: users.id })

  return data(c, await issueToken(inserted[0]!.id), 201)
})

// POST /auth/login (publik)
authRouter.post('/login', async (c) => {
  const body = await readBody(c)
  const input = validate(loginSchema, body)

  const found = await db.select().from(users).where(eq(users.email, input.email)).limit(1)
  const user = found[0]
  if (!user || !(await verifyPassword(input.password, user.password))) {
    throw validationError({ email: ['Email atau password salah.'] })
  }
  return data(c, await issueToken(user.id, toBool(input.remember)))
})

// POST /auth/google (publik)
authRouter.post('/google', async (c) => {
  const body = await readBody(c)
  const input = validate(googleSchema, body)

  let profile
  try {
    profile = await verifyGoogleIdToken(input.id_token)
  } catch {
    throw unauthorized('Token Google tidak valid.')
  }
  if (!profile.id || !profile.email) throw unauthorized('Profil Google tidak lengkap.')

  const userId = await findOrCreateGoogleUser(profile)
  return data(c, await issueToken(userId))
})

// POST /auth/forgot-password (publik) — selalu 200 (anti-enumeration)
authRouter.post('/forgot-password', async (c) => {
  const body = await readBody(c)
  const input = validate(forgotPasswordSchema, body)

  const found = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
  if (found.length) {
    const token = randomBytes(32).toString('hex') // 64 char
    const hashed = await hashPassword(token)
    const now = dbNow()
    // Upsert (email = PK)
    await db
      .insert(passwordResetTokens)
      .values({ email: input.email, token: hashed, createdAt: now })
      .onConflictDoUpdate({ target: passwordResetTokens.email, set: { token: hashed, createdAt: now } })

    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(input.email)}`
    try {
      await sendResetPasswordEmail(input.email, resetUrl)
    } catch (e) {
      console.error('[mail] gagal kirim reset email:', e)
    }
  }
  return c.json({ message: 'Jika email terdaftar, link reset sudah dikirim.' })
})

// POST /auth/reset-password (publik)
authRouter.post('/reset-password', async (c) => {
  const body = await readBody(c)
  const input = validate(resetPasswordSchema, body)

  const invalid = () => validationError({ email: ['Token reset tidak valid atau kadaluarsa.'] })
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.email, input.email))
    .limit(1)
  const rec = rows[0]
  if (!rec) throw invalid()

  // Cek kadaluarsa (60 menit).
  const createdMs = rec.createdAt ? new Date(rec.createdAt.replace(' ', 'T') + 'Z').getTime() : 0
  if (Date.now() - createdMs > RESET_EXPIRE_MIN * 60_000) throw invalid()
  if (!(await verifyPassword(input.token, rec.token))) throw invalid()

  await db
    .update(users)
    .set({ password: await hashPassword(input.password), updatedAt: dbNow() })
    .where(eq(users.email, input.email))
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, input.email))

  return c.json({ message: 'Password berhasil diubah.' })
})

// GET /auth/user (Bearer)
authRouter.get('/user', requireAuth, async (c) => {
  const user = c.get('user')
  return data(c, userResource(user, await roleNameOf(user.roleId)))
})

// PUT /auth/user (Bearer) — setel lokasi cuaca
authRouter.put('/user', requireAuth, async (c) => {
  const user = c.get('user')
  const input = validate(updateUserSchema, await readBody(c))

  const patch: Record<string, unknown> = { updatedAt: dbNow() }
  if (input.weather_mode !== undefined) patch.weatherMode = input.weather_mode
  if (input.weather_district !== undefined) patch.weatherDistrict = input.weather_district
  if (input.weather_lat !== undefined)
    patch.weatherLat = input.weather_lat == null ? null : String(input.weather_lat)
  if (input.weather_lon !== undefined)
    patch.weatherLon = input.weather_lon == null ? null : String(input.weather_lon)

  await db.update(users).set(patch).where(eq(users.id, user.id))
  const fresh = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0]!
  return data(c, userResource(fresh, await roleNameOf(fresh.roleId)))
})

// PATCH /auth/settings (Bearer) — merge preferensi
authRouter.patch('/settings', requireAuth, async (c) => {
  const user = c.get('user')
  const input = validate(settingsSchema, await readBody(c))

  const current = (user.settings ?? {}) as Record<string, unknown>
  const merged = { ...current, ...input }
  await db.update(users).set({ settings: merged, updatedAt: dbNow() }).where(eq(users.id, user.id))
  return c.json({ data: merged })
})

// POST /auth/change-password (Bearer)
authRouter.post('/change-password', requireAuth, async (c) => {
  const user = c.get('user')
  const input = validate(changePasswordSchema, await readBody(c))

  if (!(await verifyPassword(input.current_password, user.password))) {
    throw validationError({ current_password: ['The password is incorrect.'] })
  }
  await db
    .update(users)
    .set({ password: await hashPassword(input.password), updatedAt: dbNow() })
    .where(eq(users.id, user.id))
  return c.json({ message: 'Kata sandi berhasil diperbarui.' })
})

// POST /auth/logout (Bearer)
authRouter.post('/logout', requireAuth, async (c) => {
  const user = c.get('user')
  await revokeToken(user.jti, user.tokenExp)
  return c.json({ message: 'Logged out.' })
})

// Cari/buat user Google (by google_id → email). Return userId.
async function findOrCreateGoogleUser(p: {
  id: string
  email: string | null
  name: string | null
  avatar: string | null
}): Promise<number> {
  const byGoogle = await db.select().from(users).where(eq(users.googleId, p.id)).limit(1)
  const existing = byGoogle[0] ?? (await db.select().from(users).where(eq(users.email, p.email!)).limit(1))[0]

  if (existing) {
    await db
      .update(users)
      .set({
        googleId: existing.googleId ?? p.id,
        provider: existing.provider ?? 'google',
        profilUrl: existing.profilUrl || p.avatar,
        updatedAt: dbNow(),
      })
      .where(eq(users.id, existing.id))
    return existing.id
  }

  const roleId = await roleIdByName('farmer')
  if (!roleId) throw validationError({ role: ["Role 'farmer' tidak tersedia."] })
  const now = dbNow()
  const inserted = await db
    .insert(users)
    .values({
      name: p.name || p.email!,
      email: p.email!,
      googleId: p.id,
      provider: 'google',
      profilUrl: p.avatar,
      roleId,
      password: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: users.id })
  return inserted[0]!.id
}

// Handler GET /user (fallback) di-mount terpisah di app.ts.
export async function rawUserHandler(c: any) {
  return c.json(rawUser(c.get('user')))
}
