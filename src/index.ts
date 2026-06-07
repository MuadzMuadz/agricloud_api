import { serveStatic } from 'hono/bun'
import { createApp } from './app.ts'
import { config } from './config.ts'
import { ensureAuthSchema } from './lib/token.ts'

// Pastikan tabel pendukung auth (jwt_blocklist) ada sebelum melayani.
await ensureAuthSchema()

const app = createApp()

// Penyajian file lokal (khusus dev/server Bun). Di serverless dilayani Supabase.
if (config.storage.driver === 'local') {
  app.get('/storage/*', serveStatic({ root: './' }))
}

export default {
  port: config.port,
  fetch: app.fetch,
}

console.log(`🌱 AgriCloud API (Hono+Bun) jalan di http://localhost:${config.port}`)
