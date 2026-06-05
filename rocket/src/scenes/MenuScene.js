// MenuScene — title screen. SPACE launches a run, H opens the hangar.

class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const W = CONFIG.width;
    const H = CONFIG.height;

    this.stars = this.add.tileSprite(0, 0, W, H, 'startile').setOrigin(0);

    // a drifting ship + companion for some life on the menu
    const ship = this.add.image(W / 2 - 80, H / 2 + 8, 'ship').setScale(2);
    this.add.image(W / 2 - 130, H / 2 + 28, 'companion').setScale(2);
    this.tweens.add({ targets: ship, y: ship.y - 14, yoyo: true,
      repeat: -1, duration: 1400, ease: 'Sine.inOut' });

    this.add.text(W / 2, 120, 'BESKAR RUN', {
      fontFamily: 'monospace', fontSize: '64px', color: '#ffd24a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 175, 'This is the Way', {
      fontFamily: 'monospace', fontSize: '20px', color: '#9fb0d0',
    }).setOrigin(0.5);

    const saved = Save.load();
    const lvl = Phaser.Math.Clamp(saved.level || 0, 0, LEVELS.length - 1);
    this.add.text(W / 2, H - 178, 'Level ' + (lvl + 1) + ' · ' + LEVELS[lvl].name, {
      fontFamily: 'monospace', fontSize: '18px', color: '#7ef0ff',
    }).setOrigin(0.5);
    this.add.text(W / 2, H - 150, '◈ ' + saved.beskar + ' beskar in the vault', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffd24a',
    }).setOrigin(0.5);

    const prompt = this.add.text(W / 2, H - 105, 'Press SPACE to launch', {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffffff',
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, yoyo: true,
      repeat: -1, duration: 700 });

    this.add.text(W / 2, H - 55,
      'Move: Arrows/WASD   Auto-fire   Q weapon   F force   P pause   H hangar', {
      fontFamily: 'monospace', fontSize: '15px', color: '#667' }).setOrigin(0.5);

    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('Game'));
    this.input.keyboard.once('keydown-H', () => this.scene.start('Shop'));
  }

  update(time, delta) {
    this.stars.tilePositionX += (delta / 1000) * 30;
  }
}
