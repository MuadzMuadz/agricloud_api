import { Hono } from 'hono'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Env } from '../../app.ts'
import { config } from '../../config.ts'
import { db } from '../../db/client.ts'
import { notifications } from '../../db/schema.ts'
import { notFound } from '../../lib/http.ts'
import { paginate } from '../../lib/pagination.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { notificationResource } from '../../serializers/notification.ts'

const NOTIFIABLE_TYPE = 'App\\Models\\User'
const PER_PAGE = 15
const dbNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

function ownerWhere(userId: number) {
  return and(eq(notifications.notifiableType, NOTIFIABLE_TYPE), eq(notifications.notifiableId, userId))
}

export const notificationsRouter = new Hono<Env>()

// GET /notifications (paginate 15)
notificationsRouter.get('/notifications', requireAuth, async (c) => {
  const user = c.get('user')
  const page = Math.max(1, Number(c.req.query('page') ?? '1') || 1)

  const totalRow = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(ownerWhere(user.id))
  const total = totalRow[0]?.n ?? 0

  const rows = await db
    .select()
    .from(notifications)
    .where(ownerWhere(user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)

  const items = rows.map(notificationResource)
  return c.json(paginate(items, total, PER_PAGE, page, `${config.appUrl}/api/notifications`))
})

// GET /notifications/unread-count
notificationsRouter.get('/notifications/unread-count', requireAuth, async (c) => {
  const user = c.get('user')
  const r = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(ownerWhere(user.id), isNull(notifications.readAt)))
  return c.json({ data: { unread_count: r[0]?.n ?? 0 } })
})

// POST /notifications/:id/read
notificationsRouter.post('/notifications/:id/read', requireAuth, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), ownerWhere(user.id)))
    .limit(1)
  if (!rows[0]) throw notFound()
  if (rows[0].readAt === null) {
    await db.update(notifications).set({ readAt: dbNow(), updatedAt: dbNow() }).where(eq(notifications.id, id))
  }
  const fresh = (await db.select().from(notifications).where(eq(notifications.id, id)).limit(1))[0]!
  return c.json({ data: notificationResource(fresh) })
})

// POST /notifications/read-all
notificationsRouter.post('/notifications/read-all', requireAuth, async (c) => {
  const user = c.get('user')
  await db
    .update(notifications)
    .set({ readAt: dbNow(), updatedAt: dbNow() })
    .where(and(ownerWhere(user.id), isNull(notifications.readAt)))
  return c.json({ data: { unread_count: 0 } })
})
