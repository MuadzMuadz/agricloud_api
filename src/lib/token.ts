import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { sql } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { config } from '../config.ts'

// === Auth Opsi B — JWT stateless ===
// Login memverifikasi bcrypt password existing, lalu menerbitkan JWT (HS256)
// dengan klaim { sub: userId, jti, iat, exp }. Revoke (logout/paksa-keluar)
// memakai blocklist `jti` di tabel `jwt_blocklist` (dibuat oleh backend ini,
// tidak menyentuh tabel Laravel). Bentuk response tetap sama dgn sebelumnya
// supaya FE/mobile tidak berubah.

const secret = new TextEncoder().encode(config.jwt.secret)

function iso8601(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

// Buat tabel blocklist bila belum ada (idempotent). Dipanggil saat startup.
export async function ensureAuthSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jwt_blocklist (
      jti varchar(64) PRIMARY KEY,
      expires_at timestamp NOT NULL
    )
  `)
}

export interface TokenPayload {
  access_token: string
  token_type: 'Bearer'
  expires_at: string | null
}

// Terbitkan JWT (padanan issueToken AuthController).
export async function issueToken(userId: number, remember = false): Promise<TokenPayload> {
  const ttlMin = remember ? config.tokenTtl.remember : config.tokenTtl.default
  const now = Math.floor(Date.now() / 1000)
  const exp = now + ttlMin * 60

  const access_token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(userId))
    .setJti(randomUUID())
    .setIssuer(config.jwt.issuer)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret)

  return { access_token, token_type: 'Bearer', expires_at: iso8601(new Date(exp * 1000)) }
}

export interface ResolvedToken {
  userId: number
  jti: string
  exp: number
}

// Verifikasi Bearer JWT. null bila invalid/expired/ter-blocklist.
export async function resolveToken(bearer: string): Promise<ResolvedToken | null> {
  let payload
  try {
    const res = await jwtVerify(bearer, secret, { issuer: config.jwt.issuer })
    payload = res.payload
  } catch {
    return null
  }
  const userId = Number(payload.sub)
  const jti = typeof payload.jti === 'string' ? payload.jti : ''
  const exp = typeof payload.exp === 'number' ? payload.exp : 0
  if (!Number.isInteger(userId) || !jti) return null

  // Cek blocklist (token yang sudah logout/dicabut). Tahan-banting bila tabel
  // belum sempat dibuat: anggap tidak ter-blocklist.
  try {
    const blocked = await db.execute(
      sql`SELECT 1 FROM jwt_blocklist WHERE jti = ${jti} LIMIT 1`,
    )
    if ((blocked as unknown as unknown[]).length > 0) return null
  } catch {
    /* tabel belum ada — abaikan */
  }

  return { userId, jti, exp }
}

// Cabut token (logout) — masukkan jti ke blocklist sampai exp.
export async function revokeToken(jti: string, exp: number): Promise<void> {
  await ensureAuthSchema()
  const expiresAt = new Date(exp * 1000).toISOString().slice(0, 19).replace('T', ' ')
  await db.execute(
    sql`INSERT INTO jwt_blocklist (jti, expires_at) VALUES (${jti}, ${expiresAt})
        ON CONFLICT (jti) DO NOTHING`,
  )
  // Bersih-bersih jti yang sudah lewat exp (best-effort).
  void db.execute(sql`DELETE FROM jwt_blocklist WHERE expires_at < NOW()`).catch(() => {})
}
