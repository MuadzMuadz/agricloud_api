import type { Context } from 'hono'
import type { ZodType } from 'zod'
import { zodToValidationError } from './http.ts'

// Baca body request sebagai objek, mendukung JSON & form-urlencoded/multipart
// (Laravel menerima keduanya). File multipart dikembalikan sebagai objek File.
export async function readBody(c: Context): Promise<Record<string, unknown>> {
  const ct = c.req.header('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      return (await c.req.json()) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const body = await c.req.parseBody({ all: true })
    return body as Record<string, unknown>
  }
  // fallback: coba JSON
  try {
    return (await c.req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

// Padanan middleware Laravel ConvertEmptyStringsToNull: ubah nilai '' → null
// pada level atas body (multipart/form kerap mengirim string kosong).
export function nullifyEmpty(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) out[k] = v === '' ? null : v
  return out
}

// Padanan $request->boolean(): true untuk true/'true'/1/'1'/'on'/'yes'.
export function toBool(v: unknown): boolean {
  if (v === true) return true
  if (typeof v === 'number') return v === 1
  if (typeof v === 'string') return ['true', '1', 'on', 'yes'].includes(v.toLowerCase())
  return false
}

// Validasi objek dengan skema Zod; lempar HttpError 422 ala-Laravel bila gagal.
export function validate<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw zodToValidationError(result.error)
  return result.data
}
