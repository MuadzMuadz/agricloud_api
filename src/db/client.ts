import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config.ts'
import * as schema from './schema.ts'

// Koneksi ke PostgreSQL existing (agricloud_v2). Skema tidak diubah.
// Catatan deploy: untuk serverless (Vercel/Netlify) ganti driver ke pooler
// (Neon/Supabase) atau set max koneksi rendah. Untuk server biasa, default ok.
// Untuk serverless + pooler (Supabase transaction mode / PgBouncer) set
// DB_PREPARE=false agar prepared statements dimatikan (wajib di transaction mode).
const usePrepare = (process.env.DB_PREPARE ?? 'true') !== 'false'
const queryClient = postgres(config.databaseUrl, {
  max: config.env === 'production' ? 1 : 10, // serverless: 1 koneksi/instance
  prepare: usePrepare,
  onnotice: () => {}, // senyapkan NOTICE (mis. CREATE TABLE IF NOT EXISTS)
  // Laravel menyimpan timestamp tanpa timezone; biarkan string apa adanya.
})

export const db = drizzle(queryClient, { schema })
export { schema }
export type Database = typeof db
