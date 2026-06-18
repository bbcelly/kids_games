extends Node2D
class_name Background
## Layered, depth-scrolling backdrop. Each level supplies a far layer, a mid
## layer and (optionally) a ground strip. Level 1 also drifts asteroids so it
## reads as deep space rather than a flat recolor.

const W := 1280.0
const H := 720.0

var _layers: Array = []     # each: {sprites:[Sprite2D,Sprite2D], speed:float}
var _asteroids: Array = []
var _spawn_asteroids := false
var _ast_timer := 0.0

func setup(level: Dictionary) -> void:
	_clear()
	_add_layer(level["bg_far"], float(level["far_speed"]), 0.0, -100, Color.WHITE)
	_add_layer(level["bg_mid"], float(level["mid_speed"]), 0.0, -90, Color.WHITE)
	if String(level.get("ground", "")) != "":
		_add_ground(level["ground"], float(level["mid_speed"]) * 1.6)
	_spawn_asteroids = bool(level.get("asteroids", false))

func _clear() -> void:
	for c in get_children():
		c.queue_free()
	_layers.clear()
	_asteroids.clear()

func _add_layer(path: String, speed: float, y: float, z: int, tint: Color) -> void:
	if not ResourceLoader.exists(path):
		return
	var tex: Texture2D = load(path)
	var sprites: Array = []
	for i in 2:
		var s := Sprite2D.new()
		s.texture = tex
		s.centered = false
		s.position = Vector2(i * W, y)
		s.z_index = z
		s.modulate = tint
		add_child(s)
		sprites.append(s)
	_layers.append({"sprites": sprites, "speed": speed})

func _add_ground(path: String, speed: float) -> void:
	var tex: Texture2D = load(path)
	var gy := H - tex.get_height()
	var sprites: Array = []
	for i in 2:
		var s := Sprite2D.new()
		s.texture = tex
		s.centered = false
		s.position = Vector2(i * W, gy)
		s.z_index = -80
		add_child(s)
		sprites.append(s)
	_layers.append({"sprites": sprites, "speed": speed})

func _process(delta: float) -> void:
	for layer in _layers:
		var speed: float = layer["speed"]
		for s in layer["sprites"]:
			s.position.x -= speed * delta
			if s.position.x <= -W:
				s.position.x += W * 2.0
	if _spawn_asteroids:
		_ast_timer -= delta
		if _ast_timer <= 0.0:
			_spawn_asteroid()
			_ast_timer = randf_range(0.8, 1.8)
	for a in _asteroids.duplicate():
		if not is_instance_valid(a):
			_asteroids.erase(a)
			continue
		a.position.x -= a.get_meta("spd") * delta
		a.rotation += a.get_meta("rot") * delta
		if a.position.x < -80.0:
			a.queue_free()
			_asteroids.erase(a)

func _spawn_asteroid() -> void:
	var s := Sprite2D.new()
	s.texture = load("res://assets/sprites/asteroid.png")
	s.position = Vector2(W + 60, randf_range(60, H - 60))
	s.z_index = -85
	var sc := randf_range(0.5, 1.6)
	s.scale = Vector2(sc, sc)
	s.modulate = Color(0.7, 0.72, 0.8)
	s.set_meta("spd", randf_range(40, 90))
	s.set_meta("rot", randf_range(-0.6, 0.6))
	add_child(s)
	_asteroids.append(s)
