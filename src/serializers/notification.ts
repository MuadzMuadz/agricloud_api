import type { notifications } from '../db/schema.ts'

type NotifRow = typeof notifications.$inferSelect

function iso8601(value: string | null): string | null {
  if (!value) return null
  // toIso8601String() Carbon: 'YYYY-MM-DDTHH:MM:SS+00:00' (tanpa mikrodetik).
  return value.replace(' ', 'T') + '+00:00'
}

// Padanan NotificationResource (membungkus DatabaseNotification).
export function notificationResource(n: NotifRow): Record<string, unknown> {
  let payload: Record<string, unknown> = {}
  try {
    payload = typeof n.data === 'string' ? JSON.parse(n.data) : (n.data as Record<string, unknown>) ?? {}
  } catch {
    payload = {}
  }
  return {
    id: n.id,
    type: (payload.type as string) ?? n.type,
    title: (payload.title as string) ?? null,
    body: (payload.body as string) ?? null,
    data: payload.data ?? [],
    is_read: n.readAt !== null,
    created_at: iso8601(n.createdAt),
  }
}
