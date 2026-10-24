class_name AudioSystem
extends Node
## Audio sintetizado en tiempo real (port de web/src/systems/AudioSystem.js, sin archivos): motor del vehículo que
## se maneja (tono por velocidad y acelerador), viento, pájaros de día, insectos de noche, lluvia, pasos, música de
## campanitas (web/src/audio/Musica.js) y clics de la interfaz. Dos generadores (mundo e interfaz) a 22 kHz; el del mundo pasa por paso bajo, compresor y una
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
# pasos: [t, dur, a (coef. del paso bajo), amp]; un filtro compartido basta (no se pisan)
var _steps: Array = []
var _step_lp := 0.0
# golpes y tajos: [t, dur, a (paso bajo del ruido), amp, f (tono, 0 = sin tono), barrido]; filtro compartido
var _hits: Array = []
var _hit_lp := 0.0
# música: cada nota se sintetiza una vez a un AudioStreamWAV (caché por nota y lado) y suena en una voz libre
# del bus «Música», que lleva el eco y la reverberación. Sumarlas muestra a muestra en GDScript costaba demasiado.
var _music_step := 0
var _music_next := 1.5
var _music_clock := 0.0
var _mood := "dia"
var _bell_cache: Dictionary = {}  # Vector2i(midi, lado) → AudioStreamWAV
var _voices: Array[AudioStreamPlayer] = []
var _voice_i := 0
var _delay: AudioEffectDelay

## Patrón del arpegio (índice de la nota del acorde, −1 = silencio) y ánimos, como Musica.js.
const PATTERN := [0, 2, 1, 3, -1, 2, 1, -1, 0, 3, 2, -1, 1, -1, 2, -1]
const MOODS := {
	"dia": {"tonic": 74, "tempo": 1.0, "skip": 0.12, "chords": [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 2, 7, 11], [-3, 2, 4, 7]]},
	"noche": {"tonic": 69, "tempo": 0.8, "skip": 0.2, "chords": [[0, 3, 7, 10], [-4, 3, 5, 8], [-2, 2, 5, 9], [-5, 2, 7, 10]]},
}
## Timbre de lámina: [múltiplo, nivel, duración (s)] de cada parcial.
const BELL := [[1.0, 1.0, 2.4], [2.76, 0.12, 0.9], [5.4, 0.04, 0.4]]


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	instance = self
	_rng.randomize()
	_setup_buses()
	_world = _player("Mundo")
	_ui = _player("Master")
	for i in 8:
		var v := AudioStreamPlayer.new()
		v.bus = "Musica"
		add_child(v)
		_voices.push_back(v)
	WorkerThreadPool.add_task(_build_bells)
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
	# Música: eco suave (3 corcheas, realimentación 0,3, opaco) y mucha reverberación: campanitas lejos, en el aire
	AudioServer.add_bus()
	var mi := AudioServer.bus_count - 1
	AudioServer.set_bus_name(mi, "Musica")
	AudioServer.set_bus_send(mi, "Master")
	_delay = AudioEffectDelay.new()
	_delay.tap1_active = true
	_delay.tap1_level_db = linear_to_db(0.5)
	_delay.tap2_active = false
	_delay.feedback_active = true
	_delay.feedback_level_db = linear_to_db(0.3)
	_delay.feedback_lowpass = 2600.0
	AudioServer.add_bus_effect(mi, _delay)
	var mrv := AudioEffectReverb.new()
	mrv.room_size = 0.85
	mrv.damping = 0.5
	mrv.wet = 0.45
	AudioServer.add_bus_effect(mi, mrv)


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


## Una pisada: golpe corto de ruido; en tierra más grave y blando que en pavimento, y más fuerte corriendo.
func footstep(paved: bool, running: bool) -> void:
	if not active:
		return
	var hz: float = AudioConfig.STEPS.paved_hz if paved else AudioConfig.STEPS.dirt_hz
	var a := 1.0 - exp(-TAU * hz * _rng.randf_range(0.85, 1.15) / AudioConfig.MIX_RATE)
	_steps.push_back([0.0, 0.07 if paved else 0.11, a, AudioConfig.STEPS.level * (1.4 if running else 1.0) * _rng.randf_range(0.8, 1.1)])


## Un golpe que entró (AmbienceSystem, desde CombatSystem): metal suena a lámina, hueso a chasquido seco,
## carne a golpe sordo. Lo mismo que las partículas: según contra qué entró.
func impact(kind: String, strength: float) -> void:
	if not active:
		return
	var h: Dictionary = AudioConfig.HITS.get(kind, AudioConfig.HITS.carne)
	var a := 1.0 - exp(-TAU * float(h.hz) / AudioConfig.MIX_RATE)
	_hits.push_back([0.0, float(h.dur), a, float(h.level) * clampf(strength, 0.4, 1.4), float(h.tone), 0.0])


## El tajo del arma al aire: ruido que se abre y se cierra, más grave con armas pesadas.
func swing(weight: float) -> void:
	if not active:
		return
	var s: Dictionary = AudioConfig.SWING
	_hits.push_back([0.0, float(s.dur), 1.0 - exp(-TAU * float(s.hz) / AudioConfig.MIX_RATE), float(s.level) * clampf(weight, 0.5, 1.5), 0.0, 1.0])


## Toca las campanitas que caen dentro de este cuadro (Musica.update de la web). El ánimo cambia al empezar la vuelta.
func _music(delta: float) -> void:
	_music_clock += delta
	var night: float = sky.night if sky else 0.0
	while _music_next <= _music_clock:
		if _music_step % (PATTERN.size() * 4) == 0:
			_mood = "noche" if night > 0.6 else "dia"
		var m: Dictionary = MOODS[_mood]
		var eighth: float = (60.0 / AudioConfig.MUSIC.tempo) / 2.0 / float(m.tempo)
		_delay.tap1_delay_ms = eighth * 3.0 * 1000.0
		var chord: Array = m.chords[(_music_step / PATTERN.size()) % m.chords.size()]
		var i: int = PATTERN[_music_step % PATTERN.size()]
		if i >= 0 and _rng.randf() > float(m.skip) and not _bell_cache.is_empty():
			var note := int(m.tonic) + int(chord[i]) + (12 if _rng.randf() < 0.1 else 0)
			var v := _voices[_voice_i]
			_voice_i = (_voice_i + 1) % _voices.size()
			v.stream = _bell_cache[Vector2i(note, _music_step % 2)]
			v.volume_db = linear_to_db((0.06 + _rng.randf() * 0.025) * AudioConfig.MUSIC.volume * Settings.music * AudioConfig.WORLD_GAIN)
			v.play()
		_music_step += 1
		_music_next += eighth


## En un hilo, al arrancar: todas las notas que pueden sonar (los dos ánimos, con la octava de más), a los dos lados.
func _build_bells() -> void:
	var out := {}
	for m: Dictionary in MOODS.values():
		for chord: Array in m.chords:
			for st: int in chord:
				for oct in [0, 12]:
					for side in 2:
						var key := Vector2i(int(m.tonic) + st + oct, side)
						if not out.has(key):
							out[key] = _bell(key.x, side)
	set_deferred("_bell_cache", out)


## Campanita: seno con parciales 2,76× y 5,4× muy tenues (timbre de lámina), ataque inmediato y caída
## exponencial a −70 dB; los parciales se apagan antes. `side` 0/1 = un poco a la izquierda o a la derecha.
func _bell(note: int, side: int) -> AudioStreamWAV:
	var rate := int(AudioConfig.MIX_RATE)
	var f := 440.0 * pow(2.0, (note - 69) / 12.0)
	var n := int(2.45 * rate)
	var pan := 0.35 if side == 1 else -0.35
	var data := PackedByteArray()
	data.resize(n * 4)
	for k in n:
		var t := float(k) / rate
		var v := 0.0
		for pr: Array in BELL:
			v += sin(TAU * f * pr[0] * t) * pr[1] * exp(-8.1 * t / pr[2])
		v *= minf(t / 0.006, 1.0) * 0.9
		data.encode_s16(k * 4, int(clampf(v * (1.0 - pan), -1.0, 1.0) * 32767.0))
		data.encode_s16(k * 4 + 2, int(clampf(v * (1.0 + pan), -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.stereo = true
	w.mix_rate = rate
	w.data = data
	return w


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
	if active and Settings.music > 0.001:
		_music(delta)
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
		# golpes y tajos: ruido filtrado (y tono en el metal); el tajo sube y baja en vez de caer
		if not _hits.is_empty():
			var hs: Array = _hits[0]
			var hk: float = hs[0] / hs[1]
			_hit_lp += (noise - _hit_lp) * hs[2]
			var env := sin(PI * hk) if hs[5] > 0.0 else (1.0 - hk) * (1.0 - hk) * (1.0 - hk)
			var v: float = _hit_lp * 3.0
			if hs[4] > 0.0:
				v = v * 0.4 + sin(TAU * hs[4] * hs[0]) * 0.6 + sin(TAU * hs[4] * 1.37 * hs[0]) * 0.3
			s += v * env * hs[3]
			hs[0] += dt
			if hk >= 1.0:
				_hits.pop_front()
		# pasos: ruido con caída rápida por un paso bajo
		if not _steps.is_empty():
			var st: Array = _steps[0]
			var k: float = st[0] / st[1]
			_step_lp += (noise - _step_lp) * st[2]
			s += _step_lp * st[3] * (1.0 - k) * (1.0 - k) * 4.0
			st[0] += dt
			if k >= 1.0:
				_steps.pop_front()
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
