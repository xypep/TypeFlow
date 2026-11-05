const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const run = load(['words.js']);
const TextPrep = run('TextPrep');
const opts = (o = {}) => ({ normalize: false, removeRefs: false, removePunct: false, lowercase: false, ...o });

test('collapses line breaks and repeated whitespace', () => {
  assert.equal(TextPrep.clean('  Hallo\n\nWelt\t  !  ', opts()), 'Hallo Welt !');
});

test('removes Wikipedia-style references', () => {
  const raw = 'Berlin ist die Hauptstadt.[1] Sie hat viele Einwohner[23][citation needed].';
  assert.equal(TextPrep.clean(raw, opts({ removeRefs: true })), 'Berlin ist die Hauptstadt. Sie hat viele Einwohner.');
});

test('normalizes typographic quotes, dashes and ellipsis', () => {
  const raw = '„Hallo“ – sagte er… ‚gut‘';
  assert.equal(TextPrep.clean(raw, opts({ normalize: true })), '"Hallo" - sagte er... \'gut\'');
});

test('removes punctuation but keeps letters, umlauts, digits, apostrophes and hyphens', () => {
  assert.equal(TextPrep.clean('Grüße, Welt! 3x E-Mail; don\'t?', opts({ removePunct: true })), 'Grüße Welt 3x E-Mail don\'t');
});

test('lowercases when requested', () => {
  assert.equal(TextPrep.clean('ÄPFEL und Birnen', opts({ lowercase: true })), 'äpfel und birnen');
});

test('randomWords returns n words from the list without immediate repeats', () => {
  const list = ['a', 'b', 'c'];
  const out = TextPrep.randomWords(list, 200);
  assert.equal(out.length, 200);
  assert.ok(out.every(w => list.includes(w)));
  for (let i = 1; i < out.length; i++) assert.notEqual(out[i], out[i - 1]);
});

test('randomWords handles single-word and empty lists', () => {
  assert.deepEqual([...TextPrep.randomWords(['x'], 3)], ['x', 'x', 'x']);
  assert.equal(TextPrep.randomWords([], 5).length, 0);
});

test('word lists are de-duplicated and non-empty', () => {
  const WORDS = run('WORDS');
  for (const lang of ['de', 'en']) {
    assert.ok(WORDS[lang].length > 100);
    assert.equal(new Set(WORDS[lang]).size, WORDS[lang].length);
  }
});
