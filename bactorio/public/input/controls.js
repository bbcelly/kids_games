// Mouse and keyboard. Everything here goes through the same world.build / remove / harvest
// calls that the test bot uses.
import { play } from '../audio/sfx.js';

export function initControls(app, canvas) {
  const keys = new Set();
  const m = app.mouse;
  let drag = null;       // { last:[x,y], placed:Set<entity> } while dragging a building
  let removing = false, panning = null;

  const tileAt = (ev) => {
    const r = canvas.getBoundingClientRect();
    m.x = ev.clientX - r.left; m.y = ev.clientY - r.top;
    const [tx, ty] = app.renderer.toTile(m.x, m.y);
    m.tx = tx; m.ty = ty;
    return [Math.floor(tx), Math.floor(ty)];
  };

  const origin = (type, x, y) => { const o = (app.world.reg.entities[type].size[0] - 1) >> 1; return [x - o, y - o]; };

  function placeAt(x, y, quiet) {
    const w = app.world, tool = app.tool;
    if (!tool || w.lost) return null;
    const [ox, oy] = origin(tool.type, x, y);
    const before = w.entAt(ox, oy);
    const e = w.build(tool.type, ox, oy, tool.dir);
    if (e) {
      if (e !== before || !quiet) play('place');
      const p = e._p;
      if (p.kind === 'crafter' && !e.recipe && app.lastRecipe[e.type] && w.unlockedR.has(app.lastRecipe[e.type])) e.recipe = app.lastRecipe[e.type];
      if (p.filter && app.lastFilter) e.filter = app.lastFilter;
    } else if (!quiet) {
      play('error');
      app.toast?.(app.t('reason.' + (w.canPlace(tool.type, ox, oy).reason || 'occupied')), 'warn');
    }
    return e;
  }

  function removeAt(x, y) {
    const w = app.world, e = w.entAt(x, y);
    if (!e || e._p.kind === 'core' || e._p.enemy || w.lost) return;
    if (app.sel === e) app.select(null);
    w.remove(e, { refund: true });
    play('remove');
  }

  function dragTo(x, y) {
    const w = app.world, tool = app.tool, p = w.reg.entities[tool.type];
    let [lx, ly] = drag.last;
    if (lx === x && ly === y) return;
    if (p.size[0] > 1) { drag.last = [x, y]; placeAt(x, y, true); return; }
    let guard = 0;
    while ((lx !== x || ly !== y) && guard++ < 200) {
      const dx = Math.sign(x - lx), dy = Math.sign(y - ly);
      // walk along the longer axis first so diagonal drags make clean corners
      const stepX = dx !== 0 && (Math.abs(x - lx) >= Math.abs(y - ly) || dy === 0);
      const d = stepX ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
      if (p.kind === 'belt' && !p.tunnel) {
        tool.dir = d;
        const prev = w.entAt(lx, ly);
        if (prev && prev.type === tool.type && drag.placed.has(prev)) w.build(tool.type, lx, ly, d);
      }
      if (stepX) lx += dx; else ly += dy;
      const e = placeAt(lx, ly, true);
      if (e) drag.placed.add(e);
    }
    drag.last = [x, y];
  }

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousedown', (ev) => {
    if (!app.world) return;
    const [x, y] = tileAt(ev);
    const w = app.world;
    if (ev.button === 1 || (ev.button === 0 && keys.has('Space'))) { panning = { x: ev.clientX, y: ev.clientY }; ev.preventDefault(); return; }
    if (ev.button === 2) { removing = true; removeAt(x, y); return; }
    if (ev.button !== 0) return;
    if (app.tool) {
      const e = placeAt(x, y, false);
      drag = { last: [x, y], placed: new Set(e ? [e] : []) };
      return;
    }
    const e = w.entAt(x, y);
    if (e) { app.select(e); play('click'); return; }
    app.select(null);
    if (w.inb(x, y) && w.res[y * w.w + x]) app.harvestTile = [x, y];
  });

  window.addEventListener('mousemove', (ev) => {
    if (!app.world) return;
    m.inside = ev.target === canvas;
    const [x, y] = tileAt(ev);
    if (panning) {
      const c = app.renderer.cam;
      c.x -= (ev.clientX - panning.x) / c.px; c.y -= (ev.clientY - panning.y) / c.px;
      panning = { x: ev.clientX, y: ev.clientY };
      app.renderer.clamp();
      return;
    }
    if (drag && app.tool) dragTo(x, y);
    else if (removing) removeAt(x, y);
    else if (app.harvestTile) { const w = app.world; app.harvestTile = w.inb(x, y) && w.res[y * w.w + x] && !w.occ[y * w.w + x] ? [x, y] : app.harvestTile; }
  });

  window.addEventListener('mouseup', () => { drag = null; removing = false; panning = null; app.harvestTile = null; });
  canvas.addEventListener('mouseleave', () => { m.inside = false; });

  canvas.addEventListener('wheel', (ev) => {
    if (!app.world) return;
    ev.preventDefault();
    tileAt(ev);
    app.renderer.zoom(ev.deltaY < 0 ? 1.15 : 1 / 1.15, m.x, m.y);
  }, { passive: false });

  window.addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement || ev.target instanceof HTMLTextAreaElement) return;
    const code = ev.code;
    keys.add(code);
    if (!app.world || ev.repeat) return;
    if (app.modalOpen()) { if (code === 'Escape' || (code === 'KeyT' && app.modalKind === 'tech')) { app.closeModal(); ev.preventDefault(); } return; }
    if (ev.ctrlKey || ev.metaKey) { if (code === 'KeyS') { ev.preventDefault(); app.quickSave(); } return; }
    switch (code) {
      case 'KeyR':
        if (app.tool) app.tool.dir = (app.tool.dir + (ev.shiftKey ? 3 : 1)) & 3;
        else if (app.sel && app.sel._p.size[0] >= 1 && app.sel._p.kind !== 'core') { const e = app.sel; e.dir = (e.dir + (ev.shiftKey ? 3 : 1)) & 3; e._k.rotated?.(app.world, e, e._p); app.world.beltsDirty = true; }
        break;
      case 'KeyQ': {
        const e = app.world.entAt(Math.floor(m.tx), Math.floor(m.ty));
        if (!app.tool && e && e._p.buildable !== false && app.world.unlockedE.has(e.type)) app.setTool(e.type, e.dir);
        else app.setTool(null);
        break;
      }
      case 'Escape': if (app.tool) app.setTool(null); else if (app.sel) app.select(null); else app.openGameMenu(); break;
      case 'KeyT': app.openTech(); break;
      case 'Space': ev.preventDefault(); app.togglePause(); break;
      case 'Equal': case 'NumpadAdd': app.setSpeed(Math.min(4, app.speed * 2)); break;
      case 'Minus': case 'NumpadSubtract': app.setSpeed(Math.max(1, app.speed / 2)); break;
      case 'KeyO': app.showTox = !app.showTox; break;
      case 'Delete': case 'Backspace': if (app.sel) removeAt(app.sel.x, app.sel.y); break;
      default:
        if (/^Digit[1-9]$/.test(code)) app.hotkey(+code.slice(5) - 1);
    }
  });
  window.addEventListener('keyup', (ev) => keys.delete(ev.code));
  window.addEventListener('blur', () => { keys.clear(); drag = null; removing = false; panning = null; app.harvestTile = null; });

  return {
    update(dt) {
      if (!app.world || app.modalOpen()) return;
      const c = app.renderer.cam, v = dt * 700 / c.px * (keys.has('ShiftLeft') ? 2 : 1);
      if (keys.has('KeyW') || keys.has('ArrowUp')) c.y -= v;
      if (keys.has('KeyS') || keys.has('ArrowDown')) c.y += v;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) c.x -= v;
      if (keys.has('KeyD') || keys.has('ArrowRight')) c.x += v;
      app.renderer.clamp();
      const [tx, ty] = app.renderer.toTile(m.x, m.y);
      m.tx = tx; m.ty = ty;
    },
  };
}
