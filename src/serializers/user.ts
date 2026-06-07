import type { users } from '../db/schema.ts'
import { url, num, laravelDate } from '../lib/url.ts'

type UserRow = typeof users.$inferSelect

// Padanan UserResource Laravel (dibungkus { data: ... } oleh handler).
export function userResource(user: UserRow, roleName: string | null): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified_at: laravelDate(user.emailVerifiedAt),
    phone_number: user.phoneNumber,
    role: roleName,
    profile_photo: user.profilUrl,
    settings: user.settings,
    weather_mode: user.weatherMode,
    weather_district: user.weatherDistrict,
    weather_lat: num(user.weatherLat),
    weather_lon: num(user.weatherLon),
    created_at: laravelDate(user.createdAt),
    updated_at: laravelDate(user.updatedAt),
    profile_photo_url: url(user.profilUrl),
  }
}

// Padanan `return $request->user()` (GET /user) — model mentah, password &
// remember_token disembunyikan, TIDAK dibungkus { data }.
export function rawUser(user: UserRow): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name,
    role_id: user.roleId,
    profil_url: user.profilUrl,
    phone_number: user.phoneNumber,
    email: user.email,
    email_verified_at: laravelDate(user.emailVerifiedAt),
    created_at: laravelDate(user.createdAt),
    updated_at: laravelDate(user.updatedAt),
    weather_mode: user.weatherMode,
    weather_district: user.weatherDistrict,
    weather_lat: num(user.weatherLat),
    weather_lon: num(user.weatherLon),
    settings: user.settings,
    google_id: user.googleId,
    provider: user.provider,
  }
}
