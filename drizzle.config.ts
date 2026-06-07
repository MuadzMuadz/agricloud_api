import { defineConfig } from 'drizzle-kit'

// Introspeksi skema PostgreSQL existing (agricloud_v2) — TIDAK membuat migration baru.
// Skema hasil pull ditulis ke src/db/schema.ts & relations.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Hanya tabel domain; tabel framework Laravel diabaikan dari ORM (tetap ada di DB).
  casing: 'snake_case',
})
