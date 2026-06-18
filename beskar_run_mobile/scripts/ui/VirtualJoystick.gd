extends Control
class_name VirtualJoystick
## Floating virtual joystick for the left thumb. Appears where the thumb lands
## inside the active zone, follows the drag, and reports a normalized vector.
## Tracks its own finger index so it cooperates with the right-side buttons
## (multitouch) and also accepts the mouse for desktop testing.

@export var radius: float = 110.0
@export var dead_zone: float = 0.12

var output: Vector2 = Vector2.ZERO
var _finger: int = -2          # -2 = none, -1 = mouse, >=0 = touch index
var _origin: Vector2 = Vector2.ZERO

var _base: Control
var _knob: Control

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_base = _make_ring(radius, Color(1, 1, 1, 0.16), Color(1, 1, 1, 0.30))
	_knob = _make_ring(radius * 0.42, Color(0.6, 0.9, 1.0, 0.5), Color(0.8, 0.95, 1.0, 0.9))
	add_child(_base)
	add_child(_knob)
	_set_visible(false)

func _make_ring(r: float, fill: Color, border: Color) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(r * 2, r * 2)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func ():
		c.draw_circle(Vector2(r, r), r, fill)
		c.draw_arc(Vector2(r, r), r - 2, 0, TAU, 48, border, 4.0, true))
	c.set_meta("r", r)
	return c

func _is_in_zone(pos: Vector2) -> bool:
	# left ~48% of the screen is the joystick zone
	return pos.x < get_viewport_rect().size.x * 0.48

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_handle_press(event.index, event.position, event.pressed)
	elif event is InputEventScreenDrag:
		_handle_drag(event.index, event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_handle_press(-1, event.position, event.pressed)
	elif event is InputEventMouseMotion and _finger == -1:
		_handle_drag(-1, event.position)

func _handle_press(index: int, pos: Vector2, pressed: bool) -> void:
	if pressed:
		if _finger == -2 and _is_in_zone(pos):
			_finger = index
			_origin = pos
			_place()
			_set_visible(true)
			output = Vector2.ZERO
	else:
		if index == _finger:
			_finger = -2
			output = Vector2.ZERO
			_set_visible(false)

func _handle_drag(index: int, pos: Vector2) -> void:
	if index != _finger:
		return
	var delta := pos - _origin
	if delta.length() > radius:
		delta = delta.normalized() * radius
	_knob.position = _origin - Vector2(_knob.get_meta("r"), _knob.get_meta("r")) + delta
	var v := delta / radius
	output = Vector2.ZERO if v.length() < dead_zone else v

func _place() -> void:
	_base.position = _origin - Vector2(radius, radius)
	_knob.position = _origin - Vector2(_knob.get_meta("r"), _knob.get_meta("r"))

func _set_visible(v: bool) -> void:
	_base.visible = v
	_knob.visible = v
