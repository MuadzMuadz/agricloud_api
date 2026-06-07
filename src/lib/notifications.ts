import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { notifications, warehouses } from '../db/schema.ts'
import { config } from '../config.ts'

const NOTIFIABLE_TYPE = 'App\\Models\\User'
const LOW_STOCK_TYPE = 'App\\Notifications\\LowStockNotification'

function dbNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export interface ItemForNotify {
  id: number
  name: string
  stock: number
  unit: string
  warehouseId: number
}

// Padanan ItemsObserver::notifyIfLowStock + LowStockNotification (channel database).
// Dipanggil setelah item dibuat/diperbarui atau stok berubah via movement.
export async function notifyLowStock(item: ItemForNotify): Promise<void> {
  const threshold = config.lowStockThreshold
  if (item.stock >= threshold) return

  const wh = await db
    .select({ farmerId: warehouses.farmerId })
    .from(warehouses)
    .where(eq(warehouses.id, item.warehouseId))
    .limit(1)
  const farmerId = wh[0]?.farmerId
  if (!farmerId) return

  const now = dbNow()
  await db.insert(notifications).values({
    id: randomUUID(),
    type: LOW_STOCK_TYPE,
    notifiableType: NOTIFIABLE_TYPE,
    notifiableId: farmerId,
    data: JSON.stringify({
      type: 'low_stock',
      title: 'Stok menipis',
      body: `${item.name} tersisa ${item.stock} ${item.unit}`,
      data: {
        item_id: item.id,
        warehouse_id: item.warehouseId,
        stock: item.stock,
        unit: item.unit,
        threshold,
      },
    }),
    readAt: null,
    createdAt: now,
    updatedAt: now,
  })
}
