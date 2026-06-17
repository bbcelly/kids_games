// GameScene — the core loop for one LEVEL: clear the waves, then beat the boss.
// Death banks beskar and returns to the hangar (retry same level). Beating the
// boss advances to the next level.
//
// Controls: move = Arrows/WASD, Q = switch weapon, F = Force Wipe, P = pause.
// The ship fires automatically (auto-shoot).

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    const W = CONFIG.width;
    const H = CONFIG.height;

    // --- which level are we on? ---
    const saved = Save.load();
    this.levelIndex = Phaser.Math.Clamp(saved.level || 0, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.waves = this.level.waves;
    this.lap = saved.lap || 0;

    // Difficulty rises with every level and keeps climbing each loop.
    this.stage = this.lap * LEVELS.length + this.levelIndex;
    this.diff = computeDifficulty(this.stage);
    this.shooterFireEvery = CONFIG.enemies.shooter.fireEvery * this.diff.fireMult;
    this.shooterBulletSpeed = CONFIG.enemies.shooter.bulletSpeed * this.diff.bulletMult;

    // --- background (themed parallax layers + drifting props per level) ---
    this.buildBackground(W, H);

    // --- run state (effective stats + loadout from the save) ---
    this.stats = computeStats(saved.upgrades);
    this.ownedWeapons = saved.weapons.owned;
    this.activeWeapon = getWeapon(saved.weapons.active);
    this.vault = saved.beskar;
    this.grogu = computeGrogu(saved.grogu);
    this.maxHull = this.stats.maxHull;
    this.hull = this.maxHull;
    this.runBeskar = 0;
    this.score = 0;
    this.elapsed = 0;
    this.nextWave = 0;
    this.pendingSpawns = 0;
    this.nextFire = 0;
    this.enemyId = 0;
    this.now = 0;
    this.wipeReadyAt = 0;
    this.nextMend = 0;
    this.reviveLeft = this.grogu.reviveCharges;
    this.invuln = false;
    this.over = false;     // ship destroyed
    this.won = false;      // level cleared
    this.paused = false;
    this.pauseUI = [];
    this.boss = null;
    this.bossPending = false;

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
    this.input.keyboard.on('keydown-Q', () => { if (!this.paused && !this.over && !this.won) this.cycleWeapon(); });
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-R', () => { if (this.paused) this.restartRun(); });
    this.input.keyboard.on('keydown-H', () => { if (this.paused) this.toHangar(); });
    this.input.keyboard.on('keydown-F', () => this.forceWipe());

    // --- collisions (enemy waves; boss overlaps are added when it spawns) ---
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
    this.add.text(W - 14, H - 26, 'Q switch · F force · P pause', {
      fontFamily: 'monospace', fontSize: '13px', color: '#667' }).setOrigin(1, 0).setDepth(20);
    this.updateHud();

    const lapTag = this.lap > 0 ? '  ·  LOOP ' + (this.lap + 1) : '';
    this.flashCenter('LEVEL ' + (this.levelIndex + 1) + ' · ' + this.level.name + lapTag);
  }

  // ---- background (parallax layers + drifting decor) ----
  // Builds a data-driven stack from this.level.bg (far -> near). Falls back to
  // the old single tinted starfield if a level has no bg block. All layers and
  // props live in a reserved negative depth band so they never cover gameplay
  // (player/enemies at depth 0) or the HUD (depth 20).
  buildBackground(W, H) {
    this.bgLayers = [];
    this.props = [];
    this.bgProps = null;
    this.nextProp = 0;

    const bg = this.level.bg;
    if (!bg || !bg.layers) {
      // fallback: original behavior
      const stars = this.add.tileSprite(0, 0, W, H, 'startile')
        .setOrigin(0).setTint(this.level.tint).setDepth(-100);
      this.bgLayers.push({ sprite: stars, speed: 70 });
      return;
    }

    bg.layers.forEach((layer, i) => {
      const y = layer.y || 0;
      const h = layer.height || H;
      const sprite = this.add.tileSprite(0, y, W, h, layer.tex)
        .setOrigin(0).setDepth(-100 + i);
      if (layer.tint != null) sprite.setTint(layer.tint);
      this.bgLayers.push({ sprite: sprite, speed: layer.speed || 0 });
    });

    this.bgProps = bg.props || null;
    if (this.bgProps) {
      this.nextProp = Phaser.Math.Between(this.bgProps.everyMin, this.bgProps.everyMax);
    }
  }

  spawnProp() {
    const p = this.bgProps;
    const tex = Phaser.Utils.Array.GetRandom(p.textures);
    // keep props out of the top HUD band and the very bottom
    const y = Phaser.Math.Between(60, CONFIG.height - 60);
    const img = this.add.image(CONFIG.width + 40, y, tex).setDepth(-50);
    img.setScale(0.8 + Math.random() * 0.9);
    this.props.push({
      img: img,
      speed: Phaser.Math.Between(p.speedMin, p.speedMax),
      spin: p.spin ? (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random()) : 0,
    });
  }

  updateBackground(dt) {
    for (let i = 0; i < this.bgLayers.length; i++) {
      const layer = this.bgLayers[i];
      layer.sprite.tilePositionX += dt * layer.speed;
    }
    if (this.bgProps) {
      if (this.now >= this.nextProp) {
        this.spawnProp();
        this.nextProp = this.now + Phaser.Math.Between(this.bgProps.everyMin, this.bgProps.everyMax);
      }
      for (let i = this.props.length - 1; i >= 0; i--) {
        const prop = this.props[i];
        prop.img.x -= prop.speed * dt;
        if (prop.spin) prop.img.rotation += prop.spin * dt;
        if (prop.img.x < -40) {
          prop.img.destroy();
          this.props.splice(i, 1);
        }
      }
    }
  }

  update(time, delta) {
    if (this.over || this.won || this.paused) return;
    const dt = delta / 1000;
    this.now = time;
    this.elapsed += dt;
    this.updateBackground(dt);
    this.score += dt * 10;

    this.handleMovement();
    this.handleShooting(time);
    this.handleHoming();
    this.handleMagnet();
    this.handleMend(time);
    this.handleWaves();
    this.handleBossTrigger();
    this.updateBoss(time);
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

  // ---- weapons / shooting (auto-shoot) ----
  handleShooting(time) {
    if (time > this.nextFire) {
      this.activeWeapon.fire(this, this.player.x + 26, this.player.y);
      this.nextFire = time + this.stats.fireDelay * this.activeWeapon.fireMult;
    }
  }

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
      const target = this.nearestTarget(b.x, b.y);
      if (!target) return;
      const desired = Math.atan2(target.y - b.y, target.x - b.x);
      const current = Math.atan2(b.body.velocity.y, b.body.velocity.x);
      const next = Phaser.Math.Angle.RotateTo(current, desired, 0.07);
      b.body.velocity.x = Math.cos(next) * b.homingSpeed;
      b.body.velocity.y = Math.sin(next) * b.homingSpeed;
      b.setRotation(next);
    });
  }

  nearestTarget(x, y) {
    let best = null;
    let bestD = Infinity;
    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bestD) { bestD = d; best = e; }
    });
    if (this.boss && this.boss.active) {
      const d = (this.boss.x - x) * (this.boss.x - x) + (this.boss.y - y) * (this.boss.y - y);
      if (d < bestD) best = this.boss;
    }
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
    if (this.over || this.won || this.paused || this.grogu.wipeLevel <= 0) return;
    if (this.now < this.wipeReadyAt) return;
    this.wipeReadyAt = this.now + this.grogu.wipeCooldown;
    this.forcePulse();
    this.enemyBullets.clear(true, true);
    this.enemies.getChildren().slice().forEach((e) => { if (e.active) this.killEnemy(e); });
    // a Force Wipe also chips the boss
    if (this.boss && this.boss.active) {
      this.boss.hp -= 5;
      if (this.boss.hp <= 0) this.defeatBoss();
    }
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

  // ---- waves ----
  handleWaves() {
    while (this.nextWave < this.waves.length && this.elapsed >= this.waves[this.nextWave].at) {
      this.spawnWave(this.waves[this.nextWave]);
      this.nextWave++;
    }
  }

  spawnWave(wave) {
    const count = wave.count + this.diff.countBonus;
    for (let i = 0; i < count; i++) {
      this.pendingSpawns++;
      this.time.delayedCall(i * 450, () => {
        this.pendingSpawns--;
        this.spawnEnemy(wave.type);
      });
    }
  }

  spawnEnemy(type) {
    if (this.over || this.won) return;
    const def = CONFIG.enemies[type];
    const y = Phaser.Math.Between(40, CONFIG.height - 40);
    const e = this.enemies.create(CONFIG.width + 30, y, def.texture);
    e.enemyType = type;
    e.hp = def.hp + this.diff.hpBonus;
    e.reward = def.reward;
    e.eid = this.enemyId++;
    e.setVelocityX(-def.speed * this.diff.speedMult);
    e.setVelocityY(Phaser.Math.Between(-25, 25) * this.diff.speedMult);
  }

  handleEnemyFire(time) {
    this.enemies.getChildren().forEach((e) => {
      if (e.enemyType !== 'shooter') return;
      if (e.nextShot === undefined) e.nextShot = time + this.shooterFireEvery;
      if (time > e.nextShot && e.x < CONFIG.width) {
        const b = this.enemyBullets.create(e.x - 18, e.y, 'ebullet');
        b.setVelocityX(-this.shooterBulletSpeed);
        e.nextShot = time + this.shooterFireEvery;
      }
    });
  }

  // ---- boss ----
  // Once every wave has been dispatched and the screen is clear, the boss enters.
  handleBossTrigger() {
    if (this.boss || this.bossPending) return;
    if (this.nextWave < this.waves.length) return;
    if (this.pendingSpawns > 0 || this.enemies.getLength() > 0) return;
    this.bossPending = true;
    this.flashCenter('⚠  ' + this.level.boss.name.toUpperCase() + ' INCOMING');
    this.time.delayedCall(1600, () => this.spawnBoss());
  }

  spawnBoss() {
    if (this.over || this.won) return;
    const W = CONFIG.width;
    const H = CONFIG.height;
    const def = this.level.boss;
    const boss = this.physics.add.sprite(W + 100, H / 2, def.texture);
    boss.hp = Math.round(def.hp * this.diff.bossMult);
    boss.maxHp = boss.hp;
    boss.bossName = def.name;
    boss.pattern = def.pattern;
    boss.bulletSpeed = def.bulletSpeed * this.diff.bulletMult;
    boss.fireEvery = def.fireEvery * this.diff.fireMult;
    boss.speedY = def.speedY;
    boss.reward = def.reward;
    boss.entering = true;
    boss.targetX = W * 0.8;
    boss.nextShot = this.now + 1500;
    boss.setVelocityX(-170);
    this.boss = boss;

    this.physics.add.overlap(this.playerBullets, boss, this.hitBoss, null, this);
    this.physics.add.overlap(this.player, boss, this.crashIntoBoss, null, this);

    // boss health bar
    this.bossLabel = this.add.text(W / 2, 40, def.name, {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd24a' }).setOrigin(0.5).setDepth(21);
    this.bossBarBg = this.add.rectangle(W / 2, 62, 404, 16, 0x10151f, 0.85)
      .setStrokeStyle(2, 0x55617f).setDepth(20);
    this.bossBarFill = this.add.rectangle(W / 2 - 200, 62, 400, 10, 0xff5a3c)
      .setOrigin(0, 0.5).setDepth(21);
  }

  updateBoss(time) {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    if (boss.entering) {
      if (boss.x <= boss.targetX) {
        boss.x = boss.targetX;
        boss.entering = false;
        boss.setVelocity(0, boss.speedY);
      }
      return;
    }
    if (boss.y <= 90 && boss.body.velocity.y < 0) boss.setVelocityY(Math.abs(boss.speedY));
    else if (boss.y >= CONFIG.height - 90 && boss.body.velocity.y > 0) boss.setVelocityY(-Math.abs(boss.speedY));
    if (time > boss.nextShot) {
      boss.nextShot = time + boss.fireEvery;
      this.bossFire();
    }
    this.bossBarFill.scaleX = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
  }

  bossShot(angleDeg, speed) {
    const b = this.enemyBullets.create(this.boss.x - 40, this.boss.y, 'ebullet');
    const rad = Phaser.Math.DegToRad(angleDeg);
    b.setVelocity(Math.cos(rad) * speed, Math.sin(rad) * speed);
  }

  bossFire() {
    const sp = this.boss.bulletSpeed;
    if (this.boss.pattern === 'spread') {
      [165, 180, 195].forEach((a) => this.bossShot(a, sp));
    } else if (this.boss.pattern === 'aimed') {
      const a = Phaser.Math.RadToDeg(Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x));
      this.bossShot(a, sp);
    } else { // burst: 3 shots fanned around the player's direction
      const base = Phaser.Math.RadToDeg(Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x));
      [-12, 0, 12].forEach((d) => this.bossShot(base + d, sp));
    }
  }

  hitBoss(a, b) {
    const bullet = this.playerBullets.contains(a) ? a : b;
    if (!this.boss || !this.boss.active || !bullet || !bullet.active) return;
    if (bullet.pierce) {
      if (!bullet.hitIds) bullet.hitIds = [];
      if (bullet.hitIds.includes('boss')) return;
      bullet.hitIds.push('boss');
    } else {
      bullet.destroy();
    }
    this.boss.hp -= (bullet.damage || 1);
    this.boss.setTintFill(0xffffff);
    this.time.delayedCall(50, () => this.boss && this.boss.active && this.boss.clearTint());
    if (this.boss.hp <= 0) this.defeatBoss();
  }

  crashIntoBoss() {
    this.damage();
  }

  defeatBoss() {
    const boss = this.boss;
    if (!boss) return;
    const bx = boss.x;
    const by = boss.y;
    const reward = boss.reward;
    this.boss = null;
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 70, () =>
        this.boom(bx + Phaser.Math.Between(-40, 40), by + Phaser.Math.Between(-30, 30)));
    }
    boss.destroy();
    this.bossLabel.destroy();
    this.bossBarBg.destroy();
    this.bossBarFill.destroy();
    this.enemyBullets.clear(true, true);
    this.runBeskar += reward;
    this.score += reward * 2;
    this.updateHud();
    this.time.delayedCall(800, () => this.levelComplete());
  }

  // ---- collisions ----
  hitEnemy(a, b) {
    const enemy = this.enemies.contains(a) ? a : b;
    const bullet = enemy === a ? b : a;
    if (!enemy || !enemy.active || !bullet || !bullet.active) return;
    if (bullet.pierce) {
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
    if (lucky) p.setTint(0x9a5cff);
    this.tweens.add({ targets: p, angle: 360, repeat: -1, duration: 1200 });
  }

  boom(x, y) {
    const flash = this.add.image(x, y, 'ebullet').setScale(2).setTint(0xffd24a);
    this.tweens.add({ targets: flash, scale: 4, alpha: 0, duration: 220,
      onComplete: () => flash.destroy() });
  }

  damage() {
    if (this.invuln || this.over || this.won) return;
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

  bankRun() {
    if (this.runBeskar > 0) {
      Save.addBeskar(this.runBeskar);
      this.runBeskar = 0;
    }
  }

  endRun() {
    this.over = true;
    this.physics.pause();
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

  levelComplete() {
    if (this.won) return;
    this.won = true;
    this.physics.pause();
    this.bankRun();

    const next = this.levelIndex + 1;
    const hasNext = next < LEVELS.length;
    // advance the level; after the finale, loop to level 1 but bump the lap so
    // difficulty keeps climbing.
    Save.setProgress(hasNext ? next : 0, hasNext ? this.lap : this.lap + 1);

    const W = CONFIG.width;
    const H = CONFIG.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(30);
    this.add.text(W / 2, H / 2 - 70, 'LEVEL COMPLETE', {
      fontFamily: 'monospace', fontSize: '52px', color: '#7fe07f', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(31);
    const sub = hasNext ? 'Next: ' + LEVELS[next].name
      : 'GALAXY SAVED! A new run begins — keep your gear.';
    this.add.text(W / 2, H / 2 - 10, sub, {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffd24a',
    }).setOrigin(0.5).setDepth(31);
    this.add.text(W / 2, H / 2 + 28, '◈ ' + Save.load().beskar + ' beskar in the vault', {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff0a8',
    }).setOrigin(0.5).setDepth(31);

    const prompt = this.add.text(W / 2, H / 2 + 80, 'Press SPACE for the Hangar', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(31);
    this.tweens.add({ targets: prompt, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 });

    this.time.delayedCall(600, () => {
      this.input.keyboard.once('keydown-SPACE', () => this.scene.start('Shop'));
    });
  }

  // ---- pause menu ----
  togglePause() {
    if (this.over || this.won) return;
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
    this.enemyBullets.getChildren().forEach((b) => { if (off(b)) b.destroy(); });
    this.enemies.getChildren().forEach((e) => { if (e.x < -50) e.destroy(); });
    this.pickups.getChildren().forEach((p) => { if (p.x < -40) p.destroy(); });
  }

  updateHud() {
    const full = '♥'.repeat(Math.max(0, this.hull));
    const lost = '·'.repeat(Math.max(0, this.maxHull - this.hull));
    this.hudHull.setText('HULL ' + full + lost);
    this.hudScore.setText('LVL ' + (this.levelIndex + 1) + '  SCORE ' + Math.floor(this.score));
    this.hudVault.setText('VAULT ◈ ' + this.vault);
    this.hudBeskar.setText('+ ' + this.runBeskar + ' this run');

    const more = this.ownedWeapons.length > 1 ? '  [Q]' : '';
    this.hudWeapon.setText('▸ ' + this.activeWeapon.label + more);

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
