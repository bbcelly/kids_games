extends Area2D
class_name Beskar
## Collectible gold (currency). Drifts left, can be pulled in by the magnet,
## and is collected when it overlaps the player.

var amount: int = 1
var sparkly: bool = false
var drift: Vector2 = Vector2(-90, 0)
var _player: Node2D
var _t: float = 0.0
var _spr: Sprite2D

func _ready() -> void:
	collision_layer = 16     # pickup
	collision_mask = 0
	add_to_group("beskar")
	_spr = Sprite2D.new()
	_spr.texture = load("res://assets/sprites/beskar_sparkle.png" if sparkly else "res://assets/sprites/beskar.png")
	add_child(_spr)
	var shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = 14.0
	shape.shape = circle
	add_child(shape)

func setup(player: Node2D) -> void:
	_player = player

func _physics_process(delta: float) -> void:
	_t += delta
	_spr.scale = Vector2.ONE * (1.0 + 0.12 * sin(_t * 8.0))
	if _player and is_instance_valid(_player):
		var radius := GameData.magnet_radius()
		var to_player := _player.global_position - global_position
		if radius > 0.0 and to_player.length() <= radius:
			global_position += to_player.normalized() * 520.0 * delta
			if to_player.length() < 28.0:
				_collect()
			return
	global_position += drift * delta
	if global_position.x < -40.0:
		queue_free()

func _collect() -> void:
	Events.beskar_collected.emit(amount)
	Audio.play("pickup", -4.0, 1.0 + (0.2 if sparkly else 0.0))
	queue_free()

# Player also calls this on direct overlap.
func collect() -> void:
	_collect()
