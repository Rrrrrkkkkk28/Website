# Az-Zikra — Website & Portal Guru

Website lembaga bimbingan belajar & mengaji **Az-Zikra**, lengkap dengan portal guru dan peta guru les terdekat (live location).

Dibuat dengan HTML, CSS, dan JavaScript murni — **tanpa build step**. Peta memakai [Leaflet](https://leafletjs.com) + OpenStreetMap (gratis, tanpa API key).

## Halaman

| File | Isi |
|---|---|
| `index.html` | Landing page: profil, program, fitur portal, kontak |
| `guru-terdekat.html` | Peta live guru les terdekat, urut jarak dari lokasi pengunjung, filter mapel, tombol WhatsApp & rute |
| `login.html` | Masuk portal guru |
| `portal.html` | Portal guru (aplikasi satu halaman) |

## Fitur portal guru

- **Dashboard** — ringkasan siswa, sesi hari ini, laporan terbaru, status rapor periode berjalan.
- **Absensi** — check-in/check-out pengajar beserta titik GPS, absensi siswa per tanggal (Hadir/Izin/Sakit/Alpa + catatan), rekap kehadiran per periode.
- **Bab Materi** — kurikulum per program (tambah, urutkan, hapus bab) dan matriks progres tiap siswa (— → Proses → Selesai).
- **Laporan berfoto** — laporan setiap sesi wajib disertai foto (maks. 4, otomatis dikompres; bisa langsung dari kamera HP), pesan untuk orang tua, kirim ringkasan ke WhatsApp orang tua.
- **Rapor 2 mingguan** — periode 14 hari otomatis; rekap kehadiran, bab selesai & jumlah laporan dihitung otomatis; nilai 6 aspek + predikat (Mumtaz/Jayyid Jiddan/Jayyid); bisa dicetak / disimpan PDF.
- **Jadwal Pengajar** — kalender mingguan per guru, total jam mengajar, deteksi bentrok jadwal.
- **Jadwal Siswa** — kalender mingguan per siswa dan ringkasan jadwal semua siswa.
- **Lokasi Saya** — guru menyalakan "Bagikan lokasi live"; posisinya langsung muncul di halaman Guru Terdekat. Koordinator dapat memantau posisi semua pengajar.
- **Data Siswa / Data Pengajar** — kelola siswa; koordinator mengelola akun guru, ekspor/impor/reset data.

## Akun demo

| Peran | Username | Kata sandi |
|---|---|---|
| Guru | `ahmad`, `siti`, `rizki`, `nur`, `hasan` | `guru123` |
| Koordinator | `admin` | `admin123` |

## Menjalankan

```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

Fitur lokasi (GPS) hanya diizinkan browser di **HTTPS** atau `localhost`. Untuk online, aktifkan **GitHub Pages** (Settings → Pages → branch) — sudah HTTPS.

## Konfigurasi

Ubah objek `CONFIG` di `assets/js/store.js`: nomor WhatsApp admin, email, alamat, titik tengah peta, tanggal awal periode rapor, dan batas waktu status "online".

## Catatan penting: penyimpanan data

Versi ini menyimpan data di **localStorage browser** agar bisa berjalan tanpa server. Artinya:

- Data hanya ada di browser/perangkat yang dipakai (gunakan Ekspor/Impor JSON di dashboard koordinator untuk memindahkan).
- Live location antar-perangkat (guru di HP, orang tua di HP lain) **membutuhkan backend**. Saat ini pembaruan live bekerja antar-tab di browser yang sama.
- Kata sandi demo tersimpan sebagai teks biasa — jangan dipakai untuk produksi.

Seluruh akses data melewati objek `Store` dan `Auth` di `assets/js/store.js`, sehingga untuk produksi cukup mengganti isi file tersebut dengan pemanggilan backend (mis. Firebase/Supabase: Auth untuk login, database realtime untuk lokasi guru, storage untuk foto laporan) tanpa mengubah halaman lain.
