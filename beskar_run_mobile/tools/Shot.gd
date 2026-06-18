extends Node
## Dev-only: loads a target scene, waits, saves a screenshot, quits.
## Usage: godot res://tools/Shot.tscn -- <res://scene.tscn> <delay_sec> <out.png>

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var scene_path: String = args[0] if args.size() > 0 else "res://scenes/ui/Title.tscn"
	var delay: float = float(args[1]) if args.size() > 1 else 1.0
	var out: String = args[2] if args.size() > 2 else "/tmp/shot.png"
	var packed: PackedScene = load(scene_path)
	var inst := packed.instantiate()
	add_child(inst)
	await get_tree().create_timer(delay).timeout
	var img := get_viewport().get_texture().get_image()
	img.save_png(out)
	print("SHOT_SAVED ", out)
	get_tree().quit()
