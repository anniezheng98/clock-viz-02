(function () {
  'use strict';

  // ---------- Safe expression evaluator (no eval) ----------
  const SQRT = '\u221A'; // √
  const MINUS = '\u2212'; // −

  function tokenize(expr) {
    const s = String(expr).replace(/\s/g, '');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      if (/\d/.test(s[i])) {
        let n = '';
        while (i < s.length && /\d/.test(s[i])) n += s[i++];
        tokens.push({ type: 'num', value: parseInt(n, 10) });
        continue;
      }
      if (s[i] === '(' || s[i] === ')') {
        tokens.push({ type: s[i] === '(' ? 'open' : 'close' });
        i++;
        continue;
      }
      if (s[i] === '+' || s[i] === '-' || s[i] === MINUS || s[i] === '×' || s[i] === '÷' || s[i] === '*' || s[i] === '/') {
        const op = s[i] === '*' ? '×' : s[i] === '/' ? '÷' : s[i];
        tokens.push({ type: 'op', value: op });
        i++;
        continue;
      }
      if (s[i] === '^') {
        tokens.push({ type: 'pow' });
        i++;
        continue;
      }
      if (s[i] === '!') {
        tokens.push({ type: 'fact' });
        i++;
        continue;
      }
      if (s[i] === SQRT || s.substring(i, i + 4) === 'sqrt') {
        if (s[i] === SQRT) i++; else i += 4;
        tokens.push({ type: 'sqrt' });
        continue;
      }
      if (s.substring(i, i + 6) === 'log₁₀(' || s.substring(i, i + 6) === 'log10(') {
        i += s.substring(i, i + 6).startsWith('log₁₀') ? 6 : 6;
        tokens.push({ type: 'log10' });
        tokens.push({ type: 'open' });
        continue;
      }
      if (s.substring(i, i + 5) === 'log₂(' || s.substring(i, i + 5) === 'log2(') {
        i += s.substring(i, i + 5).startsWith('log₂') ? 5 : 5;
        tokens.push({ type: 'log2' });
        tokens.push({ type: 'open' });
        continue;
      }
      if (s.substring(i, i + 3) === 'ln(') {
        i += 3;
        tokens.push({ type: 'ln' });
        tokens.push({ type: 'open' });
        continue;
      }
      i++;
    }
    return tokens;
  }

  function isInteger(x) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return false;
    const r = Math.round(x);
    return Math.abs(x - r) <= 1e-9;
  }

  function normalizeToInteger(x) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return NaN;
    const r = Math.round(x);
    return Math.abs(x - r) <= 1e-9 ? r : x;
  }

  function safeFactorial(n) {
    if (n < 0 || n > 6 || !Number.isInteger(n)) throw new Error('Factorial only for 0..6');
    if (n <= 1) return 1;
    let f = 1;
    for (let i = 2; i <= n; i++) f *= i;
    return f;
  }

  function parseExpr(tokens) {
    let pos = 0;
    function accept(type, val) {
      if (pos >= tokens.length) return false;
      const t = tokens[pos];
      if (t.type === type && (val === undefined || t.value === val)) {
        pos++;
        return true;
      }
      return false;
    }
    function atom() {
      if (accept('num')) return tokens[pos - 1].value;
      if (accept('sqrt')) {
        const v = atom();
        if (v < 0) throw new Error('Negative sqrt');
        const r = Math.sqrt(v);
        if (!isInteger(r)) throw new Error('sqrt must be perfect square');
        return Math.round(r);
      }
      if (accept('log10')) {
        if (!accept('open')) throw new Error('Missing ( after log10');
        const v = expr();
        if (!accept('close')) throw new Error('Missing ) after log10');
        if (v <= 0) throw new Error('log10 of non-positive');
        const r = Math.log10(v);
        if (!isInteger(r)) throw new Error('log10 result must be integer');
        return Math.round(r);
      }
      if (accept('log2')) {
        if (!accept('open')) throw new Error('Missing ( after log2');
        const v = expr();
        if (!accept('close')) throw new Error('Missing ) after log2');
        if (v <= 0) throw new Error('log2 of non-positive');
        const r = Math.log2(v);
        if (!isInteger(r)) throw new Error('log2 result must be integer');
        return Math.round(r);
      }
      if (accept('ln')) {
        if (!accept('open')) throw new Error('Missing ( after ln');
        const v = expr();
        if (!accept('close')) throw new Error('Missing ) after ln');
        if (v <= 0) throw new Error('ln of non-positive');
        const r = Math.log(v);
        if (!isInteger(r)) throw new Error('ln result must be integer');
        return Math.round(r);
      }
      if (accept('open')) {
        const v = expr();
        if (!accept('close')) throw new Error('Missing )');
        return v;
      }
      throw new Error('Expected number or ( or √ or log');
    }
    function factor() {
      let v = atom();
      if (accept('fact')) v = safeFactorial(v);
      return v;
    }
    function num() {
      let left = factor();
      if (accept('pow')) {
        const right = num();
        if (right < 0 || right > 20) throw new Error('Exponent out of range');
        const r = Math.pow(left, right);
        if (!isInteger(r)) throw new Error('Power result must be integer');
        left = Math.round(r);
      }
      return left;
    }
    function term() {
      let left = num();
      while (pos < tokens.length && tokens[pos].type === 'op' && (tokens[pos].value === '×' || tokens[pos].value === '÷')) {
        const op = tokens[pos].value;
        pos++;
        const right = num();
        if (op === '×') left = left * right;
        else {
          if (right === 0) throw new Error('Division by zero');
          if (left % right !== 0) throw new Error('Non-integer division');
          left = Math.floor(left / right);
        }
      }
      return left;
    }
    function expr() {
      let left = term();
      while (pos < tokens.length && tokens[pos].type === 'op' && (tokens[pos].value === '+' || tokens[pos].value === '-' || tokens[pos].value === MINUS)) {
        const op = tokens[pos].value;
        pos++;
        const right = term();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }
    const result = expr();
    if (pos !== tokens.length) throw new Error('Extra tokens');
    return result;
  }

  function evaluateEquation(displayStr) {
    const tokens = tokenize(displayStr);
    if (tokens.length === 0) throw new Error('Empty');
    const raw = parseExpr(tokens);
    return normalizeToInteger(raw);
  }

  function safeEval(displayStr) {
    const v = evaluateEquation(displayStr);
    if (!Number.isInteger(v)) throw new Error('Result must be integer');
    return v;
  }

  // ---------- Equation generator ----------
  function getFactors(n) {
    if (n <= 0) return [];
    const out = [];
    for (let a = 2; a * a <= n; a++) {
      if (n % a === 0) out.push([a, n / a]);
    }
    return out;
  }

  const PERFECT_SQUARES = [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];

  function getAdvancedPatterns(T) {
    const out = [];
    const clean = (display, score) => ({ display, cleanScore: score });

    if (T >= 0 && T <= 12 && PERFECT_SQUARES.indexOf(T * T) !== -1) {
      const sq = T * T;
      out.push(clean(sq === 0 ? `${SQRT}0` : `${SQRT}${sq}`, 10));
    }
    if (T >= 0 && T <= 2) {
      const x = T === 0 ? 1 : T === 1 ? 10 : 100;
      out.push(clean(`log₁₀(${x})`, 10));
    }
    if (T >= 0 && T <= 5) {
      const x = Math.pow(2, T);
      out.push(clean(`log₂(${x})`, 10));
    }
    for (let exp = 1; exp <= 5; exp++) {
      const base = Math.pow(2, exp);
      const rem = T - base;
      if (rem >= 0 && rem <= 12) out.push(clean(`2^${exp}+${rem}`, 8));
      if (rem < 0 && rem >= -12) out.push(clean(`2^${exp}${MINUS}${-rem}`, 8));
    }
    for (let exp = 2; exp <= 4; exp++) {
      const base = Math.pow(3, exp);
      const rem = T - base;
      if (rem >= 0 && rem <= 24) out.push(clean(`(3^${exp})+${rem}`, 7));
    }
    for (let n = 2; n <= 12; n++) {
      if (n * n <= 144 && T >= n) {
        const rem = T - n;
        if (rem >= 0 && rem <= 12) out.push(clean(`${SQRT}${n * n}${MINUS}${rem}`, 6));
        if (rem <= 0 && rem >= -12) out.push(clean(`${SQRT}${n * n}+${-rem}`, 6));
      }
    }
    if (T === 1) out.push(clean('1!', 9));
    if (T === 2) out.push(clean('2!', 9));
    if (T === 6) out.push(clean('3!', 9));
    if (T === 24) out.push(clean('4!', 9));
    for (let a = 2; a <= 5; a++) {
      for (let b = 1; b <= 4; b++) {
        const p = Math.pow(a, b);
        if (p > 60) continue;
        const rem = T - p;
        if (rem >= 0 && rem <= 12) out.push(clean(`(${a}^${b})+${rem}`, 6));
        if (rem < 0 && rem >= -12) out.push(clean(`(${a}^${b})${MINUS}${-rem}`, 6));
      }
    }
    return out;
  }

  function generateEquation(target, kind) {
    const candidates = [];
    const T = target;
    const useAdvanced = Math.random() < 0.30;

    if (useAdvanced && T >= 0 && T <= 59) {
      const advanced = getAdvancedPatterns(T);
      const validAdvanced = [];
      for (const c of advanced) {
        let value;
        try {
          value = evaluateEquation(c.display);
        } catch (_) {
          continue;
        }
        if (value !== T || !Number.isInteger(value)) continue;
        validAdvanced.push({ display: c.display, value, tokens: tokenize(c.display), cleanScore: c.cleanScore });
      }
      if (validAdvanced.length > 0) {
        validAdvanced.sort((a, b) => (b.cleanScore || 0) - (a.cleanScore || 0));
        const top = validAdvanced.filter(x => (x.cleanScore || 0) >= validAdvanced[0].cleanScore - 2);
        const pick = top[Math.floor(Math.random() * top.length)];
        return pick;
      }
    }

    if (T === 0) {
      candidates.push({ display: '6−6', type: 'sub', value: 0 });
      candidates.push({ display: '5−5', type: 'sub', value: 0 });
      candidates.push({ display: '12−12', type: 'sub', value: 0 });
    } else {
      // Multiplication (prefer small operands; avoid ×1)
      const factors = getFactors(T);
      factors.forEach(([a, b]) => {
        if (a <= 12 && b <= 12 && a !== 1 && b !== 1) candidates.push({ display: `${a}×${b}`, type: 'mult', value: T });
      });

      // Division: (T*b)÷b (avoid ÷1)
      for (let b = 2; b <= 12; b++) {
        const a = T * b;
        if (a <= 144) candidates.push({ display: `${a}÷${b}`, type: 'div', value: T });
      }

      // Addition (avoid +0)
      for (let a = 1; a < T && a <= 12; a++) {
        const b = T - a;
        if (b >= 1 && b <= 12) candidates.push({ display: `${a}+${b}`, type: 'add', value: T });
      }
      for (let b = 1; b < T && b <= 12; b++) {
        const a = T - b;
        if (a >= 1 && a <= 12) candidates.push({ display: `${a}+${b}`, type: 'add', value: T });
      }
      if (T <= 24) {
        for (let a = Math.max(1, T - 12); a <= Math.min(12, T - 1); a++) {
          const b = T - a;
          if (b >= 1) candidates.push({ display: `${a}+${b}`, type: 'add', value: T });
        }
      }

      // Subtraction (a - b = T, a > b)
      for (let a = T + 1; a <= Math.min(T + 12, 60); a++) {
        const b = a - T;
        if (b >= 1 && b <= 12) candidates.push({ display: `${a}−${b}`, type: 'sub', value: T });
      }
      if (T >= 10 && T <= 23) {
        candidates.push({ display: `24−${24 - T}`, type: 'sub', value: T });
      }
      if (T === 59) {
        candidates.push({ display: '60−1', type: 'sub', value: 59 });
        candidates.push({ display: '118÷2', type: 'div', value: 59 });
        candidates.push({ display: '50+9', type: 'add', value: 59 });
      }
      if (T === 23) {
        candidates.push({ display: '24−1', type: 'sub', value: 23 });
        candidates.push({ display: '46÷2', type: 'div', value: 23 });
        candidates.push({ display: '20+3', type: 'add', value: 23 });
      }
    }

    // Dedupe by display and filter to valid
    const seen = new Set();
    const valid = [];
    for (const c of candidates) {
      if (seen.has(c.display)) continue;
      seen.add(c.display);
      let value;
      try {
        value = safeEval(c.display);
      } catch (_) {
        continue;
      }
      if (value !== target) continue;
      valid.push({ display: c.display, value, tokens: tokenize(c.display) });
    }

    // Fallbacks
    if (valid.length === 0) {
      if (T === 0) valid.push({ display: '0', value: 0, tokens: [{ type: 'num', value: 0 }] });
      else valid.push({ display: String(T), value: T, tokens: [{ type: 'num', value: T }] });
    }

    const idx = Math.floor(Math.random() * valid.length);
    return valid[idx];
  }

  // ---------- Clock state and DOM ----------
  const tileHour = document.getElementById('tile-hour');
  const tileMinute = document.getElementById('tile-minute');
  const tileSecond = document.getElementById('tile-second');
  const textHour = document.getElementById('text-hour');
  const textMinute = document.getElementById('text-minute');
  const textSecond = document.getElementById('text-second');

  let state = { hour: -1, minute: -1, second: -1 };
  let eqHour = null;
  let eqMinute = null;
  let eqSecond = null;
  const use24h = true;
  const ANIM_MS = 200;

  function equationDisplayToHtml(display) {
    if (!display || typeof display !== 'string') return '';
    const escaped = display
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(/\^(\d+)/g, '<sup class="eq-sup">$1</sup>');
  }

  function updateTile(el, textEl, newDisplay, animate) {
    const html = equationDisplayToHtml(newDisplay);
    const same = textEl.innerHTML === html;
    if (same && textEl.getAttribute('data-raw') === newDisplay) return;
    textEl.setAttribute('data-raw', newDisplay);
    if (animate) {
      textEl.classList.add('animating');
      setTimeout(function () {
        textEl.innerHTML = html;
        textEl.classList.remove('animating');
        textEl.classList.add('animating-in');
        setTimeout(function () { textEl.classList.remove('animating-in'); }, 80);
      }, ANIM_MS);
    } else {
      textEl.innerHTML = html;
    }
  }

  function tick() {
    const now = new Date();
    let hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    if (!use24h) hour = hour % 12 || 12;

    const hourChanged = state.hour !== hour;
    const minuteChanged = state.minute !== minute;
    const secondChanged = state.second !== second;

    if (hourChanged) {
      eqHour = generateEquation(hour, 'hour');
      updateTile(tileHour, textHour, eqHour.display, true);
    }
    if (minuteChanged) {
      eqMinute = generateEquation(minute, 'minute');
      updateTile(tileMinute, textMinute, eqMinute.display, true);
    }
    if (secondChanged) {
      eqSecond = generateEquation(second, 'second');
      updateTile(tileSecond, textSecond, eqSecond.display, true);
    }

    state.hour = hour;
    state.minute = minute;
    state.second = second;
  }

  // Initial paint and refresh every 15–30s for variety (same target)
  function init() {
    tick();
    setInterval(tick, 1000);
    setInterval(function () {
      const now = new Date();
      const h = use24h ? now.getHours() : (now.getHours() % 12 || 12);
      const m = now.getMinutes();
      const s = now.getSeconds();
      eqHour = generateEquation(h, 'hour');
      eqMinute = generateEquation(m, 'minute');
      eqSecond = generateEquation(s, 'second');
      textHour.setAttribute('data-raw', eqHour.display);
      textMinute.setAttribute('data-raw', eqMinute.display);
      textSecond.setAttribute('data-raw', eqSecond.display);
      textHour.innerHTML = equationDisplayToHtml(eqHour.display);
      textMinute.innerHTML = equationDisplayToHtml(eqMinute.display);
      textSecond.innerHTML = equationDisplayToHtml(eqSecond.display);
    }, 20000);
  }

  init();
})();
