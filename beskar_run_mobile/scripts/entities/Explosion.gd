extends Node2D
class_name Explosion
## One-shot animated burst from the 5-frame explosion sheet.

func _ready() -> void:
	var spr := AnimatedSprite2D.new()
	var frames := SpriteFrames.new()
	frames.add_animation("boom")
	frames.set_animation_loop("boom", false)
	frames.set_animation_speed("boom", 18.0)
	var sheet: Texture2D = load("res://assets/sprites/explosion.png")
	var fw := sheet.get_width() / 5
	var fh := sheet.get_height()
	for i in 5:
		var atlas := AtlasTexture.new()
		atlas.atlas = sheet
		atlas.region = Rect2(i * fw, 0, fw, fh)
		frames.add_frame("boom", atlas)
	spr.sprite_frames = frames
	add_child(spr)
	spr.play("boom")
	spr.animation_finished.connect(queue_free)

static func spawn(parent: Node, pos: Vector2, scale_f: float = 1.0) -> void:
	var e := Explosion.new()
	e.global_position = pos
	e.scale = Vector2(scale_f, scale_f)
	parent.add_child(e)
