// main.js — boots Phaser and registers the scenes. Loaded last.

// Phaser games must be served over HTTP. Opened directly as a file (file://),
// Chrome treats the page as a locked-down unique origin, which breaks the game
// with cryptic errors. Detect that and show friendly instructions instead.
function showServeMessage() {
  document.getElementById('game-root').innerHTML =
    '<div style="max-width:640px;margin:auto;padding:32px;color:#cdd6e6;' +
    'font-family:monospace;line-height:1.6;text-align:center">' +
    '<h1 style="color:#ffd24a;font-size:40px;margin:0 0 8px">BESKAR RUN</h1>' +
    '<p style="color:#ff7a6b;font-size:18px">This game can’t run from a file.</p>' +
    '<p>Browsers block games opened directly (<code>file://</code>).<br>' +
    'Start it from a tiny local server instead — pick one:</p>' +
    '<div style="text-align:left;background:#0c1020;border:1px solid #233;' +
    'border-radius:8px;padding:16px;margin:16px 0">' +
    '<p style="color:#7fe07f;margin:0 0 6px">▸ Easiest (macOS): double-click <b>play.command</b></p>' +
    '<p style="color:#9fb0d0;margin:0 0 6px">▸ Or in a terminal, from this folder:</p>' +
    '<pre style="color:#fff;margin:4px 0">python3 -m http.server 8000</pre>' +
    '<p style="color:#9fb0d0;margin:6px 0 0">then open ' +
    '<b style="color:#7ef0ff">http://localhost:8000</b></p></div></div>';
}

// Exposed at top scope as a debugging handle (window console: `game`).
let game;

if (window.location.protocol === 'file:') {
  showServeMessage();
} else {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: CONFIG.width,
    height: CONFIG.height,
    parent: 'game-root',
    backgroundColor: '#05060f',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene, MenuScene, GameScene, ShopScene],
  });
}
