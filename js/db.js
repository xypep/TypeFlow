/* =========================================================
   Store — persistence layer
   - "folder" mode: File System Access API, JSON file in a user-chosen folder
   - "local"  mode: localStorage fallback
   The chosen folder handle is remembered in IndexedDB so the next
   start only needs one click ("Continue with <folder>").
   ========================================================= */
const DB_FILE = 'typeflow-db.json';
const LOCAL_KEY = 'typeflow-db';

const DEFAULT_SETTINGS = {
  name: '',
  theme: 'dark',            // dark | light | system
  layout: 'qwertz',         // qwertz | qwerty
  fontSize: 26,
  caret: 'line',            // line | block | underline
  smoothCaret: true,
  showKeyboardTraining: false,
  strict: false,            // must correct a wrong key before continuing
  sound: false,
  lessonAccuracy: 95,
  lessonLength: 30,         // words per lesson
  // last used session options
  mode: 'full',
  words: 25,
  time: 30,
  normalize: true,
  removeRefs: true,
  removePunct: false,
  lowercase: false,
};

function createDefaultDb() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    texts: [],      // { id, title, content, createdAt }
    sessions: [],   // see Training/Learn finish handlers
    lessons: {},    // lessonId -> { attempts, bestWpm, bestAcc, completed }
    keyStats: {},   // char -> { hits, misses }
  };
}

/** Fill missing keys so older DB files keep working after updates. */
function migrateDb(data) {
  const base = createDefaultDb();
  const db = { ...base, ...data };
  db.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  for (const k of ['texts', 'sessions']) if (!Array.isArray(db[k])) db[k] = [];
  for (const k of ['lessons', 'keyStats']) if (typeof db[k] !== 'object' || !db[k]) db[k] = {};
  return db;
}

/* ---------- tiny IndexedDB key/value helper (stores the folder handle) ---------- */
const Idb = {
  _open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('typeflow', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async get(key) {
    try {
      const db = await this._open();
      return await new Promise((res, rej) => {
        const r = db.transaction('kv').objectStore('kv').get(key);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch { return undefined; }
  },
  async set(key, value) {
    try {
      const db = await this._open();
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    } catch { /* ignore — remembering the folder is a convenience */ }
  },
};

const Store = {
  data: null,
  mode: null,          // 'folder' | 'local'
  dirHandle: null,
  fileHandle: null,
  _timer: null,
  _writing: Promise.resolve(),
  onSaveError: null,

  get supportsFolder() { return typeof window.showDirectoryPicker === 'function'; },
  get locationLabel() { return this.mode === 'folder' ? `📁 ${this.dirHandle.name}` : '💾 Browser storage'; },

  /** Opens the folder picker and loads/creates the DB file. */
  async pickFolder() {
    const dir = await window.showDirectoryPicker({ id: 'typeflow', mode: 'readwrite' });
    await this._useFolder(dir);
    await Idb.set('dirHandle', dir);
  },

  /** Returns the remembered folder handle (or null). */
  async rememberedFolder() {
    if (!this.supportsFolder) return null;
    return (await Idb.get('dirHandle')) || null;
  },

  /** Re-opens a remembered folder. Must be called from a user gesture (permission prompt). */
  async resumeFolder(dir) {
    const opts = { mode: 'readwrite' };
    let perm = await dir.queryPermission(opts);
    if (perm !== 'granted') perm = await dir.requestPermission(opts);
    if (perm !== 'granted') throw new Error('Permission to the folder was denied.');
    await this._useFolder(dir);
  },

  async _useFolder(dir) {
    const fh = await dir.getFileHandle(DB_FILE, { create: true });
    const file = await fh.getFile();
    const text = await file.text();
    let data = createDefaultDb();
    if (text.trim()) {
      try { data = JSON.parse(text); }
      catch { throw new Error(`${DB_FILE} exists but is not valid JSON.`); }
    }
    this.dirHandle = dir;
    this.fileHandle = fh;
    this.mode = 'folder';
    this.data = migrateDb(data);
    await this.saveNow();   // writes the file immediately for brand-new folders
  },

  useLocal() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { /* ignore */ }
    this.mode = 'local';
    this.dirHandle = null;
    this.fileHandle = null;
    this.data = migrateDb(data || createDefaultDb());
  },

  /** Debounced save — call after every change. */
  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.saveNow(), 400);
  },

  saveNow() {
    clearTimeout(this._timer);
    const json = JSON.stringify(this.data, null, 1);
    // chain writes so two saves never interleave on the same file
    this._writing = this._writing.then(async () => {
      try {
        if (this.mode === 'folder') {
          const w = await this.fileHandle.createWritable();
          await w.write(json);
          await w.close();
        } else {
          localStorage.setItem(LOCAL_KEY, json);
        }
      } catch (err) {
        console.error('Save failed', err);
        this.onSaveError?.(err);
      }
    });
    return this._writing;
  },

  replaceData(data) {
    this.data = migrateDb(data);
    return this.saveNow();
  },
};

/** Small id helper used across modules. */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
