import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import type { Env } from '../../app.ts'
import { db } from '../../db/client.ts'
import { crops, stages } from '../../db/schema.ts'
import { cropTemplateResource } from '../../serializers/crop-template.ts'

export const cropTemplatesRouter = new Hono<Env>()

// GET /crop-templates (publik) — growth_days = SUM(stages.duration_days), null bila tak ada stage.
cropTemplatesRouter.get('/crop-templates', async (c) => {
  const rows = await db
    .select({
      crop: crops,
      growthDays: sql<number | null>`sum(${stages.durationDays})`,
    })
    .from(crops)
    .leftJoin(stages, eq(stages.cropId, crops.id))
    .groupBy(crops.id)
    .orderBy(crops.id)
  return c.json({ data: rows.map((r) => cropTemplateResource(r.crop, r.growthDays === null ? null : Number(r.growthDays))) })
})
