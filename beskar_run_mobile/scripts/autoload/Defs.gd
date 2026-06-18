extends Node
## Static game data: weapons, upgrades, Grogu's gifts, levels, enemies.
## All balance numbers live here so tuning is one place.

# ---------------------------------------------------------------------------
# WEAPONS  (id -> definition)
# fire_rate = shots per second base; dmg = per bolt; pattern describes bolts.
# ---------------------------------------------------------------------------
const WEAPONS := {
	"blaster": {
		"name": "Blaster",
		"desc": "Single bolt. The starter.",
		"cost": 0,
		"premium": false,
		"fire_rate": 4.0,
		"dmg": 1.0,
		"bolts": [{"angle": 0.0}],
		"color": Color(0.55, 0.95, 0.65),
	},
	"twin": {
		"name": "Twin Cannon",
		"desc": "Two parallel bolts.",
		"cost": 120,
		"premium": false,
		"fire_rate": 4.0,
		"dmg": 1.0,
		"bolts": [{"angle": 0.0, "offset": -8.0}, {"angle": 0.0, "offset": 8.0}],
		"color": Color(0.55, 0.95, 0.65),
	},
	"spread": {
		"name": "Spread Shot",
		"desc": "3-way fan for crowds.",
		"cost": 220,
		"premium": false,
		"fire_rate": 3.2,
		"dmg": 1.0,
		"bolts": [{"angle": -14.0}, {"angle": 0.0}, {"angle": 14.0}],
		"color": Color(0.6, 0.9, 1.0),
	},
	"scatter": {
		"name": "Scatter Gun",
		"desc": "Wide 5-way, short range.",
		"cost": 340,
		"premium": false,
		"fire_rate": 2.4,
		"dmg": 0.8,
		"bolts": [{"angle": -26.0}, {"angle": -13.0}, {"angle": 0.0}, {"angle": 13.0}, {"angle": 26.0}],
		"lifetime": 0.5,
		"color": Color(1.0, 0.8, 0.5),
	},
	"vulcan": {
		"name": "Vulcan",
		"desc": "Rapid-fire stream.",
		"cost": 460,
		"premium": false,
		"fire_rate": 10.0,
		"dmg": 0.6,
		"bolts": [{"angle": 0.0, "spread": 4.0}],
		"color": Color(1.0, 0.95, 0.6),
	},
	"homing": {
		"name": "Homing Missiles",
		"desc": "Curve toward enemies.",
		"cost": 600,
		"premium": false,
		"fire_rate": 2.0,
		"dmg": 2.0,
		"bolts": [{"angle": -6.0, "homing": true}, {"angle": 6.0, "homing": true}],
		"color": Color(1.0, 0.6, 0.5),
	},
	"laser": {
		"name": "Laser Lance",
		"desc": "Piercing beam, hits a line.",
		"cost": 760,
		"premium": false,
		"fire_rate": 2.6,
		"dmg": 1.2,
		"bolts": [{"angle": 0.0, "piercing": true, "laser": true}],
		"color": Color(0.9, 0.6, 1.0),
	},
	"storm": {
		"name": "Beskar Storm",
		"desc": "Twin bolts + a homing missile.",
		"cost": 1100,
		"premium": true,
		"fire_rate": 4.5,
		"dmg": 1.2,
		"bolts": [{"angle": 0.0, "offset": -8.0}, {"angle": 0.0, "offset": 8.0}, {"angle": 0.0, "homing": true}],
		"color": Color(1.0, 0.85, 0.4),
	},
	"darksaber": {
		"name": "Darksaber Array",
		"desc": "Spread bolts + a piercing core.",
		"cost": 1400,
		"premium": true,
		"fire_rate": 4.0,
		"dmg": 1.4,
		"bolts": [{"angle": -16.0}, {"angle": 16.0}, {"angle": 0.0, "piercing": true, "laser": true}],
		"color": Color(0.8, 0.7, 1.0),
	},
}

# Order weapons appear in the hangar and the in-run swap cycle.
const WEAPON_ORDER := ["blaster", "twin", "spread", "scatter", "vulcan", "homing", "laser", "storm", "darksaber"]

# ---------------------------------------------------------------------------
# SHIP UPGRADES  (id -> def). cost(level) scales; max levels capped.
# ---------------------------------------------------------------------------
const UPGRADES := {
	"fire_rate": {"name": "Blaster Fire Rate", "desc": "Shoot faster.", "max": 5, "base_cost": 100, "step": 80},
	"armor": {"name": "Beskar Armor", "desc": "Extra hull (more hearts).", "max": 4, "base_cost": 150, "step": 120},
	"thrusters": {"name": "Thrusters", "desc": "Fly faster.", "max": 5, "base_cost": 90, "step": 70},
}

# Derived gameplay values from upgrade levels:
const BASE_HEARTS := 3
const FIRE_RATE_PER_LEVEL := 0.18   # +18% fire rate per level
const SPEED_PER_LEVEL := 0.12       # +12% move speed per level
const BASE_SPEED := 360.0

# ---------------------------------------------------------------------------
# GROGU'S GIFTS  (id -> def)
# ---------------------------------------------------------------------------
const GIFTS := {
	"magnet": {"name": "Beskar Magnet", "desc": "Pulls gold to you from afar.", "max": 3, "base_cost": 120, "step": 100},
	"wipe": {"name": "Force Wipe", "desc": "Pulse clears enemies & bullets, hurts the boss.", "max": 3, "base_cost": 180, "step": 150},
	"mend": {"name": "Force Mend", "desc": "Grogu slowly repairs your hull.", "max": 3, "base_cost": 200, "step": 160},
	"frog": {"name": "Lucky Frog", "desc": "Chance for bonus sparkly beskar.", "max": 3, "base_cost": 140, "step": 110},
	"bond": {"name": "Force Bond", "desc": "Revive once or twice per run.", "max": 2, "base_cost": 300, "step": 350},
}
const GIFT_ORDER := ["magnet", "wipe", "mend", "frog", "bond"]

# Gift-derived values
const MAGNET_RADIUS := [0.0, 120.0, 220.0, 360.0]   # by level
const WIPE_COOLDOWN := [0.0, 14.0, 11.0, 8.0]
const WIPE_BOSS_DMG := [0.0, 6.0, 9.0, 13.0]
const MEND_RATE := [0.0, 0.04, 0.07, 0.11]           # hearts per second
const FROG_CHANCE := [0.0, 0.10, 0.18, 0.28]
const BOND_REVIVES := [0, 1, 2]

# ---------------------------------------------------------------------------
# LEVELS  (3 distinct places). Waves are generated by the WaveManager using
# these knobs; each loop multiplies difficulty.
# ---------------------------------------------------------------------------
const LEVELS := [
	{
		"name": "Asteroid Field",
		"subtitle": "Drifting rock, deep space.",
		"bg_far": "res://assets/backgrounds/l1_far.png",
		"bg_mid": "res://assets/backgrounds/l1_mid.png",
		"ground": "",
		"far_speed": 12.0,
		"mid_speed": 40.0,
		"asteroids": true,
		"waves": 4,
		"enemy_mix": {"grunt": 0.7, "shooter": 0.3},
		"boss": "hauler",
		"boss_name": "Mining Hauler",
		"tint": Color(0.8, 0.85, 1.0),
	},
	{
		"name": "Imperial Fleet",
		"subtitle": "Nebula and capital-ship hulls.",
		"bg_far": "res://assets/backgrounds/l2_far.png",
		"bg_mid": "res://assets/backgrounds/l2_mid.png",
		"ground": "",
		"far_speed": 14.0,
		"mid_speed": 55.0,
		"asteroids": false,
		"waves": 5,
		"enemy_mix": {"grunt": 0.45, "shooter": 0.55},
		"boss": "cruiser",
		"boss_name": "Imperial Cruiser",
		"tint": Color(1.0, 0.9, 1.0),
	},
	{
		"name": "Planet Surface",
		"subtitle": "Warm sky over scrolling ground.",
		"bg_far": "res://assets/backgrounds/l3_far.png",
		"bg_mid": "res://assets/backgrounds/l3_mid.png",
		"ground": "res://assets/backgrounds/l3_ground.png",
		"far_speed": 16.0,
		"mid_speed": 70.0,
		"asteroids": false,
		"waves": 6,
		"enemy_mix": {"grunt": 0.55, "shooter": 0.45},
		"boss": "walker",
		"boss_name": "Imperial Walker",
		"tint": Color(1.0, 0.95, 0.85),
	},
]

# ---------------------------------------------------------------------------
# BOSSES  (id -> def). hp scales with loop.
# ---------------------------------------------------------------------------
const BOSSES := {
	"hauler": {"name": "Mining Hauler", "sprite": "res://assets/sprites/boss_hauler.png", "hp": 60.0, "pattern": "spray"},
	"cruiser": {"name": "Imperial Cruiser", "sprite": "res://assets/sprites/boss_cruiser.png", "hp": 80.0, "pattern": "aimed"},
	"walker": {"name": "Imperial Walker", "sprite": "res://assets/sprites/boss_walker.png", "hp": 110.0, "pattern": "burst"},
}

# ---------------------------------------------------------------------------
# ENEMIES
# ---------------------------------------------------------------------------
const ENEMIES := {
	"grunt": {"sprite": "res://assets/sprites/enemy_grunt.png", "hp": 2.0, "speed": 180.0, "score": 10, "beskar": 1, "shoots": false},
	"shooter": {"sprite": "res://assets/sprites/enemy_shooter.png", "hp": 4.0, "speed": 90.0, "score": 25, "beskar": 2, "shoots": true},
}

# Difficulty scaling per loop (loop 0 = first campaign pass).
static func loop_hp_mult(loop: int) -> float:
	return 1.0 + 0.35 * loop

static func loop_speed_mult(loop: int) -> float:
	return 1.0 + 0.12 * loop

static func loop_beskar_mult(loop: int) -> float:
	return 1.0 + 0.5 * loop
