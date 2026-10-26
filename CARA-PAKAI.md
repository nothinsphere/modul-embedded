# Web Interaktif: Modul Embedded C/C++ (SMK Kelas XI)

Web ini dibuat dari "Modul Ajar Pemrograman Embedded C/C++ Berbasis Smartphone". Isinya:

- Materi Bab 1–6 dengan widget interaktif (IPO, flowchart bergerak, lab operator, visualisasi if/switch/for, PWM, ADC, dll.)
- **Compiler C/C++ di browser**: input `scanf`/`cin` interaktif, pesan error format GCC + petunjuk berbahasa Indonesia, dan mode langkah demi langkah dengan tabel variabel.
- **Simulator Arduino Uno**: LED, tombol, potensiometer, LDR, NTC, buzzer, HC-SR04, Serial Monitor, dan plotter.
- Asesmen: kuis pilihan ganda, tebak output, cari kesalahan (dinilai otomatis), dan kalkulator rubrik mini proyek.

## Link website

- Website untuk siswa: https://nothinsphere.github.io/modul-embedded/
- Repositori GitHub: https://github.com/nothinsphere/modul-embedded

Untuk memperbarui website setelah mengubah file, jalankan di folder ini: `git add -A`, `git commit -m "pesan perubahan"`, lalu `git push`. Bisa juga dengan **Add file → Upload files** di halaman repositori. Website ikut berubah sekitar 1 menit kemudian.

## Cara membuka

- Di laptop/PC: klik dua kali `index.html`.
- Untuk siswa (HP): unggah **seluruh folder** `modul-embedded` ke hosting gratis, lalu bagikan link-nya di grup kelas. Contoh paling mudah: buka https://app.netlify.com/drop lalu seret folder ini ke sana. GitHub Pages juga bisa.

Web ini bisa dipakai **tanpa internet sama sekali**: compiler (`assets/minic.js`), simulator (`assets/sim.js`), dan editor berwarna CodeMirror (`assets/vendor/codemirror/`) semuanya ada di dalam folder. Satu-satunya yang diambil dari internet adalah font; bila offline, tampilan otomatis memakai font bawaan HP/laptop tanpa mengganggu fungsi apa pun. Pastikan seluruh folder ikut disalin, termasuk subfolder `assets`.

## Catatan

- Kemajuan (centang pertemuan), jawaban kuis, dan kode terakhir tersimpan di browser masing-masing siswa, tidak dikirim ke mana pun.
- Compiler di web ini adalah interpreter ringan untuk materi kelas XI. Yang belum didukung: pointer, `struct`/`class`, parameter referensi `&`, dan macro berparameter. Untuk itu gunakan OnlineGDB/Cxxdroid.
- Simulator meniru perilaku Arduino Uno: `int` 16 bit, `double` = `float`, pin mengambang tanpa pull-up, peringatan bila lupa `pinMode` atau `Serial.begin`. Untuk library tambahan (LCD, DHT22, Servo) gunakan Wokwi.

## Mengubah isi

- Contoh kode dan sketch Arduino: `assets/examples.js`
- Teks materi: `index.html`
- Soal kuis, tebak output, cari kesalahan: bagian "Asesmen" di `assets/app.js`
