import type { crops } from '../db/schema.ts'
import { url } from '../lib/url.ts'

type CropRow = typeof crops.$inferSelect

// Padanan CropTemplateResource. growth_days = SUM(stages.duration_days).
export function cropTemplateResource(crop: CropRow, growthDays: number | null): Record<string, unknown> {
  return {
    id: crop.id,
    name: crop.name,
    description: crop.description,
    thumbnail: url(crop.imageUrl),
    category: crop.category,
    growth_days: growthDays !== null ? Math.trunc(growthDays) : null,
  }
}
