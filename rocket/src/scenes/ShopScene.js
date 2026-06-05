// ShopScene — the hangar. Two columns: stat UPGRADES (left) and WEAPONS (right).
// Navigate with arrows/WASD, ENTER buys/equips the selected item, SPACE launches.
// Rows come straight from the UPGRADES and WEAPONS registries.

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

    this.add.text(W / 2, 40, 'HANGAR', {
      fontFamily: 'monospace', fontSize: '44px', color: '#ffd24a', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.balanceText = this.add.text(W / 2, 84, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffd24a',
    }).setOrigin(0.5);
    this.flash = this.add.text(W / 2, 112, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#8f8',
    }).setOrigin(0.5);

    const UPX = 48;
    const WPX = W * 0.42;
    this.add.text(UPX, 150, 'UPGRADES', { fontFamily: 'monospace', fontSize: '18px', color: '#9fb0d0' });
    this.add.text(WPX, 150, 'WEAPONS', { fontFamily: 'monospace', fontSize: '18px', color: '#9fb0d0' });

    const rowStyle = { fontFamily: 'monospace', fontSize: '17px', color: '#fff' };
    this.upRows = UPGRADES.map((up, i) =>
      this.add.text(UPX, 188 + i * 40, '', rowStyle));
    this.wpRows = WEAPONS.map((w, i) =>
      this.add.text(WPX, 188 + i * 28, '', rowStyle));

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

    // ignore SPACE briefly so a held key from the death screen doesn't auto-launch
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
    this.col = Phaser.Math.Clamp(this.col + dCol, 0, 1);
    this.row += dRow;
    const max = (this.col === 0 ? UPGRADES.length : WEAPONS.length) - 1;
    this.row = Phaser.Math.Clamp(this.row, 0, max);
    this.refresh();
  }

  activate() {
    if (this.col === 0) {
      const up = UPGRADES[this.row];
      const res = Save.buy(up.id);
      if (res.ok) this.showFlash('Upgraded ' + up.label + '!', '#8f8');
      else if (res.reason === 'max') this.showFlash(up.label + ' is maxed out.', '#ffd24a');
      else this.showFlash('Not enough beskar for ' + up.label + '.', '#ff7a6b');
    } else {
      const w = WEAPONS[this.row];
      const res = Save.buyWeapon(w.id);
      if (res.ok && res.reason === 'equipped') this.showFlash('Equipped ' + w.label + '.', '#7ef0ff');
      else if (res.ok) this.showFlash('Bought ' + w.label + '!', '#8f8');
      else this.showFlash('Not enough beskar for ' + w.label + '.', '#ff7a6b');
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

    UPGRADES.forEach((up, i) => {
      const level = state.upgrades[up.id] || 0;
      const dots = '●'.repeat(level) + '○'.repeat(up.maxLevel - level);
      const sel = this.col === 0 && this.row === i;
      this.upRows[i].setText((sel ? '▸ ' : '  ') + up.label + ' ' + dots);
      const maxed = level >= up.maxLevel;
      const afford = !maxed && state.beskar >= upgradeCost(up, level);
      this.upRows[i].setColor(sel ? '#7ef0ff' : maxed ? '#7a7f8c' : afford ? '#fff' : '#9a6a6a');
    });

    WEAPONS.forEach((w, i) => {
      const owned = state.weapons.owned.includes(w.id);
      const active = state.weapons.active === w.id;
      const status = active ? '◆' : owned ? '✓' : '◈' + w.cost;
      const sel = this.col === 1 && this.row === i;
      this.wpRows[i].setText((sel ? '▸ ' : '  ') + w.label + '  ' + status);
      const afford = owned || state.beskar >= w.cost;
      this.wpRows[i].setColor(sel ? '#7ef0ff' : active ? '#7fe07f' : owned ? '#cdd6e6' : afford ? '#fff' : '#9a6a6a');
    });

    // detail line for the selected item
    if (this.col === 0) {
      const up = UPGRADES[this.row];
      const level = state.upgrades[up.id] || 0;
      const tail = level >= up.maxLevel ? 'MAXED' : 'next ◈' + upgradeCost(up, level);
      this.detail.setText(up.desc + '  —  ' + tail);
    } else {
      const w = WEAPONS[this.row];
      const owned = state.weapons.owned.includes(w.id);
      const active = state.weapons.active === w.id;
      const tail = active ? 'EQUIPPED' : owned ? 'OWNED — ENTER to equip' : 'cost ◈' + w.cost;
      this.detail.setText(w.desc + '  —  ' + tail);
    }
  }

  update(time, delta) {
    this.stars.tilePositionX += (delta / 1000) * 30;
  }
}
