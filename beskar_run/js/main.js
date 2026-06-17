'use strict';
// ============================================================
// BESKAR RUN — main game: states, entities, combat, hangar, HUD
// ============================================================

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

Sprites.init();
let save = loadSave();

const keys = {};
let entId = 0;

// ---------- global game state ----------
const G = {
  state: 'title',        // title | play | pause | hangar | complete | down
  bg: null,
  level: 0,
  t: 0,                  // time in current state
  levelTime: 0,
  score: 0,
  runBeskar: 0,
  shake: 0,
  flash: 0,
  waveFired: [],
  spawnQueue: [],
  enemies: [],
  pbullets: [],
  ebullets: [],
  coins: [],
  parts: [],
  floats: [],
  boss: null,
  bossWarnT: 0,
  bossDying: 0,
  wipeFx: 0,
  hangar: { tab: 0, sel: 0 },
  titleBg: new Background(0),
};

// ---------- player ----------
const P = {
  x: 150, y: H / 2, w: 64, h: 36,
  hearts: 3, maxHearts: 3,
  inv: 0, fireT: 0, subT: 0,
  wipeCd: 0, mendT: 0, revives: 0,
  weaponIdx: 0,
  bob: 0,
};

function equippedWeapon() {
  const id = save.weapons[P.weaponIdx] || 'blaster';
  return WEAPONS.find(w => w.id === id) || WEAPONS[0];
}
function fireRateMult() { return Math.pow(0.88, save.upgrades.rate); }
function moveSpeed() { return 270 * (1 + save.upgrades.thrust * 0.14); }

// ---------- run lifecycle ----------
function startRun() {
  G.level = save.level;
  G.bg = new Background(G.level);
  G.levelTime = 0; G.score = 0; G.runBeskar = 0;
  G.waveFired = LEVELS[G.level].waves.map(() => false);
  G.spawnQueue = []; G.enemies = []; G.pbullets = []; G.ebullets = [];
  G.coins = []; G.parts = []; G.floats = [];
  G.boss = null; G.bossWarnT = 0; G.bossDying = 0; G.wipeFx = 0;
  G.shake = 0; G.flash = 0;

  P.x = 150; P.y = H / 2;
  P.maxHearts = 3 + save.upgrades.armor;
  P.hearts = P.maxHearts;
  P.inv = 2; P.fireT = 0.3; P.subT = 0.6;
  P.wipeCd = 0; P.mendT = MEND_T[save.gifts.mend] || 0;
  P.revives = save.gifts.bond;
  const eq = save.weapons.indexOf(save.equipped);
  P.weaponIdx = eq >= 0 ? eq : 0;

  setState('play');
  Sfx.startMusic(G.level);
}

function bankRun() {
  save.vault += G.runBeskar;
  if (G.score > save.bestScore) save.bestScore = Math.floor(G.score);
  storeSave(save);
}

function setState(s) {
  G.state = s; G.t = 0;
  if (s !== 'play') Sfx.stopMusic();
}

// ---------- spawning ----------
function queueWave(ev) {
  const baseY = rand(90, H - 130);
  for (let i = 0; i < ev.n; i++) {
    let y;
    if (ev.pat === 'train') y = baseY;
    else if (ev.pat === 'vee') y = clamp(baseY + Math.ceil(i / 2) * 34 * (i % 2 ? 1 : -1), 60, H - 90);
    else if (ev.pat === 'col') y = 80 + (i + 0.5) * (H - 180) / ev.n;
    else y = rand(70, H - 110);
    G.spawnQueue.push({ timer: i * ev.gap, type: ev.type, y });
  }
}

function spawnEnemy(type, y) {
  const st = ENEMY_STATS[type];
  const m = loopMult(save.loop);
  G.enemies.push({
    id: ++entId, type, x: W + 60, y, baseY: y,
    w: st.w, h: st.h,
    hp: st.hp * m.hp, maxHp: st.hp * m.hp,
    spd: st.spd * m.spd,
    score: st.score, coins: st.coins,
    t: rand(0, 6), fireT: rand(1.2, 2.4),
    rot: rand(0, 6), vr: rand(-1.5, 1.5), vy: rand(-30, 30),
    stopX: W - rand(200, 330),
    hitFlash: 0,
  });
}

function spawnBoss() {
  const L = LEVELS[G.level];
  const spr = Sprites[L.bossSpr];
  const m = 1 + 0.6 * save.loop;
  const groundY = H - 70 - spr.height / 2 + 10;
  G.boss = {
    id: ++entId, spr,
    x: W + spr.width / 2 + 20,
    y: G.level === 2 ? groundY : H / 2,
    w: spr.width * 0.82, h: spr.height * 0.82,
    hp: L.bossHp * m, maxHp: L.bossHp * m,
    t: 0, fireT: 2.5, burst: 0, burstT: 0,
    entering: true, dir: 1, hitFlash: 0,
  };
  Sfx.bossWarn();
}

// ---------- pickups, particles, text ----------
function dropCoins(x, y, count, val, lucky) {
  for (let i = 0; i < count; i++) {
    G.coins.push({
      x: x + rand(-14, 14), y: y + rand(-14, 14),
      vx: rand(-90, 10), vy: rand(-80, 80),
      val, lucky: !!lucky, t: rand(0, 3), life: 11,
    });
  }
}

function enemyDrops(e) {
  const m = loopMult(save.loop);
  let n = Math.round(randi(e.coins[0], e.coins[1]) * m.coins);
  const luckyLvl = save.gifts.lucky;
  if (luckyLvl && Math.random() < luckyLvl * 0.12) {
    dropCoins(e.x, e.y, n, 2, true);
    addFloat(e.x, e.y - 24, 'LUCKY!', '#e1bee7');
  } else {
    dropCoins(e.x, e.y, n, 1, false);
  }
}

function explode(x, y, n, big) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(40, big ? 320 : 200);
    G.parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.25, big ? 0.9 : 0.55), t: 0,
      size: randi(3, big ? 9 : 6),
      c: pick(['#ffd54f', '#ff8a3d', '#ff5252', '#ffe9b0', '#b0bec5']),
    });
  }
}

function sparkle(x, y, c) {
  for (let i = 0; i < 6; i++) {
    G.parts.push({
      x: x + rand(-10, 10), y: y + rand(-10, 10),
      vx: rand(-30, 30), vy: rand(-60, -10),
      life: 0.5, t: 0, size: 2, c: c || '#aef3b0',
    });
  }
}

function addFloat(x, y, txt, c) {
  G.floats.push({ x, y, txt, c: c || '#fff', t: 0 });
}

// ---------- firing ----------
function fireShots(shots) {
  for (const s of shots) {
    const ang = (s.ang || 0) + (s.jitter ? rand(-s.jitter, s.jitter) : 0);
    const speed = s.kind === 'laser' ? 880 : s.kind === 'missile' ? 360 : s.kind === 'pellet' ? 470 : 560;
    G.pbullets.push({
      x: P.x + 34, y: P.y + (s.dy || 0),
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      dmg: s.dmg, kind: s.kind, dark: !!s.dark,
      life: s.life || 2.2, t: 0,
      pierce: s.kind === 'laser', hitIds: s.kind === 'laser' ? [] : null,
    });
  }
  const k = shots[0].kind;
  if (k === 'laser') Sfx.laser();
  else if (k === 'missile') Sfx.shootBig();
  else Sfx.shoot();
}

function enemyFire(x, y, aimed, speed, spreadAng) {
  let vx = -1, vy = 0;
  if (aimed) {
    const d = Math.max(1, dist(x, y, P.x, P.y));
    vx = (P.x - x) / d; vy = (P.y - y) / d;
  }
  if (spreadAng) {
    const a = Math.atan2(vy, vx) + spreadAng;
    vx = Math.cos(a); vy = Math.sin(a);
  }
  const m = loopMult(save.loop);
  const sp = (speed || 230) * (1 + 0.08 * save.loop);
  G.ebullets.push({ x, y, vx: vx * sp, vy: vy * sp, t: 0, life: 6 });
  Sfx.enemyShot();
  void m;
}

// ---------- force powers ----------
function forceWipe(free) {
  if (!free) {
    if (!save.gifts.wipe || P.wipeCd > 0) { if (save.gifts.wipe) Sfx.deny(); return; }
    P.wipeCd = WIPE_CD[save.gifts.wipe];
  }
  G.wipeFx = 0.0001;
  G.flash = 0.35; G.shake = 10;
  Sfx.wipe();
  for (const e of G.enemies) {
    explode(e.x, e.y, 10);
    G.score += e.score;
    enemyDrops(e);
  }
  G.enemies.length = 0;
  G.ebullets.length = 0;
  if (G.boss && !G.boss.entering) {
    G.boss.hp -= 10; G.boss.hitFlash = 0.2;
    if (G.boss.hp <= 0) killBoss();
  }
}

function hurtPlayer() {
  if (P.inv > 0 || G.bossDying > 0) return;
  P.hearts--;
  P.inv = 1.7; G.shake = 8; G.flash = 0.18;
  Sfx.hurt();
  explode(P.x, P.y, 8);
  if (P.hearts <= 0) {
    if (P.revives > 0) {
      P.revives--;
      P.hearts = P.maxHearts;
      P.inv = 3;
      forceWipe(true);
      addFloat(P.x, P.y - 40, 'FORCE BOND!', '#aef3b0');
      Sfx.revive();
    } else {
      explode(P.x, P.y, 40, true);
      Sfx.bigBoom();
      bankRun();
      setState('down');
    }
  }
}

function killBoss() {
  const b = G.boss;
  G.bossDying = 1.8;
  G.score += 1000 * (1 + save.loop);
  const m = loopMult(save.loop);
  dropCoins(b.x, b.y, Math.round(20 * m.coins), 3, false);
  G.ebullets.length = 0;
  Sfx.bigBoom();
}

// ============================================================
// UPDATE
// ============================================================
function update(dt) {
  G.t += dt;
  if (G.state === 'title') { G.titleBg.update(dt); return; }
  if (G.state !== 'play') {
    if (G.state === 'down' || G.state === 'complete') {
      // keep particles/coins drifting behind the banner
      updateParticles(dt);
      if (G.bg) G.bg.update(dt * 0.4);
    }
    return;
  }

  G.bg.update(dt);
  G.levelTime += dt;
  G.score += dt * 10;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 1.6);
  if (G.wipeFx > 0) { G.wipeFx += dt * 2.2; if (G.wipeFx > 1.2) G.wipeFx = 0; }

  updatePlayer(dt);
  updateSpawning(dt);
  updateEnemies(dt);
  updateBoss(dt);
  updateBullets(dt);
  updateCoins(dt);
  updateParticles(dt);
}

function updatePlayer(dt) {
  const sp = moveSpeed();
  let dx = 0, dy = 0;
  if (keys.ArrowLeft || keys.KeyA) dx -= 1;
  if (keys.ArrowRight || keys.KeyD) dx += 1;
  if (keys.ArrowUp || keys.KeyW) dy -= 1;
  if (keys.ArrowDown || keys.KeyS) dy += 1;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  P.x = clamp(P.x + dx * sp * dt, 40, W - 120);
  P.y = clamp(P.y + dy * sp * dt, 40, H - (G.level === 2 ? 90 : 50));
  P.bob += dt * 4;
  if (P.inv > 0) P.inv -= dt;

  // auto-fire
  const wp = equippedWeapon();
  P.fireT -= dt;
  if (P.fireT <= 0) {
    fireShots(wp.shots);
    P.fireT = wp.interval * fireRateMult();
  }
  if (wp.sub) {
    P.subT -= dt;
    if (P.subT <= 0) {
      fireShots(wp.sub.shots);
      P.subT = wp.sub.interval * fireRateMult();
    }
  }

  // force powers
  if (P.wipeCd > 0) P.wipeCd -= dt;
  if (save.gifts.mend > 0 && P.hearts < P.maxHearts) {
    P.mendT -= dt;
    if (P.mendT <= 0) {
      P.hearts++;
      P.mendT = MEND_T[save.gifts.mend];
      sparkle(P.x, P.y);
      addFloat(P.x, P.y - 36, '+♥', '#aef3b0');
      Sfx.heal();
    }
  } else {
    P.mendT = MEND_T[save.gifts.mend] || 0;
  }
}

function updateSpawning(dt) {
  const L = LEVELS[G.level];
  L.waves.forEach((ev, i) => {
    if (!G.waveFired[i] && G.levelTime >= ev.t) {
      G.waveFired[i] = true;
      queueWave(ev);
    }
  });
  for (const q of G.spawnQueue) q.timer -= dt;
  G.spawnQueue = G.spawnQueue.filter(q => {
    if (q.timer <= 0) { spawnEnemy(q.type, q.y); return false; }
    return true;
  });

  // all waves out, field clear → boss
  const allFired = G.waveFired.every(Boolean);
  if (allFired && !G.boss && !G.spawnQueue.length && !G.enemies.length) {
    if (G.bossWarnT === 0) { G.bossWarnT = 0.0001; Sfx.bossWarn(); }
    G.bossWarnT += dt;
    if (G.bossWarnT > 2.4) spawnBoss();
  }
}

function updateEnemies(dt) {
  const mFire = loopMult(save.loop).fire;
  for (const e of G.enemies) {
    e.t += dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    switch (e.type) {
      case 'grunt':
        e.x -= e.spd * dt;
        e.y = e.baseY + Math.sin(e.t * 3) * 28;
        break;
      case 'waver':
        e.x -= e.spd * dt;
        e.y = clamp(e.baseY + Math.sin(e.t * 2) * 85, 40, H - 60);
        break;
      case 'drone':
        e.x -= e.spd * dt;
        e.y = e.baseY + Math.sin(e.t * 5) * 16;
        e.fireT -= dt;
        if (e.fireT <= 0 && e.x < W - 80 && e.x > P.x + 60) {
          enemyFire(e.x - 14, e.y, true, 250);
          e.fireT = 2.6 / mFire;
        }
        break;
      case 'shooter':
        if (e.x > e.stopX) e.x -= e.spd * dt;
        else {
          e.y += clamp(P.y - e.y, -40, 40) * dt * 0.6;
          e.fireT -= dt;
          if (e.fireT <= 0) {
            enemyFire(e.x - 22, e.y, true, 240);
            e.fireT = 1.9 / mFire;
          }
        }
        break;
      case 'asteroid':
        e.x -= e.spd * dt;
        e.y += e.vy * dt;
        e.rot += e.vr * dt;
        if (e.y < 30 || e.y > H - 50) e.vy *= -1;
        break;
    }
    // ramming the player
    if (P.inv <= 0 && hit(e, P)) {
      hurtPlayer();
      e.hp -= 3; e.hitFlash = 0.15;
      if (e.hp <= 0) dieEnemy(e);
    }
  }
  G.enemies = G.enemies.filter(e => e.hp > 0 && e.x > -90);
}

function dieEnemy(e) {
  e.hp = 0;
  explode(e.x, e.y, e.type === 'asteroid' ? 14 : 10, e.type === 'shooter');
  G.score += e.score;
  enemyDrops(e);
  Sfx.boom();
  G.shake = Math.max(G.shake, 3);
}

function updateBoss(dt) {
  const b = G.boss;
  if (!b) return;
  b.t += dt;
  if (b.hitFlash > 0) b.hitFlash -= dt;

  if (G.bossDying > 0) {
    G.bossDying -= dt;
    if (Math.random() < 0.35) {
      explode(b.x + rand(-b.w / 2, b.w / 2), b.y + rand(-b.h / 2, b.h / 2), 10, true);
      Sfx.boom();
    }
    G.shake = 5;
    if (G.bossDying <= 0) {
      explode(b.x, b.y, 60, true);
      Sfx.bigBoom();
      G.boss = null;
      // level cleared!
      const bonus = 50 + G.level * 25 + save.loop * 25;
      G.runBeskar += bonus;
      save.level = (save.level + 1) % LEVELS.length;
      if (save.level === 0) save.loop++;
      bankRun();
      setState('complete');
      G.completeBonus = bonus;
      Sfx.fanfare();
    }
    return;
  }

  const mFire = loopMult(save.loop).fire;
  if (b.entering) {
    b.x -= 120 * dt;
    if (b.x <= W - 30 - b.spr.width / 2) b.entering = false;
    return;
  }

  if (G.level === 0) {
    // Mining Hauler: slow vertical patrol, spread volleys
    b.y += b.dir * 55 * dt;
    if (b.y < b.h / 2 + 30) b.dir = 1;
    if (b.y > H - b.h / 2 - 30) b.dir = -1;
    b.fireT -= dt;
    if (b.fireT <= 0) {
      for (let i = -2; i <= 2; i++) enemyFire(b.x - b.w / 2, b.y, false, 250, i * 0.22);
      b.fireT = 2.1 / mFire;
    }
  } else if (G.level === 1) {
    // Imperial Cruiser: tracks you, aimed 3-round bursts
    b.y += clamp(P.y - b.y, -70, 70) * dt * 0.8;
    b.x = W - 40 - b.spr.width / 2 + Math.sin(b.t * 0.7) * 30;
    if (b.burst > 0) {
      b.burstT -= dt;
      if (b.burstT <= 0) {
        enemyFire(b.x - b.w / 2, b.y + rand(-20, 20), true, 320);
        b.burst--; b.burstT = 0.16;
      }
    } else {
      b.fireT -= dt;
      if (b.fireT <= 0) { b.burst = 3; b.burstT = 0; b.fireT = 1.9 / mFire; }
    }
  } else {
    // Imperial Walker: stomps along the ground, angled bursts
    b.x += Math.sin(b.t * 0.5) * 28 * dt;
    b.y += Math.sin(b.t * 4) * 5 * dt; // stompy bob
    if (b.burst > 0) {
      b.burstT -= dt;
      if (b.burstT <= 0) {
        enemyFire(b.x - b.w / 2 + 10, b.y - b.h / 2 + 20, true, 300, rand(-0.12, 0.12));
        b.burst--; b.burstT = 0.13;
      }
    } else {
      b.fireT -= dt;
      if (b.fireT <= 0) { b.burst = 4; b.burstT = 0; b.fireT = 2.3 / mFire; }
    }
  }

  if (P.inv <= 0 && hit(b, P)) hurtPlayer();
}

function updateBullets(dt) {
  // player bullets
  for (const u of G.pbullets) {
    u.t += dt;
    if (u.kind === 'missile') {
      // steer toward the nearest target
      let best = null, bd = 1e9;
      const targets = G.boss && !G.boss.entering ? [...G.enemies, G.boss] : G.enemies;
      for (const e of targets) {
        const d = dist(u.x, u.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const cur = Math.atan2(u.vy, u.vx);
        const want = Math.atan2(best.y - u.y, best.x - u.x);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = clamp(diff, -4.2 * dt, 4.2 * dt);
        const a = cur + turn, sp = 430;
        u.vx = Math.cos(a) * sp; u.vy = Math.sin(a) * sp;
      }
      if (Math.random() < 0.5) G.parts.push({ x: u.x - 10, y: u.y, vx: -40, vy: rand(-15, 15), life: 0.25, t: 0, size: 3, c: '#ffb74d' });
    }
    u.x += u.vx * dt; u.y += u.vy * dt;
  }
  G.pbullets = G.pbullets.filter(u => u.t < u.life && u.x < W + 40 && u.x > -20 && u.y > -20 && u.y < H + 20);

  // hits on enemies & boss
  for (const u of G.pbullets) {
    const bw = u.kind === 'laser' ? 46 : 12, bh = u.kind === 'laser' ? 8 : 10;
    const box = { x: u.x, y: u.y, w: bw, h: bh };
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      if (hit(box, e)) {
        if (u.pierce) {
          if (u.hitIds.includes(e.id)) continue;
          u.hitIds.push(e.id);
        } else u.t = 99;
        e.hp -= u.dmg; e.hitFlash = 0.12;
        if (e.hp <= 0) dieEnemy(e);
        if (!u.pierce) break;
      }
    }
    const b = G.boss;
    if (b && !b.entering && G.bossDying <= 0 && u.t < 99 && hit(box, b)) {
      if (u.pierce) {
        if (!u.hitIds.includes(b.id)) {
          u.hitIds.push(b.id);
          b.hp -= u.dmg; b.hitFlash = 0.15;
        }
      } else {
        u.t = 99;
        b.hp -= u.dmg; b.hitFlash = 0.15;
      }
      explode(u.x, u.y, 2);
      if (b.hp <= 0) killBoss();
    }
  }
  G.pbullets = G.pbullets.filter(u => u.t < u.life);
  G.enemies = G.enemies.filter(e => e.hp > 0);

  // enemy bullets
  for (const u of G.ebullets) {
    u.t += dt;
    u.x += u.vx * dt; u.y += u.vy * dt;
    if (P.inv <= 0 && hit({ x: u.x, y: u.y, w: 12, h: 12 }, P)) {
      u.t = 99;
      hurtPlayer();
    }
  }
  G.ebullets = G.ebullets.filter(u => u.t < u.life && u.x > -30 && u.x < W + 30 && u.y > -30 && u.y < H + 30);
}

function updateCoins(dt) {
  const magR = MAGNET_R[save.gifts.magnet];
  for (const c of G.coins) {
    c.t += dt; c.life -= dt;
    const d = dist(c.x, c.y, P.x, P.y);
    if (magR && d < magR) {
      const pull = 900 * (1 - d / magR) + 150;
      c.vx += ((P.x - c.x) / d) * pull * dt * 4;
      c.vy += ((P.y - c.y) / d) * pull * dt * 4;
    } else {
      c.vx = lerp(c.vx, -35, dt);
      c.vy *= (1 - dt * 1.5);
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (d < 34) {
      c.life = -1;
      G.runBeskar += c.val;
      G.score += c.val * 5;
      Sfx.coin();
      if (c.lucky) sparkle(P.x, P.y - 10, '#e1bee7');
    }
  }
  G.coins = G.coins.filter(c => c.life > 0 && c.x > -30);
}

function updateParticles(dt) {
  for (const p of G.parts) {
    p.t += dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - dt * 2); p.vy *= (1 - dt * 2);
  }
  G.parts = G.parts.filter(p => p.t < p.life);
  for (const f of G.floats) { f.t += dt; f.y -= 30 * dt; }
  G.floats = G.floats.filter(f => f.t < 1.2);
}

// ============================================================
// DRAW
// ============================================================
function draw() {
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));

  if (G.state === 'title') {
    drawTitle();
    ctx.restore();
    return;
  }
  if (G.state === 'hangar') {
    drawHangar();
    ctx.restore();
    return;
  }

  // in-flight scene (also behind pause/complete/down banners)
  if (G.bg) G.bg.draw(ctx);
  drawCoins();
  drawEnemies();
  drawBoss();
  drawBullets();
  if (G.state !== 'down') drawPlayer();
  drawParticles();
  drawFloats();
  drawWipe();
  drawHUD();

  if (G.bossWarnT > 0 && !G.boss && G.state === 'play') {
    if (Math.sin(G.t * 12) > 0) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!! ' + LEVELS[G.level].boss.toUpperCase() + ' APPROACHING !!', W / 2, H / 2 - 60);
    }
  }

  if (G.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (G.flash * 0.5) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  if (G.state === 'pause') drawPause();
  if (G.state === 'complete') drawComplete();
  if (G.state === 'down') drawDown();

  ctx.restore();
}

function drawPlayer() {
  const bob = Math.sin(P.bob) * 3;
  if (P.inv > 0 && Math.sin(G.t * 24) > 0) ctx.globalAlpha = 0.35;

  // thruster flame
  const fl = 8 + Math.sin(G.t * 40) * 5;
  ctx.fillStyle = '#ffb74d';
  ctx.fillRect(P.x - 36 - fl, P.y + bob - 9, fl, 6);
  ctx.fillRect(P.x - 36 - fl, P.y + bob + 5, fl, 6);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(P.x - 34 - fl * 0.5, P.y + bob - 7, fl * 0.5, 3);
  ctx.fillRect(P.x - 34 - fl * 0.5, P.y + bob + 7, fl * 0.5, 3);

  ctx.drawImage(Sprites.player, (P.x - Sprites.player.width / 2) | 0, (P.y + bob - Sprites.player.height / 2) | 0);

  // Grogu in his pod, trailing behind
  const gx = P.x - 52, gy = P.y + bob - 34 + Math.sin(P.bob * 1.3) * 5;
  ctx.drawImage(Sprites.grogu, gx | 0, gy | 0);
  ctx.globalAlpha = 1;
}

function drawEnemies() {
  for (const e of G.enemies) {
    const spr = Sprites[e.type === 'asteroid' ? 'asteroid' : e.type];
    ctx.save();
    ctx.translate(e.x | 0, e.y | 0);
    if (e.type === 'asteroid') ctx.rotate(e.rot);
    if (e.hitFlash > 0) ctx.globalAlpha = 0.5;
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
  }
}

function drawBoss() {
  const b = G.boss;
  if (!b) return;
  ctx.save();
  ctx.translate(b.x | 0, b.y | 0);
  if (b.hitFlash > 0) ctx.globalAlpha = 0.6;
  if (G.bossDying > 0 && Math.sin(G.t * 30) > 0) ctx.globalAlpha = 0.4;
  ctx.drawImage(b.spr, -b.spr.width / 2, -b.spr.height / 2);
  ctx.restore();
}

function drawBullets() {
  for (const u of G.pbullets) {
    if (u.kind === 'laser') {
      ctx.fillStyle = u.dark ? '#b388ff' : '#8effff';
      ctx.fillRect(u.x - 26, u.y - 3, 52, 6);
      ctx.fillStyle = u.dark ? '#7c4dff' : '#4dd0e1';
      ctx.fillRect(u.x - 26, u.y - 1, 52, 2);
    } else if (u.kind === 'missile') {
      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(Math.atan2(u.vy, u.vx));
      ctx.drawImage(Sprites.missile, -13, -4);
      ctx.restore();
    } else if (u.kind === 'pellet') {
      ctx.fillStyle = '#ffe082';
      ctx.fillRect(u.x - 4, u.y - 4, 8, 8);
    } else {
      ctx.fillStyle = '#9dff8e';
      ctx.fillRect(u.x - 9, u.y - 3, 18, 6);
      ctx.fillStyle = '#e8ffd0';
      ctx.fillRect(u.x - 5, u.y - 1, 10, 2);
    }
  }
  for (const u of G.ebullets) {
    ctx.fillStyle = '#ff5252';
    ctx.beginPath(); ctx.arc(u.x, u.y, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd1d1';
    ctx.beginPath(); ctx.arc(u.x, u.y, 2.5, 0, 7); ctx.fill();
  }
}

function drawCoins() {
  for (const c of G.coins) {
    if (c.life < 2 && Math.sin(c.t * 18) < 0) continue; // blink before despawn
    const frames = c.lucky ? Sprites.luckyCoin : Sprites.coin;
    const f = frames[Math.floor(c.t * 8) % 4 > 2 ? 1 : Math.floor(c.t * 8) % 4 > 1 ? 2 : Math.floor(c.t * 8) % 2];
    ctx.drawImage(f, (c.x - f.width / 2) | 0, (c.y - f.height / 2) | 0);
    if (c.lucky && Math.random() < 0.1) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(c.x + rand(-12, 12), c.y + rand(-12, 12), 2, 2);
    }
  }
}

function drawParticles() {
  for (const p of G.parts) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.c;
    ctx.fillRect((p.x - p.size / 2) | 0, (p.y - p.size / 2) | 0, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloats() {
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = 1 - f.t / 1.2;
    ctx.fillStyle = f.c;
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawWipe() {
  if (G.wipeFx <= 0) return;
  const r = G.wipeFx * 900;
  ctx.strokeStyle = 'rgba(160,240,180,' + Math.max(0, 1 - G.wipeFx) + ')';
  ctx.lineWidth = 18;
  ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 7); ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 0.9 - G.wipeFx) + ')';
  ctx.beginPath(); ctx.arc(P.x, P.y, r * 0.85, 0, 7); ctx.stroke();
}

// ---------- HUD ----------
function drawHUD() {
  // hearts
  for (let i = 0; i < P.maxHearts; i++) {
    ctx.drawImage(i < P.hearts ? Sprites.heart : Sprites.heartEmpty, 14 + i * 26, 12);
  }
  // weapon + force status, bottom-left
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#9dff8e';
  ctx.fillText('[Q] ' + equippedWeapon().name, 14, H - 38);

  if (save.gifts.wipe > 0) {
    const cd = WIPE_CD[save.gifts.wipe];
    const ready = P.wipeCd <= 0;
    ctx.fillStyle = '#234';
    ctx.fillRect(14, H - 26, 130, 12);
    ctx.fillStyle = ready ? '#aef3b0' : '#5e8a64';
    ctx.fillRect(14, H - 26, 130 * (ready ? 1 : 1 - P.wipeCd / cd), 12);
    ctx.fillStyle = ready ? '#0a2010' : '#cde';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(ready ? '[F] FORCE READY!' : 'force charging...', 18, H - 16);
  }

  // score & beskar, top-right
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#cfe7ff';
  ctx.fillText('SCORE ' + Math.floor(G.score), W - 14, 28);
  ctx.drawImage(Sprites.coin[0], W - 110, 38);
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('+' + G.runBeskar, W - 14, 52);
  ctx.font = '13px monospace';
  ctx.fillStyle = '#8a93b0';
  ctx.fillText('vault ' + save.vault, W - 14, 70);
  ctx.fillText(LEVELS[G.level].name + (save.loop ? '  loop ' + (save.loop + 1) : ''), W - 14, 88);

  // boss bar
  const b = G.boss;
  if (b && !b.entering && G.bossDying <= 0) {
    const bw = 420;
    ctx.fillStyle = '#200a0a';
    ctx.fillRect(W / 2 - bw / 2, 16, bw, 16);
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(W / 2 - bw / 2 + 2, 18, (bw - 4) * Math.max(0, b.hp / b.maxHp), 12);
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#ffd1d1';
    ctx.fillText(LEVELS[G.level].boss.toUpperCase(), W / 2, 48);
  }
}

// ---------- glow text helper ----------
function glowText(txt, x, y, size, color, glow) {
  ctx.textAlign = 'center';
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.shadowColor = glow || color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
  ctx.shadowBlur = 0;
}

// ---------- screens ----------
function drawTitle() {
  G.titleBg.draw(ctx);
  glowText('BESKAR RUN', W / 2, 150, 64, '#cfd8dc', '#6fe3ff');
  glowText('— This is the Way —', W / 2, 195, 20, '#ffd54f');

  // drifting ship
  const sy = 290 + Math.sin(G.t * 1.4) * 12;
  ctx.drawImage(Sprites.player, W / 2 - 44, sy);
  ctx.drawImage(Sprites.grogu, W / 2 - 70, sy - 16 + Math.sin(G.t * 1.8) * 6);
  const fl = 8 + Math.sin(G.t * 30) * 4;
  ctx.fillStyle = '#ffb74d';
  ctx.fillRect(W / 2 - 44 - fl, sy + 16, fl, 5);

  ctx.textAlign = 'center';
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('Vault: ' + save.vault + ' beskar    Best: ' + save.bestScore, W / 2, 380);
  ctx.fillStyle = '#9dff8e';
  ctx.fillText('Next: ' + LEVELS[save.level].name + (save.loop ? '  (loop ' + (save.loop + 1) + ')' : ''), W / 2, 406);

  if (Math.sin(G.t * 3) > -0.4) {
    glowText('PRESS ENTER TO LAUNCH', W / 2, 455, 24, '#fff', '#9dff8e');
  }
  ctx.font = '15px monospace';
  ctx.fillStyle = '#8a93b0';
  ctx.fillText('H hangar · WASD/arrows fly · Q weapon · F force · P pause · M mute', W / 2, 500);
}

function drawPause() {
  ctx.fillStyle = 'rgba(4,6,14,0.7)';
  ctx.fillRect(0, 0, W, H);
  glowText('PAUSED', W / 2, H / 2 - 20, 48, '#cfd8dc', '#6fe3ff');
  ctx.font = '18px monospace';
  ctx.fillStyle = '#9dff8e';
  ctx.textAlign = 'center';
  ctx.fillText('P resume   ·   T quit to title (beskar banks)', W / 2, H / 2 + 30);
}

function drawComplete() {
  ctx.fillStyle = 'rgba(4,6,14,0.6)';
  ctx.fillRect(0, 0, W, H);
  glowText('LEVEL COMPLETE!', W / 2, H / 2 - 70, 52, '#ffd54f', '#ff8a3d');
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#9dff8e';
  ctx.fillText('Boss bonus +' + (G.completeBonus || 0) + ' beskar', W / 2, H / 2 - 20);
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('Run haul: ' + G.runBeskar + ' beskar  →  vault: ' + save.vault, W / 2, H / 2 + 12);
  ctx.fillStyle = '#cfe7ff';
  ctx.fillText('Score: ' + Math.floor(G.score), W / 2, H / 2 + 44);
  if (Math.sin(G.t * 3) > -0.4) {
    ctx.fillStyle = '#fff';
    ctx.fillText('ENTER → hangar', W / 2, H / 2 + 100);
  }
}

function drawDown() {
  ctx.fillStyle = 'rgba(14,4,6,0.65)';
  ctx.fillRect(0, 0, W, H);
  glowText('SHIP DOWN', W / 2, H / 2 - 70, 52, '#ff5e6c', '#ff5252');
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('Your ' + G.runBeskar + ' beskar is safe in the vault! (' + save.vault + ')', W / 2, H / 2 - 16);
  ctx.fillStyle = '#9dff8e';
  ctx.fillText('Spend it in the hangar and fly again — this is the way.', W / 2, H / 2 + 16);
  ctx.fillStyle = '#cfe7ff';
  ctx.fillText('Score: ' + Math.floor(G.score), W / 2, H / 2 + 48);
  if (Math.sin(G.t * 3) > -0.4) {
    ctx.fillStyle = '#fff';
    ctx.fillText('ENTER → hangar', W / 2, H / 2 + 104);
  }
}

// ---------- hangar ----------
const HANGAR_TABS = [
  { name: 'UPGRADES', items: UPGRADES, kind: 'upg' },
  { name: "GROGU'S GIFTS", items: GIFTS, kind: 'gift' },
  { name: 'WEAPONS', items: WEAPONS, kind: 'wpn' },
];

function drawHangar() {
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#0c1018'); gr.addColorStop(1, '#141c2c');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // hangar floor & parked ship
  ctx.fillStyle = '#1a2334'; ctx.fillRect(0, H - 90, W, 90);
  ctx.fillStyle = '#222e44';
  for (let x = 0; x < W; x += 60) ctx.fillRect(x, H - 90, 30, 4);
  ctx.drawImage(Sprites.player, 60, H - 150 + Math.sin(G.t) * 3);
  ctx.drawImage(Sprites.grogu, 36, H - 168 + Math.sin(G.t * 1.4) * 4);

  glowText('THE HANGAR', W / 2, 52, 36, '#cfd8dc', '#6fe3ff');
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('⬤ ' + save.vault + ' beskar', W / 2, 84);

  // tabs
  const hg = G.hangar;
  ctx.font = 'bold 18px monospace';
  HANGAR_TABS.forEach((tb, i) => {
    const x = W / 2 + (i - 1) * 250;
    ctx.fillStyle = i === hg.tab ? '#9dff8e' : '#54607a';
    ctx.fillText((i === hg.tab ? '▶ ' : '') + tb.name, x, 122);
  });

  // items
  const tab = HANGAR_TABS[hg.tab];
  const top = 150, rowH = hg.tab === 2 ? 30 : 46;
  ctx.textAlign = 'left';
  tab.items.forEach((it, i) => {
    const y = top + i * rowH;
    const seld = i === hg.sel;
    if (seld) {
      ctx.fillStyle = 'rgba(110,227,255,0.10)';
      ctx.fillRect(130, y - 18, W - 260, rowH - 4);
    }
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = seld ? '#fff' : '#aebfd0';
    ctx.fillText((seld ? '▶ ' : '  ') + it.name, 140, y);

    ctx.font = '14px monospace';
    if (tab.kind === 'wpn') {
      const owned = save.weapons.includes(it.id);
      const eq = save.equipped === it.id;
      ctx.fillStyle = '#8a93b0';
      ctx.fillText(it.desc, 420, y);
      ctx.textAlign = 'right';
      if (eq) { ctx.fillStyle = '#9dff8e'; ctx.fillText('EQUIPPED', W - 140, y); }
      else if (owned) { ctx.fillStyle = '#6fe3ff'; ctx.fillText('OWNED — ENTER to equip', W - 140, y); }
      else {
        ctx.fillStyle = save.vault >= it.cost ? '#ffd54f' : '#7a5a40';
        ctx.fillText('⬤ ' + it.cost, W - 140, y);
      }
      ctx.textAlign = 'left';
    } else {
      const lvls = tab.kind === 'upg' ? save.upgrades : save.gifts;
      const lvl = lvls[it.id];
      ctx.fillStyle = '#8a93b0';
      ctx.fillText(it.desc + '  ·  ' + it.info(lvl), 420, y);
      // level pips
      for (let p = 0; p < it.max; p++) {
        ctx.fillStyle = p < lvl ? '#ffd54f' : '#39435a';
        ctx.fillRect(140 + p * 16, y + 8, 12, 6);
      }
      ctx.textAlign = 'right';
      if (lvl >= it.max) { ctx.fillStyle = '#9dff8e'; ctx.fillText('MAX', W - 140, y); }
      else {
        const cost = it.costs[lvl];
        ctx.fillStyle = save.vault >= cost ? '#ffd54f' : '#7a5a40';
        ctx.fillText('⬤ ' + cost, W - 140, y);
      }
      ctx.textAlign = 'left';
    }
  });

  ctx.textAlign = 'center';
  ctx.font = 'bold 17px monospace';
  ctx.fillStyle = '#8a93b0';
  ctx.fillText('◀▶ area · ▲▼ pick · ENTER buy/equip · T title', W / 2, H - 44);
  if (Math.sin(G.t * 3) > -0.4) {
    glowText('PRESS  L  TO  LAUNCH  →  ' + LEVELS[save.level].name.toUpperCase(), W / 2, H - 14, 19, '#9dff8e');
  }
}

function hangarBuy() {
  const hg = G.hangar;
  const tab = HANGAR_TABS[hg.tab];
  const it = tab.items[hg.sel];
  if (tab.kind === 'wpn') {
    if (save.weapons.includes(it.id)) {
      save.equipped = it.id;
      Sfx.buy(); storeSave(save);
      return;
    }
    if (save.vault >= it.cost) {
      save.vault -= it.cost;
      save.weapons.push(it.id);
      save.equipped = it.id;
      Sfx.buy(); storeSave(save);
    } else Sfx.deny();
  } else {
    const lvls = tab.kind === 'upg' ? save.upgrades : save.gifts;
    const lvl = lvls[it.id];
    if (lvl >= it.max) { Sfx.deny(); return; }
    const cost = it.costs[lvl];
    if (save.vault >= cost) {
      save.vault -= cost;
      lvls[it.id] = lvl + 1;
      Sfx.buy(); storeSave(save);
    } else Sfx.deny();
  }
}

// ============================================================
// INPUT
// ============================================================
window.addEventListener('keydown', (ev) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  if (ev.repeat) return;
  keys[ev.code] = true;
  Sfx.ensure();

  if (ev.code === 'KeyM') { Sfx.muted = !Sfx.muted; return; }

  switch (G.state) {
    case 'title':
      if (ev.code === 'Enter' || ev.code === 'Space') startRun();
      if (ev.code === 'KeyH') setState('hangar');
      break;
    case 'play':
      if (ev.code === 'KeyP' || ev.code === 'Escape') setState('pause');
      if (ev.code === 'KeyQ' && save.weapons.length > 1) {
        P.weaponIdx = (P.weaponIdx + 1) % save.weapons.length;
        save.equipped = save.weapons[P.weaponIdx];
        addFloat(P.x, P.y - 40, equippedWeapon().name, '#9dff8e');
        Sfx.uiMove();
      }
      if (ev.code === 'KeyF') forceWipe(false);
      break;
    case 'pause':
      if (ev.code === 'KeyP' || ev.code === 'Enter' || ev.code === 'Escape') { setState('play'); Sfx.startMusic(G.level); }
      if (ev.code === 'KeyT') { bankRun(); setState('title'); }
      break;
    case 'complete':
    case 'down':
      if (G.t > 0.6 && (ev.code === 'Enter' || ev.code === 'Space')) setState('hangar');
      break;
    case 'hangar': {
      const hg = G.hangar;
      const items = HANGAR_TABS[hg.tab].items;
      if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') { hg.tab = (hg.tab + 2) % 3; hg.sel = 0; Sfx.uiMove(); }
      if (ev.code === 'ArrowRight' || ev.code === 'KeyD') { hg.tab = (hg.tab + 1) % 3; hg.sel = 0; Sfx.uiMove(); }
      if (ev.code === 'ArrowUp' || ev.code === 'KeyW') { hg.sel = (hg.sel + items.length - 1) % items.length; Sfx.uiMove(); }
      if (ev.code === 'ArrowDown' || ev.code === 'KeyS') { hg.sel = (hg.sel + 1) % items.length; Sfx.uiMove(); }
      if (ev.code === 'Enter') hangarBuy();
      if (ev.code === 'KeyL' || ev.code === 'Space') startRun();
      if (ev.code === 'KeyT' || ev.code === 'Escape') setState('title');
      break;
    }
  }
});
window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  if (G.state === 'play') setState('pause');
});

// ============================================================
// MAIN LOOP
// ============================================================
let lastT = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
