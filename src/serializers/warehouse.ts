import type { warehouses } from '../db/schema.ts'
import { url, laravelDate, num } from '../lib/url.ts'

type WarehouseRow = typeof warehouses.$inferSelect

export interface WarehouseExtras {
  ownerName: string | null
  itemsCount: number
  stockSum: number
  // Hanya disertakan pada show() (padanan whenLoaded('Items')).
  items?: Record<string, unknown>[]
}

// Padanan WarehouseResource.
export function warehouseResource(w: WarehouseRow, x: WarehouseExtras): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: w.id,
    name: w.name,
    thumbnail: url(w.imageUrl),
    address: w.location,
    description: w.description,
    capacity: w.capacity,
    items_count: x.itemsCount,
    stock_total: x.stockSum | 0,
    used: x.stockSum | 0,
  }
  if (x.items !== undefined) out.items = x.items
  out.location = { latitude: num(w.latitude), longitude: num(w.longitude) }
  out.owner = { id: w.farmerId, name: x.ownerName }
  out.created_at = laravelDate(w.createdAt)
  out.updated_at = laravelDate(w.updatedAt)
  return out
}
