// Biofilm — browser entry point: loads mods, builds the registry and runs the game loop.
import { Registry } from './engine/registry.js';
import { applyMods } from './engine/modloader.js';
import { createWorld, step } from './sim/sim.js';
import { serialize, deserialize } from './sim/save.js';
import { bonusEarned } from './sim/objectives.js';
import { Renderer } from './render/renderer.js';
import { initControls } from './input/controls.js';
import { initHud } from './ui/hud.js';
import { initMenu } from './ui/menu.js';
import { openTechTree } from './ui/techtree.js';
import { gatherMods } from './ui/modsource.js';
import { loadSettings, saves, AUTOSAVE } from './ui/storage.js';
import { t, setLang } from './ui/i18n.js';
import * as sfx from './audio/sfx.js';
import * as base from './base/main.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view'), modal = $('modal');

const app = {
  reg: null, world: null, renderer: null, hud: null, menu: null, settings: null, modInfo: { listing: [], errors: [] },
  mouse: { x: 0, y: 0, tx: 0, ty: 0, inside: false },
  tool: null, sel: null, paused: false, speed: 1, showTox: false, harvestTile: null,
  lastRecipe: {}, lastFilter: null, ghostReason: null, saveName: null, modalKind: null,
  t, sfx: (n) => sfx.play(n),

  select(e) { this.sel = e; this.hud.selectionChanged(); },
  setTool(type, dir) {
    this.tool = type ? { type, dir: dir ?? this.tool?.dir ?? 0 } : null;
    if (type) this.sel = null;
    this.hud.selectionChanged(); this.hud.toolChanged();
  },
  hotkey(i) { this.hud.hotkey(i); },
  togglePause() { this.paused = !this.paused; },
  setSpeed(n) { this.speed = n; },
  toast(msg, kind) { this.hud.toast(msg, kind); },

  modalOpen() { return !modal.classList.contains('hidden'); },
  closeModal() { modal.classList.add('hidden'); modal.innerHTML = ''; modal.onpointerdown = null; this.modalKind = null; this.tech = null; },
  openTech() {
    if (!this.world) return;
    modal.classList.remove('hidden');
    this.modalKind = 'tech';
    this.tech = openTechTree(this, modal);
  },
  openGameMenu() { if (this.world) this.menu.dialog('menu'); },

  enter(world, name) {
    this.world = world; this.saveName = name && name !== AUTOSAVE ? name : null;
    this.sel = null; this.tool = null; this.paused = false; this.speed = 1; this.harvestTile = null;
    wonShown = world.won; lostShown = world.lost; acc = 0; lastAuto = performance.now();
    this.renderer.setWorld(world);
    this.closeModal();
    this.menu.hide();
    this.hud.show();
  },

  startMission(id, o = {}) {
    try {
      const world = createWorld(this.reg, { mission: id, peaceful: !!o.peaceful, seed: o.seed, size: o.size });
      this.enter(world);
      this.menu.dialog('intro');
    } catch (err) { console.error(err); alert(String(err.message || err)); }
  },

  async saveGame(name, quiet) {
    const w = this.world;
    if (!w) return;
    const data = serialize(w);
    data.cam = { ...this.renderer.cam };
    try {
      await saves.put(name, { mission: w.missionId, tick: w.tick, peaceful: w.peaceful }, JSON.parse(JSON.stringify(data)));
      if (name !== AUTOSAVE) this.saveName = name;
      if (!quiet) this.toast(t('ui.saved'), 'good');
    } catch (err) { console.error(err); if (!quiet) this.toast(String(err.message || err), 'warn'); }
  },
  quickSave() { return this.saveGame(this.saveName || t(`mission.${this.world.missionId}.name`)); },

  async loadGame(name) {
    try {
      const rec = await saves.get(name);
      if (!rec) throw new Error('save not found');
      const { world, warnings } = deserialize(this.reg, rec.data);
      this.enter(world, name);
      if (rec.data.cam) Object.assign(this.renderer.cam, rec.data.cam);
      for (const wn of warnings) this.toast(t('ui.warn.' + wn.type, wn), 'warn');
    } catch (err) { console.error(err); alert(t('ui.loadFailed', { msg: err.message || err })); }
  },

  async exitToMenu() {
    if (this.world && !this.world.lost) await this.saveGame(AUTOSAVE, true);
    this.world = null; this.renderer.w = null;
    this.closeModal(); this.hud.hide();
    this.menu.show('main');
  },

  // effects reported by the simulation (the renderer forwards every one of them here)
  onEffect(f) {
    switch (f.t) {
      case 'tech': this.toast(t('ui.researchDone', { name: t('tech.' + f.id) }), 'good'); sfx.play('tech'); this.tech?.refresh(); break;
      case 'objective': this.toast(t('ui.fx.objective'), 'good'); sfx.play('objective'); break;
      case 'wave': this.toast(t('ui.fx.wave', { n: f.n }), 'warn'); sfx.play('wave'); break;
      case 'antibiotic': this.toast(t('ui.antibiotic'), 'warn'); sfx.play('wave'); break;
      case 'shot': sfx.play('shot', 90); break;
      case 'boom': sfx.play('boom', 150); break;
      case 'launch': sfx.play('launch', 300); break;
    }
  },
};
window.__biofilm = app;

let lastT = 0, acc = 0, wonShown = false, lostShown = false, lastAuto = 0, lastNag = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0);
  lastT = now;
  const w = app.world;
  if (!w) return;
  app.controls.update(dt);
  if (!app.paused && !app.modalOpen() && !w.lost) {
    acc += dt * 60 * app.speed;
    let n = Math.min(Math.floor(acc), 8 * app.speed);
    acc = Math.min(acc - n, 4);
    while (n-- > 0) {
      if (app.harvestTile && w.harvest(app.harvestTile[0], app.harvestTile[1])) sfx.play('harvest', 60);
      step(w);
    }
  }
  app.renderer.draw(now / 1000, dt);
  app.hud.update(now);
  if (w.won && !wonShown) {
    wonShown = true;
    app.menu.recordWin(w, bonusEarned(w));
    sfx.play('won');
    app.saveGame(AUTOSAVE, true);
    app.menu.dialog('won');
  }
  if (w.lost && !lostShown) { lostShown = true; sfx.play('lost'); app.menu.dialog('lost'); }
  if (now - lastAuto > 120000 && !w.lost) { lastAuto = now; app.saveGame(AUTOSAVE, true); }
  if (now - lastNag > 45000 && w.power.sat < 0.6 && w.power.demand > 0 && !app.modalOpen()) { lastNag = now; app.toast(t('ui.fx.lowPower'), 'warn'); }
}

async function boot() {
  app.settings = loadSettings();
  sfx.configure(app.settings.sound, app.settings.volume);
  let info = { mods: [], listing: [], errors: [] };
  try { info = await gatherMods(app.settings); } catch (err) { console.error(err); }
  const reg = new Registry();
  applyMods(reg, [{ manifest: base.manifest, module: base, source: 'builtin' }, ...info.mods]);
  reg.errors.push(...info.errors);
  app.reg = reg; app.modInfo = info;
  setLang(reg, app.settings.lang);
  document.title = t('ui.title');
  app.renderer = new Renderer(canvas, app);
  app.hud = initHud(app);
  app.controls = initControls(app, canvas);
  app.menu = initMenu(app);
  await app.menu.show('main');
  $('loading')?.remove();
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.world && !app.world.lost) app.saveGame(AUTOSAVE, true); });
  requestAnimationFrame(frame);
}

boot().catch((err) => { console.error(err); const l = $('loading'); if (l) l.textContent = 'Error: ' + (err.message || err); });
