# Japan Salary Calculator · 日本給与計算

Aplikasi web mobile-first, Bahasa Indonesia/Jepang, untuk mencatat kerja dan menghitung **estimasi** gaji Jepang. Implementasi nyata tanpa dependensi runtime, tanpa build, tanpa akun. Semua data gaji berada di LocalStorage browser; server hanya menyajikan file statis.

## Menjalankan

Butuh Node.js 20+ (pengujian menggunakan Node 22).

```sh
cd japan-salary-calculator
npm start
```

Buka **http://127.0.0.1:4173**. Tidak perlu `npm install`. Port lain: `PORT=4174 npm start` (Linux/macOS). Jangan membuka `index.html` melalui `file://`, karena ES modules dan service worker membutuhkan HTTP(S).

```sh
npm test
npm run check
```

Untuk melihat output tiap test secara langsung: `node tests/engine.test.mjs`.

Hosting statis: unggah isi folder `dist/` ke hosting HTTPS, dengan MIME JavaScript/CSS yang benar. Aplikasi menggunakan path relatif dan bisa dijalankan dalam subfolder. `.openai/hosting.json` adalah konfigurasi deployment Sites untuk proyek ini; buat identitas Sites baru jika membuat proyek hosting terpisah.

## Mulai menggunakan

1. Selesaikan tujuh langkah onboarding: bahasa, metode, nominal, jam perusahaan, tutup periode, tanggal bayar, preset.
2. Lengkapi profil, pembagi gaji bulanan, dan aturan di **Pengaturan**.
3. Tekan **Tambah**; masukkan shift dan satu/beberapa rentang istirahat. Jam pulang yang lebih kecil otomatis dianggap esok hari.
4. Periksa jenis hari setelah tengah malam. Sabtu/Minggu tidak otomatis mendapat premium; hanya `法定休日` mendapat premium hari libur.
5. Tambahkan tunjangan, transport, dan potongan di halaman **Gaji**.
6. Lihat slip; **Cetak / Simpan PDF** membuka dialog cetak browser. Pilih tujuan **Save as PDF / Simpan sebagai PDF**. CSV bisa diunduh langsung.
7. **Pengaturan → Aplikasi & backup → Export JSON** untuk backup. Import memvalidasi seluruh data lalu meminta konfirmasi penggantian. Reset dan penghapusan meminta konfirmasi.
8. Data contoh tersedia di menu yang sama atau import `examples/demo-2026-10.json`. Ini data fiktif dan tidak diisi otomatis pada instalasi baru.

## Fitur tersedia

- Gaji per jam / bulanan / harian, formulir simpan–edit–hapus, catatan, cuti dibayar, cuti khusus dengan opsi dibayar, tidak masuk.
- Lembur perusahaan (法定内), statutory harian/mingguan (法定外), malam, libur statutory, premium >60 jam; company override.
- Perhitungan menit, shift lintas tengah malam, beberapa istirahat, validasi waktu, penolakan shift bertumpuk dan tanggal duplikat.
- Periode lintas bulan/tahun, tutup akhir bulan atau hari custom, tanggal gajian, pembatasan tanggal sesuai jumlah hari bulan.
- Dashboard data asli, kalender/bottom sheet, slip, gross/net, tunjangan bulanan/harian/per jam/sekali bayar, potongan manual, perbandingan slip, riwayat dan grafik enam periode.
- Bahasa Indonesia/Jepang, light/dark/system, navigasi bawah mobile, indikator dan formulir aksesibel.
- LocalStorage schema v1, JSON import/export, CSV aman dari formula injection, print/PDF melalui browser.
- Manifest, ikon 192/512, service worker untuk fallback offline setelah kunjungan online berhasil. Pemasangan Android/iOS tergantung browser. Data tetap lokal; backup dibutuhkan sebelum menghapus data browser.

## Struktur folder

```text
japan-salary-calculator/
├── README.md
├── VALIDATION.md
├── package.json              # start / test / check
├── server.mjs                # server statis lokal
├── .openai/hosting.json      # hosting statis Sites
├── examples/
│   └── demo-2026-10.json
├── tests/
│   └── engine.test.mjs       # node:test + assert, tanpa framework eksternal
└── dist/
    ├── index.html
    ├── styles.css            # responsive, light/dark, print
    ├── app.js                # halaman, komponen UI, events, bilingual labels
    ├── storage.js            # schema validation, persistence, backup, CSV
    ├── models.d.ts           # kontrak data TypeScript
    ├── demo.js               # generator data contoh
    ├── manifest.webmanifest
    ├── sw.js
    ├── icon.svg
    ├── icon-192.png
    ├── icon-512.png
    └── engine/
        ├── settings.js
        ├── timeCalculator.js
        ├── overtimeCalculator.js
        ├── payPeriodCalculator.js
        ├── allowanceCalculator.js
        ├── deductionCalculator.js
        └── salaryEngine.js
```

Halaman di `app.js`: `renderOnboarding`, `dashboard`, `workPage`, `calendarPage`, `salaryPage`, `settingsPage`. Komponen: `heading`, `periodControl`, `workRows`, `breakdown`, `slip`, `chart`, `moneyList`, `history`, `comparison`, `detail`, `editEntry`, `moneyForm`, serta helper form. Rumus payroll berada di `engine/`, tidak di komponen UI. File `models.d.ts` adalah dokumentasi tipe untuk integrasi mendatang; aplikasi dijalankan sebagai JavaScript ES modules.

## Aturan dan asumsi perhitungan

### Satuan dan klasifikasi

Semua waktu dihitung sebagai menit integer dengan interval `[mulai, selesai)`. Tanggal diperlakukan sebagai tanggal kalender Jepang tanpa konversi zona waktu browser; tanggal hari ini memakai `Asia/Tokyo`. Pemakaian UTC pada utility tanggal hanya untuk aritmetika kalender agar bebas DST.

`normal + 法定内 + 法定外 + holiday = workedMinutes`. `nightMinutes` merupakan subset yang dapat tumpang tindih dengan kategori tersebut, bukan jam tambahan. Mingguan dan >60 adalah subset 法定外, bukan kategori yang dijumlahkan kembali.

Setiap menit kerja non-holiday dinilai terhadap batas harian. Menit yang telah menjadi lembur harian tidak dimasukkan ke akumulator jam biasa mingguan. Sisa jam di atas batas mingguan menjadi lembur mingguan. Hari libur statutory dan cuti tidak masuk akumulator mingguan/60 jam. Catatan sebelum awal periode tetap diperhitungkan untuk konteks minggu lintas periode.

Akumulasi premium tinggi memakai `over60ClosingDay` (default sama dengan cutoff awal 20) yang dapat diatur terpisah. Ambang default 3.600 menit; hanya bagian setelah ambang dikenai +50%. Mengubah cutoff gaji pada Settings tidak otomatis mengganti cutoff 60 jam; periksa keduanya.

Continuous shift menggunakan tanggal mulai untuk batas harian dan alokasi periode gaji/akumulasi 60 jam. Akumulator minggu menggunakan tanggal kalender setiap menit. Holiday memakai jenis hari tanggal mulai dan `nextDayType` setelah pukul 00:00. Satu catatan per tanggal mulai, maksimal 24 jam. Untuk split shift, waktu antara sesi bisa dimasukkan sebagai break.

### Premium dan base

- Per jam: jam normal × tarif, 法定内 × (1 + withinPremium), 法定外 × (1 + overtimePremium atau over60HoursPremium), holiday × (1 + holidayPremium).
- Malam selalu tambahan `nightPremium × tarif × jam malam`. Jadi lembur + malam default 1,50× dan holiday + malam 1,60×, bukan perkalian multiplier.
- Bulanan: fixed base penuh + jam di luar jadwal + premium. Tarif dasar = monthlySalary / (monthlyScheduledMinutes / 60). Untuk lembur mingguan yang masih tercakup jam jadwal, hanya premiumnya ditambahkan karena base sudah dibayar. **Tidak ada proration atau potongan absen otomatis.** Input potongan manual. Tarif bisa perlu penyesuaian untuk komponen upah yang masuk dasar lembur menurut perusahaan.
- Harian: fixed dailySalary untuk hari yang memiliki kerja non-holiday, lalu tambahan di luar jadwal. Shift pendek tidak otomatis mengurangi gaji harian. Holiday dibayar penuh per jam berdasarkan dailySalary / jam jadwal, termasuk bila shift melintasi hari normal/holiday. Sesuaikan bila kontrak perusahaan menggunakan metode lain.
- Cuti dibayar memakai jam jadwal × tarif untuk hourly, tarif harian untuk daily, dan tercakup fixed base untuk monthly. Tidak dianggap attendance day untuk transport. Cuti khusus dibayar hanya jika checkbox dipilih.
- Tunjangan per hari menggunakan jumlah hari masuk (tanggal mulai), per jam menggunakan seluruh jam kerja efektif. Nilai kosong pada periode berarti berulang; `once` wajib memiliki bulan penutupan tertentu.
- Potongan nominal manual, tanpa kalkulasi pajak/asuransi otomatis. Gross = pendapatan + tunjangan. Net = gross − potongan.
- Pembulatan ke yen terdekat pada gross dan total deduction. Rincian UI dibulatkan untuk tampilan, sehingga penjumlahan komponen tampilan kadang berbeda ¥1. CSV menyertakan komponen tanpa pembulatan untuk audit.

### Istirahat

Mode rentang waktu mengurangi menit yang benar, termasuk break malam dan lintas tengah malam. Break bertumpuk, di luar shift, negatif, atau sepanjang shift ditolak. **Mode sederhana secara eksplisit mengasumsikan break di tengah shift**; ini estimasi. Pilih rentang untuk hasil malam yang akurat.

### Riwayat dan mode

Riwayat dihitung ulang dari catatan memakai setting saat ini; belum berupa snapshot payroll final. Simpan backup JSON sebelum perubahan tarif untuk mempertahankan versi lama. Grafik hanya menampilkan nominal pada periode yang memiliki catatan; periode tanpa catatan ditandai “—”. Dashboard dan slip bulanan tetap menampilkan fixed base sesuai pengaturan; ini bukan bukti penerimaan gaji. Simple Mode menyederhanakan rincian tampilan, dengan engine yang sama agar hasil tidak berubah saat beralih mode.

### Batas MVP

Belum mencakup account/login aplikasi, database server, cloud sync, multi-company, sistem variable/flex, みなし残業/fixed overtime, perhitungan pajak otomatis, pembulatan khusus tiap perusahaan, prorata otomatis, maupun pergeseran tanggal bayar karena libur bank. Ini fitur lanjutan; tidak ada tombol placeholder untuk fitur tersebut. Hosting privat Sites memiliki kontrol akses hosting sendiri, terpisah dari akun aplikasi.

PDF melalui dialog cetak browser, bukan file yang otomatis diunduh. PWA pada hosting yang menggunakan gerbang autentikasi dapat bergantung pada sesi dan kebijakan browser; uji pemasangan pada perangkat target. Deployment HTTPS statis mandiri juga didukung.

Preset merupakan estimasi sistem kerja standar; perubahan angka batas saja tidak memodelkan seluruh sistem jam kerja yang berbeda. Aplikasi tidak menyimpulkan pelanggaran berdasarkan selisih slip.

## Referensi preset

Diperiksa pada 9 Oktober 2026:

- [MHLW — 労働条件・職場環境に関するルール](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudouseisaku/chushoukigyou/joken_kankyou_rule.html)
- [MHLW — 労働時間・休日](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/roudouzikan/index.html)
- [MHLW — Rules that apply when working](https://www.mhlw.go.jp/content/001558816.pdf)

Hasil aplikasi bukan pengganti kontrak, aturan perusahaan, atau slip resmi.
