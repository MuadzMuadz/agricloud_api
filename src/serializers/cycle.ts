import { laravelDate } from '../lib/url.ts'

// Petakan nama Status DB → nilai kontrak FE (padanan CycleResource::mapStatus).
export function mapStatus(name: string | null | undefined): string | null {
  switch (name) {
    case 'Active':
      return 'active'
    case 'Pending':
      return 'pending'
    case 'Completed':
      return 'done'
    default:
      return name != null ? name.toLowerCase() : null
  }
}

// Progress 0–100 dari posisi hari ini di rentang start..end (detik), clamp 0..1.
// null bila salah satu tanggal kosong atau rentang tidak valid.
// Padanan CycleResource::progressFromDates (Carbon, timezone UTC).
export function progressFromDates(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  const total = (endMs - startMs) / 1000
  if (!(total > 0)) return null
  const elapsed = (Date.now() - startMs) / 1000
  const ratio = Math.max(0, Math.min(1, elapsed / total))
  return Math.round(ratio * 100)
}

export interface CycleView {
  id: number
  plantName: string | null
  name: string
  fieldId: number
  startDate: string | null
  statusName: string | null
  phaseName: string | null
  endDate: string | null
}

// Padanan CycleResource (dibungkus { data } / collection oleh handler).
export function cycleResource(v: CycleView): Record<string, unknown> {
  return {
    id: v.id,
    plant_name: v.plantName,
    name: v.name,
    field_id: v.fieldId,
    start_date: v.startDate,
    status: mapStatus(v.statusName),
    phase: v.phaseName,
    progress: progressFromDates(v.startDate, v.endDate),
    estimated_harvest_date: v.endDate,
  }
}

export { laravelDate }
