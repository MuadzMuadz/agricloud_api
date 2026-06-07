import type { items } from '../db/schema.ts'
import { laravelDate } from '../lib/url.ts'

type ItemRow = typeof items.$inferSelect

// Padanan ItemResource. Catatan: hanya `created_at` (tanpa updated_at).
export function itemResource(item: ItemRow, categoryName: string | null): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    stock: item.stock,
    category: categoryName,
    category_id: item.categoryId,
    warehouse_id: item.warehouseId,
    created_at: laravelDate(item.createdAt),
  }
}
