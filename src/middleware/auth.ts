import type { MiddlewareHandler } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { users } from '../db/schema.ts'
import { resolveToken } from '../lib/token.ts'
import { unauthorized } from '../lib/http.ts'

export type AuthUser = typeof users.$inferSelect & { jti: string; tokenExp: number }

// Padanan middleware `auth:sanctum`. Verifikasi Bearer token, muat user,
// simpan ke context (c.get('user')). 401 bila tidak valid.
export const requireAuth: MiddlewareHandler<{ Variables: { user: AuthUser } }> = async (
  c,
  next,
) => {
  const header = c.req.header('Authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!bearer) throw unauthorized()

  const resolved = await resolveToken(bearer)
  if (!resolved) throw unauthorized()

  const rows = await db.select().from(users).where(eq(users.id, resolved.userId)).limit(1)
  const user = rows[0]
  if (!user) throw unauthorized()

  c.set('user', { ...user, jti: resolved.jti, tokenExp: resolved.exp })
  await next()
}

// Ambil user dari Bearer bila ada & valid; null bila tak ada/invalid (untuk
// route publik yang resolusinya ikut user, mis. /weather).
export async function optionalUser(c: {
  req: { header: (n: string) => string | undefined }
}): Promise<AuthUser | null> {
  const header = c.req.header('Authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!bearer) return null
  const resolved = await resolveToken(bearer)
  if (!resolved) return null
  const rows = await db.select().from(users).where(eq(users.id, resolved.userId)).limit(1)
  if (!rows[0]) return null
  return { ...rows[0], jti: resolved.jti, tokenExp: resolved.exp }
}
