import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { statuses, phases, stages } from '../db/schema.ts'

// Cache id status (data seed statis: Active/Pending/Completed × cycle/phase/movement).
const statusCache = new Map<string, number | null>()

// ⚠️ PERINGATAN KONEKSI: getStatusId memakai global `db`, BUKAN `tx`. JANGAN memanggilnya
// dari dalam `db.transaction()` — di production pool DB = 1 koneksi/instance, sehingga
// transaksi sudah memegang satu-satunya koneksi dan getStatusId akan menunggu koneksi
// kedua yang tak pernah bebas → deadlock → query hang → 502 (lihat Cycle-CreateCrash-502).
// Resolve status di LUAR transaksi lalu pakai variabelnya di dalam tx (status = seed statis).
export async function getStatusId(name: string, type: string): Promise<number | null> {
  const key = `${name}|${type}`
  if (statusCache.has(key)) return statusCache.get(key)!
  const r = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(and(eq(statuses.name, name), eq(statuses.type, type)))
    .limit(1)
  const id = r[0]?.id ?? null
  statusCache.set(key, id)
  return id
}

// Nama Stage dari fase aktif (Status Active/phase) per cycle. Map<cycleId, stageName>.
// Padanan CycleResource::activePhaseName untuk banyak cycle sekaligus.
export async function activePhaseNamesByCycle(
  cycleIds: number[],
): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>()
  if (cycleIds.length === 0) return out
  const rows = await db
    .select({ cycleId: phases.cycleId, stageName: stages.name, phaseId: phases.id })
    .from(phases)
    .innerJoin(statuses, eq(phases.statusId, statuses.id))
    .innerJoin(stages, eq(phases.stageId, stages.id))
    .where(
      and(
        inArray(phases.cycleId, cycleIds),
        eq(statuses.name, 'Active'),
        eq(statuses.type, 'phase'),
      ),
    )
    .orderBy(phases.id)
  for (const row of rows) {
    if (!out.has(row.cycleId)) out.set(row.cycleId, row.stageName) // first per cycle
  }
  return out
}
