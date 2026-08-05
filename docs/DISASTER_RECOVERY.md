# Disaster Recovery (DR) Runbook — Splitzy

> **Tujuan:** Prosedur konkret untuk memulihkan Splitzy dari kegagalan — mulai dari kehilangan data parsial sampai kehilangan total database/akun. Dokumen ini adalah acuan saat insiden; baca sekarang, bukan saat panik.
>
> Versi 1.0 · Agustus 2026 · Pemilik: tim Splitzy

---

## 0. Target Pemulihan (RPO / RTO)

| Metrik | Target | Keterangan |
|--------|--------|------------|
| **RPO** (Recovery Point Objective) | ≤ 24 jam | Kehilangan data maksimum yang bisa ditoleransi. Ditentukan oleh frekuensi backup (lihat §4). |
| **RTO** (Recovery Time Objective) | ≤ 4 jam | Waktu maksimum dari insiden sampai layanan pulih. |

> **Terkonfirmasi (Agu 2026):** Supabase FREE tier (tanpa backup bawaan). RPO ≤24 jam dijamin oleh backup otomatis harian kita sendiri (§4.2), bukan Supabase. RTO ≤4 jam masih perlu divalidasi lewat DR drill (§7).

---

## 1. Arsitektur & Titik Kegagalan

Splitzy adalah aplikasi **single-primary-store**. Satu-satunya sumber kebenaran adalah **Supabase PostgreSQL**.

```
┌─────────────────────────────────────────────────────┐
│  Vercel (Next.js — stateless, auto-deploy dari main) │
│    └── /api/health  ← liveness + readiness probe      │
└───────────────────────┬───────────────────────────────┘
                        │ Prisma (DATABASE_URL, superuser)
                        ▼
┌─────────────────────────────────────────────────────┐
│  Supabase PostgreSQL  ← SATU-SATUNYA primary store    │
│    users, trips, trip_receipts, trip_payments,        │
│    trip_members, trip_change_requests, receipts,      │
│    payments, referrals, activity_events, audit_logs   │
└─────────────────────────────────────────────────────┘

  Supabase Auth (Google OAuth) ← identitas user, terpisah dari data
```

### Stateful stores & status DR

| Store | Peran | Butuh recovery? |
|-------|-------|-----------------|
| **Supabase PostgreSQL** | Primary — semua data user | ✅ **Ya — kehilangan = total data loss** |
| **Supabase Auth** | Identitas (Google OAuth) | ⚠️ Terikat proyek Supabase; lihat §5.3 |
| Upstash Redis | Rate-limit counter (opsional, flag-gated) | ❌ Ephemeral, fallback in-memory |
| Client `localStorage` | Cache + outbox di device user | ❌ Bukan authoritative |
| Object storage | — | ❌ Tidak ada (gambar struk tidak dipersist) |

---

## 2. Peta Dependency (prasyarat restore)

Restore penuh membutuhkan **semua** kredensial berikut. Simpan salinan aman di luar Vercel (mis. password manager tim). Sumber kebenaran env: [.env.example](../.env.example).

| Layanan | Env vars | Fungsi | Kritis untuk restore? |
|---------|----------|--------|------------------------|
| **Supabase DB** | `DATABASE_URL`, `DIRECT_URL` | Primary store | 🔴 Wajib |
| **Supabase Auth** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Login user | 🔴 Wajib |
| **Google OAuth** | (di Supabase Auth provider) | Backing login | 🔴 Wajib — Client ID/Secret |
| **Google Gemini** | `GEMINI_API_KEY` | Scan struk | 🟡 Fitur inti, tidak blok login |
| Xendit | `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN` | Checkout Pro | 🟢 Flag-gated |
| Upstash | `UPSTASH_REDIS_REST_URL`, `_TOKEN` | Rate limit | 🟢 Opsional |
| Sentry | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring | 🟢 Observability |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `_HOST` | Analytics | 🟢 Observability |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Email transaksional | 🟢 Non-blocking |
| App secrets | `CRON_SECRET`, `ADMIN_BOOTSTRAP_EMAILS`, `MAINTENANCE_MODE` | Cron auth, admin recovery, kill-switch | 🟡 `ADMIN_BOOTSTRAP_EMAILS` mencegah lockout admin |

> **Aturan:** `ADMIN_BOOTSTRAP_EMAILS` harus di-set SEBELUM restore selesai — ini satu-satunya jalan masuk admin kalau kolom `role` di DB hilang/rusak.

---

## 3. Ledger Migrasi & Rollback

Skema dikelola **Prisma + SQL manual** yang dijalankan tangan di Supabase SQL editor. `prisma db push` **tidak** dipakai untuk produksi (hanya staging).

### 3.1 Urutan apply (rebuild dari nol)

1. **Skema dasar** — dari [prisma/schema.prisma](../prisma/schema.prisma), via `npx prisma db push` (hanya untuk DB kosong/rebuild, bukan prod berjalan).
2. **SQL manual suplemen** (semua idempotent, `IF NOT EXISTS` — aman diulang), urutan dependency:

   | # | File | Menambahkan |
   |---|------|-------------|
   | 1 | [add_shared_summaries.sql](../prisma/sql/add_shared_summaries.sql) | Tabel `shared_summaries` |
   | 2 | [add_admin_audit_logs.sql](../prisma/sql/add_admin_audit_logs.sql) | Tabel `admin_audit_logs` |
   | 3 | [add_user_role.sql](../prisma/sql/add_user_role.sql) | Kolom `users.role` |
   | 4 | [2026-07-add-activity-log.sql](../prisma/sql/2026-07-add-activity-log.sql) | Tabel `activity_events` |
   | 5 | [2026-07-add-trip-change-requests.sql](../prisma/sql/2026-07-add-trip-change-requests.sql) | Tabel `trip_change_requests` |
   | 6 | [2026-08-add-pro-billing.sql](../prisma/sql/2026-08-add-pro-billing.sql) | `users.pro_expires_at` + tabel `payments` |
   | 7 | [2026-08-add-referrals.sql](../prisma/sql/2026-08-add-referrals.sql) | `users.referral_code` + tabel `referrals` |

### 3.2 Rollback

- Semua migrasi **additive** (Expand-Contract) — kolom/tabel baru tidak merusak kode lama. **Rollback = deploy commit sebelumnya**; kolom/tabel baru diabaikan.
- **Tidak ada script DOWN.** Jika migrasi harus dibatalkan, tulis SQL balik manual (`DROP COLUMN`/`DROP TABLE`) — dan hanya setelah dikonfirmasi tidak ada kode yang membacanya.
- **Jangan** jalankan operasi destruktif di prod tanpa rehearsal di staging (Neon) dulu.

---

## 4. Strategi Backup

### 4.1 Supabase automatic backup

Status terkonfirmasi (Agustus 2026): **FREE tier — TIDAK ada backup harian
terjadwal.** Ini gap serius; mitigasi utama adalah backup otomatis kita sendiri
di §4.2. (Kalau nanti upgrade ke Pro: backup harian + retensi 7 hari + PITR
opsional → RPO bisa diturunkan.)

### 4.2 Backup otomatis yang dimiliki app — **AKTIF** (`.github/workflows/backup.yml`)

GitHub Actions mengambil dump **harian** (18:00 UTC / 01:00 WIB), **mengenkripsi**
(AES-256, karena berisi PII), dan menyimpannya sebagai artifact (retensi 30 hari).
Independen dari Supabase → data selamat meski akun Supabase hilang. Bisa juga
dijalankan on-demand (tombol **Run workflow**) sebelum migrasi berisiko.

**Secret repo yang wajib di-set** (GitHub → Settings → Secrets and variables → Actions):
- `SUPABASE_DIRECT_URL` — prod DIRECT_URL (port 5432, **bukan** pooler)
- `BACKUP_PASSPHRASE` — string random panjang; jaga seperti password DB

**Mengambil & mendekripsi sebuah backup:**
```bash
# 1. Download artifact "db-backup-<stamp>" dari tab Actions → unzip.
# 2. Dekripsi (butuh BACKUP_PASSPHRASE yang sama):
gpg --batch --passphrase "<BACKUP_PASSPHRASE>" -o splitzy.dump -d splitzy-<stamp>.dump.gpg
# 3. Verifikasi isi dump bisa dibaca:
pg_restore --list splitzy.dump | head
```

> **RPO nyata = ≤24 jam** (frekuensi backup harian). Untuk RPO lebih ketat,
> jalankan workflow manual lebih sering atau upgrade Supabase (PITR).

---

## 5. Prosedur Restore per-Skenario

### 5.1 Kehilangan data parsial (user hapus tidak sengaja)

Splitzy punya **soft-delete** — cek dulu sebelum restore backup:
- Trip/receipt yang dihapus punya `deleted_at` (bukan hilang) selama < 30 hari (window retensi cleanup).
- Endpoint restore sudah ada: `POST /api/travel/[id]/restore`, `/api/receipts/[id]/restore`.
- **Aksi:** pulihkan via endpoint restore atau set `deleted_at = NULL` di SQL editor. Tidak perlu backup penuh.

### 5.2 Korupsi / kehilangan data di dalam DB yang masih hidup

1. Aktifkan maintenance: set `MAINTENANCE_MODE=true` di Vercel → redeploy (user lihat halaman maintenance, tidak ada write baru).
2. Jika Supabase Pro + PITR: restore ke titik waktu sebelum korupsi via dashboard.
3. Jika tidak: restore dari dump §4.2 ke DB baru, lalu arahkan `DATABASE_URL`/`DIRECT_URL` ke DB itu.
4. Verifikasi `/api/health` = 200, spot-check beberapa trip.
5. `MAINTENANCE_MODE=false` → redeploy.

### 5.3 Kehilangan total proyek Supabase (akun/proyek lenyap)

1. Buat proyek Supabase baru (region **ap-southeast-1**).
2. Rebuild skema: §3.1 (prisma db push + 7 SQL manual).
3. Restore data dari backup §4.2: dekripsi dulu (`gpg -d`), lalu `pg_restore --no-owner --no-privileges -d "$DIRECT_URL" splitzy-<stamp>.dump`.
4. **Auth:** aktifkan Google OAuth provider, masukkan Client ID/Secret yang sama. **Penting:** user Splitzy dikaitkan via `google_id` — selama Google OAuth client sama, user lama bisa login lagi dan ter-match ke row DB mereka.
5. Update env di Vercel (semua var Supabase §2) → redeploy.
6. Tambahkan redirect URL prod ke Google OAuth + Supabase Auth Redirect URLs.
7. Verifikasi: `/api/health` 200 → login test → cek trip lama muncul.

### 5.4 Kebocoran secret / rotasi kunci

1. Rotasi kunci di dashboard layanan terkait (Supabase service role, Gemini, Xendit, Resend, dll).
2. Update di Vercel Environment Variables (scope Production + Preview sesuai kebutuhan).
3. **Redeploy** — perubahan env tidak berlaku ke deployment yang sudah jalan.
4. Untuk `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL`: rotasi = password DB baru; update kedua connection string.

---

## 6. Monitoring & Deteksi Dini

- **Health endpoint:** [`GET /api/health`](../src/app/api/health/route.ts) → 200 (db ok) / 503 (db down). Body: `dbLatencyMs`, `commit`, `region`, `uptimeMs`.
- **TODO (belum di-wire):** daftarkan URL health ke uptime monitor eksternal (UptimeRobot / Better Uptime) dengan alert ke email/WhatsApp. Interval 1–5 menit. Ini deteksi dini utama untuk DB down.
- **Sentry:** error runtime → cek Sentry Issues saat insiden.
- **PostHog:** anomali funnel (mis. scan drop drastis) bisa jadi sinyal outage.

---

## 7. DR Drill (rehearsal — sekarang mungkin via Neon)

Backup tidak berguna kalau restore tidak pernah diuji. Staging **Neon** (`splitzy-staging`) adalah target rehearsal:

1. Ambil dump prod (§4.2).
2. `pg_restore` dump itu ke Neon staging (DB terpisah, tidak sentuh prod).
3. Arahkan `.env.staging` ke Neon → jalankan app lokal → verifikasi data ter-restore.
4. Catat waktu total → ini RTO nyata kamu. Sesuaikan §0.

> Lakukan drill minimal **sekali per kuartal** dan setiap kali skema berubah signifikan.

---

## 8. Checklist Insiden (ringkas)

Saat outage terdeteksi:

- [ ] Cek `/api/health` — DB up atau down?
- [ ] Cek Vercel deployment status + Sentry Issues.
- [ ] Cek Supabase dashboard — proyek up? Backup tersedia?
- [ ] Kalau perlu write freeze: `MAINTENANCE_MODE=true` → redeploy.
- [ ] Tentukan skenario (§5.1–5.4) → ikuti prosedurnya.
- [ ] Setelah pulih: `/api/health` 200 → login test → spot-check data.
- [ ] `MAINTENANCE_MODE=false` → redeploy.
- [ ] Post-mortem: catat penyebab, RPO/RTO aktual, perbaikan.

---

## 9. Gap yang Diketahui (follow-up)

| Gap | Prioritas | Aksi |
|-----|-----------|------|
| ~~Backup otomatis~~ | ✅ Selesai | `.github/workflows/backup.yml` — daily encrypted dump. **Set 2 secret repo.** |
| ~~Plan Supabase diverifikasi~~ | ✅ Selesai | Free tier dikonfirmasi; dimitigasi §4.2 |
| `/api/health` belum di-wire ke uptime monitor | 🟡 Sedang | Daftarkan ke UptimeRobot + alert |
| Belum pernah restore drill | 🟡 Sedang | Jalankan §7 via Neon |
| Tidak ada script rollback (DOWN) | 🟢 Rendah | Tulis saat operasi destruktif pertama |

---

Lihat juga: [ENVIRONMENT_ISOLATION.md](./ENVIRONMENT_ISOLATION.md) (rollout & flag), [API_VERSIONING.md](./API_VERSIONING.md).
