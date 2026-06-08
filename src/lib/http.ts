import type { Context } from 'hono'
import type { ZodError } from 'zod'

// Error berbentuk respons HTTP — ditangkap oleh global onError di app.ts.
// Body dibuat menyerupai respons Laravel (FE/mobile sudah bergantung padanya).
export class HttpError extends Error {
  status: number
  body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.message === 'string' ? body.message : `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

export const notFound = (message = 'Resource tidak ditemukan.') =>
  new HttpError(404, { message })

export const forbidden = (message = 'Anda tidak memiliki akses ke resource ini.') =>
  new HttpError(403, { message })

export const conflict = (message: string) => new HttpError(409, { message })

// Kegagalan dependensi storage hulu (mis. upload Supabase gagal) → 502 berpesan jelas,
// bukan 500 generik. Pesan asli tetap di-log oleh handler untuk diagnosis.
export const storageError = (message = 'Gagal mengunggah berkas. Coba lagi nanti.') =>
  new HttpError(502, { message })

export const unauthorized = (message = 'Unauthenticated.') =>
  new HttpError(401, { message })

// Padanan ValidationException Laravel: 422 + { message, errors: { field: [..] } }
export const validationError = (
  errors: Record<string, string[]>,
  message = 'The given data was invalid.',
) => new HttpError(422, { message, errors })

// Ubah ZodError → format errors ala-Laravel.
export function zodToValidationError(err: ZodError): HttpError {
  const errors: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || 'value'
    ;(errors[key] ??= []).push(issue.message)
  }
  const first = Object.values(errors)[0]?.[0] ?? 'The given data was invalid.'
  return validationError(errors, first)
}

// Pembungkus respons resource ala-Laravel API Resource: { data: ... }
export const data = (c: Context, payload: unknown, status = 200) =>
  c.json({ data: payload }, status as any)
