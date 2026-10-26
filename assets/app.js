/* Aplikasi utama: navigasi, editor, terminal, widget materi, kuis, compiler, dan simulator. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const EX = window.EXAMPLES;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mpe:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mpe:' + k, JSON.stringify(v)); } catch (e) { /* penyimpanan tidak tersedia */ } }
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const icon = id => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const mimeOf = lang => (lang === 'c' ? 'text/x-csrc' : 'text/x-c++src');
  const fmtG = v => MiniC.floatFmt(v, 'g', 6, '');

  let toastTimer;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }
  function copyText(text) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? 'Kode disalin' : 'Gagal menyalin, pilih teks secara manual');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Kode disalin'), fallback);
    else fallback();
  }

  /* ============================== Tema ============================== */
  const rootEl = document.documentElement;
  function applyTheme(t) {
    if (t) rootEl.dataset.theme = t; else delete rootEl.dataset.theme;
    const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    $('#theme-btn use').setAttribute('href', dark ? '#i-sun' : '#i-moon');
  }
  applyTheme(store.get('theme', null));
  $('#theme-btn').addEventListener('click', () => {
    const cur = rootEl.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    store.set('theme', next);
    applyTheme(next);
  });

  /* ============================== Navigasi ============================== */
  const VIEWS = $$('.view').map(v => v.id.slice(2));
  const onShow = {}, onHide = {};
  let current = null;
  const sidebar = $('#sidebar'), scrim = $('#scrim');
  function openDrawer() { sidebar.classList.add('open'); scrim.hidden = false; $('#menu-btn').setAttribute('aria-expanded', 'true'); }
  function closeDrawer() { sidebar.classList.remove('open'); scrim.hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }
  $('#menu-btn').addEventListener('click', openDrawer);
  $('#tab-menu').addEventListener('click', openDrawer);
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  function route() {
    let id = decodeURIComponent(location.hash.slice(1)) || 'beranda';
    let anchor = null;
    if (!VIEWS.includes(id)) {
      const el = document.getElementById(id);
      const v = el && el.closest('.view');
      if (v) { anchor = el; id = v.id.slice(2); } else id = 'beranda';
    }
    if (current !== id) {
      if (current && onHide[current]) onHide[current]();
      $$('.view').forEach(v => { v.hidden = v.id !== 'v-' + id; });
      current = id;
      const view = $('#v-' + id);
      $('#topbar-title').textContent = view.dataset.title;
      document.title = view.dataset.title === 'Beranda' ? 'Modul Embedded C/C++' : view.dataset.title + ' · Modul Embedded C/C++';
      $$('.nav-link').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
      if (/^bab\d$/.test(id)) { store.set('lastBab', id); $('.tabbar [data-tab="materi"]').setAttribute('href', '#' + id); }
      const tab = /^bab\d$|^info$|^persiapan$|^peta$|^beranda$/.test(id) ? 'materi' : id === 'referensi' ? '' : id;
      $$('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
      if (onShow[id]) onShow[id]();
    }
    closeDrawer();
    if (anchor) requestAnimationFrame(() => anchor.scrollIntoView({ block: 'start' }));
    else window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  const lastBab = store.get('lastBab', 'bab1');
  $('.tabbar [data-tab="materi"]').setAttribute('href', '#' + lastBab);
  function go(id) { if (location.hash === '#' + id) route(); else location.hash = id; }

  /* ============================== Kemajuan & centang ============================== */
  const MEET = [
    [1, 1, 'Sistem embedded di sekitar kita, instal aplikasi', 'HP, kertas', 'Daftar 10 perangkat embedded di rumah'],
    [2, 1, 'Algoritma dan flowchart', 'Kertas', 'Flowchart lampu lalu lintas'],
    [3, 2, 'Program pertama, struktur program C, printf', 'Compiler', 'Program biodata'],
    [4, 2, 'Variabel, tipe data, scanf', 'Compiler', 'Kalkulator luas persegi panjang'],
    [5, 2, 'Operator aritmatika, perbandingan, logika', 'Compiler', 'Kalkulator hukum Ohm'],
    [6, 3, 'Percabangan if, else, switch', 'Compiler', 'Program kode warna resistor sederhana'],
    [7, 3, 'Perulangan for, while', 'Compiler', 'Tabel perkalian, hitung mundur'],
    [8, 4, 'Fungsi', 'Compiler', 'Fungsi hitung daya listrik'],
    [9, 4, 'Array dan pengenalan C++ (cout, cin)', 'Compiler', 'Rata-rata 5 data sensor'],
    [10, 0, 'Asesmen tengah semester (tertulis + praktik)', 'HP, kertas', 'Nilai sumatif 1'],
    [11, 5, 'Mengenal Arduino, setup() dan loop(), Blink', 'Simulator', 'LED berkedip'],
    [12, 5, 'Output digital: lampu lalu lintas, running LED', 'Simulator', 'Lampu lalu lintas 3 LED'],
    [13, 5, 'Input digital: tombol, if di Arduino', 'Simulator', 'LED nyala saat tombol ditekan'],
    [14, 6, 'Serial Monitor, input analog (potensiometer, sensor)', 'Simulator', 'Tampilan nilai sensor'],
    [15, 6, 'PWM: atur terang LED, buzzer', 'Simulator', 'LED redup-terang'],
    [16, 6, 'Presentasi mini proyek', 'Simulator', 'Proyek dan presentasi']
  ];
  const BAB_NAME = { 0: 'Asesmen tengah semester', 1: 'Bab 1 · Sistem embedded', 2: 'Bab 2 · Dasar bahasa C', 3: 'Bab 3 · Percabangan & perulangan', 4: 'Bab 4 · Fungsi, array, C++', 5: 'Bab 5 · Arduino di simulator', 6: 'Bab 6 · Serial, analog, PWM' };
  function updateProgress() {
    const done = MEET.filter(m => store.get('meet' + m[0], false)).length;
    $('#prog-text').textContent = `${done}/16`;
    $('#prog-bar').style.width = (done / 16 * 100) + '%';
  }
  function renderMeetings() {
    const box = $('#meet-list');
    let html = '', lastBab = -1;
    MEET.forEach(([no, bab, topik, alat, hasil]) => {
      if (bab !== lastBab) {
        if (lastBab !== -1) html += '</div>';
        html += `<div class="meet-group"><h3>${bab ? `<span class="rbar b${bab}"></span>` : ''}${bab ? `<a href="#bab${bab}">${esc(BAB_NAME[bab])}</a>` : esc(BAB_NAME[0])}</h3>`;
        lastBab = bab;
      }
      const on = store.get('meet' + no, false);
      html += `<label class="meet${on ? ' done' : ''}"><input type="checkbox" data-meet="${no}"${on ? ' checked' : ''}><span class="no">${no}</span><span class="t">${esc(topik)}</span><span class="d"><span>Alat: ${esc(alat)}</span><span>Hasil: ${esc(hasil)}</span></span></label>`;
    });
    box.innerHTML = html + '</div>';
    $$('input[data-meet]', box).forEach(cb => cb.addEventListener('change', () => {
      store.set('meet' + cb.dataset.meet, cb.checked);
      cb.closest('.meet').classList.toggle('done', cb.checked);
      updateProgress();
    }));
  }
  renderMeetings();
  updateProgress();
  $$('input[data-save]').forEach(cb => {
    cb.checked = store.get('chk:' + cb.dataset.save, false);
    cb.addEventListener('change', () => store.set('chk:' + cb.dataset.save, cb.checked));
  });

  /* ============================== Pewarnaan kode ============================== */
  function hlLines(code, mime) {
    const lines = [''];
    if (window.CodeMirror && CodeMirror.runMode) {
      CodeMirror.runMode(code, mime, (text, style) => {
        text.split('\n').forEach((part, i) => {
          if (i > 0) lines.push('');
          if (part) lines[lines.length - 1] += style ? `<span class="${style.split(' ').map(s => 'cm-' + s).join(' ')}">${esc(part)}</span>` : esc(part);
        });
      });
    } else {
      code.split('\n').forEach((l, i) => { if (i) lines.push(''); lines[lines.length - 1] = esc(l); });
    }
    return lines;
  }

  /* ============================== Editor ============================== */
  const SYMBOLS = ['Tab', '{', '}', '(', ')', ';', '"', "'", '<', '>', '=', '+', '-', '*', '/', '%', '&', '|', '!', '#', ',', '[', ']', '_', 'Undo'];
  function makeEditor(host, opts) {
    opts = opts || {};
    const api = { marks: [], nowHandle: null, lang: opts.lang || 'c' };
    if (window.CodeMirror) {
      const cm = CodeMirror(host, {
        value: opts.value || '', mode: opts.mime || mimeOf(api.lang), lineNumbers: true, matchBrackets: true, autoCloseBrackets: true,
        indentUnit: 4, tabSize: 4, indentWithTabs: false, lineWrapping: true, viewportMargin: opts.auto ? Infinity : 10,
        inputStyle: 'contenteditable', spellcheck: false, autocorrect: false, autocapitalize: false,
        extraKeys: { Tab: c => c.execCommand('indentMore'), 'Shift-Tab': c => c.execCommand('indentLess'), 'Ctrl-Enter': () => opts.onRun && opts.onRun(), 'Cmd-Enter': () => opts.onRun && opts.onRun() }
      });
      if (opts.auto) cm.setSize(null, 'auto');
      cm.on('change', () => opts.onChange && opts.onChange(cm.getValue()));
      Object.assign(api, {
        cm,
        get: () => cm.getValue(),
        set: v => { cm.setValue(v); cm.clearHistory(); },
        setMode: m => cm.setOption('mode', m),
        focus: () => cm.focus(),
        refresh: () => cm.refresh(),
        insert: t => {
          if (t === 'Tab') { cm.replaceSelection('    '); return; }
          if (t === 'Undo') { cm.undo(); return; }
          cm.replaceSelection(t);
        },
        mark: list => {
          api.clearMarks();
          list.forEach(({ line, kind }) => {
            const ln = Math.max(0, Math.min(cm.lineCount() - 1, line - 1));
            api.marks.push(cm.addLineClass(ln, 'background', kind === 'error' ? 'cm-line-error' : 'cm-line-warn'));
          });
        },
        clearMarks: () => { api.marks.forEach(h => cm.removeLineClass(h, 'background')); api.marks = []; },
        setNow: line => {
          if (api.nowHandle) { cm.removeLineClass(api.nowHandle, 'background', 'cm-line-now'); api.nowHandle = null; }
          if (line > 0 && line <= cm.lineCount()) {
            api.nowHandle = cm.addLineClass(line - 1, 'background', 'cm-line-now');
            if (opts.scrollNow) cm.scrollIntoView({ line: line - 1, ch: 0 }, 60);
          }
        },
        goto: (line, col) => { cm.focus(); cm.setCursor({ line: line - 1, ch: Math.max(0, (col || 1) - 1) }); cm.scrollIntoView(null, 80); }
      });
    } else {
      const ta = document.createElement('textarea');
      ta.className = 'plain'; ta.value = opts.value || ''; ta.spellcheck = false;
      ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocorrect', 'off');
      ta.setAttribute('aria-label', 'Editor kode');
      host.appendChild(ta);
      ta.addEventListener('input', () => opts.onChange && opts.onChange(ta.value));
      ta.addEventListener('keydown', e => {
        if (e.key === 'Tab') { e.preventDefault(); api.insert('Tab'); }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); opts.onRun && opts.onRun(); }
      });
      Object.assign(api, {
        get: () => ta.value,
        set: v => { ta.value = v; },
        setMode() {}, refresh() {}, focus: () => ta.focus(),
        insert: t => {
          if (t === 'Undo') { document.execCommand('undo'); return; }
          const s = t === 'Tab' ? '    ' : t;
          const a = ta.selectionStart, b = ta.selectionEnd;
          ta.setRangeText(s, a, b, 'end');
          ta.dispatchEvent(new Event('input'));
        },
        mark() {}, clearMarks() {}, setNow() {},
        goto: line => {
          const pos = ta.value.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
          ta.focus(); ta.setSelectionRange(pos, pos);
        }
      });
    }
    return api;
  }
  function buildSymbar(bar, editor) {
    bar.innerHTML = SYMBOLS.map(s => `<button type="button" class="${s.length > 1 ? 'wide' : ''}" data-s="${esc(s)}" aria-label="Sisipkan ${esc(s)}">${esc(s === 'Undo' ? '↶' : s === 'Tab' ? '⇥ Tab' : s)}</button>`).join('');
    bar.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });
    bar.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) editor.insert(b.dataset.s);
    });
  }

  /* ============================== Terminal ============================== */
  class Terminal {
    constructor(el) {
      el.classList.add('term');
      el.innerHTML = `<div class="term-head"><span class="dot"></span><span class="status">Siap</span><button type="button" class="t-clear">Bersihkan</button></div>
        <pre class="term-out" aria-live="polite"></pre>
        <div class="term-send"><span>Program menunggu input. Ketik di baris kuning, lalu Enter.</span><button type="button">Kirim</button></div>`;
      this.el = el;
      this.out = $('.term-out', el);
      this.dot = $('.dot', el);
      this.st = $('.status', el);
      this.pending = '';
      this.last = '\n';
      this.size = 0;
      this.inputEl = null;
      $('.t-clear', el).addEventListener('click', () => this.clear(true));
      $('.term-send button', el).addEventListener('click', () => this.submit());
      this.out.addEventListener('click', () => { if (this.inputEl) this.inputEl.focus(); });
    }
    write(text) {
      if (!text) return;
      this.pending += text;
      if (!this.raf) this.raf = requestAnimationFrame(() => this.flush());
    }
    flush() {
      this.raf = 0;
      if (!this.pending) return;
      const t = this.pending;
      this.pending = '';
      this.last = t[t.length - 1];
      this.size += t.length;
      const node = document.createTextNode(t);
      if (this.inputEl) this.out.insertBefore(node, this.inputEl); else this.out.appendChild(node);
      if (this.size > 120000) {
        while (this.out.firstChild && this.size > 80000) { this.size -= (this.out.firstChild.textContent || '').length; this.out.removeChild(this.out.firstChild); }
      }
      this.out.scrollTop = this.out.scrollHeight;
      if (this.onWrite) this.onWrite(this.out.textContent);
    }
    sys(text, cls) {
      this.flush();
      const s = document.createElement('span');
      s.className = cls || 'sys';
      s.textContent = (this.last !== '\n' ? '\n' : '') + text + '\n';
      this.last = '\n';
      this.out.appendChild(s);
      this.out.scrollTop = this.out.scrollHeight;
    }
    clear(keepStatus) {
      this.pending = ''; this.size = 0; this.last = '\n';
      const inp = this.inputEl;
      this.out.textContent = '';
      if (inp) this.out.appendChild(inp);
      if (!keepStatus) this.status('Siap', '');
    }
    status(text, state) {
      this.st.textContent = text;
      this.dot.className = 'dot' + (state ? ' ' + state : '');
    }
    text() { return this.out.textContent; }
    ask(cb) {
      this.flush();
      this.cancelAsk();
      const inp = document.createElement('input');
      inp.className = 'term-input';
      inp.type = 'text';
      inp.autocomplete = 'off';
      inp.setAttribute('autocapitalize', 'off');
      inp.setAttribute('aria-label', 'Input program');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.submit(); } });
      inp.addEventListener('input', () => { inp.style.width = Math.max(12, inp.value.length + 2) + 'ch'; });
      this.out.appendChild(inp);
      this.inputEl = inp;
      this.askCb = cb;
      this.el.classList.add('waiting');
      this.out.scrollTop = this.out.scrollHeight;
      try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
    }
    submit() {
      if (!this.inputEl) return;
      const v = this.inputEl.value;
      const cb = this.askCb;
      this.cancelAsk();
      const s = document.createElement('span');
      s.className = 'in';
      s.textContent = v + '\n';
      this.out.appendChild(s);
      this.last = '\n';
      cb && cb(v);
    }
    cancelAsk() {
      if (this.inputEl) this.inputEl.remove();
      this.inputEl = null;
      this.askCb = null;
      this.el.classList.remove('waiting');
    }
  }

  /* ============================== Menjalankan program konsol ============================== */
  function startConsole(res, term, h) {
    h = h || {};
    term.clear();
    term.status('Berjalan', 'run');
    const ctl = MiniC.run(res, {
      mode: 'console',
      stepMode: h.stepMode,
      io: { out: s => term.write(s), clear: () => term.clear(true) },
      onInput: () => {
        term.status('Menunggu input', 'wait');
        h.onInput && h.onInput();
        term.ask(v => { term.status('Berjalan', 'run'); ctl.input(v); });
      },
      onStep: (y, rt) => h.onStep && h.onStep(y, rt),
      onDone: code => {
        term.cancelAsk();
        term.flush();
        term.sys(`[Program selesai dengan kode ${code}]`);
        term.status('Selesai', '');
        h.onEnd && h.onEnd(true);
      },
      onError: e => {
        term.cancelAsk();
        term.flush();
        term.sys(e.message, 'bad');
        if (e.hint) term.sys('Petunjuk: ' + e.hint + (e.line ? ` (baris ${e.line})` : ''));
        term.status('Berhenti karena error', 'err');
        h.onError && h.onError(e);
        h.onEnd && h.onEnd(false);
      }
    });
    const stop = ctl.stop;
    ctl.stop = () => {
      if (!ctl.running) return;
      stop();
      term.cancelAsk();
      term.flush();
      term.sys('[Dihentikan]');
      term.status('Dihentikan', '');
      h.onEnd && h.onEnd(false);
    };
    return ctl;
  }

  function runHeadless(code, lang, input) {
    return new Promise(resolve => {
      const res = MiniC.compile(code, { mode: 'console', lang });
      if (!res.ok) { resolve({ res, out: '', ok: false }); return; }
      let out = '';
      const lines = (input || '').split('\n');
      const ctl = MiniC.run(res, {
        mode: 'console', maxCpuMs: 3000,
        io: { out: s => { out += s; }, clear() {} },
        onInput: () => { if (lines.length) ctl.input(lines.shift()); else { ctl.stop(); resolve({ res, out, ok: true, stuck: true }); } },
        onDone: () => resolve({ res, out, ok: true }),
        onError: e => resolve({ res, out, ok: true, err: e })
      });
    });
  }

  function renderDiags(box, list, file, onPick) {
    box.innerHTML = '';
    list.forEach(d => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'diag ' + (d.kind === 'warning' ? 'warning' : d.runtime ? 'runtime' : 'error');
      const loc = d.runtime ? (d.line ? `${file}:${d.line}: ` : '') : `${file}:${d.line}:${d.col}: `;
      const kind = d.runtime ? 'runtime error' : d.kind;
      b.innerHTML = `<span class="msg">${esc(loc)}<b>${esc(kind)}:</b> ${esc(d.message)}</span>${d.hint ? `<span class="hint">${esc(d.hint)}</span>` : ''}`;
      if (onPick && d.line) b.addEventListener('click', () => onPick(d.line, d.col));
      box.appendChild(b);
    });
  }

  /* ============================== Snippet kode di materi ============================== */
  const ANNOT = {
    hello: {
      1: '<code>#include &lt;stdio.h&gt;</code> memanggil pustaka yang berisi perintah <code>printf</code> dan <code>scanf</code>. Tulisan setelah <code>//</code> adalah komentar: tidak dijalankan, hanya catatan untuk manusia.',
      3: '<code>int main() { ... }</code> adalah pintu masuk program. Semua perintah ditulis di antara kurung kurawal.',
      4: '<code>printf("...")</code> menampilkan teks ke layar. <code>\\n</code> berarti pindah baris. Titik koma <code>;</code> menandai akhir satu perintah; lupa titik koma adalah error paling sering.',
      5: '<code>return 0;</code> menandakan program selesai dengan normal.',
      6: 'Kurung kurawal penutup <code>}</code> mengakhiri fungsi <code>main</code>.'
    }
  };
  function renderSnippet(el) {
    const ex = el.dataset.ex ? EX[el.dataset.ex] : null;
    const code = ex ? ex.code : (el.dataset.code || '');
    const ard = ex ? ex.mode === 'arduino' : /setup\s*\(/.test(code);
    const lang = ex ? (ex.lang || 'cpp') : 'c';
    const fname = el.dataset.name || (ard ? 'sketch.ino' : lang === 'cpp' ? 'main.cpp' : 'main.c');
    const lines = hlLines(code, ard ? 'text/x-c++src' : mimeOf(lang));
    const annot = el.dataset.annot ? ANNOT[el.dataset.annot] : null;
    let btns = '';
    if (ex && !ard) btns = `<button class="btn btn-primary small" type="button" data-act="run">${icon('play')}Jalankan</button><button class="btn btn-ghost small" type="button" data-act="step">${icon('step')}Langkah</button><button class="btn btn-ghost small" type="button" data-act="open">Edit di compiler</button>`;
    if (ex && ard) btns = `<button class="btn btn-primary small" type="button" data-act="sim">${icon('play')}Jalankan di simulator</button>`;
    btns += `<button class="btn btn-ghost small" type="button" data-act="copy" aria-label="Salin kode">${icon('copy')}Salin</button>`;
    el.innerHTML = `<div class="snippet-bar"><span class="fname">${esc(fname)}${ex ? ' · ' + esc(ex.title) : ''}</span>${btns}</div>
      <pre>${lines.map((l, i) => `<span class="ln${annot && annot[i + 1] ? ' click' : ''}" data-n="${i + 1}">${l || ' '}</span>`).join('')}</pre>
      ${annot ? '<div class="callout annot-box small" aria-live="polite">Ketuk baris bertanda untuk penjelasan.</div>' : ''}
      <div class="snippet-run" hidden><div class="term"></div><div class="diags" style="padding:8px"></div></div>`;
    if (annot) {
      const box = $('.annot-box', el);
      $$('.ln.click', el).forEach(ln => ln.addEventListener('click', () => {
        $$('.ln', el).forEach(x => x.classList.toggle('hl', x === ln));
        box.innerHTML = `<b class="t">Baris ${ln.dataset.n}</b><p>${annot[ln.dataset.n]}</p>`;
      }));
    }
    let term = null, ctl = null;
    const runBtn = $('[data-act="run"]', el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'copy') copyText(code);
      if (act === 'open') Compiler.open(el.dataset.ex);
      if (act === 'step') Compiler.open(el.dataset.ex, { step: true });
      if (act === 'sim') Sim.open(el.dataset.ex, 'code');
      if (act === 'run') {
        if (ctl && ctl.running) { ctl.stop(); return; }
        const runBox = $('.snippet-run', el);
        runBox.hidden = false;
        if (!term) term = new Terminal($('.term', runBox));
        const diagBox = $('.diags', runBox);
        const res = MiniC.compile(code, { mode: 'console', lang });
        renderDiags(diagBox, res.errors.concat(res.warnings), fname);
        diagBox.hidden = !diagBox.children.length;
        if (!res.ok) { term.clear(); term.status('Gagal dikompilasi', 'err'); return; }
        runBtn.innerHTML = icon('stop') + 'Stop';
        ctl = startConsole(res, term, { onEnd: () => { runBtn.innerHTML = icon('play') + 'Jalankan lagi'; } });
      }
    });
  }
  $$('.snippet').forEach(renderSnippet);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open]');
    if (b) Compiler.open(b.dataset.open);
  });

  /* ============================== Halaman compiler ============================== */
  const Compiler = {
    ready: false,
    lang: 'c',
    init() {
      if (this.ready) return;
      this.ready = true;
      this.lang = store.get('cc-lang', 'c');
      const saved = store.get('cc-code-' + this.lang, null);
      this.ed = makeEditor($('#cc-editor'), {
        value: saved || EX['b2-hello'].code, lang: this.lang, scrollNow: true,
        onChange: debounce(v => store.set('cc-code-' + this.lang, v), 400),
        onRun: () => this.run(false)
      });
      buildSymbar($('.symbar[data-for="cc"]'), this.ed);
      this.term = new Terminal($('#cc-term'));
      const sel = $('#cc-example');
      const groups = { 'Bab 2': [], 'Bab 3': [], 'Bab 4': [], 'Asesmen': [] };
      Object.entries(EX).forEach(([id, ex]) => {
        if (ex.mode === 'arduino') return;
        const g = id.startsWith('b2') ? 'Bab 2' : id.startsWith('b3') ? 'Bab 3' : id.startsWith('b4') ? 'Bab 4' : 'Asesmen';
        groups[g].push(`<option value="${id}">${esc(ex.title)}${ex.lang === 'cpp' ? ' (C++)' : ''}</option>`);
      });
      sel.innerHTML = '<option value="">Muat contoh dari modul…</option>' + Object.entries(groups).map(([g, o]) => `<optgroup label="${g}">${o.join('')}</optgroup>`).join('');
      sel.addEventListener('change', () => { if (sel.value) this.load(sel.value); sel.value = ''; });
      $$('#cc-lang button').forEach(b => b.addEventListener('click', () => this.setLang(b.dataset.lang, true)));
      $('#cc-run').addEventListener('click', () => this.run(false));
      $('#cc-step').addEventListener('click', () => this.run(true));
      $('#cc-stop').addEventListener('click', () => this.stop());
      $('#cc-copy').addEventListener('click', () => copyText(this.ed.get()));
      $('#cc-clear').addEventListener('click', () => {
        this.ed.set(this.lang === 'c' ? '#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n' : '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n');
        store.set('cc-code-' + this.lang, this.ed.get());
      });
      $('#cc-next').addEventListener('click', () => this.ctl && this.ctl.step());
      $('#cc-auto').addEventListener('click', () => this.toggleAuto());
      $('#cc-finish').addEventListener('click', () => { this.stopAuto(); if (this.ctl) this.ctl.setStepMode(false); this.endTrace(); });
      $$('#cc-tabs button').forEach(b => b.addEventListener('click', () => this.pane(b.dataset.p)));
      const tOut = document.createElement('pre');
      tOut.className = 'decl-out';
      tOut.id = 'cc-trace-out';
      tOut.setAttribute('aria-label', 'Output terakhir');
      $('#cc-trace .trace-stack').after(tOut);
      this.term.onWrite = text => { tOut.textContent = text.split('\n').slice(-4).join('\n') || '(belum ada output)'; };
      this.setLang(this.lang, false);
    },
    pane(p) {
      $('#cc-grid').dataset.pane = p;
      $$('#cc-tabs button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
      if (p === 'code') this.ed.refresh();
    },
    setLang(l, user) {
      if (user && l !== this.lang) {
        store.set('cc-code-' + this.lang, this.ed.get());
        const saved = store.get('cc-code-' + l, null);
        this.ed.set(saved || (l === 'c' ? EX['b2-hello'].code : EX['b4-cpp'].code));
      }
      this.lang = l;
      store.set('cc-lang', l);
      $$('#cc-lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === l));
      $('#cc-fname').textContent = l === 'c' ? 'main.c' : 'main.cpp';
      this.ed.setMode(mimeOf(l));
    },
    load(id) {
      const ex = EX[id];
      this.stop();
      this.setLang(ex.lang || 'c', false);
      this.ed.set(ex.code);
      store.set('cc-code-' + this.lang, ex.code);
      this.ed.clearMarks();
      $('#cc-diags').innerHTML = '';
      this.term.clear();
      this.pane('code');
    },
    open(id, opts) {
      go('compiler');
      this.init();
      this.load(id);
      requestAnimationFrame(() => { this.ed.refresh(); if (opts && opts.step) this.run(true); });
    },
    busy(on) {
      $('#cc-run').disabled = on;
      $('#cc-step').disabled = on;
      $('#cc-stop').disabled = !on;
    },
    run(step) {
      this.stop();
      const code = this.ed.get();
      const res = MiniC.compile(code, { mode: 'console', lang: this.lang, trace: step });
      const file = this.lang === 'c' ? 'main.c' : 'main.cpp';
      const diags = res.errors.concat(res.warnings);
      this.ed.mark(diags.map(d => ({ line: d.line, kind: d.kind })));
      renderDiags($('#cc-diags'), diags, file, (l, c) => { this.pane('code'); this.ed.goto(l, c); });
      if (!res.ok) {
        this.term.clear();
        this.term.sys(`Kompilasi gagal: ${res.errors.length} error. Lihat daftar di bawah editor.`, 'bad');
        this.term.status('Gagal dikompilasi', 'err');
        this.pane('code');
        return;
      }
      this.busy(true);
      this.prevVals = {};
      if (step) { $('#cc-trace').hidden = false; $('#cc-trace-out').textContent = '(belum ada output)'; this.pane('code'); }
      else this.pane('run');
      this.ctl = startConsole(res, this.term, {
        stepMode: step,
        onInput: () => { if (!step) this.pane('run'); else this.pane('run'); },
        onStep: y => this.showStep(y),
        onError: e => {
          const d = Object.assign({ runtime: true, message: e.message, hint: e.hint, line: e.line }, {});
          renderDiags($('#cc-diags'), [d].concat(diags), file, (l) => { this.pane('code'); this.ed.goto(l); });
          if (e.line) this.ed.mark([{ line: e.line, kind: 'error' }]);
        },
        onEnd: () => { this.busy(false); this.endTrace(); }
      });
    },
    showStep(y) {
      if (this.ctlPaneTimer) clearTimeout(this.ctlPaneTimer);
      if ($('#cc-grid').dataset.pane !== 'code' && !this.term.inputEl) this.pane('code');
      this.ed.setNow(y.l);
      $('#cc-trace-line').textContent = 'baris ' + y.l;
      const vals = y.v();
      const rows = y.n.map(([name, type], k) => {
        const shown = showVal(vals[k], type);
        const changed = this.prevVals[name] !== undefined && this.prevVals[name] !== shown;
        this.prevVals[name] = shown;
        return `<tr class="${changed ? 'changed' : ''}"><td>${esc(name)}</td><td class="muted">${esc(type)}</td><td class="v">${esc(shown)}</td></tr>`;
      });
      $('#cc-trace-vars').innerHTML = rows.join('') || '<tr><td colspan="3" class="muted">Belum ada variabel di bagian ini.</td></tr>';
      $('#cc-trace-stack').textContent = 'Fungsi aktif: ' + (this.ctl ? this.ctl.rt.stk.join(' → ') : '');
      if (this.auto) this.autoTimer = setTimeout(() => this.ctl && this.ctl.step(), 650);
    },
    toggleAuto() {
      this.auto = !this.auto;
      $('#cc-auto').innerHTML = this.auto ? icon('stop') + 'Jeda' : icon('play') + 'Otomatis';
      if (this.auto && this.ctl) this.ctl.step();
      if (!this.auto) clearTimeout(this.autoTimer);
    },
    stopAuto() { this.auto = false; clearTimeout(this.autoTimer); $('#cc-auto').innerHTML = icon('play') + 'Otomatis'; },
    endTrace() {
      this.stopAuto();
      this.ed.setNow(0);
      $('#cc-trace').hidden = true;
    },
    stop() {
      this.stopAuto();
      if (this.ctl && this.ctl.running) this.ctl.stop();
      this.ctl = null;
      this.busy(false);
      if (this.ed) this.ed.setNow(0);
      $('#cc-trace').hidden = true;
    }
  };
  function showVal(v, type) {
    if (Array.isArray(v)) {
      if (/^char \[/.test(type) || /^char\b.*\[/.test(type)) {
        if (!Array.isArray(v[0])) return '"' + MiniC.formatC('%s', [v], 'a') + '"';
      }
      const inner = v.map(x => showVal(x, type.replace(/\[[^\]]*\]/, '').trim()));
      return '{' + inner.join(', ') + '}';
    }
    if (typeof v === 'string') return JSON.stringify(v);
    if (v === undefined) return '?';
    if (/^(float|double)/.test(type)) return fmtG(v);
    if (/^char\b/.test(type) || type === 'unsigned char') return v >= 32 && v < 127 ? `'${String.fromCharCode(v)}' (${v})` : String(v);
    if (/^(bool|_Bool)/.test(type)) return v ? 'true (1)' : 'false (0)';
    return String(v);
  }
  onShow.compiler = () => { Compiler.init(); requestAnimationFrame(() => Compiler.ed.refresh()); };

  /* ============================== Halaman simulator ============================== */
  const Sim = {
    ready: false,
    init() {
      if (this.ready) return;
      this.ready = true;
      const saved = store.get('sim-code', null);
      this.ed = makeEditor($('#sim-editor'), {
        value: saved || EX['ard-blink'].code, mime: 'text/x-c++src', lang: 'cpp',
        onChange: debounce(v => store.set('sim-code', v), 400),
        onRun: () => this.run()
      });
      buildSymbar($('.symbar[data-for="sim"]'), this.ed);
      this.lastLine = 0;
      this.sim = new ArduinoSim({
        boardEl: $('#sim-board'), partsEl: $('#sim-parts'), pinsEl: $('#sim-pins'), serialEl: $('#sim-serial'), idPrefix: 'sim',
        onNote: msg => { const d = document.createElement('div'); d.className = 'note'; d.textContent = msg; $('#sim-notes').appendChild(d); },
        onError: e => {
          renderDiags($('#sim-diags'), [{ runtime: true, message: e.message, hint: e.hint, line: e.line }], 'sketch.ino', l => { this.pane('code'); this.ed.goto(l); });
          this.setRunning(false);
        },
        onReset: () => { if (this.sim.running) this.run(); },
        onFrame: s => {
          const l = s.currentLine();
          if (l !== this.lastLine) { this.lastLine = l; this.ed.setNow(l); }
        }
      });
      const comps = store.get('sim-parts', null);
      this.sim.setComponents(comps || EX['ard-blink'].parts);
      const sel = $('#sim-example');
      const g1 = [], g2 = [], g3 = [];
      Object.entries(EX).forEach(([id, ex]) => {
        if (ex.mode !== 'arduino') return;
        const opt = `<option value="${id}">${esc(ex.title)}</option>`;
        if (id.startsWith('proj')) { g3.push(`<option value="${id}|skeleton">${esc(ex.title)} (kerangka)</option>`, `<option value="${id}|code">${esc(ex.title)} (contoh jadi)</option>`); }
        else if (['ard-serial', 'ard-pot', 'ard-pwm', 'ard-buzzer'].includes(id)) g2.push(opt);
        else g1.push(opt);
      });
      sel.innerHTML = '<option value="">Muat contoh sketch…</option>' + `<optgroup label="Bab 5">${g1.join('')}</optgroup><optgroup label="Bab 6">${g2.join('')}</optgroup><optgroup label="Mini proyek">${g3.join('')}</optgroup>`;
      sel.addEventListener('change', () => {
        if (sel.value) { const [id, v] = sel.value.split('|'); this.load(id, v || 'code'); }
        sel.value = '';
      });
      $('#sim-run').addEventListener('click', () => this.run());
      $('#sim-stop').addEventListener('click', () => this.stop());
      $('#sim-copy').addEventListener('click', () => copyText(this.ed.get()));
      $$('#sim-add [data-add]').forEach(b => b.addEventListener('click', () => { this.sim.addPart(b.dataset.add); this.saveParts(); toast(b.textContent.trim() + ' ditambahkan'); }));
      $('#sim-parts').addEventListener('change', () => this.saveParts());
      $('#sim-parts').addEventListener('click', e => { if (e.target.closest('.part-rm')) setTimeout(() => this.saveParts(), 0); });
      $$('#sim-tabs button').forEach(b => b.addEventListener('click', () => this.pane(b.dataset.p)));
      const muted = store.get('sim-muted', false);
      this.setMuted(muted);
      $('#sim-sound').addEventListener('click', () => this.setMuted(!this.sim.sound.muted));
    },
    setMuted(m) {
      this.sim.setMuted(m);
      store.set('sim-muted', m);
      const b = $('#sim-sound');
      b.setAttribute('aria-pressed', m ? 'true' : 'false');
      b.setAttribute('aria-label', m ? 'Nyalakan suara buzzer' : 'Matikan suara buzzer');
      $('use', b).setAttribute('href', m ? '#i-mute' : '#i-sound');
    },
    saveParts() { store.set('sim-parts', this.sim.board.components.map(c => { const o = Object.assign({}, c); delete o.id; delete o.pressed; return o; })); },
    pane(p) {
      $('#sim-grid').dataset.pane = p;
      $$('#sim-tabs button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
      if (p === 'code') this.ed.refresh(); else this.sim.drawPlot();
    },
    load(id, variant) {
      const ex = EX[id];
      this.stop();
      const code = variant === 'skeleton' && ex.skeleton ? ex.skeleton : ex.code;
      this.ed.set(code);
      store.set('sim-code', code);
      this.sim.setComponents(ex.parts || []);
      this.saveParts();
      $('#sim-diags').innerHTML = '';
      this.ed.clearMarks();
    },
    open(id, variant) {
      this.init();
      this.load(id, variant);
      this.run();
      go('simulator');
      requestAnimationFrame(() => this.ed.refresh());
    },
    setRunning(on) {
      $('#sim-run').innerHTML = icon(on ? 'reset' : 'play') + (on ? 'Ulang' : 'Jalankan');
      $('#sim-stop').disabled = !on;
      const st = $('#sim-status');
      st.textContent = on ? 'berjalan' : 'berhenti';
      st.className = 'tag' + (on ? ' ok' : '');
      if (!on) { this.ed.setNow(0); this.lastLine = 0; }
    },
    run() {
      $('#sim-notes').innerHTML = '';
      const res = this.sim.run(this.ed.get());
      const diags = res.errors.concat(res.warnings);
      this.ed.mark(diags.map(d => ({ line: d.line, kind: d.kind })));
      renderDiags($('#sim-diags'), diags, 'sketch.ino', (l, c) => { this.pane('code'); this.ed.goto(l, c); });
      if (!res.ok) { this.setRunning(false); this.pane('code'); return; }
      this.saveParts();
      this.setRunning(true);
      this.pane('run');
    },
    stop() {
      if (this.sim) this.sim.stop();
      this.setRunning(false);
    }
  };
  onShow.simulator = () => { Sim.init(); requestAnimationFrame(() => Sim.ed.refresh()); };
  onHide.simulator = () => { if (Sim.sim && Sim.sim.running) Sim.stop(); };

  /* ============================== Beranda: demo Blink ============================== */
  const Hero = {
    start() {
      if (!this.ui) {
        this.board = new ArduinoBoard.Board({});
        this.ui = ArduinoBoard.drawBoard($('#hero-board'), {});
        this.code = EX['ard-blink'].code;
        $('#hero-code').innerHTML = hlLines(this.code, 'text/x-c++src').map(l => `<span class="ln">${l || ' '}</span>`).join('');
        this.lines = $$('#hero-code .ln');
        this.res = MiniC.compile(this.code, { mode: 'arduino' });
      }
      if (this.ctl) return;
      this.board.reset();
      this.ctl = MiniC.run(this.res, { mode: 'arduino', io: { board: this.board, out() {}, serial() {} } });
      const tick = () => {
        if (!this.ctl) return;
        const on = this.board.pinLevel(13) > 0.5;
        this.ui.holes[13].classList.toggle('on', on);
        this.ui.ledL.classList.toggle('lit', on);
        this.ui.ledON.classList.add('lit');
        $('#hero-led-lit').setAttribute('opacity', on ? '1' : '0');
        $('#hero-led-lit').parentNode.style.filter = on ? 'drop-shadow(0 0 10px #ff3b30)' : 'none';
        $('#hero-led-state').textContent = on ? 'HIGH' : 'LOW';
        const L = this.ctl.rt.L;
        this.lines.forEach((ln, i) => ln.classList.toggle('now', i + 1 === L));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    stop() { if (this.ctl) { this.ctl.stop(); this.ctl = null; } }
  };
  onShow.beranda = () => Hero.start();
  onHide.beranda = () => Hero.stop();

  /* ============================== Bab 1 ============================== */
  const IPO = {
    'Rice cooker': { i: ['Sensor suhu', 'Tombol Cook'], p: 'Jika suhu > 103°C, pindah ke mode hangat.', o: ['Mematikan pemanas', 'Menyalakan lampu Warm'] },
    'Dispenser': { i: ['Sensor suhu air', 'Tombol pemanas'], p: 'Jika air belum cukup panas, nyalakan pemanas; jika sudah, matikan.', o: ['Elemen pemanas', 'Lampu indikator'] },
    'Mesin cuci': { i: ['Tombol program', 'Sensor level air', 'Sensor pintu'], p: 'Isi air sampai level, putar motor sesuai waktu, buang air, lalu peras.', o: ['Katup air', 'Motor', 'Pompa buang', 'Layar sisa waktu'] },
    'Lampu lalu lintas': { i: ['Pewaktu (timer) internal', 'Tombol penyeberang (bila ada)'], p: 'Merah 5 detik, kuning 2 detik, hijau 5 detik, ulangi.', o: ['Lampu merah, kuning, hijau'] },
    'Remote TV': { i: ['Tombol-tombol'], p: 'Ubah tombol yang ditekan menjadi kode perintah.', o: ['LED inframerah memancarkan kode'] },
    'Pompa air otomatis': { i: ['Sensor level / pelampung tandon'], p: 'Jika tandon kosong, nyalakan pompa; jika penuh, matikan.', o: ['Relay pompa air'] }
  };
  (function ipo() {
    const tabs = $('#ipo-tabs'), body = $('#ipo-body');
    const names = Object.keys(IPO);
    tabs.innerHTML = names.map((n, i) => `<button type="button" role="tab" class="${i ? '' : 'on'}" aria-selected="${i ? 'false' : 'true'}">${esc(n)}</button>`).join('');
    const show = n => {
      const d = IPO[n];
      body.innerHTML = `<div class="i"><b>Input</b><span class="small">${d.i.map(esc).join('<br>')}</span></div><div class="p"><b>Proses</b><span class="small">${esc(d.p)}</span></div><div class="o"><b>Output</b><span class="small">${d.o.map(esc).join('<br>')}</span></div>`;
    };
    tabs.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      $$('button', tabs).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      show(b.textContent);
    });
    show(names[0]);
  })();

  (function cooker() {
    const lines = [
      'void loop() {',
      '  suhu = bacaSensorSuhu();            // INPUT',
      '  if (mode == MASAK && suhu > 103) {',
      '    mode = HANGAT;                    // PROSES',
      '  }',
      '  if (mode == MASAK) pemanasPenuh();  // OUTPUT',
      '  else if (mode == HANGAT) jagaHangat();',
      '}'
    ];
    const code = $('#ck-code');
    code.innerHTML = lines.map(l => `<span>${esc(l)}</span>`).join('');
    const spans = $$('span', code);
    let mode = 'SIAP', temp = 30, timer = null;
    const paint = (run, hit) => spans.forEach((s, i) => { s.className = hit.includes(i) ? 'hit' : run.includes(i) ? 'run' : ''; });
    const render = () => {
      $('#ck-temp').textContent = Math.round(temp) + '°C';
      $('#ck-cook').setAttribute('fill', mode === 'MASAK' ? '#ff4a3d' : '#4a2a2a');
      $('#ck-warm').setAttribute('fill', mode === 'HANGAT' ? '#ffb020' : '#4a442a');
      $('#ck-state').textContent = mode === 'SIAP' ? 'Siap' : mode === 'MASAK' ? 'Memasak: pemanas penuh' : 'Mode hangat: pemanas dijaga';
    };
    const tick = () => {
      if (current !== 'bab1') { clearInterval(timer); timer = null; return; }
      if (mode === 'MASAK') {
        temp += 1.6;
        if (temp > 103) { mode = 'HANGAT'; paint([1, 2], [3]); render(); return; }
        paint([1, 2, 5], []);
      } else if (mode === 'HANGAT') {
        temp = temp > 72 ? temp - 0.8 : 72 + Math.random();
        paint([1, 2, 6], []);
      }
      render();
    };
    $('#ck-start').addEventListener('click', () => {
      mode = 'MASAK';
      if (!timer) timer = setInterval(tick, 110);
      render();
    });
    $('#ck-reset').addEventListener('click', () => { mode = 'SIAP'; temp = 30; clearInterval(timer); timer = null; paint([], []); render(); });
    render();
  })();

  (function order() {
    const SETS = {
      kamar: { label: 'Lampu kamar otomatis', prompt: 'Urutkan algoritma lampu kamar otomatis dari langkah pertama.', steps: ['Mulai.', 'Baca sensor cahaya.', 'Jika ruangan gelap, nyalakan lampu.', 'Jika ruangan terang, matikan lampu.', 'Ulangi ke langkah 2.'] },
      tl: { label: 'Lampu lalu lintas', prompt: 'Urutkan algoritma lampu lalu lintas (merah 5 detik, kuning 2 detik, hijau 5 detik).', steps: ['Mulai.', 'Nyalakan lampu merah, tunggu 5 detik.', 'Matikan merah, nyalakan kuning, tunggu 2 detik.', 'Matikan kuning, nyalakan hijau, tunggu 5 detik.', 'Matikan hijau, ulangi ke langkah 2.'] },
      mi: { label: 'Membuat mi instan', prompt: 'Soal asesmen diagnostik: urutkan langkah membuat mi instan rebus.', steps: ['Isi panci dengan air.', 'Rebus air sampai mendidih.', 'Masukkan mi, masak sekitar 3 menit.', 'Tuang mi dan kuahnya ke mangkuk.', 'Campurkan bumbu, aduk rata.', 'Sajikan.'] }
    };
    const tabs = $('#order-tabs'), pool = $('#order-pool'), picked = $('#order-picked'), verdict = $('#order-verdict');
    let key = 'kamar', left = [], chosen = [];
    tabs.innerHTML = Object.entries(SETS).map(([k, s], i) => `<button type="button" role="tab" data-k="${k}" class="${i ? '' : 'on'}" aria-selected="${i ? 'false' : 'true'}">${esc(s.label)}</button>`).join('');
    const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
    const reset = () => {
      const s = SETS[key];
      $('#order-prompt').textContent = s.prompt;
      do { left = shuffle(s.steps.map((t, i) => i)); } while (left.every((v, i) => v === i));
      chosen = [];
      verdict.textContent = ''; verdict.className = 'verdict';
      picked.className = 'order-picked';
      draw();
    };
    const draw = () => {
      const s = SETS[key];
      pool.innerHTML = left.map(i => `<button type="button" data-i="${i}">${esc(s.steps[i])}</button>`).join('') || '<span class="small muted">Semua langkah sudah dipilih.</span>';
      picked.innerHTML = chosen.map((i, n) => `<button type="button" data-i="${i}"><span class="n">${n + 1}.</span>${esc(s.steps[i])}</button>`).join('') || '<span class="small muted">Belum ada langkah.</span>';
    };
    pool.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i; left = left.filter(x => x !== i); chosen.push(i); picked.className = 'order-picked'; verdict.textContent = ''; draw(); });
    picked.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i; chosen = chosen.filter(x => x !== i); left.push(i); picked.className = 'order-picked'; verdict.textContent = ''; draw(); });
    $('#order-check').addEventListener('click', () => {
      const n = SETS[key].steps.length;
      if (chosen.length < n) { verdict.textContent = `Pilih semua ${n} langkah dulu.`; verdict.className = 'verdict bad'; return; }
      const ok = chosen.every((v, i) => v === i);
      picked.className = 'order-picked ' + (ok ? 'ok' : 'bad');
      $$('button', picked).forEach((b, i) => b.classList.toggle('wrong', chosen[i] !== i));
      verdict.textContent = ok ? 'Tepat! Algoritmanya jelas, berurutan, dan punya akhir (atau sengaja diulang).' : 'Belum tepat. Langkah berwarna merah masih salah posisi; ketuk untuk mengembalikannya.';
      verdict.className = 'verdict ' + (ok ? 'ok' : 'bad');
    });
    $('#order-reset').addEventListener('click', reset);
    tabs.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      key = b.dataset.k;
      $$('button', tabs).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      reset();
    });
    reset();
  })();

  (function flow() {
    let which = 'tl', speed = 1, gelap = 1, timer = null, running = false, idx = 0;
    const TL = [['tl-start', 700, null], ['tl-red', 5000, 'r'], ['tl-yellow', 2000, 'y'], ['tl-green', 5000, 'g']];
    const LAMP = { r: '#ff3b30', y: '#ffd60a', g: '#30d158' };
    const lamps = { r: $('#lamp-r'), y: $('#lamp-y'), g: $('#lamp-g') };
    const clear = () => { $$('#w-flow .fl-shape').forEach(s => s.classList.remove('on')); Object.values(lamps).forEach(l => l.style.fill = ''); };
    const stop = () => { clearTimeout(timer); timer = null; running = false; $('#flow-play').innerHTML = icon('play') + 'Jalankan'; };
    const stepTL = () => {
      if (current !== 'bab1') { stop(); clear(); return; }
      const [id, ms, lamp] = TL[idx];
      clear();
      $('#' + id).classList.add('on');
      if (lamp) lamps[lamp].style.fill = LAMP[lamp];
      idx = idx >= TL.length - 1 ? 1 : idx + 1;
      timer = setTimeout(stepTL, ms / speed);
    };
    let kSeq = [], kIdx = 0;
    const stepKamar = () => {
      if (current !== 'bab1') { stop(); clear(); return; }
      if (kIdx >= kSeq.length) { kSeq = ['km-read', 'km-dec', gelap ? 'km-on' : 'km-off']; kIdx = 0; }
      const id = kSeq[kIdx++];
      clear();
      $('#' + id).classList.add('on');
      timer = setTimeout(stepKamar, 1100 / speed);
    };
    $('#flow-play').addEventListener('click', () => {
      if (running) { stop(); return; }
      running = true;
      $('#flow-play').innerHTML = icon('stop') + 'Hentikan';
      if (which === 'tl') { idx = 0; stepTL(); } else { kSeq = ['km-start', 'km-read', 'km-dec', gelap ? 'km-on' : 'km-off']; kIdx = 0; stepKamar(); }
    });
    $$('#flow-tabs button').forEach(b => b.addEventListener('click', () => {
      stop(); clear();
      which = b.dataset.f;
      $$('#flow-tabs button').forEach(x => x.classList.toggle('on', x === b));
      $('#flow-tl').hidden = which !== 'tl';
      $('#flow-kamar').hidden = which === 'tl';
      $('#flow-light').style.visibility = which === 'tl' ? 'visible' : 'hidden';
      $('#flow-cond').hidden = which === 'tl';
    }));
    $$('#flow-speed button').forEach(b => b.addEventListener('click', () => { speed = +b.dataset.s; $$('#flow-speed button').forEach(x => x.classList.toggle('on', x === b)); }));
    $$('#flow-cond button').forEach(b => b.addEventListener('click', () => { gelap = +b.dataset.c; $$('#flow-cond button').forEach(x => x.classList.toggle('on', x === b)); }));
  })();

  /* ============================== Bab 2 ============================== */
  (function varMaker() {
    const KW = new Set(['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', 'bool', 'true', 'false', 'class', 'new', 'delete', 'using', 'namespace']);
    const upd = () => {
      const name = $('#var-name').value, type = $('#var-type').value, raw = $('#var-val').value.trim();
      const res = $('#var-res'), out = $('#var-out');
      let msg = '', ok = true;
      if (!name) { ok = false; msg = 'Nama tidak boleh kosong.'; }
      else if (/\s/.test(name)) { ok = false; msg = 'Tidak boleh ada spasi. Gunakan huruf besar di tengah (jumlahLed) atau garis bawah (jumlah_led).'; }
      else if (/^[0-9]/.test(name)) { ok = false; msg = 'Tidak boleh diawali angka. Coba led1 (bukan 1led).'; }
      else if (/[^A-Za-z0-9_]/.test(name)) { ok = false; msg = `Karakter "${name.match(/[^A-Za-z0-9_]/)[0]}" tidak boleh dipakai. Hanya huruf, angka, dan garis bawah _.`; }
      else if (KW.has(name)) { ok = false; msg = `"${name}" adalah kata kunci C/C++, tidak boleh jadi nama variabel.`; }
      else { msg = 'Nama valid.' + (/[A-Z]/.test(name) ? ` Ingat: ${name} berbeda dengan ${name.toLowerCase()}.` : ''); }
      let val = raw, note = '';
      if (ok) {
        if (type === 'char') {
          if ([...raw].length !== 1) { ok = false; msg += ' Nilai char harus tepat satu karakter, misal M.'; }
          else val = `'${raw}'`;
        } else if (raw === '' || isNaN(Number(raw))) { ok = false; msg += ' Nilai harus berupa angka (pakai titik untuk desimal, misal 4.5).'; }
        else if (type === 'int' && !Number.isInteger(Number(raw))) { val = String(Math.trunc(Number(raw))); note = `  // ${raw} dipotong menjadi ${val} karena int tidak menyimpan desimal`; }
        else if (type === 'float' && !/[.eE]/.test(raw)) val = raw + '.0';
      }
      res.textContent = msg;
      res.className = 'res ' + (ok ? 'ok' : 'bad');
      if (!ok) { out.textContent = '// perbaiki dulu nama atau nilainya'; return; }
      const fmt = { int: '%d', float: '%f', char: '%c' }[type];
      const shown = type === 'int' ? val : type === 'char' ? raw : MiniC.formatC('%f', [Number(raw)], 'f');
      out.textContent = `${type} ${name} = ${val};${note}\nprintf("${fmt}\\n", ${name});   // tampil: ${shown}` + (type === 'float' ? `\nprintf("%.1f\\n", ${name}); // tampil: ${MiniC.formatC('%.1f', [Number(raw)], 'f')}` : '');
    };
    ['#var-name', '#var-type', '#var-val'].forEach(s => $(s).addEventListener('input', upd));
    upd();
  })();

  (function opLab() {
    let type = 'int';
    const upd = () => {
      let a = Number($('#op-a').value), b = Number($('#op-b').value);
      const rows = [];
      if (!isFinite(a) || !isFinite(b)) { $('#op-table tbody').innerHTML = '<tr><td colspan="3">Isi a dan b dengan angka.</td></tr>'; return; }
      const cut = type === 'int' && (!Number.isInteger(a) || !Number.isInteger(b));
      if (type === 'int') { a = Math.trunc(a); b = Math.trunc(b); }
      const f = v => (type === 'int' ? String(v) : fmtG(v));
      rows.push(['a + b', f(a + b), '']);
      rows.push(['a - b', f(a - b), '']);
      rows.push(['a * b', f(a * b), '']);
      if (b === 0) rows.push(['a / b', 'error', type === 'int' ? 'Floating point exception: pembagian int dengan nol membuat program berhenti.' : 'Hasilnya inf (tak hingga).']);
      else if (type === 'int') rows.push(['a / b', String(Math.trunc(a / b)), a % b !== 0 ? `Desimalnya dibuang (aslinya ${fmtG(a / b)}).` : '']);
      else rows.push(['a / b', fmtG(a / b), '']);
      if (type === 'int') rows.push(['a % b', b === 0 ? 'error' : String(a % b), 'Sisa bagi.']);
      else rows.push(['a % b', 'error', 'invalid operands to binary %: operator % hanya untuk int.']);
      rows.push(['a == b', String(+(a === b)), '1 = benar, 0 = salah']);
      rows.push(['a != b', String(+(a !== b)), '']);
      rows.push(['a > b', String(+(a > b)), '']);
      rows.push(['(a > 0) && (b > 0)', String(+(a > 0 && b > 0)), 'Benar hanya jika keduanya benar.']);
      rows.push(['(a > 0) || (b > 0)', String(+(a > 0 || b > 0)), 'Benar jika salah satu benar.']);
      $('#op-table tbody').innerHTML = rows.map(([e, r, k]) => `<tr><td><code>${esc(e)}</code></td><td class="res-num">${esc(r)}</td><td class="small muted">${esc(k)}</td></tr>`).join('') +
        (cut ? '<tr><td colspan="3" class="small muted">Catatan: a dan b bertipe int, jadi angka desimal yang kamu ketik dipotong.</td></tr>' : '');
    };
    ['#op-a', '#op-b'].forEach(s => $(s).addEventListener('input', upd));
    $$('#op-type button').forEach(b => b.addEventListener('click', () => { type = b.dataset.t; $$('#op-type button').forEach(x => x.classList.toggle('on', x === b)); upd(); }));
    upd();
  })();

  /* ============================== Bab 3 ============================== */
  (function ifViz() {
    const lines = ['if (suhu > 30) {', '    printf("Kipas: NYALA\\n");', '} else if (suhu > 25) {', '    printf("Kipas: PELAN\\n");', '} else {', '    printf("Kipas: MATI\\n");', '}'];
    $('#if-code').innerHTML = lines.map(l => `<span>${esc(l)}</span>`).join('');
    const spans = $$('#if-code span');
    const fan = $('#fan');
    const upd = () => {
      const s = +$('#if-suhu').value;
      $('#if-out').textContent = s;
      let checked, hit, out, dur;
      if (s > 30) { checked = [0]; hit = [1]; out = 'NYALA'; dur = 0.35; }
      else if (s > 25) { checked = [0, 2]; hit = [3]; out = 'PELAN'; dur = 1.2; }
      else { checked = [0, 2, 4]; hit = [5]; out = 'MATI'; dur = 0; }
      spans.forEach((sp, i) => { sp.className = hit.includes(i) ? 'hit' : checked.includes(i) ? 'run' : 'skip'; });
      $('#if-term').textContent = `suhu = ${s}  →  ${s > 30 ? `${s} > 30 benar` : s > 25 ? `${s} > 30 salah, ${s} > 25 benar` : `${s} > 30 salah, ${s} > 25 salah, masuk else`}\nKipas: ${out}`;
      fan.style.animation = dur ? `spin ${dur}s linear infinite` : 'none';
    };
    $('#if-suhu').addEventListener('input', upd);
    upd();
  })();

  (function switchViz() {
    const NAMES = ['Hitam', 'Coklat', 'Merah', 'Oranye'];
    const COLORS = ['#141414', '#7b4a2b', '#c8352c', '#e07b24', '#e8c21c', '#2e8b57'];
    const upd = () => {
      const p = +$('#sw-pita').value, nob = $('#sw-nobreak').checked;
      const lines = ['switch (pita) {'];
      NAMES.forEach((n, i) => lines.push(`    case ${i}: printf("${n}\\n");${nob ? '' : ' '.repeat(7 - n.length) + 'break;'}`));
      lines.push('    default: printf("Di luar pilihan\\n");', '}');
      $('#sw-code').innerHTML = lines.map(l => `<span>${esc(l)}</span>`).join('');
      const start = p <= 3 ? p + 1 : 5;
      const hits = nob ? Array.from({ length: 6 - start }, (_, k) => start + k) : [start];
      $$('#sw-code span').forEach((s, i) => { s.className = hits.includes(i) ? 'hit' : i === 0 ? 'run' : 'skip'; });
      const outs = hits.map(i => (i === 5 ? 'Di luar pilihan' : NAMES[i - 1]));
      $('#sw-term').textContent = outs.join('\n') + (nob && outs.length > 1 ? '\n\n← tanpa break, semua case di bawahnya ikut dijalankan' : '');
      $('#sw-band').setAttribute('fill', COLORS[p]);
    };
    $('#sw-pita').addEventListener('change', upd);
    $('#sw-nobreak').addEventListener('change', upd);
    upd();
  })();

  (function forViz() {
    const lines = ['for (int i = 1; i <= 5; i++) {', '    printf("LED ke-%d menyala\\n", i);', '}'];
    $('#for-code').innerHTML = lines.map(l => `<span>${esc(l)}</span>`).join('');
    const spans = $$('#for-code span');
    $('#for-bulbs').innerHTML = [1, 2, 3, 4, 5].map(n => `<span class="bulb" data-n="${n}">${n}</span>`).join('');
    let phase = 'start', i = 0, n = 0, timer = null;
    const set = (hl, text) => { spans.forEach((s, k) => { s.className = k === hl ? 'hit' : ''; }); $('#for-explain').textContent = text; };
    const bulbs = on => $$('#for-bulbs .bulb').forEach(b => b.classList.toggle('on', +b.dataset.n === on));
    const step = () => {
      if (phase === 'start') { i = 1; phase = 'cond'; set(0, 'Awal: i = 1 (dijalankan sekali).'); }
      else if (phase === 'cond') {
        const ok = i <= 5;
        $('#for-cond').textContent = ok ? 'benar' : 'salah';
        if (ok) { phase = 'body'; set(0, `Cek syarat: ${i} <= 5 → benar, masuk ke isi perulangan.`); }
        else { phase = 'done'; set(2, `Cek syarat: ${i} <= 5 → salah. Perulangan selesai setelah ${n} putaran.`); bulbs(0); stopAuto(); }
      } else if (phase === 'body') { n++; phase = 'upd'; bulbs(i); set(1, `Isi perulangan: tampil "LED ke-${i} menyala".`); }
      else if (phase === 'upd') { i++; phase = 'cond'; set(0, `Perubahan: i++ → i sekarang ${i}.`); }
      else if (phase === 'done') return;
      $('#for-i').textContent = i;
      $('#for-n').textContent = n;
    };
    const stopAuto = () => { clearInterval(timer); timer = null; $('#for-auto').innerHTML = icon('play') + 'Otomatis'; };
    const reset = () => { stopAuto(); phase = 'start'; i = 0; n = 0; bulbs(0); set(-1, 'Tekan Langkah untuk mulai.'); $('#for-i').textContent = '–'; $('#for-cond').textContent = '–'; $('#for-n').textContent = '0'; };
    $('#for-step').addEventListener('click', () => { stopAuto(); step(); });
    $('#for-auto').addEventListener('click', () => {
      if (timer) { stopAuto(); return; }
      if (phase === 'done') reset();
      $('#for-auto').innerHTML = icon('stop') + 'Jeda';
      timer = setInterval(() => { if (current !== 'bab3') { stopAuto(); return; } step(); }, 700);
    });
    $('#for-reset').addEventListener('click', reset);
    reset();
  })();

  /* ============================== Bab 4 ============================== */
  (function fnViz() {
    const upd = () => {
      const v = Number($('#fn-v').value), i = Number($('#fn-i').value);
      const ok = isFinite(v) && isFinite(i) && $('#fn-v').value !== '' && $('#fn-i').value !== '';
      $('#fn-out').textContent = ok ? MiniC.formatC('%.2f', [Math.fround(Math.fround(v) * Math.fround(i))], 'f') : '–';
      const lit = x => (Number.isInteger(x) ? x.toFixed(1) : String(x));
      $('#fn-call').textContent = ok ? `float p = hitungDaya(${lit(v)}, ${lit(i)});\nprintf("Daya = %.2f watt\\n", p);   // Daya = ${MiniC.formatC('%.2f', [v * i], 'f')} watt` : '// isi v dan i dengan angka';
    };
    ['#fn-v', '#fn-i'].forEach(s => $(s).addEventListener('input', upd));
    upd();
  })();

  (function arrViz() {
    const vals = [28.5, 29.0, 30.2, 31.1, 29.8];
    $('#arr-cells').innerHTML = vals.map((v, i) => `<label class="cell"><input type="number" step="0.1" id="arr-${i}" value="${v.toFixed(1)}" aria-label="suhu[${i}]"><span class="idx">[${i}]</span></label>`).join('');
    const upd = () => {
      const a = vals.map((_, i) => Number($('#arr-' + i).value) || 0);
      const total = a.reduce((p, x) => p + x, 0);
      $('#arr-total').textContent = total.toFixed(1);
      $('#arr-avg').textContent = (total / 5).toFixed(2);
      const k = $('#arr-idx').value;
      const out = $('#arr-get');
      if (k === '' || !Number.isInteger(Number(k))) { out.textContent = 'Indeks harus bilangan bulat.'; out.className = 'verdict bad'; }
      else if (+k < 0 || +k > 4) { out.textContent = `suhu[${k}] di luar batas! Indeks yang sah hanya 0 sampai 4. Di C, ini tidak selalu langsung error tetapi membaca data sampah.`; out.className = 'verdict bad'; }
      else { out.textContent = `suhu[${k}] = ${a[+k].toFixed(1)}`; out.className = 'verdict ok'; }
      $$('#arr-cells input').forEach((inp, i) => { inp.style.outline = String(i) === k ? '2px solid var(--copper)' : ''; });
    };
    $('#w-arr').addEventListener('input', upd);
    upd();
  })();

  /* ============================== Bab 5 ============================== */
  let pinmapReady = false;
  function pinmap() {
    if (pinmapReady) return;
    pinmapReady = true;
    const ui = ArduinoBoard.drawBoard($('#pinmap-board'), {});
    const PWM = [3, 5, 6, 9, 10, 11];
    const info = p => {
      if (p >= 14) return `<b>A${p - 14}</b>: input analog. analogRead(A${p - 14}) mengubah tegangan 0-5 V menjadi angka 0-1023 (ADC 10 bit). Bisa juga dipakai sebagai pin digital nomor ${p}.`;
      let s = `<b>Pin ${p}</b>: input/output digital, dipakai dengan pinMode, digitalWrite, dan digitalRead.`;
      if (PWM.includes(p)) s += ' Bertanda ~ sehingga bisa PWM: analogWrite(pin, 0-255).';
      if (p === 13) s += ' Terhubung ke LED bawaan "L" di papan.';
      if (p <= 1) s += ` Juga jalur Serial (${p === 0 ? 'RX, menerima' : 'TX, mengirim'}); hindari untuk LED atau tombol saat memakai Serial Monitor.`;
      return s;
    };
    Object.entries(ui.holes).forEach(([p, r]) => {
      r.style.cursor = 'pointer';
      r.setAttribute('tabindex', '0');
      r.setAttribute('role', 'button');
      r.setAttribute('aria-label', +p >= 14 ? 'A' + (p - 14) : 'Pin ' + p);
      const pick = () => {
        Object.values(ui.holes).forEach(x => x.classList.remove('on'));
        r.classList.add('on');
        ui.ledL.classList.toggle('lit', +p === 13);
        $('#pinmap-info').innerHTML = info(+p);
      };
      r.addEventListener('click', pick);
      r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    ui.ledON.classList.add('lit');
  }
  onShow.bab5 = pinmap;

  (function setupLoop() {
    let timer = null, count = 0, phase = 0;
    const boxes = { power: $('#sl-power'), setup: $('#sl-setup'), loop: $('#sl-loop') };
    const only = k => Object.entries(boxes).forEach(([n, b]) => b.classList.toggle('on', n === k));
    const stop = () => { clearTimeout(timer); timer = null; };
    const run = () => {
      stop();
      count = 0; phase = 0;
      $('#sl-count').textContent = '0';
      const tick = () => {
        if (current !== 'bab5') { stop(); only(null); return; }
        if (phase === 0) { only('power'); phase = 1; timer = setTimeout(tick, 700); }
        else if (phase === 1) { only('setup'); phase = 2; timer = setTimeout(tick, 1200); }
        else { only('loop'); count++; $('#sl-count').textContent = count; boxes.loop.classList.remove('on'); void boxes.loop.offsetWidth; boxes.loop.classList.add('on'); timer = setTimeout(tick, 800); }
      };
      tick();
    };
    $('#sl-play').addEventListener('click', run);
    $('#sl-reset').addEventListener('click', run);
  })();

  /* ============================== Bab 6 ============================== */
  (function adc() {
    const upd = () => {
      const v = +$('#adc-v').value;
      const n = Math.round(v / 5 * 1023);
      $('#adc-vo').textContent = v.toFixed(2) + ' V';
      $('#adc-n').textContent = n;
      $('#adc-back').textContent = (n * 5 / 1023).toFixed(2);
      $('#adc-bits').innerHTML = n.toString(2).padStart(10, '0').split('').map(b => `<span class="${b === '1' ? 'one' : ''}">${b}</span>`).join('');
    };
    $('#adc-v').addEventListener('input', upd);
    upd();
  })();

  (function pwm() {
    const svg = $('#pwm-wave');
    const upd = () => {
      const v = +$('#pwm-v').value, d = v / 255;
      $('#pwm-vo').textContent = v + ')';
      $('#pwm-duty').textContent = Math.round(d * 100) + '%';
      $('#pwm-avg').textContent = (5 * d).toFixed(2) + ' V';
      const hi = 14, lo = 74, per = 80;
      let p = '';
      for (let k = 0; k < 4; k++) {
        const x = k * per;
        if (d <= 0) p += `M${x} ${lo}H${x + per}`;
        else if (d >= 1) p += `M${x} ${hi}H${x + per}`;
        else p += `M${x} ${lo}V${hi}H${x + per * d}V${lo}H${x + per}`;
      }
      const avgY = lo - (lo - hi) * d;
      svg.innerHTML = `<line class="grid" x1="0" y1="${hi}" x2="320" y2="${hi}"/><line class="grid" x1="0" y1="${lo}" x2="320" y2="${lo}"/>
        <path class="sig" d="${p}"/><line class="avg" x1="0" y1="${avgY}" x2="320" y2="${avgY}"/>
        <text x="2" y="${hi - 3}">5V</text><text x="2" y="${lo + 12}">0V</text>`;
      const led = $('#pwm-led');
      led.style.opacity = (0.12 + 0.88 * d).toFixed(2);
      led.style.boxShadow = d > 0.05 ? `0 0 ${6 + d * 22}px #ffd23f` : 'none';
    };
    $('#pwm-v').addEventListener('input', upd);
    upd();
  })();

  (function mapCalc() {
    const upd = () => {
      const [x, a, b, c, d] = ['x', 'a', 'b', 'c', 'd'].map(k => Math.trunc(Number($('#map-' + k).value)));
      const out = $('#map-out');
      if ([x, a, b, c, d].some(v => !isFinite(v))) { out.textContent = '// isi semua kotak dengan angka'; return; }
      if (a === b) { out.textContent = '// "dari min" dan "dari max" tidak boleh sama (pembagian dengan nol)'; return; }
      const exact = (x - a) * (d - c) / (b - a) + c;
      const r = Math.trunc((x - a) * (d - c) / (b - a)) + c;
      out.textContent = `map(${x}, ${a}, ${b}, ${c}, ${d})\n= (${x} − ${a}) × (${d} − ${c}) / (${b} − ${a}) + ${c}\n= ${r}` + (Number.isInteger(exact) ? '' : `   (hasil hitung ${exact.toFixed(2)}, desimalnya dibuang)`);
    };
    $('#w-map').addEventListener('input', upd);
    upd();
  })();

  (function projects() {
    const PROJ = [
      ['proj-taman', 'LDR, LED', 'analogRead, if'],
      ['proj-suhu', 'NTC, 3 LED', 'analogRead, if-else if'],
      ['proj-parkir', 'HC-SR04, buzzer, LED', 'fungsi, if, delay'],
      ['proj-dimmer', 'Potensiometer, LED', 'analogRead, map, analogWrite'],
      ['proj-bel', '2 tombol, 2 LED, buzzer', 'digitalRead, bool, if'],
      ['proj-runpot', 'Potensiometer, 6 LED', 'array, for, map']
    ];
    $('#proj-grid').innerHTML = PROJ.map(([id, parts, konsep]) => `<div class="card proj-card"><h3>${esc(EX[id].title)}</h3>
      <div class="chips">${parts.split(', ').map(p => `<span class="tag">${esc(p)}</span>`).join('')}</div>
      <p class="small muted">Konsep: ${esc(konsep)}</p>
      <div class="btn-row"><button class="btn btn-primary small" type="button" data-proj="${id}" data-v="skeleton">Kerangka</button><button class="btn btn-ghost small" type="button" data-proj="${id}" data-v="code">Contoh jadi</button></div></div>`).join('');
    $('#proj-grid').addEventListener('click', e => {
      const b = e.target.closest('[data-proj]');
      if (b) Sim.open(b.dataset.proj, b.dataset.v);
    });
  })();

  /* ============================== Asesmen ============================== */
  const QUIZ = [
    { q: 'Apa perbedaan utama sistem embedded dengan komputer biasa?', o: ['Sistem embedded lebih mahal', 'Sistem embedded mengerjakan satu tugas khusus terus-menerus', 'Sistem embedded tidak punya program', 'Sistem embedded selalu memakai layar'], a: 1, e: 'Sistem embedded dirancang untuk satu tugas khusus dan bekerja terus-menerus, misalnya rice cooker atau lampu lalu lintas.' },
    { q: 'Chip yang menjadi "otak" sistem embedded disebut…', o: ['Resistor', 'Mikrokontroler', 'Transformator', 'Kapasitor'], a: 1, e: 'Mikrokontroler berisi prosesor, memori, dan pin input/output dalam satu chip.' },
    { q: 'Simbol flowchart untuk pertanyaan "Apakah tombol ditekan?" adalah…', o: ['Oval', 'Persegi panjang', 'Belah ketupat', 'Jajar genjang'], a: 2, e: 'Belah ketupat adalah simbol keputusan dengan jalur Ya dan Tidak.' },
    { q: 'Apa output kode ini?', code: 'int a = 7, b = 2;\nprintf("%d", a / b);', o: ['3.5', '3', '4', '1'], a: 1, e: 'Pembagian dua int membuang desimal: 7 / 2 = 3.' },
    { q: 'Manakah yang MEMBANDINGKAN dua nilai?', o: ['x = 5', 'x == 5', 'x := 5', 'x => 5'], a: 1, e: '= mengisi nilai, == membandingkan.' },
    { q: 'Penentu format printf yang tepat untuk variabel float adalah…', o: ['%d', '%c', '%f', '%s'], a: 2, e: '%f untuk float/double, %d untuk int, %c untuk char, %s untuk teks.' },
    { q: 'Mengapa scanf("%d", &x) memakai tanda & ?', o: ['Agar angka menjadi positif', 'Supaya nilai disimpan ke alamat variabel x', 'Untuk menggabungkan dua variabel', 'Hanya hiasan, boleh dihapus'], a: 1, e: '& berarti "alamat dari". Tanpa &, scanf menulis ke tempat yang salah dan program bisa crash.' },
    { q: 'Apa yang terjadi jika break lupa ditulis pada sebuah case di switch?', o: ['Program error dan tidak bisa dikompilasi', 'Case berikutnya ikut dijalankan', 'switch langsung berhenti', 'Tidak ada pengaruhnya'], a: 1, e: 'Tanpa break, eksekusi "jatuh" ke case di bawahnya (fall-through).' },
    { q: 'Berapa kali perulangan ini berjalan?', code: 'for (int i = 0; i < 5; i++) { ... }', o: ['4 kali', '5 kali', '6 kali', 'Tidak berhenti'], a: 1, e: 'i bernilai 0, 1, 2, 3, 4 → 5 kali.' },
    { q: 'Array int data[5] memiliki indeks…', o: ['1 sampai 5', '0 sampai 5', '0 sampai 4', '1 sampai 4'], a: 2, e: 'Indeks array dimulai dari 0, jadi 5 elemen berindeks 0 sampai 4.' },
    { q: 'Fungsi Arduino yang dijalankan berulang terus-menerus adalah…', o: ['setup()', 'main()', 'loop()', 'repeat()'], a: 2, e: 'setup() sekali saat menyala, loop() berulang selamanya.' },
    { q: 'Dengan pinMode(2, INPUT_PULLUP), apa nilai digitalRead(2) saat tombol (ke GND) DITEKAN?', o: ['HIGH', 'LOW', '1023', 'Acak'], a: 1, e: 'Resistor pull-up membuat pin HIGH saat dilepas; saat ditekan pin terhubung ke GND sehingga LOW.' },
    { q: 'Rentang nilai analogRead() pada Arduino Uno adalah…', o: ['0-255', '0-1023', '0-5', '0-100'], a: 1, e: 'ADC 10 bit menghasilkan 2^10 = 1024 nilai: 0 sampai 1023.' },
    { q: 'Pin Arduino Uno yang bisa PWM (analogWrite) adalah…', o: ['2, 4, 7, 8, 12, 13', '3, 5, 6, 9, 10, 11', 'A0 sampai A5', 'Semua pin digital'], a: 1, e: 'Pin bertanda ~ : 3, 5, 6, 9, 10, 11.' },
    { q: 'Serial Monitor kosong padahal ada Serial.println(). Penyebab paling mungkin?', o: ['LED terbalik', 'Lupa Serial.begin(9600) di setup()', 'Lupa delay()', 'Salah pin PWM'], a: 1, e: 'Serial harus dimulai dulu dengan Serial.begin(9600).' }
  ];
  (function quiz() {
    const box = $('#quiz');
    let ans = store.get('quiz', {});
    const draw = () => {
      box.innerHTML = QUIZ.map((q, i) => {
        const chosen = ans[i];
        const done = chosen !== undefined;
        return `<div class="q${done ? ' done' : ''}" data-q="${i}"><div class="q-head"><span class="n">${String(i + 1).padStart(2, '0')}</span><b>${esc(q.q)}</b></div>
          ${q.code ? `<div class="decl-out">${esc(q.code)}</div>` : ''}
          <div class="q-opts" role="radiogroup">${q.o.map((o, k) => `<label class="${done && k === q.a ? 'right' : done && k === chosen ? 'wrong' : ''}"><input type="radio" name="q${i}" value="${k}"${chosen === k ? ' checked' : ''}${done ? ' disabled' : ''}><span>${esc(o)}</span></label>`).join('')}</div>
          ${done ? `<p class="q-expl">${chosen === q.a ? '<b>Benar.</b> ' : '<b>Kurang tepat.</b> '}${esc(q.e)}</p>` : ''}</div>`;
      }).join('');
      const n = Object.keys(ans).length, right = Object.entries(ans).filter(([i, k]) => QUIZ[i].a === k).length;
      $('#quiz-num').textContent = `${right}/${QUIZ.length}`;
      $('#quiz-msg').textContent = n === 0 ? 'Belum ada jawaban.' : n < QUIZ.length ? `${n} dari ${QUIZ.length} soal dijawab.` : right >= 12 ? 'Selesai. Hebat!' : right >= 8 ? 'Selesai. Ulangi bagian yang masih salah.' : 'Selesai. Baca lagi materinya lalu ulangi kuis.';
    };
    box.addEventListener('change', e => {
      const inp = e.target.closest('input[type=radio]');
      if (!inp) return;
      const i = +inp.closest('.q').dataset.q;
      ans[i] = +inp.value;
      store.set('quiz', ans);
      const y = window.scrollY;
      draw();
      window.scrollTo(0, y);
    });
    $('#quiz-reset').addEventListener('click', () => { ans = {}; store.set('quiz', ans); draw(); });
    draw();
  })();

  const TRACE = [
    { code: '#include <stdio.h>\n\nint main() {\n    int a = 7, b = 2;\n    printf("%d %d\\n", a / b, a % b);\n    return 0;\n}' },
    { code: '#include <stdio.h>\n\nint main() {\n    for (int i = 10; i >= 1; i -= 3) {\n        printf("%d ", i);\n    }\n    return 0;\n}' },
    { code: '#include <stdio.h>\n\nint main() {\n    int pita = 1;\n    switch (pita) {\n        case 0: printf("Hitam\\n");\n        case 1: printf("Coklat\\n");\n        case 2: printf("Merah\\n"); break;\n        case 3: printf("Oranye\\n");\n    }\n    return 0;\n}' },
    { code: '#include <stdio.h>\n\nint main() {\n    int x = 1;\n    while (x < 20) {\n        x = x * 3;\n    }\n    printf("%d\\n", x);\n    return 0;\n}' },
    { code: '#include <stdio.h>\n\nint main() {\n    float r = 5 / 2;\n    printf("%.1f\\n", r);\n    return 0;\n}' }
  ];
  const norm = s => s.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
  (function traceQuiz() {
    const box = $('#trace-quiz');
    box.innerHTML = TRACE.map((t, i) => `<div class="q trace-q" data-t="${i}"><div class="q-head"><span class="n">${String(i + 1).padStart(2, '0')}</span><b>Apa output program ini?</b></div>
      <div class="snippet"><pre>${hlLines(t.code, 'text/x-csrc').map((l, k) => `<span class="ln" data-n="${k + 1}">${l || ' '}</span>`).join('')}</pre></div>
      <label class="field">Tebakanmu<textarea id="tr-${i}" rows="3" spellcheck="false" autocapitalize="off" placeholder="Tulis persis seperti yang muncul di layar"></textarea></label>
      <div class="btn-row"><button class="btn btn-primary small" type="button" data-check="${i}">Periksa</button><span class="verdict" aria-live="polite"></span></div>
      <div class="decl-out" hidden></div></div>`).join('');
    box.addEventListener('click', async e => {
      const b = e.target.closest('[data-check]');
      if (!b) return;
      const i = +b.dataset.check, q = b.closest('.q');
      const r = await runHeadless(TRACE[i].code, 'c', '');
      const guess = $('#tr-' + i).value;
      const ok = norm(guess) === norm(r.out);
      const v = $('.verdict', q);
      v.textContent = ok ? 'Tepat!' : 'Belum tepat. Bandingkan dengan output sebenarnya:';
      v.className = 'verdict ' + (ok ? 'ok' : 'bad');
      const o = $('.decl-out', q);
      o.hidden = false;
      o.textContent = 'Output sebenarnya:\n' + (r.out || '(kosong)');
    });
  })();

  const DEBUG = [
    { title: 'Menghitung arus', expect: 'Arus = 0.027 A\n', input: '', code: '#include <stdio.h>\n\nint main() {\n    float tegangan = 9.0\n    float resistansi = 330.0;\n    printf("Arus = %.3f A\\n", tegangan / Resistansi);\n    return 0;\n}' },
    { title: 'Resistor seri (input: 100 220)', expect: 'R1 R2: Total = 320 ohm\n', input: '100 220', code: '#include <stdio.h>\n\nint main() {\n    int r1, r2;\n    printf("R1 R2: ");\n    scanf("%d %d", r1, &r2);\n    printf("Total = %f ohm\\n", r1 + r2);\n    return 0;\n}' },
    { title: 'Status baterai', expect: 'Lemah\n', input: '', code: '#include <stdio.h>\n\nint main() {\n    int baterai = 25;\n    if (baterai = 80) {\n        printf("Penuh\\n");\n    } else if (baterai >= 30) {\n        printf("Sedang\\n");\n    } else {\n        printf("Lemah\\n")\n    }\n    return 0;\n}' },
    { title: 'Hitung arus versi C++', expect: 'Arus = 3 A\n', input: '', lang: 'cpp', code: '#include <iostream>\n\nint main() {\n    float v = 12, r = 4;\n    cout << "Arus = " << v / r << " A" << endl\n    return 0;\n}' }
  ];
  (function debugQuiz() {
    const box = $('#debug-quiz');
    box.innerHTML = DEBUG.map((d, i) => `<div class="q debug-q" data-d="${i}"><div class="q-head"><span class="n">${String(i + 1).padStart(2, '0')}</span><b>${esc(d.title)}</b><span class="tag" style="margin-left:auto">${d.lang === 'cpp' ? 'C++' : 'C'}</span></div>
      <p class="small muted">Output yang diharapkan: <code>${esc(d.expect.replace(/\n$/, ''))}</code></p>
      <div class="editor"><div class="dbg-ed"></div></div>
      <div class="btn-row"><button class="btn btn-primary small" type="button" data-dcheck="${i}">Periksa</button><button class="btn btn-ghost small" type="button" data-dreset="${i}">Kembalikan kode awal</button><span class="verdict" aria-live="polite"></span></div>
      <div class="diags"></div></div>`).join('');
    const eds = [];
    $$('.debug-q', box).forEach((q, i) => {
      eds[i] = makeEditor($('.dbg-ed', q), { value: store.get('dbg' + i, DEBUG[i].code), lang: DEBUG[i].lang || 'c', auto: true, onChange: debounce(v => store.set('dbg' + i, v), 400) });
    });
    onShow.asesmen = () => requestAnimationFrame(() => eds.forEach(e => e.refresh()));
    box.addEventListener('click', async e => {
      const r = e.target.closest('[data-dreset]');
      if (r) { const i = +r.dataset.dreset; eds[i].set(DEBUG[i].code); store.set('dbg' + i, DEBUG[i].code); return; }
      const b = e.target.closest('[data-dcheck]');
      if (!b) return;
      const i = +b.dataset.dcheck, q = b.closest('.q'), d = DEBUG[i];
      const lang = d.lang || 'c';
      const res = await runHeadless(eds[i].get(), lang, d.input);
      const file = lang === 'c' ? 'main.c' : 'main.cpp';
      const diags = res.res.errors.concat(res.res.warnings);
      renderDiags($('.diags', q), diags, file, l => eds[i].goto(l));
      eds[i].mark(diags.map(x => ({ line: x.line, kind: x.kind })));
      const v = $('.verdict', q);
      let msg, ok = false;
      if (!res.ok) msg = `Masih ada ${res.res.errors.length} error kompilasi.`;
      else if (res.err) msg = 'Program crash: ' + res.err.message;
      else if (res.res.warnings.length) msg = 'Sudah bisa jalan, tetapi masih ada peringatan. Peringatan biasanya tanda ada bug.';
      else if (norm(res.out) !== norm(d.expect)) msg = `Output belum sesuai. Didapat: "${norm(res.out)}"`;
      else { ok = true; msg = 'Benar! Semua kesalahan sudah diperbaiki.'; }
      v.textContent = msg;
      v.className = 'verdict ' + (ok ? 'ok' : 'bad');
    });
  })();

  (function rubric() {
    const AS = [
      ['Rangkaian di simulator', 20, ['Benar, rapi, ada resistor yang tepat', 'Benar, kurang rapi', 'Ada 1 kesalahan sambungan', 'Tidak berfungsi']],
      ['Kode program', 30, ['Berjalan, ada komentar, memakai fungsi/variabel bermakna', 'Berjalan tanpa komentar', 'Berjalan sebagian', 'Error']],
      ['Flowchart', 15, ['Lengkap dan sesuai kode', 'Sedikit tidak sesuai', 'Kurang lengkap', 'Tidak ada']],
      ['Presentasi', 20, ['Bisa menjelaskan setiap baris kode', 'Menjelaskan sebagian besar', 'Menjelaskan sebagian kecil', 'Tidak bisa menjelaskan']],
      ['Kerja sama', 15, ['Kedua anggota aktif', 'Pembagian kerja kurang seimbang', 'Satu anggota dominan', 'Tidak bekerja sama']]
    ];
    const LAB = ['4 · Sangat baik', '3 · Baik', '2 · Cukup', '1 · Kurang'];
    let sel = store.get('rubric', {});
    $('#rub-name').value = store.get('rubric-name', '');
    $('#rub-name').addEventListener('input', debounce(() => store.set('rubric-name', $('#rub-name').value), 300));
    $('#rubric').innerHTML = AS.map(([nm, w, ds], i) => `<fieldset class="rubric-row" style="border:0;margin:0;padding-inline:0"><legend class="head" style="display:flex;width:100%"><span style="color:var(--ink);font-family:var(--font-body)">${esc(nm)}</span><span style="margin-left:auto">bobot ${w}%</span></legend>
      <div class="rubric-opts">${ds.map((dsc, k) => `<label><input type="radio" name="rub${i}" value="${4 - k}"${sel[i] === 4 - k ? ' checked' : ''}><b>${LAB[k]}</b>${esc(dsc)}</label>`).join('')}</div></fieldset>`).join('');
    const calc = () => {
      const filled = AS.every((_, i) => sel[i]);
      const sum = AS.reduce((p, [, w], i) => p + (sel[i] || 0) * w / 100, 0);
      $('#rub-total').textContent = filled ? (sum / 4 * 100).toFixed(1).replace(/\.0$/, '') : '–';
      $('#rub-detail').textContent = filled ? `jumlah (skor × bobot) = ${sum.toFixed(2)} → ${sum.toFixed(2)} / 4 × 100` : `Pilih skor untuk ${AS.filter((_, i) => !sel[i]).length} aspek lagi.`;
    };
    $('#rubric').addEventListener('change', e => {
      const inp = e.target.closest('input');
      if (!inp) return;
      sel[+inp.name.slice(3)] = +inp.value;
      store.set('rubric', sel);
      calc();
    });
    calc();
  })();

  /* ============================== Referensi ============================== */
  (function errSearch() {
    const rows = $$('#err-table tbody tr');
    $('#err-search').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      let n = 0;
      rows.forEach(r => { const hit = !q || r.textContent.toLowerCase().includes(q); r.hidden = !hit; if (hit) n++; });
      $('#err-empty').hidden = n > 0;
    });
  })();

  (function cheat() {
    const CH = [
      ['printf("teks %d", x);', 'Menampilkan teks dan nilai', 'c'],
      ['scanf("%d", &x);', 'Membaca input angka', 'c'],
      ['%d  %f  %.2f  %c  %s', 'Penentu format: int, float, float 2 desimal, char, teks', 'c'],
      ['cout << x << endl;', 'Output (C++)', 'cpp'],
      ['cin >> x;', 'Input (C++)', 'cpp'],
      ['if (kondisi) { } else { }', 'Percabangan', 'c cpp ard'],
      ['switch (x) { case 1: ... break; default: ... }', 'Memilih dari beberapa nilai pasti', 'c cpp ard'],
      ['for (int i = 0; i < n; i++) { }', 'Perulangan n kali', 'c cpp ard'],
      ['while (kondisi) { }', 'Perulangan selama kondisi benar', 'c cpp ard'],
      ['float hitung(float a, float b) { return a * b; }', 'Membuat fungsi dengan nilai kembalian', 'c cpp ard'],
      ['int data[5] = {1, 2, 3, 4, 5};', 'Array 5 elemen (indeks 0-4)', 'c cpp ard'],
      ['pinMode(pin, OUTPUT);  pinMode(pin, INPUT_PULLUP);', 'Mengatur fungsi pin', 'ard'],
      ['digitalWrite(pin, HIGH);  digitalWrite(pin, LOW);', 'Menyalakan / mematikan output', 'ard'],
      ['digitalRead(pin);', 'Membaca tombol (HIGH/LOW)', 'ard'],
      ['analogRead(A0);', 'Membaca sensor analog (0-1023)', 'ard'],
      ['analogWrite(pin, 0-255);', 'Output PWM (pin 3, 5, 6, 9, 10, 11)', 'ard'],
      ['map(x, 0, 1023, 0, 255);', 'Mengubah rentang nilai', 'ard'],
      ['delay(ms);', 'Menunggu (milidetik)', 'ard'],
      ['Serial.begin(9600);', 'Memulai Serial Monitor (di setup)', 'ard'],
      ['Serial.print(x);  Serial.println(x);', 'Menampilkan ke Serial Monitor (println pindah baris)', 'ard'],
      ['tone(pin, frekuensi);  noTone(pin);', 'Membunyikan / mematikan buzzer', 'ard']
    ];
    const box = $('#cheat');
    let k = 'all';
    const draw = () => {
      box.innerHTML = CH.filter(r => k === 'all' || r[2].split(' ').includes(k)).map(([c, d]) => `<div class="cheat-row"><code>${esc(c)}</code><button class="btn btn-ghost small" type="button" data-copy="${esc(c)}" aria-label="Salin ${esc(c)}">${icon('copy')}</button><span class="d">${esc(d)}</span></div>`).join('');
    };
    box.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy); });
    $$('#cheat-filter button').forEach(b => b.addEventListener('click', () => { k = b.dataset.k; $$('#cheat-filter button').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
    draw();
  })();

  route();
})();
