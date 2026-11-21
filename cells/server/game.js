'use strict';
// Pure simulation for Primordial. No networking / I/O in here.

const WORLD = 5000;
const TICK_HZ = 30;
const DT = 1 / TICK_HZ;
const START_MASS = 10;
const MAX_MASS = 3000;
const FOOD_TARGET = 1500;
const GRID = 250;
const SPAWN_SHIELD = 3; // seconds

const STAGES = [
  { name: 'Prokaryote', mass: 0 },
  { name: 'Eukaryote', mass: 30 },
  { name: 'Colony', mass: 80 },
  { name: 'Multicellular', mass: 180 },
  { name: 'Predator', mass: 400 },
  { name: 'Apex Leviathan', mass: 900 },
];

// Each trait can be stacked up to MAX_TRAIT levels.
const TRAITS = [
  { key: 'flagella', name: 'Flagella', desc: '+12% swim speed' },
  { key: 'membrane', name: 'Thick Membrane', desc: 'Predators must be much bigger to eat you' },
  { key: 'spikes', name: 'Toxin Spikes', desc: 'Whoever eats you gets less and is poisoned (slowed)' },
  { key: 'jaws', name: 'Jaws', desc: 'Eat organisms closer to your own size' },
  { key: 'cilia', name: 'Cilia', desc: 'Pull in nearby nutrients from further away' },
  { key: 'metabolism', name: 'Fast Metabolism', desc: 'Faster dash recharge, slower starvation' },
];
const MAX_TRAIT = 3;

const BOT_NAMES = [
  'Amoeba Al', 'Paramecium', 'Blobert', 'Sir Squish', 'Euglena', 'Volvox', 'Goo Lord',
  'Tardigrade', 'Plankton Pete', 'Slime Queen', 'Diatom', 'Rotifer', 'Mr. Mitosis',
  'Germy', 'Spore', 'Bacterio', 'Ooze', 'Wobble', 'Nucleus Ned', 'Protozoa',
];

function radiusOf(mass) { return 6 * Math.sqrt(mass); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function stageFor(mass) {
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (mass >= STAGES[i].mass) s = i;
  return s;
}

function eatRatio(eater, prey) {
  return Math.max(1.05, 1.2 + 0.08 * prey.traits.membrane - 0.06 * eater.traits.jaws);
}
function canEat(eater, prey) {
  return eater.mass >= prey.mass * eatRatio(eater, prey);
}

function emptyTraits() {
  const t = {};
  for (const tr of TRAITS) t[tr.key] = 0;
  return t;
}
// 2 bits per trait, packed into one int for the wire.
function packTraits(t) {
  let n = 0;
  TRAITS.forEach((tr, i) => { n |= (t[tr.key] & 3) << (i * 2); });
  return n;
}

class Game {
  constructor(opts = {}) {
    this.rand = opts.rand || Math.random;
    this.botTarget = opts.botTarget != null ? opts.botTarget : 14;
    this.nextId = 1;
    this.tick = 0;
    this.orgs = new Map(); // id -> organism (players and bots)
    this.food = new Map(); // id -> {id,x,y,m,c}
    this.foodGrid = new Map(); // cellKey -> Set(food)
    this.events = []; // drained by the server each tick
    for (let i = 0; i < FOOD_TARGET; i++) this.spawnFood();
  }

  // ---------- food ----------
  cellKey(x, y) { return ((x / GRID) | 0) * 1000 + ((y / GRID) | 0); }
  spawnFood(x, y, m) {
    const f = {
      id: this.nextId++,
      x: x != null ? clamp(x, 5, WORLD - 5) : 20 + this.rand() * (WORLD - 40),
      y: y != null ? clamp(y, 5, WORLD - 5) : 20 + this.rand() * (WORLD - 40),
      m: m || (this.rand() < 0.08 ? 3 : 1),
      c: (this.rand() * 6) | 0,
    };
    this.food.set(f.id, f);
    const k = this.cellKey(f.x, f.y);
    let cell = this.foodGrid.get(k);
    if (!cell) { cell = new Set(); this.foodGrid.set(k, cell); }
    cell.add(f);
    return f;
  }
  removeFood(f) {
    this.food.delete(f.id);
    const cell = this.foodGrid.get(this.cellKey(f.x, f.y));
    if (cell) cell.delete(f);
  }
  foodInRect(x0, y0, x1, y1, out = []) {
    const cx0 = Math.max(0, (x0 / GRID) | 0), cy0 = Math.max(0, (y0 / GRID) | 0);
    const cx1 = Math.min((WORLD / GRID) | 0, (x1 / GRID) | 0), cy1 = Math.min((WORLD / GRID) | 0, (y1 / GRID) | 0);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const cell = this.foodGrid.get(cx * 1000 + cy);
        if (!cell) continue;
        for (const f of cell) if (f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1) out.push(f);
      }
    }
    return out;
  }

  // ---------- organisms ----------
  safeSpawnPoint() {
    let best = null, bestScore = -1;
    for (let i = 0; i < 12; i++) {
      const x = 200 + this.rand() * (WORLD - 400), y = 200 + this.rand() * (WORLD - 400);
      let minD = Infinity;
      for (const o of this.orgs.values()) {
        if (!o.alive || o.mass < 20) continue;
        const d = Math.hypot(o.x - x, o.y - y) - o.r;
        if (d < minD) minD = d;
      }
      if (minD > bestScore) { bestScore = minD; best = { x, y }; }
      if (minD > 800) break;
    }
    return best;
  }

  addOrganism(name, isBot = false) {
    const id = this.nextId++;
    const o = {
      id, name, isBot,
      hue: (this.rand() * 360) | 0,
      x: 0, y: 0, vx: 0, vy: 0, angle: 0,
      mass: START_MASS, r: radiusOf(START_MASS), stage: 0,
      traits: emptyTraits(),
      pendingChoices: [], // array of [traitKey, traitKey] offers
      input: { dx: 0, dy: 0 },
      view: { hw: 900, hh: 600 },
      dashT: 0, dashCd: 0, poisonT: 0,
      alive: false, kills: 0, maxMass: START_MASS, bornAt: 0, maxStage: 0,
      ai: isBot ? { target: null, think: 0, wander: this.rand() * Math.PI * 2 } : null,
    };
    this.orgs.set(id, o);
    this.respawn(o);
    return o;
  }

  respawn(o) {
    const p = this.safeSpawnPoint();
    o.x = p.x; o.y = p.y; o.vx = o.vy = 0;
    o.mass = START_MASS; o.r = radiusOf(o.mass); o.stage = 0; o.maxStage = 0;
    o.traits = emptyTraits(); o.pendingChoices = [];
    o.dashT = 0; o.dashCd = 0; o.poisonT = 0;
    o.alive = true; o.kills = 0; o.maxMass = START_MASS; o.bornAt = this.tick;
    o.input = { dx: 0, dy: 0 };
  }

  removeOrganism(id) { this.orgs.delete(id); }

  // freshly spawned organisms can't be eaten for a few seconds
  shielded(o) { return this.tick - o.bornAt < SPAWN_SHIELD * TICK_HZ; }

  setInput(o, dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    o.input.dx = clamp(dx, -5000, 5000);
    o.input.dy = clamp(dy, -5000, 5000);
  }
  setView(o, hw, hh) {
    if (!Number.isFinite(hw) || !Number.isFinite(hh)) return;
    o.view.hw = clamp(hw, 200, 2600);
    o.view.hh = clamp(hh, 200, 2600);
  }

  dash(o) {
    if (!o.alive || o.dashCd > 0 || o.mass < START_MASS + 2) return false;
    o.dashT = 0.35;
    o.dashCd = 3 * (1 - 0.25 * o.traits.metabolism);
    const cost = Math.max(1, o.mass * 0.04);
    o.mass = Math.max(START_MASS, o.mass - cost);
    return true;
  }

  offerTraits(o) {
    const avail = TRAITS.filter(t => o.traits[t.key] < MAX_TRAIT).map(t => t.key);
    if (avail.length === 0) return;
    for (let i = avail.length - 1; i > 0; i--) {
      const j = (this.rand() * (i + 1)) | 0;
      [avail[i], avail[j]] = [avail[j], avail[i]];
    }
    o.pendingChoices.push(avail.slice(0, 2));
  }

  pickTrait(o, idx) {
    const offer = o.pendingChoices[0];
    if (!offer || !o.alive) return false;
    const key = offer[idx === 1 ? 1 : 0];
    if (!key) return false;
    o.traits[key] = Math.min(MAX_TRAIT, o.traits[key] + 1);
    o.pendingChoices.shift();
    return true;
  }

  speedOf(o) {
    let s = 380 * Math.pow(o.mass, -0.18);
    s *= 1 + 0.12 * o.traits.flagella;
    s *= 1 + 0.03 * o.stage; // evolved bodies swim a bit better
    if (o.poisonT > 0) s *= 0.55;
    if (o.dashT > 0) s *= 2.6;
    return s;
  }

  // ---------- AI ----------
  thinkBot(o) {
    const ai = o.ai;
    if (o.pendingChoices.length) this.pickTrait(o, (this.rand() * 2) | 0);
    ai.think -= DT;
    if (ai.think > 0) return;
    ai.think = 0.25 + this.rand() * 0.2;
    const sense = 500 + o.r * 3;
    let threat = null, threatD = Infinity, prey = null, preyScore = -Infinity;
    for (const other of this.orgs.values()) {
      if (other === o || !other.alive) continue;
      const d = Math.hypot(other.x - o.x, other.y - o.y) - other.r - o.r;
      if (d > sense) continue;
      if (canEat(other, o) && d < threatD) { threat = other; threatD = d; }
      else if (canEat(o, other)) {
        const score = other.mass / (d + 100);
        if (score > preyScore) { preyScore = score; prey = other; }
      }
    }
    if (threat && threatD < 250 + o.r) {
      o.input.dx = (o.x - threat.x) * 4; o.input.dy = (o.y - threat.y) * 4;
      if (threatD < 60 + o.r * 0.5 && this.rand() < 0.5) this.dash(o);
      return;
    }
    if (prey) {
      o.input.dx = prey.x - o.x; o.input.dy = prey.y - o.y;
      const d = Math.hypot(o.input.dx, o.input.dy);
      if (d < o.r + 150 && this.rand() < 0.15) this.dash(o);
      return;
    }
    // nearest food
    const near = this.foodInRect(o.x - sense, o.y - sense, o.x + sense, o.y + sense);
    let best = null, bestD = Infinity;
    for (const f of near) {
      const d = (f.x - o.x) ** 2 + (f.y - o.y) ** 2;
      if (d < bestD) { bestD = d; best = f; }
    }
    if (best) { o.input.dx = (best.x - o.x) * 3 + o.r; o.input.dy = (best.y - o.y) * 3; return; }
    ai.wander += (this.rand() - 0.5) * 1.2;
    o.input.dx = Math.cos(ai.wander) * 500; o.input.dy = Math.sin(ai.wander) * 500;
  }

  manageBots() {
    let humans = 0, bots = [];
    for (const o of this.orgs.values()) { if (o.isBot) bots.push(o); else humans++; }
    const want = Math.max(4, this.botTarget - humans);
    if (bots.length < want) {
      const n = BOT_NAMES[(this.rand() * BOT_NAMES.length) | 0];
      this.addOrganism(n, true);
    } else if (bots.length > want) {
      // remove the smallest bot
      bots.sort((a, b) => a.mass - b.mass);
      this.removeOrganism(bots[0].id);
      this.events.push({ t: 'gone', id: bots[0].id });
    }
  }

  // ---------- main step ----------
  step() {
    this.tick++;
    const orgs = [...this.orgs.values()].filter(o => o.alive);

    for (const o of orgs) {
      if (o.isBot) this.thinkBot(o);
      // movement
      const len = Math.hypot(o.input.dx, o.input.dy);
      const speed = this.speedOf(o);
      let tx = 0, ty = 0;
      if (len > 1) {
        const f = Math.min(1, len / (o.r * 2 + 40));
        tx = (o.input.dx / len) * speed * f;
        ty = (o.input.dy / len) * speed * f;
      }
      const k = o.dashT > 0 ? 0.6 : 0.18;
      o.vx += (tx - o.vx) * k;
      o.vy += (ty - o.vy) * k;
      o.x = clamp(o.x + o.vx * DT, o.r * 0.5, WORLD - o.r * 0.5);
      o.y = clamp(o.y + o.vy * DT, o.r * 0.5, WORLD - o.r * 0.5);
      if (o.vx * o.vx + o.vy * o.vy > 100) o.angle = Math.atan2(o.vy, o.vx);

      o.dashT = Math.max(0, o.dashT - DT);
      o.dashCd = Math.max(0, o.dashCd - DT);
      o.poisonT = Math.max(0, o.poisonT - DT);

      // starvation for big organisms
      if (o.mass > 150) o.mass -= o.mass * 0.0025 * (1 - 0.25 * o.traits.metabolism) * DT;

      // eat food (cilia extends reach and pulls food in)
      const reach = o.r + 4 + o.traits.cilia * 25;
      const near = this.foodInRect(o.x - reach, o.y - reach, o.x + reach, o.y + reach);
      for (const f of near) {
        const d = Math.hypot(f.x - o.x, f.y - o.y);
        if (d < reach) {
          this.removeFood(f);
          o.mass += f.m;
        }
      }
    }

    // organism vs organism
    for (let i = 0; i < orgs.length; i++) {
      const a = orgs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < orgs.length; j++) {
        const b = orgs[j];
        if (!b.alive || !a.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > a.r + b.r) continue;
        let eater = null, prey = null;
        if (a.mass >= b.mass && canEat(a, b) && d < a.r - b.r * 0.35 && !this.shielded(b)) { eater = a; prey = b; }
        else if (b.mass > a.mass && canEat(b, a) && d < b.r - a.r * 0.35 && !this.shielded(a)) { eater = b; prey = a; }
        if (eater) { this.consume(eater, prey); continue; }
        // can't eat: gentle shove so similar-size organisms bump
        if (!canEat(a, b) && !canEat(b, a) && d > 0.01) {
          const overlap = (a.r + b.r - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          const ta = b.mass / (a.mass + b.mass), tb = 1 - ta;
          a.x -= nx * overlap * ta * 0.5; a.y -= ny * overlap * ta * 0.5;
          b.x += nx * overlap * tb * 0.5; b.y += ny * overlap * tb * 0.5;
        }
      }
    }

    // mass bookkeeping / evolution
    for (const o of orgs) {
      if (!o.alive) continue;
      o.mass = clamp(o.mass, START_MASS, MAX_MASS);
      o.r = radiusOf(o.mass);
      if (o.mass > o.maxMass) o.maxMass = o.mass;
      const s = stageFor(o.mass);
      while (o.stage < s) {
        o.stage++;
        if (o.stage > o.maxStage) {
          o.maxStage = o.stage;
          this.offerTraits(o);
          this.events.push({ t: 'evolve', id: o.id, stage: o.stage });
        }
      }
    }

    // replenish food (a few per tick so it trickles back)
    for (let i = 0; i < 12 && this.food.size < FOOD_TARGET; i++) this.spawnFood();

    // bots respawn after a short delay; manage population once a second
    for (const o of this.orgs.values()) {
      if (o.isBot && !o.alive && this.tick - o.diedAt > TICK_HZ * 3) this.respawn(o);
    }
    if (this.tick % TICK_HZ === 0) this.manageBots();
  }

  consume(eater, prey) {
    const toxic = prey.traits.spikes;
    const share = toxic ? Math.max(0.35, 0.8 - 0.15 * toxic) : 0.8;
    eater.mass += prey.mass * share;
    if (toxic) eater.poisonT = 1 + toxic;
    // scatter a little of the prey back into the soup
    const bits = Math.min(14, (prey.mass * 0.1) | 0);
    for (let k = 0; k < bits; k++) {
      const ang = this.rand() * Math.PI * 2, rr = prey.r * (0.5 + this.rand());
      this.spawnFood(prey.x + Math.cos(ang) * rr, prey.y + Math.sin(ang) * rr, 1);
    }
    eater.kills++;
    prey.alive = false;
    prey.diedAt = this.tick;
    this.events.push({
      t: 'kill', eater: eater.id, prey: prey.id,
      eaterName: eater.name, preyName: prey.name,
    });
  }

  leaderboard(n = 10) {
    return [...this.orgs.values()].filter(o => o.alive)
      .sort((a, b) => b.mass - a.mass).slice(0, n)
      .map(o => ({ id: o.id, name: o.name, hue: o.hue, mass: Math.round(o.mass), x: Math.round(o.x), y: Math.round(o.y), stage: o.stage }));
  }
}

module.exports = {
  Game, WORLD, TICK_HZ, SPAWN_SHIELD, DT, STAGES, TRAITS, MAX_TRAIT, START_MASS,
  radiusOf, stageFor, canEat, eatRatio, packTraits,
};
