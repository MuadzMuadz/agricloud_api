# agricloud_api

Backend REST API AgriCloud — **Hono + Bun + TypeScript + Drizzle**, hasil migrasi dari `Agricloud_v2` (Laravel). Connect ke PostgreSQL yang sama (skema tidak diubah). Parity 100% dengan Laravel (lihat `bun run parity`).

## Setup

```bash
bun install
cp .env.example .env   # isi DATABASE_URL, JWT_SECRET, dst
bun run dev            # http://localhost:8005
```

> Port resmi backend = **8005**. Saat tes lokal, pastikan Laravel lama tidak memakai 8005.

## Scripts

| Perintah | Fungsi |
|----------|--------|
| `bun run dev` | Jalankan server (watch) di port 8005 |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run parity` | Bandingkan SEMUA endpoint vs Laravel (:8005) — exit 0 bila cocok |
| `bun run db:introspect` | Re-introspect skema dari DB (drizzle-kit) |
| `bun run backfill:images` | Konversi `image_url` `/storage/...` → URL Supabase (cutover) |

## Arsitektur

- `src/app.ts` — `createApp()`: wire CORS, healthcheck `/up`, error handler ala-Laravel, mount router. Runtime-agnostic (dipakai Bun lokal & serverless).
- `src/index.ts` — entry Bun (port 8005) + penyajian file lokal `/storage/*`.
- `src/db/` — `schema.ts` (introspect), `client.ts` (postgres-js, mode pooler via `DB_PREPARE`).
- `src/middleware/auth.ts` — `requireAuth` (JWT) + `optionalUser`.
- `src/lib/` — `token` (JWT + jti blocklist), `password` (bcrypt kompat Laravel), `google`, `mail`, `storage` (local/supabase), `weather`, `task-deriver`, `notifications`, `http`, `request`, `pagination`.
- `src/modules/<domain>/` — routes + validators per domain.
- `src/serializers/` — padanan API Resources Laravel.

## Auth (JWT stateless)

Login verifikasi bcrypt password existing → terbitkan **JWT** (HS256, klaim sub/jti/iat/exp). Logout/revoke via blocklist `jti` (tabel `jwt_blocklist`). Bentuk response token sama dengan Laravel (`access_token/token_type/expires_at`).

## Deploy (serverless)

- **Vercel:** `api/index.ts` (`handle(createApp())`) + `vercel.json`. `vercel --prod`.
- **Netlify:** `netlify/functions/api.ts` (Functions 2.0, web-standard) + `netlify.toml`.
- DB: gunakan **pooler** Supabase (`:6543`, transaction mode) + `DB_PREPARE=false`.
- File: `STORAGE_DRIVER=supabase` + `SUPABASE_*`.

Runbook lengkap: `vault/Plans/Backend-Migration-JS-Cutover-Runbook.md`.
