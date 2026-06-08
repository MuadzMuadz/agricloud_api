import type { crops, stages } from '../db/schema.ts'
import { url } from '../lib/url.ts'

type CropRow = typeof crops.$inferSelect
type StageRow = typeof stages.$inferSelect

// Padanan CropTemplateResource. growth_days = SUM(stages.duration_days).
// phases = daftar tahap (stages) urut by order.
export function cropTemplateResource(crop: CropRow, cropStages: StageRow[]): Record<string, unknown> {
  const ordered = [...cropStages].sort((a, b) => a.order - b.order)
  const hasDuration = ordered.some((s) => s.durationDays !== null)
  const growthDays = hasDuration
    ? ordered.reduce((sum, s) => sum + (s.durationDays ?? 0), 0)
    : null
  return {
    id: crop.id,
    name: crop.name,
    description: crop.description,
    thumbnail: url(crop.imageUrl),
    category: crop.category,
    icon: crop.icon,
    growth_days: growthDays,
    phases: ordered.map((s) => ({
      order: s.order,
      name: s.name,
      duration_days: s.durationDays,
      description: s.description,
    })),
  }
}
