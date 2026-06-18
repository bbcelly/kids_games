extends Area2D
class_name EnemyBullet
## Bullet fired by enemies / bosses. Travels in a straight line.

var velocity: Vector2 = Vector2.LEFT * 360.0
var damage: int = 1
var lifetime: float = 4.0
var _age: float = 0.0

func _ready() -> void:
	collision_layer = 8      # enemy_bullet
	collision_mask = 0       # player detects us, we detect nothing
	add_to_group("enemy_bullets")
	var spr := Sprite2D.new()
	spr.texture = load("res://assets/sprites/enemy_bullet.png")
	add_child(spr)
	var shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = 8.0
	shape.shape = circle
	add_child(shape)

func _physics_process(delta: float) -> void:
	_age += delta
	if _age >= lifetime:
		queue_free()
		return
	global_position += velocity * delta

func clear() -> void:
	queue_free()
