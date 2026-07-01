extends CanvasLayer
## In-run interface: arcade status strip pinned to the top edge, floating
## joystick, big right-side action buttons, transient banners, boss bar, and a
## pause menu. Laid out in 1280x720 design space (canvas_items stretch).

var DW := 1280.0          # real canvas width (set from the viewport in _ready)
const DH := 720.0

var _player: Player
var _loop := 0

var _hearts_box: HBoxContainer
var _score_label: Label
var _beskar_label: Label
var _weapon_label: Label
var _level_label: Label
var _banner: Label
var _boss_panel: Control
var _boss_bar: ProgressBar
var _boss_name: Label
var _joystick: VirtualJoystick
var _btn_weapon: TouchButton
var _btn_force: TouchButton
var _btn_pause: TouchButton
var _pause_menu: Control

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	DW = get_viewport().get_visible_rect().size.x
	_build()

func bind(player: Player, level_def: Dictionary, loop: int) -> void:
	_player = player
	_loop = loop
	_player.hearts_changed.connect(_on_hearts)
	_refresh_hearts(player.hearts, player.max_hearts)
	_level_label.text = "%s%s" % [level_def["name"], (" · LOOP %d" % (loop + 1)) if loop > 0 else ""]
	_update_weapon(player.current_weapon())
	_update_force_button()

	Events.score_changed.connect(func(s): _score_label.text = "SCORE %d" % s)
	Events.run_beskar_changed.connect(func(b): _beskar_label.text = "BESKAR %d" % b)
	Events.weapon_changed.connect(_update_weapon)
	Events.wave_started.connect(func(i, t): _show_banner("WAVE %d / %d" % [i, t], Color(0.7, 0.95, 1.0)))
	Events.all_waves_cleared.connect(func(): _show_banner("WARNING — BOSS INCOMING", Color(1.0, 0.6, 0.5)))
	Events.boss_spawned.connect(_on_boss_spawned)
	Events.boss_hp_changed.connect(_on_boss_hp)
	Events.boss_defeated.connect(func(): _boss_panel.visible = false)
	Events.force_power_cooldown.connect(_on_force_cd)
	Events.force_power_ready.connect(func(): _btn_force.set_sub("READY"); _btn_force.set_dim(false))
	Events.force_power_used.connect(func(_cd): _btn_force.set_dim(true))
	Events.player_revived.connect(func(): _show_banner("FORCE BOND — REVIVED!", Color(0.7, 1.0, 0.8)))

func _process(_delta: float) -> void:
	if _player and is_instance_valid(_player) and not get_tree().paused:
		_player.move_vector = _joystick.output
	if Input.is_action_just_pressed("pause_game"):
		_toggle_pause()
	if Input.is_action_just_pressed("switch_weapon") and _player:
		_player.cycle_weapon()
	if Input.is_action_just_pressed("force_power") and _player:
		_player.use_force()

# ---------------------------------------------------------------------------
# Build UI
# ---------------------------------------------------------------------------
func _build() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# Top status strip
	var strip := ColorRect.new()
	strip.color = Color(0.04, 0.06, 0.14, 0.55)
	strip.position = Vector2(0, 0)
	strip.size = Vector2(DW, 56)
	strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(strip)

	_hearts_box = HBoxContainer.new()
	_hearts_box.position = Vector2(16, 12)
	_hearts_box.add_theme_constant_override("separation", 4)
	root.add_child(_hearts_box)

	_score_label = _mk_label("SCORE 0", 28, Color(0.85, 0.95, 1.0))
	_score_label.position = Vector2(DW * 0.5 - 200, 12)
	_score_label.size = Vector2(200, 36)
	_score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	root.add_child(_score_label)

	_beskar_label = _mk_label("BESKAR 0", 28, Color(1.0, 0.85, 0.4))
	_beskar_label.position = Vector2(DW * 0.5 + 20, 12)
	_beskar_label.size = Vector2(220, 36)
	root.add_child(_beskar_label)

	_level_label = _mk_label("", 20, Color(0.8, 0.85, 0.95))
	_level_label.position = Vector2(DW * 0.5 - 220, 44)
	_level_label.size = Vector2(440, 24)
	_level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(_level_label)

	# Boss panel (hidden until boss)
	_boss_panel = Control.new()
	_boss_panel.position = Vector2(DW * 0.5 - 320, 74)
	_boss_panel.size = Vector2(640, 40)
	_boss_panel.visible = false
	_boss_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_boss_panel)
	_boss_name = _mk_label("", 22, Color(1.0, 0.7, 0.6))
	_boss_name.size = Vector2(640, 24)
	_boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_panel.add_child(_boss_name)
	_boss_bar = ProgressBar.new()
	_boss_bar.position = Vector2(0, 26)
	_boss_bar.size = Vector2(640, 14)
	_boss_bar.show_percentage = false
	_boss_bar.min_value = 0
	_boss_bar.max_value = 1
	_boss_bar.value = 1
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.9, 0.3, 0.35)
	sb.set_corner_radius_all(6)
	_boss_bar.add_theme_stylebox_override("fill", sb)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.1, 0.1, 0.16)
	bg.set_corner_radius_all(6)
	_boss_bar.add_theme_stylebox_override("background", bg)
	_boss_panel.add_child(_boss_bar)

	# Banner (center)
	_banner = _mk_label("", 52, Color.WHITE)
	_banner.position = Vector2(0, DH * 0.34)
	_banner.size = Vector2(DW, 70)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.modulate.a = 0.0
	root.add_child(_banner)

	# Joystick
	_joystick = VirtualJoystick.new()
	_joystick.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_joystick)

	# Right-side action buttons
	_btn_force = TouchButton.new()
	_btn_force.label = "FORCE"
	_btn_force.radius = 70
	_btn_force.fill = Color(0.25, 0.45, 0.75, 0.85)
	_btn_force.position = Vector2(DW - 180, DH - 180)
	_btn_force.tapped.connect(func(): if _player: _player.use_force())
	root.add_child(_btn_force)

	_btn_weapon = TouchButton.new()
	_btn_weapon.label = "SWAP"
	_btn_weapon.radius = 58
	_btn_weapon.fill = Color(0.3, 0.55, 0.4, 0.85)
	_btn_weapon.position = Vector2(DW - 320, DH - 150)
	_btn_weapon.tapped.connect(func(): if _player: _player.cycle_weapon())
	root.add_child(_btn_weapon)

	_btn_pause = TouchButton.new()
	_btn_pause.label = "II"
	_btn_pause.radius = 34
	_btn_pause.fill = Color(0.2, 0.22, 0.3, 0.8)
	_btn_pause.position = Vector2(DW - 80, 64)
	_btn_pause.tapped.connect(_toggle_pause)
	root.add_child(_btn_pause)

	_build_pause_menu(root)

func _mk_label(text: String, font_size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 6)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

# ---------------------------------------------------------------------------
# Hearts
# ---------------------------------------------------------------------------
func _on_hearts(current: float, max_h: int) -> void:
	_refresh_hearts(current, max_h)

func _refresh_hearts(current: float, max_h: int) -> void:
	for c in _hearts_box.get_children():
		c.queue_free()
	var full := load("res://assets/sprites/heart.png")
	var empty := load("res://assets/sprites/heart_empty.png")
	var whole := int(ceil(current))
	for i in max_h:
		var tr := TextureRect.new()
		tr.texture = full if i < whole else empty
		tr.custom_minimum_size = Vector2(34, 32)
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		_hearts_box.add_child(tr)

# ---------------------------------------------------------------------------
# Weapon / Force
# ---------------------------------------------------------------------------
func _update_weapon(id: String) -> void:
	var wd: Dictionary = Defs.WEAPONS.get(id, {})
	_btn_weapon.set_sub(String(wd.get("name", id)))

func _update_force_button() -> void:
	if GameData.has_wipe():
		_btn_force.set_sub("READY")
		_btn_force.set_dim(false)
		_btn_force.enabled = true
	else:
		_btn_force.set_sub("locked")
		_btn_force.set_dim(true)
		_btn_force.enabled = false

func _on_force_cd(remaining: float, _total: float) -> void:
	if remaining > 0.05:
		_btn_force.set_sub("%.0f" % ceil(remaining))
		_btn_force.set_dim(true)

# ---------------------------------------------------------------------------
# Boss + banners
# ---------------------------------------------------------------------------
func _on_boss_spawned(name: String) -> void:
	_boss_panel.visible = true
	_boss_name.text = name
	_boss_bar.value = 1.0
	_show_banner(name, Color(1.0, 0.7, 0.6))

func _on_boss_hp(current: float, max_v: float) -> void:
	_boss_bar.value = (current / max_v) if max_v > 0 else 0.0

func _show_banner(text: String, color: Color) -> void:
	_banner.text = text
	_banner.add_theme_color_override("font_color", color)
	_banner.modulate.a = 1.0
	_banner.scale = Vector2(0.8, 0.8)
	_banner.pivot_offset = _banner.size * 0.5
	var tw := create_tween()
	tw.tween_property(_banner, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_interval(1.0)
	tw.tween_property(_banner, "modulate:a", 0.0, 0.6)

# ---------------------------------------------------------------------------
# Pause
# ---------------------------------------------------------------------------
func _build_pause_menu(root: Control) -> void:
	_pause_menu = Control.new()
	_pause_menu.set_anchors_preset(Control.PRESET_FULL_RECT)
	_pause_menu.visible = false
	root.add_child(_pause_menu)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	_pause_menu.add_child(dim)
	var title := _mk_label("PAUSED", 56, Color.WHITE)
	title.position = Vector2(0, 180)
	title.size = Vector2(DW, 70)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_pause_menu.add_child(title)
	var resume := _mk_menu_button("RESUME", DH * 0.5)
	resume.pressed.connect(_toggle_pause)
	_pause_menu.add_child(resume)
	var hangar := _mk_menu_button("TO HANGAR", DH * 0.5 + 90)
	hangar.pressed.connect(_to_hangar)
	_pause_menu.add_child(hangar)

func _mk_menu_button(text: String, y: float) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", 32)
	b.custom_minimum_size = Vector2(360, 72)
	b.size = Vector2(360, 72)
	b.position = Vector2(DW * 0.5 - 180, y)
	return b

func _toggle_pause() -> void:
	var p := not get_tree().paused
	get_tree().paused = p
	_pause_menu.visible = p
	Audio.play("button", -6.0)

func _to_hangar() -> void:
	get_tree().paused = false
	Audio.play("button")
	get_tree().change_scene_to_file("res://scenes/ui/Hangar.tscn")
