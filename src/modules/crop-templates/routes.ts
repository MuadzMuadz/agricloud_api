import { Hono } from 'hono'
import { asc } from 'drizzle-orm'
import type { Env } from '../../app.ts'
import { db } from '../../db/client.ts'
import { crops, stages } from '../../db/schema.ts'
import { cropTemplateResource } from '../../serializers/crop-template.ts'

export const cropTemplatesRouter = new Hono<Env>()

// GET /crop-templates (publik) — tiap crop beserta phases (stages) urut by order.
// growth_days = SUM(stages.duration_days), null bila tak ada durasi.
cropTemplatesRouter.get('/crop-templates', async (c) => {
  const [cropRows, stageRows] = await Promise.all([
    db.select().from(crops).orderBy(asc(crops.id)),
    db.select().from(stages).orderBy(asc(stages.order)),
  ])
  const byCrop = new Map<number, typeof stageRows>()
  for (const s of stageRows) {
    const list = byCrop.get(s.cropId) ?? []
    list.push(s)
    byCrop.set(s.cropId, list)
  }
  return c.json({ data: cropRows.map((crop) => cropTemplateResource(crop, byCrop.get(crop.id) ?? [])) })
})
