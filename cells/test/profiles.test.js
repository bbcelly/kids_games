'use strict';
// node test/profiles.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ProfileStore, normalizeCode } = require('../server/profiles');

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('ok -', name); }

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'primordial-profiles-'));
  try {
    let p;
    await test('create gives unique ids, secret token and transfer code', async () => {
      const s = new ProfileStore(dir);
      p = s.create();
      assert.match(p.publicId, /^[A-Za-z0-9_-]{8}$/);
      assert.match(p.token, /^[0-9a-f]{64}$/);
      assert.match(p.transferCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      assert.strictEqual(s.byTokenGet(p.token), p);
      assert.strictEqual(s.byCodeGet(p.transferCode.toLowerCase().replace(/-/g, ' ')), p, 'code is forgiving about case/spaces');
      assert.strictEqual(s.byTokenGet('nope'), null);
      assert.strictEqual(s.byTokenGet({}), null);
      p.dna = 77; p.name = 'Saved';
      s.touch(p);
      await s.flush();
      assert.ok(!fs.readdirSync(path.join(dir, 'profiles')).some(f => f.endsWith('.tmp')), 'no temp files left');
    });

    await test('profiles survive a restart (reload from disk)', async () => {
      const s2 = new ProfileStore(dir);
      const q = s2.byTokenGet(p.token);
      assert.ok(q && q.dna === 77 && q.name === 'Saved' && q.publicId === p.publicId);
      assert.strictEqual(s2.size, 1);
    });

    await test('corrupt file is skipped, not fatal; flushSync writes', async () => {
      fs.writeFileSync(path.join(dir, 'profiles', 'broken.json'), '{nope');
      const s3 = new ProfileStore(dir);
      assert.strictEqual(s3.size, 1);
      const q = s3.create(); q.dna = 5; s3.touch(q); s3.flushSync();
      assert.strictEqual(new ProfileStore(dir).byPublicGet(q.publicId).dna, 5);
    });

    await test('normalizeCode', async () => {
      assert.strictEqual(normalizeCode('abcd efgh jkmn'), 'ABCD-EFGH-JKMN');
      assert.strictEqual(normalizeCode('short'), null);
    });
    console.log(`\n${passed} tests passed`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error('FAIL:', e.message); process.exitCode = 1; });
