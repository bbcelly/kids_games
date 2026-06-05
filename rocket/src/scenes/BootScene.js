// BootScene — builds all procedural textures, then hands off to the menu.

class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildTextures(this);
    this.scene.start('Menu');
  }
}
