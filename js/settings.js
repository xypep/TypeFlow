/* =========================================================
   Settings tab — profile, appearance, typing, lessons, data
   Built from a declarative list so adding a setting is one line.
   ========================================================= */
const SETTINGS_SCHEMA = [
  { section: 'Profile', desc: 'Shown on your stats', items: [
    { key: 'name', label: 'Name', type: 'text', placeholder: 'Your name' },
  ]},
  { section: 'Appearance', desc: 'Look & feel', items: [
    { key: 'theme', label: 'Theme', type: 'seg', options: [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']] },
    { key: 'fontSize', label: 'Text size', hint: 'Typing area font size', type: 'range', min: 18, max: 40, step: 1, unit: 'px' },
    { key: 'caret', label: 'Caret style', type: 'seg', options: [['line', 'Line'], ['block', 'Block'], ['underline', 'Underline']] },
    { key: 'smoothCaret', label: 'Smooth caret', hint: 'Animate the caret between letters', type: 'switch' },
  ]},
  { section: 'Typing', desc: 'Behaviour during sessions', items: [
    { key: 'layout', label: 'Keyboard layout', hint: 'Used for lessons, on-screen keyboard and heatmap', type: 'seg', options: [['qwertz', 'QWERTZ (DE)'], ['qwerty', 'QWERTY (US)']] },
    { key: 'strict', label: 'Strict mode', hint: 'Wrong keys are not accepted — you must hit the right one', type: 'switch' },
    { key: 'showKeyboardTraining', label: 'Keyboard in training', hint: 'Show the on-screen keyboard on the Start tab too', type: 'switch' },
    { key: 'sound', label: 'Error sound', hint: 'Short beep on a wrong key', type: 'switch' },
  ]},
  { section: 'Lessons', desc: 'Learn tab', items: [
    { key: 'lessonAccuracy', label: 'Accuracy goal', hint: 'Needed to complete a lesson', type: 'range', min: 80, max: 100, step: 1, unit: '%' },
    { key: 'lessonLength', label: 'Lesson length', hint: 'Words per lesson', type: 'range', min: 10, max: 80, step: 5, unit: ' words' },
  ]},
];

const Settings = {
  init() { this.render(); },

  render() {
    const S = Store.data.settings;
    const body = document.getElementById('settings-body');
    const rows = SETTINGS_SCHEMA.map(sec => `
      <div class="set-section">
        <h3>${sec.section}<small>${sec.desc}</small></h3>
        <div>${sec.items.map(it => `
          <div class="set-row">
            <span>${it.label}${it.hint ? `<small>${it.hint}</small>` : ''}</span>
            ${this.control(it, S[it.key])}
          </div>`).join('')}
        </div>
      </div>`).join('');

    body.innerHTML = `
      <div class="main-head"><h1>Settings</h1></div>
      ${rows}
      <div class="set-section">
        <h3>Data<small>Where your progress is stored</small></h3>
        <div>
          <div class="set-row"><span>Storage<small>${escapeHtml(Store.mode === 'folder' ? `Folder “${Store.dirHandle.name}” → ${DB_FILE}` : 'Browser storage (localStorage)')}</small></span>
            <button class="btn btn-ghost btn-sm" data-act="switch">Switch storage…</button></div>
          <div class="set-row"><span>Export<small>Download the whole database as JSON</small></span>
            <button class="btn btn-ghost btn-sm" data-act="export">Export JSON</button></div>
          <div class="set-row"><span>Import<small>Replace current data with a JSON export</small></span>
            <button class="btn btn-ghost btn-sm" data-act="import">Import JSON</button></div>
          <div class="set-row"><span>Reset statistics<small>Deletes sessions, lesson progress and key stats. Settings and texts stay.</small></span>
            <button class="btn btn-danger btn-sm" data-act="reset">Reset…</button></div>
        </div>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>`;

    body.oninput = body.onchange = e => this.onChange(e);
    body.onclick = e => this.onClick(e);
    document.getElementById('import-file').onchange = e => this.importFile(e.target.files[0]);
  },

  control(it, v) {
    const k = it.key;
    switch (it.type) {
      case 'text':
        return `<input class="input" data-key="${k}" value="${escapeHtml(v)}" placeholder="${it.placeholder || ''}">`;
      case 'switch':
        return `<label class="switch"><input type="checkbox" data-key="${k}" ${v ? 'checked' : ''}><span></span></label>`;
      case 'range':
        return `<span style="display:flex;align-items:center;gap:10px"><input type="range" data-key="${k}" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}">
          <output class="muted" style="min-width:70px;font-family:var(--font-mono)">${v}${it.unit}</output></span>`;
      case 'seg':
        return `<div class="seg seg-sm" data-seg="${k}">${it.options.map(([val, lbl]) =>
          `<button data-v="${val}" class="${val === v ? 'on' : ''}">${lbl}</button>`).join('')}</div>`;
    }
    return '';
  },

  onChange(e) {
    const t = e.target;
    const key = t.dataset?.key;
    if (!key) return;
    const it = SETTINGS_SCHEMA.flatMap(s => s.items).find(i => i.key === key);
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if (it.type === 'range') {
      v = +v;
      t.nextElementSibling.textContent = v + it.unit;
    }
    this.set(key, v);
  },

  onClick(e) {
    const seg = e.target.closest('[data-seg] button');
    if (seg) {
      const wrap = seg.parentElement;
      wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === seg));
      this.set(wrap.dataset.seg, seg.dataset.v);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'switch') App.logout();
    if (act === 'export') this.exportJson();
    if (act === 'import') document.getElementById('import-file').click();
    if (act === 'reset' && confirm('Delete all sessions, lesson progress and key statistics?')) {
      Object.assign(Store.data, { sessions: [], lessons: {}, keyStats: {} });
      Store.save();
      App.toast('Statistics reset');
    }
  },

  set(key, v) {
    Store.data.settings[key] = v;
    Store.save();
    App.applySettings();
    if (key === 'layout') { Learn.refresh(); }
  },

  exportJson() {
    const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `typeflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  async importFile(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (typeof data !== 'object' || !data.settings) throw new Error('Not a TypeFlow export');
      if (!confirm('Replace all current data with this file?')) return;
      await Store.replaceData(data);
      App.reloadModules();
      App.toast('Data imported');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  },
};
