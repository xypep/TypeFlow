const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const run = load(['keyboard.js']);
const findKey = run('findKey');
const mapChar = run('mapChar');
const LAYOUTS = run('LAYOUTS');

test('every layout row has a finger for each key', () => {
  for (const [id, L] of Object.entries(LAYOUTS)) {
    L.rows.forEach((row, r) => {
      assert.equal([...row].length, L.fingers[r].length, `${id} row ${r} fingers`);
      assert.equal([...row].length, [...L.shift[r]].length, `${id} row ${r} shift`);
    });
  }
});

test('findKey locates base, shifted and space characters', () => {
  assert.deepEqual({ ...findKey('qwertz', 'f') }, { row: 2, col: 3, shift: false, finger: 3 });
  assert.deepEqual({ ...findKey('qwertz', 'J') }, { row: 2, col: 6, shift: true, finger: 4 });
  assert.equal(findKey('qwertz', ' ').finger, 8);
  assert.equal(findKey('qwertz', 'ö').finger, 7);
  assert.equal(findKey('qwertz', '€'), null);
});

test('mapChar converts by physical key position', () => {
  assert.equal(mapChar('z', 'qwertz', 'qwerty'), 'y');
  assert.equal(mapChar('y', 'qwertz', 'qwerty'), 'z');
  assert.equal(mapChar('ö', 'qwertz', 'qwerty'), ';');
  assert.equal(mapChar('m', 'qwertz', 'qwerty'), 'm');   // bottom row offset for the '<' key
  assert.equal(mapChar('a', 'qwertz', 'qwertz'), 'a');
});

test('mapChar round-trips letters', () => {
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    assert.equal(mapChar(mapChar(ch, 'qwertz', 'qwerty'), 'qwerty', 'qwertz'), ch);
  }
});

test('keyLabel keeps ß instead of turning it into SS', () => {
  const keyLabel = run('keyLabel');
  assert.equal(keyLabel('ß'), 'ß');
  assert.equal(keyLabel('ö'), 'Ö');
});
