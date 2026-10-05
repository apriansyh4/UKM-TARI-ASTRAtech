# STAMPTech<sup><i>plus</i></sup> · UKM TARI ASTRAtech

Ditulis **STAMPTech Plus** di teks biasa (nama file, judul tab, chat).

Sistem absensi **jam plus** untuk setiap latihan dan acara kampus.
Dibangun dengan **Next.js 14 (App Router)** + **Supabase** (Postgres, Auth, Realtime), siap di-deploy ke **Vercel** dari **GitHub**.

## Fitur

| Halaman | Akses | Isi |
|---|---|---|
| `/` (juga `/absen`) | Publik, tanpa login | Form absen mahasiswa: pilih acara → ketik NIM (data terisi otomatis) → Hadir / Tidak Hadir + keterangan |
| `/daftar` | Publik, tanpa login | Daftar mandiri mahasiswa baru (NIM, nama, prodi, semester). Muncul juga sebagai tombol "Daftar sekarang" kalau NIM belum terdaftar saat absen |
| `/login` | Publik | Login admin (Supabase Auth, email + kata sandi) |
| `/admin` | Admin | Dashboard: total jam plus, grafik per tanggal, peringkat, rekap per mahasiswa, unduh Excel |
| `/admin/absen` | Admin | Absen oleh panitia (semua tanggal), **daftar peserta per sesi: tap Hadir / Tidak tiap orang atau "Tandai sisa hadir"**, jam live, feed realtime, QR untuk dibagikan |
| `/admin/laporan` | Admin | Laporan per tanggal + pratinjau format Excel, hapus data absen. Tab **Rekap**: rekap mahasiswa per acara (hadir, tidak, belum, % kehadiran, jam), daftar mahasiswa per prodi, rekap semua mahasiswa, dan **Laporan lengkap** (Ringkasan + Semua + per prodi + per acara dalam satu Excel) |
| `/admin/acara` | Admin | CRUD acara + jadwal latihan: tanggal bebas (tidak harus berurutan, tambah satu per satu atau dari rentang + pilih hari), jam dan lokasi bisa beda tiap tanggal, buka/tutup absen |
| `/admin/mahasiswa` | Admin | CRUD mahasiswa + import CSV, filter & penanda "mandiri", QR link daftar |
| `/admin/import` | Admin | **Import massal** Mahasiswa, Acara & jadwal, dan Absensi dari Excel/CSV atau tempel dari spreadsheet. Pratinjau + cek per baris sebelum disimpan, template Excel siap pakai |

**Peserta per acara:** langsung di form **Acara baru / Ubah** (bagian *Peserta acara*, default *Hanya peserta terpilih*), atau kapan saja lewat tombol *Semua mahasiswa / N peserta* di kartu acara. Pilih **Hanya peserta terpilih**, lalu centang mahasiswa (bisa filter prodi/semester, pilih semua, atau tempel daftar NIM). Hasilnya:
- Form publik menolak NIM yang bukan peserta ("Kamu tidak terdaftar sebagai peserta acara ini").
- Admin → Absen menampilkan **daftar peserta** sesi itu; panitia cukup tap Hadir / Tidak per orang, tanpa melibatkan mahasiswa.
- Laporan & Excel memuat semua peserta (yang tidak hadir tetap muncul dengan sel kosong).
- Database ikut menjaga: absen untuk non-peserta ditolak (trigger `attendances_peserta_guard`).
Peserta juga bisa diimport massal (sheet **Peserta**: NIM, Nama Acara).

**Dua cara input mahasiswa:** (1) admin menambahkan di `/admin/mahasiswa` (satu per satu atau import CSV), (2) mahasiswa daftar sendiri di `/daftar`. Form daftar tidak bisa menimpa NIM yang sudah ada, dan data yang salah bisa diperbaiki admin.

**Prodi:** 9 program studi Politeknik Astra (disimpan sebagai kode): P4 · Teknik Pembuatan Peralatan Perkakas Produksi, TPM · Teknik Produksi dan Proses Manufaktur, MI · Manajemen Informatika, MO · Mesin Otomotif, MK · Mekatronika, TKBG · Teknologi Konstruksi Bangunan Gedung, TRPAB · Teknologi Rekayasa Pemeliharaan Alat Berat, TRL · Teknologi Rekayasa Logistik, TRPL · Teknologi Rekayasa Perangkat Lunak. Daftar ini dikunci di database (`prodi_valid`) dan di `lib/utils.js` (`PRODI`).

**Format Excel:** `No | NIM | Nama | Prodi | Semester | [01 OKT 2026 ── 15.00 - 18.00] | … | Total Jam`.
Header tanggal berisi dua baris dalam satu sel (tanggal, garis, jam). Sel berisi `3 Jam` tapi tetap angka, jadi bisa dijumlah.

**Aturan jam plus:** jam plus = durasi sesi, hanya untuk status **Hadir** dan acara yang dicentang "dihitung jam plus".

**Keamanan:** semua tabel dikunci RLS (hanya admin). Form publik hanya bisa lewat fungsi RPC:
`public_open_events`, `lookup_student` (cari 1 NIM, bukan daftar), `register_student` (daftar mandiri, tidak bisa menimpa NIM yang ada), `public_prodi_list`, dan `submit_attendance`
(hanya untuk sesi **hari ini (WIB)**, acara aktif, status & keterangan divalidasi di database).

**Semua perangkat:** layout responsif (HP, tablet, laptop, layar besar), dock navigasi bawah di HP,
safe-area iPhone, input 16px (tidak auto-zoom di iOS), mode terang/gelap, `prefers-reduced-motion`,
bisa di-*install* ke home screen (PWA manifest + ikon).

---

## Deploy (± 15 menit)

### 1. Supabase
1. Buat project baru di [supabase.com](https://supabase.com) (region **Singapore** paling dekat).
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**.
3. (Opsional) Jalankan `supabase/seed.sql` untuk data contoh.
4. **Authentication → Sign In / Providers → Email**: matikan **Allow new users to sign up** supaya orang lain tidak bisa daftar sendiri.
5. **Authentication → Users → Add user → Create new user**: isi email & kata sandi admin, centang *Auto Confirm User*.
6. Jadikan user itu admin, di SQL Editor:
   ```sql
   insert into public.admins (user_id, nama)
   select id, 'Admin Utama' from auth.users where email = 'admin@kampus.ac.id';
   ```
   Ulangi untuk admin lain.
7. **Project Settings → API**: salin **Project URL** dan **anon public key**.

### 2. GitHub
```bash
cd stamptech-plus
git init
git add .
git commit -m "STAMPTech Plus v1"
git branch -M main
git remote add origin https://github.com/<username>/stamptech-plus.git
git push -u origin main
```

### 3. Vercel
1. [vercel.com/new](https://vercel.com/new) → **Import** repo `stamptech-plus` (framework otomatis terdeteksi Next.js).
2. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
3. Klik **Deploy**.
4. Kembali ke Supabase → **Authentication → URL Configuration**: isi **Site URL** dengan domain Vercel kamu
   (mis. `https://stamptech-plus.vercel.app`) dan tambahkan `https://stamptech-plus.vercel.app/login` ke **Redirect URLs** (untuk reset kata sandi).

Selesai. Bagikan `https://domain-kamu/` (absen) dan `https://domain-kamu/daftar` (daftar mandiri) ke mahasiswa, atau tampilkan QR dari **Admin → Absen → Bagikan form**.

---

## Jalankan di komputer sendiri
```bash
cp .env.example .env.local   # isi URL & anon key
npm install
npm run dev                  # http://localhost:3000
```
Butuh Node.js 18.18+ (disarankan 20).

## Import massal (tanpa input satu per satu)
Menu **Admin → Import**, atau tombol *Import massal* di halaman Mahasiswa / *Import* di halaman Acara.

1. Pilih jenis data: **Mahasiswa**, **Acara & jadwal**, **Peserta acara**, atau **Absensi**.
2. Klik **Unduh template Excel** (berisi sheet Mahasiswa, Acara, Peserta, Absensi, dan Petunjuk), isi datanya.
3. Upload file (.xlsx / .xls / .csv), atau blok data di Excel / Google Sheets → Ctrl+C → tempel → **Cek data tempelan**.
4. Lihat pratinjau: tiap baris diberi status *Siap disimpan* atau alasan errornya. Klik **Import N data valid**; baris bermasalah dilewati.

| Jenis | Kolom | Catatan |
|---|---|---|
| Mahasiswa | NIM, Nama, Prodi, Semester | NIM yang sudah ada diperbarui. Prodi pakai kode (TRPL, TPM, …) atau nama lengkap |
| Acara & jadwal | Nama Acara, Jenis*, Lokasi*, Tanggal, Jam Mulai, Jam Selesai | 1 baris = 1 sesi (tanggal bebas, tidak harus berurutan). Lokasi berlaku untuk tanggal itu. Nama acara sama → digabung. Tanggal yang sudah ada → jam & lokasinya diubah |
| Peserta acara | NIM, Nama Acara | Acara otomatis jadi "hanya peserta terpilih". Import ulang aman |
| Absensi | NIM, Nama Acara, Tanggal, Status, Keterangan* | Acara & sesi harus sudah ada. Status: Hadir / Tidak Hadir (Izin & Sakit = Tidak Hadir) |

\* opsional. Format yang dikenali: tanggal `2026-10-20`, `20/10/2026`, `20 Okt 2026`; jam `15:00`, `15.00`, `3 PM`.
Otomatis dirapikan: angka 0 di depan NIM yang hilang karena Excel, nama huruf kapital/kecil semua, kode prodi lama TPPM → TPM.
Import ulang file yang sama aman: data diperbarui, tidak dobel.

## Struktur
```
app/
  page.js, absen/            form publik absen mahasiswa
  daftar/                    form publik daftar mandiri
  login/                     login admin
  admin/                     dashboard, absen, laporan, acara, mahasiswa (dilindungi middleware + cek tabel admins)
components/                  UI (form absen, kartu ID, modal, toast, background aurora, ikon)
components/admin/            halaman admin + DataProvider (data + realtime)
lib/                         supabase client/server, helper tanggal WIB, export Excel
supabase/schema.sql          tabel, RLS, RPC publik, view laporan, realtime
supabase/seed.sql            data contoh (opsional)
middleware.js                refresh sesi & proteksi /admin
```

## Catatan
- Semua waktu memakai **WIB (Asia/Jakarta)**, baik di database maupun di aplikasi.
- Menghapus acara/sesi/mahasiswa ikut menghapus data absennya (ada konfirmasi 2 langkah di aplikasi).
- Mengubah NIM mahasiswa otomatis memindahkan data absennya (`on update cascade`).
- Realtime feed membutuhkan tabel `attendances` di publikasi `supabase_realtime` (sudah diatur oleh `schema.sql`).

## Update dari versi sebelumnya
Kalau database sudah pernah dibuat dengan `schema.sql` versi lama, cukup jalankan ulang seluruh `supabase/schema.sql` terbaru. File ini aman dijalankan ulang dan akan menambahkan kolom baru (mis. `registered_via` di students, `lokasi` per tanggal di sessions, `peserta_only` + tabel `event_participants`) serta fungsi terbaru tanpa menghapus data.
