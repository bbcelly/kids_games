extends Area2D
class_name Boss
## Level boss. Flies in from the right, holds station bobbing, and fires one of
## three patterns: spray (Hauler), aimed (Cruiser), burst (Walker).

var max_hp: float = 60.0
var hp: float = 60.0
var pattern: String = "spray"
var boss_name: String = "Boss"
var score: int = 500
var beskar_drop: int = 30

var _player: Node2D
var _sprite: Sprite2D
var _t: float = 0.0
var _fire_cd: float = 2.0
var _entered: bool = false
var _home_x: float = 1040.0
var _base_y: float = 360.0
var _dead: bool = false

func setup(boss_id: String, loop: int, player: Node2D) -> void:
	var d: Dictionary = Defs.BOSSES[boss_id]
	boss_name = String(d["name"])
	pattern = String(d["pattern"])
	max_hp = float(d["hp"]) * Defs.loop_hp_mult(loop)
	hp = max_hp
	_player = player
	beskar_drop = int(30 * Defs.loop_beskar_mult(loop))
	_sprite_path = String(d["sprite"])

var _sprite_path: String = ""

func _ready() -> void:
	collision_layer = 2
	collision_mask = 0
	add_to_group("boss")
	_sprite = Sprite2D.new()
	_sprite.texture = load(_sprite_path)
	add_child(_sprite)
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	var ts: Vector2 = _sprite.texture.get_size()
	rect.size = ts * 0.8
	shape.shape = rect
	add_child(shape)
	global_position = Vector2(1480, _base_y)
	Audio.play("boss")
	Events.boss_spawned.emit(boss_name)
	Events.boss_hp_changed.emit(hp, max_hp)

func _physics_process(delta: float) -> void:
	if _dead:
		return
	_t += delta
	if not _entered:
		global_position.x = move_toward(global_position.x, _home_x, 240.0 * delta)
		if absf(global_position.x - _home_x) < 2.0:
			_entered = true
		return
	# bob vertically
	global_position.y = _base_y + sin(_t * 1.1) * 150.0
	_fire_cd -= delta
	if _fire_cd <= 0.0:
		_fire()

func _fire() -> void:
	match pattern:
		"spray":
			_fire_spray()
			_fire_cd = 1.5
		"aimed":
			_fire_aimed()
			_fire_cd = 1.1
		"burst":
			_fire_burst()
			_fire_cd = 2.2
		_:
			_fire_spray()
			_fire_cd = 1.6

func _bullet(dir: Vector2, spd: float = 300.0) -> void:
	var b := EnemyBullet.new()
	b.velocity = dir.normalized() * spd
	b.global_position = global_position + Vector2(-40, 0)
	get_parent().add_child(b)

func _fire_spray() -> void:
	for i in range(-3, 4):
		_bullet(Vector2.LEFT.rotated(deg_to_rad(i * 14.0)), 280.0)
	Audio.play("enemy_shoot", -8.0)

func _fire_aimed() -> void:
	var base := Vector2.LEFT
	if _player and is_instance_valid(_player):
		base = (_player.global_position - global_position).normalized()
	for off in [-10.0, 0.0, 10.0]:
		_bullet(base.rotated(deg_to_rad(off)), 360.0)
	Audio.play("enemy_shoot", -8.0)

func _fire_burst() -> void:
	for i in 5:
		var t := create_tween()
		var idx := i
		t.tween_interval(0.08 * idx)
		t.tween_callback(func ():
			if not _dead:
				_bullet(Vector2.LEFT.rotated(deg_to_rad(randf_range(-18, 18))), 340.0))
	Audio.play("enemy_shoot", -6.0)

func take_damage(dmg: float) -> void:
	if _dead:
		return
	hp -= dmg
	_sprite.modulate = Color(2, 1.4, 1.4)
	var tw := create_tween()
	tw.tween_property(_sprite, "modulate", Color.WHITE, 0.12)
	Events.boss_hp_changed.emit(max(0.0, hp), max_hp)
	if hp <= 0.0:
		_die()

func _die() -> void:
	_dead = true
	# multiple explosions for drama
	for i in 6:
		var off := Vector2(randf_range(-50, 50), randf_range(-40, 40))
		var d := create_tween()
		d.tween_interval(0.1 * i)
		d.tween_callback(func ():
			if is_instance_valid(self):
				Explosion.spawn(get_parent(), global_position + off, 1.6))
	Audio.play("explode", 0.0, 0.8)
	Events.enemy_killed.emit(score, global_position, beskar_drop, false)
	Events.boss_defeated.emit()
	var done := create_tween()
	done.tween_interval(0.7)
	done.tween_callback(queue_free)
	# hide collision/sprite during the death show
	set_deferred("collision_layer", 0)
	set_deferred("monitorable", false)
	remove_from_group("boss")
