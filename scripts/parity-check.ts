// Harness parity menyeluruh: bandingkan SEMUA endpoint backend baru (Hono, via
// app.fetch) dengan Laravel (:8005) memakai data identik, lalu diff field-by-field.
//
// Prasyarat: Laravel berjalan di http://localhost:8005 dan terhubung ke DB yang
// sama. Membuat user + token Sanctum sementara, lalu MEMBERSIHKAN semua data tes.
//
//   bun run scripts/parity-check.ts
//
// Exit code 0 bila semua cocok, 1 bila ada mismatch.
import { createApp } from '../src/app.ts'
import { ensureAuthSchema } from '../src/lib/token.ts'
import { db } from '../src/db/client.ts'
import {
  users, personalAccessTokens, lands, cycles, phases, warehouses, items, movements,
  notifications, stages,
} from '../src/db/schema.ts'
import { eq, inArray } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'

const LARAVEL = 'http://localhost:8005'
const app = createApp()
const J = (o: unknown) => JSON.stringify(o)
const results: Array<{ name: string; ok: boolean; detail?: string }> = []

await ensureAuthSchema()

async function callNew(path: string, init: RequestInit = {}) {
  const r = await app.fetch(new Request('http://local' + path, init))
  let body: any
  try { body = await r.json() } catch { body = await r.text() }
  return { status: r.status, body }
}
async function callLar(path: string, token: string) {
  const r = await fetch(LARAVEL + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  let body: any
  try { body = await r.json() } catch { body = null }
  return { status: r.status, body }
}
function record(name: string, newRes: any, larRes: any, opts: { keysOnly?: boolean } = {}) {
  const a = newRes.body, b = larRes.body
  const ok = newRes.status === larRes.status && (opts.keysOnly
    ? J(Object.keys(a?.data ?? a ?? {}).sort()) === J(Object.keys(b?.data ?? b ?? {}).sort())
    : J(a) === J(b))
  results.push({ name, ok, detail: ok ? '' : `new(${newRes.status})=${J(a)} | lar(${larRes.status})=${J(b)}` })
}

// ---------- setup ----------
const email = `parity_${Date.now()}@example.com`
const phone = `0819${Date.now().toString().slice(-8)}`
const Hj = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` })
const reg = await callNew('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: J({ name: 'Parity', email, phone_number: phone, password: 'secret123' }) })
const jwt = reg.body.data.access_token
const uid = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]!.id
const rnd = randomBytes(40).toString('hex').slice(0, 40)
const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
const tk = await db.insert(personalAccessTokens).values({ tokenableType: 'App\\Models\\User', tokenableId: uid, name: 'p', token: createHash('sha256').update(rnd).digest('hex'), abilities: '["*"]', createdAt: now, updatedAt: now }).returning({ id: personalAccessTokens.id })
const sanctum = `${tk[0]!.id}|${rnd}`
const cropId = (await db.select({ c: stages.cropId }).from(stages).groupBy(stages.cropId).limit(1))[0]!.c

// ---------- AUTH ----------
record('GET /auth/user', await callNew('/api/auth/user', { headers: Hj(jwt) }), await callLar('/api/auth/user', sanctum))
record('GET /user (raw)', await callNew('/api/user', { headers: Hj(jwt) }), await callLar('/api/user', sanctum))

// ---------- FIELDS + CYCLES ----------
const land = await callNew('/api/myfields', { method: 'POST', headers: Hj(jwt), body: J({ name: 'Lahan', description: 'x', area: 2.5, latitude: -6.7, longitude: 108.55, boundary: '[[-6.7,108.55]]' }) })
const landId = land.body.data.id
const t1 = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
await callNew('/api/cycles', { method: 'POST', headers: Hj(jwt), body: J({ land_id: landId, crop_id: cropId, name: 'C', start_date: '2026-01-01', end_date: t1, status: 'active' }) })
record('GET /myfields', await callNew('/api/myfields', { headers: Hj(jwt) }), await callLar('/api/myfields', sanctum))
record('GET /myfields/:id', await callNew(`/api/myfields/${landId}`, { headers: Hj(jwt) }), await callLar(`/api/myfields/${landId}`, sanctum))
record('GET /cycles?field_id', await callNew(`/api/cycles?field_id=${landId}`, { headers: Hj(jwt) }), await callLar(`/api/cycles?field_id=${landId}`, sanctum))

// ---------- WAREHOUSES + ITEMS + MOVEMENTS ----------
const wh = await callNew('/api/warehouses', { method: 'POST', headers: Hj(jwt), body: J({ name: 'WH', address: 'Jl', capacity: 100, latitude: -6.7, longitude: 108.55 }) })
const wid = wh.body.data.id
const it = await callNew(`/api/warehouses/${wid}/items`, { method: 'POST', headers: Hj(jwt), body: J({ name: 'Pupuk', unit: 'kg', stock: 5, category: 'Kimia' }) })
const itemId = it.body.data.id
await callNew('/api/movements', { method: 'POST', headers: Hj(jwt), body: J({ item_id: itemId, type: 'in', quantity: 3, note: 'in' }) })
record('GET /warehouses', await callNew('/api/warehouses', { headers: Hj(jwt) }), await callLar('/api/warehouses', sanctum))
record('GET /warehouses/:id', await callNew(`/api/warehouses/${wid}`, { headers: Hj(jwt) }), await callLar(`/api/warehouses/${wid}`, sanctum))
record('GET /warehouses/:id/items', await callNew(`/api/warehouses/${wid}/items`, { headers: Hj(jwt) }), await callLar(`/api/warehouses/${wid}/items`, sanctum))
record('GET /warehouses/:id/movements', await callNew(`/api/warehouses/${wid}/movements`, { headers: Hj(jwt) }), await callLar(`/api/warehouses/${wid}/movements`, sanctum))

// ---------- TASKS / DASHBOARD / NOTIF ----------
record('GET /tasks', await callNew('/api/tasks', { headers: Hj(jwt) }), await callLar('/api/tasks', sanctum))
record('GET /dashboard/summary', await callNew('/api/dashboard/summary', { headers: Hj(jwt) }), await callLar('/api/dashboard/summary', sanctum))
record('GET /notifications', await callNew('/api/notifications', { headers: Hj(jwt) }), await callLar('/api/notifications', sanctum))
record('GET /notifications/unread-count', await callNew('/api/notifications/unread-count', { headers: Hj(jwt) }), await callLar('/api/notifications/unread-count', sanctum))

// ---------- CROP-TEMPLATES (publik) ----------
record('GET /crop-templates', await callNew('/api/crop-templates'), { status: 200, body: await (await fetch(`${LARAVEL}/api/crop-templates`, { headers: { Accept: 'application/json' } })).json() })

// ---------- WEATHER (live proxy → shape only) ----------
record('GET /weather (shape)', await callNew('/api/weather?lat=-6.7&lon=108.55'), await callLar('/api/weather?lat=-6.7&lon=108.55', sanctum), { keysOnly: true })

// ---------- cleanup ----------
const cids = (await db.select({ id: cycles.id }).from(cycles).where(eq(cycles.landId, landId))).map((r) => r.id)
if (cids.length) await db.delete(phases).where(inArray(phases.cycleId, cids))
await db.delete(cycles).where(eq(cycles.landId, landId))
await db.delete(lands).where(eq(lands.id, landId))
await db.delete(movements).where(eq(movements.warehouseId, wid))
await db.delete(items).where(eq(items.warehouseId, wid))
await db.delete(warehouses).where(eq(warehouses.id, wid))
await db.delete(notifications).where(eq(notifications.notifiableId, uid))
await db.delete(personalAccessTokens).where(eq(personalAccessTokens.tokenableId, uid))
await db.delete(users).where(eq(users.id, uid))

// ---------- report ----------
console.log('\n=== PARITY CHECK: Hono (baru) vs Laravel (:8005) ===')
let pass = 0
for (const r of results) {
  console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}`)
  if (!r.ok) console.log(`       ${r.detail}`)
  if (r.ok) pass++
}
console.log(`\n${pass}/${results.length} endpoint cocok.`)
process.exit(pass === results.length ? 0 : 1)
