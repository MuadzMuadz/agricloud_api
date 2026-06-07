import { z } from 'zod'

// Pesan dibuat menyerupai default Laravel ("The {attr} field is required." dst).
// Key error tetap snake_case sesuai nama field.

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'The name field is required.' })
    .min(1, 'The name field is required.')
    .max(255, 'The name field must not be greater than 255 characters.'),
  email: z
    .string({ required_error: 'The email field is required.' })
    .min(1, 'The email field is required.')
    .email('The email field must be a valid email address.')
    .max(255, 'The email field must not be greater than 255 characters.'),
  phone_number: z
    .string({ required_error: 'The phone number field is required.' })
    .min(1, 'The phone number field is required.')
    .max(30, 'The phone number field must not be greater than 30 characters.'),
  password: z
    .string({ required_error: 'The password field is required.' })
    .min(8, 'The password field must be at least 8 characters.'),
  role: z.string().nullish(),
})

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'The email field is required.' })
    .min(1, 'The email field is required.')
    .email('The email field must be a valid email address.'),
  password: z
    .string({ required_error: 'The password field is required.' })
    .min(1, 'The password field is required.'),
  remember: z.any().optional(),
})

export const googleSchema = z.object({
  id_token: z
    .string({ required_error: 'The id token field is required.' })
    .min(1, 'The id token field is required.'),
})

export const updateUserSchema = z.object({
  weather_mode: z.enum(['manual', 'device'], { message: 'The selected weather mode is invalid.' }).nullish(),
  weather_district: z.string().max(255).nullish(),
  weather_lat: z.coerce.number().min(-90).max(90).nullish(),
  weather_lon: z.coerce.number().min(-180).max(180).nullish(),
})

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  language: z.enum(['id', 'en']).optional(),
  notifications: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
  current_password: z.string({ required_error: 'The current password field is required.' }).min(1),
  password: z.string().min(8, 'The password field must be at least 8 characters.'),
  password_confirmation: z.string().optional(),
}).refine((d) => d.password === d.password_confirmation, {
  path: ['password'],
  message: 'The password field confirmation does not match.',
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('The email field must be a valid email address.'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'The token field is required.'),
  email: z.string().email('The email field must be a valid email address.'),
  password: z.string().min(8, 'The password field must be at least 8 characters.'),
  password_confirmation: z.string().optional(),
}).refine((d) => d.password === d.password_confirmation, {
  path: ['password'],
  message: 'The password field confirmation does not match.',
})
