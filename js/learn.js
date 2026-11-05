/* =========================================================
   Learn tab — progressive touch-typing lessons
   Lessons are defined with QWERTZ characters and mapped to the
   active layout by physical key position (see mapChar).
   ========================================================= */
const LESSONS = [
  { id: 'home-l', title: 'Home row · left hand', keys: 'asdf' },
  { id: 'home-r', title: 'Home row · right hand', keys: 'jklö' },
  { id: 'gh', title: 'Index stretch', keys: 'gh' },
  { id: 'ei', title: 'Top row · middle fingers', keys: 'ei' },
  { id: 'ru', title: 'Top row · index fingers', keys: 'ru' },
  { id: 'tz', title: 'Top row · index stretch', keys: 'tz' },
  { id: 'wo', title: 'Top row · ring fingers', keys: 'wo' },
  { id: 'qp', title: 'Top row · pinkies', keys: 'qp' },
  { id: 'nv', title: 'Bottom row · index fingers', keys: 'nv' },
  { id: 'cm', title: 'Bottom row · middle & index', keys: 'cm' },
  { id: 'bxy', title: 'Bottom row · the rest', keys: 'bxy' },
  { id: 'umlaut', title: 'Umlauts & ß', keys: 'äüß', only: 'qwertz' },
  { id: 'punct', title: 'Punctuation', keys: ',.-', punct: true, noMap: true },
  { id: 'caps', title: 'Capital letters (Shift)', keys: '', caps: true },
  { id: 'numbers', title: 'Number row', keys: '1234567890', numbers: true },
  { id: 'words', title: 'Real words', keys: '', real: true },
];

const Learn = {
  session: null, view: null, keyboard: null, current: null,
  el: id => document.getElementById(id),

  init() {
    this.el('btn-learn-back').onclick = () => this.showList();
        this.el('learn-panel').onclick = e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'restart') this.startLesson(this.current);
      if (act === 'stop') this.showList();
    };
    this.showList();
  },

  get layout() { return Store.data.settings.layout; },
  lessons() { return LESSONS.filter(l => !l.only || l.only === this.layout); },
  mapKeys(keys, lesson) { return lesson?.noMap ? [...keys] : [...keys].map(c => mapChar(c, 'qwertz', this.layout)); },

  /** All letters allowed up to (and including) lesson index i. */
  allowedUpTo(i) {
    const set = new Set();
    this.lessons().slice(0, i + 1).forEach(l => this.mapKeys(l.keys, l).forEach(c => set.add(c)));
    return set;
  },

  /* ---------- lesson list ---------- */
  showList() {
    this.cleanup();
    this.el('learn-list').hidden = false;
    this.el('learn-run').hidden = true;
    this.el('learn-result').hidden = true;
    const L = LAYOUTS[this.layout];
    this.el('home-l').textContent = L.home[0].toUpperCase();
    this.el('home-r').textContent = L.home[1].toUpperCase();
    const prog = Store.data.lessons;
    const list = this.lessons();
    const done = list.filter(l => prog[l.id]?.completed).length;
    this.el('learn-progress').textContent = `${done}/${list.length} completed`;

    this.el('lesson-grid').innerHTML = list.map((l, i) => {
      const p = prog[l.id];
      const keys = l.caps ? ['⇧', 'A–Z'] : l.real ? ['Aa', '.,'] : this.mapKeys(l.keys, l).map(keyLabel);
      return `<button class="lesson${p?.completed ? ' completed' : ''}" data-i="${i}">
        <div class="n"><span>Lesson ${i + 1}</span>${p?.completed ? '<span class="done">✓ done</span>' : ''}</div>
        <div class="t">${escapeHtml(l.title)}</div>
        <div class="keys">${keys.map(k => `<kbd>${escapeHtml(k)}</kbd>`).join('')}</div>
        <div class="best">${p ? `best ${p.bestWpm} wpm · ${p.bestAcc}%` : 'not started'}</div>
      </button>`;
    }).join('');
    this.el('lesson-grid').onclick = e => {
      const b = e.target.closest('.lesson'); if (b) this.startLesson(+b.dataset.i);
    };

    // next suggested lesson in the panel
    const nextIdx = Math.max(0, list.findIndex(l => !prog[l.id]?.completed));
    const totalSessions = Store.data.sessions.filter(s => s.kind === 'lesson').length;
    this.el('learn-panel').innerHTML = `
      <h2>Your path</h2>
      <div class="panel-section">
        <div class="live-grid">
          <div class="live-tile"><div class="v accent">${done}</div><div class="k">Lessons done</div></div>
          <div class="live-tile"><div class="v">${totalSessions}</div><div class="k">Attempts</div></div>
        </div>
        <div class="progress"><div style="width:${(done / list.length) * 100}%"></div></div>
      </div>
      <div class="panel-section">
        <span class="label">Up next</span>
        <p><b>Lesson ${nextIdx + 1}: ${escapeHtml(list[nextIdx].title)}</b></p>
        <button class="btn btn-primary btn-block" id="btn-next-lesson">Start lesson ${nextIdx + 1}</button>
      </div>
      <div class="panel-section">
        <span class="label">Tips</span>
        <p>Don't look at your keyboard — use the one on screen.</p>
        <p>Accuracy first, speed follows. Goal: ${Store.data.settings.lessonAccuracy}%.</p>
        <p>Return to the home row after every key.</p>
      </div>`;
    this.el('btn-next-lesson').onclick = () => this.startLesson(nextIdx);
  },

  /* ---------- exercise generation ---------- */
  generate(i) {
    const lesson = this.lessons()[i];
    const S = Store.data.settings;
    const lang = LAYOUTS[this.layout].lang;
    const count = S.lessonLength;
    const allowed = this.allowedUpTo(i);
    const letters = [...allowed].filter(c => /\p{L}/u.test(c) || c === ';');
    const focus = this.mapKeys(lesson.keys, lesson).filter(c => /\p{L}/u.test(c) || c === ';');
    const pick = a => a[Math.floor(Math.random() * a.length)];

    const fits = w => [...w].every(c => allowed.has(c));
    const wordsAll = WORDS[lang];
    const words = wordsAll.filter(fits);
    const focusWords = focus.length ? words.filter(w => focus.some(c => w.includes(c))) : [];

    // nonsense "drill" words, weighted towards the new keys
    const pseudo = () => {
      const len = 2 + Math.floor(Math.random() * 4);
      let w = '';
      for (let k = 0; k < len; k++) w += (focus.length && Math.random() < 0.5) ? pick(focus) : pick(letters);
      return w;
    };

    const out = [];
    const used = new Map();
    const pickFresh = pool => {
      for (let tries = 0; tries < 8; tries++) {
        const w = pick(pool);
        if ((used.get(w) || 0) < 2) { used.set(w, (used.get(w) || 0) + 1); return w; }
      }
      return pseudo();
    };
    // first lessons start with simple repetition drills, e.g. "fff jjj fj"
    if (focus.length && i < 11) focus.forEach(c => out.push(c.repeat(3)));
    while (out.length < count) {
      const r = Math.random();
      if (lesson.real) out.push(pickFresh(wordsAll));
      else if (focusWords.length && r < 0.45) out.push(pickFresh(focusWords));
      else if (words.length > 8 && r < 0.75) out.push(pickFresh(words));
      else out.push(pseudo());
    }
    let tokens = out.slice(0, count);

    if (lesson.caps || lesson.real) {
      tokens = tokens.map((w, k) => (k === 0 || Math.random() < (lesson.caps ? 0.5 : 0.15)) ? w[0].toUpperCase() + w.slice(1) : w);
    }
    if (lesson.numbers) {
      tokens = tokens.map(w => Math.random() < 0.45 ? String(Math.floor(Math.random() * (Math.random() < .5 ? 100 : 10000))) : w);
    }
    const punct = [',', '.', '-'];
    if (lesson.punct || lesson.real || this.lessons().indexOf(LESSONS.find(l => l.id === 'punct')) < i) {
      tokens = tokens.map((w, k) => {
        if (k === tokens.length - 1) return w + punct[1];
        const r = Math.random();
        return r < 0.12 ? w + punct[0] : r < 0.2 ? w + punct[1] : (r < 0.24 && lesson.punct) ? w + punct[2] + pick(words.length ? words : [w]) : w;
      });
    }
    return tokens.join(' ');
  },

  /* ---------- running a lesson ---------- */
  startLesson(i) {
    this.cleanup();
    this.current = i;
    const lesson = this.lessons()[i];
    const S = Store.data.settings;
    this.el('learn-list').hidden = true;
    this.el('learn-result').hidden = true;
    this.el('learn-run').hidden = false;
    this.el('learn-title').textContent = `Lesson ${i + 1}: ${lesson.title}`;

    this.keyboard = new Keyboard(this.el('learn-keyboard'), { layout: this.layout });
    this.session = new TypingSession({ text: this.generate(i), strict: S.strict });
    const panel = this.el('learn-panel');
    const newKeys = lesson.caps ? ['Shift'] : this.mapKeys(lesson.keys, lesson);
    panel.innerHTML = `
      <div class="panel-section">
        <span class="label">New keys</span>
        <div class="missed">${newKeys.length ? newKeys.map(k => `<kbd>${escapeHtml(keyLabel(k))}</kbd>`).join('') : '<span class="hint" style="margin:0">Review — all keys so far</span>'}</div>
        <p class="hint">Goal: ≥ ${S.lessonAccuracy}% accuracy</p>
      </div>
      ${SessionUI.liveHtml('Live')}`;
    this.view = new TypingView(this.el('learn-typing'), this.session, {
      keyboard: this.keyboard, sound: S.sound, wordCount: true,
      onMeta: st => SessionUI.updateLive(panel, st, this.session),
    });
    this.session.on('finish', st => this.finish(st));
    App.activate({ view: this.view, session: this.session, onTab: () => this.startLesson(i), onEscape: () => this.showList() });
  },

  finish(stats) {
    App.deactivate();
    const lesson = this.lessons()[this.current];
    const S = Store.data.settings;
    const passed = stats.accuracy >= S.lessonAccuracy;
    App.recordSession(this.session, { kind: 'lesson', mode: 'lesson', lessonId: lesson.id, textTitle: lesson.title });

    const p = (Store.data.lessons[lesson.id] ||= { attempts: 0, bestWpm: 0, bestAcc: 0, completed: false });
    p.attempts++;
    p.bestWpm = Math.max(p.bestWpm, stats.wpm);
    p.bestAcc = Math.max(p.bestAcc, stats.accuracy);
    if (passed) p.completed = true;
    Store.save();

    this.el('learn-run').hidden = true;
    const res = this.el('learn-result');
    res.hidden = false;
    const hasNext = this.current < this.lessons().length - 1;
    SessionUI.renderResult(res, {
      stats, session: this.session,
      heading: `Lesson ${this.current + 1}: ${lesson.title}`,
      badge: passed ? `<span class="badge pass">✓ Passed</span>` : `<span class="badge fail">✗ Below ${S.lessonAccuracy}% — try again</span>`,
      buttons: (passed && hasNext ? `<button class="btn btn-primary" data-r="next">Next lesson →</button>` : '')
        + `<button class="btn ${passed && hasNext ? 'btn-ghost' : 'btn-primary'}" data-r="again">Repeat</button>`
        + `<button class="btn btn-ghost" data-r="list">All lessons</button>`,
    });
    res.onclick = e => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (r === 'next') this.startLesson(this.current + 1);
      if (r === 'again') this.startLesson(this.current);
      if (r === 'list') this.showList();
    };
    App.resultKeys = { onTab: () => this.startLesson(this.current) };

    this.el('learn-panel').innerHTML = `
      <h2>${passed ? 'Well done!' : 'Keep going'}</h2>
      <div class="live-grid">
        <div class="live-tile"><div class="v accent">${stats.wpm}</div><div class="k">WPM</div></div>
        <div class="live-tile"><div class="v">${stats.accuracy}%</div><div class="k">Accuracy</div></div>
        <div class="live-tile"><div class="v">${p.bestWpm}</div><div class="k">Best WPM</div></div>
        <div class="live-tile"><div class="v">${p.attempts}</div><div class="k">Attempts</div></div>
      </div>
      <p class="hint">${passed ? 'Lesson completed. Repeat it any time to push your speed.' : `Slow down a little — accuracy builds muscle memory.`}</p>`;
  },

  cleanup() {
    App.deactivate();
    App.resultKeys = null;
    this.view?.destroy();
    this.view = this.session = null;
  },

  refresh() { if (!this.session) this.showList(); },
};
