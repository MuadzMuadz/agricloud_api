import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import type { Env } from '../../app.ts'
import { db } from '../../db/client.ts'
import { warehouses, items, categories } from '../../db/schema.ts'
import { readBody, validate, nullifyEmpty } from '../../lib/request.ts'
import { notFound, validationError } from '../../lib/http.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { itemResource } from '../../serializers/item.ts'
import { notifyLowStock } from '../../lib/notifications.ts'
import { createItemSchema, updateItemSchema } from './validators.ts'

const dbNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

type ItemRow = typeof items.$inferSelect

async function ownedWarehouse(id: number, userId: number): Promise<number> {
  const rows = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.id, id), eq(warehouses.farmerId, userId)))
    .limit(1)
  if (!rows[0]) throw notFound()
  return rows[0].id
}

// Item yang gudangnya milik user, atau 404.
async function ownedItem(id: number, userId: number): Promise<ItemRow> {
  const rows = await db
    .select({ item: items })
    .from(items)
    .innerJoin(warehouses, eq(items.warehouseId, warehouses.id))
    .where(and(eq(items.id, id), eq(warehouses.farmerId, userId)))
    .limit(1)
  if (!rows[0]) throw notFound()
  return rows[0].item
}

async function categoryNameOf(categoryId: number | null): Promise<string | null> {
  if (categoryId == null) return null
  const r = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, categoryId)).limit(1)
  return r[0]?.name ?? null
}

// Resolusi category_id dari id eksplisit atau nama (firstOrCreate). null bila kosong.
async function resolveCategoryId(input: { category_id?: number | null; category?: string | null }): Promise<number | null> {
  if (input.category_id != null) return input.category_id
  if (input.category) {
    const found = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, input.category)).limit(1)
    if (found[0]) return found[0].id
    const now = dbNow()
    const ins = await db.insert(categories).values({ name: input.category, createdAt: now, updatedAt: now }).returning({ id: categories.id })
    return ins[0]!.id
  }
  return null
}

async function assertCategoryExists(categoryId: number | null | undefined): Promise<void> {
  if (categoryId == null) return
  const r = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1)
  if (!r.length) throw validationError({ category_id: ['The selected category id is invalid.'] })
}

export const itemsRouter = new Hono<Env>()

// GET /warehouses/:id/items
itemsRouter.get('/warehouses/:id/items', requireAuth, async (c) => {
  const user = c.get('user')
  const wid = await ownedWarehouse(Number(c.req.param('id')), user.id)
  const rows = await db
    .select({ item: items, categoryName: categories.name })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .where(eq(items.warehouseId, wid))
    .orderBy(desc(items.createdAt))
  return c.json({ data: rows.map((r) => itemResource(r.item, r.categoryName)) })
})

// POST /warehouses/:id/items
itemsRouter.post('/warehouses/:id/items', requireAuth, async (c) => {
  const user = c.get('user')
  const wid = await ownedWarehouse(Number(c.req.param('id')), user.id)
  const input = validate(createItemSchema, nullifyEmpty(await readBody(c)))
  await assertCategoryExists(input.category_id)

  const categoryId = await resolveCategoryId(input)
  const stock = input.stock ?? 0
  const now = dbNow()
  const inserted = await db
    .insert(items)
    .values({ warehouseId: wid, name: input.name, unit: input.unit, stock, categoryId, createdAt: now, updatedAt: now })
    .returning()
  const item = inserted[0]!

  await notifyLowStock({ id: item.id, name: item.name, stock: item.stock, unit: item.unit, warehouseId: wid })
  return c.json({ data: itemResource(item, await categoryNameOf(categoryId)) }, 201)
})

// PUT /items/:id
itemsRouter.put('/items/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const current = await ownedItem(id, user.id)
  const input = validate(updateItemSchema, nullifyEmpty(await readBody(c)))
  if (input.category_id !== undefined) await assertCategoryExists(input.category_id)

  const patch: Record<string, unknown> = { updatedAt: dbNow() }
  if (input.name !== undefined) patch.name = input.name
  if (input.unit !== undefined) patch.unit = input.unit
  if (input.stock !== undefined && input.stock !== null) patch.stock = input.stock
  if (input.category_id !== undefined || input.category !== undefined) {
    patch.categoryId = await resolveCategoryId(input)
  }

  await db.update(items).set(patch).where(eq(items.id, id))
  const fresh = (await db.select().from(items).where(eq(items.id, id)).limit(1))[0]!

  if (fresh.stock !== current.stock) {
    await notifyLowStock({ id: fresh.id, name: fresh.name, stock: fresh.stock, unit: fresh.unit, warehouseId: fresh.warehouseId })
  }
  return c.json({ data: itemResource(fresh, await categoryNameOf(fresh.categoryId)) })
})

// DELETE /items/:id → 204
itemsRouter.delete('/items/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  await ownedItem(id, user.id)
  await db.delete(items).where(eq(items.id, id))
  return c.body(null, 204)
})
