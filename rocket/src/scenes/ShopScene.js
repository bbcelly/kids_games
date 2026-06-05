// ShopScene — the hangar. Three columns: stat UPGRADES, GROGU's Force perks,
// and WEAPONS. Navigate with arrows/WASD, ENTER buys/equips the selected item,
// SPACE launches. Columns are driven by the UPGRADES / GROGU_PERKS / WEAPONS
// registries, so adding an entry there shows up here automatically.

class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    const W = CONFIG.width;
    const H = CONFIG.height;

    this.stars = this.add.tileSprite(0, 0, W, H, 'startile').setOrigin(0);
    this.col = 0;
    this.row = 0;

    this.add.text(W / 2, 36, 'HANGAR', {
      fontFamily: 'monospace', fontSize: '42px', color: '#ffd24a', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.balanceText = this.add.text(W / 2, 76, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffd24a',
    }).setOrigin(0.5);
    this.flash = this.add.text(W / 2, 104, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#8f8',
    }).setOrigin(0.5);

    // column definitions
    this.cols = [
      { title: 'UPGRADES', kind: 'upgrade', list: UPGRADES, x: 28 },
      { title: "GROGU'S GIFTS", kind: 'grogu', list: GROGU_PERKS, x: W * 0.37 },
      { title: 'WEAPONS', kind: 'weapon', list: WEAPONS, x: W * 0.67 },
    ];
    const headerY = 138;
    const rowY0 = 172;
    const rowH = 29;
    this.cols.forEach((c) => {
      this.add.text(c.x, headerY, c.title, {
        fontFamily: 'monospace', fontSize: '17px', color: '#9fb0d0' });
      c.rowTexts = c.list.map((it, i) =>
        this.add.text(c.x, rowY0 + i * rowH, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff' }));
    });

    this.detail = this.add.text(W / 2, H - 92, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#cdd6e6',
    }).setOrigin(0.5);
    this.add.text(W / 2, H - 58, '↑↓←→ move   ENTER buy/equip   R reset all', {
      fontFamily: 'monospace', fontSize: '15px', color: '#667' }).setOrigin(0.5);
    const launch = this.add.text(W / 2, H - 30, 'Press SPACE to LAUNCH', {
      fontFamily: 'monospace', fontSize: '22px', color: '#7fe07f', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({ targets: launch, alpha: 0.35, yoyo: true, repeat: -1, duration: 700 });

    this.refresh();

    this.ready = false;
    this.time.delayedCall(400, () => { this.ready = true; });

    this.input.keyboard.on('keydown', (e) => {
      switch (e.code) {
        case 'ArrowUp': case 'KeyW': this.move(0, -1); break;
        case 'ArrowDown': case 'KeyS': this.move(0, 1); break;
        case 'ArrowLeft': case 'KeyA': this.move(-1, 0); break;
        case 'ArrowRight': case 'KeyD': this.move(1, 0); break;
        case 'Enter': case 'NumpadEnter': this.activate(); break;
        case 'Space': if (this.ready) this.scene.start('Game'); break;
        case 'KeyR': Save.reset(); this.showFlash('All progress reset.', '#ff7a6b'); this.refresh(); break;
        default: break;
      }
    });
  }

  move(dCol, dRow) {
    this.col = Phaser.Math.Clamp(this.col + dCol, 0, this.cols.length - 1);
    this.row += dRow;
    this.row = Phaser.Math.Clamp(this.row, 0, this.cols[this.col].list.length - 1);
    this.refresh();
  }

  activate() {
    const c = this.cols[this.col];
    const it = c.list[this.row];
    if (c.kind === 'upgrade') {
      const r = Save.buy(it.id);
      if (r.ok) this.showFlash('Upgraded ' + it.label + '!', '#8f8');
      else this.showFlash(r.reason === 'max' ? it.label + ' is maxed out.'
        : 'Not enough beskar for ' + it.label + '.', r.reason === 'max' ? '#ffd24a' : '#ff7a6b');
    } else if (c.kind === 'grogu') {
      const r = Save.buyGrogu(it.id);
      if (r.ok) this.showFlash('Grogu learned ' + it.label + '!', '#8f8');
      else this.showFlash(r.reason === 'max' ? it.label + ' is maxed out.'
        : 'Not enough beskar for ' + it.label + '.', r.reason === 'max' ? '#ffd24a' : '#ff7a6b');
    } else {
      const r = Save.buyWeapon(it.id);
      if (r.ok && r.reason === 'equipped') this.showFlash('Equipped ' + it.label + '.', '#7ef0ff');
      else if (r.ok) this.showFlash('Bought ' + it.label + '!', '#8f8');
      else this.showFlash('Not enough beskar for ' + it.label + '.', '#ff7a6b');
    }
    this.refresh();
  }

  showFlash(msg, color) {
    this.flash.setText(msg).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.flash);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 1800, delay: 700 });
  }

  refresh() {
    const state = Save.load();
    this.balanceText.setText('◈ ' + state.beskar + ' beskar');

    this.cols.forEach((c, ci) => {
      c.list.forEach((it, i) => {
        const sel = this.col === ci && this.row === i;
        const mark = sel ? '▸ ' : '  ';
        if (c.kind === 'weapon') {
          const owned = state.weapons.owned.includes(it.id);
          const active = state.weapons.active === it.id;
          const status = active ? '◆' : owned ? '✓' : '◈' + it.cost;
          c.rowTexts[i].setText(mark + it.label + '  ' + status);
          const afford = owned || state.beskar >= it.cost;
          c.rowTexts[i].setColor(sel ? '#7ef0ff' : active ? '#7fe07f' : owned ? '#cdd6e6' : afford ? '#fff' : '#9a6a6a');
        } else {
          const levels = c.kind === 'upgrade' ? state.upgrades : state.grogu;
          const level = levels[it.id] || 0;
          const dots = '●'.repeat(level) + '○'.repeat(it.maxLevel - level);
          c.rowTexts[i].setText(mark + it.label + ' ' + dots);
          const cost = (c.kind === 'upgrade' ? upgradeCost : groguCost)(it, level);
          const maxed = level >= it.maxLevel;
          const afford = !maxed && state.beskar >= cost;
          c.rowTexts[i].setColor(sel ? '#7ef0ff' : maxed ? '#7a7f8c' : afford ? '#fff' : '#9a6a6a');
        }
      });
    });

    this.detail.setText(this.detailFor(state));
  }

  detailFor(state) {
    const c = this.cols[this.col];
    const it = c.list[this.row];
    if (c.kind === 'weapon') {
      const owned = state.weapons.owned.includes(it.id);
      const active = state.weapons.active === it.id;
      const tail = active ? 'EQUIPPED' : owned ? 'OWNED — ENTER to equip' : 'cost ◈' + it.cost;
      return it.desc + '  —  ' + tail;
    }
    const levels = c.kind === 'upgrade' ? state.upgrades : state.grogu;
    const level = levels[it.id] || 0;
    const cost = (c.kind === 'upgrade' ? upgradeCost : groguCost)(it, level);
    const tail = level >= it.maxLevel ? 'MAXED' : 'next ◈' + cost;
    return it.desc + '  —  ' + tail;
  }

  update(time, delta) {
    this.stars.tilePositionX += (delta / 1000) * 30;
  }
}
