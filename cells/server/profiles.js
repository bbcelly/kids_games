'use strict';
// Profile storage: one JSON file per profile in DATA_DIR/profiles. Everything is kept in
// memory; changed profiles are written back atomically (tmp file + rename) every few seconds.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { newProfileData } = require('./progression');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion

function randomCode() {
  const b = crypto.randomBytes(12);
  let s = '';
  for (let i = 0; i < 12; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
function normalizeCode(c) {
  const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 12 ? `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}` : null;
}

class ProfileStore {
  constructor(dir) {
    this.dir = path.join(dir, 'profiles');
    fs.mkdirSync(this.dir, { recursive: true });
    this.byPublic = new Map();
    this.byToken = new Map();
    this.byCode = new Map();
    this.dirty = new Set();
    this.flushing = null;
    for (const f of fs.readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try { this.index(JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8'))); }
      catch (e) { console.error('profiles: skipping unreadable', f, e.message); }
    }
  }

  index(p) {
    this.byPublic.set(p.publicId, p);
    this.byToken.set(p.token, p);
    this.byCode.set(p.transferCode, p);
  }

  get size() { return this.byPublic.size; }

  create(now = Date.now()) {
    let publicId;
    do { publicId = crypto.randomBytes(6).toString('base64url').slice(0, 8); } while (this.byPublic.has(publicId));
    let transferCode;
    do { transferCode = randomCode(); } while (this.byCode.has(transferCode));
    const p = { publicId, token: crypto.randomBytes(32).toString('hex'), transferCode, ...newProfileData(now) };
    this.index(p);
    this.touch(p);
    return p;
  }

  byTokenGet(token) { return typeof token === 'string' ? this.byToken.get(token) || null : null; }
  byPublicGet(id) { return typeof id === 'string' ? this.byPublic.get(id) || null : null; }
  byCodeGet(code) { const c = normalizeCode(code); return c ? this.byCode.get(c) || null : null; }

  touch(p) { this.dirty.add(p); }

  fileOf(p) { return path.join(this.dir, p.publicId + '.json'); }

  // Async write of all dirty profiles (one at a time, so the event loop stays free).
  async flush() {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      const batch = [...this.dirty];
      this.dirty.clear();
      for (const p of batch) {
        const file = this.fileOf(p), tmp = file + '.tmp';
        try {
          await fs.promises.writeFile(tmp, JSON.stringify(p));
          await fs.promises.rename(tmp, file);
        } catch (e) {
          console.error('profiles: write failed', p.publicId, e.message);
          this.dirty.add(p); // retry next time
        }
      }
    })();
    try { await this.flushing; } finally { this.flushing = null; }
  }

  // Used on shutdown.
  flushSync() {
    for (const p of this.dirty) {
      const file = this.fileOf(p), tmp = file + '.tmp';
      try { fs.writeFileSync(tmp, JSON.stringify(p)); fs.renameSync(tmp, file); }
      catch (e) { console.error('profiles: write failed', p.publicId, e.message); }
    }
    this.dirty.clear();
  }
}

module.exports = { ProfileStore, normalizeCode, randomCode };
