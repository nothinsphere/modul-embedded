# Web Interaktif: Modul Embedded C/C++ (SMK Kelas XI)

Web ini dibuat dari "Modul Ajar Pemrograman Embedded C/C++ Berbasis Smartphone". Isinya:

- Materi Bab 1–6 dengan widget interaktif (IPO, flowchart bergerak, lab operator, visualisasi if/switch/for, PWM, ADC, dll.)
- **Compiler C/C++ di browser** (interpreter pembelajaran, bukan GCC): input `scanf`/`cin` interaktif, pesan error format GCC + petunjuk berbahasa Indonesia, mode langkah demi langkah, serta unduh/buka file `.c` dan `.cpp`.
- **Simulator Arduino Uno** (perilaku disederhanakan): LED, tombol, potensiometer, LDR, NTC, buzzer, HC-SR04, Serial Monitor, plotter, serta unduh/buka proyek `.ino` lengkap dengan konfigurasi komponennya.
- Peta 16 pertemuan dengan tujuan, kegiatan, bukti kerja, kriteria keberhasilan, dan tindak lanjut per pertemuan.
- Asesmen dalam tab: kuis, tebak output (dengan petunjuk bertahap), debugging, sumatif 1, dan rubrik mini proyek (mode simulator atau Wokwi/board fisik).

## Link website

- Website untuk siswa: https://nothinsphere.github.io/modul-embedded/
- Repositori GitHub: https://github.com/nothinsphere/modul-embedded

Untuk memperbarui website setelah mengubah file, jalankan di folder ini: `git add -A`, `git commit -m "pesan perubahan"`, lalu `git push`. Bisa juga dengan **Add file → Upload files** di halaman repositori. Website ikut berubah sekitar 1 menit kemudian.

Setiap kali mengubah file di folder `assets`, naikkan juga angka versinya: `?v=…` di bagian bawah `index.html` dan `CACHE` di baris atas `sw.js`. Tanpa itu, HP siswa bisa tetap memakai salinan lama yang tersimpan untuk mode offline.

## Cara membuka

- Untuk siswa (HP): bagikan link website di atas. Membuka file `index.html` langsung dari pengelola file di HP Android sering gagal.
- Di laptop/PC: klik dua kali `index.html`, atau buka link website.

## Memakai tanpa internet (sudah diuji)

| Situasi | Hasil |
|---|---|
| Halaman sudah terbuka, lalu internet putus | Semua fitur tetap jalan: materi, compiler, simulator, kuis, unduh/buka file. |
| Membuka ulang link website tanpa internet | Bisa, asalkan web pernah dibuka sekali dengan internet di browser yang sama (bukan mode penyamaran). Salinan disimpan oleh *service worker*. Jika data situs dihapus, buka sekali lagi saat online. |
| Membuka `index.html` dari folder laptop | Tidak butuh internet; font berganti ke font bawaan. Mode simpan offline tidak dipakai di sini karena tidak diperlukan. |
| Tautan bertanda ↗ (Wokwi, OnlineGDB, Programiz, dokumentasi) | Selalu butuh internet. Saat offline muncul pemberitahuan di bagian atas halaman. |

Status penyimpanan offline di browser yang sedang dipakai terlihat di halaman **Persiapan aplikasi → Memakai web ini tanpa internet**.

## Mengumpulkan pekerjaan

- Compiler: isi nama file di atas editor (misal `p04_budi_luas`), lalu tekan **Unduh**. Ekstensi `.c`/`.cpp` dipasang otomatis.
- Simulator: tekan **Unduh proyek**. File `.ino` berisi kode dan, di komentar penutup, daftar komponen beserta pinnya. Guru membukanya lewat **Buka file** di simulator. File yang sama tetap bisa dibuka di Arduino IDE atau Wokwi.

## Catatan

- Kemajuan (centang pertemuan), jawaban kuis, dan kode terakhir tersimpan di browser masing-masing siswa, tidak dikirim ke mana pun.
- Rumusan CP di halaman Identitas adalah ringkasan pengembang; dokumen acuannya disebutkan di sana. Cocokkan dengan dokumen CP yang berlaku di sekolah.
- Keterangan lengkap fitur dan batasan compiler serta simulator ada di bagian atas halaman masing-masing.

## Mengubah isi

- Contoh kode dan sketch Arduino: `assets/examples.js`
- Teks materi: `index.html`
- Rincian 16 pertemuan, soal kuis, tebak output, debugging, rubrik: `assets/app.js`
