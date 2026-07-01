extends Control
## Title screen: "BESKAR RUN — This is the Way". Routes to a run or the hangar
## and shows the player's standing (vault, level, loop).

var DW := 1280.0          # real canvas width (set from the viewport in _ready)
const DH := 720.0

var _ship: Sprite2D
var _t := 0.0

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	# The title is the boot scene, so _ready runs before the window resizes to
	# the device's full size. Rebuild once the viewport settles so everything
	# stays centred on the real canvas width.
	get_viewport().size_changed.connect(_build_ui)
	_build_ui()

func _build_ui() -> void:
	DW = get_viewport_rect().size.x
	for c in get_children():
		c.queue_free()

	var bg := TextureRect.new()
	bg.texture = load("res://assets/backgrounds/l1_far.png")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	add_child(bg)
	var bg2 := TextureRect.new()
	bg2.texture = load("res://assets/backgrounds/l1_mid.png")
	bg2.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg2.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg2.modulate.a = 0.8
	add_child(bg2)

	_ship = Sprite2D.new()
	_ship.texture = load("res://assets/sprites/player_ship.png")
	_ship.scale = Vector2(2.4, 2.4)
	_ship.position = Vector2(DW * 0.5, 250)
	add_child(_ship)
	var comp := Sprite2D.new()
	comp.texture = load("res://assets/sprites/companion.png")
	comp.scale = Vector2(2.0, 2.0)
	comp.position = Vector2(DW * 0.5 - 120, 268)
	add_child(comp)

	var title := _label("BESKAR RUN", 96, Color(0.6, 1.0, 0.7))
	title.position = Vector2(0, 40)
	title.size = Vector2(DW, 110)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(title)
	var sub := _label("This is the Way", 34, Color(1.0, 0.88, 0.45))
	sub.position = Vector2(0, 150)
	sub.size = Vector2(DW, 44)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(sub)

	var standing := _label(_standing_text(), 24, Color(0.85, 0.9, 1.0))
	standing.position = Vector2(0, 330)
	standing.size = Vector2(DW, 32)
	standing.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(standing)

	var play := _menu_button("PLAY", DW * 0.5 - 200, 400, 400, 92, 40, Color(0.2, 0.6, 0.4))
	play.pressed.connect(func ():
		Audio.play("button")
		get_tree().change_scene_to_file("res://scenes/Game.tscn"))
	add_child(play)

	var hangar := _menu_button("HANGAR", DW * 0.5 - 200, 510, 400, 76, 32, Color(0.25, 0.4, 0.7))
	hangar.pressed.connect(func ():
		Audio.play("button")
		get_tree().change_scene_to_file("res://scenes/ui/Hangar.tscn"))
	add_child(hangar)

	# discreet reset (hold not needed; small + corner)
	var reset := Button.new()
	reset.text = "reset progress"
	reset.add_theme_font_size_override("font_size", 16)
	reset.modulate = Color(1, 1, 1, 0.4)
	reset.position = Vector2(DW - 170, DH - 40)
	reset.size = Vector2(160, 30)
	reset.pressed.connect(_confirm_reset)
	add_child(reset)

func _process(delta: float) -> void:
	_t += delta
	if _ship:
		_ship.position.y = 250 + sin(_t * 1.6) * 14.0

func _standing_text() -> String:
	return "Vault: %d beskar    ·    Level %d / %d    ·    Loop %d" % [
		GameData.vault, GameData.level_index + 1, Defs.LEVELS.size(), GameData.loop + 1]

func _confirm_reset() -> void:
	var dlg := ConfirmationDialog.new()
	dlg.dialog_text = "Reset all progress, beskar and upgrades?"
	add_child(dlg)
	dlg.confirmed.connect(func ():
		GameData.reset_progress()
		get_tree().reload_current_scene())
	dlg.popup_centered()

func _label(text: String, fs: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	l.add_theme_constant_override("outline_size", 8)
	return l

func _menu_button(text: String, x: float, y: float, w: float, h: float, fs: int, col: Color) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", fs)
	b.custom_minimum_size = Vector2(w, h)
	b.size = Vector2(w, h)
	b.position = Vector2(x, y)
	var sb := StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(14)
	b.add_theme_stylebox_override("normal", sb)
	var sbh := sb.duplicate()
	sbh.bg_color = col.lightened(0.15)
	b.add_theme_stylebox_override("hover", sbh)
	b.add_theme_stylebox_override("pressed", sbh)
	return b
