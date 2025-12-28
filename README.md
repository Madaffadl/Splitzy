# Splitzy 🧾

Aplikasi split bill dengan AI untuk membaca struk secara otomatis.

## Fitur

- 📸 **AI Receipt Scanner** - Upload foto struk, AI akan membaca semua item secara otomatis
- 💰 **Indonesian Rupiah** - Format mata uang Rp dengan separator ribuan
- 🧮 **Auto Tax & Service** - Deteksi otomatis PB1, PPN, dan Service Charge
- 👥 **Multi-participant** - Assign item ke banyak orang
- 🚗 **Trip Mode** - Kelola multiple struk dalam satu trip
- 💾 **Auto-save** - Data tersimpan otomatis di browser

## Setup

### 1. Clone repository
```bash
git clone https://github.com/Madaffadl/Splitzy.git
cd Splitzy
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
```bash
cp .env.example .env.local
```

Edit `.env.local` dan masukkan Gemini API key Anda:
- Buka https://aistudio.google.com/app/apikey
- Buat API key baru
- Paste ke file `.env.local`

### 4. Jalankan development server
```bash
npm run dev
```

Buka http://localhost:3000

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: TailwindCSS + shadcn/ui
- **AI**: Google Gemini 2.5 Flash (Vision)
- **Language**: TypeScript

## Deploy ke Vercel

1. Push ke GitHub
2. Connect repo ke [Vercel](https://vercel.com)
3. Tambahkan environment variable `GEMINI_API_KEY` di Vercel dashboard
4. Deploy!

## License

MIT
