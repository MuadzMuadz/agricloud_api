// Backfill kolom image_url dari format Laravel '/storage/<folder>/<file>' menjadi
// public URL Supabase Storage. Dijalankan SETELAH file dimigrasi ke bucket dan
// env SUPABASE_URL/SUPABASE_BUCKET di-set. Idempotent (hanya menyentuh yang masih '/storage/').
//
//   bun run scripts/backfill-image-urls.ts          # dry-run (lihat rencana)
//   bun run scripts/backfill-image-urls.ts --apply  # eksekusi
import { sql } from 'drizzle-orm'
import { db } from '../src/db/client.ts'
import { config } from '../src/config.ts'

const apply = process.argv.includes('--apply')

function toPublicUrl(imageUrl: string): string {
  const path = imageUrl.replace(/^\/storage\//, '')
  return `${config.storage.supabaseUrl}/storage/v1/object/public/${config.storage.bucket}/${path}`
}

for (const table of ['lands', 'warehouses'] as const) {
  const rows = (await db.execute(
    sql`SELECT id, image_url FROM ${sql.identifier(table)} WHERE image_url LIKE '/storage/%'`,
  )) as unknown as Array<{ id: number; image_url: string }>

  console.log(`[${table}] ${rows.length} baris perlu backfill`)
  for (const r of rows) {
    const next = toPublicUrl(r.image_url)
    if (apply) {
      await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET image_url = ${next} WHERE id = ${r.id}`,
      )
    } else {
      console.log(`  #${r.id}: ${r.image_url} → ${next}`)
    }
  }
}

console.log(apply ? '✅ backfill selesai' : 'ℹ️ dry-run — jalankan dengan --apply untuk eksekusi')
process.exit(0)
