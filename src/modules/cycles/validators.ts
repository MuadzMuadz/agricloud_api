import { z } from 'zod'

const isDate = (s: string) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

export const cycleIndexSchema = z.object({
  field_id: z.coerce
    .number({ invalid_type_error: 'The field id field must be an integer.' })
    .int('The field id field must be an integer.'),
})

export const cycleStoreSchema = z
  .object({
    land_id: z.coerce
      .number({ invalid_type_error: 'The land id field must be an integer.' })
      .int('The land id field must be an integer.'),
    crop_id: z.coerce
      .number({ invalid_type_error: 'The crop id field must be an integer.' })
      .int('The crop id field must be an integer.'),
    name: z
      .string({ required_error: 'The name field is required.' })
      .min(1, 'The name field is required.')
      .max(255, 'The name field must not be greater than 255 characters.'),
    description: z.string().nullish(),
    start_date: z
      .string()
      .refine(isDate, 'The start date field must be a valid date.')
      .nullish(),
    end_date: z
      .string()
      .refine(isDate, 'The end date field must be a valid date.')
      .nullish(),
    status: z.enum(['active', 'pending', 'done']).nullish(),
  })
  .refine(
    (d) =>
      !d.start_date ||
      !d.end_date ||
      Date.parse(`${d.end_date}T00:00:00Z`) >= Date.parse(`${d.start_date}T00:00:00Z`),
    { path: ['end_date'], message: 'The end date field must be a date after or equal to start date.' },
  )
