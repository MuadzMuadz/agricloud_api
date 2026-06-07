// Konfigurasi terpusat — padanan config/agricloud.php + .env Laravel.
// Bun otomatis memuat .env. Akses lewat process.env.

function int(name: string, fallback: number): number {
  const v = process.env[name]
  const n = v ? parseInt(v, 10) : NaN
  return Number.isFinite(n) ? n : fallback
}

function str(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

export const config = {
  env: str('APP_ENV', 'local'),
  port: int('PORT', 8005),
  appUrl: str('APP_URL', 'http://localhost:8005'),
  frontendUrl: str('APP_FRONTEND_URL', 'http://localhost:8006'),
  corsOrigins: str('CORS_ALLOWED_ORIGINS', 'http://localhost:8006')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: str('DATABASE_URL'),

  // Token TTL (menit) — padanan config('agricloud.token_ttl'); dipakai sbg exp JWT.
  tokenTtl: {
    default: int('AGRICLOUD_TOKEN_TTL_DEFAULT', 1440),
    remember: int('AGRICLOUD_TOKEN_TTL_REMEMBER', 43200),
  },

  // JWT (Opsi B — stateless). Revoke via jti blocklist (lihat lib/token.ts).
  jwt: {
    secret: str('JWT_SECRET', 'dev-insecure-secret-change-me'),
    issuer: str('JWT_ISSUER', 'agricloud'),
  },

  lowStockThreshold: int('AGRICLOUD_LOW_STOCK_THRESHOLD', 10),
  harvestLookaheadDays: int('AGRICLOUD_HARVEST_LOOKAHEAD_DAYS', 7),
  urgentWindowDays: int('AGRICLOUD_URGENT_WINDOW_DAYS', 2),

  google: {
    clientId: str('GOOGLE_CLIENT_ID'),
    clientSecret: str('GOOGLE_CLIENT_SECRET'),
  },

  mail: {
    host: str('MAIL_HOST'),
    port: int('MAIL_PORT', 587),
    username: str('MAIL_USERNAME'),
    password: str('MAIL_PASSWORD'),
    encryption: str('MAIL_ENCRYPTION', 'tls'),
    fromAddress: str('MAIL_FROM_ADDRESS', 'no-reply@agricloud.app'),
    fromName: str('MAIL_FROM_NAME', 'AgriCloud'),
  },

  // Storage file (thumbnail). 'local' = disk (dev); 'supabase' = Supabase Storage (prod serverless).
  storage: {
    driver: str('STORAGE_DRIVER', 'local') as 'local' | 'supabase',
    supabaseUrl: str('SUPABASE_URL'),
    supabaseKey: str('SUPABASE_SERVICE_KEY'),
    bucket: str('SUPABASE_BUCKET', 'public'),
  },

  weather: {
    baseUrl: str('OPEN_METEO_BASE_URL', 'https://api.open-meteo.com/v1'),
    geocodingUrl: str('OPEN_METEO_GEOCODING_URL', 'https://geocoding-api.open-meteo.com/v1'),
    cacheTtl: int('WEATHER_CACHE_TTL', 1800),
    defaultLat: Number(str('WEATHER_DEFAULT_LAT', '-6.7063')),
    defaultLon: Number(str('WEATHER_DEFAULT_LON', '108.5571')),
    defaultDistrict: str('WEATHER_DEFAULT_DISTRICT', 'Kejaksan, Cirebon'),
  },
} as const
