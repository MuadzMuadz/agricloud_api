import { laravelDate } from '../lib/url.ts'

export function mapDirection(code: string | null | undefined): string | null {
  switch (code) {
    case 'IN':
      return 'Masuk'
    case 'OUT':
      return 'Keluar'
    case 'TRANSFER':
      return 'Transfer'
    default:
      return code ?? null
  }
}

export interface MovementView {
  id: number
  createdAt: string | null
  itemId: number
  itemName: string | null
  categoryName: string | null
  quantity: string | null
  code: string | null
  note: string | null
  statusName: string | null
}

// Padanan MovementResource.
export function movementResource(m: MovementView): Record<string, unknown> {
  return {
    id: m.id,
    date: laravelDate(m.createdAt),
    item_id: m.itemId,
    item_name: m.itemName,
    category: m.categoryName,
    qty: m.quantity == null ? 0 : Number(m.quantity),
    direction: mapDirection(m.code),
    note: m.note,
    status: m.statusName,
    created_at: laravelDate(m.createdAt),
  }
}
