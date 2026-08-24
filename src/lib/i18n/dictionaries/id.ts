// Indonesian copy — the primary language and the source of truth for the
// Dictionary shape (see ./index.ts). Every key added here must be added to
// en.ts or the build fails, which is deliberate: it stops one language from
// silently drifting behind the other.
//
// SEO note: the wording here is deliberately built around how Indonesians
// actually search — "split bill", "bagi tagihan", "patungan", "hitung
// patungan", "scan struk" — rather than being a literal translation of the
// English copy. Titles lead with the query, not the brand.

export const id = {
  /** Human-readable language name, used by the language switcher. */
  languageName: "Bahasa Indonesia",
  switchTo: "English",

  meta: {
    home: {
      title: "Splitzy — Aplikasi Split Bill & Bagi Tagihan Patungan",
      description:
        "Splitzy membagi tagihan patungan secara adil. AI membaca struk — pilih siapa makan apa — langsung tahu siapa berutang ke siapa. Gratis, tanpa perlu daftar.",
    },
    about: {
      title: "Tentang Splitzy — Apa Itu dan Bagaimana Cara Kerjanya",
      description:
        "Apa itu Splitzy, bagaimana cara menghitung pembagian tagihannya, dan prinsip di baliknya: adil, bisa diaudit, privat, dan gratis untuk fitur intinya.",
    },
    faq: {
      title: "Pertanyaan Umum tentang Splitzy",
      description:
        "Jawaban lengkap soal Splitzy: apakah gratis, apakah perlu akun, keamanan data, cara kerja perhitungan split bill, multi-mata uang, dan Splitzy Pro.",
    },
    single: {
      title: "Split Bill Satu Struk — Bagi Tagihan Otomatis",
      description:
        "Bagi satu struk makan atau pengeluaran bersama. Tambahkan peserta, scan struk, dan Splitzy menghitung bagian tiap orang termasuk pajak, service, dan diskon.",
    },
    multiple: {
      title: "Split Bill Banyak Struk — Beda Pembayar, Sekali Settle",
      description:
        "Catat beberapa struk dengan pembayar berbeda, lalu selesaikan semuanya sekaligus. Splitzy menetralkan semua utang menjadi transfer paling sedikit.",
    },
    travel: {
      title: "Catat Pengeluaran Trip — Split Bill Liburan Multi-Mata Uang",
      description:
        "Lacak semua pengeluaran satu trip beberapa hari dalam mata uang apa pun. Lihat budget vs realisasi dan siapa berutang ke siapa, kapan pun.",
    },
  },

  nav: {
    about: "Tentang",
    faq: "FAQ",
    pricing: "Harga",
    privacy: "Kebijakan Privasi",
    terms: "Syarat Layanan",
    support: "Bantuan",
    home: "Beranda",
  },

  /** Social share card (app/opengraph-image.tsx). Kept short — it renders at
   *  27px on a 1200px canvas and must fit one line. */
  og: {
    subline: "Scan struk · Transfer paling sedikit · Gratis, tanpa daftar",
  },

  header: {
    tagline: "Bagi Tagihan Jadi Mudah",
    howItWorks: "Cara pakai",
    pricing: "Harga",
  },

  /** Labels inside the decorative product mock-up in the hero. */
  preview: {
    summary: "Ringkasan",
    context: "Makan malam · 4 orang",
    payer: "Nalangin",
    settleUp: "Pelunasan",
    settled: "Beres dengan hanya 2 transfer",
  },

  hero: {
    badge: "Jangan jadi teman yang uangnya nggak balik",
    titleAccent: "Bagi tagihannya.",
    titleRest: "Beres dalam hitungan detik.",
    leadBefore:
      "Habis makan bareng atau liburan patungan? Scan struknya, tandai siapa makan apa, dan Splitzy menghitung tepat siapa berutang ke siapa — dengan ",
    leadHighlight: "transfer paling sedikit",
    leadAfter: ".",
    ctaPrimary: "Split bill — gratis",
    ctaSecondary: "Catat trip",
    note: "Gratis untuk mulai · Tanpa perlu daftar · Data kamu tetap privat",
  },

  stats: {
    labels: [
      "tagihan dibagi",
      "diselesaikan antar teman",
      "transfer dihemat",
      "rating rata-rata",
    ],
  },

  problem: {
    eyebrow: "Bagian paling awkward saat nongkrong",
    heading: "“Nanti transfer aja seikhlasnya” nggak pernah benar-benar jalan.",
    body: "Selalu ada satu orang yang nalangin. Lalu muncul utang yang kelupaan, hitung-hitungan di grup chat, dan teman yang diam-diam nggak pernah bayar. Splitzy membuat angkanya pasti dan cara balikinnya jelas — supaya uang nggak pernah merusak pertemanan.",
  },

  features: {
    scan: {
      eyebrow: "Scan struk dengan AI",
      title: "Foto struknya. Nggak perlu ketik apa-apa.",
      body: "Arahkan kamera ke struk dan Splitzy membaca item, harga, pajak, dan service-nya untukmu.",
      points: [
        "Bisa dari foto langsung atau upload",
        "Deteksi otomatis pajak, service & mata uang",
        "Semua masih bisa diedit sebelum dibagi",
      ],
    },
    settle: {
      eyebrow: "Penyelesaian pintar",
      title: "Transfer paling sedikit, dihitung otomatis.",
      body: "Nggak perlu semua orang transfer ke semua orang. Splitzy menetralkan utangnya jadi transfer sesedikit mungkin.",
      points: [
        "Menggabungkan banyak struk & pembayar sekaligus",
        "Tandai transfer sebagai lunas untuk melacak settle-up",
        "Setiap angka bisa diaudit sampai ke tingkat item",
      ],
    },
    travel: {
      eyebrow: "Pengeluaran Trip",
      title: "Satu trip utuh, satu saldo yang jelas.",
      body: "Catat setiap pengeluaran sepanjang trip beberapa hari, dalam mata uang apa pun, dan selalu tahu siapa berutang ke siapa.",
      points: [
        "Multi-mata uang dengan kurs yang dikunci",
        "Budget vs realisasi, per trip dan per orang",
        "Undang teman & bagikan ringkasan read-only",
      ],
    },
  },

  featureVisuals: {
    scanning: "Membaca struk…",
    itemsDetected: "4 item terdeteksi",
    messyTransfers: "6 transfer berantakan",
    tripName: "Trip Bali",
    spent: "Terpakai",
    budgetLeft: "Sisa budget Rp 760.000",
  },

  steps: {
    eyebrow: "Cara pakainya",
    heading: "Tiga langkah saja",
    items: [
      {
        title: "Tambahkan peserta",
        body: "Masukkan semua orang yang ikut patungan.",
      },
      {
        title: "Scan atau isi item",
        body: "Foto struknya — AI yang membaca — atau ketik manual.",
      },
      {
        title: "Lihat siapa bayar ke siapa",
        body: "Dapatkan transfer paling sedikit untuk melunasi semuanya.",
      },
    ],
  },

  modes: {
    eyebrow: "Pilih alurmu",
    heading: "Satu aplikasi, tiga cara membagi",
    badgePopular: "POPULER",
    badgeNew: "BARU",
    items: [
      {
        title: "Satu Struk",
        body: "Bagi satu tagihan makan atau pengeluaran bersama dengan teman.",
        cta: "Mulai bagi",
      },
      {
        title: "Banyak Struk",
        body: "Catat beberapa struk dengan pembayar berbeda, lalu selesaikan bersama.",
        cta: "Mulai bagi",
      },
      {
        title: "Pengeluaran Trip",
        body: "Catat pengeluaran sepanjang trip dan lihat siapa berutang ke siapa, kapan pun.",
        cta: "Mulai trip",
      },
    ],
  },

  proof: {
    eyebrow: "Kenapa orang percaya",
    heading: "Dibangun supaya adil, privat, dan gratis",
    items: [
      {
        title: "Mulai dalam detik",
        body: "Nggak perlu akun untuk membagi tagihan pertamamu — buka dan langsung pakai.",
      },
      {
        title: "Privat secara default",
        body: "Pakai sebagai guest dan datamu tetap di perangkatmu. Login hanya kalau mau sinkron.",
      },
      {
        title: "Perhitungan bisa diaudit",
        body: "Setiap rupiah bisa dilacak — buka detail tiap orang untuk lihat bagaimana bagiannya dihitung.",
      },
      {
        title: "Fitur inti gratis selamanya",
        body: "Membagi tagihan gratis, selalu. Pro hanya menambah scan AI tanpa batas.",
      },
    ],
  },

  testimonials: {
    eyebrow: "Disukai banyak grup",
    heading: "Apa kata mereka",
    starLabel: "5 dari 5 bintang",
    items: [
      {
        quote:
          "Nggak perlu bikin spreadsheet lagi tiap habis makan rame-rame. Aku scan struknya dan semua langsung tahu utangnya berapa.",
        name: "Rani P.",
        role: "Jakarta",
        initial: "R",
      },
      {
        quote:
          "Kami pakai untuk trip Bali 5 hari, 6 orang, 3 mata uang. Semuanya jadi cuma dua transfer.",
        name: "Arif H.",
        role: "Bandung",
        initial: "A",
      },
      {
        quote:
          "Akhirnya ada yang menghitung pajak dan service dengan benar. Nggak ada lagi debat siapa bayar berapa.",
        name: "Sinta W.",
        role: "Surabaya",
        initial: "S",
      },
    ],
  },

  pricing: {
    eyebrow: "Harga sederhana dan jujur",
    heading: "Semua yang kamu butuh sudah gratis",
    lead: "Upgrade hanya kalau kamu mau scan struk dengan AI tanpa batas. Bukan jebakan langganan — Pro adalah pembayaran sekali yang kamu perpanjang kapan pun kamu mau.",
    freePriceLabel: "Gratis",
    freePriceSuffix: "selamanya",
    perDays: "hari",
    mostPopular: "PALING POPULER",
    freeCta: "Mulai bagi tagihan",
    proCta: "Lihat harga",
    freeFeatures: [
      "Split satu & banyak struk",
      "Trip Pengeluaran Perjalanan",
      "15 scan struk AI per bulan",
      "Riwayat struk tersinkron antar perangkat",
    ],
    proFeatures: [
      "Semua yang ada di Free",
      "Scan struk AI tanpa batas",
      "Prioritas pemrosesan AI",
      "Dukung proyek ini 💚",
    ],
  },

  faq: {
    eyebrow: "Pertanyaan",
    heading: "Semua yang mungkin kamu tanyakan",
    seeAll: "Lihat semua pertanyaan",
    items: [
      {
        q: "Apakah Splitzy benar-benar gratis?",
        a: "Ya. Membagi satu struk, banyak struk, dan pengeluaran satu trip utuh gratis selamanya. Pro (Rp 29.000 / 30 hari) hanya menghilangkan batas scan AI — sisanya tetap gratis.",
      },
      {
        q: "Apakah saya perlu membuat akun?",
        a: "Tidak. Kamu bisa membagi tagihan pertamamu sebagai guest tanpa mendaftar apa pun. Login dengan Google hanya kalau kamu ingin riwayat struknya tersinkron antar perangkat.",
      },
      {
        q: "Apakah data saya aman?",
        a: "Sebagai guest, data split-mu tersimpan di perangkatmu sendiri. Saat kamu login, riwayatnya tersinkron ke akunmu dan tidak pernah dijual atau dibagikan. Detailnya ada di Kebijakan Privasi.",
      },
      {
        q: "Seakurat apa pembagiannya?",
        a: "Setiap item dibagi hanya di antara orang yang memakannya, lalu pajak, service, dan diskon diskalakan secara proporsional. Kamu bisa membuka detail tiap orang untuk mengaudit rinciannya.",
      },
      {
        q: "Bisa menangani pembayar berbeda dan mata uang berbeda?",
        a: "Ya. Mode Banyak Struk mendukung pembayar berbeda per struk, dan Pengeluaran Trip menangani perjalanan multi-mata uang dengan kurs yang dikunci serta penyelesaian transfer minimal.",
      },
    ],
  },

  finalCta: {
    badge: "Siap melunasi tagihannya?",
    headingBefore: "Berhenti hitung-hitungan. Mulai bagi dengan ",
    headingAccent: "adil.",
    lead: "Gratis dipakai — login hanya untuk menyimpan hasil split & riwayatmu.",
    cta: "Mulai gratis",
  },

  footer: {
    rights: "Seluruh hak dilindungi.",
  },

  /** /about — the brand-entity anchor page. */
  about: {
    heading: "Tentang Splitzy",
    lead: "Splitzy adalah aplikasi web untuk membagi tagihan patungan secara adil — dibuat untuk cara orang Indonesia benar-benar makan bareng dan liburan bareng.",
    sections: [
      {
        heading: "Masalah yang kami selesaikan",
        body: "Setiap kali makan bareng berakhir sama: satu orang nalangin, lalu semua orang berusaha mengingat siapa pesan apa. Pajak dan service dibagi rata padahal pesanannya beda jauh. Ada yang kelebihan bayar, ada yang diam-diam tidak pernah transfer. Splitzy menghapus bagian itu — kamu masukkan apa yang dipesan, dan angkanya jadi pasti.",
      },
      {
        heading: "Bagaimana Splitzy menghitung",
        body: "Setiap item hanya dibagi di antara orang yang benar-benar memakannya. Setelah itu pajak, service, dan diskon diskalakan proporsional terhadap subtotal masing-masing orang — bukan dibagi rata. Terakhir, semua utang antar orang dinetralkan menjadi transfer sesedikit mungkin, sehingga enam transfer berantakan bisa menyusut jadi dua. Setiap angka bisa dibuka sampai ke tingkat item, jadi tidak ada yang harus percaya begitu saja.",
      },
      {
        heading: "Tiga cara memakainya",
        body: "Satu Struk untuk satu tagihan makan. Banyak Struk kalau ada beberapa struk dengan pembayar berbeda yang mau diselesaikan sekaligus. Pengeluaran Trip untuk perjalanan beberapa hari dengan banyak mata uang, budget, dan anggota yang bisa diundang.",
      },
      {
        heading: "Prinsip kami",
        body: "Fitur inti gratis selamanya — membagi tagihan tidak seharusnya berbayar. Privat secara default: sebagai guest, data split-mu tidak pernah meninggalkan perangkatmu, dan kami tidak pernah menjual data siapa pun. Perhitungan yang bisa diaudit, bukan kotak hitam. Dan tanpa jebakan langganan: Splitzy Pro adalah pembayaran sekali untuk 30 hari yang kamu perpanjang sendiri kalau memang masih perlu.",
      },
      {
        heading: "Teknologi di baliknya",
        body: "Splitzy berjalan sebagai aplikasi web, jadi tidak ada yang perlu diinstal — cukup buka di browser HP atau laptop. Scan struk memakai model AI untuk membaca item, harga, pajak, dan service dari foto, dan hasilnya selalu bisa kamu koreksi sebelum dibagi. Login opsional memakai akun Google.",
      },
    ],
    contactHeading: "Hubungi kami",
    contactBody: "Ada pertanyaan, masukan, atau menemukan bug? Kirim email ke",
    ctaHeading: "Coba sekarang",
    ctaBody: "Tidak perlu daftar. Buka dan langsung bagi tagihan pertamamu.",
    cta: "Split bill — gratis",
  },

  /** /faq — the long-form FAQ page (superset of the landing FAQ). */
  faqPage: {
    heading: "Pertanyaan umum tentang Splitzy",
    lead: "Semua yang biasanya ditanyakan sebelum dan sesudah memakai Splitzy. Kalau jawabanmu tidak ada di sini, kirim email ke kami.",
    groups: [
      {
        heading: "Dasar-dasar",
        items: [
          {
            q: "Apa itu Splitzy?",
            a: "Splitzy adalah aplikasi web gratis untuk membagi tagihan patungan. Kamu memasukkan item dari sebuah struk — atau memfotonya dan membiarkan AI membacanya — menandai siapa memakan apa, lalu Splitzy menghitung bagian tiap orang dan siapa harus transfer ke siapa.",
          },
          {
            q: "Apakah Splitzy benar-benar gratis?",
            a: "Ya. Membagi satu struk, banyak struk, dan pengeluaran satu trip utuh gratis selamanya. Splitzy Pro seharga Rp 29.000 untuk 30 hari hanya menghilangkan batas scan struk dengan AI — semua fitur lainnya tetap gratis tanpa batas.",
          },
          {
            q: "Apakah saya perlu mengunduh aplikasi?",
            a: "Tidak. Splitzy berjalan langsung di browser, di HP maupun laptop. Kamu bisa menambahkannya ke home screen supaya terasa seperti aplikasi biasa, tapi tidak ada yang perlu diinstal dari app store.",
          },
          {
            q: "Apakah saya perlu membuat akun?",
            a: "Tidak untuk mulai. Kamu bisa membagi tagihan sebagai guest tanpa mendaftar. Login dengan Google hanya diperlukan kalau kamu ingin riwayat struk tersimpan dan tersinkron antar perangkat, atau ingin mengundang teman ke sebuah trip.",
          },
        ],
      },
      {
        heading: "Cara kerja perhitungan",
        items: [
          {
            q: "Seakurat apa pembagian Splitzy?",
            a: "Setiap item hanya dibagi di antara orang yang menandai dirinya ikut memakannya. Setelah semua item terbagi, pajak, service charge, dan diskon diskalakan proporsional terhadap subtotal masing-masing orang — bukan dibagi rata per kepala. Kamu bisa membuka rincian tiap orang untuk melihat persis bagaimana angkanya terbentuk.",
          },
          {
            q: "Bagaimana Splitzy menentukan transfer paling sedikit?",
            a: "Setelah tahu siapa membayar apa dan siapa berutang berapa, Splitzy menetralkan utang yang saling menghapus, lalu menyusun sisanya menjadi rangkaian transfer sesedikit mungkin. Untuk grup enam orang, ini sering memangkas belasan transfer menjadi dua atau tiga.",
          },
          {
            q: "Bisakah beberapa orang membayar struk yang berbeda?",
            a: "Bisa. Mode Banyak Struk memang dibuat untuk itu — tiap struk punya pembayarnya sendiri, dan Splitzy menyelesaikan semuanya sebagai satu perhitungan gabungan.",
          },
          {
            q: "Bagaimana dengan diskon, promo, atau voucher?",
            a: "Diskon bisa dimasukkan dan akan diperlakukan proporsional seperti pajak dan service, sehingga potongannya dinikmati sesuai porsi belanja masing-masing orang.",
          },
          {
            q: "Bisakah menangani beberapa mata uang sekaligus?",
            a: "Bisa, di mode Pengeluaran Trip. Setiap pengeluaran dicatat dalam mata uang aslinya dengan kurs yang dikunci saat itu, lalu semuanya dikonversi ke mata uang dasar trip untuk penyelesaian akhir.",
          },
        ],
      },
      {
        heading: "Scan struk dengan AI",
        items: [
          {
            q: "Bagaimana cara scan struk bekerja?",
            a: "Kamu memfoto struk atau mengunggah gambarnya, lalu model AI membaca nama item, harga, pajak, service, dan mata uangnya. Hasilnya masuk ke tabel yang bisa kamu edit sepenuhnya sebelum membagi, jadi kalau ada yang salah baca kamu bisa langsung memperbaikinya.",
          },
          {
            q: "Berapa banyak struk yang bisa saya scan?",
            a: "Akun gratis mendapat 15 scan AI per bulan. Kalau kamu butuh lebih, Splitzy Pro menghilangkan batas itu. Memasukkan item secara manual selalu tanpa batas.",
          },
          {
            q: "Struk seperti apa yang paling baik dibaca?",
            a: "Foto yang terang, lurus, dan mencakup seluruh struk memberi hasil terbaik. Struk yang kusut, terlipat, atau tercetak sangat pudar mungkin perlu sedikit koreksi manual.",
          },
        ],
      },
      {
        heading: "Privasi & data",
        items: [
          {
            q: "Apakah data saya aman?",
            a: "Kalau kamu memakai Splitzy sebagai guest, data split-mu tersimpan di perangkatmu sendiri dan tidak dikirim ke akun mana pun. Kalau kamu login, riwayatnya tersinkron ke akunmu. Dalam kedua kasus, kami tidak pernah menjual atau membagikan data kamu ke pihak lain.",
          },
          {
            q: "Apa yang terjadi pada foto struk saya?",
            a: "Foto struk diproses untuk diambil datanya, bukan untuk disimpan sebagai galeri. Rinciannya dijelaskan di Kebijakan Privasi.",
          },
          {
            q: "Bisakah saya menghapus data saya?",
            a: "Bisa. Struk dan trip bisa dihapus dari riwayatmu. Untuk penghapusan akun secara keseluruhan, hubungi kami lewat email dukungan.",
          },
        ],
      },
      {
        heading: "Splitzy Pro & pembayaran",
        items: [
          {
            q: "Apa yang saya dapat dari Splitzy Pro?",
            a: "Pro menghilangkan batas 15 scan AI per bulan menjadi tanpa batas, memberi prioritas pemrosesan AI, dan mendukung pengembangan Splitzy. Semua fitur membagi tagihan sendiri sudah gratis tanpa Pro.",
          },
          {
            q: "Apakah Pro langganan otomatis?",
            a: "Bukan. Pro adalah pembayaran sekali sebesar Rp 29.000 yang memberi akses 30 hari. Tidak ada penarikan otomatis — kalau kamu ingin melanjutkan, kamu membayar lagi saat memang membutuhkannya.",
          },
          {
            q: "Bagaimana cara pembayarannya?",
            a: "Pembayaran diproses lewat penyedia pembayaran pihak ketiga yang mendukung metode pembayaran umum di Indonesia. Splitzy tidak menyimpan detail kartu atau rekeningmu.",
          },
        ],
      },
    ],
    stillStuckHeading: "Masih belum terjawab?",
    stillStuckBody: "Kirim pertanyaanmu ke",
  },
};

// Deliberately not `as const`: the inferred type is what en.ts is checked
// against, and literal string types would demand identical wording.
export type Dictionary = typeof id;
