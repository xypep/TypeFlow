/* =========================================================
   Start tab — paste text, choose mode, type, see results
   Also contains SessionUI (live panel + result view) shared with Learn.
   ========================================================= */
const MODE_DESC = {
  full: 'Type the whole text from start to finish.',
  random: 'Random words picked from your text.',
  single: 'One word at a time — big and focused.',
  time: 'Type as much as you can before the time runs out.',
};
const MODE_NAMES = { full: 'Full text', random: 'Random words', single: 'Single words', time: 'Time', lesson: 'Lesson' };

const SessionUI = {
  /** Live stats markup for the dark panel. */
  liveHtml(title) {
    return `
      <h2>${escapeHtml(title)}</h2>
      <div class="live-grid">
        <div class="live-tile"><div class="v accent" data-live="wpm">0</div><div class="k">WPM</div></div>
        <div class="live-tile"><div class="v" data-live="acc">100%</div><div class="k">Accuracy</div></div>
        <div class="live-tile"><div class="v" data-live="time">0s</div><div class="k" data-live="timeLabel">Time</div></div>
        <div class="live-tile"><div class="v" data-live="err">0</div><div class="k">Errors</div></div>
        <div class="live-tile wide"><div class="k">Progress</div><div class="progress"><div data-live="prog"></div></div></div>
      </div>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn btn-ghost" data-act="restart" style="flex:1">Restart <kbd>Tab</kbd></button>
        <button class="btn btn-ghost" data-act="stop" style="flex:1">Stop <kbd>Esc</kbd></button>
      </div>`;
  },

  updateLive(panel, st, session) {
    const q = k => panel.querySelector(`[data-live="${k}"]`);
    if (!q('wpm')) return;
    q('wpm').textContent = st.wpm;
    q('acc').textContent = st.accuracy + '%';
    q('err').textContent = st.errors;
    if (session.timeLimit) {
      q('time').textContent = Math.ceil(session.started ? session.remaining : session.timeLimit) + 's';
      q('timeLabel').textContent = 'Remaining';
    } else {
      q('time').textContent = fmtTime(st.seconds);
    }
    q('prog').style.width = (st.progress * 100).toFixed(1) + '%';
  },

  /** Result screen in the main area. */
  renderResult(el, { stats, session, heading, badge = '', buttons = '' }) {
    const missed = session.missedKeys();
    el.innerHTML = `
      <div class="main-head"><h1>${escapeHtml(heading)}</h1>${badge}</div>
      <div class="result-hero">
        <div class="hero-num"><div class="v">${stats.wpm}</div><div class="k">WPM</div></div>
        <div class="hero-num sm"><div class="v">${stats.accuracy}%</div><div class="k">Accuracy</div></div>
        <div class="hero-num sm"><div class="v">${stats.raw}</div><div class="k">Raw WPM</div></div>
      </div>
      <div class="result-grid">
        <div class="stat-tile"><div class="v">${fmtTime(stats.seconds)}</div><div class="k">Time</div></div>
        <div class="stat-tile"><div class="v">${stats.correctChars}<span class="muted">/${stats.incorrectChars}</span></div><div class="k">Correct / wrong chars</div></div>
        <div class="stat-tile"><div class="v">${stats.errors}</div><div class="k">Wrong key presses</div></div>
        <div class="stat-tile"><div class="v">${stats.keystrokes}</div><div class="k">Keystrokes</div></div>
      </div>
      <div class="chart-box" style="margin-bottom:20px">
        <h3>Speed over time <small>WPM per second · red dots = errors</small></h3>
        <div data-chart></div>
      </div>
      <h3>Most missed keys</h3>
      <div class="missed" style="margin-bottom:24px">${missed.length
        ? missed.map(([ch, s]) => `<span><kbd>${ch === ' ' ? '␣' : escapeHtml(ch)}</kbd><small>${s.misses}×</small></span>`).join('')
        : '<span class="muted">None — flawless! 🎉</span>'}</div>
      <div class="btn-row">${buttons}</div>`;
    const pts = session.samples.map(s => ({ x: s.t, y: s.wpm, label: s.t + 's', marks: s.err }));
    lineChart(el.querySelector('[data-chart]'), pts, {
      height: 180, yMin: 0, aria: 'Words per minute over time',
      tip: p => `<b>${p.y} wpm</b> at ${p.label}${p.marks ? `<br>${p.marks} error${p.marks > 1 ? 's' : ''}` : ''}`,
    });
  },
};

const Training = {
  state: 'idle',       // idle | running | result
  session: null,
  view: null,
  keyboard: null,
  lastConfig: null,

  el: id => document.getElementById(id),

  init() {
    const S = Store.data.settings;
    this.src = this.el('source-text');
    this.src.oninput = () => this.updateTextInfo();

    this._seg('mode-seg', 'mode', S.mode, v => { S.mode = v; this.syncModeUi(); });
    this._seg('words-seg', 'v', String(S.words), v => { S.words = +v; });
    this._seg('time-seg', 'v', String(S.time), v => { S.time = +v; });
    const checks = { 'opt-normalize': 'normalize', 'opt-refs': 'removeRefs', 'opt-punct': 'removePunct', 'opt-lower': 'lowercase' };
    for (const [id, key] of Object.entries(checks)) {
      const cb = this.el(id);
      cb.checked = S[key];
      cb.onchange = () => { S[key] = cb.checked; Store.save(); this.updateTextInfo(); };
    }
    this.el('btn-start').onclick = () => this.start();
    this.el('train-panel-live').onclick = e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'restart') this.restart();
      if (act === 'stop') this.stop();
    };
    this.syncModeUi();
    this.renderSaved();
    this.updateTextInfo();
  },

  /** Wires a segmented control; persists the choice in settings. */
  _seg(id, attr, current, onPick) {
    const seg = this.el(id);
    const set = v => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset[attr] === v));
    set(current);
    seg.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      set(b.dataset[attr]); onPick(b.dataset[attr]); Store.save();
    };
  },

  syncModeUi() {
    const m = Store.data.settings.mode;
    this.el('mode-desc').textContent = MODE_DESC[m];
    this.el('opt-words').hidden = !(m === 'random' || m === 'single');
    this.el('opt-time').hidden = m !== 'time';
  },

  cleanOpts() {
    const S = Store.data.settings;
    return { normalize: S.normalize, removeRefs: S.removeRefs, removePunct: S.removePunct, lowercase: S.lowercase };
  },

  updateTextInfo() {
    const raw = this.src.value.trim();
    const btn = this.el('btn-start');
    if (!raw) {
      this.el('text-info').textContent = '';
      btn.textContent = 'Start with sample text';
      return;
    }
    const clean = TextPrep.clean(raw, this.cleanOpts());
    const words = TextPrep.words(clean).length;
    this.el('text-info').textContent = `${words} words · ${clean.length} characters`;
    btn.textContent = 'Start';
  },

  /* ---------- saved texts ---------- */
  renderSaved() {
    const box = this.el('saved-texts');
    const texts = Store.data.texts;
    const chips = [`<button class="chip" data-sample><span>✨ Sample text</span></button>`];
    for (const t of texts.slice().reverse()) {
      chips.push(`<span class="chip" data-id="${t.id}" title="${escapeHtml(t.content.slice(0, 200))}">
        <span>${escapeHtml(t.title)}</span><button class="x" data-del="${t.id}" aria-label="Delete">×</button></span>`);
    }
    box.innerHTML = chips.join('');
    box.onclick = e => {
      const del = e.target.closest('[data-del]');
      if (del) {
        Store.data.texts = Store.data.texts.filter(t => t.id !== del.dataset.del);
        Store.save(); this.renderSaved(); return;
      }
      const chip = e.target.closest('.chip'); if (!chip) return;
      this.src.value = chip.hasAttribute('data-sample') ? SAMPLE_TEXT : (Store.data.texts.find(t => t.id === chip.dataset.id)?.content || '');
      this.updateTextInfo();
    };
  },

  saveText(raw) {
    if (raw === SAMPLE_TEXT || Store.data.texts.some(t => t.content === raw)) return;
    const title = raw.replace(/\s+/g, ' ').split(' ').slice(0, 6).join(' ').slice(0, 48) + '…';
    Store.data.texts.push({ id: uid(), title, content: raw, createdAt: new Date().toISOString() });
    if (Store.data.texts.length > 30) Store.data.texts.shift();
    this.renderSaved();
  },

  /* ---------- session lifecycle ---------- */
  buildConfig() {
    const S = Store.data.settings;
    const raw = this.src.value.trim() || SAMPLE_TEXT;
    if (!this.src.value.trim()) { this.src.value = SAMPLE_TEXT; this.updateTextInfo(); }
    const clean = TextPrep.clean(raw, this.cleanOpts());
    const words = TextPrep.words(clean);
    const mode = S.mode;
    const cfg = { mode, raw, title: raw.slice(0, 48), timeLimit: 0, moreText: null, single: false };
    if (mode === 'full') cfg.text = clean;
    if (mode === 'random') cfg.text = TextPrep.randomWords(words, S.words).join(' ');
    if (mode === 'single') { cfg.text = TextPrep.randomWords(words, S.words).join(' '); cfg.single = true; }
    if (mode === 'time') {
      cfg.timeLimit = S.time;
      cfg.text = TextPrep.randomWords(words, 60).join(' ');
      cfg.moreText = () => TextPrep.randomWords(words, 30).join(' ');
    }
    cfg.wordCount = mode === 'random' || mode === 'single';
    return cfg;
  },

  start(reuse = false) {
    if (!reuse || !this.lastConfig) {
      this.lastConfig = this.buildConfig();
      this.saveText(this.lastConfig.raw);
      Store.save();
    }
    const cfg = this.lastConfig;
    const S = Store.data.settings;
    this.cleanupSession();
    this.session = new TypingSession({ text: cfg.text, timeLimit: cfg.timeLimit, strict: S.strict, moreText: cfg.moreText });

    this.showState('running');
    const kbEl = this.el('train-keyboard');
    kbEl.hidden = !S.showKeyboardTraining || cfg.single;
    this.keyboard = kbEl.hidden ? null : new Keyboard(kbEl, { layout: S.layout });

    const live = this.el('train-panel-live');
    live.innerHTML = SessionUI.liveHtml(MODE_NAMES[cfg.mode]);
    this.view = new TypingView(this.el('train-typing'), this.session, {
      single: cfg.single, wordCount: cfg.wordCount, keyboard: this.keyboard, sound: S.sound,
      onMeta: st => SessionUI.updateLive(live, st, this.session),
    });
    this.session.on('finish', st => this.finish(st));
    App.activate({ view: this.view, session: this.session, onTab: () => this.restart(), onEscape: () => this.stop() });
  },

  /** Restart: same mode, freshly generated words (full text stays the same). */
  restart() {
    if (this.lastConfig && this.lastConfig.mode !== 'full') this.lastConfig = this.buildConfig();
    this.start(true);
  },

  stop() {
    this.cleanupSession();
    this.lastResult = false;
    this.showState('idle');
  },

  finish(stats) {
    App.deactivate();
    const cfg = this.lastConfig;
    // ignore accidental sessions (nothing typed)
    if (stats.typedChars < 2) { this.showState('idle'); return; }
    App.recordSession(this.session, { kind: 'training', mode: cfg.mode, textTitle: cfg.title, timeLimit: cfg.timeLimit });
    this.lastResult = true;
    this.showState('result');
    const res = this.el('train-result');
    SessionUI.renderResult(res, {
      stats, session: this.session,
      heading: `${MODE_NAMES[cfg.mode]} — result`,
      buttons: `<button class="btn btn-primary" data-r="again">Again <kbd>Tab</kbd></button>
                <button class="btn btn-ghost" data-r="new">New text</button>`,
    });
    res.onclick = e => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (r === 'again') this.restart();
      if (r === 'new') { this.lastResult = false; this.showState('idle'); this.src.focus(); }
    };
    App.resultKeys = { onTab: () => this.restart() };
  },

  cleanupSession() {
    App.deactivate();
    this.view?.destroy();
    this.view = null;
    this.session = null;
  },

  showState(state) {
    this.state = state;
    this.el('train-idle').hidden = state !== 'idle';
    this.el('train-run').hidden = state !== 'running';
    this.el('train-result').hidden = state !== 'result';
    this.el('train-panel-settings').hidden = state === 'running';
    this.el('train-panel-live').hidden = state !== 'running';
    if (state !== 'result') App.resultKeys = null;
  },

  /** Called when settings change (layout, font…) */
  refresh() {
    this.syncModeUi();
    this.renderSaved();
  },
};
