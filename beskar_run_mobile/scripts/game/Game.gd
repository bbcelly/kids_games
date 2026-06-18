extends Node2D
## Drives a single level run: spawns timed waves, then the boss, banks beskar,
## and handles win / loss. Built mostly in code so there are no fragile .tscn
## dependencies beyond the entry scene.

const PLAY_RECT := Rect2(60, 70, 1160, 580)

var level_idx: int = 0
var loop: int = 0
var level_def: Dictionary

var _player: Player
var _world: Node2D            # holds enemies / bullets / pickups / fx
var _bg: Background
var _hud: CanvasLayer
var _boss_alive := false
var _boss_defeated := false
var _running := false
var _ended := false

func _ready() -> void:
	level_idx = clampi(GameData.level_index, 0, Defs.LEVELS.size() - 1)
	loop = GameData.loop
	level_def = Defs.LEVELS[level_idx]
	GameData.begin_run()

	# Background
	_bg = Background.new()
	add_child(_bg)
	_bg.setup(level_def)

	# World container (enemies, bullets, pickups, fx)
	_world = Node2D.new()
	_world.name = "World"
	add_child(_world)

	# Player
	_player = Player.new()
	_player.play_rect = PLAY_RECT
	_player.projectile_parent = _world
	_player.global_position = Vector2(220, 360)
	_world.add_child(_player)

	# HUD
	_hud = preload("res://scenes/ui/HUD.tscn").instantiate()
	add_child(_hud)
	_hud.bind(_player, level_def, loop)

	# Signals
	Events.enemy_killed.connect(_on_enemy_killed)
	Events.beskar_collected.connect(_on_beskar_collected)
	Events.boss_defeated.connect(_on_boss_defeated)
	Events.player_died.connect(_on_player_died)

	Events.run_started.emit()
	Events.score_changed.emit(0)
	Events.run_beskar_changed.emit(0)
	_run_level()

# ---------------------------------------------------------------------------
# Level flow (coroutine). Timers use process_always=false so pause halts them.
# ---------------------------------------------------------------------------
func _run_level() -> void:
	_running = true
	await _wait(1.2)
	var waves: int = int(level_def["waves"]) + loop   # more waves each loop
	for w in waves:
		if _ended: return
		Events.wave_started.emit(w + 1, waves)
		await _spawn_wave(w, waves)
		await _wait_until_clear()
		if _ended: return
		await _wait(0.6)
	Events.all_waves_cleared.emit()
	await _wait(0.8)
	if _ended: return
	_spawn_boss()

func _spawn_wave(index: int, _total: int) -> void:
	var count := 4 + index + loop
	var mix: Dictionary = level_def["enemy_mix"]
	for i in count:
		if _ended: return
		var type := _pick_type(mix)
		var e := Enemy.new()
		e.setup(type, loop, _player)
		e.global_position = Vector2(1340, randf_range(PLAY_RECT.position.y + 20, PLAY_RECT.end.y - 20))
		_world.add_child(e)
		await _wait(randf_range(0.35, 0.7))

func _pick_type(mix: Dictionary) -> String:
	var r := randf()
	var acc := 0.0
	for k in mix:
		acc += float(mix[k])
		if r <= acc:
			return k
	return mix.keys()[0]

func _wait_until_clear() -> void:
	# wait until no live enemies remain in the world
	while not _ended and _count_enemies() > 0:
		await get_tree().process_frame
		await _wait(0.15)

func _count_enemies() -> int:
	return get_tree().get_nodes_in_group("enemies").size()

func _spawn_boss() -> void:
	_boss_alive = true
	var boss := Boss.new()
	boss.setup(level_def["boss"], loop, _player)
	_world.add_child(boss)

# ---------------------------------------------------------------------------
# Signal handlers
# ---------------------------------------------------------------------------
func _on_enemy_killed(score: int, world_pos: Vector2, beskar_amount: int, sparkly: bool) -> void:
	GameData.run_score += score
	Events.score_changed.emit(GameData.run_score)
	if beskar_amount > 0:
		_spawn_beskar(world_pos, beskar_amount, sparkly)

func _spawn_beskar(pos: Vector2, amount: int, sparkly: bool) -> void:
	var pieces := clampi(amount, 1, 8)
	for i in pieces:
		var b := Beskar.new()
		b.sparkly = sparkly
		# distribute the total across pieces
		b.amount = (amount / pieces) + (1 if i < amount % pieces else 0)
		b.amount = max(1, b.amount)
		b.global_position = pos + Vector2(randf_range(-24, 24), randf_range(-24, 24))
		b.drift = Vector2(randf_range(-120, -40), randf_range(-30, 30))
		b.setup(_player)
		# add deferred: this runs inside a collision callback (enemy death signal)
		_world.add_child.call_deferred(b)

func _on_beskar_collected(amount: int) -> void:
	GameData.run_beskar += amount
	Events.run_beskar_changed.emit(GameData.run_beskar)

func _on_boss_defeated() -> void:
	_boss_alive = false
	_boss_defeated = true
	_win()

func _on_player_died() -> void:
	if _ended:
		return
	_lose()

# ---------------------------------------------------------------------------
# End states
# ---------------------------------------------------------------------------
func _win() -> void:
	if _ended: return
	_ended = true
	Audio.play("win")
	Events.level_complete.emit()
	GameData.end_run(level_idx, true)
	Events.run_over.emit(true)
	_show_result(true)

func _lose() -> void:
	if _ended: return
	_ended = true
	Audio.play("lose")
	GameData.end_run(level_idx, false)
	Events.run_over.emit(false)
	_show_result(false)

func _show_result(victory: bool) -> void:
	var overlay := preload("res://scenes/ui/ResultScreen.tscn").instantiate()
	add_child(overlay)
	overlay.show_result(victory, level_idx, loop, GameData.run_score, GameData.run_beskar)

# Pausable timer helper.
func _wait(t: float) -> void:
	await get_tree().create_timer(t, false).timeout
