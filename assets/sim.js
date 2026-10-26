/* Simulator Arduino Uno: model papan, komponen (LED, tombol, sensor), Serial Monitor, dan plotter.
 * Kode sketch dijalankan oleh MiniC (minic.js) dalam mode 'arduino'. */
(function (root) {
  'use strict';

  const PWM_PINS = [3, 5, 6, 9, 10, 11];
  const pinLabel = p => (p >= 14 ? 'A' + (p - 14) : String(p));
  const MODE = { 0: 'INPUT', 1: 'OUTPUT', 2: 'INPUT_PULLUP' };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LED_COLORS = {
    merah: { on: '#ff3b30', off: '#7a2a26', name: 'merah' },
    kuning: { on: '#ffd60a', off: '#7a6a1c', name: 'kuning' },
    hijau: { on: '#30d158', off: '#25603a', name: 'hijau' },
    biru: { on: '#2f8cff', off: '#24456e', name: 'biru' },
    putih: { on: '#f5f7ff', off: '#7d8290', name: 'putih' }
  };
  const PART_NAMES = { led: 'LED', button: 'Tombol', pot: 'Potensiometer', ldr: 'Sensor cahaya (LDR)', ntc: 'Sensor suhu (NTC)', buzzer: 'Buzzer', ultrasonic: 'Sensor jarak HC-SR04' };

  /* ---------- Konversi sensor (mengikuti rumus contoh Wokwi) ---------- */
  const ntcToAdc = c => {
    const BETA = 3950;
    const e = Math.exp(BETA * (1 / (c + 273.15) - 1 / 298.15));
    return Math.round(1023 / (1 + 1 / e));
  };
  const luxToAdc = lux => {
    const R = 50000 * Math.pow(10, 0.7) / Math.pow(lux, 0.7);
    return Math.round(1023 * R / (R + 2000));
  };

  /* ============================== Model papan ============================== */
  class Board {
    constructor(hooks) {
      this.hooks = hooks || {};
      this.components = [];
      this.reset();
    }
    reset() {
      this.pins = Array.from({ length: 20 }, () => ({ mode: 0, out: 0, pwm: null, tone: 0, toneUntil: 0, used: false }));
      this.t0 = performance.now();
      this.lastTx = -1e9;
    }
    now() { return performance.now() - this.t0; }
    warn(key, msg) { this.hooks.warn && this.hooks.warn(key, msg); }
    norm(p, fn) {
      p = Math.trunc(p);
      if (p >= 0 && p < 20) return p;
      this.warn('pin' + fn + p, `${fn}(): pin ${p} tidak ada di Arduino Uno. Pin digital 0-13, pin analog A0-A5.`);
      return -1;
    }
    pinMode(p, m) {
      p = this.norm(p, 'pinMode');
      if (p < 0) return;
      const pin = this.pins[p];
      pin.mode = m; pin.used = true;
      if (m !== 1) pin.pwm = null;
      if (m === 2) pin.out = 1;
    }
    digitalWrite(p, v) {
      p = this.norm(p, 'digitalWrite');
      if (p < 0) return;
      const pin = this.pins[p];
      pin.out = v; pin.pwm = null; pin.used = true;
      if (pin.mode !== 1 && v) {
        this.warn('pm' + p, `Pin ${pinLabel(p)} belum diatur sebagai OUTPUT. Tambahkan pinMode(${pinLabel(p)}, OUTPUT); di setup(). Tanpa itu LED hanya menyala sangat redup.`);
      }
    }
    analogWrite(p, v) {
      p = this.norm(p, 'analogWrite');
      if (p < 0) return;
      v = Math.trunc(v);
      if (v < 0 || v > 255) {
        this.warn('awrange' + p, `analogWrite(${pinLabel(p)}, ${v}): nilai PWM harus 0 sampai 255. Gunakan map() untuk mengubah rentang.`);
        v = v < 0 ? 0 : v & 255;
      }
      const pin = this.pins[p];
      pin.mode = 1; pin.used = true;
      if (!PWM_PINS.includes(p)) {
        pin.pwm = null; pin.out = v >= 128 ? 1 : 0;
        this.warn('pwm' + p, `Pin ${pinLabel(p)} bukan pin PWM (~). analogWrite di pin ini hanya menghasilkan nyala penuh (nilai ≥ 128) atau mati. Pakai pin 3, 5, 6, 9, 10, atau 11.`);
      } else {
        pin.pwm = v; pin.out = v > 0 ? 1 : 0;
      }
    }
    partOn(p, types) { return this.components.find(c => types.includes(c.type) && (c.pin === p || c.echo === p)); }
    digitalRead(p) {
      p = this.norm(p, 'digitalRead');
      if (p < 0) return 0;
      const pin = this.pins[p];
      pin.used = true;
      const btn = this.components.find(c => c.type === 'button' && c.pin === p);
      if (btn) {
        if (btn.wiring === 'vcc') return btn.pressed ? 1 : 0;
        if (btn.pressed) return 0;
        if (pin.mode === 2) return 1;
        if (pin.mode === 1) return pin.out;
        if (pin.out) return 1;
        this.warn('float' + p, `Pin ${pinLabel(p)} "mengambang" (floating): tombol tidak ditekan, tetapi pin tidak punya resistor pull-up, jadi nilainya acak. Gunakan pinMode(${pinLabel(p)}, INPUT_PULLUP);`);
        return Math.random() < 0.5 ? 1 : 0;
      }
      if (pin.mode === 1) return pin.out;
      if (pin.mode === 2 || pin.out) return 1;
      const an = this.partOn(p, ['pot', 'ldr', 'ntc']);
      if (an) return this.sensorValue(an) >= 512 ? 1 : 0;
      this.warn('floatfree' + p, `digitalRead(${pinLabel(p)}): tidak ada komponen di pin ini, nilainya acak (mengambang).`);
      return Math.random() < 0.5 ? 1 : 0;
    }
    sensorValue(c) {
      if (c.type === 'ntc') return ntcToAdc(c.value);
      if (c.type === 'ldr') return luxToAdc(c.value);
      return c.value;
    }
    analogRead(p) {
      p = Math.trunc(p);
      if (p >= 0 && p <= 5) p += 14;
      if (p < 14 || p > 19) {
        this.warn('ar' + p, `analogRead(${p}): pin analog hanya A0 sampai A5.`);
        return 0;
      }
      this.pins[p].used = true;
      const c = this.partOn(p, ['pot', 'ldr', 'ntc']);
      if (c) {
        const v = this.sensorValue(c) + (c.type === 'pot' ? 0 : Math.round((Math.random() - 0.5) * 3));
        return Math.max(0, Math.min(1023, v));
      }
      if (this.pins[p].mode === 2) return 1023;
      this.warn('an' + p, `Tidak ada sensor di ${pinLabel(p)}, jadi analogRead(${pinLabel(p)}) menghasilkan angka acak (pin mengambang).`);
      return 280 + Math.floor(Math.random() * 160);
    }
    tone(p, f, d) {
      p = this.norm(p, 'tone');
      if (p < 0) return;
      const pin = this.pins[p];
      pin.tone = Math.max(0, f); pin.used = true;
      pin.toneUntil = d ? this.now() + d : 0;
    }
    noTone(p) {
      p = this.norm(p, 'noTone');
      if (p >= 0) this.pins[p].tone = 0;
    }
    pulseIn(p) {
      p = this.norm(p, 'pulseIn');
      if (p < 0) return 0;
      const u = this.components.find(c => c.type === 'ultrasonic' && c.echo === p);
      if (!u) { this.warn('pulse' + p, `pulseIn(${pinLabel(p)}): tidak ada sensor HC-SR04 dengan pin ECHO di ${pinLabel(p)}.`); return 0; }
      if (this.pins[u.trig].mode !== 1) this.warn('trig' + u.trig, `Pin TRIG (${pinLabel(u.trig)}) belum diatur pinMode(${pinLabel(u.trig)}, OUTPUT).`);
      return Math.round(u.value * 58.2);
    }
    pinLevel(p) {
      const pin = this.pins[p];
      if (pin.mode === 1) return pin.pwm != null ? pin.pwm / 255 : pin.out;
      return pin.out ? 0.08 : 0;
    }
    buzzing(c) {
      const pin = this.pins[c.pin];
      if (pin.tone && (!pin.toneUntil || this.now() < pin.toneUntil)) return pin.tone;
      if (pin.tone && pin.toneUntil && this.now() >= pin.toneUntil) pin.tone = 0;
      if (pin.mode === 1 && (pin.pwm != null ? pin.pwm > 0 : pin.out)) return 2300;
      return 0;
    }
  }

  /* ============================== Gambar papan (SVG) ============================== */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function drawBoard(container, opts) {
    opts = opts || {};
    const svg = el('svg', { viewBox: '0 0 300 214', class: 'uno', role: 'img', 'aria-label': 'Papan Arduino Uno simulasi' });
    const holes = {};
    el('rect', { x: 8, y: 6, width: 286, height: 202, rx: 12, class: 'uno-pcb' }, svg);
    // lubang baut
    [[22, 196], [282, 20], [282, 196], [96, 20]].forEach(([x, y]) => el('circle', { cx: x, cy: y, r: 5, class: 'uno-hole' }, svg));
    // konektor USB & jack DC
    el('rect', { x: 0, y: 34, width: 44, height: 40, rx: 3, class: 'uno-usb' }, svg);
    el('rect', { x: 2, y: 146, width: 40, height: 42, rx: 4, class: 'uno-jack' }, svg);
    // tombol reset
    const rst = el('g', { class: 'uno-reset', tabindex: opts.interactive ? 0 : -1, role: 'button', 'aria-label': 'Reset' }, svg);
    el('rect', { x: 56, y: 14, width: 18, height: 18, rx: 3, class: 'uno-reset-base' }, rst);
    el('circle', { cx: 65, cy: 23, r: 6, class: 'uno-reset-btn' }, rst);
    el('text', { x: 65, y: 41, class: 'uno-silk tiny', 'text-anchor': 'middle' }, rst).textContent = 'RESET';
    // header digital
    const top = [['AREF', null], ['GND', null], ['13', 13], ['12', 12], ['~11', 11], ['~10', 10], ['~9', 9], ['8', 8],
      [null], ['7', 7], ['~6', 6], ['~5', 5], ['4', 4], ['~3', 3], ['2', 2], ['TX→1', 1], ['RX←0', 0]];
    let x = 104;
    el('rect', { x: 100, y: 8, width: 94, height: 13, rx: 2, class: 'uno-header' }, svg);
    el('rect', { x: 200, y: 8, width: 94 - 2, height: 13, rx: 2, class: 'uno-header' }, svg);
    top.forEach(([lab, p]) => {
      if (lab === null) { x = 204; return; }
      const g = el('g', { class: 'uno-pin' }, svg);
      const r = el('rect', { x: x, y: 11, width: 7, height: 7, rx: 1, class: 'uno-pad' }, g);
      if (p != null) { holes[p] = r; r.dataset.pin = p; }
      const t = el('text', { x: x + 3.5, y: 27, class: 'uno-silk tiny', 'text-anchor': 'end', transform: `rotate(-90 ${x + 3.5} 27)` }, g);
      t.textContent = lab;
      x += 11;
    });
    el('text', { x: 196, y: 62, class: 'uno-silk', 'text-anchor': 'middle' }, svg).textContent = 'DIGITAL (PWM ~)';
    // header bawah
    el('rect', { x: 92, y: 193, width: 82, height: 13, rx: 2, class: 'uno-header' }, svg);
    el('rect', { x: 186, y: 193, width: 70, height: 13, rx: 2, class: 'uno-header' }, svg);
    const bottom = [['IOREF'], ['RESET'], ['3.3V'], ['5V'], ['GND'], ['GND'], ['Vin'], [null], ['A0', 14], ['A1', 15], ['A2', 16], ['A3', 17], ['A4', 18], ['A5', 19]];
    x = 96;
    bottom.forEach(([lab, p]) => {
      if (lab === null) { x = 190; return; }
      const g = el('g', { class: 'uno-pin' }, svg);
      const r = el('rect', { x: x, y: 196, width: 7, height: 7, rx: 1, class: 'uno-pad' }, g);
      if (p != null) { holes[p] = r; r.dataset.pin = p; }
      const t = el('text', { x: x + 3.5, y: 189, class: 'uno-silk tiny', 'text-anchor': 'start', transform: `rotate(-90 ${x + 3.5} 189)` }, g);
      t.textContent = lab;
      x += 11;
    });
    el('text', { x: 133, y: 162, class: 'uno-silk', 'text-anchor': 'middle' }, svg).textContent = 'POWER';
    el('text', { x: 221, y: 162, class: 'uno-silk', 'text-anchor': 'middle' }, svg).textContent = 'ANALOG IN';
    // LED bawaan
    const led = (cx, cy, label, cls) => {
      const c = el('rect', { x: cx - 4, y: cy - 2.5, width: 8, height: 5, rx: 1, class: 'uno-smd ' + cls }, svg);
      el('text', { x: cx - 7, y: cy + 2, class: 'uno-silk tiny', 'text-anchor': 'end' }, svg).textContent = label;
      return c;
    };
    const ledL = led(132, 76, 'L', 'smd-l');
    const ledTX = led(132, 88, 'TX', 'smd-tx');
    const ledRX = led(132, 100, 'RX', 'smd-rx');
    const ledON = led(268, 88, 'ON', 'smd-on');
    // chip ATmega328P
    el('rect', { x: 152, y: 120, width: 120, height: 26, rx: 2, class: 'uno-chip' }, svg);
    for (let i = 0; i < 14; i++) {
      el('rect', { x: 156 + i * 8.3, y: 116, width: 3, height: 4, class: 'uno-leg' }, svg);
      el('rect', { x: 156 + i * 8.3, y: 146, width: 3, height: 4, class: 'uno-leg' }, svg);
    }
    el('text', { x: 212, y: 136, class: 'uno-chip-text', 'text-anchor': 'middle' }, svg).textContent = 'ATmega328P';
    // kristal & label
    el('rect', { x: 62, y: 96, width: 22, height: 9, rx: 4.5, class: 'uno-xtal' }, svg);
    el('text', { x: 196, y: 100, class: 'uno-brand', 'text-anchor': 'middle' }, svg).textContent = 'UNO';
    el('text', { x: 72, y: 128, class: 'uno-silk', 'text-anchor': 'middle' }, svg).textContent = 'SIMULASI';
    container.appendChild(svg);
    return { svg, holes, ledL, ledTX, ledRX, ledON, reset: rst };
  }

  /* ============================== Kartu komponen ============================== */
  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function pinOptions(analog, selected) {
    const list = analog ? [14, 15, 16, 17, 18, 19] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    return list.map(p => `<option value="${p}"${p === selected ? ' selected' : ''}>${analog ? pinLabel(p) : 'pin ' + p + (PWM_PINS.includes(p) ? ' ~' : '')}</option>`).join('');
  }
  function fmtLux(l) { return l >= 1000 ? Math.round(l / 100) / 10 + 'k' : l >= 10 ? Math.round(l) : (Math.round(l * 10) / 10); }
  function luxLabel(l) { return l < 1 ? 'gelap' : l < 50 ? 'redup' : l < 1000 ? 'terang dalam ruangan' : l < 20000 ? 'siang berawan' : 'matahari terik'; }

  let partSeq = 0;

  function buildPart(c, sim) {
    c.id = c.id || 'p' + (++partSeq);
    const card = h('div', 'part part-' + c.type);
    const head = h('div', 'part-head');
    const title = h('span', 'part-title', PART_NAMES[c.type] + (c.type === 'led' ? ' ' + (LED_COLORS[c.color] || LED_COLORS.merah).name : ''));
    head.appendChild(title);
    const controls = h('div', 'part-ctl');
    const mkSelect = (label, analog, key) => {
      const s = h('select', 'part-pin');
      s.setAttribute('aria-label', label);
      s.id = 'pin-' + c.id + '-' + key;
      s.innerHTML = pinOptions(analog, c[key]);
      s.addEventListener('change', () => { c[key] = +s.value; sim.partsChanged(); });
      return s;
    };
    if (c.type === 'ultrasonic') {
      const a = h('label', 'part-pinlab', 'TRIG '); a.appendChild(mkSelect('Pin TRIG', false, 'trig'));
      const b = h('label', 'part-pinlab', 'ECHO '); b.appendChild(mkSelect('Pin ECHO', false, 'echo'));
      controls.append(a, b);
    } else {
      controls.appendChild(mkSelect('Pin ' + PART_NAMES[c.type], ['pot', 'ldr', 'ntc'].includes(c.type), 'pin'));
    }
    const rm = h('button', 'part-rm', '<span aria-hidden="true">×</span>');
    rm.type = 'button';
    rm.title = 'Hapus komponen';
    rm.setAttribute('aria-label', 'Hapus ' + PART_NAMES[c.type]);
    rm.addEventListener('click', () => sim.removePart(c.id));
    controls.appendChild(rm);
    head.appendChild(controls);
    card.appendChild(head);
    const body = h('div', 'part-body');
    card.appendChild(body);
    let update = () => {};

    if (c.type === 'led') {
      const col = LED_COLORS[c.color] || LED_COLORS.merah;
      body.innerHTML = `<svg viewBox="0 0 60 84" class="led-svg" aria-hidden="true">
        <line x1="24" y1="56" x2="24" y2="82" class="led-leg"/><line x1="36" y1="56" x2="36" y2="76" class="led-leg"/>
        <path d="M12 56 V30 a18 18 0 0 1 36 0 V56 Z" fill="${col.off}" class="led-base"/>
        <path d="M12 56 V30 a18 18 0 0 1 36 0 V56 Z" fill="${col.on}" class="led-lit" opacity="0"/>
        <rect x="9" y="54" width="42" height="5" rx="1.5" fill="${col.off}"/>
        <path d="M19 28 a11 11 0 0 1 9 -10" class="led-shine"/>
      </svg>
      <div class="part-info"><span class="led-state">mati</span><span class="part-wire">anoda (kaki panjang) → pin, katoda → resistor 220 Ω → GND</span>
      <label class="part-check"><input type="checkbox" id="rev-${c.id}"${c.reversed ? ' checked' : ''}> pasang terbalik</label>
      <label class="part-check">warna <select id="col-${c.id}" class="part-color">${Object.keys(LED_COLORS).map(k => `<option value="${k}"${k === (c.color || 'merah') ? ' selected' : ''}>${k}</option>`).join('')}</select></label></div>`;
      const lit = body.querySelector('.led-lit'), svg = body.querySelector('svg'), st = body.querySelector('.led-state');
      body.querySelector('#rev-' + c.id).addEventListener('change', e => { c.reversed = e.target.checked; sim.partsChanged(); });
      body.querySelector('#col-' + c.id).addEventListener('change', e => { c.color = e.target.value; sim.partsChanged(true); });
      update = b => {
        const lv = c.reversed ? 0 : b.pinLevel(c.pin);
        lit.setAttribute('opacity', lv.toFixed(2));
        svg.style.filter = lv > 0.05 ? `drop-shadow(0 0 ${4 + lv * 14}px ${col.on})` : 'none';
        const pin = b.pins[c.pin];
        st.textContent = c.reversed ? 'mati (LED terbalik)' : pin.pwm != null && pin.mode === 1 ? `PWM ${pin.pwm} (${Math.round(pin.pwm / 2.55)}%)` : lv >= 1 ? 'menyala (HIGH)' : lv > 0 ? 'redup (pinMode belum OUTPUT)' : 'mati (LOW)';
      };
    } else if (c.type === 'button') {
      body.innerHTML = `<button type="button" class="push" aria-pressed="false"><span class="push-cap"></span></button>
      <div class="part-info"><span class="btn-state">dilepas</span>
      <label class="part-check">sambungan <select id="wir-${c.id}"><option value="gnd"${c.wiring !== 'vcc' ? ' selected' : ''}>pin ↔ GND (pakai INPUT_PULLUP)</option><option value="vcc"${c.wiring === 'vcc' ? ' selected' : ''}>pin ↔ 5V + resistor pull-down 10 kΩ</option></select></label></div>`;
      const btn = body.querySelector('.push'), st = body.querySelector('.btn-state');
      const set = v => { c.pressed = v; btn.classList.toggle('down', v); btn.setAttribute('aria-pressed', v ? 'true' : 'false'); };
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        set(true);
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* pointer sintetis/tidak aktif */ }
      });
      btn.addEventListener('pointerup', () => set(false));
      btn.addEventListener('pointercancel', () => set(false));
      btn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(true); } });
      btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') set(false); });
      body.querySelector('#wir-' + c.id).addEventListener('change', e => { c.wiring = e.target.value; });
      update = b => {
        const pin = b.pins[c.pin];
        const lvl = c.wiring === 'vcc' ? (c.pressed ? 'HIGH' : 'LOW') : c.pressed ? 'LOW' : (pin.mode === 2 ? 'HIGH' : 'mengambang');
        st.textContent = (c.pressed ? 'ditekan' : 'dilepas') + ' → pin ' + c.pin + ' = ' + lvl;
      };
    } else if (c.type === 'pot' || c.type === 'ldr' || c.type === 'ntc' || c.type === 'ultrasonic') {
      const cfg = {
        pot: { min: 0, max: 1023, step: 1, label: 'Putar' },
        ldr: { min: -1, max: 5, step: 0.05, label: 'Cahaya' },
        ntc: { min: -24, max: 80, step: 0.5, label: 'Suhu' },
        ultrasonic: { min: 2, max: 400, step: 1, label: 'Jarak' }
      }[c.type];
      const sliderVal = c.type === 'ldr' ? Math.log10(c.value) : c.value;
      const visual = c.type === 'pot'
        ? `<svg viewBox="0 0 64 64" class="knob" aria-hidden="true"><circle cx="32" cy="32" r="26" class="knob-ring"/><circle cx="32" cy="32" r="19" class="knob-cap"/><line x1="32" y1="32" x2="32" y2="15" class="knob-mark"/></svg>`
        : c.type === 'ldr' ? `<svg viewBox="0 0 64 64" class="sensor-ico" aria-hidden="true"><circle cx="32" cy="32" r="20" class="ldr-disc"/><path d="M20 26h8v6h8v6h8" class="ldr-track"/><circle cx="32" cy="32" r="27" class="ldr-glow" opacity="0"/></svg>`
          : c.type === 'ntc' ? `<svg viewBox="0 0 64 64" class="sensor-ico" aria-hidden="true"><rect x="27" y="8" width="10" height="34" rx="5" class="therm-tube"/><circle cx="32" cy="48" r="9" class="therm-bulb"/><rect x="29.5" y="20" width="5" height="28" rx="2.5" class="therm-fill"/></svg>`
            : `<svg viewBox="0 0 80 48" class="sensor-ico" aria-hidden="true"><rect x="2" y="8" width="76" height="32" rx="4" class="sr-pcb"/><circle cx="22" cy="24" r="12" class="sr-eye"/><circle cx="58" cy="24" r="12" class="sr-eye"/></svg>`;
      body.innerHTML = `${visual}<div class="part-info"><label class="part-slider"><span>${cfg.label}</span>
        <input type="range" id="val-${c.id}" min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${sliderVal}"></label>
        <span class="sensor-read"></span><span class="part-wire">${c.type === 'pot' ? 'kaki kiri → 5V, kaki kanan → GND, kaki tengah → ' + pinLabel(c.pin) : c.type === 'ultrasonic' ? 'VCC → 5V, GND → GND' : 'modul sensor: AO → ' + pinLabel(c.pin)}</span></div>`;
      const inp = body.querySelector('input'), rd = body.querySelector('.sensor-read');
      inp.addEventListener('input', () => { c.value = c.type === 'ldr' ? Math.pow(10, +inp.value) : +inp.value; });
      const knobMark = body.querySelector('.knob-mark'), glow = body.querySelector('.ldr-glow'), fill = body.querySelector('.therm-fill');
      update = b => {
        if (c.type === 'ultrasonic') { rd.textContent = `${Math.round(c.value)} cm → pulseIn ≈ ${Math.round(c.value * 58.2)} µs`; return; }
        const adc = b.sensorValue(c);
        const volt = (adc * 5 / 1023).toFixed(2);
        if (c.type === 'pot') { knobMark.setAttribute('transform', `rotate(${(c.value / 1023) * 270 - 135} 32 32)`); rd.textContent = `analogRead = ${adc} (${volt} V)`; }
        if (c.type === 'ldr') { glow.setAttribute('opacity', Math.min(1, Math.max(0, (Math.log10(c.value) + 1) / 6)).toFixed(2)); rd.textContent = `${fmtLux(c.value)} lux (${luxLabel(c.value)}) → analogRead = ${adc}`; }
        if (c.type === 'ntc') { const k = (c.value + 24) / 104; fill.setAttribute('y', String(44 - k * 24)); fill.setAttribute('height', String(4 + k * 24)); rd.textContent = `${c.value.toFixed(1)} °C → analogRead = ${adc}`; }
      };
    } else if (c.type === 'buzzer') {
      body.innerHTML = `<svg viewBox="0 0 64 64" class="buzz" aria-hidden="true"><circle cx="26" cy="32" r="18" class="buzz-body"/><circle cx="26" cy="32" r="4" class="buzz-hole"/>
        <path d="M48 22 q6 10 0 20" class="buzz-wave"/><path d="M54 16 q10 16 0 32" class="buzz-wave w2"/></svg>
        <div class="part-info"><span class="buzz-state">diam</span><span class="part-wire">kaki + → pin, kaki − → GND</span></div>`;
      const st = body.querySelector('.buzz-state');
      update = b => {
        const f = b.buzzing(c);
        card.classList.toggle('buzzing', f > 0);
        st.textContent = f > 0 ? `berbunyi ${Math.round(f)} Hz` : 'diam';
      };
    }
    return { card, update, c };
  }

  /* ============================== Suara buzzer ============================== */
  class Sound {
    constructor() { this.ctx = null; this.voices = new Map(); this.muted = false; }
    ensure() {
      if (this.ctx || this.muted) return;
      try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); } catch (e) { this.ctx = null; }
    }
    set(id, freq) {
      if (!this.ctx) return;
      let v = this.voices.get(id);
      if (!v) {
        const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
        osc.type = 'square'; g.gain.value = 0;
        osc.connect(g).connect(this.ctx.destination);
        osc.start();
        v = { osc, g };
        this.voices.set(id, v);
      }
      const on = freq > 0 && !this.muted;
      if (on) v.osc.frequency.setTargetAtTime(Math.min(8000, Math.max(30, freq)), this.ctx.currentTime, 0.005);
      v.g.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.01);
    }
    silence() { for (const id of this.voices.keys()) this.set(id, 0); }
  }

  /* ============================== Simulator lengkap ============================== */
  class ArduinoSim {
    constructor(opts) {
      this.o = opts;
      this.notes = new Map();
      this.board = new Board({ warn: (k, m) => this.note(k, m) });
      this.ui = drawBoard(opts.boardEl, { interactive: true });
      this.ui.reset.addEventListener('click', () => this.o.onReset && this.o.onReset());
      this.parts = [];
      this.sound = new Sound();
      this.serialBuf = '';
      this.serialPending = '';
      this.rx = '';
      this.plot = [];
      this.running = false;
      this.ctl = null;
      if (opts.pinsEl) this.buildPins();
      if (opts.serialEl) this.buildSerial();
      this.frame = this.frame.bind(this);
      this.render();
    }

    /* ----- komponen ----- */
    setComponents(list) {
      this.board.components = list.map(c => Object.assign({}, c));
      this.buildParts();
    }
    buildParts() {
      if (!this.o.partsEl) return;
      this.o.partsEl.innerHTML = '';
      this.parts = this.board.components.map(c => buildPart(c, this));
      for (const p of this.parts) this.o.partsEl.appendChild(p.card);
      if (!this.parts.length) this.o.partsEl.appendChild(h('p', 'parts-empty', 'Belum ada komponen. Tambahkan LED, tombol, atau sensor dengan tombol "Tambah komponen". LED bawaan "L" di pin 13 selalu ada di papan.'));
      this.render();
    }
    partsChanged(rebuild) { if (rebuild) this.buildParts(); else this.render(); }
    addPart(type, extra) {
      const used = new Set(this.board.components.flatMap(c => [c.pin, c.trig, c.echo]));
      const freeDigital = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].find(p => !used.has(p)) ?? 2;
      const freeAnalog = [14, 15, 16, 17, 18, 19].find(p => !used.has(p)) ?? 14;
      const c = { type };
      if (type === 'led') Object.assign(c, { pin: freeDigital, color: 'merah' });
      if (type === 'button') Object.assign(c, { pin: [2, 3, 4, 5, 6, 7, 8].find(p => !used.has(p)) ?? 2, wiring: 'gnd' });
      if (type === 'pot') Object.assign(c, { pin: freeAnalog, value: 512 });
      if (type === 'ldr') Object.assign(c, { pin: freeAnalog, value: 300 });
      if (type === 'ntc') Object.assign(c, { pin: freeAnalog, value: 25 });
      if (type === 'buzzer') Object.assign(c, { pin: [8, 7, 6, 5, 4].find(p => !used.has(p)) ?? 8 });
      if (type === 'ultrasonic') Object.assign(c, { trig: 9, echo: 10, value: 100 });
      Object.assign(c, extra || {});
      this.board.components.push(c);
      this.buildParts();
    }
    removePart(id) {
      this.board.components = this.board.components.filter(c => c.id !== id);
      this.sound.set(id, 0);
      this.buildParts();
    }

    /* ----- strip pin ----- */
    buildPins() {
      const wrap = this.o.pinsEl;
      wrap.innerHTML = '';
      this.pinCells = [];
      for (let p = 0; p < 20; p++) {
        const d = h('div', 'pincell', `<b>${pinLabel(p)}${PWM_PINS.includes(p) ? '~' : ''}</b><span>–</span>`);
        wrap.appendChild(d);
        this.pinCells.push(d);
      }
    }

    /* ----- Serial Monitor & plotter ----- */
    buildSerial() {
      const s = this.o.serialEl;
      s.innerHTML = `<div class="serial-head">
          <div class="seg" role="tablist" aria-label="Tampilan serial">
            <button type="button" role="tab" class="on" data-v="text" aria-selected="true">Serial Monitor</button>
            <button type="button" role="tab" data-v="plot" aria-selected="false">Plotter</button>
          </div>
          <span class="serial-baud">belum Serial.begin</span>
          <button type="button" class="btn-ghost small serial-clear">Bersihkan</button>
        </div>
        <pre class="serial-out" aria-live="polite"></pre>
        <canvas class="serial-plot" height="180" hidden></canvas>
        <form class="serial-send"><input type="text" id="${this.o.idPrefix || 'sim'}-serial-in" placeholder="Kirim teks ke Arduino (Serial.read)…" autocomplete="off" aria-label="Kirim ke Serial"><button type="submit" class="btn-ghost small">Kirim</button></form>`;
      this.sOut = s.querySelector('.serial-out');
      this.sBaud = s.querySelector('.serial-baud');
      this.sPlot = s.querySelector('.serial-plot');
      s.querySelector('.serial-clear').addEventListener('click', () => { this.serialBuf = ''; this.sOut.textContent = ''; this.plot = []; this.drawPlot(); });
      s.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
        s.querySelectorAll('.seg button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        const plot = b.dataset.v === 'plot';
        this.sOut.hidden = plot; this.sPlot.hidden = !plot;
        if (plot) this.drawPlot();
      }));
      s.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const inp = e.target.querySelector('input');
        this.rx += inp.value + '\n';
        this.serialEcho(inp.value);
        inp.value = '';
      });
    }
    serialEcho(text) {
      if (!this.sOut) return;
      const span = document.createElement('span');
      span.className = 'serial-tx';
      span.textContent = '» ' + text + '\n';
      this.sOut.appendChild(span);
      this.sOut.scrollTop = this.sOut.scrollHeight;
    }
    serial(text) {
      this.serialPending += text;
      this.board.lastTx = this.board.now();
    }
    flushSerial() {
      if (!this.serialPending) return;
      const text = this.serialPending.replace(/\r/g, '');
      this.serialPending = '';
      // data untuk plotter: angka-angka di setiap baris lengkap
      this.plotLine = (this.plotLine || '') + text;
      const lines = this.plotLine.split('\n');
      this.plotLine = lines.pop();
      for (const ln of lines) {
        const nums = (ln.match(/-?\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
        if (nums.length) { this.plot.push(nums); if (this.plot.length > 240) this.plot.shift(); }
      }
      if (this.sOut) {
        this.sOut.appendChild(document.createTextNode(text));
        if (this.sOut.childNodes.length > 400) {
          const t = this.sOut.textContent;
          this.sOut.textContent = t.slice(-20000);
        }
        this.sOut.scrollTop = this.sOut.scrollHeight;
        if (!this.sPlot.hidden) this.drawPlot();
      }
    }
    drawPlot() {
      const cv = this.sPlot;
      if (!cv || cv.hidden) return;
      const w = cv.clientWidth || 300, hgt = 180, dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, hgt);
      const cs = getComputedStyle(cv);
      const ink = cs.getPropertyValue('--ink-3').trim() || '#888', grid = cs.getPropertyValue('--line').trim() || '#ddd';
      const cols = [cs.getPropertyValue('--copper').trim() || '#c60', cs.getPropertyValue('--mask').trim() || '#063', cs.getPropertyValue('--band-6').trim() || '#36c'];
      const data = this.plot;
      g.font = '11px ' + (cs.getPropertyValue('--font-mono').trim() || 'monospace');
      if (!data.length) { g.fillStyle = ink; g.fillText('Plotter menggambar angka dari setiap Serial.println().', 10, hgt / 2); return; }
      let lo = Infinity, hi = -Infinity;
      data.forEach(r => r.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
      if (hi === lo) { hi += 1; lo -= 1; }
      const pad = 8, left = 44;
      const y = v => pad + (hgt - 2 * pad) * (1 - (v - lo) / (hi - lo));
      g.strokeStyle = grid; g.lineWidth = 1; g.fillStyle = ink;
      [lo, (lo + hi) / 2, hi].forEach(v => {
        g.beginPath(); g.moveTo(left, y(v)); g.lineTo(w - 6, y(v)); g.stroke();
        g.fillText(String(Math.round(v * 100) / 100), 4, y(v) + 4);
      });
      const n = Math.max(...data.map(r => r.length));
      for (let s = 0; s < n; s++) {
        g.strokeStyle = cols[s % 3]; g.lineWidth = 2; g.beginPath();
        let started = false;
        data.forEach((r, i) => {
          if (r[s] === undefined) return;
          const px = left + (w - left - 6) * (i / Math.max(1, 239));
          if (!started) { g.moveTo(px, y(r[s])); started = true; } else g.lineTo(px, y(r[s]));
        });
        g.stroke();
      }
    }

    note(key, msg) {
      if (this.notes.has(key)) return;
      this.notes.set(key, msg);
      this.o.onNote && this.o.onNote(msg);
    }

    /* ----- jalankan ----- */
    run(code) {
      this.stop();
      const res = MiniC.compile(code, { mode: 'arduino' });
      if (!res.ok) return res;
      this.board.reset();
      this.notes.clear();
      this.serialBuf = ''; this.serialPending = ''; this.rx = ''; this.plot = []; this.plotLine = '';
      if (this.sOut) this.sOut.textContent = '';
      if (this.sBaud) this.sBaud.textContent = 'belum Serial.begin';
      this.sound.ensure();
      if (this.sound.ctx && this.sound.ctx.state === 'suspended') this.sound.ctx.resume();
      this.running = true;
      this.ctl = MiniC.run(res, {
        mode: 'arduino',
        sliceMs: 8,
        io: {
          board: this.board,
          out() {},
          serial: t => this.serial(t),
          serialBegin: b => { if (this.sBaud) this.sBaud.textContent = b + ' baud'; },
          serialRx: () => this.rx,
          serialTake: n => { this.rx = this.rx.slice(n); },
          warn: (k, m) => this.note(k, m)
        },
        onError: e => { this.running = false; this.render(); this.o.onError && this.o.onError(e); },
        onDone: () => { this.running = false; this.render(); }
      });
      requestAnimationFrame(this.frame);
      return res;
    }
    stop() {
      if (this.ctl) this.ctl.stop();
      this.ctl = null;
      this.running = false;
      this.sound.silence();
      this.render();
    }
    currentLine() { return this.running && this.ctl ? this.ctl.rt.L : 0; }
    frame() {
      this.render();
      if (this.running) requestAnimationFrame(this.frame);
    }
    render() {
      const b = this.board, ui = this.ui;
      for (const p in ui.holes) {
        const lv = this.running ? b.pinLevel(+p) : 0;
        const pin = b.pins[p];
        const r = ui.holes[p];
        r.classList.toggle('on', lv >= 1);
        r.classList.toggle('pwm', lv > 0 && lv < 1);
        r.classList.toggle('in', this.running && pin.used && pin.mode !== 1);
        r.style.opacity = '';
      }
      const l13 = this.running ? b.pinLevel(13) : 0;
      ui.ledL.style.opacity = String(0.25 + 0.75 * Math.min(1, l13 * 1.4));
      ui.ledL.classList.toggle('lit', l13 > 0.05);
      ui.ledTX.classList.toggle('lit', this.running && b.now() - b.lastTx < 60);
      ui.ledON.classList.toggle('lit', this.running);
      for (const p of this.parts) p.update(b);
      for (const c of b.components) if (c.type === 'buzzer') this.sound.set(c.id, this.running ? b.buzzing(c) : 0);
      if (this.pinCells) {
        this.pinCells.forEach((cell, p) => {
          const pin = b.pins[p];
          const used = this.running && pin.used;
          cell.classList.toggle('used', used);
          cell.classList.toggle('high', used && b.pinLevel(p) >= 1);
          const s = cell.querySelector('span');
          if (!used) s.textContent = '–';
          else if (pin.mode === 1) s.textContent = pin.pwm != null ? 'PWM ' + pin.pwm : pin.out ? 'HIGH' : 'LOW';
          else s.textContent = MODE[pin.mode] === 'INPUT_PULLUP' ? 'IN↑' : 'IN';
        });
      }
      this.flushSerial();
      this.o.onFrame && this.o.onFrame(this);
    }
    setMuted(m) { this.sound.muted = m; if (m) this.sound.silence(); }
  }

  root.ArduinoSim = ArduinoSim;
  root.ArduinoBoard = { Board, drawBoard, pinLabel, ntcToAdc, luxToAdc, LED_COLORS };
})(window);
