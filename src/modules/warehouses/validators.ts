import { z } from 'zod'

// body sudah lewat nullifyEmpty ('' → null); null di-short-circuit oleh nullable().
const num = z.coerce.number({ invalid_type_error: 'The value must be a number.' }).nullable().optional()
const capacity = z.coerce
  .number({ invalid_type_error: 'The capacity field must be an integer.' })
  .int('The capacity field must be an integer.')
  .min(0, 'The capacity field must be at least 0.')
  .nullable()
  .optional()

export const createWarehouseSchema = z.object({
  name: z
    .string({ required_error: 'The name field is required.' })
    .min(1, 'The name field is required.')
    .max(255, 'The name field must not be greater than 255 characters.'),
  address: z.string().max(255, 'The address field must not be greater than 255 characters.').nullable().optional(),
  description: z.string().nullable().optional(),
  capacity,
  latitude: num,
  longitude: num,
})

export const updateWarehouseSchema = z.object({
  name: z
    .string()
    .min(1, 'The name field is required.')
    .max(255, 'The name field must not be greater than 255 characters.')
    .optional(),
  address: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  capacity,
  latitude: num,
  longitude: num,
})
