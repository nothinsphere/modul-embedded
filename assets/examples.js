/* Contoh kode dari modul ajar. Mode 'console' = compiler C/C++, mode 'arduino' = simulator.
 * parts = komponen yang dipasang di simulator (pin 14-19 = A0-A5). */
window.EXAMPLES = {
  /* ------------------------------ Bab 2 ------------------------------ */
  'b2-hello': {
    title: 'Program pertama', lang: 'c', code: String.raw`#include <stdio.h>   // memanggil pustaka input-output

int main() {         // program selalu mulai dari main
    printf("Halo, saya siswa Teknik Elektronika!\n");
    return 0;        // program selesai dengan normal
}`
  },
  'b2-biodata': {
    title: 'Latihan 2.1: biodata', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    // Ganti teks di dalam tanda kutip dengan data kamu
    printf("Nama      : Budi Santoso\n");
    printf("Kelas     : XI TE 1\n");
    printf("Cita-cita : Teknisi robotika\n");
    return 0;
}`
  },
  'b2-arus': {
    title: 'Variabel: menghitung arus', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float tegangan = 12.0;
    float resistansi = 220.0;
    float arus = tegangan / resistansi;
    printf("Arus = %.3f ampere\n", arus);
    return 0;
}`
  },
  'b2-tipe': {
    title: 'Tiga tipe data dasar', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int jumlahLED = 3;
    float tegangan = 4.5;
    char warna = 'M';

    printf("Jumlah LED : %d\n", jumlahLED);
    printf("Tegangan   : %f volt\n", tegangan);
    printf("Tegangan   : %.1f volt (1 angka desimal)\n", tegangan);
    printf("Kode warna : %c\n", warna);
    return 0;
}`
  },
  'b2-scanf': {
    title: 'Input dengan scanf: luas PCB', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float p, l;
    printf("Masukkan panjang PCB (cm): ");
    scanf("%f", &p);
    printf("Masukkan lebar PCB (cm): ");
    scanf("%f", &l);
    printf("Luas PCB = %.2f cm2\n", p * l);
    return 0;
}`
  },
  'b2-operator': {
    title: 'Operator', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int a = 10, b = 4;
    printf("10 / 4 (int)   = %d\n", a / b);
    printf("10 / 4.0       = %.1f\n", a / 4.0);
    printf("10 %% 4        = %d\n", a % b);
    printf("5 > 3          = %d\n", 5 > 3);
    printf("(5>3) && (2>4) = %d\n", (5 > 3) && (2 > 4));
    a++;
    printf("setelah a++, a = %d\n", a);
    return 0;
}`
  },
  'b2-bagi': {
    title: 'Tipe operand menentukan hasil bagi', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int a = 10, b = 4;
    float x1 = 10 / 4;        // int / int     -> 2, lalu disimpan 2.0
    float x2 = 10.0 / 4;      // desimal / int -> 2.5
    float x3 = (float)a / b;  // a diubah ke float dulu -> 2.5
    int   y  = 10.0 / 4;      // 2.5 dipotong saat disimpan ke int -> 2

    printf("float x1 = 10 / 4;       -> %.1f\n", x1);
    printf("float x2 = 10.0 / 4;     -> %.1f\n", x2);
    printf("float x3 = (float)a / b; -> %.1f\n", x3);
    printf("int   y  = 10.0 / 4;     -> %d\n", y);
    return 0;
}`
  },
  'b2-tugas-ohm': {
    title: 'Tugas 2.1: kalkulator hukum Ohm', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float v, r, i, p;
    printf("Tegangan (V): ");
    scanf("%f", &v);
    printf("Resistansi (ohm): ");
    scanf("%f", &r);

    // TODO: hitung arus i = v / r
    // TODO: hitung daya p = v * i

    printf("Arus  = %.3f A\n", i);
    printf("Daya  = %.3f W\n", p);
    return 0;
}`
  },
  'b2-tugas-seri': {
    title: 'Tugas 2.2: resistor seri', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float r1, r2, r3;
    printf("R1 R2 R3 (pisahkan dengan spasi): ");
    scanf("%f %f %f", &r1, &r2, &r3);

    // TODO: buat variabel rTotal lalu tampilkan hasilnya

    return 0;
}`
  },
  'b2-tugas-rled': {
    title: 'Tugas 2.3: resistor untuk LED', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float vs, vled, i_mA;
    printf("Tegangan sumber (V): ");
    scanf("%f", &vs);
    printf("Tegangan LED (V): ");
    scanf("%f", &vled);
    printf("Arus LED (mA): ");
    scanf("%f", &i_mA);

    // Rumus memakai arus dalam AMPERE: I (A) = i_mA / 1000.0  (20 mA = 0.02 A)
    // TODO: hitung R = (vs - vled) / (i_mA / 1000.0), hasilnya dalam ohm
    // TODO: tampilkan R, misalnya: printf("R = %.0f ohm\n", R);
    // Data uji: 5 V, 2 V, 20 mA  ->  R = 150 ohm

    return 0;
}`
  },

  /* ------------------------------ Bab 3 ------------------------------ */
  'b3-if': {
    title: 'if dan else: kipas otomatis', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int suhu;
    printf("Masukkan suhu ruangan: ");
    scanf("%d", &suhu);
    if (suhu > 30) {
        printf("Kipas: NYALA\n");
    } else if (suhu > 25) {
        printf("Kipas: PELAN\n");
    } else {
        printf("Kipas: MATI\n");
    }
    return 0;
}`
  },
  'b3-switch': {
    title: 'switch: warna pita resistor', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int pita;
    printf("Angka pita resistor (0-3): ");
    scanf("%d", &pita);
    switch (pita) {
        case 0: printf("Hitam\n");  break;
        case 1: printf("Coklat\n"); break;
        case 2: printf("Merah\n");  break;
        case 3: printf("Oranye\n"); break;
        default: printf("Di luar pilihan\n");
    }
    return 0;
}`
  },
  'b3-for': {
    title: 'Perulangan for', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    for (int i = 1; i <= 5; i++) {
        printf("LED ke-%d menyala\n", i);
    }
    return 0;
}`
  },
  'b3-while': {
    title: 'Perulangan while: hitung mundur', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int hitung = 10;
    while (hitung > 0) {
        printf("%d...\n", hitung);
        hitung--;
    }
    printf("Roket meluncur!\n");
    return 0;
}`
  },
  'b3-tugas-baterai': {
    title: 'Tugas 3.1: status baterai', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int persen;
    printf("Persen baterai: ");
    scanf("%d", &persen);

    // TODO: >= 80 tampilkan "Penuh", 30 sampai 79 "Sedang", < 30 "Lemah"

    return 0;
}`
  },
  'b3-tugas-lampu': {
    title: 'Tugas 3.2: lampu lalu lintas (switch)', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int pilih;
    // Urutan nyala: 1 = merah 5 detik, 2 = hijau 5 detik, 3 = kuning 2 detik
    printf("Pilih lampu (1/2/3): ");
    scanf("%d", &pilih);

    switch (pilih) {
        case 1: printf("Merah, menyala 5 detik\n"); break;
        // TODO: lengkapi case 2 (Hijau, 5 detik) dan case 3 (Kuning, 2 detik)
        default: printf("Pilihan tidak ada\n");
    }
    return 0;
}`
  },
  'b3-tugas-tabel': {
    title: 'Tugas 3.3: tabel arus (for)', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float v = 5.0;
    printf("R (ohm)   I (mA)\n");
    // TODO: ubah batas dan langkah perulangan agar R = 100, 200, ..., 1000
    for (int r = 100; r <= 300; r += 100) {
        printf("%5d     %.1f\n", r, v / r * 1000);
    }
    return 0;
}`
  },
  'b3-tugas-password': {
    title: 'Tugas 3.4: password (while)', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    int kode = 0;
    // TODO: ulangi selama kode belum sama dengan 1234
    while (kode != 1234) {
        printf("Masukkan password: ");
        scanf("%d", &kode);
    }
    printf("Akses diterima!\n");
    return 0;
}`
  },

  /* ------------------------------ Bab 4 ------------------------------ */
  'b4-fungsi': {
    title: 'Fungsi: hitung daya', lang: 'c', code: String.raw`#include <stdio.h>

// membuat fungsi: tipe_hasil nama(parameter)
float hitungDaya(float v, float i) {
    return v * i;
}

int main() {
    float p = hitungDaya(12.0, 0.5);
    printf("Daya = %.2f watt\n", p);
    printf("Daya lampu 220V 0.2A = %.2f watt\n", hitungDaya(220, 0.2));
    return 0;
}`
  },
  'b4-array': {
    title: 'Array: rata-rata suhu', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float suhu[5] = {28.5, 29.0, 30.2, 31.1, 29.8};
    float total = 0;
    for (int i = 0; i < 5; i++) {
        printf("Data ke-%d: %.1f\n", i, suhu[i]);
        total += suhu[i];
    }
    printf("Rata-rata suhu = %.2f\n", total / 5);
    return 0;
}`
  },
  'b4-c': {
    title: 'Versi C: hitung arus', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float v, r;
    printf("Tegangan: "); scanf("%f", &v);
    printf("Resistansi: "); scanf("%f", &r);
    printf("Arus = %g A\n", v / r);
    return 0;
}`
  },
  'b4-cpp': {
    title: 'Versi C++: hitung arus', lang: 'cpp', code: String.raw`#include <iostream>
using namespace std;

int main() {
    float v, r;
    cout << "Tegangan: "; cin >> v;
    cout << "Resistansi: "; cin >> r;
    cout << "Arus = " << v / r << " A" << endl;
    return 0;
}`
  },
  'b4-tugas-rled': {
    title: 'Tugas 4.1: fungsi hitungRLED', lang: 'c', code: String.raw`#include <stdio.h>

// TODO: lengkapi isi fungsi. Arus i_mA dalam miliampere:
// ubah ke ampere dengan i_mA / 1000.0, hasil R dalam ohm.
float hitungRLED(float vs, float vled, float i_mA) {
    return 0;
}

int main() {
    printf("LED merah 5V, 2V, 20mA -> R = %.0f ohm\n", hitungRLED(5, 2, 20));   // harus 150
    printf("LED biru  5V, 3V, 20mA -> R = %.0f ohm\n", hitungRLED(5, 3, 20));   // harus 100
    return 0;
}`
  },
  'b4-tugas-minmax': {
    title: 'Tugas 4.2: tegangan tertinggi & terendah', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float baterai[6] = {3.7, 3.9, 3.4, 4.1, 3.6, 3.8};
    float maks = baterai[0];
    float min = baterai[0];

    for (int i = 1; i < 6; i++) {
        // TODO: perbarui maks dan min
    }

    printf("Tertinggi = %.1f V\n", maks);
    printf("Terendah  = %.1f V\n", min);
    return 0;
}`
  },
  'b4-tugas-ohm-cpp': {
    title: 'Tugas 4.3: hukum Ohm versi C++', lang: 'cpp', code: String.raw`#include <iostream>
using namespace std;

int main() {
    float v, r;
    // TODO: gunakan cout untuk pertanyaan dan cin untuk input
    // lalu tampilkan arus dan daya

    return 0;
}`
  },
  'sumatif-praktik': {
    title: 'Soal praktik sumatif 1', lang: 'c', code: String.raw`#include <stdio.h>

int main() {
    float v, r, i;
    printf("Tegangan (V): ");
    scanf("%f", &v);
    printf("Resistansi (ohm): ");
    scanf("%f", &r);
    i = v / r;
    printf("Arus = %.3f A\n", i);
    // TODO: jika arus > 0.5 tampilkan "Arus berlebih"

    return 0;
}`
  },

  /* ------------------------------ Bab 5 (Arduino) ------------------------------ */
  'ard-blink': {
    title: 'Praktik 1: LED berkedip (Blink)', mode: 'arduino',
    parts: [{ type: 'led', pin: 13, color: 'merah' }],
    code: String.raw`void setup() {
  pinMode(13, OUTPUT);      // pin 13 sebagai output
}

void loop() {
  digitalWrite(13, HIGH);   // LED nyala (5 V)
  delay(1000);              // tunggu 1000 ms = 1 detik
  digitalWrite(13, LOW);    // LED mati (0 V)
  delay(1000);
}`
  },
  'ard-sos': {
    title: 'Tantangan: kedip cepat lalu SOS', mode: 'arduino',
    parts: [{ type: 'led', pin: 13, color: 'merah' }],
    code: String.raw`// Contoh jawaban tantangan Praktik 1: sinyal SOS (... --- ...)
int led = 13;

void kedip(int lama) {
  digitalWrite(led, HIGH);
  delay(lama);
  digitalWrite(led, LOW);
  delay(200);
}

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  for (int i = 0; i < 3; i++) kedip(200);   // S: titik pendek
  for (int i = 0; i < 3; i++) kedip(600);   // O: garis panjang
  for (int i = 0; i < 3; i++) kedip(200);   // S
  delay(1500);
}`
  },
  'ard-lalulintas': {
    title: 'Praktik 2: lampu lalu lintas', mode: 'arduino',
    parts: [{ type: 'led', pin: 11, color: 'merah' }, { type: 'led', pin: 12, color: 'kuning' }, { type: 'led', pin: 13, color: 'hijau' }],
    code: String.raw`int merah = 11, kuning = 12, hijau = 13;

void setup() {
  pinMode(merah, OUTPUT);
  pinMode(kuning, OUTPUT);
  pinMode(hijau, OUTPUT);
}

void nyalakan(int pin, int lama) {   // fungsi buatan sendiri
  digitalWrite(pin, HIGH);
  delay(lama);
  digitalWrite(pin, LOW);
}

void loop() {
  nyalakan(merah, 5000);
  nyalakan(hijau, 5000);
  nyalakan(kuning, 2000);
}`
  },
  'ard-running': {
    title: 'Tantangan: running LED 5 buah', mode: 'arduino',
    parts: [9, 10, 11, 12, 13].map(p => ({ type: 'led', pin: p, color: 'kuning' })),
    code: String.raw`// Contoh jawaban tantangan Praktik 2: array pin + perulangan for
int pinLED[5] = {9, 10, 11, 12, 13};

void setup() {
  for (int i = 0; i < 5; i++) {
    pinMode(pinLED[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(pinLED[i], HIGH);
    delay(150);
    digitalWrite(pinLED[i], LOW);
  }
}`
  },
  'ard-tombol': {
    title: 'Praktik 3: tombol (input digital)', mode: 'arduino',
    parts: [{ type: 'button', pin: 2, wiring: 'gnd' }, { type: 'led', pin: 13, color: 'hijau' }],
    code: String.raw`void setup() {
  pinMode(2, INPUT_PULLUP);  // resistor pull-up internal aktif
  pinMode(13, OUTPUT);
}

void loop() {
  int tombol = digitalRead(2);
  if (tombol == LOW) {        // LOW = tombol ditekan
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}`
  },
  'ard-toggle': {
    title: 'Tantangan: tombol toggle', mode: 'arduino',
    parts: [{ type: 'button', pin: 2, wiring: 'gnd' }, { type: 'led', pin: 13, color: 'hijau' }],
    code: String.raw`// Contoh jawaban tantangan Praktik 3: tekan sekali nyala, tekan lagi mati
bool nyala = false;
int sebelumnya = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  int sekarang = digitalRead(2);
  if (sebelumnya == HIGH && sekarang == LOW) {   // baru saja ditekan
    nyala = !nyala;
    digitalWrite(13, nyala);
    delay(50);                                   // tunggu pantulan tombol (debounce)
  }
  sebelumnya = sekarang;
}`
  },

  /* ------------------------------ Bab 6 (Arduino) ------------------------------ */
  'ard-serial': {
    title: 'Serial Monitor: hitungan', mode: 'arduino', parts: [],
    code: String.raw`int hitung = 0;

void setup() {
  Serial.begin(9600);          // kecepatan komunikasi 9600 bps
  Serial.println("Arduino siap!");
}

void loop() {
  Serial.print("Hitungan: ");
  Serial.println(hitung);
  hitung++;
  delay(500);
}`
  },
  'ard-pot': {
    title: 'Input analog: potensiometer', mode: 'arduino',
    parts: [{ type: 'pot', pin: 14, value: 600 }],
    code: String.raw`void setup() {
  Serial.begin(9600);
}

void loop() {
  int nilai = analogRead(A0);            // 0 sampai 1023
  float volt = nilai * 5.0 / 1023.0;     // ubah ke volt
  Serial.print("ADC = ");
  Serial.print(nilai);
  Serial.print("  Tegangan = ");
  Serial.println(volt);
  delay(300);
}`
  },
  'ard-pwm': {
    title: 'PWM: atur terang LED', mode: 'arduino',
    parts: [{ type: 'pot', pin: 14, value: 400 }, { type: 'led', pin: 9, color: 'biru' }],
    code: String.raw`void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  int pot = analogRead(A0);          // 0-1023
  int terang = map(pot, 0, 1023, 0, 255);
  analogWrite(9, terang);            // atur terang LED
}`
  },
  'ard-buzzer': {
    title: 'Buzzer dengan tone()', mode: 'arduino',
    parts: [{ type: 'buzzer', pin: 8 }],
    code: String.raw`int nada[] = {262, 294, 330, 349, 392, 440, 494, 523};   // do re mi fa sol la si do

void setup() {
}

void loop() {
  for (int i = 0; i < 8; i++) {
    tone(8, nada[i], 250);
    delay(300);
  }
  noTone(8);
  delay(1000);
}`
  },

  /* ------------------------------ Mini proyek ------------------------------ */
  'proj-taman': {
    title: 'Lampu taman otomatis', mode: 'arduino',
    parts: [{ type: 'ldr', pin: 14, value: 400 }, { type: 'led', pin: 13, color: 'putih' }],
    skeleton: String.raw`// Lampu taman otomatis: LED menyala saat gelap
int pinLDR = A0;
int pinLampu = 13;

void setup() {
  pinMode(pinLampu, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int cahaya = analogRead(pinLDR);   // makin gelap, nilainya makin besar
  Serial.println(cahaya);

  // TODO: jika cahaya lebih besar dari batas gelap, nyalakan lampu
  // selain itu matikan lampu

  delay(200);
}`,
    code: String.raw`// Lampu taman otomatis: LED menyala saat gelap
int pinLDR = A0;
int pinLampu = 13;
int batasGelap = 800;   // ubah sesuai kebutuhan

void setup() {
  pinMode(pinLampu, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int cahaya = analogRead(pinLDR);   // makin gelap, nilainya makin besar
  Serial.print("Nilai LDR: ");
  Serial.println(cahaya);

  if (cahaya > batasGelap) {
    digitalWrite(pinLampu, HIGH);
  } else {
    digitalWrite(pinLampu, LOW);
  }
  delay(200);
}`
  },
  'proj-suhu': {
    title: 'Indikator level suhu', mode: 'arduino',
    parts: [{ type: 'ntc', pin: 14, value: 27 }, { type: 'led', pin: 11, color: 'hijau' }, { type: 'led', pin: 12, color: 'kuning' }, { type: 'led', pin: 13, color: 'merah' }],
    skeleton: String.raw`// Indikator suhu 3 LED: hijau (sejuk), kuning (hangat), merah (panas)
const float BETA = 3950;   // konstanta sensor NTC

void setup() {
  pinMode(11, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int nilai = analogRead(A0);
  float celsius = 1 / (log(1 / (1023. / nilai - 1)) / BETA + 1.0 / 298.15) - 273.15;
  Serial.println(celsius);

  // TODO: < 30 nyalakan hijau, 30 sampai 35 kuning, di atas 35 merah
  // (matikan LED lain)

  delay(300);
}`,
    code: String.raw`// Indikator suhu 3 LED: hijau (sejuk), kuning (hangat), merah (panas)
const float BETA = 3950;   // konstanta sensor NTC

void tampil(int h, int k, int m) {
  digitalWrite(11, h);
  digitalWrite(12, k);
  digitalWrite(13, m);
}

void setup() {
  pinMode(11, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int nilai = analogRead(A0);
  float celsius = 1 / (log(1 / (1023. / nilai - 1)) / BETA + 1.0 / 298.15) - 273.15;
  Serial.print("Suhu: ");
  Serial.print(celsius);
  Serial.println(" C");

  if (celsius < 30) {
    tampil(HIGH, LOW, LOW);
  } else if (celsius <= 35) {
    tampil(LOW, HIGH, LOW);
  } else {
    tampil(LOW, LOW, HIGH);
  }
  delay(300);
}`
  },
  'proj-parkir': {
    title: 'Sensor parkir', mode: 'arduino',
    parts: [{ type: 'ultrasonic', trig: 9, echo: 10, value: 120 }, { type: 'buzzer', pin: 8 }, { type: 'led', pin: 13, color: 'merah' }],
    skeleton: String.raw`// Sensor parkir: makin dekat, bunyi makin cepat
int trig = 9, echo = 10, buzzer = 8, led = 13;

long ukurJarak() {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long durasi = pulseIn(echo, HIGH);
  return durasi / 58;          // ubah ke cm
}

void setup() {
  pinMode(trig, OUTPUT);
  pinMode(echo, INPUT);
  pinMode(buzzer, OUTPUT);
  pinMode(led, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  long jarak = ukurJarak();
  Serial.println(jarak);

  // TODO: jika jarak < 100 cm, bunyikan buzzer dan LED berkedip
  // jeda kedip makin pendek saat jarak makin dekat

  delay(100);
}`,
    code: String.raw`// Sensor parkir: makin dekat, bunyi makin cepat
int trig = 9, echo = 10, buzzer = 8, led = 13;

long ukurJarak() {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long durasi = pulseIn(echo, HIGH);
  return durasi / 58;          // ubah ke cm
}

void bip(int jeda) {
  tone(buzzer, 1500);
  digitalWrite(led, HIGH);
  delay(80);
  noTone(buzzer);
  digitalWrite(led, LOW);
  delay(jeda);
}

void setup() {
  pinMode(trig, OUTPUT);
  pinMode(echo, INPUT);
  pinMode(buzzer, OUTPUT);
  pinMode(led, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  long jarak = ukurJarak();
  Serial.print("Jarak: ");
  Serial.print(jarak);
  Serial.println(" cm");

  if (jarak < 20) {
    tone(buzzer, 1500);          // sangat dekat: bunyi terus
    digitalWrite(led, HIGH);
    delay(100);
  } else if (jarak < 100) {
    bip(jarak * 4);              // makin dekat, jeda makin pendek
  } else {
    noTone(buzzer);
    digitalWrite(led, LOW);
    delay(200);
  }
}`
  },
  'proj-dimmer': {
    title: 'Dimmer lampu', mode: 'arduino',
    parts: [{ type: 'pot', pin: 14, value: 300 }, { type: 'led', pin: 9, color: 'kuning' }],
    skeleton: String.raw`// Dimmer: potensiometer mengatur terang LED
void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int pot = analogRead(A0);
  // TODO: ubah 0-1023 menjadi 0-255 dengan map(), lalu analogWrite ke pin 9
  // TODO: tampilkan persen terang di Serial Monitor
  delay(50);
}`,
    code: String.raw`// Dimmer: potensiometer mengatur terang LED
void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int pot = analogRead(A0);
  int terang = map(pot, 0, 1023, 0, 255);
  analogWrite(9, terang);

  int persen = map(terang, 0, 255, 0, 100);
  Serial.print("Terang: ");
  Serial.print(persen);
  Serial.println(" %");
  delay(100);
}`
  },
  'proj-bel': {
    title: 'Bel cerdas cermat', mode: 'arduino',
    parts: [{ type: 'button', pin: 2, wiring: 'gnd' }, { type: 'button', pin: 3, wiring: 'gnd' }, { type: 'led', pin: 11, color: 'merah' }, { type: 'led', pin: 12, color: 'biru' }, { type: 'buzzer', pin: 8 }],
    skeleton: String.raw`// Bel cerdas cermat: siapa cepat menekan, LED-nya menyala
int tombolA = 2, tombolB = 3;
int ledA = 11, ledB = 12, buzzer = 8;
bool terkunci = false;

void setup() {
  pinMode(tombolA, INPUT_PULLUP);
  pinMode(tombolB, INPUT_PULLUP);
  pinMode(ledA, OUTPUT);
  pinMode(ledB, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (!terkunci) {
    // TODO: jika tombol A ditekan (LOW): nyalakan ledA, bunyikan buzzer, kunci
    // TODO: jika tombol B ditekan: nyalakan ledB, bunyikan buzzer, kunci
  }
}`,
    code: String.raw`// Bel cerdas cermat: siapa cepat menekan, LED-nya menyala
int tombolA = 2, tombolB = 3;
int ledA = 11, ledB = 12, buzzer = 8;
bool terkunci = false;

void menang(int led, char regu) {
  terkunci = true;
  digitalWrite(led, HIGH);
  tone(buzzer, 880, 600);
  Serial.print("Regu ");
  Serial.print(regu);
  Serial.println(" menekan lebih dulu!");
  delay(3000);                     // tampilkan pemenang 3 detik
  digitalWrite(led, LOW);
  terkunci = false;
  Serial.println("Siap untuk soal berikutnya");
}

void setup() {
  pinMode(tombolA, INPUT_PULLUP);
  pinMode(tombolB, INPUT_PULLUP);
  pinMode(ledA, OUTPUT);
  pinMode(ledB, OUTPUT);
  Serial.begin(9600);
  Serial.println("Bel siap");
}

void loop() {
  if (!terkunci) {
    if (digitalRead(tombolA) == LOW) menang(ledA, 'A');
    else if (digitalRead(tombolB) == LOW) menang(ledB, 'B');
  }
}`
  },
  'proj-runpot': {
    title: 'Running LED dengan kecepatan diatur', mode: 'arduino',
    parts: [{ type: 'pot', pin: 14, value: 500 }].concat([2, 3, 4, 5, 6, 7].map(p => ({ type: 'led', pin: p, color: 'hijau' }))),
    skeleton: String.raw`// Running LED 6 buah, kecepatan diatur potensiometer
int pinLED[6] = {2, 3, 4, 5, 6, 7};

void setup() {
  for (int i = 0; i < 6; i++) {
    pinMode(pinLED[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < 6; i++) {
    // TODO: baca A0, ubah ke jeda 50-500 ms dengan map()
    digitalWrite(pinLED[i], HIGH);
    delay(200);
    digitalWrite(pinLED[i], LOW);
  }
}`,
    code: String.raw`// Running LED 6 buah, kecepatan diatur potensiometer
int pinLED[6] = {2, 3, 4, 5, 6, 7};

void setup() {
  for (int i = 0; i < 6; i++) {
    pinMode(pinLED[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < 6; i++) {
    int jeda = map(analogRead(A0), 0, 1023, 50, 500);
    digitalWrite(pinLED[i], HIGH);
    delay(jeda);
    digitalWrite(pinLED[i], LOW);
  }
}`
  }
};
