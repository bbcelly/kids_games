extends Area2D
class_name Projectile
## Player-fired projectile. Handles straight bolts, homing missiles and
## piercing laser lances from one configurable script.

var velocity: Vector2 = Vector2.RIGHT * 720.0
var damage: float = 1.0
var homing: bool = false
var piercing: bool = false
var is_laser: bool = false
var lifetime: float = 1.4
var turn_rate: float = 6.0          # radians/sec for homing
var color: Color = Color(0.6, 1.0, 0.7)

var _age: float = 0.0
var _hit: Dictionary = {}            # enemies already damaged (piercing)
var _sprite: Sprite2D

const SPEED := 760.0

func _ready() -> void:
	collision_layer = 4      # player_bullet
	collision_mask = 2       # enemy
	_sprite = Sprite2D.new()
	var tex_path := "res://assets/sprites/laser.png" if is_laser else (
		"res://assets/sprites/missile.png" if homing else "res://assets/sprites/player_bullet.png")
	_sprite.texture = load(tex_path)
	_sprite.modulate = color
	add_child(_sprite)
	if is_laser:
		_sprite.scale = Vector2(3.0, 1.6)
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	if is_laser:
		rect.size = Vector2(48, 14)
	elif homing:
		rect.size = Vector2(28, 14)
	else:
		rect.size = Vector2(22, 10)
	shape.shape = rect
	add_child(shape)
	area_entered.connect(_on_area_entered)
	rotation = velocity.angle()

func _physics_process(delta: float) -> void:
	_age += delta
	if _age >= lifetime:
		queue_free()
		return
	if homing:
		var target := _nearest_target()
		if target:
			var desired := (target.global_position - global_position).angle()
			var cur := velocity.angle()
			var next := rotate_toward(cur, desired, turn_rate * delta)
			velocity = Vector2.RIGHT.rotated(next) * velocity.length()
	global_position += velocity * delta
	rotation = velocity.angle()
	# laser fades slightly over life
	if is_laser:
		_sprite.modulate.a = 1.0 - _age / lifetime * 0.4

func _nearest_target() -> Node2D:
	var best: Node2D = null
	var best_d := INF
	for grp in ["boss", "enemies"]:
		for e in get_tree().get_nodes_in_group(grp):
			if not is_instance_valid(e):
				continue
			var d := global_position.distance_squared_to(e.global_position)
			if d < best_d:
				best_d = d
				best = e
	return best

func _on_area_entered(area: Area2D) -> void:
	if not (area.is_in_group("enemies") or area.is_in_group("boss")):
		return
	if piercing and _hit.has(area.get_instance_id()):
		return
	if area.has_method("take_damage"):
		area.take_damage(damage)
	if piercing:
		_hit[area.get_instance_id()] = true
	else:
		queue_free()
