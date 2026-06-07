import { Hono } from 'hono'
import type { Env } from '../../app.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { tasksForUser, attentionCount } from '../../lib/task-deriver.ts'

export const tasksRouter = new Hono<Env>()

// GET /tasks (param `due` diabaikan — kompat kontrak FE)
tasksRouter.get('/tasks', requireAuth, async (c) => {
  const user = c.get('user')
  return c.json({ data: await tasksForUser(user.id) })
})

// GET /dashboard/summary
tasksRouter.get('/dashboard/summary', requireAuth, async (c) => {
  const user = c.get('user')
  const tasks = await tasksForUser(user.id)
  return c.json({ attention_count: attentionCount(tasks), task_count: tasks.length })
})
