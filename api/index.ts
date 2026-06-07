// Entry serverless Vercel (runtime Node). Semua request di-rewrite ke /api
// (lihat vercel.json) lalu ditangani Hono via path asli request.
import { handle } from 'hono/vercel'
import { createApp } from '../src/app.ts'

export const config = { runtime: 'nodejs' }

const app = createApp()

export default handle(app)
