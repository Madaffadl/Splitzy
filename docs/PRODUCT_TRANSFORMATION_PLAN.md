# Splitzy — Product Transformation Plan & Execution Playbook

> **Dokumen Resmi Internal** · Versi 1.1 · 30 Juli 2026
> Status: **Draft untuk Review Tim** · Klasifikasi: Internal
> Pemilik Dokumen: Chief Product Officer · Kontributor: Product, Engineering, Design, Growth
> Sumber: Hasil Audit Produk Menyeluruh (lihat **Lampiran A**)

> [!NOTE]
> **Versi 1.1 — Rekonsiliasi dengan `main` (30 Juli 2026).** Dokumen ini telah disinkronkan ulang terhadap kondisi kode `main` terkini setelah beberapa update dirilis (change-request approval, activity log, travel outbox). Lihat **Bab 0 — Changelog & Rekonsiliasi** untuk delta lengkap. Ringkasan: fondasi rekayasa **menguat** (kolaborasi & offline-sync kelas produksi), namun **seluruh 10 item eksistensial/Critical dari audit v1.0 masih terbuka** — roadmap inti tidak berubah.

---

## Daftar Isi

0. [Changelog & Rekonsiliasi dengan Main](#0-changelog--rekonsiliasi-dengan-main)
1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Ringkasan Hasil Audit](#3-ringkasan-hasil-audit)
4. [Prioritas Pengerjaan](#4-prioritas-pengerjaan)
5. [Product Improvement Strategy](#5-product-improvement-strategy)
6. [Master Roadmap](#6-master-roadmap)
7. [Breakdown Task](#7-breakdown-task)
8. [UI/UX Improvement Plan](#8-uiux-improvement-plan)
9. [Frontend Improvement Plan](#9-frontend-improvement-plan)
10. [Backend Improvement Plan](#10-backend-improvement-plan)
11. [Database Improvement Plan](#11-database-improvement-plan)
12. [Infrastructure Strategy](#12-infrastructure-strategy)
13. [Testing Strategy](#13-testing-strategy)
14. [Risk Management](#14-risk-management)
15. [KPI & Success Metrics](#15-kpi--success-metrics)
16. [Timeline Implementasi](#16-timeline-implementasi)
17. [Definition of Done](#17-definition-of-done)
18. [Future Enhancement](#18-future-enhancement)
19. [Lampiran](#19-lampiran)

**Output Tambahan:** [Executive Dashboard](#executive-dashboard) · [Transformation Checklist](#product-transformation-checklist) · [Action Plan 30 Hari](#action-plan-30-hari) · [Action Plan 90 Hari](#action-plan-90-hari) · [Product Backlog](#product-backlog) · [Sprint Planning](#sprint-planning) · [RACI Matrix](#raci-matrix) · [Kesimpulan](#kesimpulan-akhir)

---

# 0. Changelog & Rekonsiliasi dengan Main

> Bagian ini merekonsiliasi Transformation Plan v1.0 (13 Juli 2026) dengan kondisi aktual branch `main` pada 30 Juli 2026, berdasarkan re-audit kode langsung. Tujuannya: memastikan dokumen mencerminkan realitas, bukan snapshot lama.

## 0.1 Ringkasan Perubahan Versi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 13 Jul 2026 | Dokumen awal berbasis audit produk menyeluruh. |
| **1.1** | **30 Jul 2026** | **Rekonsiliasi dengan `main`: dokumentasi 3 fitur baru, update ERD/DB (2 model baru), penyesuaian skor audit Backend/Architecture, klarifikasi celah Analytics, penyelarasan status task.** |

## 0.2 Fitur Baru di `main` (dibangun setelah audit v1.0)

> [!IMPORTANT]
> Ketiga fitur ini adalah **rekayasa kelas produksi** dan memperkuat skor Architecture & Backend. Namun tidak satu pun menutup 10 item Critical audit — keduanya adalah jalur kerja yang berbeda.

### 0.2.1 Change-Request Approval Workflow (PR-style collaboration) ✅ Selesai
- **Apa:** Member trip (non-owner) tidak menulis trip secara langsung. Perubahan mereka dibuffer sebagai batch `ChangeOp[]` terurut (maks 200 op) lalu diajukan sebagai satu `TripChangeRequest`. Owner me-review, lalu **approve/decline**.
- **Kualitas rekayasa:** Validasi ulang ops terhadap participant set **saat approve** (bukan saat submit); transaksi Prisma **array-form** (sengaja, karena pooler PgBouncer transaction-mode kadang melaporkan kegagalan palsu pada interactive transaction); klaim atomik (`updateMany where status:"pending"`) sehingga double-approve = no-op; peringatan staleness saat `baseVersion !== tripVersion`.
- **Model baru:** `TripChangeRequest`. Rute baru: `POST /change-requests`, `.../approve`, `.../decline`. Komponen: `ChangeRequests.tsx` (ReviewInbox).
- **Dampak pada dokumen:** Memperkuat **UX kolaborasi Travel** (sebelumnya audit menandai konflik 409 sebagai UX-hostile). Ini adalah mitigasi parsial yang baik; **Realtime (T-34) tetap relevan** untuk kesadaran live, tetapi prioritasnya turun karena workflow approval sudah menutup kasus korupsi konkuren.

### 0.2.2 Travel Outbox (offline-first optimistic sync) ✅ Selesai
- **Apa:** Antrian outbox lokal-durable untuk write receipt Travel. Receipt add/update/delete diterapkan ke mirror lokal seketika, dicatat sebagai `ReceiptOp` pending di localStorage (tahan reload), lalu di-drain ke server saat online. Coalescing op (add→update tetap "add"; add→delete yang belum sync saling meniadakan); replay idempoten via client-generated ID + upsert.
- **Dampak pada dokumen:** Ini adalah **aset fondasi** untuk **Unified State Layer (T-33)**. Rencana refactor state **wajib membangun di atas outbox ini, bukan menggantinya**. Nilai "offline mode" yang tadinya masuk v2.0 sebagian sudah tercapai untuk Travel receipts.

### 0.2.3 Activity Log (admin monitoring) ⚠️ Selesai — TAPI bukan Product Analytics
- **Apa:** Satu baris per aksi bermakna yang selesai, per user login. Model `ActivityEvent` + kolom `User.lastLoginAt`. Beacon `POST /api/activity` dengan allowlist tipe (`split.created`, `share.created`, `receipt.added`); login dicatat server-side. Konsumen: `GET /api/admin/activity` (feed & agregat distinct-user per hari).
- **Batasan kritis:** Event **dideduplikasi sekali-per-fitur-per-sesi-browser** via sessionStorage. Sepuluh receipt di Multiple = satu event "pakai Multiple hari ini". Ini bagus untuk pertanyaan operator ("siapa aktif hari ini"), tetapi **tidak dapat mengukur funnel, volume, konversi, atau retensi**.
- **Dampak pada dokumen:** **Celah Analytics (T-20) TETAP TERBUKA.** Activity log ≠ product analytics. Yang dibutuhkan roadmap adalah event funnel (signup→split→settle) tanpa dedup sesi, dengan properti event — biasanya PostHog. Namun `lastLoginAt` + infrastruktur beacon dapat **dipakai ulang** sebagai titik awal instrumentasi.

## 0.3 Status Item Critical/High Audit v1.0 (verifikasi ulang terhadap `main`)

| Item | Status di `main` (30 Jul) | Catatan |
|---|---|---|
| T-01 Distributed rate limit | ❌ **Masih terbuka** | Tetap in-memory `Map`, per-instance. Komentar kode: `TODO(Sprint 2): swap to shared-store`. **P0 belum ditutup.** |
| T-02 Security headers | ❌ **Masih terbuka** | `next.config.mjs` hanya set `turbopack.root` + `images.remotePatterns`. Tidak ada CSP/HSTS/X-Frame. |
| T-03 Hapus data pribadi footer | ❌ **Masih terbuka** | WA `+62 853-6536-0955`, IG pribadi, Gmail pribadi masih ada di footer. |
| T-04 Hapus email admin hardcoded | ❌ **Masih terbuka** | `admin-auth.ts` masih fallback ke `m.daffafadhil26@gmail.com`. |
| T-05–07 Stripe/pricing/paywall | ❌ **Masih terbuka** | Tidak ada payment processor. `plan`/`aiScanCount` = hook inert. |
| T-09 Dashboard pasca-login | ❌ **Masih terbuka** | Tidak ada route `dashboard`/`app`. Pasca-login tetap landing + `/history`. |
| T-14 RSC landing | ❌ **Masih terbuka** | `page.tsx` masih `"use client"` seluruhnya. |
| T-19 Sentry | ❌ **Masih terbuka** | Tidak ada error monitoring apa pun. |
| T-20 Analytics | ⚠️ **Parsial** | Activity log = monitoring admin, bukan funnel analytics. Lihat 0.2.3. |
| T-21 CI/CD | ❌ **Masih terbuka** | Tidak ada `.github/workflows`. |
| T-22 E2E | ❌ **Masih terbuka** | Hanya 9 unit test `lib/`; tidak ada Playwright; rute API baru (change-request, activity) tak teruji. |
| T-25 Konsolidasi migrasi | ❌ **Memburuk** | Bertambah 2 SQL manual baru (`2026-07-add-activity-log.sql`, `2026-07-add-trip-change-requests.sql`) dijalankan via Supabase SQL editor. Schema drift meluas. |
| T-39 Rename proxy.ts | ❌ **Masih terbuka** | Tetap `src/proxy.ts`, tidak ada `middleware.ts`. |

## 0.4 Revisi Skor Audit

| Dimensi | Skor v1.0 | Skor v1.1 | Alasan |
|---|---|---|---|
| Architecture | 5/10 | **6/10** | Outbox offline-first & change-op transaction design menaikkan kualitas arsitektur inti. |
| Backend | 6/10 | **6/10** | Change-request routes solid, tapi celah operasional (cache/queue/monitoring) belum berubah. |
| Engineering | 6/10 | **6/10** | Kualitas naik, tapi utang uji (rute baru tak teruji) menyeimbangkan. |
| Analytics | (High gap) | (Tetap gap) | Activity log tidak memenuhi kebutuhan funnel analytics. |
| **Overall** | **41/100** | **43/100** | Kenaikan tipis dari kualitas rekayasa fitur baru; item eksistensial belum tersentuh. |

## 0.5 Implikasi terhadap Roadmap

1. **Sprint 1 tidak berubah** — item Critical (rate limit, headers, footer, admin email) semuanya masih terbuka dan tetap prioritas #1.
2. **T-34 (Realtime) prioritas turun** dari 🟡 Medium menjadi 🟢 Low — change-request workflow sudah menutup kasus korupsi konkuren; realtime kini murni peningkatan UX, bukan koreksi.
3. **T-33 (Unified State Layer) harus membangun di atas travel-outbox** — bukan menggantinya. Tambahkan sebagai constraint desain.
4. **T-20 (Analytics) diperjelas** — bukan "belum ada instrumentasi" melainkan "instrumentasi ada untuk monitoring, perlu dilengkapi lapisan funnel analytics". Manfaatkan beacon & `lastLoginAt` yang sudah ada.
5. **T-23 (Normalisasi DB) bertambah cakupan** — kini juga harus mempertimbangkan `TripChangeRequest.ops` (JSON) dan `ActivityEvent`. `ops` sebagai JSON **dapat diterima** (ia adalah log perubahan immutable, bukan data query-kritis) — kecualikan dari normalisasi.
6. **T-25 (Konsolidasi migrasi) naik urgensi** — sekarang ada 4+ SQL manual di luar Prisma Migrate; drift semakin nyata.

### Ringkasan Bab 0

`main` bertambah tiga fitur berkualitas tinggi (change-request approval, travel outbox, activity monitoring) yang menaikkan skor Architecture ke 6/10 dan Overall ke 43/100. Namun **kesepuluh item eksistensial/Critical audit tetap terbuka** — Sprint 1 dan spine roadmap tidak berubah. Penyesuaian utama: Realtime turun prioritas, Unified State Layer harus menghormati outbox, dan celah Analytics diklarifikasi sebagai "monitoring ada, funnel analytics belum".

---

# 1. Executive Summary

## 1.1 Ringkasan Kondisi Aplikasi Saat Ini

Splitzy adalah aplikasi pembagi tagihan (bill splitter) berbasis web yang telah live di produksi (`www.splitzy.my.id`). Aplikasi memiliki tiga mode utama — **Single Receipt**, **Multiple Receipts**, dan **Travel Spend** — didukung oleh pemindaian struk berbasis AI (Google Gemini), settlement multi-mata uang, dan model freemium yang baru pada tahap awal (kolom `plan` sudah ada di database, namun belum ada mekanisme pembayaran).

Fondasi teknis tergolong **kuat**: Next.js 16 (App Router), React 19, TypeScript 5.9, Supabase (Auth + Postgres), Prisma ORM, dan Vitest untuk unit testing. Kualitas lapisan `lib/` (fungsi murni yang teruji) berada di atas rata-rata untuk proyek indie. **Update v1.1:** `main` kini juga memuat change-request approval workflow (kolaborasi PR-style), travel outbox (offline-sync), dan activity monitoring — memperkuat sisi rekayasa (lihat **Bab 0**).

Namun demikian, terdapat kesenjangan struktural kritis yang menghalangi Splitzy menjadi produk SaaS komersial yang sesungguhnya — dan **seluruh 10 item eksistensial masih terbuka** per 30 Juli 2026.

**Skor Audit Keseluruhan: 43/100** (v1.0: 41/100; +2 dari fitur rekayasa baru — lihat Bab 0.4).

| Dimensi | Skor | Dimensi | Skor |
|---|---|---|---|
| UX | 4/10 | Security | 5/10 |
| UI | 6/10 | SaaS Readiness | 2/10 |
| Engineering | 6/10 | Conversion | 2/10 |
| Architecture | 6/10 ↑ | Premium Feeling | 5/10 |
| Scalability | 4/10 | Investor Readiness | 2/10 |

## 1.2 Permasalahan Utama

> [!WARNING]
> **Lima masalah eksistensial** yang harus diselesaikan sebelum Splitzy dapat disebut sebagai produk SaaS:

1. **Tidak ada infrastruktur monetisasi.** Tidak ada halaman pricing, integrasi Stripe, checkout, atau paywall. Produk tidak dapat menghasilkan satu rupiah pun. Pro saat ini diberikan manual oleh admin.
2. **Rate limiter non-fungsional di produksi.** Rate limiter berbasis in-memory tidak bekerja pada arsitektur serverless (setiap invocation berpotensi instance berbeda). Endpoint `/api/parse-receipt` dapat disalahgunakan untuk membengkakkan biaya Gemini API tanpa throttling efektif. **Ini adalah P0 security & cost risk.**
3. **Tidak ada dashboard pasca-login.** Setelah sign-in, pengguna melihat landing page yang sama dengan tamu. Tidak ada alasan bagi pengguna untuk kembali.
4. **Arsitektur pemilihan mode salah secara UX.** Pengguna baru dipaksa memilih antara tiga mode produk sebelum memahami produk (pelanggaran Hick's Law).
5. **Fitur pembeda utama (AI scanning) disembunyikan.** Kemampuan paling kompetitif Splitzy dikubur sebagai bullet point di bagian "How It Works".

**Masalah kepercayaan sekunder namun serius:** footer menampilkan "Splitzy by Madaffadl", nomor WhatsApp pribadi, dan akun Instagram pribadi — merusak persepsi kepercayaan untuk produk yang menyimpan riwayat finansial.

## 1.3 Opportunity Terbesar

- **AI-native bill splitting.** Tidak ada kompetitor utama (Splitwise, Tricount, Settle Up) yang menawarkan pemindaian struk AI berkualitas tinggi di web tool gratis. Ini adalah wedge kompetitif Splitzy.
- **Pasar Asia Tenggara & Indonesia.** Distribusi via WhatsApp/Telegram dan integrasi pembayaran lokal (GoPay/OVO/Dana) adalah jalur pertumbuhan yang belum digarap pemain global.
- **Travel Spend mode** yang sudah canggih (multi-currency, invite, settle-up) dapat menjadi produk unggulan berlangganan.

## 1.4 Target Akhir Produk

Menjadikan Splitzy sebagai **pembagi tagihan AI-native nomor satu di Asia Tenggara** — produk yang dicintai, memorable, cepat, tepercaya, dan menghasilkan pendapatan berlangganan berkelanjutan.

## 1.5 Tujuan Redesign

| Tujuan | Metrik Keberhasilan |
|---|---|
| UI premium dan konsisten | Design token tunggal, 0 warna hardcoded |
| First impression < 5 detik | Value proposition dipahami tanpa scroll |
| Peak moment settlement yang delightful | Momen "beres" dirancang eksplisit |
| Aksesibilitas WCAG 2.2 AA | Lolos audit kontras & keyboard nav |

## 1.6 Tujuan Refactor

| Tujuan | Metrik Keberhasilan |
|---|---|
| Model data terpadu | Hapus dual-model (JSON blob vs relational) |
| State management terpadu | Satu lapisan persistence |
| Observability penuh | Sentry + analytics + logging aktif |
| CI/CD & testing matang | Pipeline otomatis + E2E untuk flow kritis |

## 1.7 Tujuan Bisnis

- Mengaktifkan pendapatan: **Stripe live dengan tier Plus (Rp59rb/bln) & Pro (Rp149rb/bln)** dalam 90 hari.
- Mencapai **1.000 active users** dengan retensi terukur dalam 6 bulan.
- Mencapai **investor-ready** (metrik, funnel, growth engine) dalam 6 bulan.

## 1.8 Target Experience Pengguna

> "Arahkan kamera. Bagi dalam 10 detik." — pengguna memotret struk, memilih siapa memesan apa, dan langsung melihat siapa membayar siapa dengan transaksi minimal, lalu membagikannya ke grup WhatsApp dengan satu ketukan.

### Ringkasan Bab 1

Splitzy memiliki fondasi teknis kuat dan konsep produk yang valid, tetapi tidak memiliki infrastruktur bisnis, memiliki celah keamanan P0, dan salah dalam arsitektur UX inti. Transformasi ini menargetkan monetisasi, keamanan, dashboard, dan repositioning AI sebagai prioritas eksistensial.

---

# 2. Product Vision

## 2.1 Visi

> Menjadi sistem operasi keuangan untuk kelompok — cara termudah dan teradil bagi teman, keluarga, dan tim untuk berbagi pengeluaran, dimulai dari sekali potret struk.

## 2.2 Misi

Menghilangkan gesekan sosial dan kognitif dalam berbagi uang, menggunakan AI untuk mengubah tugas yang menjengkelkan (menghitung siapa berutang berapa) menjadi tindakan sepuluh detik yang menyenangkan.

## 2.3 Core Value

1. **Fairness by default** — pembagian selalu adil dan transparan.
2. **Effortless** — friksi mendekati nol; AI mengerjakan pekerjaan berat.
3. **Trustworthy** — data finansial diperlakukan dengan standar keamanan tinggi.
4. **Delightful** — setiap interaksi terasa premium dan menyenangkan.
5. **Social** — dibangun untuk kelompok, bukan individu terisolasi.

## 2.4 Product Principles

| Prinsip | Penjelasan |
|---|---|
| **One action, zero friction** | Setiap flow inti dapat diselesaikan dalam satu alur tanpa keputusan arsitektural. |
| **AI does the typing** | Pengguna tidak mengetik jika kamera bisa membacanya. |
| **The end is the peak** | Momen settlement adalah puncak pengalaman dan harus dirancang paling indah. |
| **Design tokens, no exceptions** | Tidak ada warna/spacing/animasi yang di-hardcode. |
| **Ship measured** | Tidak ada fitur tanpa instrumentasi analitik. |
| **Web-first, mobile-perfect** | Tanpa perlu instalasi, tetapi sempurna di layar sentuh. |

## 2.5 Success Metrics (North Star & Supporting)

- **North Star:** Jumlah *split yang berhasil diselesaikan (settled)* per minggu.
- **Activation:** % pengguna baru yang menyelesaikan split pertama < 3 menit.
- **Retention:** D7 / D30 retention untuk pengguna terautentikasi.
- **Monetization:** MRR, konversi free→paid, ARPU.
- **Virality:** K-factor via fitur share & invite.

## 2.6 Target User

| Segmen | Kebutuhan |
|---|---|
| **Mahasiswa & anak muda** | Bagi tagihan makan cepat, murah, tanpa ribet. |
| **Group traveler** | Lacak pengeluaran perjalanan multi-mata uang, settle di akhir. |
| **Rekan kerja / tim** | Makan siang tim, patungan, laporan pengeluaran bersama. |
| **Keluarga & pasangan** | Pengeluaran rumah tangga & langganan bersama. |

## 2.7 Persona

**Persona 1 — "Dinda, 23, Mahasiswa"**
Sering makan bersama 5–8 teman. Benci jadi orang yang menalangi dan lupa ditagih. Ingin hasil cepat, langsung share ke grup WhatsApp. Sensitif harga (mau versi gratis, tapi mau bayar jika sangat berguna).

**Persona 2 — "Raka, 29, Group Traveler"**
Mengatur trip 6 orang ke Bali/Jepang. Mengelola banyak pengeluaran lintas mata uang selama seminggu. Butuh ringkasan akhir yang rapi dan settlement minimal. Kandidat kuat untuk tier berbayar.

**Persona 3 — "Sarah, 34, Team Lead"**
Mengatur makan tim dan reimbursement. Butuh export (PDF/CSV) dan riwayat. Kandidat tier Team/B2B.

## 2.8 Expected User Experience

Cepat, jelas, dan menyenangkan. Landing menyampaikan nilai dalam 5 detik. Satu CTA utama. AI membaca struk. Momen settlement dirayakan. Berbagi hasil sekali ketuk. Kembali karena dashboard menunjukkan saldo lintas grup.

## 2.9 Brand Experience

Identitas visual **Olive Green + Gold** yang distinctive (bukan biru/hijau generik kompetitor), dieksekusi dengan disiplin design system. Nada suara: hangat, cerdas, sedikit jenaka ("Don't be the unpaid friend"), namun tepercaya secara finansial.

### Ringkasan Bab 2

Visi Splitzy adalah menjadi OS keuangan kelompok yang AI-native, adil, mudah, dan menyenangkan, dengan North Star berupa jumlah split yang diselesaikan per minggu, menargetkan mahasiswa, traveler, dan tim di Asia Tenggara.

---

# 3. Ringkasan Hasil Audit

> Setiap kategori memuat: **Masalah · Penyebab · Dampak · Rekomendasi · Prioritas**. Kode prioritas: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low.

## 3.1 UI

| Aspek | Detail |
|---|---|
| **Masalah** | Empat sistem warna berjalan bersamaan: token CSS var (`--primary`, `--accent`), Tailwind hardcoded (`emerald-500`, `indigo-500`), dan penanganan dark mode manual per-komponen. Hover state kartu berbeda-beda per warna. Footer merusak kepercayaan. Border tombol sekunder tak terlihat saat rest. |
| **Penyebab** | Komponen dibangun inkremental tanpa design system yang ditegakkan; warna disalin dari template. |
| **Dampak** | Tidak konsisten, tidak dapat di-rebrand tanpa grep-replace, dark mode berpotensi rusak untuk warna hardcoded. |
| **Rekomendasi** | Migrasi seluruh warna ke token semantik (`--color-success`, `--color-info`). Standarkan hover state kartu. Rombak footer menjadi footer korporat. |
| **Prioritas** | 🟠 High |

## 3.2 UX

| Aspek | Detail |
|---|---|
| **Masalah** | Tidak ada dashboard pasca-login. Pemilihan 3 mode di landing memaksa keputusan arsitektural. Tidak ada onboarding. Guest limit hanya client-side (bisa di-bypass). Penamaan mode membingungkan. |
| **Penyebab** | Produk tumbuh sebagai kumpulan tool, bukan satu produk terpadu. |
| **Dampak** | Cognitive load tinggi, tidak ada trigger retensi, aktivasi lemah. |
| **Rekomendasi** | Bangun dashboard. Ganti 3 kartu dengan satu CTA utama. Bangun onboarding wizard. Rename: Quick Split / Group Bills / Trip Tracker. |
| **Prioritas** | 🔴 Critical |

## 3.3 Database

| Aspek | Detail |
|---|---|
| **Masalah** | Dual data model (relational `Receipt/ReceiptItem` vs JSON blob `TripReceipt.payload`). Migrasi SQL manual di luar Prisma Migrate. Index hilang. `participantsJson` sebagai blob tanpa integritas referensial. |
| **Penyebab** | JSON blob dipilih demi kecepatan pengembangan Travel mode. |
| **Dampak** | Tidak queryable, risiko schema drift, potensi full table scan di skala besar. |
| **Rekomendasi** | Normalisasi `TripReceipt`. Satukan riwayat migrasi ke Prisma. Tambah index. Tabel `Participant`, `Notification`, `Subscription`. |
| **Prioritas** | 🟠 High |

## 3.4 Performance

| Aspek | Detail |
|---|---|
| **Masalah** | Landing page seluruhnya `"use client"` → LCP terblokir JS, SEO nol, preview sosial kosong. Bundle menyertakan Supabase & AI SDK di landing. Parallax jalan di main thread. Tidak ada caching FX rate. |
| **Penyebab** | `useAuth` + scroll tracking memaksa client component; tidak ada code splitting island. |
| **Dampak** | LCP ~2.5–4s (mobile), peringkat Google buruk, biaya render tinggi. |
| **Rekomendasi** | Ubah landing ke Server Component + client islands. Prefetch CTA. Cache FX rate. Bundle analyzer. |
| **Prioritas** | 🟠 High |

## 3.5 Security

| Aspek | Detail |
|---|---|
| **Masalah** | Rate limiter in-memory non-fungsional (P0). Email bootstrap admin hardcoded di source. Tidak ada CSP/security headers. Nomor WhatsApp pribadi publik. Guest limit client-side. |
| **Penyebab** | Rate limiter belum dipindah ke store terdistribusi; header belum dikonfigurasi. |
| **Dampak** | Abuse endpoint AI → biaya Gemini membengkak; XSS tanpa backstop; risiko social engineering. |
| **Rekomendasi** | Upstash Redis rate limit. Security headers di `next.config.mjs`. Hapus email dari source. Hapus data pribadi footer. |
| **Prioritas** | 🔴 Critical (rate limit) |

## 3.6 Architecture

| Aspek | Detail |
|---|---|
| **Masalah** | Dua model data untuk domain yang sama. Tiga strategi storage berbeda. Middleware bernama `proxy.ts` (non-standar). Tidak ada API versioning. **Positif (v1.1):** travel outbox offline-first & change-op transaction design menaikkan kualitas arsitektur inti (skor 5→6). |
| **Penyebab** | Evolusi organik tanpa refactor konsolidasi. |
| **Dampak** | Sulit dipelihara, membingungkan kontributor, risiko breaking change klien. |
| **Rekomendasi** | Satukan state layer **di atas outbox** (jangan ganti). Rename ke `middleware.ts`. Terapkan `/api/v1/`. |
| **Prioritas** | 🟠 High |

## 3.7 Frontend

| Aspek | Detail |
|---|---|
| **Masalah** | Komponen flat tanpa hierarki Atomic Design. State ad-hoc (localStorage/cloud terpisah). Tidak ada error boundary per-route. Tidak ada lazy loading Travel. |
| **Penyebab** | Pertumbuhan cepat tanpa arsitektur komponen. |
| **Dampak** | Skala pemeliharaan buruk saat komponen >50. |
| **Rekomendasi** | Struktur atoms/molecules/organisms. Unified state hook. Error boundary. `React.lazy` untuk Travel. |
| **Prioritas** | 🟡 Medium |

## 3.8 Backend

| Aspek | Detail |
|---|---|
| **Masalah** | Tidak ada caching, queue, realtime, monitoring. AI scan sinkron di request thread. Tidak ada background job (quota reset, cleanup). **Catatan positif:** change-request routes menerapkan transaksi array-form PgBouncer-safe & klaim atomik (kualitas tinggi). |
| **Penyebab** | Fokus pada fitur, belum pada operasional. |
| **Dampak** | UI terblokir saat Gemini lambat; tidak ada visibilitas produksi. |
| **Rekomendasi** | Redis cache, Inngest/Vercel Cron, Supabase Realtime, Sentry. |
| **Prioritas** | 🟠 High |

## 3.9 Business

| Aspek | Detail |
|---|---|
| **Masalah** | Tidak ada payment, subscription management, invoice, dunning, referral. Pro diberi manual. |
| **Penyebab** | Monetisasi belum dibangun. |
| **Dampak** | Tidak ada jalur pendapatan — eksistensial. |
| **Rekomendasi** | Stripe (Checkout + Portal + Webhook), pricing page, paywall pada kuota AI. |
| **Prioritas** | 🔴 Critical |

## 3.10 Accessibility

| Aspek | Detail |
|---|---|
| **Masalah** | Parallax JS tidak menghormati `prefers-reduced-motion` (di-bypass karena inline style). Kontras `muted-foreground` berpotensi < AA. Tidak ada skip-to-content. Orb dekoratif tanpa `aria-hidden`. |
| **Penyebab** | Animasi diterapkan via JS inline, melewati CSS media query. |
| **Dampak** | Risiko vestibular, kegagalan WCAG AA. |
| **Rekomendasi** | Guard reduced-motion di JS. Audit kontras. Tambah skip link & aria-hidden. |
| **Prioritas** | 🟡 Medium |

## 3.11 SEO

| Aspek | Detail |
|---|---|
| **Masalah** | Landing client-only → crawler melihat shell kosong. Tidak ada OG image dinamis, sitemap, robots, JSON-LD. |
| **Penyebab** | Rendering strategy salah. |
| **Dampak** | Akuisisi organik nol. |
| **Rekomendasi** | RSC landing, OG image, sitemap.xml, robots.txt, structured data. |
| **Prioritas** | 🟠 High |

## 3.12 Scalability

| Aspek | Detail |
|---|---|
| **Masalah** | Rate limit in-memory, tanpa Redis, JSON blob di DB, tanpa realtime, tanpa read replica strategy. |
| **Penyebab** | Arsitektur single-instance implisit. |
| **Dampak** | Tidak siap lonjakan trafik & concurrency. |
| **Rekomendasi** | Redis, normalisasi DB, realtime channel, rencana read replica. |
| **Prioritas** | 🟠 High |

## 3.13 Testing

| Aspek | Detail |
|---|---|
| **Masalah** | Hanya unit test `lib/`. Tidak ada integration/E2E/API route test. |
| **Penyebab** | E2E belum diprioritaskan. |
| **Dampak** | Nol kepercayaan pada flow user-facing saat deploy. |
| **Rekomendasi** | Playwright E2E untuk sign-in→split→settle; API route test; regression suite. |
| **Prioritas** | 🟠 High |

## 3.14 Infrastructure

| Aspek | Detail |
|---|---|
| **Masalah** | Tidak ada CI/CD, monitoring, alerting, disaster recovery terdokumentasi. Secrets hanya `.env`. |
| **Penyebab** | Deploy manual/otomatis Vercel tanpa pipeline formal. |
| **Dampak** | Setiap deploy berisiko; tidak ada safety net. |
| **Rekomendasi** | GitHub Actions, Sentry, uptime monitor, DR runbook. |
| **Prioritas** | 🟠 High |

## 3.15 Deployment

| Aspek | Detail |
|---|---|
| **Masalah** | Tidak ada pipeline lint→test→build→preview→prod. Migrasi SQL manual. |
| **Penyebab** | Belum ada proses rilis formal. |
| **Dampak** | Risiko regresi & schema drift. |
| **Rekomendasi** | Pipeline otomatis + Prisma Migrate sebagai satu-satunya sumber migrasi. |
| **Prioritas** | 🟠 High |

## 3.16 Analytics

| Aspek | Detail |
|---|---|
| **Masalah** | Ada **activity monitoring admin** (`ActivityEvent`, `lastLoginAt`) — tetapi dideduplikasi per-sesi sehingga **tidak bisa mengukur funnel/volume/konversi/retensi**. Tidak ada product analytics sejati. |
| **Penyebab** | Instrumentasi dibangun untuk pertanyaan operator, bukan analitik produk. |
| **Dampak** | Keputusan produk & funnel tanpa data; tidak investor-ready. |
| **Rekomendasi** | Tambahkan PostHog/Vercel Analytics dengan event funnel (tanpa dedup sesi); **manfaatkan ulang** beacon & `lastLoginAt` yang sudah ada sebagai titik awal. |
| **Prioritas** | 🟠 High (celah tetap terbuka meski monitoring ada) |

## 3.17 Growth

| Aspek | Detail |
|---|---|
| **Masalah** | Tidak ada referral, email marketing, share mechanic, push notification, habit loop. |
| **Penyebab** | Growth engine belum ada. |
| **Dampak** | Tidak ada viralitas/retensi terstruktur. |
| **Rekomendasi** | Share-to-WhatsApp, referral, email drip, notifikasi settlement. |
| **Prioritas** | 🟠 High |

## 3.18 Conversion

| Aspek | Detail |
|---|---|
| **Masalah** | Tidak ada pricing page, CTA upgrade, social proof, testimonial, FAQ, email capture. |
| **Penyebab** | Funnel konversi belum dirancang. |
| **Dampak** | Skor konversi 2/10. |
| **Rekomendasi** | Pricing page, upgrade prompt kontekstual, social proof counter, FAQ. |
| **Prioritas** | 🔴 Critical |

## 3.19 Monetization

| Aspek | Detail |
|---|---|
| **Masalah** | Model bisnis = tool gratis dengan Pro manual. Kuota AI (15/bln) adalah gate valid tapi tak berujung. |
| **Penyebab** | Payment belum diintegrasikan. |
| **Dampak** | Nol pendapatan. |
| **Rekomendasi** | Tier Free/Plus/Pro/Team; annual discount; Stripe + pembayaran lokal (fase lanjut). |
| **Prioritas** | 🔴 Critical |

### Ringkasan Bab 3

Masalah paling mendesak terkonsentrasi pada **Monetization, Conversion, UX (dashboard), dan Security (rate limit)** — seluruhnya Critical. Kategori lain (Performance, SEO, Database, Backend, Infra, Testing, Analytics, Growth) berada pada High dan menjadi tulang punggung fase menengah.

---

# 4. Prioritas Pengerjaan

## 🔴 Critical — kerjakan lebih dulu

| Item | Alasan Prioritas |
|---|---|
| Distributed rate limiting (Upstash) | Melindungi dari abuse & biaya Gemini tak terbatas; P0 keamanan. |
| Integrasi Stripe + pricing page | Tanpa ini tidak ada pendapatan — eksistensial. |
| Reposisi AI scanning sebagai hero | Pembeda kompetitif utama, saat ini tersembunyi. |
| Dashboard pasca-login | Mesin retensi; alasan pengguna kembali. |
| Onboarding flow | Menentukan activation rate. |
| Security headers + hapus data pribadi/email hardcoded | Kepercayaan & permukaan serangan. |

## 🟠 High

| Item | Alasan |
|---|---|
| Landing RSC (fix LCP & SEO) | Akuisisi organik & Core Web Vitals. |
| Design token konsolidasi | Fondasi konsistensi visual & rebrand. |
| Sentry + Analytics | Observability & keputusan berbasis data. |
| CI/CD pipeline | Keamanan rilis. |
| Normalisasi model data | Mencegah krisis migrasi. |
| Playwright E2E flow kritis | Kepercayaan deploy. |
| Share-to-WhatsApp | Distribusi utama pasar SEA. |
| Email transaksional (Resend) | Komunikasi & retensi. |

## 🟡 Medium

| Item | Alasan |
|---|---|
| Atomic Design refactor | Skala pemeliharaan. |
| Aksesibilitas (reduced-motion, kontras, skip link) | Kepatuhan WCAG. |
| Redis caching (FX, session) | Performa & biaya. |
| Rename mode & IA nav | Kejelasan produk. |

## 🟢 Low

| Item | Alasan |
|---|---|
| Realtime collaboration Travel ↓ | **Diturunkan dari Medium (v1.1)** — change-request approval sudah tutup korupsi konkuren; realtime kini murni peningkatan UX. |
| Reduksi animasi CSS (25→10) | Kebersihan kode. |
| Storybook | Dokumentasi komponen. |
| Rename `proxy.ts`→`middleware.ts` | Kejelasan kontributor. |

## ✨ Nice To Have

| Item | Alasan |
|---|---|
| Voice input, live camera OCR | Diferensiasi lanjut. |
| Splitzy Card / blockchain notarization | Moonshot. |
| Slack/Team integration | Ekspansi B2B. |

### Ringkasan Bab 4

Urutan eksekusi: **selamatkan (security) → hasilkan pendapatan (monetization) → tahan pengguna (dashboard/onboarding) → tumbuhkan (growth) → skalakan (arsitektur/infra)**.

---

# 5. Product Improvement Strategy

## 5.1 Strategi Transformasi Keseluruhan

Transformasi dibagi menjadi tiga gelombang yang tumpang tindih:

```
Gelombang 1 (Minggu 1–4): STABILIZE & MONETIZE
  → Rate limit, security headers, Stripe, pricing, hero AI, quick wins

Gelombang 2 (Minggu 3–10): RETAIN & POLISH
  → Dashboard, onboarding, design system, RSC landing, observability, E2E

Gelombang 3 (Minggu 8–20): GROW & SCALE
  → Growth features, realtime, data model unify, AI features, infra scaling
```

## 5.2 Mengapa Urutan Ini Dipilih

1. **Keamanan lebih dulu** karena rate limit yang bocor dapat menimbulkan kerugian finansial nyata (biaya Gemini) kapan saja.
2. **Monetisasi kedua** karena tanpa pendapatan tidak ada kelangsungan bisnis, dan infrastruktur pembayaran adalah prasyarat untuk semua eksperimen pricing.
3. **Retensi ketiga** karena mengakuisisi pengguna tanpa dashboard/onboarding hanya mengisi ember bocor.
4. **Growth & scale terakhir** karena hanya bermakna setelah produk menahan dan memonetisasi pengguna.

## 5.3 Trade-off

| Keputusan | Trade-off |
|---|---|
| Monetisasi sebelum refactor arsitektur besar | Utang teknis (dual model) tetap ada sementara, tetapi pendapatan tervalidasi lebih dulu. |
| RSC landing sebelum redesign visual penuh | Perbaikan SEO/LCP cepat, tetapi sebagian animasi disederhanakan lebih awal. |
| Stripe global dulu, pembayaran lokal kemudian | Time-to-market cepat; pasar lokal Indonesia dioptimalkan di fase growth. |
| Normalisasi DB ditunda ke Gelombang 3 | Menghindari blocking monetisasi; risiko dikelola dengan write-compatibility layer. |

## 5.4 Risiko

- **Migrasi data model** dapat merusak trip pengguna eksisting → mitigasi dengan dual-write & backfill bertahap.
- **Perubahan landing** dapat menurunkan konversi sementara → mitigasi A/B test.
- **Kapasitas tim** terbatas (indie) → mitigasi dengan fase ketat & fokus Critical dulu.

## 5.5 Expected Outcome

- Akhir Gelombang 1: produk aman, dapat menghasilkan pendapatan, hero mengomunikasikan AI.
- Akhir Gelombang 2: retensi meningkat, produk terasa premium, observability penuh.
- Akhir Gelombang 3: growth engine berjalan, arsitektur siap skala 1M pengguna.

### Ringkasan Bab 5

Strategi tiga gelombang memprioritaskan keamanan dan pendapatan sebelum polish dan skala, dengan trade-off yang secara sadar menunda refactor besar demi validasi bisnis lebih awal.

---

# 6. Master Roadmap

> Setiap fase: **Objective · Deliverables · Task · Dependencies · Risiko · Definition of Done · Estimasi Durasi**.

## Phase 0 — Preparation (Minggu 0)
- **Objective:** Menyiapkan fondasi kerja tim.
- **Deliverables:** Repo hygiene, environment matrix, project board, definisi event analytics.
- **Task:** Setup GitHub Projects; dokumentasikan env; buat branch strategy; audit dependency.
- **Dependencies:** —
- **Risiko:** Scope creep sejak awal.
- **DoD:** Board terisi backlog, env terdokumentasi, konvensi disepakati.
- **Durasi:** 3 hari.

## Phase 1 — Design Foundation (Minggu 1–2)
- **Objective:** Menetapkan bahasa visual & prinsip.
- **Deliverables:** Design principles doc, moodboard, audit token warna.
- **Task:** Inventaris warna hardcoded; definisi token semantik; skala tipografi & spacing 8pt.
- **Dependencies:** Phase 0.
- **Risiko:** Perdebatan estetika memperlambat.
- **DoD:** Token disetujui; skala terdokumentasi.
- **Durasi:** 1,5 minggu.

## Phase 2 — Design System (Minggu 2–4)
- **Objective:** Sistem komponen terpadu.
- **Deliverables:** Token CSS var lengkap, komponen inti (Button, Card, Input, Modal, Typography), animation token.
- **Task:** Ganti `emerald-500`/`indigo-500` → token; buat komponen Typography; duration/easing token; (opsional) Storybook.
- **Dependencies:** Phase 1.
- **Risiko:** Regresi visual pada halaman eksisting.
- **DoD:** 0 warna hardcoded; komponen dipakai di ≥3 halaman.
- **Durasi:** 2 minggu.

## Phase 3 — UI Redesign (Minggu 3–6)
- **Objective:** Tampilan premium & konsisten.
- **Deliverables:** Landing baru (hero AI), footer korporat, empty/loading/error states.
- **Task:** Hero "Point. Snap. Split."; satu CTA; footer legal; skeleton loaders; peak-moment settlement.
- **Dependencies:** Phase 2.
- **Risiko:** Penurunan konversi sementara.
- **DoD:** Landing lolos review desain; states lengkap.
- **Durasi:** 3 minggu.

## Phase 4 — UX Improvement (Minggu 4–8)
- **Objective:** Alur terpadu & retensi.
- **Deliverables:** Dashboard, onboarding wizard, IA nav baru, rename mode.
- **Task:** Bangun dashboard saldo/aktivitas; onboarding 3-langkah; navigasi baru; server-side guest limit.
- **Dependencies:** Phase 3.
- **Risiko:** Perubahan navigasi membingungkan pengguna lama.
- **DoD:** Activation flow terukur; dashboard live.
- **Durasi:** 4 minggu.

## Phase 5 — Frontend Refactor (Minggu 5–9)
- **Objective:** Arsitektur frontend skalabel.
- **Deliverables:** Struktur Atomic, unified state layer, error boundaries, code splitting.
- **Task:** Reorganisasi komponen; hook state terpadu; `React.lazy` Travel; RSC landing.
- **Dependencies:** Phase 2.
- **Risiko:** Refactor luas → regresi.
- **DoD:** Bundle landing turun; error boundary di semua route.
- **Durasi:** 4 minggu.

## Phase 6 — Backend Refactor (Minggu 6–11)
- **Objective:** Backend andal & teramati.
- **Deliverables:** API versioning, Redis cache, background jobs, Sentry, logging.
- **Task:** `/api/v1/`; Upstash cache FX/session; Inngest cron quota/cleanup; structured logs.
- **Dependencies:** Phase 0, Infra.
- **Risiko:** Breaking change klien.
- **DoD:** Semua route versioned; cache aktif; error tertangkap Sentry.
- **Durasi:** 5 minggu.

## Phase 7 — Database Improvement (Minggu 9–12)
- **Objective:** Model data terpadu & performan.
- **Deliverables:** Normalisasi `TripReceipt`, tabel baru, index, migrasi Prisma.
- **Task:** Dual-write layer; backfill; tabel `Participant/Notification/Subscription`; index; konsolidasi migrasi.
- **Dependencies:** Phase 6.
- **Risiko:** Kehilangan/korupsi data trip.
- **DoD:** Backfill terverifikasi; 0 JSON blob untuk data query-kritis.
- **Durasi:** 3 minggu.

## Phase 8 — Performance Optimization (Minggu 7–10)
- **Objective:** Core Web Vitals hijau.
- **Deliverables:** LCP < 2.5s, prefetch, caching, bundle optimal.
- **Task:** RSC + islands; prefetch CTA; image optimization; bundle analyzer.
- **Dependencies:** Phase 5.
- **Risiko:** Regresi interaktivitas.
- **DoD:** Lighthouse ≥ 90; CWV "Good".
- **Durasi:** 3 minggu.

## Phase 9 — Security Improvement (Minggu 1–3, lalu berkelanjutan)
- **Objective:** Postur keamanan produksi.
- **Deliverables:** Distributed rate limit, security headers, privacy/ToS, secret hygiene.
- **Task:** Upstash rate limit; CSP/HSTS/X-Frame; halaman legal; hapus email hardcoded & data pribadi.
- **Dependencies:** Infra.
- **Risiko:** Header terlalu ketat memblokir aset.
- **DoD:** Rate limit efektif di prod; header lolos scan; legal live.
- **Durasi:** 2 minggu (dimulai paling awal).

## Phase 10 — Premium Features (Minggu 6–12)
- **Objective:** Mengaktifkan pendapatan.
- **Deliverables:** Stripe, pricing page, paywall, PDF export, tier Plus/Pro/Team.
- **Task:** Checkout + Portal + Webhook; pricing page; upgrade prompt kuota; annual discount.
- **Dependencies:** Phase 4 (dashboard), Phase 9 (keamanan).
- **Risiko:** Kompleksitas webhook & dunning.
- **DoD:** Transaksi berbayar sukses end-to-end di prod.
- **Durasi:** 6 minggu.

## Phase 11 — Growth Features (Minggu 10–18)
- **Objective:** Mesin akuisisi & retensi.
- **Deliverables:** Share-to-WhatsApp, referral, email drip, notifikasi settlement, social proof.
- **Task:** Share formatter; program referral; Resend drip; counter social proof.
- **Dependencies:** Phase 10, Analytics.
- **Risiko:** Spam/abuse referral.
- **DoD:** K-factor terukur; email pipeline live.
- **Durasi:** 6 minggu.

## Phase 12 — Production Readiness (Minggu 3–20, berkelanjutan)
- **Objective:** Operasional kelas produksi.
- **Deliverables:** CI/CD, monitoring, alerting, E2E, DR runbook, backup verification.
- **Task:** GitHub Actions; uptime monitor; Playwright; DR drill.
- **Dependencies:** Semua fase.
- **Risiko:** Kelelahan alert (noise).
- **DoD:** Pipeline hijau; alert aktif; DR teruji.
- **Durasi:** Berkelanjutan.

### Ringkasan Bab 6

Roadmap 13 fase (0–12) berjalan paralel dalam tiga gelombang; Phase 9 (Security) dan Phase 10 (Premium) adalah jangkar Critical, sementara Phase 12 (Production Readiness) berjalan berkelanjutan sepanjang program.

---

# 7. Breakdown Task

> Kolom **PIC** menggunakan peran: PM, FE (Frontend), BE (Backend), DES (Design), DBA (Database), DEV (DevOps), QA, SEC (Security), GRW (Growth). **Estimate** dalam hari-orang. **Status** default `Todo`.

| ID | Kategori | Task | Deskripsi | Priority | Difficulty | Estimate | Dependency | PIC | Status |
|---|---|---|---|---|---|---|---|---|---|
| T-01 | Security | Distributed rate limit | Ganti in-memory dgn Upstash Redis di semua route, prioritas `/api/parse-receipt` | 🔴 | Medium | 3 | — | BE/SEC | Todo |
| T-02 | Security | Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options di `next.config.mjs` | 🔴 | Easy | 1 | — | BE/SEC | Todo |
| T-03 | Security | Hapus data pribadi footer | Hilangkan nomor WA & IG pribadi; ganti kontak korporat | 🔴 | Easy | 0.5 | — | FE/DES | Todo |
| T-04 | Security | Hapus email admin hardcoded | Pindah `ADMIN_BOOTSTRAP_EMAILS` ke env-only | 🔴 | Easy | 0.5 | — | BE/SEC | Todo |
| T-05 | Monetization | Integrasi Stripe | Checkout + Customer Portal + Webhook | 🔴 | Hard | 8 | T-01 | BE | Todo |
| T-06 | Monetization | Pricing page | Free/Plus/Pro/Team + toggle annual | 🔴 | Medium | 3 | T-05 | FE/DES | Todo |
| T-07 | Monetization | Paywall kuota AI | Upgrade prompt saat kuota habis | 🔴 | Medium | 2 | T-05 | FE | Todo |
| T-08 | UI | Hero reposisi AI | Headline "Point. Snap. Split." + satu CTA | 🔴 | Medium | 2 | — | DES/FE | Todo |
| T-09 | UX | Dashboard pasca-login | Saldo, aktivitas terkini, trip aktif | 🔴 | Hard | 6 | — | FE/BE | Todo |
| T-10 | UX | Onboarding wizard | 3 langkah pasca sign-in pertama | 🔴 | Medium | 3 | T-09 | FE/DES | Todo |
| T-11 | Design System | Migrasi token warna | Ganti semua warna hardcoded → token semantik | 🟠 | Medium | 3 | — | FE/DES | Todo |
| T-12 | Design System | Komponen Typography | H1–H6, Body, Caption, Label | 🟠 | Easy | 2 | T-11 | FE | Todo |
| T-13 | Design System | Animation token | Duration & easing token; reduksi 25→10 keyframe | 🟢 | Medium | 2 | T-11 | FE | Todo |
| T-14 | Performance | RSC landing + islands | Shell server, island AuthButton/ThemeToggle | 🟠 | Medium | 3 | — | FE | Todo |
| T-15 | Performance | Prefetch & bundle | Prefetch CTA; bundle analyzer; hapus SDK dari landing | 🟠 | Medium | 2 | T-14 | FE | Todo |
| T-16 | Backend | Cache FX rate | Redis TTL 15 menit | 🟠 | Easy | 1 | T-01 | BE | Todo |
| T-17 | Backend | API versioning | `/api/v1/` + kompat sementara | 🟠 | Medium | 3 | — | BE | Todo |
| T-18 | Backend | Background jobs | Inngest/Vercel Cron: quota reset, cleanup | 🟠 | Medium | 3 | — | BE/DEV | Todo |
| T-19 | Observability | Sentry | Error tracking FE+BE | 🟠 | Easy | 1 | — | DEV | Todo |
| T-20 | Analytics | PostHog/Vercel Analytics | Event funnel: signup→split→settle | 🟠 | Medium | 2 | — | GRW/FE | Todo |
| T-21 | Infra | CI/CD pipeline | GitHub Actions lint→test→build→preview→prod | 🟠 | Medium | 3 | — | DEV | Todo |
| T-22 | Testing | Playwright E2E | Flow sign-in→split→settle | 🟠 | Medium | 4 | T-21 | QA | Todo |
| T-23 | Database | Normalisasi TripReceipt | Dual-write + backfill relational | 🟠 | Hard | 6 | T-17 | DBA/BE | Todo |
| T-24 | Database | Index & tabel baru | Index tripId/expiresAt; Participant/Notification/Subscription | 🟠 | Medium | 3 | T-23 | DBA | Todo |
| T-25 | Database | Konsolidasi migrasi | Masukkan 4+ SQL manual ke Prisma Migrate (kini termasuk activity-log & change-requests) | 🟠 | Medium | 2 | — | DBA | Todo |
| T-26 | Growth | Share-to-WhatsApp | Format ringkasan settlement satu ketuk | 🟠 | Easy | 2 | — | FE/GRW | Todo |
| T-27 | Growth | Email transaksional | Resend: welcome, settlement reminder, receipt | 🟠 | Medium | 3 | T-05 | BE/GRW | Todo |
| T-28 | Growth | Referral program | "Share, get 1 bulan Plus" | 🟡 | Medium | 3 | T-05,T-27 | BE/GRW | Todo |
| T-29 | SEO | OG image + sitemap + robots + JSON-LD | Metadata & structured data | 🟠 | Easy | 2 | T-14 | FE | Todo |
| T-30 | Accessibility | Reduced-motion guard + kontras + skip link | Perbaikan WCAG AA | 🟡 | Easy | 2 | T-11 | FE | Todo |
| T-31 | UX | Rename mode & IA | Quick Split/Group Bills/Trip Tracker + nav | 🟡 | Easy | 2 | T-08 | PM/FE | Todo |
| T-32 | Frontend | Atomic Design refactor | atoms/molecules/organisms | 🟡 | Medium | 4 | T-12 | FE | Todo |
| T-33 | Frontend | Unified state layer | Satukan localStorage/cloud persistence — **wajib bangun di atas travel-outbox, jangan ganti** | 🟡 | Hard | 5 | T-32 | FE | Todo |
| T-34 | Backend | Realtime Travel | Supabase Realtime kolaborasi live — **prioritas turun ke Low** (change-request workflow sudah tutup korupsi konkuren) | 🟢 | Hard | 5 | T-23 | BE | Todo |
| T-35 | Monetization | PDF export (Pro) | Export ringkasan trip | 🟡 | Medium | 2 | T-05 | FE/BE | Todo |
| T-36 | Growth | Social proof + FAQ | Counter split & FAQ di landing | 🟡 | Easy | 2 | T-20 | GRW/FE | Todo |
| T-37 | Infra | Monitoring & alerting | Uptime + alert channel | 🟠 | Medium | 2 | T-19 | DEV | Todo |
| T-38 | Infra | DR runbook & backup verify | Prosedur pemulihan bencana | 🟡 | Medium | 2 | — | DEV | Todo |
| T-39 | Cleanup | Rename proxy.ts | `proxy.ts`→`middleware.ts` | 🟢 | Easy | 0.5 | — | BE | Todo |
| T-40 | Storybook | Dokumentasi komponen | Storybook untuk design system | 🟢 | Medium | 3 | T-32 | FE | Todo |

### Ringkasan Bab 7

40 task inti terpetakan dengan estimasi ~120 hari-orang. Task Critical (T-01–T-10) berjumlah ~29 hari-orang dan menjadi fokus 30 hari pertama.

---

# 8. UI/UX Improvement Plan

## 8.1 Semua Halaman (audit & aksi)

| Halaman | Status Sekarang | Aksi |
|---|---|---|
| Landing (`/`) | Client-only, 3-mode, hero generik | RSC, hero AI, 1 CTA, footer korporat |
| Single (`/single`) | localStorage, multi-step | Integrasi ke flow terpadu, peak moment |
| Multiple (`/multiple`) | localStorage, sidebar | Rename "Group Bills", empty state |
| Travel (`/travel`) | Cloud sync, offline outbox, change-request approval | Resume state, discoverability, integrasi ke dashboard (realtime opsional/Low) |
| History (`/history`) | Auth-only | Empty state, filter, integrasi dashboard |
| **Dashboard** (baru) | **Tidak ada** | **Bangun: saldo, aktivitas, trip aktif** |
| **Onboarding** (baru) | **Tidak ada** | **Wizard 3 langkah** |
| **Pricing** (baru) | **Tidak ada** | **Free/Plus/Pro/Team** |
| Admin (`/admin`) | Lengkap | Pertahankan; tambah system health |
| Legal (baru) | Tidak ada | Privacy Policy + ToS |

## 8.2 Komponen yang Perlu Dibuat Ulang / Dibuat
- Button (variant: primary/secondary/ghost/destructive) — border sekunder terlihat saat rest.
- Card (hover state tunggal via token).
- Input, Select, Modal, Dialog, Dropdown (audit konsistensi).
- Typography (H1–H6, Body, Caption, Label) — baru.
- EmptyState, Skeleton, ErrorState, SuccessCelebration — baru.
- Footer (korporat) — rombak.
- PricingCard, UpgradePrompt, PlanBadge — baru.

## 8.3 Flow
- Sign-in → **Onboarding** → **Dashboard** (bukan kembali ke landing).
- Split: Kamera/AI → pilih peserta → hasil → **peak moment** → share.
- Upgrade: kuota habis → prompt → pricing → checkout → sukses.

## 8.4 Micro Interaction & Animation
- Peak-moment settlement (confetti terukur, hormati reduced-motion).
- Hover lift kartu (token-based).
- Reduksi animasi hero (orb & parallax) demi fokus & performa.

## 8.5 Design Consistency, Accessibility, Responsive, Dark Mode, Design Token
- Token semantik tunggal (warna, spacing 8pt, radius, durasi, easing).
- WCAG 2.2 AA: kontras, keyboard nav, skip link, reduced-motion (termasuk JS).
- Responsive: bottom nav mobile, touch target ≥ 44px.
- Dark mode: semua warna via token (tidak ada `dark:` manual per komponen).

### Ringkasan Bab 8

Prioritas UI/UX: bangun Dashboard, Onboarding, dan Pricing yang belum ada; rombak Landing dan Footer; satukan komponen & token; rancang peak moment settlement.

---

# 9. Frontend Improvement Plan

| Area | Kondisi | Target |
|---|---|---|
| **Folder Structure** | Flat `/components` | `atoms/ molecules/ organisms/ templates/`, `features/`, `lib/`, `hooks/` |
| **Component Architecture** | Ad-hoc | Atomic Design, komposisi via slots |
| **State Management** | localStorage/cloud terpisah, hook per-mode | Unified persistence layer (satu hook adapter guest↔cloud) |
| **API Layer** | `api-client.ts` | Typed client per resource, versioned, error normalization |
| **Hooks** | Beragam | Standar penamaan `use*`, single-responsibility |
| **Reusable Component** | Sebagian | Semua UI via design system |
| **Performance** | Client landing berat | RSC + islands, `React.lazy` Travel, prefetch |
| **Testing** | Unit lib saja | + component test (Testing Library) + E2E (Playwright) |
| **Code Quality** | Baik di `lib/` | ESLint strict, no hardcoded color rule (custom lint) |
| **Naming Convention** | Konsisten | Dokumentasikan: PascalCase komponen, camelCase hook, kebab file util |

### Ringkasan Bab 9

Frontend perlu Atomic Design, unified state layer, RSC islands, dan lint rule anti-hardcoded-color untuk menegakkan design system.

---

# 10. Backend Improvement Plan

| Area | Kondisi | Target |
|---|---|---|
| **API** | REST route handlers, tak versioned | `/api/v1/`, OpenAPI spec, error format konsisten |
| **Authentication** | Supabase Google OAuth | Pertahankan; tambah email/password (opsional), welcome email |
| **Authorization** | `getAuthUser` + ban layer | RBAC eksplisit, audit akses data |
| **Caching** | Tidak ada | Redis (FX, session, read-heavy) |
| **Realtime** | Tidak ada (409 konflik) | Supabase Realtime channel per trip |
| **Notification** | Tidak ada | Tabel + push/email settlement reminder |
| **Logging** | Minimal | Structured JSON logs |
| **Monitoring** | Health endpoint saja | Sentry + uptime + metrics |
| **Queue** | Tidak ada | Inngest/Vercel Cron (quota reset, cleanup, email) |
| **Storage** | — | Supabase Storage untuk foto struk asli |
| **Security** | CSRF ada, rate limit bocor | Distributed rate limit, input validation ketat, size limit upload AI |

### Ringkasan Bab 10

Backend memerlukan versioning, caching Redis, background jobs, realtime, notifikasi, dan observability penuh — dengan rate limit terdistribusi sebagai prioritas P0.

---

# 11. Database Improvement Plan

## 11.1 ERD (arah target)

```
User 1───* Trip 1───* TripReceipt 1───* TripReceiptItem
  │           │
  │           ├───* TripPayment
  │           ├───* TripMember *───1 User
  │           ├───* TripInvite
  │           ├───* TripChangeRequest  (ADA di main — ops:Json, biarkan JSON)
  │           └───* Participant *───0..1 User   (target normalisasi participantsJson)
  │
  ├───* ActivityEvent      (ADA di main — monitoring; pertimbangkan partisi/TTL)
  ├───* Subscription (baru — untuk Stripe)
  ├───* Notification (baru)
  └───* AdminAuditLog (actor)

User.lastLoginAt  (ADA di main — sumber "active today")
SharedSummary *───1 User (createdBy)
```

> [!NOTE]
> **Legend:** *(ADA di main)* = sudah diimplementasi, dipertahankan · *(baru)* = perlu dibuat · *(target normalisasi)* = migrasi dari JSON blob.
> `TripChangeRequest.ops` sengaja **tetap JSON** — ia adalah log perubahan immutable (bukan data query-kritis), sehingga dikecualikan dari rencana normalisasi.

## 11.2 Rencana per Aspek

| Aspek | Aksi |
|---|---|
| **Table** | Normalisasi `TripReceipt.payload` → `TripReceiptItem`; tabel `Participant`, `Notification`, `Subscription`. **Sudah ada:** `TripChangeRequest`, `ActivityEvent` (pertahankan). Kecualikan `TripChangeRequest.ops` dari normalisasi (log immutable). |
| **Relationship** | Ganti `participantsJson` dengan FK `Participant`. FK `TripChangeRequest.tripId` & `ActivityEvent.userId` sudah `ON DELETE CASCADE` (baik). |
| **Index** | `TripPayment.tripId`, `SharedSummary.expiresAt`, `AdminAuditLog.actorId/targetUserId`, `Receipt.tripId`. **Sudah ada:** `TripChangeRequest[tripId,status]`, `ActivityEvent[createdAt]` & `[userId,createdAt]`. |
| **Constraint** | FK enforcement, unique code, not-null pada kolom keuangan |
| **Migration** | **Urgensi naik:** konsolidasi 4+ SQL manual (termasuk `2026-07-add-activity-log.sql`, `2026-07-add-trip-change-requests.sql`) ke Prisma Migrate; hentikan apply manual via Supabase SQL editor |
| **Backup** | Verifikasi backup otomatis Supabase + restore drill |
| **Audit Trail** | Pertahankan `AdminAuditLog` (append-only, email denormalized); tambah audit akses data untuk GDPR/PDPA |
| **Soft Delete** | Pertahankan di Trip/Receipt; terapkan pola konsisten di tabel baru |
| **Scalability** | Rencana read replica saat >10K MAU; pertimbangkan partisi audit log |

## 11.3 Strategi Migrasi Aman
1. Tambah tabel relational baru (non-destruktif).
2. **Dual-write**: tulis ke JSON blob & tabel baru bersamaan.
3. **Backfill** data historis + verifikasi rekonsiliasi.
4. Alihkan read ke tabel baru.
5. Deprecate JSON blob setelah periode observasi.

### Ringkasan Bab 11

Prioritas DB: normalisasi TripReceipt via dual-write aman, tambah index & tabel bisnis (Subscription/Notification), dan satukan riwayat migrasi ke Prisma.

---

# 12. Infrastructure Strategy

| Area | Target |
|---|---|
| **Environment** | `dev` / `preview` / `production` terpisah; env matrix terdokumentasi; secrets via Vercel env |
| **CI/CD** | GitHub Actions: lint → typecheck → test → build → preview deploy → (manual gate) → production |
| **Docker** | Dockerfile untuk parity lokal & potensi self-host (opsional; Vercel tetap utama) |
| **Cloud** | Vercel (edge/serverless) + Supabase (DB/Auth/Storage/Realtime) + Upstash (Redis) |
| **CDN** | Vercel Edge Network; cache header eksplisit untuk aset & API cacheable |
| **Monitoring** | Sentry (error), Vercel Analytics/PostHog (produk), uptime monitor (Better Stack/Checkly) |
| **Secrets** | Vercel encrypted env; rotasi kunci; tidak ada secret di source |
| **Backup** | Supabase automated backup + verifikasi restore berkala |
| **Disaster Recovery** | Runbook: RTO/RPO target, prosedur restore, kontak eskalasi, DR drill kuartalan |

### Ringkasan Bab 12

Infrastruktur bertumpu pada Vercel + Supabase + Upstash dengan pipeline CI/CD formal, observability tiga lapis, dan DR runbook teruji.

---

# 13. Testing Strategy

| Jenis | Cakupan | Alat | Target |
|---|---|---|---|
| **Unit** | Fungsi `lib/` (kalkulasi, settle-up, validasi) | Vitest | Coverage ≥ 80% pada `lib/` |
| **Integration** | API route + Prisma (DB test) | Vitest + test DB | Flow CRUD trip/receipt/payment. **Prioritas:** rute baru yang belum teruji — change-request approve/decline, activity beacon. |
| **E2E** | sign-in → split → settle → share | Playwright | Semua flow kritis hijau |
| **Regression** | Snapshot flow utama tiap rilis | Playwright | Jalan di CI |
| **Performance** | LCP/CLS/TTFB | Lighthouse CI | Lighthouse ≥ 90 |
| **Security** | Header, rate limit, authz | OWASP ZAP + tes manual | 0 High/Critical |
| **Accessibility** | WCAG 2.2 AA | axe-core + manual | 0 violation kritis |
| **UAT** | Skenario persona nyata | Manual/beta | Sign-off PM |

### Ringkasan Bab 13

Piramida uji: unit kuat (sudah ada), tambah integration & E2E untuk flow kritis, plus gate Lighthouse, security, dan a11y di CI.

---

# 14. Risk Management

| Kategori | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| **Technical** | Migrasi data model merusak trip eksisting | Tinggi | Dual-write + backfill + verifikasi + rollback plan |
| **Technical** | Rate limit baru salah konfigurasi memblokir user sah | Sedang | Threshold bertahap + monitoring + kill switch |
| **Business** | Konversi turun setelah redesign landing | Sedang | A/B test, rilis bertahap, metrik guardrail |
| **Business** | Pricing tidak diterima pasar | Tinggi | Riset harga, eksperimen, annual discount |
| **Timeline** | Kapasitas tim indie terbatas | Tinggi | Fokus Critical, fase ketat, potong scope Low |
| **Resource** | Ketergantungan single maintainer | Tinggi | Dokumentasi, RACI, onboarding kontributor |
| **Scalability** | Lonjakan trafik saat viral | Sedang | Redis, edge cache, read replica siap |
| **Security** | Abuse endpoint AI | Tinggi (biaya) | Distributed rate limit + quota server-side + alert biaya |
| **Vendor** | Ketergantungan Gemini/Supabase | Sedang | Abstraksi provider, fallback manual entry |

### Ringkasan Bab 14

Risiko terbesar adalah migrasi data dan keterbatasan kapasitas tim; keduanya dimitigasi dengan pendekatan bertahap non-destruktif dan fokus ketat pada item Critical.

---

# 15. KPI & Success Metrics

| Metrik | Baseline (asumsi) | Target 90 Hari | Target 6 Bulan |
|---|---|---|---|
| **North Star: Settled splits/minggu** | — | 500 | 3.000 |
| **Lighthouse (mobile)** | ~60 | ≥ 90 | ≥ 95 |
| **LCP** | 2.5–4s | < 2.5s | < 2.0s |
| **CLS** | ? | < 0.1 | < 0.1 |
| **TTFB** | ? | < 0.8s | < 0.6s |
| **Activation (split pertama < 3 mnt)** | — | 40% | 60% |
| **D7 Retention** | — | 20% | 35% |
| **D30 Retention** | — | 10% | 20% |
| **Free→Paid conversion** | 0% | 2% | 5% |
| **MRR** | Rp0 | Rp5jt | Rp30jt |
| **Crash-free sessions** | — | 99.5% | 99.9% |
| **API p95 response time** | — | < 500ms | < 300ms |
| **Bug escape rate** | — | < 5/rilis | < 2/rilis |
| **NPS** | — | > 30 | > 45 |
| **K-factor** | 0 | 0.3 | 0.7 |

### Ringkasan Bab 15

North Star adalah settled splits/minggu; KPI mencakup performa (Lighthouse/CWV), aktivasi/retensi, monetisasi (MRR/konversi), keandalan (crash-free/p95), dan viralitas (K-factor).

---

# 16. Timeline Implementasi

> Asumsi tim kecil paralel. Item Critical dimulai Minggu 1.

| Minggu | Fokus Utama | Task |
|---|---|---|
| **W1** | Security P0 + Prep | T-01, T-02, T-03, T-04, Phase 0 |
| **W2** | Design Foundation + Hero | T-08, T-11 (mulai), T-19, T-21 (mulai) |
| **W3** | Design System + Stripe (mulai) | T-11, T-12, T-05 (mulai), T-14 |
| **W4** | Monetisasi inti | T-05, T-06, T-07, T-15 |
| **W5** | Dashboard + Analytics | T-09, T-20, T-16, T-17 (mulai) |
| **W6** | Onboarding + Backend | T-10, T-17, T-18, T-22 (mulai) |
| **W7** | Performance + SEO | T-14 (selesai), T-29, T-30, T-22 |
| **W8** | UX polish + Growth (mulai) | T-31, T-26, T-27, T-36 |
| **W9** | Frontend Refactor | T-32, T-33 (mulai), T-13 |
| **W10** | DB Improvement (mulai) | T-23 (mulai), T-24, T-25 |
| **W11** | DB + Referral | T-23, T-28, T-35 |
| **W12** | Realtime + Hardening | T-34, T-37, T-38, T-39, T-40 |
| **W13–W16** | Growth scaling + AI features | Referral optimize, email drip, multi-photo scan |
| **W17–W20** | Scale readiness | Read replica plan, payment lokal, mobile PWA prompt, DR drill |

### Ringkasan Bab 16

Timeline 20 minggu: keamanan & monetisasi di W1–W4, retensi & performa W5–W8, refactor & DB W9–W12, growth & skala W13–W20.

---

# 17. Definition of Done

Untuk **setiap phase**, berlaku Quality Gate berikut:

## 17.1 Checklist Selesai (per task)
- [ ] Kode di-review (min. 1 reviewer)
- [ ] Test relevan ditulis & lolos
- [ ] Tidak ada regresi lint/typecheck
- [ ] Terinstrumentasi analytics (jika user-facing)
- [ ] Terdokumentasi (jika perubahan arsitektur/API)

## 17.2 Quality Gate (per phase)
- [ ] CI hijau (lint, typecheck, unit, build)
- [ ] E2E flow terkait lolos
- [ ] Lighthouse ≥ 90 (untuk phase UI/Performance)
- [ ] 0 pelanggaran a11y kritis (untuk phase UI)
- [ ] 0 temuan security High/Critical (untuk phase Security/Backend)

## 17.3 Acceptance Criteria
- Memenuhi objective phase & deliverables tercapai.
- Metrik target phase terukur (mis. LCP < 2.5s untuk Performance).

## 17.4 Review Process
PR → review peer → QA verifikasi di preview → PM sign-off → merge → deploy prod → verifikasi pasca-deploy.

## 17.5 Testing Requirement
Unit untuk logika, integration untuk API, E2E untuk flow user-facing, regresi di CI.

### Ringkasan Bab 17

DoD berlapis: task-level (review+test), phase-level (quality gate CI/Lighthouse/security/a11y), dan proses rilis dengan sign-off PM serta verifikasi pasca-deploy.

---

# 18. Future Enhancement

## Versi 1.0 (Program transformasi ini — 0–6 bulan)
Stripe & pricing, dashboard, onboarding, design system, RSC/perf, security hardening, share-to-WhatsApp, email transaksional, referral, observability, E2E, normalisasi DB.

## Versi 2.0 (6–12 bulan)
Running balance lintas grup, social feed, push notification, realtime kolaborasi penuh, PDF/analytics premium, recurring expense, multi-payer, PWA install, integrasi pembayaran lokal (GoPay/OVO/Dana).

## Versi 3.0 (12–24 bulan)
Money movement (settlement satu ketuk), bank statement import, Team/B2B tier, Splitzy public API, WhatsApp/Telegram bot skala, internasionalisasi (Bahasa Indonesia → SEA), mobile app (React Native).

## Moonshot Ideas
Splitzy Card (kartu debit grup dengan auto-split), AI financial advisor grup, receipt blockchain notarization, voice input, live camera OCR real-time, group savings/pool, white-label untuk platform HR.

### Ringkasan Bab 18

Evolusi produk: v1.0 fondasi & monetisasi, v2.0 social & realtime & pembayaran lokal, v3.0 money movement & platform, dengan moonshot menuju "Financial OS untuk kelompok".

---

# 19. Lampiran

## Lampiran A — Hasil Audit Asli (Ringkasan Referensi)

> Dokumen ini diturunkan dari audit produk menyeluruh. Poin-poin inti audit dipertahankan penuh di **Bab 3 (Ringkasan Hasil Audit)** dan tersebar pada Bab 8–12. Skor asli dan verdict investasi direkam di bawah ini agar tidak ada informasi yang hilang.

### A.1 Skor Audit
- Overall v1.0: **41/100** → v1.1: **43/100** (lihat Bab 0.4)
- UX 4 · UI 6 · Engineering 6 · Architecture 5→**6** · Scalability 4 · Security 5 · SaaS Readiness 2 · Conversion 2 · Premium Feeling 5 · Investor Readiness 2.

### A.2 Verdict Investasi
**CONDITIONAL NO → path to YES dalam 6 bulan** jika: Stripe live (Plus tier), AI scanning menjadi hero, dashboard pasca-login ada, share-to-WhatsApp live, rate limit terdistribusi, 1.000+ active users dengan retensi terukur, footer korporat.

### A.3 Temuan Kritis (verbatim ringkas)
1. Tidak ada infrastruktur monetisasi (nol pendapatan).
2. Rate limiter in-memory non-fungsional di serverless (P0, risiko biaya Gemini).
3. Tidak ada dashboard pasca-login.
4. Arsitektur pemilihan 3 mode melanggar Hick's Law.
5. AI scanning (pembeda utama) tersembunyi.
6. Footer memuat data pribadi (WA/IG) → merusak kepercayaan.
7. Empat sistem warna paralel → design token collapse.
8. Landing client-only → LCP buruk & SEO nol.
9. Dual data model (relational vs JSON blob).
10. Tidak ada CI/CD, monitoring, E2E, halaman legal.

### A.4 Analisis Kompetitif (ringkas)
Splitwise (8/10, brand & social graph), Revolut (8/10, money movement), Settle Up (6/10, graph viz), Tricount (6/10, simplicity). **Wedge Splitzy:** AI scanning + Travel multi-currency + web-first + pasar SEA.

### A.5 Referensi Teknis Codebase (diperbarui v1.1)
Next.js 16 App Router, React 19, TS 5.9, Supabase, Prisma (Postgres ap-southeast-1), Gemini AI, Radix UI, Vitest. Middleware di `src/proxy.ts`. Free plan 15 AI scan/bln (inert).
**Model (14, +2 sejak v1.0):** User (+`lastLoginAt`), Trip, TripReceipt, TripPayment, TripInvite, TripMember, **TripChangeRequest (baru)**, Receipt, ReceiptItem, ItemAssignment, SharedSummary, AdminAuditLog, **ActivityEvent (baru)**.
**Kapabilitas baru di `main`:** change-request approval workflow (`change-ops.ts`, `apply-change-ops.ts`, 3 rute + `ChangeRequests.tsx`), travel outbox offline-sync (`travel-outbox.ts`), activity monitoring (`activity*.ts`, 2 rute).
**Dependency tak ada (dikonfirmasi):** Stripe, Redis/Upstash/KV, Sentry, PostHog/analytics SDK, Resend/email, Playwright. Tidak ada `.github/workflows`. `next.config.mjs` tanpa security headers.

### Ringkasan Bab 19

Lampiran merekam skor, verdict, temuan kritis, analisis kompetitif, dan referensi codebase dari audit asli sebagai sumber kebenaran yang tidak boleh hilang.

---
---

# Output Tambahan

---

## Executive Dashboard

> **Splitzy Product Transformation — Snapshot 1 Halaman**

```
╔══════════════════════════════════════════════════════════════════╗
║  SPLITZY TRANSFORMATION · v1.1 (30 Jul)  Status: PLANNING          ║
╠══════════════════════════════════════════════════════════════════╣
║  SKOR SAAT INI: 43/100        TARGET 6 BULAN: 80/100               ║
║                                                                    ║
║  KESEHATAN DIMENSI                                                 ║
║  UX          ████░░░░░░ 4    Security    █████░░░░░ 5              ║
║  UI          ██████░░░░ 6    SaaS Ready  ██░░░░░░░░ 2  ⚠           ║
║  Engineering ██████░░░░ 6    Conversion  ██░░░░░░░░ 2  ⚠           ║
║  Architecture██████░░░░ 6    Premium     █████░░░░░ 5              ║
║  Scalability ████░░░░░░ 4    Investor    ██░░░░░░░░ 2  ⚠           ║
║  (+2 sejak v1.0: change-request, outbox, activity monitoring)     ║
╠══════════════════════════════════════════════════════════════════╣
║  5 MASALAH EKSISTENSIAL                                            ║
║  🔴 Tidak ada monetisasi (Stripe/pricing)                         ║
║  🔴 Rate limiter bocor (P0 biaya AI)                              ║
║  🔴 Tidak ada dashboard pasca-login                               ║
║  🔴 Arsitektur 3-mode salah (Hick's Law)                          ║
║  🔴 AI scanning (pembeda) tersembunyi                             ║
╠══════════════════════════════════════════════════════════════════╣
║  3 GELOMBANG               │  KPI UTAMA (90 hari)                  ║
║  1. Stabilize & Monetize   │  MRR: Rp0 → Rp5jt                     ║
║  2. Retain & Polish        │  Lighthouse: 60 → 90                  ║
║  3. Grow & Scale           │  Konversi: 0% → 2%                    ║
║                            │  Activation: → 40%                    ║
╠══════════════════════════════════════════════════════════════════╣
║  30 HARI: Security fix · Stripe · Hero AI · Dashboard              ║
║  90 HARI: Design system · Perf · Growth · Observability            ║
║  VERDICT INVESTASI: Conditional NO → YES dalam 6 bulan             ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Product Transformation Checklist

### 🔴 Critical (Minggu 1–4)
- [ ] T-01 Distributed rate limiting (Upstash)
- [ ] T-02 Security headers (CSP/HSTS/X-Frame)
- [ ] T-03 Hapus data pribadi dari footer
- [ ] T-04 Hapus email admin hardcoded
- [ ] T-05 Integrasi Stripe (Checkout/Portal/Webhook)
- [ ] T-06 Pricing page (Free/Plus/Pro/Team)
- [ ] T-07 Paywall kuota AI
- [ ] T-08 Hero reposisi AI + satu CTA
- [ ] T-09 Dashboard pasca-login
- [ ] T-10 Onboarding wizard

### 🟠 High (Minggu 3–10)
- [ ] T-11 Migrasi token warna
- [ ] T-12 Komponen Typography
- [ ] T-14 RSC landing + islands
- [ ] T-15 Prefetch & bundle optimization
- [ ] T-16 Cache FX rate (Redis)
- [ ] T-17 API versioning
- [ ] T-18 Background jobs
- [ ] T-19 Sentry
- [ ] T-20 Analytics (PostHog)
- [ ] T-21 CI/CD pipeline
- [ ] T-22 Playwright E2E
- [ ] T-23 Normalisasi TripReceipt
- [ ] T-24 Index & tabel baru
- [ ] T-25 Konsolidasi migrasi
- [ ] T-26 Share-to-WhatsApp
- [ ] T-27 Email transaksional
- [ ] T-29 SEO (OG/sitemap/robots/JSON-LD)
- [ ] T-37 Monitoring & alerting

### 🟡 Medium (Minggu 8–14)
- [ ] T-13 Animation token & reduksi keyframe
- [ ] T-28 Referral program
- [ ] T-30 Aksesibilitas WCAG AA
- [ ] T-31 Rename mode & IA nav
- [ ] T-32 Atomic Design refactor
- [ ] T-33 Unified state layer
- [ ] T-34 Realtime Travel
- [ ] T-35 PDF export (Pro)
- [ ] T-36 Social proof + FAQ
- [ ] T-38 DR runbook & backup verify

### 🟢 Low / Nice-to-have
- [ ] T-39 Rename proxy.ts → middleware.ts
- [ ] T-40 Storybook
- [ ] Voice input / live camera OCR
- [ ] Payment lokal (GoPay/OVO/Dana)
- [ ] Mobile app (React Native)

---

## Action Plan 30 Hari

> **Tema: Stabilkan, Amankan, Hasilkan Pendapatan.**

| Minggu | Tujuan | Deliverable Utama |
|---|---|---|
| **W1** | Tutup celah keamanan P0 | Rate limit terdistribusi live; security headers; footer & email dibersihkan; project board siap |
| **W2** | Fondasi visual + hero | Hero "Point. Snap. Split." live; token warna mulai; Sentry aktif; CI mulai |
| **W3** | Aktifkan pembayaran (mulai) | Stripe integration (checkout) berfungsi di test; RSC landing; design system komponen inti |
| **W4** | Monetisasi hidup | Pricing page live; paywall kuota AI; annual toggle; transaksi test end-to-end sukses |

**Definition of Success 30 hari:** Rate limit efektif di produksi, transaksi berbayar berhasil di lingkungan test/prod, hero mengomunikasikan AI, tidak ada data pribadi di footer.

---

## Action Plan 90 Hari

> **Tema: Retensi, Polish, Growth Engine.**

| Bulan | Fokus | Hasil Kunci |
|---|---|---|
| **Bulan 1** | Security + Monetisasi | Stripe live, pricing, hero AI, security beres (lihat 30 hari) |
| **Bulan 2** | Retensi + Performa + Observability | Dashboard & onboarding live; Lighthouse ≥ 90; Sentry + Analytics; E2E flow kritis; API versioning; background jobs |
| **Bulan 3** | Growth + Refactor + DB | Share-to-WhatsApp & email drip & referral live; RSC/SEO selesai; normalisasi DB (dual-write+backfill); realtime Travel (beta); design system tuntas |

**Definition of Success 90 hari:** MRR > Rp5jt, konversi free→paid ≥ 2%, activation ≥ 40%, Lighthouse ≥ 90, observability penuh, growth loop pertama (share/referral) aktif.

---

## Product Backlog

> Format ala Jira: **Epic → Feature → User Story → Task/Subtask**, dengan Priority, Story Point (SP), dan Sprint.

### EPIC 1 — Monetization Engine 🔴
- **Feature 1.1 — Payment Integration**
  - **US-1.1.1** *Sebagai pengguna, saya ingin upgrade ke Plus agar dapat scan AI tanpa batas.*
    - Task: Stripe Checkout session (SP 5) · Subtask: webhook handler, sukses/gagal redirect
    - Task: Customer Portal (SP 3)
    - Task: Subscription model + sync webhook (SP 5)
  - **US-1.1.2** *Sebagai pengguna, saya ingin melihat harga yang jelas.*
    - Task: Pricing page Free/Plus/Pro/Team (SP 3) · Subtask: annual toggle
- **Feature 1.2 — Paywall & Upgrade Prompt**
  - **US-1.2.1** *Sebagai pengguna free, saat kuota habis saya ingin diarahkan upgrade.*
    - Task: Server-side quota check (SP 2) · Task: Upgrade prompt UI (SP 2)
- **Sprint Rec:** Sprint 2–3 · **Total SP:** ~28

### EPIC 2 — Security & Trust 🔴
- **Feature 2.1 — Abuse Protection**
  - **US-2.1.1** *Sebagai operator, saya ingin endpoint AI terlindungi dari abuse.*
    - Task: Upstash rate limit (SP 3) · Task: cost alert (SP 1)
- **Feature 2.2 — Hardening**
  - Task: Security headers (SP 1) · Task: hapus data pribadi & email hardcoded (SP 1) · Task: Privacy/ToS pages (SP 2)
- **Sprint Rec:** Sprint 1 · **Total SP:** ~8

### EPIC 3 — Retention Core 🔴
- **Feature 3.1 — Dashboard**
  - **US-3.1.1** *Sebagai pengguna, saya ingin melihat saldo & trip aktif saat login.*
    - Task: Dashboard layout (SP 5) · Task: balance aggregation API (SP 3)
- **Feature 3.2 — Onboarding**
  - **US-3.2.1** *Sebagai pengguna baru, saya ingin dipandu ke split pertama.*
    - Task: Wizard 3 langkah (SP 3) · Task: welcome email (SP 2)
- **Sprint Rec:** Sprint 3–4 · **Total SP:** ~13

### EPIC 4 — Premium Experience (Design System + UI) 🟠
- Feature 4.1 Token migration (SP 3) · Feature 4.2 Typography (SP 2) · Feature 4.3 Hero + landing RSC (SP 5) · Feature 4.4 Peak-moment settlement (SP 3) · Feature 4.5 Empty/loading/error states (SP 3)
- **Sprint Rec:** Sprint 2–5 · **Total SP:** ~16

### EPIC 5 — Performance & SEO 🟠
- RSC islands (SP 3) · Prefetch/bundle (SP 2) · OG/sitemap/robots/JSON-LD (SP 2) · Lighthouse CI (SP 2)
- **Sprint Rec:** Sprint 4–5 · **Total SP:** ~9

### EPIC 6 — Observability & CI/CD 🟠
- Sentry (SP 1) · Analytics (SP 2) · CI/CD (SP 3) · E2E Playwright (SP 4) · Monitoring/alerting (SP 2)
- **Sprint Rec:** Sprint 1–4 · **Total SP:** ~12

### EPIC 7 — Backend & Data 🟠
- API versioning (SP 3) · Redis cache (SP 2) · Background jobs (SP 3) · Normalisasi DB (SP 6) · Index & tabel (SP 3) · Konsolidasi migrasi (SP 2)
- **Sprint Rec:** Sprint 3–6 · **Total SP:** ~19

### EPIC 8 — Growth Loop 🟠
- Share-to-WhatsApp (SP 2) · Email drip (SP 3) · Referral (SP 3) · Social proof + FAQ (SP 2)
- **Sprint Rec:** Sprint 4–6 · **Total SP:** ~10

### EPIC 9 — Scale & Realtime 🟡
- Realtime Travel (SP 5) · Atomic refactor (SP 4) · Unified state (SP 5) · PDF export (SP 2) · DR runbook (SP 2)
- **Sprint Rec:** Sprint 6–7 · **Total SP:** ~18

**Total estimasi backlog:** ~133 SP.

---

## Sprint Planning

> Sprint 2 minggu. Asumsi kapasitas tim inti ~20 SP/sprint (tim kecil). Sesuaikan dengan velocity nyata setelah Sprint 1.

### Sprint 1 (W1–W2) — "Lock the doors"
- **Tujuan:** Tutup celah keamanan P0, siapkan fondasi observability & CI.
- **Kapasitas:** ~18 SP
- **Backlog:** EPIC 2 (8) + Sentry (1) + CI/CD (3) + token migration mulai (3) + hero (3)
- **Dependencies:** —
- **Deliverables:** Rate limit live, headers, footer bersih, Sentry, CI dasar, hero AI.

### Sprint 2 (W3–W4) — "Turn on revenue"
- **Tujuan:** Aktifkan monetisasi.
- **Kapasitas:** ~20 SP
- **Backlog:** EPIC 1 Feature 1.1 (13) + Pricing (3) + RSC landing (3) + typography (2 mulai)
- **Dependencies:** Sprint 1 (rate limit, CI)
- **Deliverables:** Stripe checkout, pricing page, landing RSC.

### Sprint 3 (W5–W6) — "Give them a home"
- **Tujuan:** Dashboard & paywall & analytics.
- **Kapasitas:** ~20 SP
- **Backlog:** EPIC 3 Dashboard (8) + Paywall (4) + Analytics (2) + API versioning (3) + background jobs (3)
- **Dependencies:** Stripe (Sprint 2)
- **Deliverables:** Dashboard live, paywall, analytics event funnel.

### Sprint 4 (W7–W8) — "Onboard & optimize"
- **Tujuan:** Onboarding, performa, SEO, growth mulai.
- **Kapasitas:** ~20 SP
- **Backlog:** Onboarding (5) + Perf/prefetch (5) + SEO (2) + Share-WA (2) + E2E (4) + monitoring (2)
- **Dependencies:** Dashboard (Sprint 3)
- **Deliverables:** Onboarding, Lighthouse ≥ 90, E2E kritis, share-to-WhatsApp.

### Sprint 5 (W9–W10) — "Polish & refactor"
- **Tujuan:** Design system tuntas, refactor frontend, growth.
- **Kapasitas:** ~20 SP
- **Backlog:** Peak moment (3) + states (3) + Atomic refactor (4) + email drip (3) + a11y (2) + animation token (2) + social proof (2)
- **Deliverables:** Design system lengkap, states, email drip.

### Sprint 6 (W11–W12) — "Solidify data & realtime"
- **Tujuan:** Normalisasi DB, realtime, referral, hardening.
- **Kapasitas:** ~20 SP
- **Backlog:** Normalisasi DB (6) + index/tabel (3) + referral (3) + realtime beta (5) + DR runbook (2)
- **Dependencies:** API versioning (Sprint 3)
- **Deliverables:** DB dual-write+backfill, referral, realtime beta, DR runbook.

### Sprint 7+ (W13–W20) — "Grow & scale"
Growth optimization, payment lokal, multi-photo AI scan, PWA prompt, read replica plan, mobile groundwork.

---

## RACI Matrix

> **R** = Responsible · **A** = Accountable · **C** = Consulted · **I** = Informed
> Peran: PM (Product Manager), UX (Designer/Researcher), FE, BE, DBA, DEV (DevOps), QA, SEC, GRW (Growth), CPO.

| Pekerjaan | PM | UX | FE | BE | DBA | DEV | QA | SEC | GRW | CPO |
|---|---|---|---|---|---|---|---|---|---|---|
| Rate limiting & security headers | I | — | I | R | — | C | C | A | — | I |
| Stripe & monetisasi | A | C | R | R | C | I | C | C | C | I |
| Pricing strategy | R | I | I | I | — | — | — | — | C | A |
| Dashboard | A | R | R | R | C | I | C | — | I | I |
| Onboarding | A | R | R | C | — | — | C | — | C | I |
| Design system & tokens | C | A | R | — | — | — | I | — | — | I |
| Landing RSC / performance | C | C | R | C | — | C | C | — | I | I |
| SEO | C | C | R | I | — | — | I | — | A | I |
| Database normalisasi | I | — | I | R | A | C | C | — | — | I |
| API versioning & backend | A | — | C | R | C | C | C | C | — | I |
| Realtime | C | C | R | R | C | I | C | — | — | I |
| Observability (Sentry/analytics) | C | — | R | R | — | A | C | — | C | I |
| CI/CD & infra | I | — | C | C | C | A | C | C | — | I |
| Testing & QA gates | C | — | C | C | — | C | A | C | — | I |
| Growth (share/referral/email) | A | C | R | C | — | — | C | — | R | I |
| Security review & compliance | I | — | C | C | C | C | C | A | — | R |
| DR & backup | I | — | — | C | C | A | C | C | — | I |

### Ringkasan Output Tambahan

Dashboard, checklist, action plan 30/90 hari, backlog Jira, sprint 2-mingguan, dan RACI memberi tim artefak siap-pakai untuk mulai eksekusi tanpa interpretasi tambahan.

---

# Kesimpulan Akhir

## Rekomendasi Strategi Implementasi

**1. Jangan mengganggu pengguna eksisting — gunakan rilis bertahap.**
Semua perubahan besar (landing baru, dashboard, model data) dirilis di balik **feature flag** dan/atau melalui **preview deployment** sebelum produksi. Untuk landing, jalankan **A/B test** agar penurunan konversi terdeteksi dini dengan metrik guardrail. Migrasi database menggunakan pola **dual-write → backfill → verifikasi → cutover**, sehingga trip pengguna yang sudah ada tidak pernah dalam keadaan tak konsisten.

**2. Amankan dan monetisasi lebih dulu, poles dan skalakan kemudian.**
Urutan Gelombang 1→2→3 sengaja menempatkan rate limit (P0) dan Stripe di depan. Ini melindungi dari kerugian finansial nyata dan memvalidasi bisnis sebelum menghabiskan modal rekayasa pada refactor besar. Utang teknis (dual data model) sengaja ditahan sementara — dikelola, bukan diabaikan — hingga pendapatan tervalidasi.

**3. Jaga kualitas kode dengan quality gate otomatis, bukan disiplin manual.**
Terapkan CI/CD sejak Sprint 1: lint, typecheck, unit, E2E untuk flow kritis, plus gate Lighthouse/a11y/security. Tambahkan custom lint rule yang menolak warna hardcoded agar design system tidak runtuh lagi. Dengan gate otomatis, kecepatan tidak mengorbankan kualitas.

**4. Fokus pada wedge kompetitif: AI + Asia Tenggara.**
Splitzy tidak akan menang dengan menjadi Splitwise yang lebih cantik. Ia menang dengan menjadi **pembagi tagihan AI-native yang menyebar via WhatsApp di Asia Tenggara**. Setiap keputusan produk harus memperkuat wedge ini: AI scanning sebagai hero, share-to-WhatsApp sebagai loop distribusi, dan pembayaran lokal sebagai penutup gesekan settlement.

**5. Ukur segalanya.**
Tidak ada fitur yang dirilis tanpa instrumentasi. North Star (settled splits/minggu), funnel activation, dan konversi free→paid harus terlihat di dashboard analytics sejak Sprint 3. Keputusan tanpa data adalah opini; investor membeli data, bukan opini.

## Penutup

Splitzy memiliki tulang yang bagus dan craft rekayasa yang nyata. Kesenjangan antara kondisi hari ini dan potensinya **hampir seluruhnya adalah masalah produk dan bisnis, bukan rekayasa**. Perbaiki rate limiter minggu ini. Bangun Stripe minggu depan. Jadikan AI scanning sebagai pahlawan. Bangun dashboard yang membuat orang kembali. Setelah itu, biarkan produk berbicara sendiri.

Dengan eksekusi disiplin atas roadmap 20 minggu ini, Splitzy dapat bergerak dari **skor 41/100 dan "Conditional NO"** menjadi produk SaaS yang **layak investasi, dicintai pengguna, dan siap bersaing di tingkat global** — dimulai dari pasar rumahnya di Asia Tenggara.

---

*Akhir Dokumen · Splitzy Product Transformation Plan v1.0 · 13 Juli 2026*
