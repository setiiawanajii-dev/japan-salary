# Validasi MVP

Tanggal: 9 Oktober 2026. Runtime Node.js 22.22.1.

## Otomatis

`npm run check` lulus: pemeriksaan sintaks UI dan **30 test**, 0 gagal.

Cakupan test:

- Pemisahan normal, 法定内, 法定外; tarif 法定内 default 1,00×.
- Shift melewati tengah malam; batas 22:00 dan 05:00.
- Break malam, break lintas tengah malam, banyak break, validasi overlap dan durasi.
- Premium lembur + malam dan holiday + malam secara aditif.
- Perubahan holiday setelah tengah malam.
- 65 jam lembur: 60 jam pada 1,25× dan hanya 5 jam pada 1,50×.
- Mingguan tanpa double counting, konteks sebelum periode, holiday/cuti dikecualikan.
- Cutoff tanggal 20/15, lintas tahun, Februari dan tahun kabisat.
- Gaji bulanan, pembagi jam, tambahan premium yang base-nya sudah dibayar.
- Gaji harian, company override, allowances, deductions dan net.
- Akumulasi >60 dengan cutoff tersendiri.
- Konservasi total menit dan subset overtime.
- LocalStorage roundtrip, JSON backup roundtrip, penolakan backup rusak/duplikat/overlap.
- Pencegahan formula injection pada CSV.

## Browser (Codex in-app browser)

Diperiksa melalui interaksi UI nyata:

- Onboarding tujuh langkah hingga dashboard.
- Tambah shift 08:00–19:30, break 12:00–13:00: 10:30 kerja, 2:30 statutory, estimasi ¥14.463.
- Refresh mempertahankan catatan dan hasil.
- Edit menjadi 20:00–05:00 dengan break 00:00–01:00: 8:00 kerja, 6:00 malam, estimasi ¥12.350.
- Tunjangan transport ¥500 per hari memperbarui total.
- Bahasa Indonesia/Jepang dan tema terang/sistem gelap.
- Dialog detail, konfirmasi dalam aplikasi, penghapusan catatan memperbarui jumlah hari dan gaji.
- Muat data contoh melalui konfirmasi: 22 hari, 193 jam, net ¥255.225.
- Tampilan responsive pada viewport 390×844 dan 1280×900.
- Tidak ada error console pada pemeriksaan setelah interaksi.

Dialog konfirmasi bawaan browser sempat membuat alat uji tertahan. Implementasi final memakai dialog konfirmasi HTML di dalam aplikasi dan telah berhasil diuji.

## Batas verifikasi

Pemasangan ke home screen pada perangkat Android/iOS fisik, skenario jaringan benar-benar offline, pembukaan kembali PWA setelah proses browser ditutup, dan dialog cetak/Save as PDF native belum diuji pada perangkat fisik. Manifest/service worker/ikon dan stylesheet print tersedia. Mekanisme backup divalidasi oleh unit test; upload file JSON melalui pemilih file OS belum diuji end-to-end.

Hasil perhitungan ini adalah estimasi sistem standar. Lihat README untuk asumsi fixed monthly/daily pay, istirahat sederhana, cutoff 60 jam, dan sistem kerja yang belum dimodelkan.
