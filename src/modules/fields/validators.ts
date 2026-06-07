import { z } from 'zod'

// Catatan: body sudah melewati nullifyEmpty ('' → null). null di-short-circuit
// oleh .nullable() (coerce tidak dijalankan), sehingga tipe tetap bersih.
const numNullable = z.coerce
  .number({ invalid_type_error: 'The value must be a number.' })
  .nullable()
  .optional()

const areaNullable = z.coerce
  .number({ invalid_type_error: 'The area field must be a number.' })
  .min(0, 'The area field must be at least 0.')
  .nullable()
  .optional()

const jsonStringNullable = z
  .string()
  .refine((s) => {
    try {
      JSON.parse(s)
      return true
    } catch {
      return false
    }
  }, 'The boundary field must be a valid JSON string.')
  .nullable()
  .optional()

export const createLandSchema = z.object({
  name: z
    .string({ required_error: 'The name field is required.' })
    .min(1, 'The name field is required.')
    .max(255, 'The name field must not be greater than 255 characters.'),
  description: z.string().nullable().optional(),
  area: areaNullable,
  latitude: numNullable,
  longitude: numNullable,
  boundary: jsonStringNullable,
})

// update: semua 'sometimes' → field boleh tidak ada; name bila ada wajib non-kosong.
export const updateLandSchema = z.object({
  name: z
    .string()
    .min(1, 'The name field is required.')
    .max(255, 'The name field must not be greater than 255 characters.')
    .optional(),
  description: z.string().nullable().optional(),
  area: areaNullable,
  latitude: numNullable,
  longitude: numNullable,
  boundary: jsonStringNullable,
})
