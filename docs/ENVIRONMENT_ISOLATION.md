# Environment Isolation & Safe-Rollout Runbook

> **Tujuan:** Menjalankan seluruh transformasi (lihat `PRODUCT_TRANSFORMATION_PLAN.md`) **tanpa pernah mengganggu Splitzy produksi** — baik sistem, UI, maupun database.
> **Strategi terpilih:** Feature Flags + Expand-Contract + Supabase staging terpisah.
> Versi 1.0 · 30 Juli 2026

---

## 0. Prinsip Inti (jangan dilanggar)

1. **`main` selalu deployable.** Setiap commit di `main` bisa langsung ke produksi tanpa merusak user.
2. **Fitur baru selalu di balik flag OFF.** User tidak melihat pekerjaan yang belum siap.
3. **Preview deploy TIDAK PERNAH menyentuh DB produksi.** Selalu ke staging.
4. **Migrasi DB hanya aditif (Expand) di produksi.** Perubahan destruktif hanya setelah Contract terverifikasi.
5. **Tidak ada long-lived branch.** Kerja pendek → merge ke `main` → deploy dark.

---

> [!IMPORTANT]
> **Keputusan interim (30 Jul 2026): staging DB DITUNDA ke Sprint 6.**
> Pembuatan Supabase staging terblokir (batas free tier tercapai, Docker belum tersedia). Untuk Sprint 1–5 kita bekerja **langsung di produksi dengan aman**, karena seluruh pekerjaan tahap ini bersifat **flag-gated + no-DB atau aditif-saja** — tidak ada operasi destruktif. Bagian §1 di bawah tetap menjadi acuan, tetapi **dieksekusi sebelum Sprint 6** (kerja normalisasi DB), bukan sekarang.
>
> **Dua garis merah selama fase prod-direct:**
> 1. **DB hanya operasi ADD** — tanpa `DROP`/`ALTER TYPE`/`RENAME`/backfill massal sampai ada DB rehearsal.
> 2. **Fitur baru selalu flag OFF saat merge** — flip ON hanya setelah uji mandiri.
>
> Isolasi Sprint 1–5 dijamin oleh **feature flag + migrasi aditif**, bukan DB terpisah. Sebelum Sprint 6, pasang **Docker Desktop → Supabase lokal** (gratis, tanpa batas project) untuk melatih migrasi destruktif.

## 1. Setup Staging (acuan untuk Sprint 6 — bukan prasyarat Sprint 1)

### 1.1 Buat Supabase project STAGING — *(Anda, di dashboard Supabase)*
1. Supabase Dashboard → **New Project** → nama `splitzy-staging`, region **ap-southeast-1** (sama dgn prod).
2. Simpan **Project URL**, **anon key**, **service role key**, dan **connection strings** (pooler `:6543` + direct `:5432`).
3. Aktifkan **Google OAuth** di Authentication → Providers (pakai OAuth client terpisah untuk staging, atau tambahkan redirect URL preview ke client yang ada).

### 1.2 Kloning skema prod → staging — *(saya bisa bantu perintahnya)*
Karena skema dikelola Prisma + beberapa SQL manual, cara paling bersih:
```bash
# Arahkan ke staging DB, lalu push skema Prisma:
DIRECT_URL="<staging-direct-url>" DATABASE_URL="<staging-pooler-url>" npx prisma db push
# Jalankan SQL manual yang belum masuk Prisma, via Supabase SQL editor staging:
#   prisma/sql/2026-07-add-activity-log.sql
#   prisma/sql/2026-07-add-trip-change-requests.sql
#   (dan SQL manual lain yang sudah ada di prod)
```
> Catatan: `prisma db push` aman untuk staging (boleh merusak). Untuk PROD kita tidak pakai `db push` — pakai migrasi aditif terkontrol (lihat §3).

### 1.3 (Opsional) Seed data sample — *(saya bisa buat skrip seed)*
Jangan pernah menyalin data user asli ke staging (privasi). Buat data sintetis: beberapa user dummy, trip, receipt.

### 1.4 Set Vercel Environment Variables — *(Anda, di dashboard Vercel)*
Vercel → Project → Settings → Environment Variables. **Kunci: scope per-environment.**

| Variabel | Production | Preview (staging) |
|---|---|---|
| `DATABASE_URL` | prod pooler | **staging pooler** |
| `DIRECT_URL` | prod direct | **staging direct** |
| `NEXT_PUBLIC_SUPABASE_URL` | prod | **staging** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | **staging** |
| `SUPABASE_SERVICE_ROLE_KEY` | prod | **staging** |
| `GEMINI_API_KEY` | prod key | key terpisah/kuota kecil |
| `NEXT_PUBLIC_FLAG_*` | semua `0` (OFF) | boleh `1` untuk uji |
| `FLAG_*` | semua `0` (OFF) | boleh `1` untuk uji |

> Setelah ini: setiap **preview deployment** (dari branch/PR) otomatis memakai **staging DB**. Produksi tetap di prod DB. **Inilah jaminan teknis "tidak mengganggu".**

### 1.5 Checklist Step 0
- [ ] Supabase `splitzy-staging` dibuat (region ap-southeast-1)
- [ ] Skema di-push ke staging + SQL manual dijalankan
- [ ] Google OAuth staging aktif (redirect URL preview terdaftar)
- [ ] Vercel env: Preview → staging, Production → prod (semua flag OFF di prod)
- [ ] Verifikasi: buka satu preview URL, pastikan login & data mengarah ke staging

---

## 2. Cara Kerja Feature Flag

Kode: `src/lib/flags.ts`. Default **OFF**. Dua jenis:
- **UI flag** `NEXT_PUBLIC_FLAG_*` → `isEnabled("dashboard")` (client & server).
- **Server flag** `FLAG_*` → `isServerEnabled("xenditCheckout")` (server saja).

### Pola pemakaian
```tsx
// UI: tampilkan versi baru hanya jika flag ON, else versi lama (tak berubah)
import { isEnabled } from "@/lib/flags";
export default function Landing() {
  if (isEnabled("newLanding")) return <NewLanding />;
  return <CurrentLanding />; // perilaku existing, tak tersentuh
}
```
```ts
// Server: matikan route sampai siap
import { isServerEnabled } from "@/lib/flags";
export async function POST(req: Request) {
  if (!isServerEnabled("xenditCheckout")) return new Response("Not found", { status: 404 });
  // ... logika Xendit (payment gateway pasar SEA: GoPay/OVO/DANA/VA/kartu)
}
```

### Siklus hidup flag
```
tulis kode di balik flag OFF → merge ke main → deploy prod (user lihat versi lama)
→ set flag ON di PREVIEW → uji end-to-end di staging
→ set flag ON di PROD utk diri sendiri (atau 5% user via PostHog nanti)
→ monitor (Sentry/analytics) → 100%
→ HAPUS flag + cabang kode lama (flag hygiene) setelah stabil ~2 minggu
```

> **Flip via env = perlu redeploy Vercel (~1 menit).** Untuk flip instan / rollout persentase, ganti isi `flags.ts` ke PostHog/Vercel Flags nanti — call site tidak berubah.

---

## 3. Expand-Contract untuk Perubahan Database

Jangan pernah mengubah/menghapus kolom di prod secara langsung. Tiga fase:

```
EXPAND    → hanya TAMBAH (kolom nullable, tabel baru). Skema lama tetap jalan.
            Aman di-deploy ke prod kapan saja.
MIGRATE   → kode dual-write (tulis ke lama & baru). Backfill data historis.
            Verifikasi rekonsiliasi (hitung & bandingkan).
CONTRACT  → setelah SEMUA baca dari baru & terverifikasi: baru hapus yang lama.
```

**Contoh — normalisasi `TripReceipt.payload` (T-23):**
1. **Expand:** buat tabel `TripReceiptItem` (tak mengganggu payload JSON).
2. **Migrate:** saat write receipt, tulis JSON **dan** row `TripReceiptItem`. Backfill payload lama → rows. Bandingkan jumlah/nilai.
3. **Contract:** alihkan read ke rows; setelah stabil, stop menulis JSON.

**Aturan migrasi prod:**
- Prod: **tidak** `prisma db push`. Gunakan migrasi aditif yang direview (idealnya `prisma migrate` setelah konsolidasi T-25).
- Setiap migrasi harus **reversible** atau punya rencana rollback.
- Uji setiap migrasi di **staging** dulu terhadap kloning skema.

---

## 4. Definition of Ready sebelum "swap" ke user

Sebuah fitur boleh di-flip ON di produksi bila:
- [ ] Lolos uji end-to-end di staging (preview + staging DB)
- [ ] Ada unit/integration test untuk logika inti
- [ ] Ada instrumentasi (Sentry error + analytics event)
- [ ] Rollback = flip flag OFF (terverifikasi bekerja)
- [ ] Tidak ada migrasi Contract yang belum selesai
- [ ] Review + sign-off PM

---

## 5. Alur Git (trunk-based)

```
main (selalu live, semua flag OFF di prod)
  └── feat/<task-id>-<slug>   (branch pendek, < 3 hari)
        → PR → CI hijau → review → merge ke main
        → auto deploy: prod (dark) + preview (staging, flag boleh ON)
```
- Branch pendek, sering merge. **Hindari** branch berumur panjang.
- `chore-transformation` (dokumen) tetap; implementasi pakai branch per-task.

---

## Ringkasan

Dengan Supabase staging + Vercel env scoping, **preview tidak pernah menyentuh DB prod**. Dengan feature flag default-OFF, **user tidak pernah melihat fitur belum siap**. Dengan Expand-Contract, **skema prod tidak pernah rusak**. Inilah cara membuat transformasi "perfect" tanpa mengganggu Splitzy existing — dan tanpa big-bang cutover.
