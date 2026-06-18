extends Node
## Tiny SFX manager. Loads the procedural WAVs and plays them through a small
## pool of players so overlapping shots don't cut each other off.

const SFX_DIR := "res://assets/sfx/"
const POOL := 8

var _streams := {}
var _players: Array[AudioStreamPlayer] = []
var _next := 0
var muted := false

func _ready() -> void:
	for sfx_name in ["shoot", "enemy_shoot", "hit", "explode", "pickup", "force", "button", "win", "lose", "boss"]:
		var path: String = SFX_DIR + sfx_name + ".wav"
		if ResourceLoader.exists(path):
			var s = load(path)
			# loop must be off for one-shots
			if s is AudioStreamWAV:
				s.loop_mode = AudioStreamWAV.LOOP_DISABLED
			_streams[sfx_name] = s
	for i in POOL:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_players.append(p)

func play(name: String, volume_db: float = 0.0, pitch: float = 1.0) -> void:
	if muted or not _streams.has(name):
		return
	var p := _players[_next]
	_next = (_next + 1) % POOL
	p.stream = _streams[name]
	p.volume_db = volume_db
	p.pitch_scale = pitch
	p.play()

func set_muted(v: bool) -> void:
	muted = v
