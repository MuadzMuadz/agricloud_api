import { and, eq, inArray, desc } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { cycles, crops, statuses, lands } from '../../db/schema.ts'
import { activePhaseNamesByCycle } from '../../lib/domain.ts'
import { progressFromDates } from '../../serializers/cycle.ts'
import { landResource, type LandExtras } from '../../serializers/land.ts'

type LandRow = typeof lands.$inferSelect

interface ActiveCycleRow {
  id: number
  landId: number
  startDate: string | null
  endDate: string | null
  cropId: number | null
  cropName: string | null
}

// Rakit array lahan → bentuk LandResource lengkap (crops[] + active_cycle),
// meniru eager-load Laravel (hanya siklus Active/cycle).
export async function assembleLands(
  rows: LandRow[],
  ownerName: string | null,
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return []
  const landIds = rows.map((l) => l.id)

  const activeCycles: ActiveCycleRow[] = await db
    .select({
      id: cycles.id,
      landId: cycles.landId,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
      cropId: crops.id,
      cropName: crops.name,
    })
    .from(cycles)
    .innerJoin(statuses, eq(cycles.statusId, statuses.id))
    .leftJoin(crops, eq(cycles.cropId, crops.id))
    .where(
      and(
        inArray(cycles.landId, landIds),
        eq(statuses.name, 'Active'),
        eq(statuses.type, 'cycle'),
      ),
    )
    .orderBy(desc(cycles.startDate))

  const phaseNames = await activePhaseNamesByCycle(activeCycles.map((c) => c.id))

  const byLand = new Map<number, ActiveCycleRow[]>()
  for (const c of activeCycles) {
    ;(byLand.get(c.landId) ?? byLand.set(c.landId, []).get(c.landId)!).push(c)
  }

  return rows.map((land) => {
    const cyc = byLand.get(land.id) ?? []
    // crops[]: unik by crop_id, urutan mengikuti latest(start_date).
    const seen = new Set<number>()
    const cropsList: Array<{ id: number; name: string | null }> = []
    for (const c of cyc) {
      if (c.cropId != null && !seen.has(c.cropId)) {
        seen.add(c.cropId)
        cropsList.push({ id: c.cropId, name: c.cropName })
      }
    }
    // active_cycle: siklus paling baru (start_date desc) — sudah terurut.
    const first = cyc[0]
    const extras: LandExtras = {
      ownerName,
      crops: cropsList,
      activeCycle: first
        ? {
            plant_name: first.cropName,
            phase: phaseNames.get(first.id) ?? null,
            progress: progressFromDates(first.startDate, first.endDate),
          }
        : null,
    }
    return landResource(land, extras)
  })
}
