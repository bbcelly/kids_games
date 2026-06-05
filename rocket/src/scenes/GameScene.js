// GameScene — the core loop: fly, auto-shoot, collect beskar, take damage, die.
// On death it banks the run's beskar and routes to the hangar shop.
//
// Controls: move = Arrows/WASD, Q = switch weapon, P = pause. The ship fires
// automatically (auto-shoot), so there's nothing to hold down.

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    const W = CONFIG.width;
    const H = CONFIG.height;

    // --- background ---
    this.stars = this.add.tileSprite(0, 0, W, H, 'startile').setOrigin(0);

    // --- run state (effective stats + loadout from the save) ---
    const saved = Save.load();
    this.stats = computeStats(saved.upgrades);
    this.ownedWeapons = saved.weapons.owned;
    this.activeWeapon = getWeapon(saved.weapons.active);
    this.vault = saved.beskar; // banked total at run start (updates on death)
    this.grogu = computeGrogu(saved.grogu);
    this.maxHull = this.stats.maxHull;
    this.hull = this.maxHull;
    this.runBeskar = 0;
    this.score = 0;
    this.elapsed = 0;
    this.nextWave = 0;
    this.nextFire = 0;
    this.enemyId = 0;
    this.now = 0;
    this.wipeReadyAt = 0;          // Force Wipe ready immediately
    this.nextMend = 0;             // set lazily on first frame
    this.reviveLeft = this.grogu.reviveCharges;
    this.invuln = false;
    this.over = false;
    this.paused = false;
    this.pauseUI = [];

    // --- groups ---
    this.playerBullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.pickups = this.physics.add.group();

    // --- player ---
    this.player = this.physics.add.sprite(120, H / 2, 'ship');
    this.player.setCollideWorldBounds(true);
    this.companion = this.add.image(this.player.x - 26, this.player.y + 16, 'companion');

    // --- input ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown-Q', () => { if (!this.paused && !this.over) this.cycleWeapon(); });
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-R', () => { if (this.paused) this.restartRun(); });
    this.input.keyboard.on('keydown-H', () => { if (this.paused) this.toHangar(); });
    this.input.keyboard.on('keydown-F', () => this.forceWipe());

    // --- collisions ---
    this.physics.add.overlap(this.playerBullets, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.crashIntoEnemy, null, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitByBullet, null, this);
    this.physics.add.overlap(this.player, this.pickups, this.collectBeskar, null, this);

    // --- HUD ---
    const hud = { fontFamily: 'monospace', fontSize: '20px' };
    this.hudHull = this.add.text(14, 12, '', { ...hud, color: '#ff7a6b' }).setDepth(20);
    this.hudScore = this.add.text(W / 2, 12, '', { ...hud, color: '#9fb0d0' })
      .setOrigin(0.5, 0).setDepth(20);
    this.hudVault = this.add.text(W - 14, 12, '', { ...hud, color: '#ffd24a' })
      .setOrigin(1, 0).setDepth(20);
    this.hudBeskar = this.add.text(W - 14, 38, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#fff0a8' })
      .setOrigin(1, 0).setDepth(20);
    this.hudWeapon = this.add.text(14, H - 28, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#7ef0ff' }).setDepth(20);
    this.hudForce = this.add.text(W / 2, H - 26, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#7ef0ff' }).setOrigin(0.5, 0).setDepth(20);
    this.add.text(W - 14, H - 26, 'Q switch · P pause', {
      fontFamily: 'monospace', fontSize: '13px', color: '#667' }).setOrigin(1, 0).setDepth(20);
    this.updateHud();
  }

  update(time, delta) {
    if (this.over || this.paused) return;
    const dt = delta / 1000;
    this.now = time;
    this.elapsed += dt;
    this.stars.tilePositionX += dt * 70;
    this.score += dt * 10;

    this.handleMovement();
    this.handleShooting(time);
    this.handleHoming();
    this.handleMagnet();
    this.handleMend(time);
    this.handleWaves();
    this.handleEnemyFire(time);
    this.cull();
    this.updateHud();
  }

  // ---- input / movement ----
  handleMovement() {
    if (!this.player || !this.player.body) return;
    const sp = this.stats.speed;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) vx = -sp;
    else if (this.cursors.right.isDown || this.keys.D.isDown) vx = sp;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy = -sp;
    else if (this.cursors.down.isDown || this.keys.S.isDown) vy = sp;
    this.player.setVelocity(vx, vy);
    this.companion.x = this.player.x - 26;
    this.companion.y = this.player.y + 16;
  }

  // ---- weapons / shooting (auto-shoot: fires on its own cooldown) ----
  handleShooting(time) {
    if (time > this.nextFire) {
      this.activeWeapon.fire(this, this.player.x + 26, this.player.y);
      this.nextFire = time + this.stats.fireDelay * this.activeWeapon.fireMult;
    }
  }

  // Spawn one player shot. See weapons.js for the opts contract.
  firePlayerShot(x, y, angleDeg, opts = {}) {
    const b = this.playerBullets.create(x, y, opts.tex || 'pbullet');
    const speed = this.stats.bulletSpeed * (opts.speedMult || 1);
    const rad = Phaser.Math.DegToRad(angleDeg);
    b.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed);
    b.setRotation(rad);
    b.damage = opts.damage || 1;
    b.pierce = !!opts.pierce;
    b.homing = !!opts.homing;
    b.homingSpeed = speed;
    return b;
  }

  handleHoming() {
    this.playerBullets.getChildren().forEach((b) => {
      if (!b.homing || !b.active) return;
      const target = this.nearestEnemy(b.x, b.y);
      if (!target) return;
      const desired = Math.atan2(target.y - b.y, target.x - b.x);
      const current = Math.atan2(b.body.velocity.y, b.body.velocity.x);
      const next = Phaser.Math.Angle.RotateTo(current, desired, 0.07);
      b.body.velocity.x = Math.cos(next) * b.homingSpeed;
      b.body.velocity.y = Math.sin(next) * b.homingSpeed;
      b.setRotation(next);
    });
  }

  nearestEnemy(x, y) {
    let best = null;
    let bestD = Infinity;
    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  }

  cycleWeapon() {
    if (this.ownedWeapons.length < 2) return;
    const i = this.ownedWeapons.indexOf(this.activeWeapon.id);
    const next = this.ownedWeapons[(i + 1) % this.ownedWeapons.length];
    this.activeWeapon = getWeapon(next);
    Save.setActiveWeapon(next);
    this.updateHud();
    this.tweens.add({ targets: this.hudWeapon, scale: 1.25, yoyo: true, duration: 120 });
  }

  // ---- Grogu's Force perks ----
  handleMagnet() {
    const r = this.grogu.magnetRadius;
    if (r <= 0 || !this.player) return;
    const r2 = r * r;
    this.pickups.getChildren().forEach((p) => {
      const dx = this.player.x - p.x;
      const dy = this.player.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const d = Math.sqrt(d2) || 1;
        p.setVelocity((dx / d) * 280, (dy / d) * 280);
      }
    });
  }

  handleMend(time) {
    if (this.grogu.mendEvery <= 0) return;
    if (this.nextMend === 0) { this.nextMend = time + this.grogu.mendEvery; return; }
    if (time > this.nextMend) {
      this.nextMend = time + this.grogu.mendEvery;
      if (this.hull < this.maxHull) {
        this.hull += 1;
        this.updateHud();
        this.flashCenter('Grogu mends the hull');
      }
    }
  }

  forceWipe() {
    if (this.over || this.paused || this.grogu.wipeLevel <= 0) return;
    if (this.now < this.wipeReadyAt) return; // on cooldown
    this.wipeReadyAt = this.now + this.grogu.wipeCooldown;
    this.forcePulse();
    this.enemyBullets.clear(true, true);
    this.enemies.getChildren().slice().forEach((e) => { if (e.active) this.killEnemy(e); });
  }

  forcePulse() {
    const ring = this.add.circle(this.player.x, this.player.y, 28, 0x7ef0ff, 0.25)
      .setStrokeStyle(5, 0xbfefff, 0.9).setDepth(15);
    this.tweens.add({ targets: ring, scale: 36, alpha: 0, duration: 450, ease: 'Cubic.out',
      onComplete: () => ring.destroy() });
  }

  flashCenter(msg) {
    const t = this.add.text(CONFIG.width / 2, CONFIG.height / 2 - 120, msg, {
      fontFamily: 'monospace', fontSize: '24px', color: '#7ef0ff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(32);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 1200,
      onComplete: () => t.destroy() });
  }

  // ---- spawning ----
  handleWaves() {
    while (this.nextWave < WAVES.length && this.elapsed >= WAVES[this.nextWave].at) {
      this.spawnWave(WAVES[this.nextWave]);
      this.nextWave++;
    }
    if (this.nextWave >= WAVES.length && !this.endlessTimer) {
      this.startEndless();
    }
  }

  spawnWave(wave) {
    for (let i = 0; i < wave.count; i++) {
      this.time.delayedCall(i * 450, () => this.spawnEnemy(wave.type));
    }
  }

  startEndless() {
    this.endlessDelay = 1200;
    this.endlessTimer = this.time.addEvent({
      delay: this.endlessDelay, loop: true,
      callback: () => {
        if (this.over) return;
        this.spawnEnemy(Math.random() < 0.6 ? 'grunt' : 'shooter');
        if (this.endlessDelay > 450) {
          this.endlessDelay -= 30;
          this.endlessTimer.reset({ delay: this.endlessDelay, loop: true,
            callback: this.endlessTimer.callback, callbackScope: this });
        }
      },
    });
  }

  spawnEnemy(type) {
    if (this.over) return;
    const def = CONFIG.enemies[type];
    const y = Phaser.Math.Between(40, CONFIG.height - 40);
    const e = this.enemies.create(CONFIG.width + 30, y, def.texture);
    e.enemyType = type;
    e.hp = def.hp;
    e.reward = def.reward;
    e.eid = this.enemyId++;
    e.setVelocityX(-def.speed);
    e.setVelocityY(Phaser.Math.Between(-25, 25));
  }

  handleEnemyFire(time) {
    const def = CONFIG.enemies.shooter;
    this.enemies.getChildren().forEach((e) => {
      if (e.enemyType !== 'shooter') return;
      if (e.nextShot === undefined) e.nextShot = time + def.fireEvery;
      if (time > e.nextShot && e.x < CONFIG.width) {
        const b = this.enemyBullets.create(e.x - 18, e.y, 'ebullet');
        b.setVelocityX(-def.bulletSpeed);
        e.nextShot = time + def.fireEvery;
      }
    });
  }

  // ---- collisions ----
  // NOTE: Phaser normalizes overlap(group, sprite) to call back sprite-first,
  // so we never assume argument order — we identify each object explicitly and
  // never destroy the player by accident.
  hitEnemy(a, b) {
    const enemy = this.enemies.contains(a) ? a : b;
    const bullet = enemy === a ? b : a;
    if (!enemy || !enemy.active || !bullet || !bullet.active) return;

    if (bullet.pierce) {
      // a beam can hit many enemies, but each only once
      if (!bullet.hitIds) bullet.hitIds = [];
      if (bullet.hitIds.includes(enemy.eid)) return;
      bullet.hitIds.push(enemy.eid);
    } else {
      bullet.destroy();
    }
    enemy.hp -= (bullet.damage || 1);
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    } else {
      enemy.setTintFill(0xffffff);
      this.time.delayedCall(60, () => enemy.active && enemy.clearTint());
    }
  }

  crashIntoEnemy(a, b) {
    const enemy = a === this.player ? b : a;
    if (!enemy || !enemy.active) return;
    this.killEnemy(enemy);
    this.damage();
  }

  hitByBullet(a, b) {
    const bullet = a === this.player ? b : a;
    if (bullet) bullet.destroy();
    this.damage();
  }

  collectBeskar(a, b) {
    const pickup = a === this.player ? b : a;
    if (!pickup || !pickup.active) return;
    this.runBeskar += pickup.value;
    pickup.destroy();
  }

  // ---- effects / state ----
  killEnemy(enemy) {
    this.score += enemy.reward;
    // Lucky Frog: a chance for a bonus (multiplied) beskar drop.
    let value = enemy.reward;
    const lucky = this.grogu.luckyChance > 0 && Math.random() < this.grogu.luckyChance;
    if (lucky) value = Math.round(value * this.grogu.luckyMult);
    this.dropBeskar(enemy.x, enemy.y, value, lucky);
    this.boom(enemy.x, enemy.y);
    enemy.destroy();
  }

  dropBeskar(x, y, value, lucky) {
    const p = this.pickups.create(x, y, 'beskar');
    p.value = value;
    p.setVelocityX(-CONFIG.beskar.dropSpeed);
    if (lucky) p.setTint(0x9a5cff); // bonus drops look special
    this.tweens.add({ targets: p, angle: 360, repeat: -1, duration: 1200 });
  }

  boom(x, y) {
    const flash = this.add.image(x, y, 'ebullet').setScale(2).setTint(0xffd24a);
    this.tweens.add({ targets: flash, scale: 4, alpha: 0, duration: 220,
      onComplete: () => flash.destroy() });
  }

  damage() {
    if (this.invuln || this.over) return;
    this.hull -= 1;
    this.updateHud();
    if (this.hull <= 0) {
      if (this.reviveLeft > 0) { this.forceRevive(); return; }
      this.endRun();
      return;
    }
    this.invuln = true;
    this.player.setTint(0xff6666);
    this.tweens.add({ targets: this.player, alpha: 0.3, yoyo: true,
      repeat: 5, duration: 110, onComplete: () => { this.player.alpha = 1; } });
    this.time.delayedCall(1000, () => {
      this.invuln = false;
      if (this.player.active) this.player.clearTint();
    });
  }

  // Force Bond: Grogu pulls you back from the brink instead of dying.
  forceRevive() {
    this.reviveLeft -= 1;
    this.hull = Math.min(this.maxHull, 2);
    this.updateHud();
    this.forcePulse();
    this.enemyBullets.clear(true, true);
    this.flashCenter('Grogu used the Force!');
    this.invuln = true;
    this.player.setTint(0x7ef0ff);
    this.tweens.add({ targets: this.player, alpha: 0.3, yoyo: true,
      repeat: 8, duration: 120, onComplete: () => { this.player.alpha = 1; } });
    this.time.delayedCall(1600, () => {
      this.invuln = false;
      if (this.player.active) this.player.clearTint();
    });
  }

  // bank the run's beskar exactly once
  bankRun() {
    if (this.runBeskar > 0) {
      Save.addBeskar(this.runBeskar);
      this.runBeskar = 0;
    }
  }

  endRun() {
    this.over = true;
    this.physics.pause();
    if (this.endlessTimer) this.endlessTimer.remove();
    this.bankRun();

    const W = CONFIG.width;
    const H = CONFIG.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(30);
    this.add.text(W / 2, H / 2 - 60, 'SHIP DOWN', {
      fontFamily: 'monospace', fontSize: '56px', color: '#ff7a6b', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(31);
    this.add.text(W / 2, H / 2, '◈ ' + Save.load().beskar + ' beskar in the vault', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffd24a',
    }).setOrigin(0.5).setDepth(31);

    const prompt = this.add.text(W / 2, H / 2 + 70, 'Press SPACE for the Hangar', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(31);
    this.tweens.add({ targets: prompt, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 });

    this.time.delayedCall(600, () => {
      this.input.keyboard.once('keydown-SPACE', () => this.scene.start('Shop'));
    });
  }

  // ---- pause menu ----
  togglePause() {
    if (this.over) return;
    if (this.paused) this.resumeGame();
    else this.pauseGame();
  }

  pauseGame() {
    this.paused = true;
    this.physics.pause();
    this.time.paused = true;
    this.tweens.pauseAll();

    const W = CONFIG.width;
    const H = CONFIG.height;
    const mk = (dy, txt, color, size) => this.add.text(W / 2, H / 2 + dy, txt, {
      fontFamily: 'monospace', fontSize: size + 'px', color, fontStyle: dy < -60 ? 'bold' : 'normal',
    }).setOrigin(0.5).setDepth(41);
    this.pauseUI = [
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.66).setDepth(40),
      mk(-90, 'PAUSED', '#ffd24a', 52),
      mk(-10, '[P]  Resume', '#7fe07f', 24),
      mk(30, '[R]  Restart run', '#ffffff', 24),
      mk(70, '[H]  Go to Hangar', '#ffffff', 24),
    ];
  }

  resumeGame() {
    this.pauseUI.forEach((o) => o.destroy());
    this.pauseUI = [];
    this.tweens.resumeAll();
    this.time.paused = false;
    this.physics.resume();
    this.paused = false;
  }

  // leave time/physics in a clean state before swapping scenes
  clearPause() {
    this.tweens.resumeAll();
    this.time.paused = false;
    this.physics.resume();
    this.paused = false;
  }

  restartRun() {
    this.bankRun();
    this.clearPause();
    this.scene.restart();
  }

  toHangar() {
    this.bankRun();
    this.clearPause();
    this.scene.start('Shop');
  }

  // ---- housekeeping ----
  cull() {
    const W = CONFIG.width;
    const H = CONFIG.height;
    const off = (o) => o.x > W + 60 || o.x < -60 || o.y < -60 || o.y > H + 60;
    this.playerBullets.getChildren().forEach((b) => { if (off(b)) b.destroy(); });
    this.enemyBullets.getChildren().forEach((b) => { if (b.x < -40) b.destroy(); });
    this.enemies.getChildren().forEach((e) => { if (e.x < -50) e.destroy(); });
    this.pickups.getChildren().forEach((p) => { if (p.x < -40) p.destroy(); });
  }

  updateHud() {
    const full = '♥'.repeat(Math.max(0, this.hull));
    const lost = '·'.repeat(Math.max(0, this.maxHull - this.hull));
    this.hudHull.setText('HULL ' + full + lost);
    this.hudScore.setText('SCORE ' + Math.floor(this.score));
    this.hudVault.setText('VAULT ◈ ' + this.vault);
    this.hudBeskar.setText('+ ' + this.runBeskar + ' this run');
    const more = this.ownedWeapons.length > 1 ? '  [Q]' : '';
    this.hudWeapon.setText('▸ ' + this.activeWeapon.label + more);

    // Force abilities indicator (only shows what you own)
    let force = '';
    let ready = false;
    if (this.grogu.wipeLevel > 0) {
      const cd = Math.max(0, this.wipeReadyAt - this.now);
      ready = cd <= 0;
      force = ready ? 'FORCE WIPE [F] ready' : 'FORCE WIPE [F] ' + Math.ceil(cd / 1000) + 's';
    }
    if (this.reviveLeft > 0) force += (force ? '   ' : '') + 'BOND x' + this.reviveLeft;
    this.hudForce.setText(force);
    this.hudForce.setColor(ready ? '#7ef0ff' : '#5a8aa0');
  }
}
