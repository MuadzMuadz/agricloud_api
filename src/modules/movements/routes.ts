import { Hono } from 'hono'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Env } from '../../app.ts'
import { db } from '../../db/client.ts'
import { warehouses, items, movements, moveTypes, categories, statuses } from '../../db/schema.ts'
import { readBody, validate, nullifyEmpty } from '../../lib/request.ts'
import { notFound, validationError, HttpError } from '../../lib/http.ts'
import { getStatusId } from '../../lib/domain.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { movementResource } from '../../serializers/movement.ts'
import { notifyLowStock } from '../../lib/notifications.ts'
import { movementStoreSchema } from './validators.ts'

const dbNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

async function ownedWarehouse(id: number, userId: number): Promise<number> {
  const rows = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.id, id), eq(warehouses.farmerId, userId)))
    .limit(1)
  if (!rows[0]) throw notFound()
  return rows[0].id
}

// Query gabungan movement → bentuk MovementView untuk serializer.
function movementSelect() {
  return db
    .select({
      id: movements.id,
      createdAt: movements.createdAt,
      itemId: movements.itemId,
      itemName: items.name,
      categoryName: categories.name,
      quantity: movements.quantity,
      code: moveTypes.code,
      note: movements.note,
      statusName: statuses.name,
    })
    .from(movements)
    .leftJoin(items, eq(movements.itemId, items.id))
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .leftJoin(moveTypes, eq(movements.movetypeId, moveTypes.id))
    .leftJoin(statuses, eq(movements.statusId, statuses.id))
}

export const movementsRouter = new Hono<Env>()

// GET /warehouses/:id/movements
movementsRouter.get('/warehouses/:id/movements', requireAuth, async (c) => {
  const user = c.get('user')
  const wid = await ownedWarehouse(Number(c.req.param('id')), user.id)
  const rows = await movementSelect()
    .where(eq(movements.warehouseId, wid))
    .orderBy(desc(movements.createdAt), desc(movements.id))
  return c.json({ data: rows.map(movementResource) })
})

// POST /movements
movementsRouter.post('/movements', requireAuth, async (c) => {
  const user = c.get('user')
  const input = validate(movementStoreSchema, nullifyEmpty(await readBody(c)))

  // exists:items,id (422 bila item tak ada sama sekali)
  const itemExists = await db.select({ id: items.id }).from(items).where(eq(items.id, input.item_id)).limit(1)
  if (!itemExists.length) throw validationError({ item_id: ['The selected item id is invalid.'] })

  // owner-scope: item harus di gudang milik user (404 bila bukan).
  const owned = await db
    .select({ item: items })
    .from(items)
    .innerJoin(warehouses, eq(items.warehouseId, warehouses.id))
    .where(and(eq(items.id, input.item_id), eq(warehouses.farmerId, user.id)))
    .limit(1)
  if (!owned[0]) throw notFound()
  const item = owned[0].item

  const code = input.type.toUpperCase() // IN | OUT
  const quantity = input.quantity

  const newMovementId = await db.transaction(async (tx) => {
    const mt = await tx.select({ id: moveTypes.id }).from(moveTypes).where(eq(moveTypes.code, code)).limit(1)
    if (!mt[0]) throw new HttpError(404, { message: `Movetype ${code} tidak ditemukan.` })
    const statusId = await getStatusId('Done', 'movement')

    if (code === 'OUT') {
      if (item.stock < quantity) throw validationError({ quantity: ['Stok tidak cukup.'] })
      await tx.update(items).set({ stock: sql`${items.stock} - ${quantity}` }).where(eq(items.id, item.id))
    } else {
      await tx.update(items).set({ stock: sql`${items.stock} + ${quantity}` }).where(eq(items.id, item.id))
    }

    const now = dbNow()
    const ins = await tx
      .insert(movements)
      .values({
        warehouseId: item.warehouseId,
        itemId: item.id,
        movetypeId: mt[0].id,
        statusId,
        quantity: String(quantity),
        note: input.note ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: movements.id })
    return ins[0]!.id
  })

  // Observer low-stock: stok berubah → cek ambang.
  const fresh = (await db.select().from(items).where(eq(items.id, item.id)).limit(1))[0]!
  await notifyLowStock({ id: fresh.id, name: fresh.name, stock: fresh.stock, unit: fresh.unit, warehouseId: fresh.warehouseId })

  const row = (await movementSelect().where(eq(movements.id, newMovementId)).limit(1))[0]!
  return c.json({ data: movementResource(row) }, 201)
})
