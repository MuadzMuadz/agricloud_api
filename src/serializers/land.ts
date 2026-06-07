import type { lands } from '../db/schema.ts'
import { url, laravelDate } from '../lib/url.ts'

type LandRow = typeof lands.$inferSelect

export interface ActiveCycleSummary {
  plant_name: string | null
  phase: string | null
  progress: number | null
}

export interface LandExtras {
  ownerName: string | null
  // null bila relasi Cycles tidak dimuat (paritas whenLoaded); array bila dimuat.
  crops: Array<{ id: number; name: string | null }> | null
  activeCycle: ActiveCycleSummary | null
}

// Padanan LandResource. latitude/longitude/area sengaja string (decimal tanpa
// cast di Laravel) → drizzle numeric juga string, pass-through.
export function landResource(land: LandRow, extras: LandExtras): Record<string, unknown> {
  return {
    id: land.id,
    name: land.name,
    description: land.description,
    thumbnail: url(land.imageUrl),
    location: {
      latitude: land.latitude,
      longitude: land.longitude,
    },
    area: land.area,
    boundary: land.boundary,
    crops: extras.crops,
    active_cycle: extras.activeCycle,
    owner: {
      id: land.farmerId,
      name: extras.ownerName,
    },
    created_at: laravelDate(land.createdAt),
    updated_at: laravelDate(land.updatedAt),
  }
}
