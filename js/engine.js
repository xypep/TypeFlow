/* =========================================================
   TypingSession — pure logic (no DOM)
   TypingView   — renders a session, caret, scrolling, live meta
   Input is routed by App via the hidden #key-sink textarea.
   ========================================================= */
class TypingSession {
  /**
   * @param {object} o
   *  text        target string
   *  timeLimit   seconds (time mode) or 0
   *  strict      wrong keys are not accepted
   *  moreText    () => string, appended in time mode when the text runs low
   */
  constructor({ text, timeLimit = 0, strict = false, moreText = null }) {
    this.target = text;
    this.typed = [];           // typed[i] = char the user entered at position i
    this.timeLimit = timeLimit;
    this.strict = strict;
    this.moreText = moreText;
    this.keystrokes = 0;       // every char key press
    this.errors = 0;           // wrong key presses
    this.startTime = 0;
    this.endTime = 0;
    this.finished = false;
    this.samples = [];         // per-second { t, wpm, raw, err }
    this.keyStats = {};        // expected char -> { hits, misses } (first attempt per position)
    this._judged = new Set();  // positions already counted for keyStats
    this._lastSampleSec = 0;
    this._errInSec = 0;
    this.listeners = {};
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  emit(evt, ...a) { (this.listeners[evt] || []).forEach(fn => fn(...a)); }

  get pos() { return this.typed.length; }
  get started() { return this.startTime > 0; }
  get elapsed() {
    if (!this.started) return 0;
    return ((this.finished ? this.endTime : performance.now()) - this.startTime) / 1000;
  }
  get remaining() { return this.timeLimit ? Math.max(0, this.timeLimit - this.elapsed) : 0; }

  /** Handles one typed character. Returns { ok, index }. */
  input(ch) {
    if (this.finished) return null;
    if (!this.started) { this.startTime = performance.now(); this.emit('start'); }
    const i = this.pos;
    const expected = this.target[i];
    const ok = ch === expected;
    this.keystrokes++;
    if (!ok) { this.errors++; this._errInSec++; }

    if (!this._judged.has(i) && expected !== undefined) {
      this._judged.add(i);
      const s = (this.keyStats[expected] ||= { hits: 0, misses: 0 });
      ok ? s.hits++ : s.misses++;
    }

    if (!ok && this.strict) { this.emit('reject', expected); return { ok, index: i, rejected: true }; }

    this.typed.push(ch);
    // time mode: keep the text endless
    if (this.timeLimit && this.moreText && this.target.length - this.pos < 120) {
      const extra = ' ' + this.moreText();
      this.target += extra;
      this.emit('extend', extra);
    }
    this.emit('change', i, i + 1);
    if (!this.timeLimit && this.pos >= this.target.length) this.finish();
    return { ok, index: i };
  }

  /** Backspace; with word=true deletes back to the previous word boundary. */
  backspace(word = false) {
    if (this.finished || this.pos === 0) return;
    const from = this.pos;
    if (word) {
      // skip trailing spaces, then delete the word
      while (this.pos > 0 && this.target[this.pos - 1] === ' ' && this.typed[this.pos - 1] === ' ') this.typed.pop();
      while (this.pos > 0 && this.target[this.pos - 1] !== ' ') this.typed.pop();
    } else {
      this.typed.pop();
    }
    this.emit('change', this.pos, from);
  }

  /** Called ~every 250ms by the view; records per-second samples and ends time mode. */
  tick() {
    if (!this.started || this.finished) return;
    const sec = Math.floor(this.elapsed);
    if (sec > this._lastSampleSec) {
      for (let s = this._lastSampleSec + 1; s <= sec; s++) {
        const st = this.stats(s);
        this.samples.push({ t: s, wpm: st.wpm, raw: st.raw, err: this._errInSec });
        this._errInSec = 0;
      }
      this._lastSampleSec = sec;
    }
    if (this.timeLimit && this.elapsed >= this.timeLimit) this.finish();
  }

  finish() {
    if (this.finished) return;
    this.endTime = performance.now();
    if (this.timeLimit) this.endTime = Math.min(this.endTime, this.startTime + this.timeLimit * 1000);
    this.finished = true;
    const secs = this.elapsed;
    if (secs - this._lastSampleSec > 0.3) {
      const st = this.stats(secs);
      this.samples.push({ t: Math.round(secs * 10) / 10, wpm: st.wpm, raw: st.raw, err: this._errInSec });
    }
    this.emit('finish', this.stats());
  }

  /** Current statistics. */
  stats(atSeconds) {
    const secs = Math.max(atSeconds ?? this.elapsed, 0.001);
    // never divide by less than one second — avoids absurd WPM after the first key
    const minutes = Math.max(secs, 1) / 60;
    let correct = 0;
    for (let i = 0; i < this.typed.length; i++) if (this.typed[i] === this.target[i]) correct++;
    const wpm = correct / 5 / minutes;
    const raw = this.typed.length / 5 / minutes;
    const accuracy = this.keystrokes ? ((this.keystrokes - this.errors) / this.keystrokes) * 100 : 100;
    const total = this.timeLimit ? this.pos : this.target.length;
    return {
      wpm: this.started ? Math.round(wpm) : 0,
      raw: this.started ? Math.round(raw) : 0,
      accuracy: Math.round(accuracy * 10) / 10,
      errors: this.errors,
      correctChars: correct,
      incorrectChars: this.typed.length - correct,
      typedChars: this.typed.length,
      keystrokes: this.keystrokes,
      seconds: Math.round(secs * 10) / 10,
      progress: this.timeLimit ? Math.min(1, secs / this.timeLimit) : Math.min(1, this.pos / Math.max(1, total)),
    };
  }

  /** Top missed characters for the result screen. */
  missedKeys(n = 8) {
    return Object.entries(this.keyStats)
      .filter(([, s]) => s.misses > 0)
      .sort((a, b) => b[1].misses - a[1].misses)
      .slice(0, n);
  }
}

class TypingView {
  /**
   * @param {HTMLElement} el container
   * @param {TypingSession} session
   * @param {object} o { single: bool, keyboard: Keyboard|null, sound: bool, meta: bool }
   */
  constructor(el, session, o = {}) {
    this.el = el;
    this.s = session;
    this.o = o;
    this.charEls = [];
    this.wordOf = [];     // char index -> word index (-1 for spaces)
    this.wordEls = [];
    this._build();
    session.on('change', (a, b) => this._update(a, b));
    session.on('extend', extra => this._appendText(extra, this.s.target.length - extra.length));
    session.on('reject', exp => this._reject(exp));
    session.on('start', () => this.caret.classList.add('typing-now'));
    this._update(0, 0);
    this._timer = setInterval(() => { session.tick(); this.updateMeta(); }, 250);
    session.on('finish', () => this.destroy());
    this._onResize = () => this._placeCaret();
    window.addEventListener('resize', this._onResize);
    // web fonts change glyph widths → re-measure when they arrive
    document.fonts?.ready.then(() => this._onResize());
    document.fonts?.addEventListener('loadingdone', this._onResize);
  }

  _build() {
    const S = Store.data.settings;
    this.el.innerHTML = `
      <div class="typing${this.o.single ? ' single' : ''}${S.smoothCaret ? '' : ' no-smooth'}">
        <div class="typing-meta"><span class="big" data-meta="main">0</span><span data-meta="side"></span></div>
        <div class="typing-viewport"><div class="typing-inner"><span class="caret ${S.caret}"></span></div></div>
        ${this.o.single ? '<div class="next-word"></div>' : ''}
        <div class="focus-hint" hidden>Click here or press any key to focus</div>
      </div>`;
    this.root = this.el.firstElementChild;
    this.inner = this.root.querySelector('.typing-inner');
    this.viewport = this.root.querySelector('.typing-viewport');
    this.caret = this.root.querySelector('.caret');
    this.nextWordEl = this.root.querySelector('.next-word');
    this.focusHint = this.root.querySelector('.focus-hint');
    this.metaMain = this.root.querySelector('[data-meta="main"]');
    this.metaSide = this.root.querySelector('[data-meta="side"]');
    this.inner.style.fontSize = (this.o.single ? S.fontSize * 2 : S.fontSize) + 'px';
    this._appendText(this.s.target, 0);
    // viewport shows 3 lines (1 line in single mode)
    const lh = parseFloat(getComputedStyle(this.inner).lineHeight);
    this.lineHeight = lh;
    this.viewport.style.height = (this.o.single ? lh : lh * 3) + 'px';
    this.root.addEventListener('mousedown', e => { e.preventDefault(); App.focusSink(); });
  }

  /** Builds spans for text starting at char index `offset`. */
  _appendText(text, offset) {
    const frag = document.createDocumentFragment();
    let wordEl = null;
    for (let j = 0; j < text.length; j++) {
      const ch = text[j];
      const i = offset + j;
      const span = document.createElement('span');
      span.className = 'ch';
      if (ch === ' ') {
        span.classList.add('sp');
        span.textContent = ' ';
        frag.appendChild(span);
        wordEl = null;
        this.wordOf[i] = -1;
      } else {
        if (!wordEl) {
          wordEl = document.createElement('span');
          wordEl.className = 'word';
          frag.appendChild(wordEl);
          this.wordEls.push(wordEl);
        }
        span.textContent = ch;
        wordEl.appendChild(span);
        this.wordOf[i] = this.wordEls.length - 1;
      }
      this.charEls[i] = span;
    }
    this.inner.appendChild(frag);
  }

  _update(a, b) {
    const { typed, target } = this.s;
    for (let i = Math.min(a, b); i < Math.max(a, b); i++) {
      const el = this.charEls[i];
      if (!el) continue;
      el.classList.remove('ok', 'bad');
      if (i < typed.length) el.classList.add(typed[i] === target[i] ? 'ok' : 'bad');
    }
    if (this.o.single) this._updateSingle();
    this._placeCaret();
    this.o.keyboard?.highlight(target[this.s.pos] ?? null);
    if (a < b && typed[a] !== undefined && typed[a] !== target[a]) this._onError(target[a]);
    this.updateMeta();
  }

  _updateSingle() {
    const p = this.s.pos;
    // at a space the previous word stays visible until the space is typed
    let w = this.wordOf[p];
    if (w === -1 || w === undefined) w = this.wordOf[p - 1] ?? 0;
    if (w === -1) w = this.wordOf[p + 1] ?? 0;
    this.wordEls.forEach((el, k) => el.classList.toggle('current', k === w));
    if (this.nextWordEl) this.nextWordEl.textContent = this.wordEls[w + 1]?.textContent ?? '';
  }

  _placeCaret() {
    const p = this.s.pos;
    this.lineHeight = parseFloat(getComputedStyle(this.inner).lineHeight) || this.lineHeight;
    let el = this.charEls[p];
    let x, y, h;
    const visible = el && el.offsetParent !== null && !(this.o.single && el.classList.contains('sp'));
    if (visible) {
      x = el.offsetLeft; y = el.offsetTop; h = el.offsetHeight;
    } else {
      // after the last visible char
      el = this.charEls[p - 1];
      if (!el || el.offsetParent === null) { this.caret.style.opacity = 0; return; }
      x = el.offsetLeft + el.offsetWidth; y = el.offsetTop; h = el.offsetHeight;
    }
    this.caret.style.opacity = '';
    this.caret.style.left = x + 'px';
    if (this.caret.classList.contains('underline')) {
      this.caret.style.top = (y + h - 4) + 'px';
    } else {
      this.caret.style.top = (y + h * 0.12) + 'px';
      this.caret.style.height = (h * 0.76) + 'px';
    }
    if (this.caret.classList.contains('block')) this.caret.style.width = (el.offsetWidth || h * .55) + 'px';
    // keep the caret on the second visible line
    if (!this.o.single) {
      const line = Math.round(y / this.lineHeight);
      const shift = Math.max(0, line - 1) * this.lineHeight;
      this.inner.style.transform = `translateY(${-shift}px)`;
    }
    this.caret.classList.add('typing-now');
    clearTimeout(this._blinkT);
    this._blinkT = setTimeout(() => this.caret.classList.remove('typing-now'), 600);
  }

  _onError(expected) {
    this.o.keyboard?.flashMiss(expected);
    if (this.o.sound) beep();
  }

  _reject(expected) {
    this._onError(expected);
    const el = this.charEls[this.s.pos];
    el?.classList.add('bad');
    setTimeout(() => el?.classList.remove('bad'), 200);
    this.root.classList.remove('shake'); void this.root.offsetWidth; this.root.classList.add('shake');
  }

  updateMeta() {
    const st = this.s.stats();
    if (this.s.timeLimit) {
      this.metaMain.textContent = Math.ceil(this.s.started ? this.s.remaining : this.s.timeLimit) + 's';
    } else if (this.o.single || this.o.wordCount) {
      const done = this.wordOf.slice(0, this.s.pos).filter((w, i, arr) => w !== -1 && arr[i + 1] === -1).length;
      this.metaMain.textContent = `${Math.min(done, this.wordEls.length)}/${this.wordEls.length}`;
    } else {
      this.metaMain.textContent = Math.round(st.progress * 100) + '%';
    }
    this.metaSide.textContent = this.s.started ? `${st.wpm} wpm · ${st.accuracy}%` : 'start typing…';
    this.o.onMeta?.(st);
  }

  setFocused(f) { this.focusHint.hidden = f; }

  destroy() {
    clearInterval(this._timer);
    window.removeEventListener('resize', this._onResize);
    document.fonts?.removeEventListener('loadingdone', this._onResize);
  }
}

/* ---------- error beep (WebAudio, no assets) ---------- */
let _audioCtx;
function beep() {
  try {
    _audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    o.frequency.value = 220; o.type = 'square';
    g.gain.setValueAtTime(0.05, _audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, _audioCtx.currentTime + 0.08);
    o.connect(g).connect(_audioCtx.destination);
    o.start(); o.stop(_audioCtx.currentTime + 0.09);
  } catch { /* audio not available */ }
}

/** Formats seconds as m:ss */
function fmtTime(s) {
  s = Math.round(s);
  const m = Math.floor(s / 60);
  return m ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}
