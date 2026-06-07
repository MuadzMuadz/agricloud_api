import { Hono } from 'hono'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Env } from '../../app.ts'
import { db } from '../../db/client.ts'
import { warehouses, items, categories } from '../../db/schema.ts'
import { readBody, validate, nullifyEmpty } from '../../lib/request.ts'
import { HttpError, notFound } from '../../lib/http.ts'
import { storePublic, deletePublic } from '../../lib/storage.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { warehouseResource } from '../../serializers/warehouse.ts'
import { itemResource } from '../../serializers/item.ts'
import { createWarehouseSchema, updateWarehouseSchema } from './validators.ts'

const dbNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const numToStr = (n: number | null | undefined) => (n == null ? null : String(n))

function takeThumbnail(body: Record<string, unknown>): File | null {
  const f = body.thumbnail
  if (!f || !(f instanceof File) || f.size === 0) return null
  if (!f.type.startsWith('image/')) throw new HttpError(422, { message: 'The thumbnail field must be an image.', errors: { thumbnail: ['The thumbnail field must be an image.'] } })
  if (f.size > 5 * 1024 * 1024) throw new HttpError(422, { message: 'The thumbnail field must not be greater than 5120 kilobytes.', errors: { thumbnail: ['The thumbnail field must not be greater than 5120 kilobytes.'] } })
  return f
}

// Hitung items_count & stock_total per gudang.
async function statsFor(ids: number[]): Promise<Map<number, { cnt: number; sum: number }>> {
  const m = new Map<number, { cnt: number; sum: number }>()
  if (ids.length === 0) return m
  const rows = await db
    .select({
      wid: items.warehouseId,
      cnt: sql<number>`count(*)::int`,
      sum: sql<number>`coalesce(sum(${items.stock}), 0)::int`,
    })
    .from(items)
    .where(inArray(items.warehouseId, ids))
    .groupBy(items.warehouseId)
  for (const r of rows) m.set(r.wid, { cnt: r.cnt, sum: r.sum })
  return m
}

export const warehousesRouter = new Hono<Env>()

// GET /warehouses
warehousesRouter.get('/warehouses', requireAuth, async (c) => {
  const user = c.get('user')
  const rows = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.farmerId, user.id))
    .orderBy(desc(warehouses.createdAt))
  const stats = await statsFor(rows.map((w) => w.id))
  const data = rows.map((w) => {
    const s = stats.get(w.id) ?? { cnt: 0, sum: 0 }
    return warehouseResource(w, { ownerName: user.name, itemsCount: s.cnt, stockSum: s.sum })
  })
  return c.json({ data })
})

// GET /warehouses/:id (owner-scoped 404)
warehousesRouter.get('/warehouses/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const rows = await db
    .select()
    .from(warehouses)
    .where(and(eq(warehouses.id, id), eq(warehouses.farmerId, user.id)))
    .limit(1)
  if (!rows[0]) throw notFound()
  const w = rows[0]
  const s = (await statsFor([id])).get(id) ?? { cnt: 0, sum: 0 }
  const itemRows = await db
    .select({ item: items, categoryName: categories.name })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .where(eq(items.warehouseId, id))
    .orderBy(items.id)
  const itemList = itemRows.map((r) => itemResource(r.item, r.categoryName))
  return c.json({
    data: warehouseResource(w, { ownerName: user.name, itemsCount: s.cnt, stockSum: s.sum, items: itemList }),
  })
})

// POST /warehouses (multipart)
warehousesRouter.post('/warehouses', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await readBody(c)
  const input = validate(createWarehouseSchema, nullifyEmpty(body))
  const thumb = takeThumbnail(body)
  const imageUrl = thumb ? await storePublic('warehouses', thumb) : null
  const now = dbNow()

  const inserted = await db
    .insert(warehouses)
    .values({
      farmerId: user.id,
      name: input.name,
      location: input.address ?? null,
      description: input.description ?? null,
      capacity: input.capacity ?? null,
      latitude: numToStr(input.latitude),
      longitude: numToStr(input.longitude),
      imageUrl,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return c.json(
    { data: warehouseResource(inserted[0]!, { ownerName: user.name, itemsCount: 0, stockSum: 0 }) },
    201,
  )
})

// PUT /warehouses/:id (multipart, owner-scoped 404)
warehousesRouter.put('/warehouses/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const rows = await db
    .select()
    .from(warehouses)
    .where(and(eq(warehouses.id, id), eq(warehouses.farmerId, user.id)))
    .limit(1)
  if (!rows[0]) throw notFound()

  const body = await readBody(c)
  const input = validate(updateWarehouseSchema, nullifyEmpty(body))
  const thumb = takeThumbnail(body)

  const patch: Record<string, unknown> = { updatedAt: dbNow() }
  if (thumb) patch.imageUrl = await storePublic('warehouses', thumb)
  if (input.address !== undefined) patch.location = input.address
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.capacity !== undefined) patch.capacity = input.capacity
  if (input.latitude !== undefined) patch.latitude = numToStr(input.latitude)
  if (input.longitude !== undefined) patch.longitude = numToStr(input.longitude)

  await db.update(warehouses).set(patch).where(eq(warehouses.id, id))
  const fresh = (await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1))[0]!
  const s = (await statsFor([id])).get(id) ?? { cnt: 0, sum: 0 }
  return c.json({ data: warehouseResource(fresh, { ownerName: user.name, itemsCount: s.cnt, stockSum: s.sum }) })
})

// DELETE /warehouses/:id (owner-check eksplisit 404/403)
warehousesRouter.delete('/warehouses/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const rows = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1)
  const w = rows[0]
  if (!w) throw new HttpError(404, { message: 'Gudang tidak ditemukan' })
  if (w.farmerId !== user.id) throw new HttpError(403, { message: 'Anda tidak berhak menghapus gudang ini' })

  await deletePublic(w.imageUrl)
  await db.delete(warehouses).where(eq(warehouses.id, id)) // cascade items & movements
  return c.json({ message: 'Gudang berhasil dihapus' })
})
