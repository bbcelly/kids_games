// Shared catalog of rewards: used by the server (require) and the browser (window.CATALOG).
// Everything here is cosmetic — nothing changes how the game plays.
(function (root) {
  'use strict';

  // rarity -> shop price in DNA
  const PRICE = { common: 120, rare: 300, epic: 600, legendary: 1200 };

  // type: color | pattern | trail | frame | title | cardbg | decor
  // source: default (everyone owns) | shop | level | achievement | daily
  const ITEMS = [
    // ----- colours (hue overrides your random colour; specials have their own look)
    { id: 'c_auto', type: 'color', name: 'Random', source: 'default' },
    { id: 'c_teal', type: 'color', name: 'Lagoon Teal', hue: 170, source: 'level' },
    { id: 'c_coral', type: 'color', name: 'Coral', hue: 8, rarity: 'common', source: 'shop', daily: true },
    { id: 'c_amber', type: 'color', name: 'Amber', hue: 38, rarity: 'common', source: 'shop', daily: true },
    { id: 'c_lime', type: 'color', name: 'Lime', hue: 95, rarity: 'common', source: 'shop', daily: true },
    { id: 'c_sky', type: 'color', name: 'Sky', hue: 205, rarity: 'common', source: 'shop', daily: true },
    { id: 'c_violet', type: 'color', name: 'Violet', hue: 270, rarity: 'common', source: 'shop', daily: true },
    { id: 'c_rose', type: 'color', name: 'Rose', hue: 330, rarity: 'common', source: 'shop', daily: true },
    { id: 'c_neon', type: 'color', name: 'Neon', hue: 150, mode: 'neon', source: 'level' },
    { id: 'c_shadow', type: 'color', name: 'Shadow', hue: 265, mode: 'shadow', source: 'achievement' },
    { id: 'c_gold', type: 'color', name: 'Gold', hue: 45, mode: 'gold', source: 'level' },
    { id: 'c_frost', type: 'color', name: 'Frost', hue: 195, mode: 'frost', rarity: 'epic', source: 'shop' },
    { id: 'c_rainbow', type: 'color', name: 'Rainbow', hue: 0, mode: 'rainbow', source: 'level' },

    // ----- membrane patterns
    { id: 'p_none', type: 'pattern', name: 'Plain', source: 'default' },
    { id: 'p_dots', type: 'pattern', name: 'Spots', source: 'level' },
    { id: 'p_stripes', type: 'pattern', name: 'Stripes', source: 'level' },
    { id: 'p_rings', type: 'pattern', name: 'Rings', rarity: 'rare', source: 'shop', daily: true },
    { id: 'p_tiger', type: 'pattern', name: 'Tiger', source: 'achievement' },
    { id: 'p_crystal', type: 'pattern', name: 'Crystal', source: 'level' },
    { id: 'p_swirl', type: 'pattern', name: 'Swirl', source: 'achievement' },
    { id: 'p_stars', type: 'pattern', name: 'Starry', rarity: 'epic', source: 'shop' },

    // ----- trails
    { id: 't_none', type: 'trail', name: 'None', source: 'default' },
    { id: 't_bubbles', type: 'trail', name: 'Bubbles', source: 'level' },
    { id: 't_sparkle', type: 'trail', name: 'Sparkles', source: 'level' },
    { id: 't_ink', type: 'trail', name: 'Ink Cloud', source: 'achievement' },
    { id: 't_stars', type: 'trail', name: 'Stardust', source: 'achievement' },
    { id: 't_hearts', type: 'trail', name: 'Hearts', rarity: 'rare', source: 'shop', daily: true },
    { id: 't_glow', type: 'trail', name: 'Glow Ribbon', rarity: 'epic', source: 'shop' },

    // ----- name frames
    { id: 'f_none', type: 'frame', name: 'None', source: 'default' },
    { id: 'f_leaf', type: 'frame', name: 'Leaf', color: '#5fd068', source: 'level' },
    { id: 'f_ocean', type: 'frame', name: 'Ocean', color: '#3fb5ff', rarity: 'common', source: 'shop', daily: true },
    { id: 'f_ice', type: 'frame', name: 'Ice', color: '#bdf3ff', source: 'achievement' },
    { id: 'f_flame', type: 'frame', name: 'Flame', color: '#ff7a3d', source: 'achievement' },
    { id: 'f_gold', type: 'frame', name: 'Gold', color: '#ffd24a', source: 'level' },
    { id: 'f_royal', type: 'frame', name: 'Royal', color: '#b98bff', rarity: 'epic', source: 'shop' },

    // ----- titles (shown under your name)
    { id: 'ti_none', type: 'title', name: '(no title)', source: 'default' },
    { id: 'ti_swimmer', type: 'title', name: 'Soup Swimmer', source: 'level' },
    { id: 'ti_explorer', type: 'title', name: 'Explorer', source: 'level' },
    { id: 'ti_veteran', type: 'title', name: 'Veteran', source: 'level' },
    { id: 'ti_legend', type: 'title', name: 'Legend', source: 'level' },
    { id: 'ti_apex', type: 'title', name: 'Apex Hunter', source: 'achievement' },
    { id: 'ti_pvp', type: 'title', name: 'Player Eater', source: 'achievement' },
    { id: 'ti_slayer', type: 'title', name: 'Giant Slayer', source: 'achievement' },
    { id: 'ti_toxic', type: 'title', name: 'Toxic', source: 'achievement' },
    { id: 'ti_devoted', type: 'title', name: 'Daily Devotee', source: 'achievement' },
    { id: 'ti_biologist', type: 'title', name: 'Biologist', source: 'achievement' },
    { id: 'ti_blob', type: 'title', name: 'Professional Blob', rarity: 'rare', source: 'shop' },
    { id: 'ti_snack', type: 'title', name: 'Not a Snack', rarity: 'rare', source: 'shop' },

    // ----- profile card backgrounds
    { id: 'cb_default', type: 'cardbg', name: 'Soup', css: 'linear-gradient(160deg,#0b3442,#04121c)', source: 'default' },
    { id: 'cb_deepsea', type: 'cardbg', name: 'Deep Sea', css: 'linear-gradient(170deg,#0a2a6b,#020617)', source: 'level' },
    { id: 'cb_lava', type: 'cardbg', name: 'Hot Vent', css: 'linear-gradient(160deg,#5a1406,#1b0505 70%,#2b0d00)', rarity: 'rare', source: 'shop' },
    { id: 'cb_microscope', type: 'cardbg', name: 'Microscope', css: 'radial-gradient(circle at 88% 12%,rgba(220,255,245,.32) 0,rgba(150,220,200,.14) 22%,transparent 23%),radial-gradient(circle at 88% 12%,transparent 23%,rgba(150,220,200,.25) 24%,transparent 26%),linear-gradient(160deg,#0d2c2a,#02100f)', rarity: 'epic', source: 'shop' },
    { id: 'cb_aurora', type: 'cardbg', name: 'Aurora', css: 'linear-gradient(135deg,#0d3b4f,#3b1e6e 50%,#0e5a44)', source: 'achievement' },

    // ----- lab decorations (slot says where it goes; plants fit plantL or plantR)
    { id: 'bg_default', type: 'decor', slot: 'bg', name: 'Clear Water', source: 'default' },
    { id: 'bg_kelp', type: 'decor', slot: 'bg', name: 'Kelp Forest', source: 'level' },
    { id: 'bg_abyss', type: 'decor', slot: 'bg', name: 'Abyss', rarity: 'rare', source: 'shop' },
    { id: 'bg_lagoon', type: 'decor', slot: 'bg', name: 'Sunny Lagoon', rarity: 'rare', source: 'shop', daily: true },
    { id: 'bg_vent', type: 'decor', slot: 'bg', name: 'Hydrothermal Vent', rarity: 'epic', source: 'shop' },
    { id: 'fl_sand', type: 'decor', slot: 'floor', name: 'Sand', source: 'default' },
    { id: 'fl_pebbles', type: 'decor', slot: 'floor', name: 'Pebbles', rarity: 'common', source: 'shop', daily: true },
    { id: 'fl_coral', type: 'decor', slot: 'floor', name: 'Coral Bed', rarity: 'rare', source: 'shop' },
    { id: 'fl_crystal', type: 'decor', slot: 'floor', name: 'Crystal Floor', rarity: 'epic', source: 'shop' },
    { id: 'pl_none', type: 'decor', slot: 'plant', name: 'Empty', source: 'default' },
    { id: 'pl_kelp', type: 'decor', slot: 'plant', name: 'Kelp', source: 'level' },
    { id: 'pl_seagrass', type: 'decor', slot: 'plant', name: 'Seagrass', rarity: 'common', source: 'shop', daily: true },
    { id: 'pl_anemone', type: 'decor', slot: 'plant', name: 'Anemone', rarity: 'rare', source: 'shop', daily: true },
    { id: 'pl_coralfan', type: 'decor', slot: 'plant', name: 'Coral Fan', rarity: 'rare', source: 'shop' },
    { id: 'pl_glowshroom', type: 'decor', slot: 'plant', name: 'Glow Mushrooms', rarity: 'epic', source: 'shop' },
    { id: 'ce_none', type: 'decor', slot: 'center', name: 'Empty', source: 'default' },
    { id: 'ce_rock', type: 'decor', slot: 'center', name: 'Big Rock', source: 'level' },
    { id: 'ce_chest', type: 'decor', slot: 'center', name: 'Treasure Chest', rarity: 'rare', source: 'shop', daily: true },
    { id: 'ce_castle', type: 'decor', slot: 'center', name: 'Sand Castle', rarity: 'epic', source: 'shop' },
    { id: 'ce_fossil', type: 'decor', slot: 'center', name: 'Fossil', rarity: 'rare', source: 'shop' },
    { id: 'ce_microscope', type: 'decor', slot: 'center', name: 'Golden Microscope', source: 'achievement' },
    { id: 'li_none', type: 'decor', slot: 'light', name: 'Daylight', source: 'default' },
    { id: 'li_warm', type: 'decor', slot: 'light', name: 'Warm Lamp', rarity: 'common', source: 'shop', daily: true },
    { id: 'li_cyan', type: 'decor', slot: 'light', name: 'Bioluminescence', source: 'level' },
    { id: 'li_disco', type: 'decor', slot: 'light', name: 'Disco', rarity: 'epic', source: 'shop' },
    { id: 'bu_none', type: 'decor', slot: 'bubbler', name: 'None', source: 'default' },
    { id: 'bu_basic', type: 'decor', slot: 'bubbler', name: 'Bubbler', source: 'level' },
    { id: 'bu_rainbow', type: 'decor', slot: 'bubbler', name: 'Rainbow Bubbler', source: 'achievement' },
  ];
  for (const it of ITEMS) if (it.source === 'shop') it.price = PRICE[it.rarity || 'common'];

  // Equip slots on the profile and lab slots
  const LOOK_SLOTS = ['color', 'pattern', 'trail', 'frame', 'title', 'cardbg'];
  const LAB_SLOTS = ['bg', 'floor', 'plantL', 'plantR', 'center', 'light', 'bubbler'];
  const DEFAULTS = {
    color: 'c_auto', pattern: 'p_none', trail: 't_none', frame: 'f_none', title: 'ti_none', cardbg: 'cb_default',
    bg: 'bg_default', floor: 'fl_sand', plantL: 'pl_none', plantR: 'pl_none', center: 'ce_none', light: 'li_none', bubbler: 'bu_none',
  };

  // Level track: fixed unlocks (every level also pays DNA)
  const LEVEL_REWARDS = {
    2: ['c_teal'], 3: ['t_bubbles'], 4: ['ti_swimmer'], 5: ['pl_kelp'], 6: ['p_dots'], 8: ['cb_deepsea'],
    10: ['f_leaf', 'ti_explorer'], 12: ['ce_rock'], 14: ['bu_basic'], 15: ['p_stripes'], 18: ['t_sparkle'],
    20: ['c_neon', 'ti_veteran'], 22: ['li_cyan'], 25: ['bg_kelp'], 30: ['f_gold'], 35: ['c_gold'],
    40: ['p_crystal'], 50: ['c_rainbow', 'ti_legend'],
  };
  const LAB_SLOT_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 45]; // +1 specimen place each (base 3)

  // Achievements: stat >= goal. Stats are lifetime counters on the profile.
  const ACHIEVEMENTS = [
    { id: 'a_first', icon: '🧫', name: 'First Steps', desc: 'Finish your first game', stat: 'games', goal: 1, dna: 30 },
    { id: 'a_colony', icon: '🫧', name: 'Better Together', desc: 'Become a Colony', stat: 'colonyReached', goal: 1, dna: 40 },
    { id: 'a_predator', icon: '🦈', name: 'Top of the Food Chain?', desc: 'Become a Predator', stat: 'predatorReached', goal: 1, dna: 80 },
    { id: 'a_apex', icon: '🐉', name: 'Apex', desc: 'Become an Apex Leviathan', stat: 'apexReached', goal: 1, dna: 150, item: 'ti_apex' },
    { id: 'a_apex10', icon: '👑', name: 'Ruler of the Soup', desc: 'Become an Apex Leviathan 10 times', stat: 'apexReached', goal: 10, dna: 300, item: 'c_shadow' },
    { id: 'a_hungry', icon: '😋', name: 'Hungry', desc: 'Eat 25 organisms', stat: 'kills', goal: 25, dna: 50 },
    { id: 'a_glutton', icon: '🍽️', name: 'Glutton', desc: 'Eat 100 organisms', stat: 'kills', goal: 100, dna: 120, item: 't_ink' },
    { id: 'a_devourer', icon: '🔥', name: 'Devourer', desc: 'Eat 500 organisms', stat: 'kills', goal: 500, dna: 300, item: 'f_flame' },
    { id: 'a_pvp', icon: '⚔️', name: 'Gotcha!', desc: 'Eat another player', stat: 'playerKills', goal: 1, dna: 60 },
    { id: 'a_pvp50', icon: '🗡️', name: 'Player Eater', desc: 'Eat 50 players', stat: 'playerKills', goal: 50, dna: 250, item: 'ti_pvp' },
    { id: 'a_giant', icon: '🐋', name: 'Giant', desc: 'Reach 1000 mass', stat: 'bestMass', goal: 1000, dna: 120 },
    { id: 'a_titan', icon: '🐯', name: 'Titan', desc: 'Reach 2500 mass', stat: 'bestMass', goal: 2500, dna: 250, item: 'p_tiger' },
    { id: 'a_slayer', icon: '🏹', name: 'Giant Slayer', desc: 'Eat an Apex Leviathan', stat: 'killedApex', goal: 1, dna: 200, item: 'ti_slayer' },
    { id: 'a_toxic', icon: '☠️', name: 'Bad Taste', desc: 'Get poisoned 10 times by eating spiky prey', stat: 'poisoned', goal: 10, dna: 80, item: 'ti_toxic' },
    { id: 'a_dasher', icon: '💨', name: 'Zoom Zoom', desc: 'Dash 500 times', stat: 'dashes', goal: 500, dna: 100, item: 't_stars' },
    { id: 'a_streak3', icon: '📅', name: 'Regular', desc: 'Play 3 days in a row', stat: 'maxStreak', goal: 3, dna: 60 },
    { id: 'a_streak7', icon: '🗓️', name: 'Daily Devotee', desc: 'Play 7 days in a row', stat: 'maxStreak', goal: 7, dna: 200, item: 'ti_devoted' },
    { id: 'a_streak30', icon: '🌌', name: 'Unstoppable', desc: 'Play 30 days in a row', stat: 'maxStreak', goal: 30, dna: 600, item: 'cb_aurora' },
    { id: 'a_ice', icon: '❄️', name: 'Cool Customer', desc: 'Survive 10 minutes in one life', stat: 'longestLife', goal: 600, dna: 150, item: 'f_ice' },
    { id: 'a_biologist', icon: '🔬', name: 'Biologist', desc: 'Discover 10 collection entries', stat: 'entries', goal: 10, dna: 100, item: 'ti_biologist' },
    { id: 'a_encyclopedia', icon: '📚', name: 'Encyclopedia', desc: 'Discover every collection entry', stat: 'entries', goal: 21, dna: 500, item: 'ce_microscope' },
    { id: 'a_curator', icon: '🏺', name: 'Curator', desc: 'Save 5 specimens to your lab', stat: 'specimensSaved', goal: 5, dna: 100, item: 'bu_rainbow' },
    { id: 'a_master', icon: '🌀', name: 'Master of Evolution', desc: 'Max out all 6 traits (level 3) at least once', stat: 'traitsMastered', goal: 6, dna: 300, item: 'p_swirl' },
  ];

  // Daily tasks: per-day counters. mode sum = add up over the day, max = best single life.
  const TASKS = [
    { id: 't_kills5', text: 'Eat 5 organisms', stat: 'kills', mode: 'sum', goal: 5, dna: 40 },
    { id: 't_kills15', text: 'Eat 15 organisms', stat: 'kills', mode: 'sum', goal: 15, dna: 80 },
    { id: 't_pvp', text: 'Eat another player', stat: 'playerKills', mode: 'sum', goal: 1, dna: 60 },
    { id: 't_big', text: 'Eat a Multicellular or bigger organism', stat: 'killsBig', mode: 'sum', goal: 1, dna: 60 },
    { id: 't_colony', text: 'Become a Colony', stat: 'stage', mode: 'max', goal: 2, dna: 30 },
    { id: 't_predator', text: 'Become a Predator', stat: 'stage', mode: 'max', goal: 4, dna: 70 },
    { id: 't_apex', text: 'Become an Apex Leviathan', stat: 'stage', mode: 'max', goal: 5, dna: 120 },
    { id: 't_survive3', text: 'Survive 3 minutes in one life', stat: 'secs', mode: 'max', goal: 180, dna: 50 },
    { id: 't_mass300', text: 'Reach 300 mass', stat: 'mass', mode: 'max', goal: 300, dna: 50 },
    { id: 't_food150', text: 'Eat 150 nutrients', stat: 'food', mode: 'sum', goal: 150, dna: 40 },
    { id: 't_dash15', text: 'Dash 15 times', stat: 'dashes', mode: 'sum', goal: 15, dna: 30 },
    { id: 't_games3', text: 'Play 3 games', stat: 'games', mode: 'sum', goal: 3, dna: 30 },
    { id: 't_jaws', text: 'Evolve Jaws', stat: 'trait_jaws', mode: 'sum', goal: 1, dna: 30 },
    { id: 't_spikes', text: 'Evolve Toxin Spikes', stat: 'trait_spikes', mode: 'sum', goal: 1, dna: 30 },
    { id: 't_flagella', text: 'Evolve Flagella', stat: 'trait_flagella', mode: 'sum', goal: 1, dna: 30 },
  ];
  const DAILY_TASK_COUNT = 3;

  // Daily login: index = day in the 7-day cycle
  const DAILY_REWARDS = [20, 30, 40, 50, 60, 80, 150]; // day 7 also gives a random item

  // Collection / encyclopedia (21 entries). unlock: how it is discovered.
  const STAGE_NAMES = ['Prokaryote', 'Eukaryote', 'Colony', 'Multicellular', 'Predator', 'Apex Leviathan'];
  const TRAIT_KEYS = ['flagella', 'membrane', 'spikes', 'jaws', 'cilia', 'metabolism'];
  const TRAIT_NAMES = { flagella: 'Flagella', membrane: 'Thick Membrane', spikes: 'Toxin Spikes', jaws: 'Jaws', cilia: 'Cilia', metabolism: 'Fast Metabolism' };
  const ENTRIES = [
    { id: 'stage_0', group: 'Stages', name: 'Prokaryote', stage: 0, fact: 'Bacteria and archaea are prokaryotes: they have no nucleus, and their DNA floats freely inside the cell. For around two billion years they were the only life on Earth.' },
    { id: 'stage_1', group: 'Stages', name: 'Eukaryote', stage: 1, fact: 'Eukaryotic cells keep their DNA inside a nucleus. Their mitochondria — tiny power plants — were once free-living bacteria that got swallowed and stayed.' },
    { id: 'stage_2', group: 'Stages', name: 'Colony', stage: 2, fact: 'Volvox is a green alga that lives as a hollow ball of thousands of cells, all beating their tails together to roll through the water.' },
    { id: 'stage_3', group: 'Stages', name: 'Multicellular', stage: 3, fact: 'In a multicellular body, cells specialise: some move, some digest, some sense. Your own body is made of around 30 trillion cells.' },
    { id: 'stage_4', group: 'Stages', name: 'Predator', stage: 4, fact: 'Large hunters with eyes and grabbing mouthparts appeared in the Cambrian seas, more than 500 million years ago.' },
    { id: 'stage_5', group: 'Stages', name: 'Apex Leviathan', stage: 5, fact: 'Anomalocaris, a Cambrian top predator, was the giant of its time — about as long as your arm, with spiny grabbing limbs in front of its mouth.' },
    { id: 'trait_flagella', group: 'Traits', name: 'Flagella', trait: 'flagella', fact: 'A bacterial flagellum spins like a propeller, driven by a tiny rotary motor that can turn thousands of times per minute.' },
    { id: 'trait_membrane', group: 'Traits', name: 'Thick Membrane', trait: 'membrane', fact: 'A cell membrane is a double layer of fatty molecules only a few billionths of a metre thick, yet it decides what gets in and out.' },
    { id: 'trait_spikes', group: 'Traits', name: 'Toxin Spikes', trait: 'spikes', fact: 'Radiolarians build delicate skeletons of glass-like silica, often covered in long spines that make them hard to eat.' },
    { id: 'trait_jaws', group: 'Traits', name: 'Jaws', trait: 'jaws', fact: 'Jaws evolved from the gill arches of ancient fish more than 400 million years ago.' },
    { id: 'trait_cilia', group: 'Traits', name: 'Cilia', trait: 'cilia', fact: 'Paramecium is covered in thousands of tiny hairs called cilia that beat in waves, rowing it through the water.' },
    { id: 'trait_metabolism', group: 'Traits', name: 'Fast Metabolism', trait: 'metabolism', fact: 'With plenty of food, some bacteria can split in two every 20 minutes — one cell could become millions in a few hours.' },
    { id: 'master_flagella', group: 'Masters', name: 'Flagella Master', trait: 'flagella', master: true, fact: 'Relative to their size, swimming bacteria cover many body lengths per second — far more than a cheetah does when it sprints.' },
    { id: 'master_membrane', group: 'Masters', name: 'Membrane Master', trait: 'membrane', master: true, fact: 'Some archaea live in boiling hot springs thanks to unusually tough membrane molecules.' },
    { id: 'master_spikes', group: 'Masters', name: 'Spike Master', trait: 'spikes', master: true, fact: 'Jellyfish fire stinging cells called nematocysts — one of the fastest movements found anywhere in nature.' },
    { id: 'master_jaws', group: 'Masters', name: 'Jaws Master', trait: 'jaws', master: true, fact: 'Sharks keep growing new teeth their whole lives; some go through thousands of them.' },
    { id: 'master_cilia', group: 'Masters', name: 'Cilia Master', trait: 'cilia', master: true, fact: 'Cilia in your airways beat about 10 to 20 times every second, sweeping dust and germs out of your lungs.' },
    { id: 'master_metabolism', group: 'Masters', name: 'Metabolism Master', trait: 'metabolism', master: true, fact: "A hummingbird's heart can beat more than 1,000 times a minute to keep up with its super-fast metabolism." },
    { id: 'e_ate_player', group: 'Special', name: 'Phagocytosis', fact: 'Some cells eat by wrapping their membrane around food. Your white blood cells catch germs exactly this way.' },
    { id: 'e_ate_apex', group: 'Special', name: 'David and Goliath', fact: 'Being small is not always a weakness: army ants hunt together and can overpower animals far bigger than any single ant.' },
    { id: 'e_poisoned', group: 'Special', name: 'Bad Taste', fact: 'Many creatures are toxic to eat. Poison dart frogs get their poison from the tiny insects they eat in the wild.' },
  ];
  const ENTRY_DNA = 25;

  function xpForLevel(n) { return Math.round(100 * Math.pow(n, 1.5)); } // XP needed to go from n to n+1
  function levelDna(n) { return 20 + 2 * n; }
  function labCapacity(level) { return 3 + LAB_SLOT_LEVELS.filter(l => level >= l).length; }

  const CATALOG = {
    ITEMS, ITEM: Object.fromEntries(ITEMS.map(i => [i.id, i])), PRICE, LOOK_SLOTS, LAB_SLOTS, DEFAULTS,
    LEVEL_REWARDS, LAB_SLOT_LEVELS, ACHIEVEMENTS, TASKS, DAILY_TASK_COUNT, DAILY_REWARDS,
    STAGE_NAMES, TRAIT_KEYS, TRAIT_NAMES, ENTRIES, ENTRY_DNA, xpForLevel, levelDna, labCapacity,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
  else root.CATALOG = CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
