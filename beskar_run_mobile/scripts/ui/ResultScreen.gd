extends CanvasLayer
## "Level Complete" / "Ship Down" overlay shown at the end of a run. Banks are
## already recorded by Game; this just celebrates and routes back to the hangar.

const DW := 1280.0
const DH := 720.0

func show_result(victory: bool, level_idx: int, loop: int, score: int, beskar: int) -> void:
	layer = 20
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.0)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	create_tween().tween_property(dim, "color", Color(0, 0, 0, 0.7), 0.4)

	var title := _label(("LEVEL COMPLETE!" if victory else "SHIP DOWN"), 72,
		Color(0.7, 1.0, 0.8) if victory else Color(1.0, 0.5, 0.5))
	title.position = Vector2(0, 140)
	title.size = Vector2(DW, 90)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(title)

	var sub_text := ""
	if victory:
		var next := level_idx + 1
		if next >= Defs.LEVELS.size():
			sub_text = "Campaign cleared — Loop %d unlocked. Harder skies ahead!" % (loop + 2)
		else:
			sub_text = "Next: %s" % Defs.LEVELS[next]["name"]
	else:
		sub_text = "Your beskar is safe in the vault."
	var sub := _label(sub_text, 26, Color(0.85, 0.9, 1.0))
	sub.position = Vector2(0, 240)
	sub.size = Vector2(DW, 36)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(sub)

	var stats := _label("SCORE  %d        BESKAR EARNED  %d" % [score, beskar], 34, Color(1.0, 0.9, 0.5))
	stats.position = Vector2(0, 320)
	stats.size = Vector2(DW, 44)
	stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(stats)

	var vault := _label("VAULT TOTAL  %d" % GameData.vault, 24, Color(0.8, 0.85, 0.95))
	vault.position = Vector2(0, 372)
	vault.size = Vector2(DW, 32)
	vault.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(vault)

	var go := Button.new()
	go.text = "TO HANGAR"
	go.add_theme_font_size_override("font_size", 34)
	go.custom_minimum_size = Vector2(380, 80)
	go.size = Vector2(380, 80)
	go.position = Vector2(DW * 0.5 - 190, 470)
	go.pressed.connect(func ():
		Audio.play("button")
		get_tree().change_scene_to_file("res://scenes/ui/Hangar.tscn"))
	add_child(go)

func _label(text: String, fs: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	l.add_theme_constant_override("outline_size", 6)
	return l
