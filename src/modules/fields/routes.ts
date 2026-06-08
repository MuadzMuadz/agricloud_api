import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import type { Env } from '../../app.ts'
import { db } from '../../db/client.ts'
import { lands, cycles } from '../../db/schema.ts'
import { readBody, validate, nullifyEmpty } from '../../lib/request.ts'
import { validationError, notFound, forbidden, conflict, storageError } from '../../lib/http.ts'
import { storePublic, deletePublic } from '../../lib/storage.ts'
import { getStatusId } from '../../lib/domain.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { assembleLands } from './service.ts'
import { createLandSchema, updateLandSchema } from './validators.ts'

const dbNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const numToStr = (n: number | null | undefined) => (n == null ? null : String(n))

// Validasi file thumbnail (image, maks 5 MB) — padanan rule 'image','max:5120'.
function takeThumbnail(body: Record<string, unknown>): File | null {
  const f = body.thumbnail
  if (!f || !(f instanceof File) || f.size === 0) return null
  if (!f.type.startsWith('image/')) {
    throw validationError({ thumbnail: ['The thumbnail field must be an image.'] })
  }
  if (f.size > 5 * 1024 * 1024) {
    throw validationError({ thumbnail: ['The thumbnail field must not be greater than 5120 kilobytes.'] })
  }
  return f
}

export const fieldsRouter = new Hono<Env>()

// GET /myfields
fieldsRouter.get('/myfields', requireAuth, async (c) => {
  const user = c.get('user')
  const rows = await db
    .select()
    .from(lands)
    .where(eq(lands.farmerId, user.id))
    .orderBy(desc(lands.createdAt))
  return c.json({ data: await assembleLands(rows, user.name) })
})

// GET /myfields/:id (owner-scoped → 404 bila bukan milik / tak ada)
fieldsRouter.get('/myfields/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const rows = await db
    .select()
    .from(lands)
    .where(and(eq(lands.id, id), eq(lands.farmerId, user.id)))
    .limit(1)
  if (!rows[0]) throw notFound()
  const [out] = await assembleLands(rows, user.name)
  return c.json({ data: out })
})

// POST /myfields (multipart)
fieldsRouter.post('/myfields', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await readBody(c)
  const input = validate(createLandSchema, nullifyEmpty(body))
  const thumb = takeThumbnail(body)

  let imageUrl: string | null = null
  if (thumb) {
    try {
      imageUrl = await storePublic('lands', thumb)
    } catch (e) {
      console.error('storePublic gagal:', e) // pesan asli tetap ke log untuk diagnosis
      throw storageError()
    }
  }
  const boundary = input.boundary ? JSON.parse(input.boundary) : null
  const now = dbNow()

  const inserted = await db
    .insert(lands)
    .values({
      farmerId: user.id,
      name: input.name,
      description: input.description ?? null,
      area: numToStr(input.area),
      latitude: numToStr(input.latitude),
      longitude: numToStr(input.longitude),
      boundary,
      imageUrl,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  const [out] = await assembleLands(inserted, user.name)
  return c.json({ data: out }, 201)
})

// Owner-check eksplisit: 404 bila tak ada, 403 bila milik user lain.
async function ownedLand(landId: number, userId: number) {
  const rows = await db.select().from(lands).where(eq(lands.id, landId)).limit(1)
  const land = rows[0]
  if (!land) throw notFound()
  if (land.farmerId !== userId) throw forbidden()
  return land
}

// PUT /myfields/:id (multipart)
fieldsRouter.put('/myfields/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const land = await ownedLand(id, user.id)

  const body = await readBody(c)
  const input = validate(updateLandSchema, nullifyEmpty(body))
  const thumb = takeThumbnail(body)

  const patch: Record<string, unknown> = { updatedAt: dbNow() }
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.area !== undefined) patch.area = numToStr(input.area)
  if (input.latitude !== undefined) patch.latitude = numToStr(input.latitude)
  if (input.longitude !== undefined) patch.longitude = numToStr(input.longitude)
  if (input.boundary !== undefined) patch.boundary = input.boundary ? JSON.parse(input.boundary) : null
  if (thumb) {
    await deletePublic(land.imageUrl)
    try {
      patch.imageUrl = await storePublic('lands', thumb)
    } catch (e) {
      console.error('storePublic gagal:', e) // pesan asli tetap ke log untuk diagnosis
      throw storageError()
    }
  }

  await db.update(lands).set(patch).where(eq(lands.id, id))
  const fresh = await db.select().from(lands).where(eq(lands.id, id)).limit(1)
  const [out] = await assembleLands(fresh, user.name)
  return c.json({ data: out })
})

// DELETE /myfields/:id
fieldsRouter.delete('/myfields/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const land = await ownedLand(id, user.id)

  const activeId = await getStatusId('Active', 'cycle')
  if (activeId != null) {
    const active = await db
      .select({ id: cycles.id })
      .from(cycles)
      .where(and(eq(cycles.landId, id), eq(cycles.statusId, activeId)))
      .limit(1)
    if (active.length) {
      throw conflict('Lahan masih punya siklus tanam aktif. Selesaikan/hapus siklusnya dulu.')
    }
  }

  await deletePublic(land.imageUrl)
  await db.delete(lands).where(eq(lands.id, id))
  return c.json({ message: 'Lahan berhasil dihapus' })
})
