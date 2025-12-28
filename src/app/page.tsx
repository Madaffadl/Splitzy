import Link from "next/link";
import { Receipt, Plane, ArrowRight, Sparkles, Calculator, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b glass sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Calculator className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Splitzy</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Split tagihan dengan mudah!
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className="gradient-text">Split Tagihan</span> Bareng Teman
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Makan bareng atau liburan, hitung siapa yang harus bayar berapa
            dengan transaksi seminimal mungkin.
          </p>

          {/* Mode Selection */}
          <div className="grid md:grid-cols-2 gap-4 pt-8">
            <Link
              href="/single"
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 text-left transition-all hover:shadow-lg hover:border-primary/50"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Receipt className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Satu Struk</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Split tagihan makan bareng atau pengeluaran bersama lainnya.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  Mulai Split
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link
              href="/trip"
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 text-left transition-all hover:shadow-lg hover:border-primary/50"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Plane className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Mode Trip</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Track banyak struk dengan pembayar berbeda selama liburan.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  Mulai Trip
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 border-t">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Cara Kerja</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Tambah Peserta</h3>
              <p className="text-sm text-muted-foreground">
                Masukkan nama semua orang yang patungan
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Masukkan Item</h3>
              <p className="text-sm text-muted-foreground">
                Foto struk atau tambah item manual
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Lihat Hasil</h3>
              <p className="text-sm text-muted-foreground">
                Lihat siapa bayar berapa dengan transaksi minimal
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-4 border-t text-center text-sm text-muted-foreground">
        <p>Splitzy • Data tersimpan lokal di browser kamu</p>
      </footer>
    </main>
  );
}
