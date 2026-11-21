// Kvasinky (Yeast) — an example mod for Biofilm. Read it top to bottom; MODDING.md explains
// every call. A mod exports data(api) for content and, if it wants, control(api) for hooks.

export function data(api) {
  // ---- a new deposit, two items and a fuel --------------------------------------------
  api.item('starch', { icon: { shape: 'cube', color: '#f1e3c6' } });
  api.item('ethanol', { icon: { shape: 'drop', color: '#c8f7ff' }, fuel: 500 });
  api.resource('starch', { item: 'starch', color: '#f1e3c6' });   // free play scatters it automatically

  // ---- a new building of an existing kind ("crafter") with its own crafting category ----
  api.entity('yeast', {
    kind: 'crafter', size: [2, 2], group: 'production', hp: 140,
    category: 'brew', speed: 1, power: 5, pollution: 0.05,
    cost: { fiber: 10, protein: 5 }, color: '#e8c36a',
    // optional: draw it yourself. S = size in pixels, t = time in seconds.
    draw(ctx, e, S, t) {
      const bud = 0.12 + 0.03 * Math.sin(t * 2 + e.id);
      ctx.fillStyle = '#e8c36a'; ctx.strokeStyle = '#7a5a1c'; ctx.lineWidth = Math.max(1.5, S * 0.04);
      ctx.beginPath(); ctx.arc(S * 0.45, S * 0.55, S * 0.34, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(S * 0.74, S * 0.28, S * bud, 0, 7); ctx.fill(); ctx.stroke();   // the bud
      ctx.fillStyle = e.busy ? '#fff6cf' : '#b48a32';
      ctx.beginPath(); ctx.arc(S * 0.42, S * 0.55, S * 0.12, 0, 7); ctx.fill();
    },
  });
  api.recipe('ethanol', { category: 'brew', time: 3, in: { starch: 2 }, out: { ethanol: 1 } });
  // a recipe for a machine of the base game, using the new item
  api.recipe('starchfiber', { category: 'ferment', time: 2, in: { starch: 1 }, out: { fiber: 1 } });

  // ---- a completely new kind of building ----------------------------------------------
  // The composter eats anything and turns every 3 items into 1 glucose.
  api.kind('composter', {
    init(w, e) { e.n = 0; e.out = {}; },
    wants(w, e) { return e.n < 12; },
    put(w, e) { if (e.n >= 12) return false; e.n++; return true; },
    take(w, e, pred) { if (e.out.glucose > 0 && pred('glucose')) { e.out.glucose--; return 'glucose'; } return null; },
    tick(w, e, p) {
      if (e.n >= 3 && (e.out.glucose || 0) < 5 && (w.tick + e.id) % p.period === 0) {
        e.n -= 3; e.out.glucose = (e.out.glucose || 0) + 1;
        w.stats.produced.glucose = (w.stats.produced.glucose || 0) + 1;
        state(w).composted += 3;                             // world.custom is saved with the game
      }
      if ((w.tick + e.id) % 6 === 0) api.sim.eject(w, e);   // push the product out of the front
    },
    removed(w, e, p, o) { if (o.refund && e.out.glucose) w.give('glucose', e.out.glucose); },
  });
  api.entity('composter', {
    kind: 'composter', size: [1, 1], group: 'production', hp: 80, period: 90,
    cost: { fiber: 6 }, color: '#8d6e4a', icon: { shape: 'spiral', color: '#d9c2a0' },
    // extra lines for the inspector panel
    inspect(w, e, ui) { return `<div class="kv"><span>${ui.esc(ui.t('ui.buffer'))}</span><span>${e.n} / 12</span></div>`; },
  });

  // ---- a mutation that unlocks it all --------------------------------------------------
  api.tech('brewing', {
    tier: 1, prereq: ['genomics'], packs: ['seqA'], units: 10, time: 5,
    unlock: { entities: ['yeast', 'composter'], recipes: ['ethanol', 'starchfiber'] },
  });

  // ---- changing the base game: generators burn ethanol a little cleaner ------------------
  api.modify('entity', 'generator', (g) => { g.pollution = 0.2; });

  // ---- a mission -------------------------------------------------------------------------
  api.mission('brewery', {
    size: [64, 64], seed: 77,
    setup(w, h) {
      h.core(30, 30);
      h.deposit('glucose', 41, 31, 3, 900);
      h.deposit('amino', 23, 30, 3, 900);
      h.deposit('starch', 32, 41, 3.2, 900);
      h.light(32, 32, 12);
    },
    start: { items: { glucose: 80, protein: 40, fiber: 60, iron: 10 }, techs: ['basics', 'proteins', 'colony', 'genomics', 'brewing'] },
    techs: ['basics', 'proteins', 'colony', 'genomics', 'brewing', 'photosynthesis', 'absorption'],
    objectives: [
      { id: 'yeast', type: 'build', entity: 'yeast', count: 1 },
      { id: 'ethanol', type: 'deliver', item: 'ethanol', count: 15 },
      { id: 'compost', type: 'build', entity: 'composter', count: 1 },
      // a custom objective: check(world) returns [current, target]; text is a locale key
      { id: 'feast', type: 'custom', text: 'mission.brewery.obj.feast', check: (w) => [state(w).composted, 9] },
    ],
    bonus: { type: 'time', minutes: 15 },
  });

  // ---- texts ------------------------------------------------------------------------------
  api.locale('cs', {
    'item.starch': 'Škrob', 'item.ethanol': 'Etanol', 'recipe.starchfiber': 'Vlákno ze škrobu',
    'entity.yeast': 'Kvasinková buňka', 'entity.yeast.desc': 'Kvasí škrob na etanol, výborné palivo do generátorů.',
    'entity.composter': 'Kompostér', 'entity.composter.desc': 'Sní cokoli a ze 3 položek udělá 1 glukózu. Hodí se na přebytky.',
    'tech.brewing': 'Kvašení', 'tech.brewing.desc': 'Kvasinková buňka, kompostér a etanol.',
    'mission.brewery.name': 'Pivovar', 'mission.brewery.intro': 'Na jihu leží škrob. Nauč kolonii kvasit etanol a topit jím v generátoru.',
    'mission.brewery.hint.yeast': 'Kvasinkovou buňku najdeš ve Výrobě. Škrob (světlá políčka na jihu) k ní doveď pásem.',
    'mission.brewery.hint.ethanol': 'Kvasinková buňka vysouvá etanol ve směru šipky. Doveď ho pásem do Jádra.',
    'mission.brewery.hint.compost': 'Kompostér postav na konec pásu s přebytky, nebo vedle Jádra s pilem.',
    'mission.brewery.hint.feast': 'Krm kompostér čímkoli. Každé 3 položky promění v 1 glukózu.',
    'mission.brewery.obj.feast': 'Zkompostuj položky',
  });
  api.locale('en', {
    'item.starch': 'Starch', 'item.ethanol': 'Ethanol', 'recipe.starchfiber': 'Fibre from starch',
    'entity.yeast': 'Yeast cell', 'entity.yeast.desc': 'Ferments starch into ethanol, a great fuel for generators.',
    'entity.composter': 'Composter', 'entity.composter.desc': 'Eats anything and turns 3 items into 1 glucose. Handy for leftovers.',
    'tech.brewing': 'Brewing', 'tech.brewing.desc': 'Yeast cell, composter and ethanol.',
    'mission.brewery.name': 'The brewery', 'mission.brewery.intro': 'There is starch to the south. Teach the colony to brew ethanol and burn it in a generator.',
    'mission.brewery.hint.yeast': 'The Yeast cell is under Production. Bring it starch (the pale tiles to the south) by pathway.',
    'mission.brewery.hint.ethanol': 'The Yeast cell pushes ethanol out along its arrow. Lead it to the Core by pathway.',
    'mission.brewery.hint.compost': 'Build a Composter at the end of a pathway with leftovers, or next to the Core with a pilus.',
    'mission.brewery.hint.feast': 'Feed the composter anything. Every 3 items become 1 glucose.',
    'mission.brewery.obj.feast': 'Compost items',
  });
}

// The mod's own saved state. world.custom is free space for mods and is stored in save files.
function state(w) { return (w.custom.kvasinky ||= { composted: 0, brewed: 0 }); }

// Runtime hooks: init, tick, built, removed, crafted, researched, objectiveDone, missionWon,
// wave, enemyKilled. A hook that throws is switched off and reported in the mod manager.
export function control(api) {
  api.on('crafted', (w, e, recipe) => {
    if (recipe.id !== 'ethanol') return;
    const st = state(w);
    if (++st.brewed % 10 === 0) w.deliver('atp', 1);   // every tenth ethanol, the colony celebrates
  });
}
