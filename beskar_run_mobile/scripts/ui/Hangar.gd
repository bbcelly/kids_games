extends Control
## The hangar between runs. Spend banked beskar across Upgrades, Grogu's Gifts
## and Weapons, see your level and equipped weapon, then LAUNCH. Everything is
## persisted by GameData on each purchase.

var DW := 1280.0          # real canvas width (set from the viewport in _ready)
const DH := 720.0

var _category := "upgrades"
var _vault_label: Label
var _list: VBoxContainer
var _tab_buttons := {}

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	DW = get_viewport_rect().size.x
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.07, 0.13)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var bgtex := TextureRect.new()
	bgtex.texture = load("res://assets/backgrounds/l2_far.png")
	bgtex.set_anchors_preset(Control.PRESET_FULL_RECT)
	bgtex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bgtex.modulate = Color(1, 1, 1, 0.4)
	add_child(bgtex)

	var title := _label("HANGAR", 44, Color(0.7, 0.95, 1.0))
	title.position = Vector2(30, 18)
	title.size = Vector2(360, 56)
	add_child(title)

	_vault_label = _label("", 30, Color(1.0, 0.85, 0.4))
	_vault_label.position = Vector2(DW - 430, 26)
	_vault_label.size = Vector2(400, 40)
	_vault_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_vault_label)

	# Tabs
	var tabs := HBoxContainer.new()
	tabs.position = Vector2(30, 86)
	tabs.add_theme_constant_override("separation", 12)
	add_child(tabs)
	for cat in [["upgrades", "UPGRADES"], ["gifts", "GROGU'S GIFTS"], ["weapons", "WEAPONS"]]:
		var b := Button.new()
		b.text = cat[1]
		b.add_theme_font_size_override("font_size", 26)
		b.custom_minimum_size = Vector2(280, 60)
		b.pressed.connect(_select_category.bind(cat[0]))
		tabs.add_child(b)
		_tab_buttons[cat[0]] = b

	# Scrolling list
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(30, 160)
	scroll.size = Vector2(DW - 60, DH - 260)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	_list = VBoxContainer.new()
	_list.custom_minimum_size = Vector2(DW - 90, 0)
	_list.add_theme_constant_override("separation", 12)
	scroll.add_child(_list)

	# Bottom bar: back + launch
	var back := _big_button("← TITLE", 30, Vector2(30, DH - 88), Vector2(220, 70), Color(0.3, 0.32, 0.4))
	back.pressed.connect(func ():
		Audio.play("button")
		get_tree().change_scene_to_file("res://scenes/ui/Title.tscn"))
	add_child(back)

	var launch := _big_button("LAUNCH ▶", 40, Vector2(DW - 430, DH - 96), Vector2(400, 84), Color(0.2, 0.6, 0.4))
	launch.pressed.connect(func ():
		Audio.play("win", -6.0)
		get_tree().change_scene_to_file("res://scenes/Game.tscn"))
	add_child(launch)

	_select_category("upgrades")
	_refresh_vault()

func _refresh_vault() -> void:
	_vault_label.text = "VAULT: %d beskar" % GameData.vault

func _select_category(cat: String) -> void:
	_category = cat
	Audio.play("button", -8.0)
	for k in _tab_buttons:
		_tab_buttons[k].modulate = Color.WHITE if k != cat else Color(0.7, 1.0, 0.8)
	_rebuild()

func _rebuild() -> void:
	for c in _list.get_children():
		c.queue_free()
	match _category:
		"upgrades":
			for id in Defs.UPGRADES:
				_list.add_child(_upgrade_card(id))
		"gifts":
			for id in Defs.GIFT_ORDER:
				_list.add_child(_gift_card(id))
		"weapons":
			for id in Defs.WEAPON_ORDER:
				_list.add_child(_weapon_card(id))
	_refresh_vault()

# ---------------------------------------------------------------------------
# Cards
# ---------------------------------------------------------------------------
func _card_base(title: String, desc: String, status: String, status_col: Color) -> Control:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(0, 104)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.10, 0.13, 0.22, 0.9)
	sb.set_corner_radius_all(12)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	panel.add_theme_stylebox_override("panel", sb)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	panel.add_child(row)
	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(info)
	var nm := _label(title, 30, Color(0.9, 0.97, 1.0))
	info.add_child(nm)
	var ds := _label(desc, 20, Color(0.75, 0.8, 0.9))
	info.add_child(ds)
	var st := _label(status, 20, status_col)
	info.add_child(st)
	# right side filled by caller via row
	panel.set_meta("row", row)
	return panel

func _buy_button(text: String, affordable: bool, enabled: bool) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", 26)
	b.custom_minimum_size = Vector2(220, 76)
	b.disabled = not enabled
	var col := Color(0.2, 0.55, 0.35) if (affordable and enabled) else Color(0.3, 0.3, 0.36)
	var sb := StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(10)
	b.add_theme_stylebox_override("normal", sb)
	b.add_theme_stylebox_override("hover", sb)
	b.add_theme_stylebox_override("disabled", sb)
	return b

func _upgrade_card(id: String) -> Control:
	var d: Dictionary = Defs.UPGRADES[id]
	var lvl := GameData.upgrade_level(id)
	var maxed := GameData.upgrade_maxed(id)
	var status := "Level %d / %d" % [lvl, int(d["max"])]
	var card := _card_base(String(d["name"]), String(d["desc"]), status, Color(0.7, 0.9, 1.0))
	var row: HBoxContainer = card.get_meta("row")
	if maxed:
		row.add_child(_maxed_tag())
	else:
		var cost := GameData.upgrade_cost(id)
		var btn := _buy_button("BUY\n%d" % cost, GameData.can_afford(cost), GameData.can_afford(cost))
		btn.pressed.connect(func ():
			if GameData.buy_upgrade(id):
				Audio.play("pickup")
				_rebuild())
		row.add_child(btn)
	return card

func _gift_card(id: String) -> Control:
	var d: Dictionary = Defs.GIFTS[id]
	var lvl := GameData.gift_level(id)
	var maxed := GameData.gift_maxed(id)
	var status := "Level %d / %d" % [lvl, int(d["max"])]
	var card := _card_base(String(d["name"]), String(d["desc"]), status, Color(0.7, 1.0, 0.8))
	var row: HBoxContainer = card.get_meta("row")
	if maxed:
		row.add_child(_maxed_tag())
	else:
		var cost := GameData.gift_cost(id)
		var btn := _buy_button("BUY\n%d" % cost, GameData.can_afford(cost), GameData.can_afford(cost))
		btn.pressed.connect(func ():
			if GameData.buy_gift(id):
				Audio.play("pickup")
				_rebuild())
		row.add_child(btn)
	return card

func _weapon_card(id: String) -> Control:
	var d: Dictionary = Defs.WEAPONS[id]
	var owned := GameData.owns_weapon(id)
	var equipped := GameData.equipped_weapon == id
	var prem := bool(d.get("premium", false))
	var title := String(d["name"]) + ("  ★" if prem else "")
	var status := ""
	var scol := Color(0.7, 0.9, 1.0)
	if equipped:
		status = "EQUIPPED"
		scol = Color(0.7, 1.0, 0.8)
	elif owned:
		status = "Owned"
	else:
		status = "Locked"
		scol = Color(1.0, 0.7, 0.6)
	var card := _card_base(title, String(d["desc"]), status, scol)
	var row: HBoxContainer = card.get_meta("row")
	if equipped:
		row.add_child(_tag("EQUIPPED", Color(0.2, 0.5, 0.35)))
	elif owned:
		var eq := _buy_button("EQUIP", true, true)
		eq.pressed.connect(func ():
			GameData.equip_weapon(id)
			Audio.play("button")
			_rebuild())
		row.add_child(eq)
	else:
		var cost := int(d["cost"])
		var btn := _buy_button("BUY\n%d" % cost, GameData.can_afford(cost), GameData.can_afford(cost))
		btn.pressed.connect(func ():
			if GameData.buy_weapon(id):
				Audio.play("pickup")
				_rebuild())
		row.add_child(btn)
	return card

func _maxed_tag() -> Control:
	return _tag("MAX", Color(0.4, 0.4, 0.5))

func _tag(text: String, col: Color) -> Control:
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(220, 76)
	var sb := StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(10)
	p.add_theme_stylebox_override("panel", sb)
	var l := _label(text, 26, Color.WHITE)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	p.add_child(l)
	return p

# ---------------------------------------------------------------------------
func _label(text: String, fs: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", color)
	return l

func _big_button(text: String, fs: int, pos: Vector2, sz: Vector2, col: Color) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", fs)
	b.custom_minimum_size = sz
	b.size = sz
	b.position = pos
	var sb := StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(12)
	b.add_theme_stylebox_override("normal", sb)
	var sbh := sb.duplicate()
	sbh.bg_color = col.lightened(0.15)
	b.add_theme_stylebox_override("hover", sbh)
	b.add_theme_stylebox_override("pressed", sbh)
	return b
