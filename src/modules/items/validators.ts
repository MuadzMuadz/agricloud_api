import { z } from 'zod'

const stock = z.coerce
  .number({ invalid_type_error: 'The stock field must be an integer.' })
  .int('The stock field must be an integer.')
  .min(0, 'The stock field must be at least 0.')
  .nullable()
  .optional()

const categoryId = z.coerce
  .number({ invalid_type_error: 'The category id field must be an integer.' })
  .int('The category id field must be an integer.')
  .nullable()
  .optional()

export const createItemSchema = z.object({
  name: z
    .string({ required_error: 'The name field is required.' })
    .min(1, 'The name field is required.')
    .max(255, 'The name field must not be greater than 255 characters.'),
  unit: z
    .string({ required_error: 'The unit field is required.' })
    .min(1, 'The unit field is required.')
    .max(50, 'The unit field must not be greater than 50 characters.'),
  stock,
  category_id: categoryId,
  category: z.string().max(255).nullable().optional(),
})

export const updateItemSchema = z.object({
  name: z.string().min(1, 'The name field is required.').max(255).optional(),
  unit: z.string().min(1, 'The unit field is required.').max(50).optional(),
  stock,
  category_id: categoryId,
  category: z.string().max(255).nullable().optional(),
})
