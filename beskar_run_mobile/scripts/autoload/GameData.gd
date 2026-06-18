extends Node
## Persistent player profile: vault (currency), owned weapons, upgrade & gift
## levels, equipped weapon, and campaign progress. Saves to local device
## storage (user://) — no account, no network.

const SAVE_PATH := "user://beskar_run_save.json"

# --- persistent state ---
var vault: int = 0                       # banked beskar (currency)
var owned_weapons: Array = ["blaster"]   # weapon ids owned
var equipped_weapon: String = "blaster"
var upgrades: Dictionary = {}            # id -> level
var gifts: Dictionary = {}               # id -> level
var level_index: int = 0                 # furthest level reached (0-based)
var loop: int = 0                        # how many full campaign loops done
var best_score: int = 0
var total_runs: int = 0

# --- transient (current run) ---
var run_beskar: int = 0
var run_score: int = 0

func _ready() -> void:
	_ensure_defaults()
	load_game()

func _ensure_defaults() -> void:
	for id in Defs.UPGRADES:
		if not upgrades.has(id):
			upgrades[id] = 0
	for id in Defs.GIFTS:
		if not gifts.has(id):
			gifts[id] = 0

# ---------------------------------------------------------------------------
# Economy
# ---------------------------------------------------------------------------
func can_afford(cost: int) -> bool:
	return vault >= cost

func spend(cost: int) -> bool:
	if not can_afford(cost):
		return false
	vault -= cost
	save_game()
	return true

func add_vault(amount: int) -> void:
	vault = max(0, vault + amount)

# Weapons -------------------------------------------------------------------
func owns_weapon(id: String) -> bool:
	return owned_weapons.has(id)

func weapon_cost(id: String) -> int:
	return int(Defs.WEAPONS[id].get("cost", 0))

func buy_weapon(id: String) -> bool:
	if owns_weapon(id) or not Defs.WEAPONS.has(id):
		return false
	if spend(weapon_cost(id)):
		owned_weapons.append(id)
		save_game()
		return true
	return false

func equip_weapon(id: String) -> void:
	if owns_weapon(id):
		equipped_weapon = id
		save_game()

# Upgrades ------------------------------------------------------------------
func upgrade_level(id: String) -> int:
	return int(upgrades.get(id, 0))

func upgrade_maxed(id: String) -> bool:
	return upgrade_level(id) >= int(Defs.UPGRADES[id]["max"])

func upgrade_cost(id: String) -> int:
	var d: Dictionary = Defs.UPGRADES[id]
	return int(d["base_cost"]) + int(d["step"]) * upgrade_level(id)

func buy_upgrade(id: String) -> bool:
	if not Defs.UPGRADES.has(id) or upgrade_maxed(id):
		return false
	if spend(upgrade_cost(id)):
		upgrades[id] = upgrade_level(id) + 1
		save_game()
		return true
	return false

# Gifts ---------------------------------------------------------------------
func gift_level(id: String) -> int:
	return int(gifts.get(id, 0))

func gift_maxed(id: String) -> bool:
	return gift_level(id) >= int(Defs.GIFTS[id]["max"])

func gift_cost(id: String) -> int:
	var d: Dictionary = Defs.GIFTS[id]
	return int(d["base_cost"]) + int(d["step"]) * gift_level(id)

func buy_gift(id: String) -> bool:
	if not Defs.GIFTS.has(id) or gift_maxed(id):
		return false
	if spend(gift_cost(id)):
		gifts[id] = gift_level(id) + 1
		save_game()
		return true
	return false

# ---------------------------------------------------------------------------
# Derived ship stats from upgrades
# ---------------------------------------------------------------------------
func max_hearts() -> int:
	return Defs.BASE_HEARTS + upgrade_level("armor")

func fire_rate_mult() -> float:
	return 1.0 + Defs.FIRE_RATE_PER_LEVEL * upgrade_level("fire_rate")

func move_speed() -> float:
	return Defs.BASE_SPEED * (1.0 + Defs.SPEED_PER_LEVEL * upgrade_level("thrusters"))

func magnet_radius() -> float:
	return Defs.MAGNET_RADIUS[clampi(gift_level("magnet"), 0, Defs.MAGNET_RADIUS.size() - 1)]

func wipe_cooldown() -> float:
	return Defs.WIPE_COOLDOWN[clampi(gift_level("wipe"), 0, Defs.WIPE_COOLDOWN.size() - 1)]

func wipe_boss_damage() -> float:
	return Defs.WIPE_BOSS_DMG[clampi(gift_level("wipe"), 0, Defs.WIPE_BOSS_DMG.size() - 1)]

func has_wipe() -> bool:
	return gift_level("wipe") > 0

func mend_rate() -> float:
	return Defs.MEND_RATE[clampi(gift_level("mend"), 0, Defs.MEND_RATE.size() - 1)]

func frog_chance() -> float:
	return Defs.FROG_CHANCE[clampi(gift_level("frog"), 0, Defs.FROG_CHANCE.size() - 1)]

func revives() -> int:
	return Defs.BOND_REVIVES[clampi(gift_level("bond"), 0, Defs.BOND_REVIVES.size() - 1)]

# ---------------------------------------------------------------------------
# Run lifecycle
# ---------------------------------------------------------------------------
func begin_run() -> void:
	run_beskar = 0
	run_score = 0

## Called when a run ends; banks beskar, records score, advances campaign.
func end_run(reached_level: int, completed_level: bool) -> void:
	vault += run_beskar
	best_score = max(best_score, run_score)
	total_runs += 1
	if completed_level:
		var next := reached_level + 1
		if next >= Defs.LEVELS.size():
			loop += 1
			level_index = 0
		else:
			level_index = max(level_index, next)
	save_game()

func current_loop_for_level(_idx: int) -> int:
	return loop

# ---------------------------------------------------------------------------
# Save / Load
# ---------------------------------------------------------------------------
func to_dict() -> Dictionary:
	return {
		"vault": vault,
		"owned_weapons": owned_weapons,
		"equipped_weapon": equipped_weapon,
		"upgrades": upgrades,
		"gifts": gifts,
		"level_index": level_index,
		"loop": loop,
		"best_score": best_score,
		"total_runs": total_runs,
	}

func save_game() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f == null:
		push_warning("Beskar Run: could not open save file for writing")
		return
	f.store_string(JSON.stringify(to_dict(), "\t"))
	f.close()

func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		_ensure_defaults()
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return
	var text := f.get_as_text()
	f.close()
	var data = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY:
		return
	vault = int(data.get("vault", 0))
	owned_weapons = data.get("owned_weapons", ["blaster"])
	if not owned_weapons.has("blaster"):
		owned_weapons.append("blaster")
	equipped_weapon = String(data.get("equipped_weapon", "blaster"))
	if not owned_weapons.has(equipped_weapon):
		equipped_weapon = "blaster"
	upgrades = data.get("upgrades", {})
	gifts = data.get("gifts", {})
	level_index = int(data.get("level_index", 0))
	loop = int(data.get("loop", 0))
	best_score = int(data.get("best_score", 0))
	total_runs = int(data.get("total_runs", 0))
	_ensure_defaults()

func reset_progress() -> void:
	vault = 0
	owned_weapons = ["blaster"]
	equipped_weapon = "blaster"
	upgrades = {}
	gifts = {}
	level_index = 0
	loop = 0
	best_score = 0
	total_runs = 0
	_ensure_defaults()
	save_game()
