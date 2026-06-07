---
title: "Ticket — <Judul Singkat Masalah>"
tags: [agricloud, ticket, integrasi]
created: <YYYY-MM-DD>
scope: "<mis. Cutover-FE-BaseURL>"
type: ticket
status: open   # open | in-progress | blocked | done
from: backend                                   # asal masalah (repo ini)
to: <frontend-web | frontend-mobile>            # repo yang harus mengerjakan
priority: <low | medium | high>
plan: "<[[Plan terkait]] bila ada>"
---

# Ticket — <Judul Singkat Masalah>

> Template lokal repo `agricloud_api`. Mengikuti aturan tiket lintas-repo di
> `CLAUDE.md` root & [[06 - Guard Rails & Workflow]]. **Tiket final disimpan di
> `vault/Tickets/<Scope>.md`** (file ini hanya cetakan; jangan jadikan tiket aktif).
> Dibuat saat menggarap backend (`agricloud_api`) lalu menemukan kebutuhan yang
> harus dikerjakan di repo lain (web/mobile).

> [!summary] Inti
> <1–2 kalimat: apa yang dibutuhkan/berubah, dan kenapa butuh kerja di repo FE.>

## 1. Konteks & Gejala
- **Dari:** `agricloud_api/<file/komponen, mis. src/modules/auth/routes.ts:42>`
- **Apa yang terjadi / berubah:** <perilaku, perubahan kontrak, atau kebutuhan baru>
- **Kenapa butuh repo lain:** <alasan singkat — base URL, format response, alur auth, dsb.>

## 2. Yang Diminta (kontrak)
> Sespesifik mungkin supaya repo tujuan bisa langsung kerja tanpa nanya balik.

- **Endpoint / perubahan:** `<METHOD> <path>` — <publik / Bearer>
- **Request:**

  ```jsonc
  { "field": "..." }
  ```

- **Response sukses (<HTTP>):**

  ```jsonc
  { "data": { } }
  ```

- **Error yang diharapkan:** <kode + bentuk body, mis. 401 / 422 `{message,errors}`>
- **Aturan/edge case:** <nullable, paginasi, relogin, dsb.>

## 3. Prasyarat / Dependensi
- <env, kredensial, domain, dependency baru — sebutkan yang butuh approval.>

## 4. Cara Verifikasi (Definition of Done)
- [ ] <tes konkret, mis. `bun run parity` hijau / curl :8005 → 200>
- [ ] <perilaku FE setelah backend siap>
- [ ] Log hasil ditulis ke `vault/Logs/<Scope>-Hasil.md`.

## 5. Catatan & Riwayat
- <YYYY-MM-DD> — dibuat.
