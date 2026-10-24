class_name AudioSystem
extends Node
## Audio sintetizado en tiempo real (port de web/src/systems/AudioSystem.js, sin archivos): motor del vehículo que
## se maneja (tono por velocidad y acelerador), viento, pájaros de día, insectos de noche, lluvia, y clics de la
## interfaz. Dos generadores (mundo e interfaz) a 22 kHz; el del mundo pasa por paso bajo, compresor y una
## reverberación de valle (buses creados aquí). Volumen general y de ambiente en Opciones (Settings).

static var instance: AudioSystem

var vehicle: Vehicle       # el que se maneja (null a pie)
var sky: SkySystem
var active := false         # motor y ambiente solo durante la partida

var _world: AudioStreamGeneratorPlayback
var _ui: AudioStreamGeneratorPlayback
var _phase := 0.0
var _lp := 0.0               # paso bajo del motor
var _wind := 0.0             # ruido filtrado del viento
var _rain := 0.0
var _insect_t := 0.0
var _freq := 45.0
var _throttle := 0.0
var _chirp_t := 0.0          # pájaros: tiempo hasta el próximo canto, y el canto en curso
var _chirp: Array = []       # [t, dur, f0, f1]
var _ui_queue: Array = []    # [t, dur, f, amp]
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	instance = self
	_rng.randomize()
	_setup_buses()
	_world = _player("Mundo")
	_ui = _player("Master")
	Settings.changed.connect(_apply_volume)
	_apply_volume()


func _setup_buses() -> void:
	if AudioServer.get_bus_index("Mundo") >= 0:
		return
	var master := AudioServer.get_bus_index("Master")
	var lp := AudioEffectLowPassFilter.new()
	lp.cutoff_hz = AudioConfig.WARMTH
	AudioServer.add_bus_effect(master, lp)
	var comp := AudioEffectCompressor.new()
	comp.threshold = -12.0
	comp.ratio = 3.0
	AudioServer.add_bus_effect(master, comp)
	AudioServer.add_bus()
	var i := AudioServer.bus_count - 1
	AudioServer.set_bus_name(i, "Mundo")
	AudioServer.set_bus_send(i, "Master")
	var rv := AudioEffectReverb.new()
	rv.room_size = AudioConfig.REVERB.room
	rv.damping = AudioConfig.REVERB.damping
	rv.wet = AudioConfig.REVERB.wet
	rv.dry = 1.0
	AudioServer.add_bus_effect(i, rv)


func _player(bus: String) -> AudioStreamGeneratorPlayback:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = AudioConfig.MIX_RATE
	gen.buffer_length = 0.15
	var p := AudioStreamPlayer.new()
	p.stream = gen
	p.bus = bus
	add_child(p)
	p.play()
	return p.get_stream_playback()


func _apply_volume() -> void:
	var m := AudioServer.get_bus_index("Master")
	AudioServer.set_bus_volume_db(m, linear_to_db(maxf(Settings.volume, 0.0001)))
	AudioServer.set_bus_mute(m, Settings.volume <= 0.001)


## Clic de interfaz (enfocar / aceptar).
func ui_click(accept := false) -> void:
	_ui_queue.push_back([0.0, 0.05 if accept else 0.025, 880.0 if accept else 1320.0, AudioConfig.UI.accept if accept else AudioConfig.UI.focus])


func _process(delta: float) -> void:
	# objetivo del motor: tono por velocidad relativa; el acelerador lo sube un poco y abre el filtro
	if vehicle and is_instance_valid(vehicle):
		var hz: Array = vehicle.spec.engine_hz
		var p := clampf(vehicle.speed_kmh() / maxf(float(vehicle.spec.max_speed), 1.0), 0.0, 1.0)
		var thr := absf(vehicle.engine_force) / maxf(float(vehicle.spec.engine), 1.0)
		_freq = lerpf(_freq, lerpf(hz[0], hz[1], p) * (1.0 + 0.25 * thr), minf(1.0, delta * 4.0))
		_throttle = lerpf(_throttle, thr, minf(1.0, delta * 6.0))
	if _world:
		_fill_world()
	if _ui:
		_fill_ui()


func _fill_world() -> void:
	var n := _world.get_frames_available()
	if n <= 0:
		return
	var dt := 1.0 / AudioConfig.MIX_RATE
	var driving := active and vehicle != null and is_instance_valid(vehicle)
	var eng_amp: float = (AudioConfig.ENGINE.level + AudioConfig.ENGINE.throttle * _throttle) if driving else 0.0
	var cutoff: float = lerpf(AudioConfig.ENGINE.filter[0], AudioConfig.ENGINE.filter[1], _throttle)
	var a_lp := 1.0 - exp(-TAU * cutoff * dt)
	var a_wind := 1.0 - exp(-TAU * 400.0 * dt)
	var a_rain := 1.0 - exp(-TAU * 2500.0 * dt)
	var night: float = sky.night if sky else 0.0
	var wet: float = sky.wet if sky else 0.0
	var amb: float = Settings.ambience if active else 0.0
	var wind_amp: float = AudioConfig.AMBIENCE.wind * amb
	var rain_amp: float = AudioConfig.AMBIENCE.rain * wet * amb
	var insect_amp: float = AudioConfig.AMBIENCE.insects * night * amb
	var bird_amp: float = AudioConfig.AMBIENCE.birds * amb * (1.0 - night)
	var buf := PackedVector2Array()
	buf.resize(n)
	for i in n:
		# motor: seno + triángulo del tono de encendido, con paso bajo según el acelerador
		_phase = fmod(_phase + _freq * dt, 1.0)
		var tri := 4.0 * absf(_phase - 0.5) - 1.0
		_lp += (sin(TAU * _phase) * 0.7 + tri * 0.5 - _lp) * a_lp
		var s := _lp * eng_amp
		# viento y lluvia: ruido blanco filtrado
		var noise := _rng.randf() * 2.0 - 1.0
		_wind += (noise - _wind) * a_wind
		_rain += (noise - _rain) * a_rain
		s += _wind * wind_amp * 3.0 + _rain * rain_amp
		# insectos: chirrido agudo modulado
		_insect_t += dt
		if insect_amp > 0.0001:
			s += sin(TAU * 4200.0 * _insect_t) * insect_amp * maxf(0.0, sin(TAU * 18.0 * _insect_t)) * 0.5
		# pájaros: barridos cortos de tono
		if not _chirp.is_empty():
			var k: float = _chirp[0] / _chirp[1]
			if k >= 1.0:
				_chirp = []
			else:
				_chirp[0] += dt
				s += sin(TAU * lerpf(_chirp[2], _chirp[3], k) * _chirp[0]) * sin(PI * k) * bird_amp
		s *= AudioConfig.WORLD_GAIN
		buf[i] = Vector2(s, s)
	_world.push_buffer(buf)
	_insect_t = fmod(_insect_t, 1000.0)
	_chirp_t -= n * dt
	if _chirp_t <= 0.0 and _chirp.is_empty() and active:
		_chirp_t = _rng.randf_range(1.5, 6.0)
		var f0 := _rng.randf_range(2200.0, 3600.0)
		_chirp = [0.0, _rng.randf_range(0.08, 0.22), f0, f0 * _rng.randf_range(0.7, 1.4)]


func _fill_ui() -> void:
	var n := _ui.get_frames_available()
	if n <= 0:
		return
	var dt := 1.0 / AudioConfig.MIX_RATE
	var buf := PackedVector2Array()
	buf.resize(n)
	if _ui_queue.is_empty():
		_ui.push_buffer(buf)
		return
	for i in n:
		var s := 0.0
		for q: Array in _ui_queue:
			if q[0] < q[1]:
				var env: float = 1.0 - q[0] / q[1]
				s += sin(TAU * q[2] * q[0]) * env * env * q[3]
				q[0] += dt
		buf[i] = Vector2(s, s)
	_ui_queue = _ui_queue.filter(func(q): return q[0] < q[1])
	_ui.push_buffer(buf)
