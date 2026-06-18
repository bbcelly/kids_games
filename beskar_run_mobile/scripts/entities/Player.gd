extends Area2D
class_name Player
## The green beskar gunship. Flies via the virtual joystick, auto-fires the
## equipped weapon, can swap weapons and trigger the Force Wipe. Carries the
## companion (Grogu) who handles Force Mend regen.

signal hearts_changed(current: float, max: int)

var move_vector: Vector2 = Vector2.ZERO     # set by HUD joystick, range ~[-1,1]
var play_rect: Rect2 = Rect2(40, 40, 1200, 640)
var projectile_parent: Node = null

var max_hearts: int = 3
var hearts: float = 3.0
var speed: float = 360.0
var invuln: float = 0.0
var revives_left: int = 0
var alive: bool = true

var _weapon_id: String = "blaster"
var _owned: Array = ["blaster"]
var _fire_cd: float = 0.0
var _wipe_cd: float = 0.0
var _wipe_total: float = 0.0
var _sprite: Sprite2D
var _companion: Sprite2D
var _t: float = 0.0

func _ready() -> void:
	collision_layer = 1                  # player
	collision_mask = 2 | 8 | 16          # enemy | enemy_bullet | pickup
	add_to_group("player")

	_sprite = Sprite2D.new()
	_sprite.texture = load("res://assets/sprites/player_ship.png")
	add_child(_sprite)

	_companion = Sprite2D.new()
	_companion.texture = load("res://assets/sprites/companion.png")
	_companion.position = Vector2(-46, 6)
	add_child(_companion)

	var shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = 22.0
	shape.shape = circle
	add_child(shape)

	area_entered.connect(_on_area_entered)

	# Pull stats from the player's saved loadout.
	max_hearts = GameData.max_hearts()
	hearts = float(max_hearts)
	speed = GameData.move_speed()
	revives_left = GameData.revives()
	_owned = GameData.owned_weapons.duplicate()
	_weapon_id = GameData.equipped_weapon
	if not _owned.has(_weapon_id):
		_weapon_id = "blaster"
	_wipe_total = GameData.wipe_cooldown()
	_wipe_cd = 0.0

func _physics_process(delta: float) -> void:
	if not alive:
		return
	_t += delta
	if invuln > 0.0:
		invuln -= delta
		_sprite.modulate.a = 0.4 if int(_t * 20.0) % 2 == 0 else 1.0
	else:
		_sprite.modulate.a = 1.0

	# Movement
	var v := move_vector
	if v.length() > 1.0:
		v = v.normalized()
	global_position += v * speed * delta
	global_position.x = clampf(global_position.x, play_rect.position.x, play_rect.position.x + play_rect.size.x)
	global_position.y = clampf(global_position.y, play_rect.position.y, play_rect.position.y + play_rect.size.y)

	# Companion bob
	_companion.position.y = 6 + sin(_t * 4.0) * 4.0

	# Auto-fire
	_fire_cd -= delta
	if _fire_cd <= 0.0:
		_fire()
		var wd: Dictionary = Defs.WEAPONS[_weapon_id]
		var rate: float = float(wd["fire_rate"]) * GameData.fire_rate_mult()
		_fire_cd = 1.0 / max(0.5, rate)

	# Force Mend regen
	var mend := GameData.mend_rate()
	if mend > 0.0 and hearts < float(max_hearts):
		hearts = min(float(max_hearts), hearts + mend * delta)
		hearts_changed.emit(hearts, max_hearts)

	# Force Wipe cooldown
	if _wipe_cd > 0.0:
		_wipe_cd -= delta
		Events.force_power_cooldown.emit(max(0.0, _wipe_cd), _wipe_total)
		if _wipe_cd <= 0.0:
			Events.force_power_ready.emit()

# ---------------------------------------------------------------------------
# Firing
# ---------------------------------------------------------------------------
func _fire() -> void:
	var wd: Dictionary = Defs.WEAPONS[_weapon_id]
	var parent := projectile_parent if projectile_parent else get_parent()
	var muzzle := global_position + Vector2(28, 0)
	for b in wd["bolts"]:
		var p := Projectile.new()
		var ang: float = deg_to_rad(float(b.get("angle", 0.0)))
		if b.has("spread"):
			ang += deg_to_rad(randf_range(-float(b["spread"]), float(b["spread"])))
		var dir := Vector2.RIGHT.rotated(ang)
		p.homing = bool(b.get("homing", false))
		p.piercing = bool(b.get("piercing", false))
		p.is_laser = bool(b.get("laser", false))
		var spd: float = 520.0 if p.homing else (900.0 if p.is_laser else 760.0)
		p.velocity = dir * spd
		p.damage = float(wd["dmg"])
		p.lifetime = float(wd.get("lifetime", 1.4))
		p.color = wd.get("color", Color.WHITE)
		p.global_position = muzzle + Vector2(0, float(b.get("offset", 0.0)))
		parent.add_child(p)
	Audio.play("shoot", -8.0, randf_range(0.95, 1.08))

func cycle_weapon() -> void:
	if _owned.size() <= 1:
		return
	var idx := _owned.find(_weapon_id)
	# step through Defs order, only owned ones
	var ordered := []
	for id in Defs.WEAPON_ORDER:
		if _owned.has(id):
			ordered.append(id)
	if ordered.is_empty():
		return
	var oi := ordered.find(_weapon_id)
	_weapon_id = ordered[(oi + 1) % ordered.size()]
	GameData.equip_weapon(_weapon_id)
	Events.weapon_changed.emit(_weapon_id)
	Audio.play("button", -6.0)

func current_weapon() -> String:
	return _weapon_id

# ---------------------------------------------------------------------------
# Force Wipe
# ---------------------------------------------------------------------------
func use_force() -> void:
	if not GameData.has_wipe() or _wipe_cd > 0.0:
		return
	_wipe_cd = _wipe_total
	_wipe_total = GameData.wipe_cooldown()
	Audio.play("force")
	Events.force_power_used.emit(_wipe_total)
	_spawn_wipe_ring()
	# clear all enemy bullets
	for b in get_tree().get_nodes_in_group("enemy_bullets"):
		if is_instance_valid(b):
			b.queue_free()
	# clear enemies (no beskar — it's a panic button) but they still count
	for e in get_tree().get_nodes_in_group("enemies"):
		if is_instance_valid(e) and e.has_method("die"):
			e.die(false)
	# hurt boss
	for boss in get_tree().get_nodes_in_group("boss"):
		if is_instance_valid(boss) and boss.has_method("take_damage"):
			boss.take_damage(GameData.wipe_boss_damage())

func _spawn_wipe_ring() -> void:
	var ring := Sprite2D.new()
	ring.texture = load("res://assets/sprites/force_ring.png")
	ring.global_position = global_position
	ring.modulate = Color(0.6, 0.9, 1.0, 0.9)
	(projectile_parent if projectile_parent else get_parent()).add_child(ring)
	var tw := create_tween()
	tw.tween_property(ring, "scale", Vector2(30, 30), 0.45)
	tw.parallel().tween_property(ring, "modulate:a", 0.0, 0.45)
	tw.tween_callback(ring.queue_free)

# ---------------------------------------------------------------------------
# Damage / death / revive
# ---------------------------------------------------------------------------
func _on_area_entered(area: Area2D) -> void:
	if not alive:
		return
	if area.is_in_group("beskar") and area.has_method("collect"):
		area.collect()
	elif area.is_in_group("enemy_bullets"):
		area.queue_free()
		_hurt(1)
	elif area.is_in_group("enemies"):
		# crash into a grunt/shooter: hurt both
		if area.has_method("die"):
			area.die(false)
			Explosion.spawn(get_parent(), area.global_position, 1.0)
		_hurt(1)
	elif area.is_in_group("boss"):
		_hurt(1)

func _hurt(dmg: int) -> void:
	if invuln > 0.0 or not alive:
		return
	hearts -= dmg
	invuln = 1.0
	Audio.play("hit")
	hearts_changed.emit(hearts, max_hearts)
	Events.player_hit.emit(int(ceil(hearts)))
	_shake()
	if hearts <= 0.0:
		_die()

func _shake() -> void:
	var tw := create_tween()
	tw.tween_property(_sprite, "position", Vector2(-6, 0), 0.04)
	tw.tween_property(_sprite, "position", Vector2(6, 0), 0.04)
	tw.tween_property(_sprite, "position", Vector2.ZERO, 0.04)

func _die() -> void:
	if revives_left > 0:
		revives_left -= 1
		hearts = ceil(float(max_hearts) * 0.6)
		invuln = 2.0
		Audio.play("force")
		Events.player_revived.emit()
		hearts_changed.emit(hearts, max_hearts)
		_spawn_wipe_ring()
		return
	alive = false
	hearts = 0.0
	Explosion.spawn(get_parent(), global_position, 2.0)
	Audio.play("explode")
	visible = false
	Events.player_died.emit()
