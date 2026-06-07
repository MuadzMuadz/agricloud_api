# CLAUDE.md — agricloud_api (Backend JS)

Backend REST API AgriCloud berbasis **Hono + Bun + TypeScript + Drizzle**, hasil migrasi dari `Agricloud_v2` (Laravel). **Tunduk pada `CLAUDE.md` root proyek** (`/home/maxzcv/project/agricloud/CLAUDE.md`) dan dokumentasi vault [[06 - Guard Rails & Workflow]]. Aturan di sini melengkapi (bukan menggantikan) aturan root.

Dokumentasi terkait (di vault `AgriCloud-Vault`):
- Plan: `Plans/Backend-Migration-JS.md` · Hasil: `Logs/Backend-Migration-JS-Hasil.md`
- Cutover: `Plans/Backend-Migration-JS-Cutover-Runbook.md` · Env: `Plans/Backend-Migration-JS-Env-Mapping.md`

## Stack & Prinsip

- **Runtime:** Bun + TypeScript; kode **runtime-agnostic** (Hono) → bisa serverless (Vercel/Netlify) maupun server biasa.
- **ORM:** Drizzle. Skema `src/db/schema.ts` hasil `drizzle-kit introspect` — **JANGAN edit manual untuk mengubah DB**.
- **Validasi:** Zod. Bentuk error ala-Laravel: 422 `{message, errors}`, 404/403/409 `{message}` (lihat `src/lib/http.ts`).
- **Auth:** **JWT stateless** (`jose`, HS256, klaim sub/jti/iat/exp). Logout/revoke via blocklist `jti` (tabel `jwt_blocklist`). Bentuk response token sama dengan Laravel (`access_token/token_type/expires_at`).
- **Tujuan utama:** **parity 100%** dengan Laravel — kontrak request/response & status code identik supaya `agricloud_fe` & `Frontend_AgriCloudMobile` tidak perlu diubah (selain base URL saat cutover).

## Alur Kerja (ikut root — 8 langkah)

Rencana → Dok. Plan (`vault/Plans/`) → Revisi → **Approve** → Implementasi → Revisi → **Approve Hasil** → Dok. Hasil (`vault/Logs/`). Jangan loncat ke implementasi sebelum plan di-approve. Dokumentasi naratif masuk **vault**, bukan source tree.

## Hard Guard Rails

- 🚫 **Jangan ubah skema DB** dari sini — DB dibagi dengan Laravel selama transisi (tidak ada migration baru; `jwt_blocklist` dibuat idempotent oleh backend, tidak menyentuh tabel Laravel).
- 🚫 Jangan hapus/overwrite file besar tanpa izin; jangan `git commit`/`push` kecuali diminta.
- ⚠️ Sebutkan dulu di plan bila menambah dependency atau menyentuh skema.

## Tiket Integrasi Lintas-Repo (WAJIB)

Bila menemukan kebutuhan yang menuntut kerja di repo lain (mis. FE harus ganti base URL, kontrak berubah), **buat tiket** — jangan ditambal diam-diam. Template ada di repo: **`docs/Ticket-Integrasi.template.md`**. Tiket final disimpan di **`vault/Tickets/<Scope>.md`** (`to: frontend-web | frontend-mobile`), ditautkan ke plan/log. Contoh aktif: `vault/Tickets/Cutover-FE-BaseURL.md`.

## Aturan Port & Verifikasi

- **Port resmi backend = 8005.** Cek dulu apakah sudah nyala; kalau belum, nyalakan di **8005** — **jangan port lain**.
- Saat Laravel lama masih memakai 8005, verifikasi via `app.fetch()` tanpa bind port (lihat `scripts/parity-check.ts`).
- Perubahan logic **wajib dites**. Parity vs Laravel: `bun run parity` (butuh Laravel jalan di :8005) — harus hijau sebelum lapor selesai. Sertakan bukti.

## Struktur

```
src/
├─ index.ts          # entry Bun (port 8005) + serve /storage lokal
├─ app.ts            # createApp(): CORS, /up, error handler, mount router (runtime-agnostic)
├─ config.ts         # env → config (padanan config/agricloud.php)
├─ db/{schema,relations,client}.ts
├─ middleware/auth.ts # requireAuth (JWT) + optionalUser
├─ lib/               # token, password, google, mail, storage, weather, task-deriver, notifications, http, request, pagination, url, domain
├─ modules/<domain>/  # routes + validators per domain (auth, fields, cycles, warehouses, items, movements, tasks, notifications, weather, crop-templates)
└─ serializers/       # padanan API Resources
api/index.ts          # handler serverless Vercel
netlify/functions/    # handler serverless Netlify
scripts/              # parity-check, backfill-image-urls
```

## Menjalankan

```bash
bun install
cp .env.example .env   # isi DATABASE_URL, JWT_SECRET, dst
bun run dev            # watch, port 8005
bun run typecheck      # tsc --noEmit
bun run parity         # diff semua endpoint vs Laravel :8005
```

## Bahasa

Chat: Indonesia santai (istilah teknis boleh Inggris). Dokumen/komentar kode penting: Indonesia formal.
