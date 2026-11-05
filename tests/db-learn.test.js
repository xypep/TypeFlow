const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('migrateDb fills missing keys and keeps existing data', () => {
  const run = load(['db.js']);
  const db = run(`migrateDb({ settings: { layout: 'qwerty' }, sessions: [{ wpm: 50 }], lessons: null })`);
  assert.equal(db.settings.layout, 'qwerty');
  assert.equal(db.settings.theme, 'dark');          // default added
  assert.equal(db.sessions.length, 1);
  assert.deepEqual({ ...db.lessons }, {});           // invalid value replaced
  assert.ok(Array.isArray(db.texts));
});

/** Learn.generate only needs Store.data.settings plus the layout/word modules. */
function learnCtx(layout) {
  const run = load(['db.js', 'words.js', 'keyboard.js', 'learn.js']);
  run(`Store.data = createDefaultDb(); Store.data.settings.layout = '${layout}';`);
  return run;
}

for (const layout of ['qwertz', 'qwerty']) {
  test(`${layout}: early lessons only use keys taught so far`, () => {
    const run = learnCtx(layout);
    const count = run('Learn.lessons().length');
    // letter-only lessons (before punctuation is introduced)
    const punctIdx = run(`Learn.lessons().findIndex(l => l.id === 'punct')`);
    for (let i = 0; i < punctIdx; i++) {
      const allowed = run(`[...Learn.allowedUpTo(${i})]`);
      for (let n = 0; n < 5; n++) {
        const text = run(`Learn.generate(${i})`);
        for (const ch of text.replace(/ /g, '')) {
          assert.ok(allowed.includes(ch), `lesson ${i + 1}: "${ch}" not taught yet in "${text}"`);
        }
      }
    }
    assert.ok(count >= 15);
  });
}

test('lesson length follows the setting', () => {
  const run = learnCtx('qwertz');
  run('Store.data.settings.lessonLength = 20');
  assert.equal(run('Learn.generate(4)').split(' ').length, 20);
});

test('umlaut lesson is only offered for QWERTZ', () => {
  assert.ok(learnCtx('qwertz')(`Learn.lessons().some(l => l.id === 'umlaut')`));
  assert.ok(!learnCtx('qwerty')(`Learn.lessons().some(l => l.id === 'umlaut')`));
});
