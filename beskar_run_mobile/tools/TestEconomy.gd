extends Node
## Headless self-test for GameData economy + persistence.
## Run: godot --headless res://tools/TestEconomy.tscn

var _fail := 0

func _check(cond: bool, msg: String) -> void:
	if cond:
		print("  PASS  ", msg)
	else:
		print("  FAIL  ", msg)
		_fail += 1

func _ready() -> void:
	print("== Beskar Run economy tests ==")
	GameData.reset_progress()

	# starting state
	_check(GameData.vault == 0, "starts with empty vault")
	_check(GameData.owned_weapons == ["blaster"], "starts owning only blaster")
	_check(GameData.equipped_weapon == "blaster", "blaster equipped")
	_check(GameData.max_hearts() == Defs.BASE_HEARTS, "base hearts")

	# can't buy without funds
	_check(not GameData.buy_upgrade("fire_rate"), "cannot buy upgrade while broke")
	_check(not GameData.buy_weapon("twin"), "cannot buy weapon while broke")

	# grant beskar and buy an upgrade
	GameData.add_vault(500)
	var cost := GameData.upgrade_cost("fire_rate")
	_check(GameData.buy_upgrade("fire_rate"), "buy fire_rate upgrade")
	_check(GameData.vault == 500 - cost, "vault debited by upgrade cost")
	_check(GameData.upgrade_level("fire_rate") == 1, "fire_rate now level 1")
	_check(GameData.fire_rate_mult() > 1.0, "fire rate multiplier increased")

	# buy & equip a weapon
	_check(GameData.buy_weapon("twin"), "buy twin cannon")
	_check(GameData.owns_weapon("twin"), "now owns twin")
	GameData.equip_weapon("twin")
	_check(GameData.equipped_weapon == "twin", "twin equipped")

	# armor adds hearts
	GameData.add_vault(1000)
	var h0 := GameData.max_hearts()
	GameData.buy_upgrade("armor")
	_check(GameData.max_hearts() == h0 + 1, "armor adds a heart")

	# gift unlocks force wipe
	_check(not GameData.has_wipe(), "no wipe before buying")
	GameData.buy_gift("wipe")
	_check(GameData.has_wipe(), "wipe available after buying")
	_check(GameData.wipe_cooldown() > 0.0, "wipe has a cooldown")

	# run banking + campaign advance
	GameData.begin_run()
	GameData.run_beskar = 42
	GameData.run_score = 999
	var v_before := GameData.vault
	var lvl_before := GameData.level_index
	GameData.end_run(0, true)
	_check(GameData.vault == v_before + 42, "run beskar banked to vault")
	_check(GameData.best_score == 999, "best score recorded")
	_check(GameData.level_index == lvl_before + 1, "completing level 0 advances to level 1")

	# loop wrap
	GameData.level_index = Defs.LEVELS.size() - 1
	var loop_before := GameData.loop
	GameData.end_run(Defs.LEVELS.size() - 1, true)
	_check(GameData.loop == loop_before + 1, "finishing last level increments loop")
	_check(GameData.level_index == 0, "loop wraps back to level 0")

	# persistence round-trip
	GameData.save_game()
	var saved_vault := GameData.vault
	var saved_owned := GameData.owned_weapons.duplicate()
	GameData.vault = -1
	GameData.owned_weapons = []
	GameData.load_game()
	_check(GameData.vault == saved_vault, "vault survives save/load")
	_check(GameData.owned_weapons == saved_owned, "owned weapons survive save/load")

	# clean up so the player starts fresh
	GameData.reset_progress()

	print("== %s ==" % ("ALL PASS" if _fail == 0 else "%d FAILED" % _fail))
	get_tree().quit(_fail)
