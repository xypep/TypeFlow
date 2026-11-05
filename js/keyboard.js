/* =========================================================
   Keyboard layouts + on-screen keyboard component
   Finger codes: 0 L-pinky, 1 L-ring, 2 L-middle, 3 L-index,
                 4 R-index, 5 R-middle, 6 R-ring, 7 R-pinky, 8 thumb
   ========================================================= */
const FINGER_NAMES = ['left pinky', 'left ring', 'left middle', 'left index',
  'right index', 'right middle', 'right ring', 'right pinky', 'thumb'];

const LAYOUTS = {
  qwertz: {
    name: 'German (QWERTZ)', lang: 'de', home: ['f', 'j'],
    rows:    ['^1234567890ß´', 'qwertzuiopü+', 'asdfghjklöä#', '<yxcvbnm,.-'],
    shift:   ['°!"§$%&/()=?`', 'QWERTZUIOPÜ*', "ASDFGHJKLÖÄ'", '>YXCVBNM;:_'],
    fingers: ['0012334456777', '012334456777', '012334456777', '00123344567'],
  },
  qwerty: {
    name: 'English (QWERTY)', lang: 'en', home: ['f', 'j'],
    rows:    ['`1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./'],
    shift:   ['~!@#$%^&*()_+', 'QWERTYUIOP{}', 'ASDFGHJKL:"', 'ZXCVBNM<>?'],
    fingers: ['0012334456777', '012334456777', '01233445677', '0123344567'],
  },
};
// left-side widths of the modifier keys per row (visual offset like a real board)
const ROW_LEAD = [null, { label: 'Tab', w: 1.5 }, { label: 'Caps', w: 1.8 }, { label: 'Shift', w: 1.3, id: 'shiftL' }];
const ROW_TAIL = [{ label: '⌫', w: 1.6 }, { label: '↵', w: 1.3 }, { label: '', w: 1.0 }, { label: 'Shift', w: 2.3, id: 'shiftR' }];

/** Finds the key for a character: { row, col, shift, finger } or null. */
function findKey(layoutId, ch) {
  const L = LAYOUTS[layoutId];
  if (ch === ' ') return { row: 4, col: 0, shift: false, finger: 8 };
  for (let r = 0; r < L.rows.length; r++) {
    let c = L.rows[r].indexOf(ch);
    if (c >= 0) return { row: r, col: c, shift: false, finger: +L.fingers[r][c] };
    c = L.shift[r].indexOf(ch);
    if (c >= 0) return { row: r, col: c, shift: true, finger: +L.fingers[r][c] };
  }
  return null;
}

/** Maps a character typed on layout A to the char at the same physical position on layout B. */
function mapChar(ch, from, to) {
  if (from === to) return ch;
  const k = findKey(from, ch);
  if (!k || k.row > 3) return ch;
  const T = LAYOUTS[to];
  // QWERTZ bottom row starts with '<' which QWERTY lacks → shift column
  let col = k.col;
  if (k.row === 3) col += (from === 'qwertz' ? -1 : 1);
  const src = k.shift ? T.shift[k.row] : T.rows[k.row];
  return src[col] ?? ch;
}

class Keyboard {
  /**
   * @param {HTMLElement} el container
   * @param {object} opts { layout, fingers: bool (color by finger), heat: bool, legend: bool }
   */
  constructor(el, opts) {
    this.el = el;
    this.opts = opts;
    this.keys = new Map();   // "r:c" -> element
    this.render();
  }

  render() {
    const { layout, fingers = true, heat = false, legend = true } = this.opts;
    const L = LAYOUTS[layout];
    const kb = document.createElement('div');
    kb.className = 'kb' + (fingers ? ' fingers' : '') + (heat ? ' heat' : '');
    this.keys.clear();

    L.rows.forEach((row, r) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      if (ROW_LEAD[r]) rowEl.appendChild(this._mod(ROW_LEAD[r], r === 3 ? 0 : null));
      [...row].forEach((ch, c) => {
        const k = document.createElement('div');
        k.className = 'key';
        k.dataset.f = L.fingers[r][c];
        k.dataset.ch = ch;
        k.textContent = /[a-zäöü]/.test(ch) ? ch.toUpperCase() : ch;
        if (r === 2 && L.home.includes(ch)) k.classList.add('home');
        this.keys.set(`${r}:${c}`, k);
        rowEl.appendChild(k);
      });
      rowEl.appendChild(this._mod(ROW_TAIL[r], r === 3 ? 7 : null));
      kb.appendChild(rowEl);
    });
    const spaceRow = document.createElement('div');
    spaceRow.className = 'kb-row';
    const space = document.createElement('div');
    space.className = 'key mod';
    space.style.setProperty('--w', 6.5);
    space.dataset.f = 8;
    space.dataset.ch = ' ';
    space.textContent = 'Space';
    this.keys.set('4:0', space);
    spaceRow.appendChild(space);
    kb.appendChild(spaceRow);

    this.el.innerHTML = '';
    this.el.appendChild(kb);
    this.kb = kb;

    if (legend && fingers && !heat) {
      const lg = document.createElement('div');
      lg.className = 'kb-legend';
      lg.innerHTML = [['--f0', 'Pinky'], ['--f1', 'Ring'], ['--f2', 'Middle'], ['--f3', 'Index'], ['--f4', 'Thumb']]
        .map(([v, n]) => `<span><i style="background:var(${v})"></i>${n}</span>`).join('');
      this.el.appendChild(lg);
      this.fingerEl = document.createElement('div');
      this.fingerEl.className = 'kb-finger';
      this.el.appendChild(this.fingerEl);
    }
  }

  _mod({ label, w, id }, finger) {
    const k = document.createElement('div');
    k.className = 'key mod';
    k.style.setProperty('--w', w);
    k.textContent = label;
    if (finger !== null) k.dataset.f = finger;
    if (id) this[id] = k;
    return k;
  }

  /** Highlights the key(s) needed for the next character. */
  highlight(ch) {
    this.kb.querySelectorAll('.target').forEach(k => k.classList.remove('target'));
    if (ch == null) { if (this.fingerEl) this.fingerEl.textContent = ''; return; }
    const info = findKey(this.opts.layout, ch);
    if (!info) { if (this.fingerEl) this.fingerEl.textContent = ''; return; }
    this.keys.get(`${info.row}:${info.col}`)?.classList.add('target');
    let shiftNote = '';
    if (info.shift) {
      // Shift with the opposite hand
      const shiftKey = info.finger <= 3 ? this.shiftR : this.shiftL;
      shiftKey?.classList.add('target');
      shiftNote = ` + <b>Shift</b> (${info.finger <= 3 ? 'right' : 'left'} pinky)`;
    }
    if (this.fingerEl) {
      const label = ch === ' ' ? 'Space' : ch;
      this.fingerEl.innerHTML = `<kbd>${escapeHtml(label)}</kbd> → <b>${FINGER_NAMES[info.finger]}</b>${shiftNote}`;
    }
  }

  /** Short red flash on the key that should have been pressed. */
  flashMiss(ch) {
    const info = findKey(this.opts.layout, ch);
    if (!info) return;
    const k = this.keys.get(`${info.row}:${info.col}`);
    if (!k) return;
    k.classList.add('miss');
    setTimeout(() => k.classList.remove('miss'), 180);
  }

  /** Heatmap mode: colors keys by error rate. stats = { char: {hits, misses} } */
  applyHeat(stats, tooltip) {
    // aggregate lower/upper case on the same physical key
    const agg = new Map();
    for (const [ch, s] of Object.entries(stats)) {
      const info = findKey(this.opts.layout, ch);
      if (!info) continue;
      const id = `${info.row}:${info.col}`;
      const a = agg.get(id) || { hits: 0, misses: 0 };
      a.hits += s.hits; a.misses += s.misses;
      agg.set(id, a);
    }
    let maxRate = 0;
    for (const a of agg.values()) {
      const total = a.hits + a.misses;
      if (total >= 5) maxRate = Math.max(maxRate, a.misses / total);
    }
    for (const [id, el] of this.keys) {
      const a = agg.get(id);
      const total = a ? a.hits + a.misses : 0;
      const rate = total ? a.misses / total : 0;
      // scale relative to the worst key so differences stay visible
      const pct = maxRate && total >= 5 ? Math.round((rate / maxRate) * 85) : 0;
      el.style.background = pct ? `color-mix(in srgb, var(--accent) ${pct}%, var(--surface-2))` : '';
      el.style.color = pct > 50 ? '#fff' : '';
      el.onmouseenter = e => tooltip.show(e,
        total ? `<b>${escapeHtml(el.dataset.ch === ' ' ? 'Space' : el.textContent)}</b> · ${(rate * 100).toFixed(1)}% errors<br>${a.misses} misses / ${total} presses`
              : `<b>${escapeHtml(el.textContent)}</b> · no data yet`);
      el.onmousemove = e => tooltip.move(e);
      el.onmouseleave = () => tooltip.hide();
    }
  }
}

/** Uppercase label for a key cap — keeps 'ß' (whose uppercase would be 'SS'). */
function keyLabel(ch) { return ch === 'ß' ? ch : ch.toUpperCase(); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
