/* =========================================================
   App — login, routing, keyboard input routing, shared helpers
   ========================================================= */
const App = {
  route: 'start',
  active: null,        // { session, view, onTab, onEscape } while typing
  resultKeys: null,    // { onTab } while a result screen is shown
  _modulesReady: false,

  /* ---------- boot & login ---------- */
  async boot() {
    // until a DB is loaded, follow the system theme
    if (!Store.data) document.documentElement.dataset.themeResolved = 'dark';
    const msg = document.getElementById('login-msg');
    const btnFolder = document.getElementById('btn-folder');
    const btnResume = document.getElementById('btn-resume');
    const btnLocal = document.getElementById('btn-local');

    if (!Store.supportsFolder) {
      btnFolder.disabled = true;
      msg.textContent = 'This browser cannot open folders (use Chrome or Edge). Browser storage still works.';
    }
    const remembered = await Store.rememberedFolder();
    if (remembered) {
      btnResume.hidden = false;
      btnResume.textContent = `Continue with “${remembered.name}”`;
      btnFolder.className = 'btn btn-ghost';
      btnFolder.textContent = 'Choose another folder';
    }

    const run = async fn => {
      msg.textContent = '';
      try { await fn(); this.enter(); }
      catch (err) {
        if (err.name === 'AbortError') return;          // user closed the picker
        console.error(err);
        msg.textContent = err.name === 'SecurityError'
          ? 'Folder access is blocked here (embedded page). Open the file directly in Chrome/Edge, or use browser storage.'
          : err.message;
      }
    };
    btnResume.onclick = () => run(() => Store.resumeFolder(remembered));
    btnFolder.onclick = () => run(() => Store.pickFolder());
    btnLocal.onclick = () => run(async () => Store.useLocal());
    Store.onSaveError = () => this.toast('⚠ Could not save to the folder — check permissions');
  },

  enter() {
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
    document.getElementById('nav-storage').textContent = Store.locationLabel;
    document.getElementById('nav-storage').onclick = () => this.logout();
    this.applySettings();

    if (!this._modulesReady) {
      this._modulesReady = true;
      Training.init(); Learn.init(); Stats.init(); Settings.init();
      this.initInput();
      window.addEventListener('hashchange', () => this.go(location.hash.slice(1)));
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applySettings());
    } else {
      this.reloadModules();
    }
    this.go(location.hash.slice(1) || 'start');
  },

  /** Back to the login screen (switch folder / storage). */
  async logout() {
    this.deactivate();
    await Store.saveNow();
    document.getElementById('app').hidden = true;
    document.getElementById('login').hidden = false;
    this.boot();
  },

  /** Rebuild module UIs after the data source changed (import, folder switch). */
  reloadModules() {
    this.applySettings();
    Training.cleanupSession(); Training.showState('idle');
    Training.init(); Learn.init(); Settings.render();
    if (this.route === 'stats') Stats.render();
  },

  /* ---------- routing ---------- */
  go(route) {
    if (!['start', 'learn', 'stats', 'settings'].includes(route)) route = 'start';
    // leaving a page cancels a running session there
    if (this.route !== route && this.active) {
      if (this.route === 'start') Training.stop();
      if (this.route === 'learn') Learn.showList();
    }
    this.route = route;
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.dataset.page === route));
    document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    if (route === 'stats') Stats.render();
    if (route === 'settings') Settings.render();
    if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route);
  },

  /* ---------- settings → DOM ---------- */
  applySettings() {
    const S = Store.data.settings;
    const root = document.documentElement;
    const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = S.theme === 'system' ? '' : S.theme;
    root.dataset.themeResolved = dark ? 'dark' : 'light';
    root.style.setProperty('--type-size', S.fontSize + 'px');
  },

  /* ---------- keyboard input ---------- */
  initInput() {
    const sink = document.getElementById('key-sink');
    this.sink = sink;

    sink.addEventListener('input', e => {
      const a = this.active;
      const text = e.data ?? sink.value;
      sink.value = '';
      if (!a || e.inputType === 'insertLineBreak' || !text) return;
      for (const ch of text) a.session.input(ch === '\n' ? ' ' : ch);
    });

    sink.addEventListener('keydown', e => {
      const a = this.active;
      if (!a) return;
      if (e.key === 'Backspace') { e.preventDefault(); a.session.backspace(e.ctrlKey || e.altKey || e.metaKey); }
      else if (e.key === 'Tab') { e.preventDefault(); a.onTab?.(); }
      else if (e.key === 'Escape') { e.preventDefault(); a.onEscape?.(); }
      else if (e.key === 'Enter') { e.preventDefault(); }
    });
    sink.addEventListener('focus', () => this.active?.view.setFocused(true));
    sink.addEventListener('blur', () => this.active?.view.setFocused(false));

    // typing anywhere (outside form fields) re-focuses the sink; Tab on a result restarts
    document.addEventListener('keydown', e => {
      const inField = e.target.closest?.('input, textarea, select, [contenteditable]') && e.target !== sink;
      if (inField) return;
      if (this.active && e.target !== sink && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'Escape') { this.active.onEscape?.(); return; }
        if (e.key === 'Tab') { e.preventDefault(); this.active.onTab?.(); return; }
        this.focusSink();
      } else if (!this.active && this.resultKeys && e.key === 'Tab') {
        e.preventDefault();
        this.resultKeys.onTab();
      }
    });
  },

  focusSink() { this.sink?.focus({ preventScroll: true }); },

  /** Makes a session receive keyboard input. */
  activate(a) {
    this.active = a;
    this.resultKeys = null;
    this.sink.value = '';
    this.focusSink();
    a.view.setFocused(document.activeElement === this.sink);
  },

  deactivate() {
    this.active = null;
    if (document.activeElement === this.sink) this.sink.blur();
  },

  /* ---------- persistence of finished sessions ---------- */
  recordSession(session, extra) {
    const st = session.stats();
    Store.data.sessions.push({
      id: uid(),
      date: new Date().toISOString(),
      ...extra,
      wpm: st.wpm, raw: st.raw, accuracy: st.accuracy, errors: st.errors,
      correctChars: st.correctChars, incorrectChars: st.incorrectChars,
      keystrokes: st.keystrokes, seconds: st.seconds,
      samples: session.samples.map(s => s.wpm),
    });
    const ks = Store.data.keyStats;
    for (const [ch, s] of Object.entries(session.keyStats)) {
      const t = (ks[ch] ||= { hits: 0, misses: 0 });
      t.hits += s.hits; t.misses += s.misses;
    }
    Store.save();
  },

  /* ---------- toast ---------- */
  toast(text) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'tooltip';
      t.style.cssText = 'left:50%;bottom:24px;top:auto;transform:translateX(-50%);font-size:14px;padding:10px 16px';
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.hidden = true; }, 2600);
  },
};

App.boot();
