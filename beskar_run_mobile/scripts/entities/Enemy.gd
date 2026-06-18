extends Area2D
class_name Enemy
## Grunt (rushes the player) or Shooter (slower, fires back). Configured from
## Defs.ENEMIES with per-loop difficulty scaling.

var hp: float = 2.0
var speed: float = 180.0
var score: int = 10
var beskar: int = 1
var shoots: bool = false
var kind: String = "grunt"

var _player: Node2D
var _sprite: Sprite2D
var _t: float = 0.0
var _shoot_cd: float = 0.0
var _weave_phase: float = 0.0
var _dead: bool = false

func setup(type: String, loop: int, player: Node2D) -> void:
	kind = type
	_player = player
	var d: Dictionary = Defs.ENEMIES[type]
	hp = float(d["hp"]) * Defs.loop_hp_mult(loop)
	speed = float(d["speed"]) * Defs.loop_speed_mult(loop)
	score = int(d["score"])
	beskar = int(round(float(d["beskar"]) * Defs.loop_beskar_mult(loop)))
	shoots = bool(d["shoots"])

func _ready() -> void:
	collision_layer = 2      # enemy
	collision_mask = 0       # projectiles & player detect us
	add_to_group("enemies")
	_sprite = Sprite2D.new()
	_sprite.texture = load(Defs.ENEMIES[kind]["sprite"])
	add_child(_sprite)
	var shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = 20.0
	shape.shape = circle
	add_child(shape)
	_weave_phase = randf() * TAU
	_shoot_cd = randf_range(0.8, 1.8)

func _physics_process(delta: float) -> void:
	if _dead:
		return
	_t += delta
	var vel := Vector2(-speed, 0.0)
	if kind == "grunt":
		# rush left, steer toward player's vertical position + gentle weave
		if _player and is_instance_valid(_player):
			var dy: float = _player.global_position.y - global_position.y
			vel.y = clampf(dy * 2.2, -speed * 0.7, speed * 0.7)
		vel.y += sin(_t * 6.0 + _weave_phase) * 40.0
	else:
		# shooter: drift in, then mostly hold x while bobbing; fire bolts
		vel.x = -speed * (1.2 if global_position.x > 1140.0 else 0.35)
		vel.y = sin(_t * 1.6 + _weave_phase) * 70.0
		_shoot_cd -= delta
		if _shoot_cd <= 0.0 and global_position.x < 1200.0:
			_shoot()
			_shoot_cd = randf_range(1.4, 2.4)
	global_position += vel * delta
	if global_position.x < -60.0:
		queue_free()

func _shoot() -> void:
	var parent := get_parent()
	if not parent:
		return
	var b := EnemyBullet.new()
	var dir := Vector2.LEFT
	if _player and is_instance_valid(_player):
		dir = (_player.global_position - global_position).normalized()
	b.velocity = dir * 320.0
	b.global_position = global_position + Vector2(-18, 0)
	parent.add_child(b)
	Audio.play("enemy_shoot", -12.0)

func take_damage(dmg: float) -> void:
	if _dead:
		return
	hp -= dmg
	_flash()
	if hp <= 0.0:
		die(true)

func _flash() -> void:
	_sprite.modulate = Color(2, 2, 2)
	var tw := create_tween()
	tw.tween_property(_sprite, "modulate", Color.WHITE, 0.12)

func die(drop: bool) -> void:
	if _dead:
		return
	_dead = true
	var amt := 0
	var sparkly := false
	if drop:
		amt = beskar
		if randf() < GameData.frog_chance():
			sparkly = true
			amt *= 3
	Explosion.spawn(get_parent(), global_position, 1.0)
	Audio.play("explode", -6.0, randf_range(0.95, 1.1))
	Events.enemy_killed.emit(score, global_position, amt, sparkly)
	queue_free()
