'use strict';
// ---- chunky pixel-art sprites, pre-rendered to offscreen canvases ----
// Each sprite is a list of strings; chars index into a palette. '.' = transparent.

const Sprites = {};

Sprites.build = function (rows, pal, scale) {
  scale = scale || 4;
  const h = rows.length;
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
};

Sprites.init = function () {
  const B = Sprites.build;

  // -- player gunship: green beskar hull, facing right --
  const shipPal = {
    G: '#3fa057', D: '#1e5e33', L: '#7fd98a', S: '#cfd8dc',
    C: '#6fe3ff', E: '#234', F: '#ffb74d'
  };
  Sprites.player = B([
    '.........DD...........',
    '........DLGD..........',
    '..EE....DLGGD.........',
    '..EEGGGGDGGGGDDD......',
    '...DGGGGGGGGGGGGDDD...',
    '...DGLLGGSSSSGGGGGGDD.',
    '..EEGLLGGSCCSGGGGGGGGD',
    '..EEGGGGGSSSSGGGGGGD..',
    '...DGGGGGGGGGGGGDD....',
    '....DGGGGDGGGGDD......',
    '........DLGD..........',
    '.........DD...........',
  ], shipPal);

  // -- Grogu companion in his floating pod --
  Sprites.grogu = B([
    'E......E',
    'EE.GG.EE',
    'EEGGGGEE',
    '.GBGGBG.',
    '..GGGG..',
    '.WWWWWW.',
    'WWWWWWWW',
    '.WWWWWW.',
    '..WWWW..',
  ], { E: '#7fce7f', G: '#9fdf8f', B: '#142414', W: '#8d6e63' }, 3);

  // -- enemies (all face left) --
  const enePal = { I: '#3a3f4a', D: '#566070', G: '#8b95a5', R: '#ff5252', W: '#ffd54f' };

  Sprites.grunt = B([
    'I.......I',
    'II.....II',
    'II.DDD.II',
    'IIDGGGDII',
    'IIDGRGDII',
    'IIDGGGDII',
    'II.DDD.II',
    'II.....II',
    'I.......I',
  ], enePal);

  Sprites.shooter = B([
    '......D......',
    '.....DGD.....',
    '....DGGGD....',
    'RDDGGGGGGDD..',
    'DGGGGGRGGGGD.',
    'DGGGGGRGGGGGD',
    'RDDGGGGGGDD..',
    '....DGGGD....',
    '.....DGD.....',
    '......D......',
  ], enePal);

  Sprites.waver = B([
    '.......DD..',
    '...DDDGGGD.',
    '.DDGGGGGGD.',
    'DGGRGGGGGGD',
    'DGGRGGGGGGD',
    '.DDGGGGGGD.',
    '...DDDGGGD.',
    '.......DD..',
  ], enePal);

  Sprites.drone = B([
    '..DDD..',
    '.DGGGD.',
    'DGGRGGD',
    'DGRRRGD',
    'DGGRGGD',
    '.DGGGD.',
    '..DDD..',
  ], enePal);

  Sprites.asteroid = B([
    '...OOOOO....',
    '..ORRRRRO...',
    '.ORRLLRRRO..',
    'ORRLLLRRRRO.',
    'ORRLLRRRRRO.',
    'ORRRRRRRLRO.',
    'ORRRRRLLRRO.',
    '.ORRRRRRRO..',
    '..ORRRRRO...',
    '...OOOOO....',
  ], { O: '#4e3b2c', R: '#7a5c40', L: '#a98863' });

  // -- boss 1: the Mining Hauler (rusty industrial barge) --
  const haulPal = { D: '#4e342e', R: '#8d5524', Y: '#ffb300', G: '#6d4c41', W: '#ff5252', E: '#37474f', L: '#c8884a' };
  Sprites.boss1 = B([
    '..........DDDDDDDDDDDDDDDD....',
    '......DDDDRRRRRRRRRRRRRRRDDD..',
    '....DDRRRRLLLLRRRRLLLLRRRRRDD.',
    '..DDRRRRYYRRRRYYRRRRYYRRRRRRDD',
    '.DRRRRRRYYRRRRYYRRRRYYRRRRRRED',
    'DRWWRRRRYYRRRRYYRRRRYYRRRRREED',
    'DRWWRRRRRRRRRRRRRRRRRRRRRRREED',
    'DRWWRRRRGGGGGGGGGGGGGGGGRRREED',
    'DRRRRRRRGGGGGGGGGGGGGGGGRRREED',
    'DRWWRRRRGGGGGGGGGGGGGGGGRRREED',
    'DRWWRRRRRRRRRRRRRRRRRRRRRRREED',
    'DRWWRRRRYYRRRRYYRRRRYYRRRRREED',
    '.DRRRRRRYYRRRRYYRRRRYYRRRRRRED',
    '..DDRRRRYYRRRRYYRRRRYYRRRRRRDD',
    '....DDRRRRLLLLRRRRLLLLRRRRRDD.',
    '......DDDDRRRRRRRRRRRRRRRDDD..',
    '..........DDDDDDDDDDDDDDDD....',
  ], haulPal, 5);

  // -- boss 2: the Imperial Cruiser (gray wedge with bridge tower) --
  const cruPal = { D: '#37414f', G: '#78909c', L: '#aebfc9', R: '#ff5252', C: '#6fe3ff', E: '#263238' };
  Sprites.boss2 = B([
    '...........................DDD.....',
    '..........................DGCGD....',
    '..........................DGGGD....',
    '......................DDDDDGGGDDDD.',
    '..............DDDDDDDDGGGGGGGGGGGD.',
    '........DDDDDDGGGGGGGGGGLLLLGGGGGED',
    '..DDDDDDGGGGGGGGLLLLLLGGGGGGGGGGGED',
    'DDGGGGGGGGLLLLLLGGGGGGGGGGGGGGGGGED',
    'RGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGED',
    'DDGGGGGGGGLLLLLLGGGGGGGGGGGGGGGGGED',
    '..DDDDDDGGGGGGGGLLLLLLGGGGGGGGGGGED',
    '........DDDDDDGGGGGGGGGGLLLLGGGGGED',
    '..............DDDDDDDDGGGGGGGGGGGD.',
    '......................DDDDDDDDDDD..',
  ], cruPal, 5);

  // -- boss 3: the Imperial Walker (head left, four legs) --
  const walkPal = { D: '#444c55', G: '#8d99a6', L: '#b9c4cf', R: '#ff5252', E: '#21262c' };
  Sprites.boss3 = B([
    '..DDDDDD................',
    '.DGGGGGGD...............',
    'DGRGGRGGD...DDD.........',
    'DGGGGGGGDDDDGGDD........',
    'DGGGGGGGGGGDGGGD........',
    '.DDGGDDDGGGDGGGD........',
    '...DD..DGGGGGGGDDDDDDD..',
    '.......DGGGGGGGGGGGGGGD.',
    '......DGGLLLLLLLLLLGGGGD',
    '......DGGLGGGGGGGGLGGGGD',
    '......DGGLGGGGGGGGLGGGGD',
    '......DGGLLLLLLLLLLGGGGD',
    '.......DGGGGGGGGGGGGGGD.',
    '.......DDGGDDDDDDGGDDD..',
    '........DGGD....DGGD....',
    '........DGGD....DGGD....',
    '.......DGGD......DGGD...',
    '.......DGGD......DGGD...',
    '......DGGD........DGGD..',
    '......DGGD........DGGD..',
    '.....DGGGD........DGGGD.',
    '.....DEEED........DEEED.',
    '....DEEEED........DEEEED',
  ], walkPal, 5);

  // -- pickups & HUD bits --
  const coinPal = { G: '#b8860b', Y: '#ffd54f', L: '#fff3b0' };
  Sprites.coin = [
    B(['.GGGG.', 'GYYYYG', 'GYLYYG', 'GYYYLG', 'GYYYYG', '.GGGG.'], coinPal, 3),
    B(['..GG..', '.GYYG.', '.GYLG.', '.GYYG.', '.GYYG.', '..GG..'], coinPal, 3),
    B(['..GG..', '..GG..', '..GG..', '..GG..', '..GG..', '..GG..'], coinPal, 3),
  ];
  const lcoinPal = { G: '#8e24aa', Y: '#e1bee7', L: '#ffffff' };
  Sprites.luckyCoin = [
    B(['.GGGG.', 'GYYYYG', 'GYLYYG', 'GYYYLG', 'GYYYYG', '.GGGG.'], lcoinPal, 3),
    B(['..GG..', '.GYYG.', '.GYLG.', '.GYYG.', '.GYYG.', '..GG..'], lcoinPal, 3),
    B(['..GG..', '..GG..', '..GG..', '..GG..', '..GG..', '..GG..'], lcoinPal, 3),
  ];

  Sprites.heart = B([
    '.RR.RR.',
    'RRRRRRR',
    'RRRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...',
  ], { R: '#ff5e6c' }, 3);
  Sprites.heartEmpty = B([
    '.RR.RR.',
    'R..R..R',
    'R.....R',
    '.R...R.',
    '..R.R..',
    '...R...',
  ], { R: '#5a3340' }, 3);

  Sprites.missile = B([
    '.DGGGGYY.',
    'DGGGGGYYR',
    '.DGGGGYY.',
  ], { D: '#555', G: '#9e9e9e', Y: '#ffb300', R: '#ff5252' }, 3);
};
