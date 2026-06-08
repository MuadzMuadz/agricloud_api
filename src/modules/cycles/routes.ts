import { Hono } from 'hono'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Env } from '../../app.ts'
import { db } from '../../db/client.ts'
import { lands, cycles, crops, statuses, stages, phases } from '../../db/schema.ts'
import { readBody, validate, nullifyEmpty } from '../../lib/request.ts'
import { notFound, validationError } from '../../lib/http.ts'
import { getStatusId, activePhaseNamesByCycle } from '../../lib/domain.ts'
import { cycleResource } from '../../serializers/cycle.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { cycleIndexSchema, cycleStoreSchema } from './validators.ts'

const dbNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const today = () => new Date().toISOString().slice(0, 10)

async function ownedLandId(landId: number, userId: number): Promise<number> {
  const rows = await db
    .select({ id: lands.id })
    .from(lands)
    .where(and(eq(lands.id, landId), eq(lands.farmerId, userId)))
    .limit(1)
  if (!rows[0]) throw notFound() // padanan Lands()->findOrFail → 404
  return rows[0].id
}

export const cyclesRouter = new Hono<Env>()

// GET /cycles?field_id=
cyclesRouter.get('/cycles', requireAuth, async (c) => {
  const user = c.get('user')
  const input = validate(cycleIndexSchema, c.req.query())
  const landId = await ownedLandId(input.field_id, user.id)

  const rows = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      landId: cycles.landId,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
      cropName: crops.name,
      statusName: statuses.name,
    })
    .from(cycles)
    .leftJoin(crops, eq(cycles.cropId, crops.id))
    .leftJoin(statuses, eq(cycles.statusId, statuses.id))
    .where(eq(cycles.landId, landId))
    .orderBy(desc(cycles.startDate))

  const phaseNames = await activePhaseNamesByCycle(rows.map((r) => r.id))
  const out = rows.map((r) =>
    cycleResource({
      id: r.id,
      plantName: r.cropName,
      name: r.name,
      fieldId: r.landId,
      startDate: r.startDate,
      statusName: r.statusName,
      phaseName: phaseNames.get(r.id) ?? null,
      endDate: r.endDate,
    }),
  )
  return c.json({ data: out })
})

// POST /cycles
cyclesRouter.post('/cycles', requireAuth, async (c) => {
  const user = c.get('user')
  const input = validate(cycleStoreSchema, nullifyEmpty(await readBody(c)))

  // exists:crops,id
  const cropRow = await db.select({ id: crops.id }).from(crops).where(eq(crops.id, input.crop_id)).limit(1)
  if (!cropRow.length) throw validationError({ crop_id: ['The selected crop id is invalid.'] })

  const landId = await ownedLandId(input.land_id, user.id)

  const statusName =
    input.status === 'pending' ? 'Pending' : input.status === 'done' ? 'Completed' : 'Active'
  const statusId = await getStatusId(statusName, 'cycle')
  // Resolve di luar db.transaction(): getStatusId memakai global `db`, bukan `tx`.
  // Memanggilnya di dalam tx → minta koneksi kedua dari pool (prod max=1) → deadlock → 502.
  const phaseStatusId = await getStatusId('Active', 'phase')

  const startDate = input.start_date ?? null
  let endDate = input.end_date ?? null
  if (!endDate && startDate) {
    const dur = await db
      .select({ total: sql<number>`coalesce(sum(${stages.durationDays}), 0)` })
      .from(stages)
      .where(eq(stages.cropId, input.crop_id))
    const totalDays = Number(dur[0]?.total ?? 0)
    if (totalDays > 0) {
      endDate = new Date(Date.parse(`${startDate}T00:00:00Z`) + totalDays * 86400000)
        .toISOString()
        .slice(0, 10)
    }
  }

  const newCycleId = await db.transaction(async (tx) => {
    const now = dbNow()
    const ins = await tx
      .insert(cycles)
      .values({
        landId,
        cropId: input.crop_id,
        statusId,
        name: input.name,
        description: input.description ?? null,
        startDate,
        endDate,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: cycles.id })
    const cycleId = ins[0]!.id

    // Seed fase awal: stage ber-order terkecil, Status {Active, phase}.
    const firstStage = await tx
      .select({ id: stages.id })
      .from(stages)
      .where(eq(stages.cropId, input.crop_id))
      .orderBy(stages.order)
      .limit(1)
    if (firstStage[0]) {
      await tx.insert(phases).values({
        cycleId,
        stageId: firstStage[0].id,
        statusId: phaseStatusId,
        startedAt: today(),
        createdAt: now,
        updatedAt: now,
      })
    }
    return cycleId
  })

  // Muat ulang untuk response.
  const row = (
    await db
      .select({
        id: cycles.id,
        name: cycles.name,
        landId: cycles.landId,
        startDate: cycles.startDate,
        endDate: cycles.endDate,
        cropName: crops.name,
        statusName: statuses.name,
      })
      .from(cycles)
      .leftJoin(crops, eq(cycles.cropId, crops.id))
      .leftJoin(statuses, eq(cycles.statusId, statuses.id))
      .where(eq(cycles.id, newCycleId))
      .limit(1)
  )[0]!
  const phaseNames = await activePhaseNamesByCycle([newCycleId])

  return c.json(
    {
      data: cycleResource({
        id: row.id,
        plantName: row.cropName,
        name: row.name,
        fieldId: row.landId,
        startDate: row.startDate,
        statusName: row.statusName,
        phaseName: phaseNames.get(newCycleId) ?? null,
        endDate: row.endDate,
      }),
    },
    201,
  )
})
