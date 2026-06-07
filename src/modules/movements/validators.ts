import { z } from 'zod'

export const movementStoreSchema = z.object({
  item_id: z.coerce
    .number({ invalid_type_error: 'The item id field must be an integer.' })
    .int('The item id field must be an integer.'),
  type: z.enum(['in', 'out'], { message: 'The selected type is invalid.' }),
  quantity: z.coerce
    .number({ invalid_type_error: 'The quantity field must be a number.' })
    .min(0.0001, 'The quantity field must be at least 0.0001.'),
  note: z.string().nullable().optional(),
})
