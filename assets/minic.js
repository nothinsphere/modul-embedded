/* MiniC — penerjemah C/C++ (subset) untuk belajar, berjalan penuh di browser.
 *
 * Alur kerja: kode sumber → token (lex) → pohon sintaks (Parser) → JavaScript (Gen).
 * Setiap fungsi C diterjemahkan menjadi fungsi generator JavaScript sehingga program
 * bisa berhenti sejenak untuk menunggu input (scanf/cin), delay() Arduino, atau
 * mode langkah-demi-langkah, tanpa membuat browser macet.
 *
 * Pesan error sengaja dibuat mirip GCC (dipakai di compiler HP seperti OnlineGDB),
 * ditambah petunjuk berbahasa Indonesia.
 */
(function (root) {
  'use strict';

  /* ============================== Kesalahan ============================== */
  class CompileError extends Error {
    constructor(msg, line, col, hint, kind) {
      super(msg);
      this.line = line || 1; this.col = col || 1;
      this.hint = hint || ''; this.kind = kind || 'error';
    }
  }
  class RuntimeError extends Error {
    constructor(msg, hint) { super(msg); this.hint = hint || ''; }
  }
  class ExitSignal { constructor(code) { this.code = code; } }

  /* ============================== Lexer ============================== */
  const OPS = ['<<=', '>>=', '...', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
    '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '::',
    '+', '-', '*', '/', '%', '<', '>', '=', '!', '&', '|', '^', '~', '?', ':', ';', ',', '.',
    '(', ')', '[', ']', '{', '}'];

  const HEADERS = new Set(['stdio.h', 'stdlib.h', 'math.h', 'string.h', 'stdbool.h', 'ctype.h', 'time.h',
    'limits.h', 'stdint.h', 'unistd.h', 'iostream', 'cmath', 'cstdio', 'cstdlib', 'cstring', 'string',
    'iomanip', 'ctime', 'cctype', 'climits', 'cstdint', 'algorithm', 'bits/stdc++.h', 'Arduino.h']);

  const HEADER_HINTS = {
    'conio.h': 'conio.h hanya ada di Turbo C / Dev-C++ (Windows lama). Hapus baris ini. Ganti getch() dengan getchar(); clrscr() tidak diperlukan.',
    'iostream.h': 'Itu header Turbo C++ lama. Tulis #include <iostream> (tanpa .h) lalu tambahkan using namespace std;',
    'windows.h': 'windows.h khusus Windows dan tidak tersedia di compiler HP/Linux.',
    'Servo.h': 'Library tambahan Arduino belum didukung di simulator ini. Gunakan Wokwi untuk mencobanya.',
    'LiquidCrystal.h': 'Library LCD belum didukung di simulator ini. Gunakan Wokwi untuk mencobanya.',
    'DHT.h': 'Library DHT belum didukung di simulator ini. Untuk suhu, gunakan sensor NTC (analogRead) atau Wokwi.'
  };

  const SMART_QUOTES = '“”„‟″‘’‚‛′«»';

  function lex(src) {
    const toks = [], includes = [], warnings = [];
    const macros = Object.create(null);
    const n = src.length;
    let i = 0, line = 1, col = 1, lineStart = true;
    const fail = (msg, l, c, hint, kind) => { throw new CompileError(msg, l, c, hint, kind); };
    const end = () => { const t = toks[toks.length - 1]; t.eline = line; t.ecol = col; };

    function readEscape(l0, c0) {
      const e = src[i + 1];
      const simple = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };
      if (e === undefined || e === '\n') fail('missing terminating character', l0, c0);
      if (simple[e] !== undefined) { i += 2; col += 2; return simple[e]; }
      if (e === 'x') {
        let j = i + 2, h = '';
        while (j < n && /[0-9a-fA-F]/.test(src[j])) h += src[j++];
        if (!h) fail('\\x used with no following hex digits', line, col);
        col += j - i; i = j; return String.fromCharCode(parseInt(h, 16) & 255);
      }
      if (/[0-7]/.test(e)) {
        let j = i + 1, o = '';
        while (j < n && o.length < 3 && /[0-7]/.test(src[j])) o += src[j++];
        col += j - i; i = j; return String.fromCharCode(parseInt(o, 8) & 255);
      }
      warnings.push(new CompileError(`unknown escape sequence: '\\${e}'`, line, col,
        'Karakter setelah \\ tidak dikenal. Yang benar misalnya \\n (baris baru) atau \\t (tab).', 'warning'));
      i += 2; col += 2; return e;
    }

    function directive(text, l, c) {
      let m;
      if ((m = /^#\s*include\s*([<"])\s*([^>"]*?)\s*[>"]/.exec(text))) {
        const h = m[2];
        if (!HEADERS.has(h)) {
          fail(`${h}: No such file or directory`, l, c, HEADER_HINTS[h] ||
            `Header <${h}> tidak tersedia. Simulator ini mendukung pustaka dasar seperti stdio.h, math.h, string.h, iostream, dan iomanip.`, 'fatal error');
        }
        includes.push(h);
      } else if (/^#\s*include/.test(text)) {
        fail('#include expects "FILENAME" or <FILENAME>', l, c, 'Tulis seperti ini: #include <stdio.h>');
      } else if ((m = /^#\s*define\s+([A-Za-z_]\w*)(\(?)(.*)$/.exec(text))) {
        if (m[2]) fail('macro dengan parameter belum didukung MiniC', l, c, 'Gunakan fungsi biasa sebagai gantinya.');
        const sub = lex(m[3]);
        macros[m[1]] = sub.toks.slice(0, -1);
      } else if (/^#\s*(ifndef|ifdef|if|elif|else|endif|pragma|undef|line|error|warning)\b/.test(text) || /^#\s*$/.test(text)) {
        /* diabaikan */
      } else {
        fail(`invalid preprocessing directive ${text.split(/\s+/)[0]}`, l, c, 'Perintah # tidak dikenal. Contoh yang benar: #include <stdio.h> atau #define LED 13');
      }
    }

    while (i < n) {
      const ch = src[i];
      if (ch === '\n') { i++; line++; col = 1; lineStart = true; continue; }
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v' || ch === ' ' || ch === '﻿') { i++; col++; continue; }
      if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') { i++; col++; } continue; }
      if (ch === '/' && src[i + 1] === '*') {
        const l0 = line, c0 = col; i += 2; col += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') { line++; col = 1; } else col++; i++; }
        if (i >= n) fail('unterminated comment', l0, c0, 'Komentar /* belum ditutup dengan */');
        i += 2; col += 2; continue;
      }
      if (ch === '#' && lineStart) {
        const l0 = line, c0 = col; let text = '';
        while (i < n && src[i] !== '\n') {
          if (src[i] === '\\' && src[i + 1] === '\n') { i += 2; line++; col = 1; continue; }
          text += src[i]; i++; col++;
        }
        directive(text.replace(/\/\*.*?\*\//g, ' ').replace(/\/\/.*$/, '').trim(), l0, c0);
        continue;
      }
      lineStart = false;
      const l0 = line, c0 = col;

      if (/[A-Za-z_]/.test(ch)) {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
        toks.push({ t: 'id', v: src.slice(i, j), line: l0, col: c0 });
        col += j - i; i = j; end(); continue;
      }

      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)/.exec(src.slice(i, i + 120));
        const text = m[0];
        let j = i + text.length, suf = '';
        while (j < n && /[A-Za-z0-9_]/.test(src[j])) suf += src[j++];
        const hexBin = /^0[xXbB]/.test(text);
        const isFloat = !hexBin && /[.eE]/.test(text);
        const okSuf = isFloat ? /^[fFlL]?$/.test(suf) : /^(?:[uU]?(?:l|L|ll|LL)?|(?:l|L|ll|LL)[uU])$/.test(suf);
        if (!okSuf) {
          fail(`invalid suffix "${suf}" on ${isFloat ? 'floating' : 'integer'} constant`, l0, c0,
            /^[fF]$/.test(suf) ? 'Akhiran f hanya untuk bilangan desimal, misal 5.0f (bukan 5f).' :
              'Angka tidak boleh langsung diikuti huruf. Untuk perkalian tulis 2 * x (bukan 2x).');
        }
        let v;
        if (/^0[xX]/.test(text)) v = parseInt(text.slice(2), 16);
        else if (/^0[bB]/.test(text)) v = parseInt(text.slice(2), 2);
        else if (!isFloat && text.length > 1 && text[0] === '0') {
          if (/[89]/.test(text)) fail(`invalid digit "${/[89]/.exec(text)[0]}" in octal constant`, l0, c0, 'Angka yang diawali 0 dianggap oktal (basis 8). Hapus angka 0 di depannya.');
          v = parseInt(text, 8);
        } else v = Number(text);
        const sl = suf.toLowerCase();
        toks.push({ t: 'num', v, isFloat, f32: isFloat && sl === 'f', uns: sl.includes('u'), lng: (sl.match(/l/g) || []).length, text: text + suf, line: l0, col: c0 });
        col += j - i; i = j; end(); continue;
      }

      if (ch === "'") {
        i++; col++; let s = '';
        while (i < n && src[i] !== "'") {
          if (src[i] === '\n') fail("missing terminating ' character", l0, c0, "Karakter harus diapit dua tanda kutip tunggal, misal 'A'.");
          if (src[i] === '\\') s += readEscape(l0, c0); else { s += src[i]; i++; col++; }
        }
        if (i >= n) fail("missing terminating ' character", l0, c0, "Karakter harus diapit dua tanda kutip tunggal, misal 'A'.");
        i++; col++;
        if (!s.length) fail('empty character constant', l0, c0, 'Isi karakter tidak boleh kosong. Untuk teks gunakan tanda kutip ganda "...".');
        if (s.length > 1) warnings.push(new CompileError('multi-character character constant', l0, c0, 'Tanda kutip tunggal hanya untuk SATU karakter. Untuk teks gunakan "...".', 'warning'));
        toks.push({ t: 'chr', v: s.charCodeAt(s.length - 1), line: l0, col: c0 });
        end(); continue;
      }

      if (ch === '"') {
        i++; col++; let s = '';
        while (i < n && src[i] !== '"') {
          if (src[i] === '\n') fail('missing terminating " character', l0, c0, 'Teks harus ditutup dengan tanda kutip ganda " di baris yang sama.');
          if (src[i] === '\\') s += readEscape(l0, c0); else { s += src[i]; i++; col++; }
        }
        if (i >= n) fail('missing terminating " character', l0, c0, 'Teks harus ditutup dengan tanda kutip ganda ".');
        i++; col++;
        toks.push({ t: 'str', v: s, line: l0, col: c0 });
        end(); continue;
      }

      if (SMART_QUOTES.includes(ch)) {
        fail(`stray '${ch}' in program`, l0, c0, 'Ini tanda kutip "miring" dari keyboard HP. Ganti dengan tanda kutip lurus (" atau \'). Matikan fitur smart punctuation / tanda kutip pintar di pengaturan keyboard.');
      }

      let op = null;
      for (const o of OPS) if (src.startsWith(o, i)) { op = o; break; }
      if (!op) fail(`stray '${ch}' in program`, l0, c0, ch === '#' ? 'Tanda # hanya boleh di awal baris, misal #include <stdio.h>.' : 'Ada karakter yang tidak dikenali C/C++. Hapus atau ketik ulang karakter tersebut.');
      toks.push({ t: 'op', v: op, line: l0, col: c0 });
      i += op.length; col += op.length; end();
    }

    // Ganti nama macro (#define) dengan isinya.
    const out = [];
    const expand = (list, at, active) => {
      for (const tk of list) {
        if (tk.t === 'id' && macros[tk.v] && !active.has(tk.v)) {
          active.add(tk.v); expand(macros[tk.v], at || tk, active); active.delete(tk.v);
        } else out.push(at ? Object.assign({}, tk, { line: at.line, col: at.col, eline: at.eline, ecol: at.ecol }) : tk);
      }
    };
    expand(toks, null, new Set());
    out.push({ t: 'eof', v: '', line, col, eline: line, ecol: col });
    return { toks: out, includes, warnings };
  }

  /* ============================== Parser ============================== */
  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '|=', '^=']);
  const PREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
  const QUALS = new Set(['const', 'static', 'volatile', 'register', 'inline', 'extern']);
  const BASE_COMMON = ['void', 'char', 'int', 'float', 'double', 'bool', '_Bool', 'size_t', 'int8_t', 'uint8_t', 'int16_t', 'uint16_t', 'int32_t', 'uint32_t', 'int64_t', 'uint64_t', 'auto'];
  const BASE_ARDUINO = ['byte', 'word', 'boolean', 'String'];
  const HINT_EXPECT = {
    ')': 'Ada kurung buka ( yang belum ditutup dengan ).',
    ']': 'Kurung siku [ belum ditutup dengan ].',
    '(': 'Setelah if/while/for/switch harus ada tanda kurung (...).',
    '{': 'Isi fungsi atau blok harus diawali kurung kurawal {.',
    ':': 'Setelah case atau default harus ada titik dua :'
  };

  class Parser {
    constructor(toks, opt) {
      this.toks = toks; this.p = 0; this.opt = opt; this.usingStd = false;
      this.A = opt.mode === 'arduino';
      this.bases = new Set(BASE_COMMON.concat(this.A ? BASE_ARDUINO : opt.lang === 'c' ? [] : ['string']));
    }
    get cur() { return this.toks[this.p]; }
    peek(k) { return this.toks[Math.min(this.p + (k || 0), this.toks.length - 1)]; }
    next() { const t = this.toks[this.p]; if (t.t !== 'eof') this.p++; return t; }
    prev() { return this.toks[this.p - 1] || this.toks[0]; }
    isOp(v, k) { const t = this.peek(k); return t.t === 'op' && t.v === v; }
    isKw(v, k) { const t = this.peek(k); return t.t === 'id' && t.v === v; }
    text(t) {
      if (t.t === 'eof') return 'end of input';
      if (t.t === 'str') return JSON.stringify(t.v);
      if (t.t === 'chr') return "'" + String.fromCharCode(t.v) + "'";
      if (t.t === 'num') return t.text;
      return t.v;
    }
    tok(t) { return `'${this.text(t)}'` + (t.t === 'op' ? ' token' : ''); }
    fail(msg, t, hint) { t = t || this.cur; throw new CompileError(msg, t.line, t.col, hint); }
    isTypeWord(v) { return this.bases.has(v) || QUALS.has(v) || v === 'signed' || v === 'unsigned' || v === 'long' || v === 'short'; }
    isBaseWord(v) { return this.bases.has(v) || v === 'signed' || v === 'unsigned' || v === 'long' || v === 'short'; }

    expect(v, hint) {
      if (this.isOp(v)) return this.next();
      const t = this.cur, pv = this.prev();
      if (v === '}' && t.t === 'eof') throw new CompileError("expected '}' at end of input", pv.eline || pv.line, pv.ecol || pv.col, 'Jumlah kurung kurawal { dan } tidak sama. Pastikan setiap { punya pasangan }.');
      if (v === ';') {
        if (t.t === 'eof') throw new CompileError("expected ';' at end of input", pv.eline || pv.line, pv.ecol || pv.col, `Kemungkinan lupa titik koma ; di akhir baris ${pv.line}.`);
        throw new CompileError(`expected ';' before ${this.tok(t)}`, pv.eline || pv.line, pv.ecol || pv.col, `Kemungkinan lupa titik koma ; di akhir baris ${pv.line}.`);
      }
      if (t.t === 'eof') throw new CompileError(`expected '${v}' at end of input`, pv.eline || pv.line, pv.ecol || pv.col, hint || HINT_EXPECT[v]);
      throw new CompileError(`expected '${v}' before ${this.tok(t)}`, t.line, t.col, hint || HINT_EXPECT[v]);
    }

    isTypeStart(k) {
      k = k || 0;
      const t = this.peek(k);
      if (t.t !== 'id') return false;
      if (t.v === 'std' && this.isOp('::', k + 1) && this.peek(k + 2).v === 'string') return true;
      if (!this.isTypeWord(t.v)) return false;
      if (this.isOp('(', k + 1)) return false; // int(x), String(x): ekspresi
      return true;
    }

    suggestType(word) {
      const l = word.toLowerCase();
      if (l !== word && (this.bases.has(l) || ['long', 'short', 'unsigned', 'signed', 'const'].includes(l))) return l;
      if (this.A && word === 'string') return 'String';
      return null;
    }

    parseType() {
      const start = this.cur;
      let isConst = false, uns = null, longs = 0, short = false, base = null, any = false;
      for (;;) {
        const t = this.cur;
        if (t.t !== 'id') break;
        if (QUALS.has(t.v)) { if (t.v === 'const') isConst = true; this.next(); any = true; continue; }
        if (t.v === 'unsigned' || t.v === 'signed') { uns = t.v === 'unsigned'; this.next(); any = true; continue; }
        if (t.v === 'long') { longs++; this.next(); any = true; continue; }
        if (t.v === 'short') { short = true; this.next(); any = true; continue; }
        if (base) break;
        if (t.v === 'std' && this.isOp('::', 1)) {
          this.next(); this.next();
          const s = this.next();
          if (s.v !== 'string') this.fail(`'${s.v}' in namespace 'std' does not name a type`, s);
          base = 'string'; any = true; continue;
        }
        if (this.bases.has(t.v)) { base = t.v; this.next(); any = true; continue; }
        break;
      }
      if (!any) return null;
      let ty = this.makeType(base, uns, longs, short, start);
      if (isConst) ty.cst = true;
      while (this.isOp('*')) {
        const st = this.next();
        if (ty.k === 'int' && ty.char) ty = { k: 'str', cstr: true, cst: ty.cst };
        else this.fail('pointer belum didukung di MiniC', st, 'Simulator ini belum mendukung pointer (*). Gunakan variabel biasa atau array.');
      }
      if (this.isOp('&')) this.fail('parameter referensi (&) belum didukung di MiniC', this.cur, 'Gunakan nilai kembalian (return) atau variabel global.');
      return ty;
    }

    makeType(base, uns, longs, short, tok) {
      const INT = this.A ? 16 : 32, LONG = this.A ? 32 : 64;
      const I = (bits, u) => ({ k: 'int', bits, uns: !!u });
      switch (base) {
        case 'void': return { k: 'void' };
        case 'bool': case '_Bool': case 'boolean': return { k: 'int', bits: 8, uns: true, bool: true };
        case 'char': return { k: 'int', bits: 8, uns: uns === true, char: true };
        case 'byte': case 'uint8_t': return I(8, true);
        case 'int8_t': return I(8, false);
        case 'int16_t': return I(16, false);
        case 'uint16_t': case 'word': return I(16, true);
        case 'int32_t': return I(32, false);
        case 'uint32_t': return I(32, true);
        case 'int64_t': return I(64, false);
        case 'uint64_t': case 'size_t': return I(this.A ? 16 : 64, true);
        case 'float': return { k: 'float', bits: 32 };
        case 'double': return { k: 'float', bits: this.A ? 32 : 64 };
        case 'String': case 'string': return { k: 'str' };
        case 'auto': return { k: 'auto' };
      }
      if (base === null && uns === null && !longs && !short) this.fail(`'${tok.v}' tanpa tipe data`, tok, 'Sebutkan tipe datanya, misal const int x = 5;');
      if (short) return I(16, uns);
      if (longs >= 2) return I(64, uns);
      if (longs === 1) return I(LONG, uns);
      return I(INT, uns);
    }

    parseProgram() {
      const decls = [];
      while (this.cur.t !== 'eof') {
        const t = this.cur;
        if (this.isOp(';')) { this.next(); continue; }
        if (this.isKw('using')) {
          this.next();
          if (this.isKw('namespace')) { this.next(); const ns = this.next(); if (ns.v === 'std') this.usingStd = true; }
          else while (!this.isOp(';') && this.cur.t !== 'eof') this.next();
          this.expect(';'); continue;
        }
        if (t.t === 'id' && /^(struct|class|enum|typedef|union|template|namespace)$/.test(t.v)) {
          this.fail(`'${t.v}' belum didukung di MiniC`, t, 'Simulator ini fokus pada materi dasar: variabel, percabangan, perulangan, fungsi, dan array. Gunakan GCC online atau Wokwi untuk fitur lanjutan.');
        }
        if (this.isOp('}')) {
          this.fail(this.opt.lang === 'c' && !this.A ? "expected identifier or '(' before '}' token" : "expected declaration before '}' token", t, 'Ada kurung kurawal } yang berlebih. Hapus salah satunya.');
        }
        const ty = this.parseType();
        if (!ty) {
          if (t.t === 'id') {
            const sug = this.suggestType(t.v);
            if (sug) this.fail(`'${t.v}' does not name a type; did you mean '${sug}'?`, t, 'Huruf besar dan kecil dibedakan. Tipe data ditulis huruf kecil, misal int, float, void.');
            if (this.isOp('(', 1)) this.fail("expected constructor, destructor, or type conversion before '(' token", this.peek(1), 'Perintah harus ditulis di dalam fungsi, misalnya di dalam main() { ... } atau setup()/loop().');
            this.fail(`'${t.v}' does not name a type`, t, 'Di luar fungsi hanya boleh ada deklarasi variabel atau fungsi. Pindahkan perintah ini ke dalam fungsi.');
          }
          this.fail(`expected unqualified-id before ${this.tok(t)}`, t);
        }
        const nameTok = this.cur;
        if (nameTok.t !== 'id') this.fail(`expected unqualified-id before ${this.tok(nameTok)}`, nameTok, 'Setelah tipe data harus ada nama variabel atau fungsi.');
        this.next();
        if (this.isOp('(')) decls.push(this.parseFunction(ty, nameTok));
        else decls.push(this.parseDeclRest(ty, nameTok, true));
      }
      return decls;
    }

    parseFunction(ret, nameTok) {
      this.expect('(');
      const params = [];
      if (this.isKw('void') && this.isOp(')', 1)) this.next();
      else if (!this.isOp(')')) {
        for (;;) {
          const pt = this.cur;
          const ty = this.parseType();
          if (!ty) this.fail(`expected primary-expression before ${this.tok(pt)}`, pt, 'Setiap parameter harus ditulis lengkap dengan tipe datanya, misal: float hitungDaya(float v, float i)');
          let name = null;
          const nt = this.cur;
          if (nt.t === 'id') { name = nt.v; this.next(); }
          const dims = [];
          while (this.isOp('[')) { this.next(); dims.push(this.isOp(']') ? null : this.parseCond()); this.expect(']'); }
          params.push({ name, ty, dims, line: pt.line, col: pt.col });
          if (this.isOp(',')) { this.next(); continue; }
          break;
        }
      }
      this.expect(')');
      if (this.isOp(';')) { this.next(); return { k: 'proto', name: nameTok.v, ret, params, line: nameTok.line, col: nameTok.col }; }
      if (!this.isOp('{')) {
        const t = this.cur;
        this.fail(`expected '{' before ${this.tok(t)}`, t, `Isi fungsi ${nameTok.v}() harus diapit kurung kurawal { ... }. Jika ini hanya deklarasi, akhiri dengan titik koma.`);
      }
      const body = this.parseBlock();
      return { k: 'func', name: nameTok.v, ret, params, body, line: nameTok.line, col: nameTok.col };
    }

    parseBlock() {
      const open = this.expect('{');
      const body = [];
      while (!this.isOp('}')) {
        if (this.cur.t === 'eof') {
          const pv = this.prev();
          throw new CompileError("expected '}' at end of input", pv.eline || pv.line, pv.ecol || pv.col, `Kurung kurawal { di baris ${open.line} belum ditutup. Tambahkan } di akhir blok tersebut.`);
        }
        body.push(this.parseStatement());
      }
      this.next();
      return { k: 'block', body, line: open.line, col: open.col };
    }

    parseStatement() {
      const t = this.cur;
      if (t.t === 'op' && t.v === '{') return this.parseBlock();
      if (t.t === 'op' && t.v === ';') { this.next(); return { k: 'empty', line: t.line, col: t.col }; }
      if (t.t === 'id') {
        switch (t.v) {
          case 'if': return this.parseIf();
          case 'while': return this.parseWhile();
          case 'do': return this.parseDo();
          case 'for': return this.parseFor();
          case 'switch': return this.parseSwitch();
          case 'return': {
            this.next();
            let arg = null;
            if (!this.isOp(';')) arg = this.parseExpr();
            this.expect(';');
            return { k: 'return', arg, line: t.line, col: t.col };
          }
          case 'break': case 'continue':
            this.next(); this.expect(';');
            return { k: t.v, line: t.line, col: t.col };
          case 'else': this.fail("'else' without a previous 'if'", t, 'Periksa apakah ada titik koma ; tepat setelah if (...) atau kurung kurawal yang salah tempat.');
          // falls through (fail selalu melempar error)
          case 'case': case 'default':
            this.fail(t.v === 'case' ? 'case label not within a switch statement' : "'default' label not within a switch statement", t, 'case dan default hanya boleh berada di dalam switch (...) { }.');
          // falls through
          case 'goto': this.fail("'goto' belum didukung di MiniC", t);
        }
        if (this.isTypeStart()) {
          const ty = this.parseType();
          const nt = this.cur;
          if (nt.t !== 'id') this.fail(`expected unqualified-id before ${this.tok(nt)}`, nt, 'Setelah tipe data harus ada nama variabel.');
          this.next();
          return this.parseDeclRest(ty, nt, false);
        }
        const n1 = this.peek(1);
        if (n1.t === 'id' && !this.isTypeWord(t.v)) {
          const sug = this.suggestType(t.v);
          const n2 = this.peek(2);
          if (sug) this.fail(`'${t.v}' was not declared in this scope; did you mean '${sug}'?`, t, 'Huruf besar dan kecil dibedakan. Tipe data ditulis huruf kecil, misal int, float, char.');
          if (n2.t === 'op' && ['=', ';', ',', '['].includes(n2.v)) this.fail(`'${t.v}' was not declared in this scope`, t, `Tipe data '${t.v}' tidak dikenal. Gunakan int, float, double, char${this.A ? ', bool, byte, atau String' : ', atau bool'}.`);
        }
      }
      const e = this.parseExpr();
      this.expect(';');
      return { k: 'expr', e, line: t.line, col: t.col };
    }

    parseDeclRest(ty, nameTok, isGlobal) {
      const items = [];
      let nt = nameTok;
      for (;;) {
        const dims = [];
        while (this.isOp('[')) { this.next(); dims.push(this.isOp(']') ? null : this.parseExpr()); this.expect(']'); }
        let init = null;
        if (this.isOp('=')) { this.next(); init = this.isOp('{') ? this.parseInitList() : this.parseAssign(); }
        else if (this.isOp('{')) init = this.parseInitList();
        items.push({ name: nt.v, dims, init, line: nt.line, col: nt.col });
        if (this.isOp(',')) {
          this.next();
          while (this.isOp('*')) this.next();
          nt = this.cur;
          if (nt.t !== 'id') this.fail(`expected unqualified-id before ${this.tok(nt)}`, nt);
          this.next(); continue;
        }
        break;
      }
      if (!this.isOp(';')) {
        const t = this.cur, pv = this.prev();
        if (t.t === 'eof' || t.line > pv.line) this.expect(';');
        if (this.isOp('(') && !items[items.length - 1].init) {
          this.fail(`'${nt.v}' adalah nama variabel, tetapi ditulis seperti fungsi`, t, 'Fungsi tidak boleh dibuat di dalam fungsi lain. Pindahkan ke luar, misalnya di atas main() atau setup().');
        }
        this.fail(`expected initializer before ${this.tok(t)}`, t, 'Penulisan deklarasi salah. Contoh benar: int x = 5;  atau  int a = 1, b = 2;  (di for: for (int i = 0; i < 5; i++) memakai titik koma).');
      }
      this.next();
      return { k: 'decl', ty, items, line: nameTok.line, col: nameTok.col, global: isGlobal };
    }

    parseInitList() {
      const open = this.expect('{');
      const items = [];
      while (!this.isOp('}')) {
        if (this.cur.t === 'eof') this.expect('}');
        items.push(this.isOp('{') ? this.parseInitList() : this.parseAssign());
        if (this.isOp(',')) { this.next(); continue; }
        if (!this.isOp('}')) this.expect('}', 'Pisahkan setiap isi array dengan koma, misal {1, 2, 3}.');
      }
      this.next();
      return { k: 'initlist', items, line: open.line, col: open.col };
    }

    parseIf() {
      const t = this.next();
      this.expect('(');
      const cond = this.parseExpr();
      this.expect(')');
      const then = this.parseStatement();
      let els = null;
      if (this.isKw('else')) { this.next(); els = this.parseStatement(); }
      return { k: 'if', cond, then, els, line: t.line, col: t.col };
    }
    parseWhile() {
      const t = this.next();
      this.expect('(');
      const cond = this.parseExpr();
      this.expect(')');
      const body = this.parseStatement();
      return { k: 'while', cond, body, line: t.line, col: t.col };
    }
    parseDo() {
      const t = this.next();
      const body = this.parseStatement();
      if (!this.isKw('while')) this.fail(`expected 'while' before ${this.tok(this.cur)}`, this.cur, 'Format: do { ... } while (kondisi);');
      const wt = this.next();
      this.expect('(');
      const cond = this.parseExpr();
      this.expect(')');
      this.expect(';');
      return { k: 'do', cond, body, line: t.line, col: t.col, cline: wt.line };
    }
    parseFor() {
      const t = this.next();
      this.expect('(');
      let init = null;
      if (this.isOp(';')) this.next();
      else if (this.isTypeStart()) {
        const ty = this.parseType();
        const nt = this.cur;
        if (nt.t !== 'id') this.fail(`expected unqualified-id before ${this.tok(nt)}`, nt);
        this.next();
        init = this.parseDeclRest(ty, nt, false);
      } else {
        const e = this.parseExpr();
        this.expect(';', 'Bagian for dipisah titik koma: for (awal; syarat; perubahan)');
        init = { k: 'expr', e, line: e.line, col: e.col };
      }
      const cond = this.isOp(';') ? null : this.parseExpr();
      this.expect(';', 'Bagian for dipisah titik koma: for (awal; syarat; perubahan)');
      const upd = this.isOp(')') ? null : this.parseExpr();
      this.expect(')');
      const body = this.parseStatement();
      return { k: 'for', init, cond, upd, body, line: t.line, col: t.col };
    }
    parseSwitch() {
      const t = this.next();
      this.expect('(');
      const disc = this.parseExpr();
      this.expect(')');
      this.expect('{');
      const cases = [];
      let cur = null;
      while (!this.isOp('}')) {
        if (this.cur.t === 'eof') this.expect('}');
        if (this.isKw('case')) {
          const ct = this.next();
          const test = this.parseCond();
          if (!this.isOp(':')) this.fail(`expected ':' before ${this.tok(this.cur)}`, this.cur, HINT_EXPECT[':']);
          this.next();
          cur = { test, body: [], line: ct.line, col: ct.col };
          cases.push(cur); continue;
        }
        if (this.isKw('default')) {
          const ct = this.next();
          this.expect(':');
          cur = { test: null, body: [], line: ct.line, col: ct.col };
          cases.push(cur); continue;
        }
        const st = this.parseStatement();
        if (cur) cur.body.push(st);
      }
      this.next();
      return { k: 'switch', disc, cases, line: t.line, col: t.col };
    }

    parseExpr() {
      let e = this.parseAssign();
      while (this.isOp(',')) {
        const t = this.next();
        e = { k: 'comma', a: e, b: this.parseAssign(), line: t.line, col: t.col };
      }
      return e;
    }
    parseAssign() {
      const l = this.parseCond();
      const t = this.cur;
      if (t.t === 'op' && ASSIGN_OPS.has(t.v)) {
        this.next();
        const r = this.parseAssign();
        return { k: 'assign', op: t.v, target: l, value: r, line: t.line, col: t.col };
      }
      return l;
    }
    parseCond() {
      const c = this.parseBin(1);
      if (this.isOp('?')) {
        const t = this.next();
        const a = this.parseExpr();
        this.expect(':');
        const b = this.parseAssign();
        return { k: 'cond', test: c, a, b, line: t.line, col: t.col };
      }
      return c;
    }
    parseBin(minPrec) {
      let l = this.parseUnary();
      for (;;) {
        const t = this.cur;
        if (t.t !== 'op') break;
        const p = PREC[t.v];
        if (!p || p < minPrec) break;
        this.next();
        const r = this.parseBin(p + 1);
        l = { k: 'bin', op: t.v, a: l, b: r, line: t.line, col: t.col };
      }
      return l;
    }
    parseUnary() {
      const t = this.cur;
      if (t.t === 'op') {
        if (t.v === '++' || t.v === '--') { this.next(); return { k: 'upd', op: t.v, prefix: true, arg: this.parseUnary(), line: t.line, col: t.col }; }
        if (t.v === '-' || t.v === '+' || t.v === '!' || t.v === '~') { this.next(); return { k: 'un', op: t.v, arg: this.parseUnary(), line: t.line, col: t.col }; }
        if (t.v === '&') { this.next(); return { k: 'addr', arg: this.parseUnary(), line: t.line, col: t.col }; }
        if (t.v === '*') this.fail('pointer (operator *) belum didukung di MiniC', t, 'Gunakan variabel biasa atau array.');
        if (t.v === '(' && this.isTypeStart(1)) {
          this.next();
          const ty = this.parseType();
          this.expect(')');
          return { k: 'cast', ty, arg: this.parseUnary(), line: t.line, col: t.col };
        }
      }
      if (t.t === 'id' && t.v === 'sizeof') {
        this.next();
        if (this.isOp('(') && this.isTypeStart(1)) {
          this.next();
          const ty = this.parseType();
          this.expect(')');
          return { k: 'sizeof', ty, line: t.line, col: t.col };
        }
        return { k: 'sizeof', arg: this.parseUnary(), line: t.line, col: t.col };
      }
      return this.parsePostfix(this.parsePrimary());
    }
    parsePostfix(e) {
      for (;;) {
        const t = this.cur;
        if (t.t !== 'op') break;
        if (t.v === '[') {
          this.next();
          const idx = this.parseExpr();
          this.expect(']');
          e = { k: 'index', obj: e, idx, line: t.line, col: t.col };
          continue;
        }
        if (t.v === '(') {
          this.next();
          const args = [];
          if (!this.isOp(')')) {
            for (;;) {
              args.push(this.parseAssign());
              if (this.isOp(',')) { this.next(); continue; }
              break;
            }
          }
          this.expect(')');
          e = { k: 'call', fn: e, args, line: e.line, col: e.col };
          continue;
        }
        if (t.v === '.') {
          this.next();
          const nt = this.cur;
          if (nt.t !== 'id') this.fail(`expected unqualified-id before ${this.tok(nt)}`, nt);
          this.next();
          e = { k: 'member', obj: e, name: nt.v, line: nt.line, col: nt.col };
          continue;
        }
        if (t.v === '->') this.fail('operator -> belum didukung di MiniC', t);
        if (t.v === '++' || t.v === '--') { this.next(); e = { k: 'upd', op: t.v, prefix: false, arg: e, line: t.line, col: t.col }; continue; }
        break;
      }
      return e;
    }
    parsePrimary() {
      const t = this.cur;
      if (t.t === 'num') { this.next(); return { k: 'num', v: t.v, isFloat: t.isFloat, f32: t.f32, uns: t.uns, lng: t.lng, line: t.line, col: t.col }; }
      if (t.t === 'chr') { this.next(); return { k: 'chr', v: t.v, line: t.line, col: t.col }; }
      if (t.t === 'str') {
        this.next();
        let s = t.v;
        while (this.cur.t === 'str') s += this.next().v;
        return { k: 'str', v: s, line: t.line, col: t.col };
      }
      if (t.t === 'id') {
        if (t.v === 'std' && this.isOp('::', 1)) {
          this.next(); this.next();
          const nt = this.cur;
          if (nt.t !== 'id') this.fail(`expected unqualified-id before ${this.tok(nt)}`, nt);
          this.next();
          return { k: 'id', name: nt.v, std: true, line: nt.line, col: nt.col };
        }
        if (t.v === 'true' || t.v === 'false') { this.next(); return { k: 'bool', v: t.v === 'true' ? 1 : 0, line: t.line, col: t.col }; }
        if (this.isBaseWord(t.v) && this.isOp('(', 1)) {
          if (t.v === 'String') { this.next(); return { k: 'id', name: 'String', line: t.line, col: t.col }; }
          const ty = this.parseType();
          this.expect('(');
          const arg = this.parseExpr();
          this.expect(')');
          return { k: 'cast', ty, arg, line: t.line, col: t.col };
        }
        this.next();
        return { k: 'id', name: t.v, line: t.line, col: t.col };
      }
      if (t.t === 'op' && t.v === '(') {
        this.next();
        const e = this.parseExpr();
        this.expect(')');
        e.paren = true;
        return e;
      }
      if (t.t === 'eof') { const pv = this.prev(); throw new CompileError('expected primary-expression at end of input', pv.eline || pv.line, pv.ecol || pv.col, 'Kode berakhir sebelum perintah selesai ditulis.'); }
      this.fail(`expected primary-expression before ${this.tok(t)}`, t,
        t.v === ')' ? 'Ada nilai yang hilang sebelum tanda ). Periksa koma atau operator yang berlebih.' :
          t.v === ';' ? 'Perintah belum lengkap: ada operator atau tanda = tanpa nilai setelahnya.' :
            'Di posisi ini seharusnya ada nilai, variabel, atau pemanggilan fungsi.');
    }
  }

  /* ============================== Generator kode ============================== */
  const isArr = t => !!(t && t.dims && t.dims.length);
  const isIntT = t => !isArr(t) && t.k === 'int';
  const isFlt = t => !isArr(t) && t.k === 'float';
  const isNum = t => isIntT(t) || isFlt(t);
  const isStrT = t => !isArr(t) && t.k === 'str';
  const isCharArr = t => isArr(t) && t.dims.length === 1 && t.k === 'int' && !!t.char;
  const elemOf = t => {
    const e = Object.assign({}, t, { dims: t.dims.slice(1) });
    if (!e.dims.length) delete e.dims;
    return e;
  };
  const CHAR_T = { k: 'int', bits: 8, uns: false, char: true };
  const VOID_T = { k: 'void' };
  const STR_T = { k: 'str' };

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 9;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[m][n];
  }

  const KNOWN_FUNCS = ['printf', 'scanf', 'puts', 'putchar', 'getchar', 'sqrt', 'pow', 'abs', 'fabs', 'sin', 'cos', 'tan', 'round', 'floor', 'ceil',
    'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'delay', 'millis', 'map', 'constrain', 'random', 'tone', 'noTone', 'pulseIn',
    'strlen', 'strcpy', 'strcmp', 'strcat', 'rand', 'srand', 'time', 'getline', 'to_string', 'max', 'min'];
  const ARDUINO_ONLY = new Set(['pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'delay', 'delayMicroseconds', 'millis', 'micros',
    'map', 'constrain', 'random', 'randomSeed', 'tone', 'noTone', 'pulseIn', 'Serial', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN',
    'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'String', 'setup', 'loop']);
  const MATH1 = { sqrt: 'Math.sqrt', sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan', asin: 'Math.asin', acos: 'Math.acos', atan: 'Math.atan',
    exp: 'Math.exp', log: 'Math.log', log10: 'Math.log10', log2: 'Math.log2', floor: 'Math.floor', ceil: 'Math.ceil', trunc: 'Math.trunc',
    fabs: 'Math.abs', cbrt: 'Math.cbrt', round: 'rt.round' };
  const MATH2 = { pow: 'Math.pow', atan2: 'Math.atan2', fmod: 'rt.fmod', hypot: 'Math.hypot' };

  class Gen {
    constructor(opt, lx, usingStd) {
      this.opt = opt;
      this.A = opt.mode === 'arduino';
      this.cpp = this.A || opt.lang !== 'c';
      this.INT = this.A ? 16 : 32;
      this.LONG = this.A ? 32 : 64;
      this.errors = []; this.warnings = [];
      this.scopes = [new Map()];
      this.funcs = new Map();
      this.fn = null;
      this.loopDepth = 0; this.switchDepth = 0;
      this.includes = new Set(lx.includes);
      this.usingStd = usingStd;
      this.trace = !!opt.trace;
    }

    err(msg, node, hint) { if (this.errors.length < 25) this.errors.push(new CompileError(msg, node && node.line, node && node.col, hint)); }
    warn(msg, node, hint) { if (this.warnings.length < 40) this.warnings.push(new CompileError(msg, node && node.line, node && node.col, hint, 'warning')); }

    intT() { return { k: 'int', bits: this.INT, uns: false }; }
    longT() { return { k: 'int', bits: this.LONG, uns: false }; }
    ulongT() { return { k: 'int', bits: this.LONG, uns: true }; }
    dblT() { return { k: 'float', bits: this.A ? 32 : 64 }; }
    fltT() { return { k: 'float', bits: 32 }; }
    boolT() { return this.cpp ? { k: 'int', bits: 8, uns: true, bool: true } : this.intT(); }
    dummy() { return { c: '0', t: this.intT() }; }

    push() { this.scopes.push(new Map()); }
    pop() { this.scopes.pop(); }
    lookup(name) {
      for (let i = this.scopes.length - 1; i >= 0; i--) { const v = this.scopes[i].get(name); if (v) return v; }
      return null;
    }
    declare(name, ty, node, extra) {
      const sc = this.scopes[this.scopes.length - 1];
      if (sc.has(name)) {
        const prev = sc.get(name);
        this.err(this.cpp ? `redeclaration of '${this.tname(ty)} ${name}'` : `redefinition of '${name}'`, node,
          `Variabel '${name}' sudah dibuat di baris ${prev.line}. Pakai nama lain, atau hapus tipe datanya jika hanya ingin mengubah nilai: ${name} = ...;`);
        return prev;
      }
      if (this.scopes.length === 1 && this.funcs.has(name)) this.err(`'${name}' redeclared as different kind of entity`, node, `Nama '${name}' sudah dipakai untuk fungsi.`);
      const v = Object.assign({ name, ty, js: '$' + name, line: node.line }, extra || {});
      sc.set(name, v);
      return v;
    }

    tname(t) {
      if (!t) return '?';
      let s;
      if (t.k === 'void') s = 'void';
      else if (t.k === 'auto') s = 'auto';
      else if (t.k === 'str') s = (t.lit || t.cstr) ? 'const char*' : this.A ? 'String' : 'std::string';
      else if (t.k === 'float') s = t.bits === 32 ? 'float' : 'double';
      else if (t.bool) s = this.cpp ? 'bool' : '_Bool';
      else if (t.char) s = t.uns ? 'unsigned char' : 'char';
      else {
        const u = t.uns ? 'unsigned ' : '';
        if (t.bits === 8) s = t.uns ? (this.A ? 'byte' : 'unsigned char') : 'signed char';
        else if (t.bits === 16) s = this.A ? u + 'int' : (t.uns ? 'short unsigned int' : 'short int');
        else if (t.bits === 32) s = this.A ? u + 'long' : (t.uns ? 'unsigned int' : 'int');
        else s = this.A ? u + 'long long' : (t.uns ? 'long unsigned int' : 'long int');
      }
      if (isArr(t)) s += ' [' + t.dims.map(d => (d == null ? '' : d)).join('][') + ']';
      return s;
    }
    tag(t) {
      if (isCharArr(t)) return 'a';
      if (isStrT(t)) return 's';
      if (isFlt(t)) return 'f';
      if (isIntT(t)) return t.bool ? 'b' : t.char ? 'c' : t.uns ? 'u' : 'i';
      return 'i';
    }
    nameOf(n) {
      if (!n) return '?';
      if (n.k === 'id') return n.name;
      if (n.k === 'index') return this.nameOf(n.obj);
      if (n.k === 'addr') return this.nameOf(n.arg);
      return 'ekspresi';
    }
    suggest(name) {
      const cands = new Set(KNOWN_FUNCS.filter(f => this.A || !ARDUINO_ONLY.has(f)));
      for (const sc of this.scopes) for (const k of sc.keys()) cands.add(k);
      for (const k of this.funcs.keys()) cands.add(k);
      if (this.A) ['HIGH', 'LOW', 'OUTPUT', 'INPUT', 'INPUT_PULLUP', 'Serial', 'LED_BUILTIN'].forEach(x => cands.add(x));
      const lower = name.toLowerCase();
      for (const c of cands) if (c !== name && c.toLowerCase() === lower) return c;
      if (name.length < 3) return null;
      let best = null, bd = 3;
      for (const c of cands) {
        if (c === name) continue;
        const d = lev(name, c);
        if (d < bd && d <= (name.length > 5 ? 2 : 1)) { bd = d; best = c; }
      }
      return best;
    }

    /* ---------- konversi tipe ---------- */
    wrap(c, t) {
      if (t.bool) return `((${c}) ? 1 : 0)`;
      switch (t.bits) {
        case 8: return t.uns ? `((${c}) & 255)` : `((${c}) << 24 >> 24)`;
        case 16: return t.uns ? `((${c}) & 65535)` : `((${c}) << 16 >> 16)`;
        case 32: return t.uns ? `((${c}) >>> 0)` : `((${c}) | 0)`;
        default: return `rt.w64(${c})`;
      }
    }
    promote(t) {
      if (t.k !== 'int') return t;
      if (t.bits < this.INT) return this.intT();
      return { k: 'int', bits: t.bits, uns: t.uns };
    }
    arithType(a, b) {
      if (a.k === 'float' || b.k === 'float') return { k: 'float', bits: Math.max(a.k === 'float' ? a.bits : 0, b.k === 'float' ? b.bits : 0) };
      const pa = this.promote(a), pb = this.promote(b);
      if (pa.bits !== pb.bits) return pa.bits > pb.bits ? pa : pb;
      return { k: 'int', bits: pa.bits, uns: pa.uns || pb.uns };
    }
    toStrCode(e) {
      if (isStrT(e.t)) return e.c;
      if (isCharArr(e.t)) return `rt.cstr(${e.c})`;
      if (isIntT(e.t) && e.t.char) return `String.fromCharCode(${e.c})`;
      return `rt.S(${e.c}, "${this.tag(e.t)}")`;
    }
    conv(e, to, node) {
      const f = e.t;
      if (f.k === 'void') { this.err('void value not ignored as it ought to be', node || {}, 'Fungsi bertipe void tidak menghasilkan nilai, jadi hasilnya tidak bisa dipakai atau disimpan.'); return '0'; }
      if (to.k === 'void' || to.k === 'auto') return e.c;
      if (to.k === 'str') {
        if (isStrT(f)) return e.c;
        if (isCharArr(f)) return `rt.cstr(${e.c})`;
        if (isIntT(f) && f.char) return `String.fromCharCode(${e.c})`;
        if (this.A && isNum(f)) return `rt.S(${e.c}, "${this.tag(f)}")`;
        this.err(`conversion from '${this.tname(f)}' to non-scalar type '${this.tname(to)}' requested`, node || {}, this.cpp ? 'Gunakan to_string(x) untuk mengubah angka menjadi teks.' : 'Teks dan angka adalah tipe yang berbeda.');
        return '""';
      }
      if (isArr(f)) {
        this.err(`invalid conversion from '${this.tname(f)}' to '${this.tname(to)}'`, node || {}, 'Array tidak bisa disimpan ke variabel biasa. Ambil salah satu elemennya, misal a[0].');
        return '0';
      }
      if (isStrT(f)) {
        this.err(`invalid conversion from '${this.tname(f)}' to '${this.tname(to)}'`, node || {}, f.lit && to.char ? "Satu karakter ditulis dengan tanda kutip tunggal, misal 'M' (bukan \"M\")." : 'Teks tidak bisa langsung disimpan ke variabel angka.');
        return '0';
      }
      if (to.k === 'float') {
        if (to.bits === 32) return (f.k === 'float' && f.bits === 32) ? e.c : `Math.fround(${e.c})`;
        return e.c;
      }
      if (to.bool) return f.bool ? e.c : `((${e.c}) ? 1 : 0)`;
      let c = e.c;
      if (f.k === 'float') c = `rt.ftoi(${c})`;
      else if (f.bits === to.bits && f.uns === to.uns) return c;
      else if (f.bits < to.bits && (f.uns || !to.uns)) return c;
      return this.wrap(c, to);
    }

    /* ---------- program ---------- */
    paramType(p) {
      const t = Object.assign({}, p.ty);
      if (p.dims.length) { t.dims = p.dims.map(d => (d ? this.constEval(d) : null)); t.dims[0] = null; t.param = true; }
      return t;
    }
    sigOf(f) {
      return `${this.tname(f.ret)} ${f.name}(${f.params.map(p => this.tname(p)).join(', ')})`;
    }

    genProgram(decls) {
      for (const d of decls) {
        if (d.k !== 'func' && d.k !== 'proto') continue;
        const ex = this.funcs.get(d.name);
        if (ex) {
          if (d.k === 'func' && ex.def) this.err(`redefinition of '${this.sigOf(ex)}'`, d, `Fungsi ${d.name}() sudah dibuat di baris ${ex.def.line}. Satu fungsi hanya boleh dibuat sekali.`);
          if (d.k === 'func') ex.def = d;
          continue;
        }
        this.funcs.set(d.name, { name: d.name, ret: d.ret, params: d.params.map(p => this.paramType(p)), def: d.k === 'func' ? d : null, node: d });
      }
      const globals = [], inits = [], fns = [];
      for (const d of decls) {
        if (d.k === 'decl') {
          for (const it of d.items) {
            let ty = d.ty;
            if (ty.k === 'void') { this.err(`variable or field '${it.name}' declared void`, it); ty = this.intT(); }
            this.checkBoolType(ty, it);
            const r = this.declInit(ty, it);
            const v = this.declare(it.name, r.ty, it, r.cval !== undefined ? { cval: r.cval } : null);
            globals.push(`let ${v.js};`);
            inits.push(`rt.L=${it.line}; ${v.js} = ${r.code};`);
          }
        } else if (d.k === 'func') fns.push(this.genFunc(d));
      }
      for (const [name, f] of this.funcs) {
        if (!f.def && this.usedFuncs && this.usedFuncs.has(name)) this.err(`undefined reference to '${name}'`, f.node, `Fungsi ${name}() hanya dideklarasikan (prototype) tetapi isinya belum dibuat.`);
      }
      const entries = [];
      if (this.A) {
        for (const nm of ['setup', 'loop']) {
          if (!this.funcs.get(nm) || !this.funcs.get(nm).def) {
            this.err(`undefined reference to '${nm}'`, { line: 1, col: 1 }, `Sketch Arduino wajib punya fungsi void ${nm}() { ... }.` + (this.funcs.has('main') ? ' Program Arduino tidak memakai main().' : ''));
          }
        }
        entries.push('setup: F_setup', 'loop: F_loop');
      } else {
        const m = this.funcs.get('main');
        if (!m || !m.def) {
          const ard = this.funcs.has('setup') || this.funcs.has('loop');
          this.err("undefined reference to 'main'", { line: 1, col: 1 }, ard ? 'Ini kode Arduino (setup/loop). Jalankan di Simulator Arduino, bukan di compiler C/C++.' : 'Program C/C++ wajib punya fungsi int main() { ... }.');
        }
        entries.push('main: F_main');
      }
      return '"use strict";\n' + globals.join('\n') +
        `\nfunction* __init() {\nlet $$t;\n${inits.join('\n')}\n}\n` + fns.join('\n') +
        `\nreturn { init: __init, ${entries.join(', ')} };`;
    }

    checkBoolType(ty, node) {
      if (ty.bool && !this.cpp && !this.includes.has('stdbool.h')) {
        this.err("unknown type name 'bool'", node, 'Di bahasa C, tipe bool butuh #include <stdbool.h>. Atau gunakan int dengan nilai 0 (salah) dan 1 (benar).');
      }
    }

    genFunc(d) {
      this.fn = { name: d.name, ret: d.ret, node: d };
      this.loopDepth = 0; this.switchDepth = 0;
      if (d.name === 'main' && !this.A && !(d.ret.k === 'int' && !d.ret.bool && !d.ret.char)) {
        if (this.cpp) this.err("'::main' must return 'int'", d, 'Tulis int main() { ... return 0; } (bukan void main).');
        else this.warn("return type of 'main' is not 'int'", d, 'Sebaiknya tulis int main() lalu akhiri dengan return 0;');
      }
      this.push();
      const ps = [];
      for (const p of d.params) {
        if (!p.name) continue;
        this.checkBoolType(p.ty, p);
        const v = this.declare(p.name, this.paramType(p), p, { param: true });
        ps.push(v.js);
      }
      const body = this.stmts(d.body.body);
      this.pop();
      const last = d.body.body[d.body.body.length - 1];
      if (d.ret.k !== 'void' && d.name !== 'main' && (!last || last.k !== 'return')) {
        this.warn('control reaches end of non-void function', d, `Fungsi ${d.name}() bertipe ${this.tname(d.ret)}, jadi harus diakhiri return nilai;`);
      }
      this.fn = null;
      return `function* F_${d.name}(${ps.join(', ')}) {\nlet $$t; if (++rt.D > 1500) rt.so(); rt.stk.push(${JSON.stringify(d.name)});\ntry {\n${body}\n${d.ret.k === 'void' ? '' : 'return 0;'}\n} finally { rt.D--; rt.stk.pop(); }\n}`;
    }

    /* ---------- pernyataan ---------- */
    stmts(list) { return list.map(s => this.stmt(s)).join('\n'); }
    traceObj(line) {
      const seen = new Map();
      for (const sc of this.scopes) for (const [k, v] of sc) seen.set(k, v);
      const vs = [...seen.values()];
      return `{t:'s',l:${line},n:${JSON.stringify(vs.map(v => [v.name, this.tname(v.ty)]))},v:()=>[${vs.map(v => v.js).join(',')}]}`;
    }
    tr(node) {
      let s = `rt.L=${node.line};`;
      if (this.trace) s += ` if (rt.T) yield ${this.traceObj(node.line)};`;
      return s;
    }
    sub(st) {
      if (st.k === 'block') return this.stmt(st);
      this.push();
      const s = this.stmt(st);
      this.pop();
      return `{ ${s} }`;
    }
    discard(e) {
      if (!e) return;
      if (e.k === 'upd') e.prefix = true;
      if (e.k === 'comma') { this.discard(e.a); this.discard(e.b); }
    }
    cond(n) {
      if (n.k === 'assign' && n.op === '=' && !n.paren) {
        this.warn('suggest parentheses around assignment used as truth value', n, 'Tanda = berarti MENGISI nilai. Untuk MEMBANDINGKAN gunakan == (dua tanda sama dengan).');
      }
      const e = this.ex(n);
      if (e.t.k === 'void') this.err('void value not ignored as it ought to be', n);
      else if (isArr(e.t)) this.warn('the address of an array will always evaluate as true', n);
      return e.c;
    }
    emptyBody(st, kind) {
      if (st.k === 'empty') {
        this.warn(`suggest braces around empty body in ${kind === 'if' ? "an 'if'" : `a '${kind}'`} statement`, st,
          `Ada titik koma ; tepat setelah ${kind} (...). Akibatnya ${kind} tidak mengendalikan perintah di bawahnya. Hapus titik koma tersebut.`);
      }
    }
    loopCond(c, line) {
      return this.trace ? `(rt.L=${line}, (rt.T ? (yield ${this.traceObj(line)}) : 0), ${c})` : c;
    }

    stmt(s) {
      switch (s.k) {
        case 'block': {
          this.push();
          const b = this.stmts(s.body);
          this.pop();
          return `{\n${b}\n}`;
        }
        case 'empty': return ';';
        case 'decl': return this.tr(s) + ' ' + this.localDecl(s, false);
        case 'expr': {
          this.discard(s.e);
          this.noEffect(s.e);
          const e = this.ex(s.e);
          return `${this.tr(s)} ${e.c};`;
        }
        case 'if': {
          const c = this.cond(s.cond);
          this.emptyBody(s.then, 'if');
          let out = `${this.tr(s)} if (${c}) ${this.sub(s.then)}`;
          if (s.els) out += ` else ${this.sub(s.els)}`;
          return out;
        }
        case 'while': {
          const c = this.cond(s.cond);
          this.emptyBody(s.body, 'while');
          this.loopDepth++;
          const b = this.sub(s.body);
          this.loopDepth--;
          return `rt.L=${s.line}; while (${this.loopCond(c, s.line)}) { if (--rt.B < 0) yield 0; ${b} }`;
        }
        case 'do': {
          this.loopDepth++;
          const b = this.sub(s.body);
          this.loopDepth--;
          const c = this.cond(s.cond);
          return `rt.L=${s.line}; do { if (--rt.B < 0) yield 0; ${b} } while (${this.loopCond(c, s.cline || s.line)});`;
        }
        case 'for': {
          this.push();
          let init = '';
          if (s.init) {
            if (s.init.k === 'decl') init = this.localDecl(s.init, true);
            else { this.discard(s.init.e); init = this.ex(s.init.e).c; }
          }
          const c = s.cond ? this.cond(s.cond) : 'true';
          const tcond = this.loopCond(c, s.line);
          if (s.upd) this.discard(s.upd);
          const u = s.upd ? this.ex(s.upd).c : '';
          this.emptyBody(s.body, 'for');
          this.loopDepth++;
          const b = this.sub(s.body);
          this.loopDepth--;
          this.pop();
          return `rt.L=${s.line}; for (${init}; ${tcond}; ${u}) { if (--rt.B < 0) yield 0; ${b} }`;
        }
        case 'switch': {
          const d = this.ex(s.disc);
          if (!isIntT(d.t)) this.err('switch quantity not an integer', s.disc, 'switch hanya bisa memeriksa bilangan bulat (int) atau karakter (char).');
          const seen = new Set();
          let out = `${this.tr(s)} switch (${d.c}) {\n`;
          this.switchDepth++;
          this.push();
          for (const cs of s.cases) {
            if (cs.test) {
              const v = this.constEval(cs.test);
              if (v === undefined || !Number.isInteger(v)) { this.err('case label does not reduce to an integer constant', cs.test, "Nilai case harus konstanta bilangan bulat atau karakter, misal case 1: atau case 'A':"); out += 'case NaN:\n'; }
              else if (seen.has(v)) { this.err('duplicate case value', cs.test, `case ${v} ditulis lebih dari sekali.`); }
              else { seen.add(v); out += `case ${v}:\n`; }
            } else {
              if (seen.has('default')) this.err('multiple default labels in one switch', cs);
              seen.add('default');
              out += 'default:\n';
            }
            out += this.tr(cs) + '\n' + this.stmts(cs.body) + '\n';
          }
          this.pop();
          this.switchDepth--;
          return out + '}';
        }
        case 'break':
          if (!this.loopDepth && !this.switchDepth) this.err('break statement not within loop or switch', s, 'break hanya boleh di dalam perulangan (for/while) atau switch.');
          return `${this.tr(s)} break;`;
        case 'continue':
          if (!this.loopDepth) this.err('continue statement not within a loop', s, 'continue hanya boleh di dalam perulangan.');
          return `${this.tr(s)} continue;`;
        case 'return': {
          const f = this.fn;
          if (!s.arg) {
            if (f.ret.k !== 'void' && f.name !== 'main') this.warn("'return' with no value, in function returning non-void", s);
            return `${this.tr(s)} return${f.ret.k === 'void' ? '' : ' 0'};`;
          }
          if (f.ret.k === 'void') {
            this.ex(s.arg);
            this.err("return-statement with a value, in function returning 'void'", s, 'Fungsi void tidak mengembalikan nilai. Ganti tipe fungsinya (misal float) atau hapus nilai setelah return.');
            return '';
          }
          const e = this.ex(s.arg);
          return `${this.tr(s)} return ${this.conv(e, f.ret, s.arg)};`;
        }
      }
      this.err('pernyataan tidak dikenal', s);
      return '';
    }

    noEffect(e) {
      if (e.k === 'bin' && ['==', '!=', '<', '>', '<=', '>='].includes(e.op)) {
        this.warn('statement has no effect', e, e.op === '==' ? 'Perbandingan == tidak mengubah apa pun. Mungkin maksudnya = (mengisi nilai)?' : 'Hasil perbandingan ini tidak dipakai.');
      } else if (e.k === 'id' || e.k === 'num') {
        this.warn('statement has no effect', e, this.funcs.has(e.name) ? `Untuk memanggil fungsi tulis ${e.name}();` : 'Baris ini tidak melakukan apa-apa.');
      }
    }

    localDecl(s, forInit) {
      const parts = [];
      for (const it of s.items) {
        let ty = s.ty;
        if (ty.k === 'void') { this.err(`variable or field '${it.name}' declared void`, it, 'Tipe void tidak bisa dipakai untuk variabel.'); ty = this.intT(); }
        this.checkBoolType(ty, it);
        const r = this.declInit(ty, it);
        const v = this.declare(it.name, r.ty, it, r.cval !== undefined ? { cval: r.cval } : null);
        parts.push(`${v.js} = ${r.code}`);
      }
      return forInit ? `let ${parts.join(', ')}` : `let ${parts.join(', ')};`;
    }

    defaultVal(ty) { return ty.k === 'str' ? '""' : '0'; }

    declInit(ty0, it) {
      let ty = Object.assign({}, ty0);
      let init = it.init;
      if (ty.k === 'auto') {
        if (!init || init.k === 'initlist') { this.err(`declaration of 'auto ${it.name}' has no initializer`, it); return { ty: this.intT(), code: '0' }; }
        const e = this.ex(init);
        ty = Object.assign({}, e.t);
        delete ty.lit;
        if (ty.k === 'void') { this.err(`variable '${it.name}' declared void`, it); ty = this.intT(); }
        return { ty, code: e.c };
      }
      if (it.dims.length) return this.arrayInit(ty, it);
      if (!init) return { ty, code: this.defaultVal(ty) };
      if (init.k === 'initlist') {
        if (init.items.length !== 1) { this.err(`scalar object '${it.name}' requires one element in initializer`, init); return { ty, code: this.defaultVal(ty) }; }
        init = init.items[0];
      }
      const e = this.ex(init);
      const res = { ty, code: this.conv(e, ty, init) };
      if (ty.cst) { const cv = this.constEval(init); if (cv !== undefined) res.cval = ty.k === 'int' ? Math.trunc(cv) : cv; }
      return res;
    }

    arrayInit(ty, it) {
      const dimsCv = [], dimCodes = [];
      const init = it.init;
      it.dims.forEach((d, k) => {
        if (!d) {
          if (k === 0 && init) { dimsCv.push(null); dimCodes.push(null); return; }
          this.err(`array size missing in '${it.name}'`, it, 'Tulis ukuran array, misal int data[5]; atau isi langsung: int data[] = {1, 2, 3};');
          dimsCv.push(1); dimCodes.push('1'); return;
        }
        const cv = this.constEval(d);
        if (cv !== undefined) {
          if (!Number.isInteger(cv)) { this.err(`size of array '${it.name}' has non-integral type`, d, 'Ukuran array harus bilangan bulat.'); dimsCv.push(1); dimCodes.push('1'); return; }
          if (cv <= 0) { this.err(`size of array '${it.name}' is ${cv < 0 ? 'negative' : 'zero'}`, d, 'Ukuran array minimal 1.'); dimsCv.push(1); dimCodes.push('1'); return; }
          dimsCv.push(cv); dimCodes.push(String(cv)); return;
        }
        const e = this.ex(d);
        if (!isIntT(e.t)) this.err(`size of array '${it.name}' has non-integral type '${this.tname(e.t)}'`, d);
        if (init) this.err('variable-sized object may not be initialized', it, 'Array yang ukurannya berupa variabel tidak boleh langsung diisi { }. Gunakan angka atau konstanta untuk ukurannya.');
        dimsCv.push(null); dimCodes.push(e.c);
      });
      const elemT = Object.assign({}, ty);
      let code;
      if (!init) code = `rt.arr([${dimCodes.join(', ')}], ${this.defaultVal(ty)})`;
      else if (init.k === 'str' && ty.k === 'int' && ty.char && it.dims.length === 1) {
        if (dimsCv[0] == null) dimsCv[0] = init.v.length + 1;
        else if (init.v.length > dimsCv[0]) this.err(`initializer-string for '${this.tname(Object.assign({}, ty, { dims: dimsCv }))}' is too long`, it, `Teks "${init.v}" butuh ${init.v.length + 1} tempat (termasuk penutup \\0), tetapi array hanya ${dimsCv[0]}.`);
        code = `rt.cs(${JSON.stringify(init.v)}, ${dimsCv[0]})`;
      } else if (init.k === 'initlist') {
        if (dimsCv[0] == null) dimsCv[0] = init.items.length;
        const lit = this.initList(init, dimsCv, 0, elemT, it);
        code = `rt.pad(${lit}, [${dimsCv.map(d => (d == null ? 'null' : d)).join(', ')}], ${this.defaultVal(ty)})`;
      } else {
        this.ex(init);
        this.err('array must be initialized with a brace-enclosed initializer', init, 'Array diisi dengan kurung kurawal, misal int a[3] = {1, 2, 3};');
        code = '[]';
      }
      return { ty: Object.assign({}, ty, { dims: dimsCv }), code };
    }

    initList(list, dims, level, elemT, it) {
      const cap = dims[level];
      if (cap != null && list.items.length > cap) {
        this.err(`too many initializers for '${this.tname(Object.assign({}, elemT, { dims: dims.slice(level) }))}'`, list, `Array ${it.name} hanya muat ${cap} elemen, tetapi diisi ${list.items.length} nilai.`);
      }
      const parts = list.items.map(item => {
        if (level < dims.length - 1) {
          if (item.k === 'str' && elemT.char && level === dims.length - 2) return `rt.cs(${JSON.stringify(item.v)}, ${dims[level + 1]})`;
          if (item.k !== 'initlist') { this.err('braces around each row are needed for this array', item, 'Untuk array 2 dimensi, isi tiap baris dengan { }, misal {{1, 2}, {3, 4}}.'); return '[]'; }
          return this.initList(item, dims, level + 1, elemT, it);
        }
        if (item.k === 'initlist') { this.err('braces around scalar initializer', item); return '0'; }
        return this.conv(this.ex(item), elemT, item);
      });
      return `[${parts.join(', ')}]`;
    }

    /* ---------- ekspresi ---------- */
    ex(n) {
      switch (n.k) {
        case 'num': return this.numLit(n);
        case 'chr': return { c: String(n.v), t: CHAR_T, cv: n.v };
        case 'bool':
          if (!this.cpp && !this.includes.has('stdbool.h')) this.err(`'${n.v ? 'true' : 'false'}' undeclared (first use in this function)`, n, 'Di bahasa C, true/false butuh #include <stdbool.h>. Atau gunakan 1 dan 0.');
          return { c: String(n.v), t: this.boolT(), cv: n.v };
        case 'str': return { c: JSON.stringify(n.v), t: { k: 'str', lit: true } };
        case 'id': return this.ident(n);
        case 'bin': return this.binary(n);
        case 'assign': return this.assign(n);
        case 'un': return this.unary(n);
        case 'upd': return this.update(n);
        case 'cond': return this.ternary(n);
        case 'call': return this.call(n);
        case 'index': return this.index(n);
        case 'cast': return this.cast(n);
        case 'sizeof': return this.sizeofE(n);
        case 'comma': { const a = this.ex(n.a), b = this.ex(n.b); return { c: `(${a.c}, ${b.c})`, t: b.t }; }
        case 'member':
          if (n.obj.k === 'id' && n.obj.name === 'Serial') this.err(`invalid use of member function 'Serial.${n.name}'`, n, `Panggil dengan tanda kurung: Serial.${n.name}()`);
          else this.err(`'${n.name}' harus dipanggil dengan tanda kurung`, n, `Tulis ${this.nameOf(n.obj)}.${n.name}()`);
          return this.dummy();
        case 'addr': this.err('operator & (alamat) hanya didukung di dalam scanf', n, 'Contoh pemakaian yang benar: scanf("%d", &x);'); return this.dummy();
        case 'initlist': this.err("expected primary-expression before '{' token", n, 'Kurung kurawal { } hanya untuk mengisi array saat deklarasi.'); return this.dummy();
      }
      this.err('ekspresi tidak didukung', n);
      return this.dummy();
    }

    numLit(n) {
      if (n.isFloat) {
        const f32 = n.f32 || this.A;
        return { c: numJS(f32 ? Math.fround(n.v) : n.v), t: { k: 'float', bits: f32 ? 32 : 64 }, cv: n.v };
      }
      let bits = n.lng >= 2 ? 64 : n.lng === 1 ? this.LONG : this.INT;
      const fits = b => (n.uns ? n.v <= 2 ** b - 1 : n.v <= 2 ** (b - 1) - 1);
      while (!fits(bits) && bits < 64) bits *= 2;
      return { c: numJS(n.v), t: { k: 'int', bits, uns: !!n.uns }, cv: n.v };
    }

    constant(name) {
      if (this.A) {
        const AC = { HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, DEC: 10, HEX: 16, OCT: 8, BIN: 2 };
        if (name in AC) return { c: String(AC[name]), t: this.intT(), cv: AC[name] };
        const FC = { PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI };
        if (name in FC) return { c: numJS(Math.fround(FC[name])), t: this.fltT(), cv: FC[name] };
        if (name === 'Serial') return { c: '1', t: { k: 'int', bits: 8, uns: true, bool: true } };
      }
      const CC = { NULL: 0, EOF: -1, RAND_MAX: 2147483647, INT_MAX: this.A ? 32767 : 2147483647, INT_MIN: this.A ? -32768 : -2147483648, LONG_MAX: this.A ? 2147483647 : 9223372036854775807, CHAR_MAX: 127 };
      if (name in CC && (this.A || this.includes.size)) return { c: numJS(CC[name]), t: name.startsWith('LONG') ? this.longT() : this.intT(), cv: CC[name] };
      if (name === 'M_PI') return { c: numJS(Math.PI), t: this.dblT(), cv: Math.PI };
      if (name === 'M_E') return { c: numJS(Math.E), t: this.dblT(), cv: Math.E };
      return null;
    }

    ident(n) {
      const v = this.lookup(n.name);
      if (v) return { c: v.js, t: v.ty, lv: { js: v.js }, cv: v.cval, name: n.name };
      const k = this.constant(n.name);
      if (k) return k;
      if (this.funcs.has(n.name)) {
        this.err(`invalid use of function '${n.name}'`, n, `Untuk memanggil fungsi tulis ${n.name}(...)`);
        return this.dummy();
      }
      if (['cout', 'cin', 'endl', 'cerr'].includes(n.name) && this.cpp) {
        this.err(`'${n.name}' tidak bisa dipakai sendirian`, n, n.name === 'endl' ? 'endl dipakai bersama cout, misal cout << x << endl;' : `Contoh: ${n.name === 'cin' ? 'cin >> x;' : 'cout << x;'}`);
        return this.dummy();
      }
      this.undeclared(n);
      return this.dummy();
    }

    undeclared(n) {
      const name = n.name;
      const sug = this.suggest(name);
      let msg = this.cpp ? `'${name}' was not declared in this scope` : `'${name}' undeclared (first use in this function)`;
      if (sug) msg += `; did you mean '${sug}'?`;
      let hint = sug ? `Mungkin maksudnya '${sug}'. Ingat: huruf besar dan kecil dibedakan.` : `'${name}' belum dibuat. Deklarasikan dulu, misal: int ${name} = 0;`;
      if (!this.A && ARDUINO_ONLY.has(name)) hint = 'Ini perintah Arduino. Jalankan kode ini di Simulator Arduino, bukan di compiler C/C++ biasa.';
      if (['cout', 'cin', 'endl'].includes(name) && !this.cpp) hint = 'cout/cin hanya ada di C++. Pilih bahasa C++ (file .cpp).';
      if (['getch', 'clrscr', 'getche'].includes(name)) hint = 'Fungsi conio.h (Turbo C lama) tidak ada di compiler modern. Gunakan getchar() sebagai pengganti getch().';
      if ((name === 'max' || name === 'min') && !this.cpp) hint = `Bahasa C tidak punya fungsi ${name}() bawaan. Gunakan if, atau buat fungsi sendiri.`;
      this.err(msg, n, hint);
    }

    binary(n) {
      if (n.op === '<<' || n.op === '>>') {
        let root = n;
        while (root.k === 'bin' && (root.op === '<<' || root.op === '>>')) root = root.a;
        if (root.k === 'id' && ['cout', 'cerr', 'cin'].includes(root.name) && !this.lookup(root.name)) return this.stream(n, root);
      }
      const a = this.ex(n.a), b = this.ex(n.b);
      const op = n.op;
      if (a.t.k === 'void' || b.t.k === 'void') { this.err('void value not ignored as it ought to be', n, 'Fungsi void tidak menghasilkan nilai.'); return this.dummy(); }
      if (op === '&&' || op === '||') return { c: `(${a.c} ${op} ${b.c} ? 1 : 0)`, t: this.boolT() };
      if (['==', '!=', '<', '>', '<=', '>='].includes(op)) return this.compare(op, a, b, n);
      return this.arith(op, a, b, n);
    }

    compare(op, a, b, n) {
      const jsop = op === '==' ? '===' : op === '!=' ? '!==' : op;
      const textish = t => isStrT(t) || isCharArr(t);
      if (textish(a.t) || textish(b.t)) {
        if (!textish(a.t) || !textish(b.t)) {
          this.err(`no match for 'operator${op}' (operand types are '${this.tname(a.t)}' and '${this.tname(b.t)}')`, n, 'Teks hanya bisa dibandingkan dengan teks.');
          return this.dummy();
        }
        const realString = (isStrT(a.t) && !a.t.lit && !a.t.cstr) || (isStrT(b.t) && !b.t.lit && !b.t.cstr);
        if (!realString) {
          this.warn('comparison with string literal results in unspecified behavior', n, 'Di C, teks (array char) tidak bisa dibandingkan dengan ==. Gunakan strcmp(a, b) == 0 dari <string.h>.');
          return { c: op === '!=' ? '1' : '0', t: this.boolT() };
        }
        return { c: `+(${this.toStrCode(a)} ${jsop} ${this.toStrCode(b)})`, t: this.boolT() };
      }
      if (isArr(a.t) || isArr(b.t)) { this.err(`invalid operands to binary ${op}`, n, 'Array tidak bisa dibandingkan langsung. Bandingkan per elemen.'); return this.dummy(); }
      return { c: `+(${a.c} ${jsop} ${b.c})`, t: this.boolT() };
    }

    arith(op, a, b, n) {
      if (isArr(a.t) || isArr(b.t)) {
        this.err(`invalid operands to binary ${op} (have '${this.tname(a.t)}' and '${this.tname(b.t)}')`, n, 'Array tidak bisa dihitung langsung. Gunakan elemennya, misal a[0] + a[1].');
        return this.dummy();
      }
      if (isStrT(a.t) || isStrT(b.t)) {
        if (op === '+') {
          const realStr = t => isStrT(t) && !t.lit && !t.cstr;
          if (!realStr(a.t) && !realStr(b.t)) {
            this.err(`invalid operands of types '${this.tname(a.t)}' and '${this.tname(b.t)}' to binary 'operator+'`, n, this.A ? 'Ubah salah satu menjadi String dulu, misal String("Nilai: ") + x.' : 'Teks biasa ("...") tidak bisa dijumlahkan. Pakai printf/cout untuk menampilkan beberapa nilai.');
            return { c: '""', t: STR_T };
          }
          const other = realStr(a.t) ? b : a;
          if (!this.A && isNum(other.t) && !(isIntT(other.t) && other.t.char)) {
            this.err(`no match for 'operator+' (operand types are '${this.tname(a.t)}' and '${this.tname(b.t)}')`, n, 'Gunakan to_string(x) untuk mengubah angka menjadi teks.');
            return { c: '""', t: STR_T };
          }
          return { c: `(${this.toStrCode(a)} + ${this.toStrCode(b)})`, t: STR_T };
        }
        this.err(`no match for 'operator${op}' (operand types are '${this.tname(a.t)}' and '${this.tname(b.t)}')`, n, 'Operator hitung tidak bisa dipakai pada teks.');
        return this.dummy();
      }
      const rt = this.arithType(a.t, b.t);
      if (rt.k === 'float') {
        if (['%', '<<', '>>', '&', '|', '^'].includes(op)) {
          this.err(`invalid operands to binary ${op} (have '${this.tname(a.t)}' and '${this.tname(b.t)}')`, n, op === '%' ? 'Operator % (sisa bagi) hanya untuk bilangan bulat (int). Untuk float gunakan fmod(a, b).' : 'Operator bit hanya untuk bilangan bulat.');
          return this.dummy();
        }
        const c = `(${a.c} ${op} ${b.c})`;
        return { c: rt.bits === 32 ? `Math.fround${c}` : c, t: rt };
      }
      switch (op) {
        case '+': case '-': return { c: this.wrap(`${a.c} ${op} ${b.c}`, rt), t: rt };
        case '*':
          if (rt.bits === 32) return { c: rt.uns ? `(Math.imul(${a.c}, ${b.c}) >>> 0)` : `Math.imul(${a.c}, ${b.c})`, t: rt };
          return { c: this.wrap(`${a.c} * ${b.c}`, rt), t: rt };
        case '/': case '%': {
          const bz = this.constEval(n.b);
          if (bz === 0) this.warn('division by zero', n, 'Pembagian dengan nol tidak boleh.');
          return { c: this.wrap(`rt.${op === '/' ? 'idiv' : 'imod'}(${a.c}, ${b.c})`, rt), t: rt };
        }
        case '<<':
          if (rt.bits === 64) return { c: `rt.w64(${a.c} * Math.pow(2, ${b.c}))`, t: rt };
          return { c: this.wrap(`${a.c} << ${b.c}`, rt), t: rt };
        case '>>':
          if (rt.bits === 64) return { c: `Math.floor(${a.c} / Math.pow(2, ${b.c}))`, t: rt };
          return { c: rt.uns && rt.bits === 32 ? `(${a.c} >>> ${b.c})` : `(${a.c} >> ${b.c})`, t: rt };
        case '&': case '|': case '^': return { c: this.wrap(`${a.c} ${op} ${b.c}`, rt), t: rt };
      }
      this.err(`operator ${op} tidak dikenal`, n);
      return this.dummy();
    }

    store(lv, code) { return lv.idx ? `${lv.obj}[${lv.idx}] = ${code}` : `${lv.js} = ${code}`; }

    assign(n) {
      const tg = this.ex(n.target);
      if (!tg.lv) {
        this.err('lvalue required as left operand of assignment', n, n.target.k === 'num' ? 'Sisi kiri tanda = harus variabel. Tulis x = 5; (bukan 5 = x;)' : 'Sisi kiri tanda = harus berupa variabel. Jika ingin membandingkan, gunakan ==.');
        this.ex(n.value);
        return this.dummy();
      }
      if (tg.t.cst) this.err(`assignment of read-only variable '${tg.name || this.nameOf(n.target)}'`, n, `'${this.nameOf(n.target)}' dideklarasikan const, jadi nilainya tidak boleh diubah.`);
      if (isArr(tg.t)) {
        this.ex(n.value);
        this.err(this.cpp ? 'invalid array assignment' : 'assignment to expression with array type', n, isCharArr(tg.t) ? 'Untuk mengisi teks ke array char gunakan strcpy(tujuan, "teks");' : 'Array tidak bisa diisi sekaligus dengan =. Isi per elemen, misal a[0] = 5;');
        return this.dummy();
      }
      let val = this.ex(n.value);
      if (n.op !== '=') val = this.arith(n.op.slice(0, -1), tg, val, n);
      return { c: `(${this.store(tg.lv, this.conv(val, tg.t, n.value))})`, t: tg.t };
    }

    update(n) {
      const tg = this.ex(n.arg);
      const what = n.op === '++' ? 'increment' : 'decrement';
      if (!tg.lv) { this.err(`lvalue required as ${what} operand`, n, '++ dan -- hanya untuk variabel.'); return this.dummy(); }
      if (!isNum(tg.t)) { this.err(`no match for 'operator${n.op}'`, n); return this.dummy(); }
      if (tg.t.cst) this.err(`${what} of read-only variable '${this.nameOf(n.arg)}'`, n);
      const one = { c: '1', t: this.intT() };
      if (n.prefix) return { c: `(${this.store(tg.lv, this.conv(this.arith(n.op[0], tg, one, n), tg.t))})`, t: tg.t };
      const nv = this.conv(this.arith(n.op[0], { c: '$$t', t: tg.t }, one, n), tg.t);
      return { c: `($$t = ${tg.c}, ${this.store(tg.lv, nv)}, $$t)`, t: tg.t };
    }

    unary(n) {
      const a = this.ex(n.arg);
      if (n.op === '!') return { c: `(${a.c} ? 0 : 1)`, t: this.boolT() };
      if (!isNum(a.t)) { this.err(`wrong type argument to unary ${n.op === '-' ? 'minus' : n.op === '+' ? 'plus' : 'complement'}`, n); return this.dummy(); }
      if (n.op === '+') return { c: a.c, t: this.promote(a.t), cv: a.cv };
      if (n.op === '-') {
        if (isFlt(a.t)) return { c: `(-(${a.c}))`, t: a.t };
        const t = this.promote(a.t);
        return { c: this.wrap(`-(${a.c})`, t), t };
      }
      if (isFlt(a.t)) { this.err('wrong type argument to bit-complement', n); return this.dummy(); }
      const t = this.promote(a.t);
      return { c: this.wrap(`~(${a.c})`, t), t };
    }

    ternary(n) {
      const c = this.cond(n.test);
      const a = this.ex(n.a), b = this.ex(n.b);
      if (isStrT(a.t) || isStrT(b.t)) {
        const lit = isStrT(a.t) && isStrT(b.t) && a.t.lit && b.t.lit;
        return { c: `(${c} ? ${this.toStrCode(a)} : ${this.toStrCode(b)})`, t: lit ? { k: 'str', lit: true } : STR_T };
      }
      if (isNum(a.t) && isNum(b.t)) {
        const t = this.arithType(a.t, b.t);
        return { c: `(${c} ? ${this.conv(a, t)} : ${this.conv(b, t)})`, t };
      }
      return { c: `(${c} ? ${a.c} : ${b.c})`, t: a.t };
    }

    index(n) {
      const o = this.ex(n.obj), i = this.ex(n.idx);
      if (!isIntT(i.t)) this.err(isFlt(i.t) ? 'array subscript is not an integer' : 'invalid types for array subscript', n.idx, 'Indeks array harus bilangan bulat (int).');
      if (isArr(o.t)) {
        const name = this.nameOf(n.obj);
        const idx = `rt.ix(${o.c}, ${i.c}, ${JSON.stringify(name)})`;
        const cv = this.constEval(n.idx);
        const size = o.t.dims[0];
        if (cv !== undefined && size != null && (cv < 0 || cv >= size)) {
          this.warn(`array subscript ${cv} is outside array bounds of '${this.tname(o.t)}'`, n, `Array ${name} punya ${size} elemen, jadi indeksnya 0 sampai ${size - 1}.`);
        }
        return { c: `${o.c}[${idx}]`, t: elemOf(o.t), lv: { obj: o.c, idx }, name };
      }
      if (isStrT(o.t)) return { c: `rt.sch(${o.c}, ${i.c})`, t: CHAR_T };
      this.err('subscripted value is neither array nor pointer nor vector', n, `'${this.nameOf(n.obj)}' bukan array, jadi tidak bisa memakai [ ].`);
      return this.dummy();
    }

    cast(n) {
      const e = this.ex(n.arg);
      const ty = n.ty;
      if (ty.k === 'void') return { c: `(${e.c}, 0)`, t: VOID_T };
      if (ty.k === 'str' && !this.A) { this.err(`invalid cast to '${this.tname(ty)}'`, n); return this.dummy(); }
      return { c: this.conv(e, ty, n), t: ty, cv: e.cv !== undefined && ty.k === 'int' ? Math.trunc(e.cv) : e.cv };
    }

    sizeOf(t) {
      if (isArr(t)) {
        if (t.dims.some(d => d == null)) return this.A ? 2 : 8;
        return t.dims.reduce((p, d) => p * d, 1) * this.sizeOf(elemOf(t));
      }
      if (t.k === 'str') return t.lit || t.cstr ? (this.A ? 2 : 8) : (this.A ? 6 : 32);
      if (t.k === 'float') return t.bits / 8;
      if (t.k === 'int') return t.bits / 8;
      return 1;
    }
    sizeofE(n) {
      let t;
      if (n.ty) t = n.ty;
      else {
        if (n.arg.k === 'str') t = { k: 'int', bits: 8, char: true, dims: [n.arg.v.length + 1] };
        else {
          const e = this.ex(n.arg);
          t = e.t;
          if (isArr(t) && t.param) this.warn(`'sizeof' on array function parameter '${this.nameOf(n.arg)}' will return size of pointer`, n, 'Di dalam fungsi, parameter array hanya berupa alamat. Kirim jumlah elemennya sebagai parameter tambahan.');
        }
      }
      const size = this.sizeOf(t);
      return { c: String(size), t: { k: 'int', bits: this.A ? 16 : 64, uns: true }, cv: size };
    }

    constEval(n) {
      if (!n) return undefined;
      switch (n.k) {
        case 'num': return n.v;
        case 'chr': case 'bool': return n.v;
        case 'id': {
          const v = this.lookup(n.name);
          if (v) return v.cval;
          const k = this.constant(n.name);
          return k ? k.cv : undefined;
        }
        case 'un': {
          const a = this.constEval(n.arg);
          if (a === undefined) return undefined;
          return n.op === '-' ? -a : n.op === '+' ? a : n.op === '!' ? +!a : ~a;
        }
        case 'cast': {
          const a = this.constEval(n.arg);
          if (a === undefined) return undefined;
          return n.ty.k === 'int' ? Math.trunc(a) : a;
        }
        case 'cond': {
          const t = this.constEval(n.test);
          if (t === undefined) return undefined;
          return this.constEval(t ? n.a : n.b);
        }
        case 'sizeof': return undefined;
        case 'bin': {
          const a = this.constEval(n.a), b = this.constEval(n.b);
          if (a === undefined || b === undefined) return undefined;
          const ints = Number.isInteger(a) && Number.isInteger(b) && !(n.a.isFloat || n.b.isFloat);
          switch (n.op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return b === 0 ? undefined : ints ? Math.trunc(a / b) : a / b;
            case '%': return b === 0 ? undefined : a % b;
            case '<<': return a << b;
            case '>>': return a >> b;
            case '&': return a & b;
            case '|': return a | b;
            case '^': return a ^ b;
            case '==': return +(a === b);
            case '!=': return +(a !== b);
            case '<': return +(a < b);
            case '>': return +(a > b);
            case '<=': return +(a <= b);
            case '>=': return +(a >= b);
            case '&&': return +(a && b);
            case '||': return +(a || b);
          }
        }
      }
      return undefined;
    }

    /* ---------- pemanggilan fungsi ---------- */
    call(n) {
      const fn = n.fn;
      if (fn.k === 'member') return this.method(n, fn);
      if (fn.k !== 'id') { this.err('ekspresi ini tidak bisa dipanggil seperti fungsi', n); return this.dummy(); }
      const name = fn.name;
      const local = this.lookup(name);
      if (local) { this.err(`'${name}' cannot be used as a function`, n, `'${name}' adalah variabel, bukan fungsi.`); return this.dummy(); }
      const uf = this.funcs.get(name);
      if (uf) return this.userCall(uf, n);
      const b = this.builtin(name, n);
      if (b) return b;
      this.undeclared(fn);
      n.args.forEach(a => this.ex(a));
      return this.dummy();
    }

    userCall(f, n) {
      (this.usedFuncs || (this.usedFuncs = new Set())).add(f.name);
      const ps = f.params, args = n.args;
      if (args.length < ps.length) this.err(`too few arguments to function '${this.sigOf(f)}'`, n, `Fungsi ${f.name}() butuh ${ps.length} nilai (parameter), tetapi hanya diberi ${args.length}.`);
      else if (args.length > ps.length) this.err(`too many arguments to function '${this.sigOf(f)}'`, n, `Fungsi ${f.name}() hanya butuh ${ps.length} nilai, tetapi diberi ${args.length}.`);
      const codes = args.map((a, k) => {
        const e = this.ex(a);
        const pt = ps[k];
        if (!pt) return e.c;
        if (isArr(pt)) {
          if (isArr(e.t)) return e.c;
          if (isStrT(e.t) && pt.char) return `rt.cs(${this.toStrCode(e)}, ${'('}${this.toStrCode(e)}).length + 1)`;
          this.err(`invalid conversion from '${this.tname(e.t)}' to '${this.tname(pt)}'`, a, 'Parameter ini meminta array. Kirim nama array-nya (tanpa [ ]).');
          return '[]';
        }
        return this.conv(e, pt, a);
      });
      return { c: `(yield* F_${f.name}(${codes.join(', ')}))`, t: f.ret };
    }

    reqHeader(g, name, n) {
      if (this.A) return;
      const H = this.includes;
      const groups = {
        stdio: ['stdio.h', 'cstdio', 'iostream', 'bits/stdc++.h'],
        math: ['math.h', 'cmath', 'bits/stdc++.h'].concat(this.cpp ? ['iostream'] : []),
        stdlib: ['stdlib.h', 'cstdlib', 'bits/stdc++.h'].concat(this.cpp ? ['iostream'] : []),
        string: ['string.h', 'cstring', 'bits/stdc++.h'],
        ctype: ['ctype.h', 'cctype', 'bits/stdc++.h'].concat(this.cpp ? ['iostream'] : []),
        time: ['time.h', 'ctime', 'bits/stdc++.h'].concat(this.cpp ? ['iostream'] : []),
        unistd: ['unistd.h'],
        iomanip: ['iomanip', 'bits/stdc++.h']
      };
      if (groups[g].some(h => H.has(h))) return;
      const hdr = { stdio: this.cpp ? 'cstdio' : 'stdio.h', math: this.cpp ? 'cmath' : 'math.h', stdlib: this.cpp ? 'cstdlib' : 'stdlib.h', string: this.cpp ? 'cstring' : 'string.h', ctype: this.cpp ? 'cctype' : 'ctype.h', time: this.cpp ? 'ctime' : 'time.h', unistd: 'unistd.h', iomanip: 'iomanip' }[g];
      if (this.cpp) this.err(`'${name}' was not declared in this scope`, n, `Tambahkan #include <${hdr}> di baris paling atas.`);
      else this.warn(`implicit declaration of function '${name}'`, n, `Tambahkan #include <${hdr}> di baris paling atas.`);
    }

    arity(n, min, max, sig) {
      const k = n.args.length;
      if (k < min) { this.err(`too few arguments to function '${sig}'`, n, `${sig.split('(')[0].split(' ').pop()}() butuh ${min} nilai.`); return false; }
      if (k > max) { this.err(`too many arguments to function '${sig}'`, n); return false; }
      return true;
    }

    builtin(name, n) {
      const A = this.A, args = n.args;
      const exs = () => args.map(a => this.ex(a));
      const num = (e, node) => { if (!isNum(e.t)) { this.err(`cannot convert '${this.tname(e.t)}' to a number`, node || n); return '0'; } return e.c; };
      const I = this.intT(), D = this.dblT();
      if (name in MATH1) {
        this.reqHeader('math', name, n);
        if (!this.arity(n, 1, 1, `double ${name}(double)`)) return this.dummy();
        const a = this.ex(args[0]);
        return { c: `${MATH1[name]}(${num(a, args[0])})`, t: D };
      }
      if (name in MATH2) {
        this.reqHeader('math', name, n);
        if (!this.arity(n, 2, 2, `double ${name}(double, double)`)) return this.dummy();
        const [a, b] = exs();
        return { c: `${MATH2[name]}(${num(a)}, ${num(b)})`, t: D };
      }
      switch (name) {
        case 'printf': if (A) break; return this.printfCall(n);
        case 'scanf': if (A) break; return this.scanfCall(n);
        case 'puts': {
          if (A) break;
          this.reqHeader('stdio', name, n);
          if (!this.arity(n, 1, 1, 'int puts(const char*)')) return this.dummy();
          const a = this.ex(args[0]);
          return { c: `rt.out(${this.toStrCode(a)} + "\\n")`, t: I };
        }
        case 'putchar': {
          if (A) break;
          this.reqHeader('stdio', name, n);
          if (!this.arity(n, 1, 1, 'int putchar(int)')) return this.dummy();
          return { c: `rt.out(String.fromCharCode(${this.ex(args[0]).c}))`, t: I };
        }
        case 'getchar': if (A) break; this.reqHeader('stdio', name, n); return { c: '(yield* rt.getchar())', t: I };
        case 'abs': {
          if (!this.arity(n, 1, 1, 'int abs(int)')) return this.dummy();
          const a = this.ex(args[0]);
          if (isFlt(a.t) && !this.cpp) {
            this.warn("using integer absolute value function 'abs' when argument is of floating point type", n, 'Untuk bilangan desimal gunakan fabs() dari <math.h>.');
            return { c: `Math.abs(rt.ftoi(${a.c}))`, t: I };
          }
          if (!A) this.reqHeader('stdlib', name, n);
          return { c: `Math.abs(${num(a)})`, t: isFlt(a.t) ? a.t : this.promote(a.t) };
        }
        case 'min': case 'max': {
          if (!this.cpp) return null;
          if (!this.arity(n, 2, 2, `${name}(a, b)`)) return this.dummy();
          const [a, b] = exs();
          const t = this.arithType(a.t, b.t);
          return { c: `Math.${name}(${this.conv(a, t)}, ${this.conv(b, t)})`, t };
        }
        case 'rand': if (!A) this.reqHeader('stdlib', name, n); return { c: 'rt.rand()', t: I };
        case 'srand': {
          if (!A) this.reqHeader('stdlib', name, n);
          if (!this.arity(n, 1, 1, 'void srand(unsigned int)')) return this.dummy();
          return { c: `rt.srand(${this.ex(args[0]).c})`, t: VOID_T };
        }
        case 'time': if (A) break; this.reqHeader('time', name, n); exs(); return { c: 'rt.time()', t: this.longT() };
        case 'exit': {
          if (A) break;
          this.reqHeader('stdlib', name, n);
          if (!this.arity(n, 1, 1, 'void exit(int)')) return this.dummy();
          return { c: `rt.exit(${this.ex(args[0]).c})`, t: VOID_T };
        }
        case 'system': {
          if (A) break;
          this.reqHeader('stdlib', name, n);
          if (!this.arity(n, 1, 1, 'int system(const char*)')) return this.dummy();
          return { c: `rt.system(${this.toStrCode(this.ex(args[0]))})`, t: I };
        }
        case 'sleep': case 'usleep': case 'Sleep': {
          if (A) break;
          if (name !== 'Sleep') this.reqHeader('unistd', name, n);
          if (!this.arity(n, 1, 1, `${name}(n)`)) return this.dummy();
          const a = this.ex(args[0]);
          const ms = name === 'sleep' ? `(${a.c}) * 1000` : name === 'usleep' ? `(${a.c}) / 1000` : a.c;
          return { c: `(yield rt.delay(${ms}))`, t: I };
        }
        case 'atoi': case 'atol': case 'atof': {
          this.reqHeader('stdlib', name, n);
          if (!this.arity(n, 1, 1, `${name}(const char*)`)) return this.dummy();
          const a = this.ex(args[0]);
          return name === 'atof' ? { c: `rt.toFloat(${this.toStrCode(a)})`, t: D } : { c: `rt.toInt(${this.toStrCode(a)})`, t: name === 'atol' ? this.longT() : I };
        }
        case 'strlen': case 'strcpy': case 'strcat': case 'strcmp': {
          this.reqHeader('string', name, n);
          const want = name === 'strlen' ? 1 : 2;
          if (!this.arity(n, want, want, `${name}(...)`)) return this.dummy();
          const es = exs();
          if (name === 'strlen') return { c: `${this.toStrCode(es[0])}.length`, t: this.ulongT() };
          if (name === 'strcmp') return { c: `rt.strcmp(${this.toStrCode(es[0])}, ${this.toStrCode(es[1])})`, t: I };
          if (!isCharArr(es[0].t)) { this.err(`invalid conversion from '${this.tname(es[0].t)}' to 'char*'`, args[0], `Tujuan ${name} harus array char, misal char nama[20];`); return this.dummy(); }
          return { c: `rt.${name}(${es[0].c}, ${this.toStrCode(es[1])})`, t: VOID_T };
        }
        case 'toupper': case 'tolower': case 'isdigit': case 'isalpha': case 'isspace': case 'isupper': case 'islower': case 'isalnum': {
          this.reqHeader('ctype', name, n);
          if (!this.arity(n, 1, 1, `int ${name}(int)`)) return this.dummy();
          return { c: `rt.${name}(${this.ex(args[0]).c})`, t: name.startsWith('to') ? (this.ex(args[0]).t.char ? CHAR_T : I) : I };
        }
        case 'to_string': {
          if (!this.cpp || A) break;
          if (!this.arity(n, 1, 1, 'std::string to_string(x)')) return this.dummy();
          const a = this.ex(args[0]);
          return { c: `rt.toString(${num(a)}, ${isFlt(a.t) ? 1 : 0})`, t: STR_T };
        }
        case 'stoi': case 'stof': case 'stod': {
          if (!this.cpp || A) break;
          if (!this.arity(n, 1, 1, `${name}(string)`)) return this.dummy();
          const a = this.ex(args[0]);
          return name === 'stoi' ? { c: `rt.toInt(${this.toStrCode(a)})`, t: I } : { c: `rt.toFloat(${this.toStrCode(a)})`, t: name === 'stof' ? this.fltT() : D };
        }
        case 'getline': {
          if (!this.cpp || A) break;
          if (args.length !== 2 || args[0].k !== 'id' || args[0].name !== 'cin') { this.err('getline harus ditulis getline(cin, variabelString);', n); return this.dummy(); }
          const tg = this.ex(args[1]);
          if (!tg.lv || !isStrT(tg.t)) { this.err('argumen kedua getline harus variabel string', args[1]); return this.dummy(); }
          return { c: `(yield* rt.getline((v) => { ${this.store(tg.lv, 'v')}; }))`, t: I };
        }
        case 'swap': {
          if (!this.cpp || A) break;
          if (!this.arity(n, 2, 2, 'swap(a, b)')) return this.dummy();
          const [a, b] = exs();
          if (!a.lv || !b.lv) { this.err('swap butuh dua variabel', n); return this.dummy(); }
          return { c: `($$t = ${a.c}, ${this.store(a.lv, b.c)}, ${this.store(b.lv, '$$t')}, 0)`, t: VOID_T };
        }
        case 'setprecision': case 'setw': case 'fixed':
          if (A) break;
          this.err(`'${name}' hanya bisa dipakai di dalam cout`, n, `Contoh: cout << ${name === 'fixed' ? 'fixed' : name + '(2)'} << x;`);
          return this.dummy();
      }
      if (!A) return null;
      // ----- Arduino -----
      const L = this.longT(), UL = this.ulongT();
      switch (name) {
        case 'pinMode': {
          if (!this.arity(n, 2, 2, 'void pinMode(uint8_t pin, uint8_t mode)')) return this.dummy();
          const [p, m] = exs();
          return { c: `rt.pinMode(${num(p)}, ${num(m)})`, t: VOID_T };
        }
        case 'digitalWrite': {
          if (!this.arity(n, 2, 2, 'void digitalWrite(uint8_t pin, uint8_t val)')) return this.dummy();
          const [p, v] = exs();
          return { c: `rt.dw(${num(p)}, ${num(v)})`, t: VOID_T };
        }
        case 'digitalRead': if (!this.arity(n, 1, 1, 'int digitalRead(uint8_t pin)')) return this.dummy(); return { c: `rt.dr(${num(this.ex(args[0]))})`, t: I };
        case 'analogRead': if (!this.arity(n, 1, 1, 'int analogRead(uint8_t pin)')) return this.dummy(); return { c: `rt.ar(${num(this.ex(args[0]))})`, t: I };
        case 'analogWrite': {
          if (!this.arity(n, 2, 2, 'void analogWrite(uint8_t pin, int val)')) return this.dummy();
          const [p, v] = exs();
          return { c: `rt.aw(${num(p)}, ${num(v)})`, t: VOID_T };
        }
        case 'delay': if (!this.arity(n, 1, 1, 'void delay(unsigned long ms)')) return this.dummy(); return { c: `(yield rt.delay(${num(this.ex(args[0]))}))`, t: VOID_T };
        case 'delayMicroseconds': if (!this.arity(n, 1, 1, 'void delayMicroseconds(unsigned int us)')) return this.dummy(); return { c: `(yield rt.delay((${num(this.ex(args[0]))}) / 1000))`, t: VOID_T };
        case 'millis': return { c: 'rt.millis()', t: UL };
        case 'micros': return { c: 'rt.micros()', t: UL };
        case 'map': {
          if (!this.arity(n, 5, 5, 'long map(long x, long in_min, long in_max, long out_min, long out_max)')) return this.dummy();
          const es = exs().map((e, k) => this.conv(e, L, args[k]));
          return { c: `rt.map(${es.join(', ')})`, t: L };
        }
        case 'constrain': {
          if (!this.arity(n, 3, 3, 'constrain(x, a, b)')) return this.dummy();
          const es = exs();
          const t = this.arithType(this.arithType(es[0].t, es[1].t), es[2].t);
          return { c: `rt.constrain(${es.map(e => this.conv(e, t)).join(', ')})`, t };
        }
        case 'sq': { if (!this.arity(n, 1, 1, 'sq(x)')) return this.dummy(); const a = this.ex(args[0]); return { c: `(${a.c} * ${a.c})`, t: isFlt(a.t) ? a.t : this.longT() }; }
        case 'random': {
          if (!this.arity(n, 1, 2, 'long random(long min, long max)')) return this.dummy();
          const es = exs();
          return { c: `rt.random(${es.map(e => this.conv(e, L)).join(', ')})`, t: L };
        }
        case 'randomSeed': exs(); return { c: `rt.srand(${args[0] ? this.ex(args[0]).c : 0})`, t: VOID_T };
        case 'tone': {
          if (!this.arity(n, 2, 3, 'void tone(uint8_t pin, unsigned int frequency, unsigned long duration)')) return this.dummy();
          const es = exs();
          return { c: `rt.tone(${es.map(e => num(e)).join(', ')})`, t: VOID_T };
        }
        case 'noTone': if (!this.arity(n, 1, 1, 'void noTone(uint8_t pin)')) return this.dummy(); return { c: `rt.noTone(${num(this.ex(args[0]))})`, t: VOID_T };
        case 'pulseIn': {
          if (!this.arity(n, 2, 3, 'unsigned long pulseIn(uint8_t pin, uint8_t state, unsigned long timeout)')) return this.dummy();
          const es = exs();
          return { c: `rt.pulseIn(${es.map(e => num(e)).join(', ')})`, t: UL };
        }
        case 'analogReference': exs(); return { c: '0', t: VOID_T };
        case 'bitRead': { if (!this.arity(n, 2, 2, 'bitRead(x, n)')) return this.dummy(); const [x, b] = exs(); return { c: `((${x.c} >> ${b.c}) & 1)`, t: I }; }
        case 'bit': { if (!this.arity(n, 1, 1, 'bit(n)')) return this.dummy(); return { c: `(1 << ${this.ex(args[0]).c})`, t: L }; }
        case 'String': {
          if (!this.arity(n, 0, 2, 'String(value)')) return this.dummy();
          if (!args.length) return { c: '""', t: STR_T };
          const es = exs();
          return { c: `rt.S(${es[0].c}, "${this.tag(es[0].t)}"${es[1] ? ', ' + es[1].c : ''})`, t: STR_T };
        }
      }
      return null;
    }

    printfCall(n) {
      this.reqHeader('stdio', 'printf', n);
      const args = n.args;
      if (!args.length) { this.err("too few arguments to function 'printf'", n, 'Contoh: printf("Halo\\n");'); return this.dummy(); }
      const f = this.ex(args[0]);
      if (!isStrT(f.t) && !isCharArr(f.t)) {
        this.err(`invalid conversion from '${this.tname(f.t)}' to 'const char*'`, args[0], 'Argumen pertama printf harus teks format di dalam tanda kutip, misal printf("%d\\n", x);');
        args.slice(1).forEach(a => this.ex(a));
        return this.dummy();
      }
      const vals = args.slice(1).map(a => this.ex(a));
      vals.forEach((v, k) => { if (v.t.k === 'void') this.err('invalid use of void expression', args[k + 1], 'Fungsi void tidak menghasilkan nilai untuk dicetak.'); });
      if (args[0].k === 'str') this.checkFormat(args[0].v, vals, args, n);
      const fc = isCharArr(f.t) ? `rt.cstr(${f.c})` : f.c;
      return { c: `rt.printf(${fc}, [${vals.map(v => v.c).join(', ')}], ${JSON.stringify(vals.map(v => this.tag(v.t)).join(''))})`, t: this.intT() };
    }

    checkFormat(fmt, vals, argNodes, n) {
      const re = /%([-+ 0#]*)(\*|\d+)?(?:\.(\*|\d*))?(hh|h|ll|l|L|z|j|t)?([a-zA-Z%])?/g;
      let m, k = 0;
      const expT = (c, len) => {
        if ('di'.includes(c)) return len === 'l' ? 'long int' : len === 'll' ? 'long long int' : 'int';
        if ('uxXo'.includes(c)) return 'unsigned int';
        if ('feEgG'.includes(c)) return 'double';
        if (c === 'c') return 'int';
        if (c === 's') return 'char *';
        return 'int';
      };
      while ((m = re.exec(fmt))) {
        const conv = m[5];
        if (!conv) { this.warn("spurious trailing '%' in format", n, 'Untuk mencetak tanda persen tulis %% (dua kali).'); break; }
        if (conv === '%') continue;
        if (m[2] === '*') k++;
        if (m[3] === '*') k++;
        if (!'diouxXeEfFgGcsp'.includes(conv)) { this.warn(`unknown conversion type character '${conv}' in format`, n, 'Penentu format yang benar: %d (int), %f (float), %c (char), %s (teks). Untuk tanda persen tulis %%.'); continue; }
        const spec = '%' + (m[4] || '') + conv;
        const v = vals[k];
        if (!v) { this.warn(`format '${spec}' expects a matching '${expT(conv, m[4])}' argument`, n, 'Jumlah penentu format (%...) lebih banyak daripada nilai yang diberikan setelah koma.'); k++; continue; }
        const t = v.t, node = argNodes[k + 1];
        const mism = `format '${spec}' expects argument of type '${expT(conv, m[4])}', but argument ${k + 2} has type '${this.tname(t)}'`;
        if ('diouxXc'.includes(conv) && isFlt(t)) this.warn(mism, node, `Nilai desimal (${this.tname(t)}) dicetak dengan %f, bukan %${conv}. Hasilnya akan berupa angka acak.`);
        else if ('eEfFgG'.includes(conv) && isIntT(t)) this.warn(mism, node, 'Nilai bilangan bulat dicetak dengan %d. Jika ingin desimal, ubah dulu: (float)x atau x * 1.0. Hasilnya sekarang akan 0.000000.');
        else if (conv === 's' && !isStrT(t) && !isCharArr(t)) this.warn(mism, node, '%s hanya untuk teks. Untuk angka gunakan %d atau %f.');
        else if (conv !== 's' && conv !== 'p' && (isStrT(t) || isArr(t))) this.warn(mism, node, 'Teks dicetak dengan %s.');
        k++;
      }
      if (k < vals.length) this.warn('too many arguments for format', n, 'Ada nilai setelah koma yang tidak punya pasangan penentu format (%d, %f, ...).');
    }

    scanfCall(n) {
      this.reqHeader('stdio', 'scanf', n);
      const args = n.args;
      if (!args.length || args[0].k !== 'str') {
        this.err('format scanf harus berupa teks langsung', n, 'Contoh: scanf("%d", &x);');
        return this.dummy();
      }
      const fmt = args[0].v;
      const specs = [];
      const re = /%(\*)?(\d+)?(hh|h|ll|l|L)?([diuoxXfFeEgGcs%\[])/g;
      let m;
      while ((m = re.exec(fmt))) {
        if (m[4] === '%') continue;
        if (m[4] === '[') { this.err('format %[...] belum didukung MiniC', n, 'Gunakan %s untuk membaca satu kata.'); continue; }
        if (!m[1]) specs.push({ conv: m[4], len: m[3] || '' });
      }
      const kindOf = sp => {
        const c = sp.conv;
        if ('diuoxX'.includes(c)) return sp.len === 'hh' ? 'i8' : sp.len === 'h' ? 'i16' : (sp.len === 'll' || (sp.len === 'l' && !this.A)) ? 'i64' : 'i32';
        if ('fFeEgG'.includes(c)) return sp.len === 'l' || sp.len === 'L' ? 'f64' : 'f32';
        if (c === 'c') return 'i8';
        return 's';
      };
      const tkind = t => (t.k === 'float' ? (t.bits === 32 ? 'f32' : 'f64') : 'i' + t.bits);
      const expName = sp => {
        const k = kindOf(sp);
        return { i8: sp.conv === 'c' ? 'char' : 'signed char', i16: 'short int', i32: 'int', i64: 'long int', f32: 'float', f64: 'double', s: 'char' }[k];
      };
      const setters = [];
      specs.forEach((sp, j) => {
        const a = args[j + 1];
        const spec = '%' + sp.len + sp.conv;
        if (!a) { this.warn(`format '${spec}' expects a matching '${expName(sp)} *' argument`, n, 'Jumlah %... di format lebih banyak daripada variabel yang diberikan.'); setters.push('null'); return; }
        if (a.k === 'addr') {
          const tg = this.ex(a.arg);
          if (!tg.lv) { this.err('lvalue required as unary \'&\' operand', a, 'Tanda & hanya bisa dipakai di depan nama variabel.'); setters.push('null'); return; }
          if (isStrT(tg.t) || isArr(tg.t)) { this.err(`format '${spec}' tidak cocok untuk variabel '${this.nameOf(a)}'`, a, isCharArr(tg.t) ? 'Untuk array char gunakan %s tanpa tanda &: scanf("%s", nama);' : 'scanf hanya bisa membaca ke variabel angka atau array char.'); setters.push('null'); return; }
          const sk = kindOf(sp), dk = tkind(tg.t);
          let val;
          if (sk === 's') { this.err(`format '%s' expects argument of type 'char *', but argument ${j + 2} has type '${this.tname(tg.t)} *'`, a, '%s hanya untuk array char.'); setters.push('null'); return; }
          if (sk === dk || (sp.conv === 'c' && tg.t.bits === 8)) {
            val = this.conv({ c: 'v', t: sk[0] === 'f' ? { k: 'float', bits: +sk.slice(1) } : { k: 'int', bits: 64, uns: false } }, tg.t);
          } else {
            const hint = sk[0] === 'f' && dk[0] === 'i' ? `Variabel '${this.nameOf(a)}' bertipe bilangan bulat, jadi gunakan %d.`
              : sk[0] === 'i' && dk[0] === 'f' ? `Variabel '${this.nameOf(a)}' bertipe desimal, jadi gunakan ${dk === 'f64' ? '%lf' : '%f'}.`
                : sk === 'f32' && dk === 'f64' ? `Untuk double gunakan %lf (bukan %f).` : `Sesuaikan penentu format dengan tipe variabel.`;
            this.warn(`format '${spec}' expects argument of type '${expName(sp)} *', but argument ${j + 2} has type '${this.tname(tg.t)} *'`, a, hint + ' Nilai yang tersimpan akan salah.');
            val = this.conv({ c: `rt.reint(v, "${sk}", "${dk}")`, t: dk[0] === 'f' ? { k: 'float', bits: +dk.slice(1) } : { k: 'int', bits: 64, uns: false } }, tg.t);
          }
          setters.push(`(v) => { ${this.store(tg.lv, val)}; }`);
          return;
        }
        const e = this.ex(a);
        if (sp.conv === 's' && isCharArr(e.t)) { setters.push(`(v) => rt.strset(${e.c}, v)`); return; }
        this.warn(`format '${spec}' expects argument of type '${expName(sp)} *', but argument ${j + 2} has type '${this.tname(e.t)}'`, a,
          `Lupa tanda & sebelum nama variabel. Tulis: scanf("${spec}", &${this.nameOf(a)});`);
        setters.push('null');
      });
      if (args.length - 1 > specs.length) this.warn('too many arguments for format', n, 'Ada variabel yang tidak punya pasangan %... di format.');
      return { c: `(yield* rt.scanf(${JSON.stringify(fmt)}, [${setters.join(', ')}]))`, t: this.intT() };
    }

    stream(n, root) {
      const items = [];
      let x = n;
      while (x !== root) { items.unshift({ node: x.b, op: x.op }); x = x.a; }
      const isIn = root.name === 'cin';
      if (!this.cpp) { this.err(`'${root.name}' undeclared (first use in this function)`, root, 'cout dan cin hanya ada di C++. Pilih bahasa C++ (simpan file dengan akhiran .cpp).'); return this.dummy(); }
      if (this.A) { this.err(`'${root.name}' was not declared in this scope`, root, 'Arduino tidak memakai cout/cin. Gunakan Serial.print() dan Serial.println().'); return this.dummy(); }
      if (!this.includes.has('iostream') && !this.includes.has('bits/stdc++.h')) {
        this.err(`'${root.name}' was not declared in this scope`, root, 'Tambahkan #include <iostream> di baris paling atas, lalu using namespace std;');
        return this.dummy();
      }
      if (!root.std && !this.usingStd) {
        this.err(`'${root.name}' was not declared in this scope; did you mean 'std::${root.name}'?`, root, 'Tambahkan using namespace std; di bawah #include <iostream>, atau tulis std::' + root.name + '.');
        return this.dummy();
      }
      if (isIn) {
        const parts = [];
        for (const it of items) {
          if (it.op !== '>>') { this.err("no match for 'operator<<' (operand types are 'std::istream' {aka 'std::basic_istream<char>'} and ...)", it.node, 'cin memakai tanda >> (panah ke kanan). cout yang memakai <<.'); continue; }
          const tg = this.ex(it.node);
          if (!tg.lv) { this.err("no match for 'operator>>'", it.node, 'Setelah cin >> harus nama variabel.'); continue; }
          if (tg.t.cst) this.err(`no match for 'operator>>' (variabel const '${this.nameOf(it.node)}')`, it.node);
          let kind, set;
          if (isCharArr(tg.t)) { kind = 'a'; set = `(v) => rt.strset(${tg.c}, v)`; }
          else if (isStrT(tg.t)) { kind = 's'; set = `(v) => { ${this.store(tg.lv, 'v')}; }`; }
          else if (isFlt(tg.t)) { kind = 'f'; set = `(v) => { ${this.store(tg.lv, this.conv({ c: 'v', t: { k: 'float', bits: 64 } }, tg.t))}; }`; }
          else if (isIntT(tg.t) && tg.t.char) { kind = 'c'; set = `(v) => { ${this.store(tg.lv, 'v')}; }`; }
          else if (isIntT(tg.t)) { kind = 'i'; set = `(v) => { ${this.store(tg.lv, this.conv({ c: 'v', t: { k: 'int', bits: 64, uns: false } }, tg.t))}; }`; }
          else { this.err('tipe variabel ini tidak bisa dibaca dengan cin', it.node); continue; }
          parts.push(`[${set}, "${kind}"]`);
        }
        return { c: `(yield* rt.cin([${parts.join(', ')}]))`, t: { k: 'int', bits: 8, uns: true, bool: true } };
      }
      const parts = [];
      for (const it of items) {
        const nd = it.node;
        if (it.op !== '<<') { this.err("no match for 'operator>>' (operand types are 'std::ostream' {aka 'std::basic_ostream<char>'} and ...)", nd, 'cout memakai tanda << (panah ke kiri). cin yang memakai >>.'); continue; }
        if (nd.k === 'id' && ['endl', 'fixed', 'scientific', 'left', 'right', 'boolalpha', 'noboolalpha', 'showpoint', 'flush'].includes(nd.name) && !this.lookup(nd.name)) {
          if (!nd.std && !this.usingStd) this.err(`'${nd.name}' was not declared in this scope; did you mean 'std::${nd.name}'?`, nd);
          parts.push(`["m", "${nd.name}"]`);
          continue;
        }
        if (nd.k === 'call' && nd.fn.k === 'id' && ['setprecision', 'setw', 'setfill'].includes(nd.fn.name)) {
          this.reqHeader('iomanip', nd.fn.name, nd);
          if (nd.args.length !== 1) { this.err(`${nd.fn.name} butuh satu nilai`, nd); continue; }
          parts.push(`["${nd.fn.name}", ${this.ex(nd.args[0]).c}]`);
          continue;
        }
        const e = this.ex(nd);
        if (e.t.k === 'void') { this.err("no match for 'operator<<' (operand types are 'std::ostream' and 'void')", nd, 'Fungsi bertipe void tidak menghasilkan nilai untuk ditampilkan.'); continue; }
        parts.push(`["${this.tag(e.t)}", ${e.c}]`);
      }
      return { c: `rt.cout([${parts.join(', ')}])`, t: this.intT() };
    }

    method(n, mem) {
      const obj = mem.obj;
      if (obj.k === 'id' && obj.name === 'Serial' && !this.lookup('Serial')) return this.serialCall(mem.name, n);
      if (obj.k === 'id' && obj.name === 'cin' && !this.lookup('cin') && this.cpp && !this.A) {
        if (mem.name === 'ignore') return { c: `(yield* rt.ignore(${n.args[0] ? this.ex(n.args[0]).c : 1}, ${n.args[1] ? this.ex(n.args[1]).c : -1}))`, t: VOID_T };
        if (mem.name === 'get') return { c: '(yield* rt.getchar())', t: this.intT() };
        this.err(`cin.${mem.name}() belum didukung di MiniC`, n);
        return this.dummy();
      }
      const o = this.ex(obj);
      if (isStrT(o.t)) return this.stringMethod(o, mem.name, n);
      this.err(`request for member '${mem.name}' in '${this.nameOf(obj)}', which is of non-class type '${this.tname(o.t)}'`, n, 'Titik (.) hanya dipakai pada objek seperti Serial atau String.');
      return this.dummy();
    }

    serialCall(name, n) {
      if (!this.A) {
        this.err("'Serial' was not declared in this scope", n, 'Serial hanya ada di Arduino. Jalankan kode ini di Simulator Arduino.');
        return this.dummy();
      }
      const args = n.args.map(a => this.ex(a));
      const I = this.intT();
      switch (name) {
        case 'begin': return { c: `rt.ser.begin(${args[0] ? args[0].c : 9600})`, t: VOID_T };
        case 'end': case 'flush': return { c: '0', t: VOID_T };
        case 'print': case 'println': {
          const ln = name === 'println';
          if (!args.length) {
            if (!ln) { this.err("no matching function for call to 'HardwareSerial::print()'", n, 'Serial.print butuh nilai yang ingin ditampilkan.'); return this.dummy(); }
            return { c: 'rt.ser.print("", "s", undefined, true)', t: I };
          }
          if (args.length > 2) { this.err(`no matching function for call to 'HardwareSerial::${name}(...)'`, n, `Serial.${name} hanya menerima satu nilai. Untuk beberapa nilai, panggil Serial.print berkali-kali.`); return this.dummy(); }
          const a = args[0];
          if (a.t.k === 'void') { this.err("invalid use of void expression", n.args[0]); return this.dummy(); }
          return { c: `rt.ser.print(${a.c}, "${this.tag(a.t)}", ${args[1] ? args[1].c : 'undefined'}, ${ln})`, t: I };
        }
        case 'write': return { c: `rt.ser.write(${args[0] ? args[0].c : 0}, "${args[0] ? this.tag(args[0].t) : 'i'}")`, t: I };
        case 'available': return { c: 'rt.ser.available()', t: I };
        case 'read': return { c: 'rt.ser.read()', t: I };
        case 'peek': return { c: 'rt.ser.peek()', t: I };
        case 'parseInt': return { c: '(yield* rt.ser.parseNum(false))', t: this.longT() };
        case 'parseFloat': return { c: '(yield* rt.ser.parseNum(true))', t: this.fltT() };
        case 'readString': return { c: '(yield* rt.ser.readUntil(-1))', t: STR_T };
        case 'readStringUntil': return { c: `(yield* rt.ser.readUntil(${args[0] ? args[0].c : 10}))`, t: STR_T };
        case 'setTimeout': return { c: '0', t: VOID_T };
      }
      this.err(`'class HardwareSerial' has no member named '${name}'`, n, 'Perintah Serial yang umum: begin, print, println, available, read, parseInt.');
      return this.dummy();
    }

    stringMethod(o, name, n) {
      const args = n.args.map(a => this.ex(a));
      const self = o.c, I = this.intT();
      const a0 = args[0], a1 = args[1];
      const mut = js => {
        if (!o.lv) { this.err(`'${name}' hanya bisa dipakai pada variabel String`, n); return this.dummy(); }
        return { c: `(${this.store(o.lv, js)}, 0)`, t: VOID_T };
      };
      switch (name) {
        case 'length': case 'size': return { c: `${self}.length`, t: I };
        case 'toInt': return { c: `rt.toInt(${self})`, t: this.longT() };
        case 'toFloat': case 'toDouble': return { c: `rt.toFloat(${self})`, t: this.fltT() };
        case 'substring': return { c: a1 ? `${self}.substring(${a0.c}, ${a1.c})` : `${self}.substring(${a0 ? a0.c : 0})`, t: STR_T };
        case 'substr': return { c: a1 ? `${self}.substr(${a0.c}, ${a1.c})` : `${self}.substr(${a0 ? a0.c : 0})`, t: STR_T };
        case 'indexOf': case 'find': return { c: `${self}.indexOf(${a0 ? this.toStrCode(a0) : '""'})`, t: I };
        case 'charAt': case 'at': return { c: `rt.sch(${self}, ${a0 ? a0.c : 0})`, t: CHAR_T };
        case 'equals': return { c: `+(${self} === ${a0 ? this.toStrCode(a0) : '""'})`, t: this.boolT() };
        case 'equalsIgnoreCase': return { c: `+(${self}.toLowerCase() === ${a0 ? this.toStrCode(a0) : '""'}.toLowerCase())`, t: this.boolT() };
        case 'startsWith': case 'endsWith': return { c: `+${self}.${name}(${a0 ? this.toStrCode(a0) : '""'})`, t: this.boolT() };
        case 'c_str': return { c: self, t: { k: 'str', cstr: true } };
        case 'empty': return { c: `+(${self}.length === 0)`, t: this.boolT() };
        case 'toUpperCase': return mut(`${self}.toUpperCase()`);
        case 'toLowerCase': return mut(`${self}.toLowerCase()`);
        case 'trim': return mut(`${self}.trim()`);
        case 'concat': case 'append': return mut(`${self} + ${a0 ? this.toStrCode(a0) : '""'}`);
      }
      this.err(`'class ${this.A ? 'String' : 'std::string'}' has no member named '${name}'`, n);
      return this.dummy();
    }
  }

  function numJS(v) {
    if (Number.isNaN(v)) return 'NaN';
    if (!isFinite(v)) return v > 0 ? 'Infinity' : '-Infinity';
    return String(v);
  }

  /* ============================== Format printf ============================== */
  function toFixedC(x, p) {
    if (x >= 1e21) return BigInt(Math.round(x)).toString() + (p ? '.' + '0'.repeat(p) : '');
    p = Math.min(p, 100);
    if (p < 70) {
      // Pembulatan "setengah ke genap" seperti glibc untuk nilai yang tepat di tengah (mis. 0.125 → 0.12).
      const full = x.toFixed(p + 30);
      const dot = full.indexOf('.');
      const fp = full.slice(dot + 1);
      if (fp[p] === '5' && /^0*$/.test(fp.slice(p + 1))) {
        const lastDigit = p ? fp[p - 1] : full[dot - 1];
        if (+lastDigit % 2 === 0) return p ? full.slice(0, dot + 1 + p) : full.slice(0, dot);
      }
    }
    return x.toFixed(p);
  }
  function toExpC(x, p) {
    const s = x.toExponential(Math.min(p, 100));
    return s.replace(/e([+-])(\d+)$/, (_, sg, d) => 'e' + sg + (d.length < 2 ? '0' + d : d));
  }
  function floatFmt(x, conv, prec, flags) {
    flags = flags || '';
    const up = conv !== conv.toLowerCase();
    const c = conv.toLowerCase();
    const sign = (x < 0 || Object.is(x, -0)) ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
    const ax = Math.abs(x);
    let body;
    if (Number.isNaN(x)) body = 'nan';
    else if (!isFinite(ax)) body = 'inf';
    else if (c === 'f') body = toFixedC(ax, prec);
    else if (c === 'e') body = toExpC(ax, prec);
    else {
      const P = prec === 0 ? 1 : prec;
      if (ax === 0) body = flags.includes('#') ? toFixedC(0, P - 1) : '0';
      else {
        const X = +ax.toExponential(P - 1).split('e')[1];
        body = (P > X && X >= -4) ? toFixedC(ax, P - 1 - X) : toExpC(ax, P - 1);
        if (!flags.includes('#')) {
          const [mant, ex] = body.split('e');
          let mm = mant;
          if (mm.includes('.')) mm = mm.replace(/0+$/, '').replace(/\.$/, '');
          body = ex === undefined ? mm : mm + 'e' + ex;
        }
      }
    }
    if (up) body = body.toUpperCase();
    return sign + body;
  }
  function garbageInt(v) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, v);
    return dv.getInt32(4) ^ 0x5bd1e995;
  }
  function cstrOf(a) {
    if (typeof a === 'string') return a;
    let s = '';
    for (const c of a) { if (!c) break; s += String.fromCharCode(c); }
    return s;
  }
  function formatC(fmt, args, tags) {
    tags = tags || '';
    let k = 0, out = '', last = 0, m;
    const re = /%([-+ 0#]*)(\*|\d+)?(?:\.(\*|\d*))?(hh|h|ll|l|L|z|j|t)?([a-zA-Z%])/g;
    while ((m = re.exec(fmt))) {
      out += fmt.slice(last, m.index);
      last = re.lastIndex;
      const flags = m[1], w0 = m[2], p0 = m[3], len = m[4], conv = m[5];
      if (conv === '%') { out += '%'; continue; }
      let width = w0 === '*' ? (args[k++] | 0) : w0 ? +w0 : 0;
      const prec = p0 === undefined ? null : p0 === '*' ? (args[k++] | 0) : p0 === '' ? 0 : +p0;
      let left = flags.includes('-');
      if (width < 0) { left = true; width = -width; }
      const v = args[k], tg = tags[k] || 'i';
      k++;
      let s;
      switch (conv) {
        case 'd': case 'i': {
          let x = v === undefined ? 0 : tg === 'f' ? garbageInt(v) : Math.trunc(v);
          if (len === 'h') x = x << 16 >> 16; else if (len === 'hh') x = x << 24 >> 24; else if (!len) x = x | 0;
          let digits = Math.abs(x).toString();
          if (prec !== null) { if (prec === 0 && x === 0) digits = ''; while (digits.length < prec) digits = '0' + digits; }
          s = (x < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '') + digits;
          break;
        }
        case 'u': case 'x': case 'X': case 'o': {
          let x = v === undefined ? 0 : tg === 'f' ? garbageInt(v) : Math.trunc(v);
          if (x < 0) x = (len === 'l' || len === 'll') ? 2 ** 64 + x : x >>> 0;
          else if (!len) x = x >>> 0;
          s = x.toString(conv === 'u' ? 10 : conv === 'o' ? 8 : 16);
          if (conv === 'X') s = s.toUpperCase();
          if (prec !== null) while (s.length < prec) s = '0' + s;
          if (flags.includes('#') && x !== 0) s = (conv === 'o' ? '0' : conv === 'x' ? '0x' : conv === 'X' ? '0X' : '') + s;
          break;
        }
        case 'c': s = String.fromCharCode((v | 0) & 0xffff); break;
        case 's': s = v === undefined ? '(null)' : cstrOf(v); if (prec !== null) s = s.slice(0, prec); break;
        case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': {
          const x = v === undefined || 'iucb'.includes(tg) ? 0 : +v;
          s = floatFmt(x, conv, prec === null ? 6 : prec, flags);
          break;
        }
        case 'p': s = '0x7ffd' + ((Math.random() * 0xffffff) | 0).toString(16).padStart(6, '0'); break;
        default: s = m[0];
      }
      if (s.length < width) {
        const zeroOk = flags.includes('0') && !left && 'diouxXfFeEgG'.includes(conv) && !(prec !== null && 'diouxX'.includes(conv)) && /\d/.test(s);
        if (left) s = s + ' '.repeat(width - s.length);
        else if (zeroOk) {
          const pre = /^([+\- ]|0[xX])/.exec(s);
          const head = pre ? pre[0] : '';
          s = head + '0'.repeat(width - s.length) + s.slice(head.length);
        } else s = ' '.repeat(width - s.length) + s;
      }
      out += s;
    }
    return out + fmt.slice(last);
  }

  /* ============================== Runtime ============================== */
  function createRuntime(io, opt) {
    const A = opt.mode === 'arduino';
    const rt = { L: 0, B: 0, D: 0, T: false, stk: [], inbuf: '', inpos: 0, cinFail: false };
    const board = io.board;

    rt.out = s => { io.out(String(s)); return 0; };
    rt.so = () => { throw new RuntimeError('Segmentation fault (stack overflow)', 'Fungsi memanggil dirinya sendiri terlalu banyak (rekursi tanpa henti). Pastikan ada kondisi berhenti.'); };
    rt.w64 = x => (isFinite(x) ? Math.trunc(x) : 0);
    rt.ftoi = x => (isFinite(x) ? Math.trunc(x) : (A ? 0 : -2147483648));
    rt.idiv = (a, b) => {
      if (b === 0) {
        if (A) { io.warn && io.warn('div0', `Pembagian dengan nol di baris ${rt.L}. Di Arduino hasilnya tidak menentu (di sini dianggap -1).`); return -1; }
        throw new RuntimeError('Floating point exception (core dumped)', 'Terjadi pembagian bilangan bulat dengan nol. Periksa nilai pembagi sebelum membagi.');
      }
      return Math.trunc(a / b);
    };
    rt.imod = (a, b) => {
      if (b === 0) {
        if (A) { io.warn && io.warn('div0', `Sisa bagi (%) dengan nol di baris ${rt.L}.`); return 0; }
        throw new RuntimeError('Floating point exception (core dumped)', 'Operator % (sisa bagi) dengan nol tidak boleh.');
      }
      return a % b;
    };
    rt.fmod = (a, b) => a % b;
    rt.round = x => (x < 0 ? -Math.round(-x) : Math.round(x));
    rt.ix = (arr, i, name) => {
      if (i >= 0 && i < arr.length) return i;
      throw new RuntimeError(`indeks di luar batas: ${name}[${i}]`, `Array ${name} hanya punya ${arr.length} elemen (indeks 0 sampai ${arr.length - 1}). Di C/C++ asli kesalahan ini tidak selalu langsung terlihat, tetapi bisa merusak data atau membuat program crash.`);
    };
    const mk = (dims, k, z) => {
      const n = dims[k];
      if (!Number.isInteger(n) || n <= 0) throw new RuntimeError(`ukuran array tidak valid: ${n}`, 'Ukuran array harus bilangan bulat positif.');
      if (n > 5e6) throw new RuntimeError('ukuran array terlalu besar', 'Gunakan ukuran array yang lebih kecil.');
      if (k === dims.length - 1) return new Array(n).fill(z);
      return Array.from({ length: n }, () => mk(dims, k + 1, z));
    };
    rt.arr = (dims, z) => mk(dims, 0, z);
    rt.pad = (lit, dims, z) => {
      const go = (a, k) => {
        const n = dims[k] == null ? a.length : dims[k];
        const res = a.slice(0, n);
        for (let i = 0; i < res.length; i++) if (k < dims.length - 1) res[i] = go(res[i], k + 1);
        while (res.length < n) res.push(k < dims.length - 1 ? mk(dims, k + 1, z) : z);
        return res;
      };
      return go(lit, 0);
    };
    rt.cs = (s, size) => {
      const a = new Array(size).fill(0);
      for (let i = 0; i < s.length && i < size; i++) a[i] = s.charCodeAt(i);
      return a;
    };
    rt.cstr = cstrOf;
    rt.strset = (a, s) => {
      if (s.length + 1 > a.length) throw new RuntimeError('*** stack smashing detected ***: terminated', `Teks "${s}" (${s.length} huruf) terlalu panjang untuk array berukuran ${a.length}. Sisakan 1 tempat untuk penutup \\0.`);
      for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
      a[s.length] = 0;
      return 0;
    };
    rt.strcpy = (a, s) => rt.strset(a, s);
    rt.strcat = (a, s) => rt.strset(a, cstrOf(a) + s);
    rt.strcmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    rt.sch = (s, i) => { i = Math.trunc(i); return i >= 0 && i < s.length ? s.charCodeAt(i) : 0; };
    rt.toInt = s => { const m = /^\s*[+-]?\d+/.exec(String(s)); return m ? parseInt(m[0], 10) : 0; };
    rt.toFloat = s => { const m = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(String(s)); return m ? parseFloat(m[0]) : 0; };
    rt.toString = (v, isF) => (isF ? toFixedC(Math.abs(v), 6).replace(/^/, v < 0 ? '-' : '') : String(Math.trunc(v)));
    rt.S = (v, tag, extra) => {
      switch (tag) {
        case 'f': return arduinoFloat(v, extra === undefined ? 2 : extra);
        case 'c': return String.fromCharCode(v);
        case 's': return String(v);
        case 'a': return cstrOf(v);
        default: {
          const base = extra === undefined ? 10 : extra;
          return base === 10 ? String(v) : (v < 0 ? v >>> 0 : v).toString(base);
        }
      }
    };
    rt.toupper = c => (c >= 97 && c <= 122 ? c - 32 : c);
    rt.tolower = c => (c >= 65 && c <= 90 ? c + 32 : c);
    rt.isdigit = c => +(c >= 48 && c <= 57);
    rt.isalpha = c => +((c >= 65 && c <= 90) || (c >= 97 && c <= 122));
    rt.isalnum = c => +(rt.isdigit(c) || rt.isalpha(c));
    rt.isspace = c => +(c === 32 || (c >= 9 && c <= 13));
    rt.isupper = c => +(c >= 65 && c <= 90);
    rt.islower = c => +(c >= 97 && c <= 122);

    // rand() mengikuti algoritma glibc agar hasilnya sama dengan compiler asli.
    let rr = [], ri = 0;
    rt.srand = seed => {
      seed = (seed >>> 0) || 1;
      const r = new Array(34);
      r[0] = seed | 0;
      for (let i = 1; i < 31; i++) { let v = (16807 * r[i - 1]) % 2147483647; if (v < 0) v += 2147483647; r[i] = v; }
      for (let i = 31; i < 34; i++) r[i] = r[i - 31];
      rr = r; ri = 34;
      for (let i = 34; i < 344; i++) { rr.push((rr[i - 31] + rr[i - 3]) | 0); ri++; }
      return 0;
    };
    rt.rand = () => {
      if (!rr.length) rt.srand(1);
      const v = (rr[ri - 31] + rr[ri - 3]) | 0;
      rr.push(v); ri++;
      if (rr.length > 4000) { rr = rr.slice(-40); ri = rr.length; }
      return (v >>> 1);
    };
    rt.random = (a, b) => {
      if (b === undefined) { b = a; a = 0; }
      if (b <= a) return a;
      return a + (rt.rand() % (b - a));
    };
    rt.time = () => Math.floor(Date.now() / 1000);
    rt.exit = code => { throw new ExitSignal(code | 0); };
    rt.system = cmd => {
      const c = String(cmd).trim().toLowerCase();
      if (c === 'cls' || c === 'clear') { io.clear && io.clear(); return 0; }
      if (c === 'pause') { rt.out('Press any key to continue . . . \n'); return 0; }
      return 0;
    };
    rt.delay = ms => ({ t: 'd', ms: Math.max(0, +ms || 0) });

    // printf / scanf / cin / cout
    rt.printf = (fmt, args, tags) => { const s = formatC(fmt, args, tags); rt.out(s); return s.length; };
    function* peekc() {
      while (rt.inpos >= rt.inbuf.length) yield { t: 'in' };
      return rt.inbuf[rt.inpos];
    }
    function* skipWs() {
      for (;;) { const c = yield* peekc(); if (!/\s/.test(c)) return; rt.inpos++; }
    }
    rt.getchar = function* () {
      const c = yield* peekc();
      rt.inpos++;
      return c.charCodeAt(0);
    };
    rt.reint = (v, from, to) => {
      const dv = new DataView(new ArrayBuffer(8));
      const put = { i8: () => dv.setInt8(0, v), i16: () => dv.setInt16(0, v, true), i32: () => dv.setInt32(0, v, true), i64: () => dv.setBigInt64(0, BigInt(Math.trunc(v)), true), f32: () => dv.setFloat32(0, v, true), f64: () => dv.setFloat64(0, v, true) };
      const get = { i8: () => dv.getInt8(0), i16: () => dv.getInt16(0, true), i32: () => dv.getInt32(0, true), i64: () => Number(dv.getBigInt64(0, true)), f32: () => dv.getFloat32(0, true), f64: () => dv.getFloat64(0, true) };
      (put[from] || put.i32)();
      return (get[to] || get.i32)();
    };
    const segv = () => new RuntimeError('Segmentation fault (core dumped)', 'scanf mencoba menyimpan nilai ke alamat memori yang salah. Penyebab paling sering: lupa tanda & sebelum nama variabel, misal scanf("%d", &x);');
    rt.scanf = function* (fmt, setters) {
      let si = 0, count = 0, m;
      const re = /%(\*)?(\d+)?(hh|h|ll|l|L)?([diuoxXfFeEgGcs%])|(\s+)|([^%\s])/g;
      while ((m = re.exec(fmt))) {
        if (m[5]) { yield* skipWs(); continue; }
        if (m[6]) {
          const c = yield* peekc();
          if (c !== m[6]) return count;
          rt.inpos++; continue;
        }
        const conv = m[4], suppress = !!m[1], width = m[2] ? +m[2] : Infinity;
        if (conv === '%') { yield* skipWs(); const c = yield* peekc(); if (c !== '%') return count; rt.inpos++; continue; }
        if (conv !== 'c') yield* skipWs();
        let val;
        if (conv === 'c') { const c = yield* peekc(); rt.inpos++; val = c.charCodeAt(0); }
        else {
          const rest = rt.inbuf.slice(rt.inpos, rt.inpos + Math.min(width, 400));
          let mm;
          if (conv === 's') mm = /^\S+/.exec(rest);
          else if ('di'.includes(conv) || conv === 'u') mm = /^[+-]?\d+/.exec(rest);
          else if (conv === 'x' || conv === 'X') mm = /^[+-]?(0[xX])?[0-9a-fA-F]+/.exec(rest);
          else if (conv === 'o') mm = /^[+-]?[0-7]+/.exec(rest);
          else mm = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest);
          if (!mm) return count;
          rt.inpos += mm[0].length;
          if (conv === 's') val = mm[0];
          else if (conv === 'x' || conv === 'X') val = parseInt(mm[0], 16);
          else if (conv === 'o') val = parseInt(mm[0], 8);
          else if ('diu'.includes(conv)) val = parseInt(mm[0], 10);
          else val = parseFloat(mm[0]);
        }
        if (suppress) continue;
        const set = setters[si++];
        if (!set) throw segv();
        set(val);
        count++;
      }
      return count;
    };
    rt.cin = function* (items) {
      for (const [set, kind] of items) {
        if (rt.cinFail) return 0;
        yield* skipWs();
        const rest = rt.inbuf.slice(rt.inpos, rt.inpos + 400);
        let mm, val;
        if (kind === 'i') mm = /^[+-]?\d+/.exec(rest);
        else if (kind === 'f') mm = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest);
        else if (kind === 'c') mm = [rest[0]];
        else mm = /^\S+/.exec(rest);
        if (!mm) { rt.cinFail = true; set(0); return 0; }
        rt.inpos += mm[0].length;
        if (kind === 'i') val = parseInt(mm[0], 10);
        else if (kind === 'f') val = parseFloat(mm[0]);
        else if (kind === 'c') val = mm[0].charCodeAt(0);
        else val = mm[0];
        set(val);
      }
      return 1;
    };
    rt.getline = function* (set) {
      let s = '';
      for (;;) {
        const c = yield* peekc();
        rt.inpos++;
        if (c === '\n') break;
        s += c;
      }
      set(s);
      return 1;
    };
    rt.ignore = function* (n, delim) {
      for (let i = 0; i < n; i++) {
        const c = yield* peekc();
        rt.inpos++;
        if (delim >= 0 && c.charCodeAt(0) === delim) break;
      }
      return 0;
    };
    const cs = { prec: 6, fixed: false, sci: false, width: 0, fill: ' ', left: false, boolalpha: false };
    rt.cout = items => {
      let s = '';
      for (const [tag, v] of items) {
        let piece;
        switch (tag) {
          case 'm':
            if (v === 'endl') { s += '\n'; continue; }
            if (v === 'fixed') { cs.fixed = true; cs.sci = false; }
            else if (v === 'scientific') { cs.sci = true; cs.fixed = false; }
            else if (v === 'left') cs.left = true;
            else if (v === 'right') cs.left = false;
            else if (v === 'boolalpha') cs.boolalpha = true;
            else if (v === 'noboolalpha') cs.boolalpha = false;
            continue;
          case 'setprecision': cs.prec = Math.max(0, v | 0); continue;
          case 'setw': cs.width = v | 0; continue;
          case 'setfill': cs.fill = String.fromCharCode(v); continue;
          case 'b': piece = cs.boolalpha ? (v ? 'true' : 'false') : String(v); break;
          case 'c': piece = String.fromCharCode(v); break;
          case 's': piece = String(v); break;
          case 'a': piece = cstrOf(v); break;
          case 'f': piece = floatFmt(v, cs.fixed ? 'f' : cs.sci ? 'e' : 'g', cs.prec, ''); break;
          default: piece = String(v);
        }
        if (cs.width > piece.length) {
          const pad = cs.fill.repeat(cs.width - piece.length);
          piece = cs.left ? piece + pad : pad + piece;
        }
        cs.width = 0;
        s += piece;
      }
      if (s) rt.out(s);
      return 0;
    };

    // ---------- Arduino ----------
    if (A) {
      const ser = { on: false, rx: '' };
      ser.begin = b => { ser.on = true; io.serialBegin && io.serialBegin(b); return 0; };
      ser.print = (v, tag, extra, ln) => {
        let s = tag === 'b' ? String(v) : rt.S(v, tag, extra);
        if (tag !== 'f' && tag !== 'c' && tag !== 's' && tag !== 'a' && extra !== undefined && extra !== 10) s = s.toUpperCase();
        if (ln) s += '\r\n';
        if (!ser.on) { io.warn && io.warn('serial', 'Serial.print dipanggil, tetapi Serial.begin(9600) belum ada di setup(). Di Arduino asli, data tidak akan muncul di Serial Monitor.'); return 0; }
        io.serial(s);
        return s.length;
      };
      ser.write = (v, tag) => ser.print(tag === 's' || tag === 'a' ? v : String.fromCharCode(v), tag === 'a' ? 'a' : 's', undefined, false);
      ser.available = () => (io.serialRx ? io.serialRx().length : 0);
      ser.read = () => { const b = io.serialRx ? io.serialRx() : ''; if (!b.length) return -1; io.serialTake(1); return b.charCodeAt(0); };
      ser.peek = () => { const b = io.serialRx ? io.serialRx() : ''; return b.length ? b.charCodeAt(0) : -1; };
      ser.parseNum = function* (isFloat) {
        const t0 = board.now();
        for (;;) {
          const b = io.serialRx();
          const m = (isFloat ? /[-+]?(\d+\.?\d*|\.\d+)/ : /[-+]?\d+/).exec(b);
          if (m && m.index + m[0].length < b.length) { io.serialTake(m.index + m[0].length); return isFloat ? parseFloat(m[0]) : parseInt(m[0], 10); }
          if (board.now() - t0 >= 1000) {
            if (m) { io.serialTake(m.index + m[0].length); return isFloat ? parseFloat(m[0]) : parseInt(m[0], 10); }
            io.serialTake(b.length);
            return 0;
          }
          yield { t: 'd', ms: 20 };
        }
      };
      ser.readUntil = function* (term) {
        const t0 = board.now();
        for (;;) {
          const b = io.serialRx();
          const at = term >= 0 ? b.indexOf(String.fromCharCode(term)) : -1;
          if (at >= 0) { io.serialTake(at + 1); return b.slice(0, at); }
          if (board.now() - t0 >= 1000) { io.serialTake(b.length); return b; }
          yield { t: 'd', ms: 20 };
        }
      };
      rt.ser = ser;
      rt.pinMode = (p, m) => { board.pinMode(p, m); return 0; };
      rt.dw = (p, v) => { board.digitalWrite(p, v ? 1 : 0); return 0; };
      rt.dr = p => board.digitalRead(p);
      rt.ar = p => board.analogRead(p);
      rt.aw = (p, v) => { board.analogWrite(p, v); return 0; };
      rt.millis = () => Math.floor(board.now()) >>> 0;
      rt.micros = () => Math.floor(board.now() * 1000) >>> 0;
      rt.tone = (p, f, d) => { board.tone(p, f, d); return 0; };
      rt.noTone = p => { board.noTone(p); return 0; };
      rt.pulseIn = (p, v, to) => board.pulseIn(p, v, to);
      rt.map = (x, a, b, c, d) => {
        if (b === a) { io.warn && io.warn('map0', 'map(): rentang masuk tidak boleh sama (pembagian dengan nol).'); return -1; }
        return Math.trunc((x - a) * (d - c) / (b - a)) + c;
      };
      rt.constrain = (x, a, b) => (x < a ? a : x > b ? b : x);
    }
    return rt;
  }

  function arduinoFloat(v, d) {
    if (Number.isNaN(v)) return 'nan';
    if (!isFinite(v)) return 'inf';
    if (v > 4294967040 || v < -4294967040) return 'ovf';
    d = Math.max(0, Math.min(10, d | 0));
    return v.toFixed(d);
  }

  /* ============================== Menjalankan program ============================== */
  const LOOP_END = { t: 'loop' };

  function run(prog, opt) {
    // opt: { mode, io, onInput, onDone(code), onError(err), onStep(info), sliceMs, maxCpuMs }
    const rt = createRuntime(opt.io, opt);
    let fns;
    try { fns = prog.factory(rt); } catch (e) { setTimeout(() => opt.onError && opt.onError(e, rt), 0); return { stop() {}, input() {}, step() {}, running: false, rt }; }
    rt.T = !!opt.stepMode;
    const gen = opt.mode === 'arduino'
      ? (function* () { yield* fns.init(); yield* fns.setup(); for (;;) { yield* fns.loop(); yield LOOP_END; } })()
      : (function* () { yield* fns.init(); return yield* fns.main(); })();
    const ctl = { running: true, waiting: null, rt, paused: false };
    let timer = null, cpu = 0;
    const slice = opt.sliceMs || 12;

    function finish(code) {
      if (!ctl.running) return;
      ctl.running = false;
      opt.onDone && opt.onDone(code, rt);
    }
    function fail(e) {
      if (!ctl.running) return;
      ctl.running = false;
      if (e instanceof ExitSignal) { opt.onDone && opt.onDone(e.code, rt); return; }
      if (e instanceof RangeError) e = new RuntimeError('Segmentation fault (stack overflow)', 'Fungsi memanggil dirinya sendiri terlalu dalam. Pastikan rekursi punya kondisi berhenti.');
      if (!(e instanceof RuntimeError)) { console.error(e); e = new RuntimeError('internal error: ' + e.message, 'Terjadi kesalahan di simulator. Coba tulis kode dengan cara yang lebih sederhana.'); }
      e.line = rt.L;
      e.fn = rt.stk[rt.stk.length - 1];
      opt.onError && opt.onError(e, rt);
    }
    function tick() {
      timer = null;
      if (!ctl.running || ctl.paused || ctl.waiting) return;
      const t0 = performance.now();
      try {
        for (;;) {
          rt.B = 20000;
          const r = gen.next();
          if (r.done) { finish(r.value | 0); return; }
          const y = r.value;
          if (y === 0 || y === LOOP_END) {
            if (performance.now() - t0 > slice) break;
            continue;
          }
          if (y.t === 'in') { ctl.waiting = 'input'; cpu = 0; opt.onInput && opt.onInput(); return; }
          if (y.t === 'd') {
            cpu = 0;
            if (y.ms <= 0) continue;
            timer = setTimeout(tick, y.ms);
            return;
          }
          if (y.t === 's') {
            if (rt.T) { ctl.waiting = 'step'; opt.onStep && opt.onStep(y, rt); return; }
            continue;
          }
        }
      } catch (e) { fail(e); return; }
      cpu += performance.now() - t0;
      if (opt.mode !== 'arduino' && cpu > (opt.maxCpuMs || 15000)) {
        fail(new RuntimeError(`Program dihentikan: berjalan lebih dari ${Math.round((opt.maxCpuMs || 15000) / 1000)} detik tanpa menunggu input.`,'Kemungkinan ada perulangan tanpa akhir yang tidak disengaja. Periksa syarat for/while: apakah nilainya suatu saat menjadi salah?'));
        return;
      }
      timer = setTimeout(tick, 0);
    }
    ctl.stop = () => {
      if (!ctl.running) return;
      ctl.running = false;
      clearTimeout(timer);
      try { gen.return(); } catch (e) { /* abaikan */ }
    };
    ctl.input = text => {
      rt.inbuf += text + '\n';
      if (ctl.waiting === 'input') { ctl.waiting = null; tick(); }
    };
    ctl.step = () => { if (ctl.waiting === 'step') { ctl.waiting = null; tick(); } };
    ctl.setStepMode = on => { rt.T = on; if (!on && ctl.waiting === 'step') { ctl.waiting = null; tick(); } };
    ctl.pause = () => { ctl.paused = true; clearTimeout(timer); };
    ctl.resume = () => { if (!ctl.paused) return; ctl.paused = false; tick(); };
    setTimeout(tick, 0);
    return ctl;
  }

  /* ============================== Kompilasi ============================== */
  function compile(src, opt) {
    opt = Object.assign({ mode: 'console', lang: 'c', trace: false }, opt);
    const res = { ok: false, errors: [], warnings: [], js: '', factory: null };
    try {
      const lx = lex(src);
      res.warnings.push(...lx.warnings);
      const ps = new Parser(lx.toks, opt);
      const decls = ps.parseProgram();
      const g = new Gen(opt, lx, ps.usingStd);
      const js = g.genProgram(decls);
      res.errors.push(...g.errors);
      res.warnings.push(...g.warnings);
      if (!res.errors.length) {
        res.js = js;
        try { res.factory = new Function('rt', js); }
        catch (e) {
          console.error(e, js);
          res.errors.push(new CompileError('internal compiler error: ' + e.message, 1, 1, 'MiniC belum bisa menerjemahkan bagian kode ini. Coba tulis dengan cara yang lebih sederhana, atau gunakan mode GCC online.'));
        }
      }
    } catch (e) {
      if (e instanceof CompileError) res.errors.push(e);
      else { console.error(e); res.errors.push(new CompileError('internal compiler error: ' + e.message, 1, 1, 'Terjadi kesalahan di MiniC.')); }
    }
    res.errors.sort((a, b) => a.line - b.line || a.col - b.col);
    res.warnings.sort((a, b) => a.line - b.line || a.col - b.col);
    res.ok = !res.errors.length;
    return res;
  }

  function diag(e, file) { return `${file}:${e.line}:${e.col}: ${e.kind}: ${e.message}`; }

  root.MiniC = { compile, run, formatC, floatFmt, diag, CompileError, RuntimeError };
})(typeof window !== 'undefined' ? window : globalThis);
