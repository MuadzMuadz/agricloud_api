// Entry serverless Netlify Functions 2.0 (runtime Node, web-standard Request/Response).
// Semua path diarahkan ke fungsi ini via `config.path`. Hono menangani routing
// internal (/up, /api/*, dst) dari URL asli request.
import { createApp } from '../../src/app.ts'

const app = createApp()

export default (req: Request) => app.fetch(req)

export const config = { path: '/*' }
