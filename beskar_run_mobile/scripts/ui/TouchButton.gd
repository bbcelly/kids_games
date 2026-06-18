extends Control
class_name TouchButton
## Big round kid-friendly tap button. Tracks its own finger so it works while
## the joystick is held (multitouch). Accepts mouse for desktop testing.

signal tapped()

@export var label: String = ""
@export var radius: float = 64.0
@export var fill: Color = Color(0.2, 0.5, 0.7, 0.85)
@export var fill_down: Color = Color(0.4, 0.8, 1.0, 0.95)

var enabled: bool = true
var _finger: int = -2
var _down: bool = false
var _sub: String = ""          # small status line (e.g. weapon name / cooldown)
var _dim: bool = false

func _ready() -> void:
	custom_minimum_size = Vector2(radius * 2, radius * 2)
	size = custom_minimum_size
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func set_sub(text: String) -> void:
	_sub = text
	queue_redraw()

func set_dim(v: bool) -> void:
	_dim = v
	queue_redraw()

func _contains(pos: Vector2) -> bool:
	var center := global_position + Vector2(radius, radius)
	return pos.distance_to(center) <= radius

func _input(event: InputEvent) -> void:
	if not enabled or not visible:
		return
	if event is InputEventScreenTouch:
		_press(event.index, event.position, event.pressed)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_press(-1, event.position, event.pressed)

func _press(index: int, pos: Vector2, pressed: bool) -> void:
	if pressed:
		if _finger == -2 and _contains(pos):
			_finger = index
			_down = true
			queue_redraw()
			tapped.emit()
			get_viewport().set_input_as_handled()
	else:
		if index == _finger:
			_finger = -2
			_down = false
			queue_redraw()

func _draw() -> void:
	var c := Vector2(radius, radius)
	var base := fill_down if _down else fill
	if _dim:
		base = base.darkened(0.5)
	draw_circle(c, radius, Color(0, 0, 0, 0.35))
	draw_circle(c, radius - 4, base)
	draw_arc(c, radius - 4, 0, TAU, 40, Color(1, 1, 1, 0.5), 4.0, true)
	var f := ThemeDB.fallback_font
	var fs := int(radius * 0.42)
	var ts := f.get_string_size(label, HORIZONTAL_ALIGNMENT_CENTER, -1, fs)
	draw_string(f, c - Vector2(ts.x * 0.5, -ts.y * 0.25), label, HORIZONTAL_ALIGNMENT_CENTER, -1, fs, Color.WHITE)
	if _sub != "":
		var sfs := int(radius * 0.26)
		var ss := f.get_string_size(_sub, HORIZONTAL_ALIGNMENT_CENTER, -1, sfs)
		draw_string(f, Vector2(radius - ss.x * 0.5, radius * 1.55), _sub, HORIZONTAL_ALIGNMENT_CENTER, -1, sfs, Color(0.9, 0.95, 1.0))
