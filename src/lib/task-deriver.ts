import { and, eq, lte, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { cycles, lands, crops, statuses, needs, phases, items, warehouses } from '../db/schema.ts'
import { config } from '../config.ts'

// Port App\Support\TaskDeriver — "Tindakan Hari Ini" (computed, tanpa tabel tasks).

export interface Task {
  id: string
  title: string
  field_id: number | null
  field_name: string | null
  type: 'harvest' | 'input' | 'restock'
  due_date: string | null
  urgency: 'due' | 'today' | 'urgent' | 'upcoming'
}

function todayUtc(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

export function urgencyFromDate(dateStr: string): Task['urgency'] {
  const urgentWindow = config.urgentWindowDays
  const days = Math.round((Date.parse(`${dateStr}T00:00:00Z`) - todayUtc().getTime()) / 86_400_000)
  if (days < 0) return 'due'
  if (days === 0) return 'today'
  if (days <= urgentWindow) return 'urgent'
  return 'upcoming'
}

function urgencyRank(u: string): number {
  return u === 'due' ? 0 : u === 'urgent' ? 1 : u === 'today' ? 2 : u === 'upcoming' ? 3 : 4
}

async function harvestTasks(userId: number): Promise<Task[]> {
  const limit = new Date(todayUtc().getTime() + config.harvestLookaheadDays * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const rows = await db
    .select({
      id: cycles.id,
      landId: cycles.landId,
      endDate: cycles.endDate,
      landName: lands.name,
      cropName: crops.name,
    })
    .from(cycles)
    .innerJoin(statuses, eq(cycles.statusId, statuses.id))
    .innerJoin(lands, eq(cycles.landId, lands.id))
    .leftJoin(crops, eq(cycles.cropId, crops.id))
    .where(
      and(
        eq(statuses.name, 'Active'),
        eq(statuses.type, 'cycle'),
        eq(lands.farmerId, userId),
        isNotNull(cycles.endDate),
        lte(cycles.endDate, limit),
      ),
    )
  return rows.map((r) => {
    let fieldName = r.landName as string | null
    if (fieldName !== null && r.cropName !== null) fieldName += ' — ' + r.cropName
    return {
      id: `cycle-${r.id}-harvest`,
      title: r.cropName !== null ? 'Estimasi panen ' + r.cropName : 'Estimasi panen',
      field_id: r.landId,
      field_name: fieldName,
      type: 'harvest',
      due_date: r.endDate ? r.endDate.slice(0, 10) : null,
      urgency: urgencyFromDate(r.endDate!),
    }
  })
}

async function inputTasks(userId: number): Promise<Task[]> {
  const rows = await db
    .select({
      id: needs.id,
      quantityNeeded: needs.quantityNeeded,
      itemStock: items.stock,
      itemName: items.name,
      landId: lands.id,
      landName: lands.name,
    })
    .from(needs)
    .innerJoin(phases, eq(needs.phaseId, phases.id))
    .innerJoin(statuses, eq(phases.statusId, statuses.id))
    .innerJoin(cycles, eq(phases.cycleId, cycles.id))
    .innerJoin(lands, eq(cycles.landId, lands.id))
    .leftJoin(items, eq(needs.itemId, items.id))
    .where(
      and(
        eq(statuses.name, 'Active'),
        eq(statuses.type, 'phase'),
        eq(lands.farmerId, userId),
      ),
    )
  return rows
    .filter((r) => r.itemStock === null || r.itemStock < r.quantityNeeded)
    .map((r) => ({
      id: `need-${r.id}-input`,
      title: r.itemName !== null ? 'Pemberian input: ' + r.itemName : 'Pemberian input',
      field_id: r.landId,
      field_name: r.landName,
      type: 'input' as const,
      due_date: null,
      urgency: 'due' as const,
    }))
}

async function restockTasks(userId: number): Promise<Task[]> {
  const threshold = config.lowStockThreshold
  const rows = await db
    .select({ id: items.id, name: items.name, stock: items.stock })
    .from(items)
    .innerJoin(warehouses, eq(items.warehouseId, warehouses.id))
    .where(eq(warehouses.farmerId, userId))
  return rows
    .filter((r) => r.stock < threshold)
    .map((r) => ({
      id: `item-${r.id}-restock`,
      title: 'Stok menipis: ' + r.name,
      field_id: null,
      field_name: null,
      type: 'restock' as const,
      due_date: null,
      urgency: 'urgent' as const,
    }))
}

export async function tasksForUser(userId: number): Promise<Task[]> {
  const tasks = [
    ...(await harvestTasks(userId)),
    ...(await inputTasks(userId)),
    ...(await restockTasks(userId)),
  ]
  // Stable sort (Array.sort stabil di engine modern) — padanan usort PHP 8.
  tasks.sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency))
  return tasks
}

export function attentionCount(tasks: Task[]): number {
  return tasks.filter((t) => t.urgency === 'due' || t.urgency === 'urgent').length
}
