import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { config } from '../config.ts'

// Abstraksi storage dengan 2 driver:
//  - 'local'    : disk ./storage (dev / server biasa). image_url = '/storage/<folder>/<name>'.
//  - 'supabase' : Supabase Storage (prod serverless). image_url = public URL lengkap.
// Dipilih lewat env STORAGE_DRIVER. Antarmuka sama → handler tidak berubah.

const STORAGE_ROOT = join(process.cwd(), 'storage')

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function extOf(file: File): string {
  const fromName = file.name?.includes('.') ? file.name.split('.').pop()! : ''
  return (EXT_BY_MIME[file.type] ?? fromName ?? 'bin').toLowerCase()
}

// ---- driver: local ----
async function putLocal(folder: string, file: File): Promise<string> {
  const rel = `${folder}/${randomUUID()}.${extOf(file)}`
  const abs = join(STORAGE_ROOT, rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, Buffer.from(await file.arrayBuffer()))
  return `/storage/${rel}`
}

async function deleteLocal(imageUrl: string): Promise<void> {
  const rel = imageUrl.replace(/^\/storage\//, '')
  if (!rel) return
  try {
    await unlink(join(STORAGE_ROOT, rel))
  } catch {
    /* tidak ada — abaikan */
  }
}

// ---- driver: supabase ----
let _supabase: import('@supabase/supabase-js').SupabaseClient | null = null
async function supabase() {
  if (_supabase) return _supabase
  const { createClient } = await import('@supabase/supabase-js')
  _supabase = createClient(config.storage.supabaseUrl, config.storage.supabaseKey, {
    auth: { persistSession: false },
  })
  return _supabase
}

async function putSupabase(folder: string, file: File): Promise<string> {
  const path = `${folder}/${randomUUID()}.${extOf(file)}`
  const sb = await supabase()
  const { error } = await sb.storage
    .from(config.storage.bucket)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })
  if (error) throw new Error(`Supabase upload gagal: ${error.message}`)
  return sb.storage.from(config.storage.bucket).getPublicUrl(path).data.publicUrl
}

async function deleteSupabase(imageUrl: string): Promise<void> {
  // public URL: <base>/storage/v1/object/public/<bucket>/<path>
  const marker = `/object/public/${config.storage.bucket}/`
  const i = imageUrl.indexOf(marker)
  if (i < 0) return
  const path = imageUrl.slice(i + marker.length)
  const sb = await supabase()
  await sb.storage.from(config.storage.bucket).remove([path]).catch(() => {})
}

// ---- API publik ----
export async function storePublic(folder: string, file: File): Promise<string> {
  return config.storage.driver === 'supabase' ? putSupabase(folder, file) : putLocal(folder, file)
}

export async function deletePublic(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return
  return config.storage.driver === 'supabase' ? deleteSupabase(imageUrl) : deleteLocal(imageUrl)
}
