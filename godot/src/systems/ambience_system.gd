class_name AmbienceSystem
extends Node3D
## Ambiente: lo que hace que el mundo parezca vivo sin que pase nada (port de web/src/systems/AmbienceSystem.js).
## Polvo bajo los pies fuera del pavimento, luciérnagas de noche y hojas de día bajo los árboles, jirones de
## bruma por la mañana y motas de polvo que brillan al sol. No hay listas de sitios: se mira dónde está el jugador.
##
## Adaptación a Godot: en vez de emitir de a pocas desde la CPU, cada familia es un GPUParticles3D que sigue al
## jugador y emite sola; aquí solo se decide CUÁNTO (amount_ratio) según la hora, el clima y los árboles cerca.
## Los pasos (sonido y polvo) se cuentan aquí y el golpe lo toca AudioSystem.footstep.

var sky: SkySystem
var world: WorldStreamer
var player: Player
var vehicle_focus: Node3D        # el vehículo que se maneja (null a pie)

var _emitters: Dictionary = {}   # familia → GPUParticles3D
var _step_acc := 0.0
var _slow_t := 0.0
var _trees := 0
var _bursts: Dictionary = {}     # tipo de golpe → [GPUParticles3D…] (una sola descarga cada uno)
var _burst_i: Dictionary = {}
var _tension := 0.0


func _ready() -> void:
	if not ParticlesConfig.ENABLED:
		return
	var q: float = ParticlesConfig.QUALITY_SCALE.get(Settings.quality, 1.0)
	for fam: String in ParticlesConfig.FAMILIES:
		_emitters[fam] = _make(fam, ParticlesConfig.FAMILIES[fam], q)
	for kind: String in ParticlesConfig.BURSTS:
		var pool := []
		for i in ParticlesConfig.BURST_POOL:
			pool.push_back(_make_burst(kind, ParticlesConfig.BURSTS[kind]))
		_bursts[kind] = pool
		_burst_i[kind] = 0
	EventBus.combat_impact.connect(_on_impact)


## Descarga de un golpe: one_shot y explosiva; sale hacia arriba y a los lados, y cae.
func _make_burst(kind: String, f: Dictionary) -> GPUParticles3D:
	var p := _make(kind, f.merged({"speed": f.speed, "spread": f.spread}), 1.0)
	p.amount = int(f.n)
	p.amount_ratio = 1.0
	p.one_shot = true
	p.explosiveness = 1.0
	p.emitting = false
	var pm := p.process_material as ParticleProcessMaterial
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = 0.08
	pm.initial_velocity_min = float(f.speed) * 0.4
	return p


## Un golpe entró (CombatSystem): partículas según contra qué, y el sonido.
func _on_impact(at: Vector3, kind: String, strength: float) -> void:
	if _bursts.has(kind):
		var pool: Array = _bursts[kind]
		var p: GPUParticles3D = pool[_burst_i[kind]]
		_burst_i[kind] = (_burst_i[kind] + 1) % pool.size()
		p.global_position = at
		p.amount_ratio = clampf(strength, 0.3, 1.0)
		p.restart()
		# un golpe fuerte contra hueso también saca chispas: el machete raspa
		if kind == "hueso" and strength > 0.9:
			_on_impact(at, "metal", 0.4)
			return
	if AudioSystem.instance:
		AudioSystem.instance.impact(kind, strength)


func _make(fam: String, f: Dictionary, q: float) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.name = fam
	var life: float = f.life
	p.lifetime = life
	p.amount = maxi(4, mini(int(f.max * q), ceili(float(ParticlesConfig.RATE.get(fam, f.get("n", 10))) * life)))
	p.amount_ratio = 0.0
	p.local_coords = false
	p.visibility_aabb = AABB(Vector3(-60, -20, -60), Vector3(120, 40, 120))
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var pm := ParticleProcessMaterial.new()
	match fam:
		"polvo":
			pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
			pm.emission_sphere_radius = 0.15
		_:
			# anillo alrededor del jugador (radios de la web) y de alto lo que cubre cada familia
			var r: Array = {"bruma": [6.0, 45.0], "motas": [3.0, 16.0]}.get(fam, [3.0, 19.0])
			if AtmosphereConfig.PARTICLES.has(fam):
				r = AtmosphereConfig.PARTICLES[fam].radius
			pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING
			pm.emission_ring_axis = Vector3.UP
			pm.emission_ring_radius = r[1]
			pm.emission_ring_inner_radius = r[0]
			pm.emission_ring_height = {"bruma": 2.5, "motas": 3.5, "luciernagas": 1.8, "hojas": 3.0}.get(fam, 0.5)
	pm.direction = Vector3.UP
	pm.spread = 180.0 * clampf(float(f.spread), 0.0, 1.0)
	pm.initial_velocity_min = float(f.speed) * 0.5
	pm.initial_velocity_max = float(f.speed)
	pm.gravity = Vector3(0.0, float(f.gravity), 0.0)
	if fam == "hojas":
		pm.gravity.x = 0.4 # el viento las arrastra (ESTIMADO)
	pm.damping_min = float(f.drag)
	pm.damping_max = float(f.drag)
	if f.has("spin"):
		pm.angle_min = -180.0
		pm.angle_max = 180.0
		pm.angular_velocity_min = -rad_to_deg(float(f.spin))
		pm.angular_velocity_max = rad_to_deg(float(f.spin))
	# tamaño: de size[0] a size[1] a lo largo de la vida
	var s0: float = f.size[0]
	var s1: float = f.size[1]
	var big := maxf(s0, s1)
	pm.scale_min = big
	pm.scale_max = big
	var curve := Curve.new()
	curve.add_point(Vector2(0, s0 / big))
	curve.add_point(Vector2(1, s1 / big))
	var ct := CurveTexture.new()
	ct.curve = curve
	pm.scale_curve = ct
	pm.color_ramp = _ramp(f)
	p.process_material = pm
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE
	var mat := "particle_glow" if f.get("glow", false) else "particle"
	if fam == "hojas":
		mat = "particle_leaf"
	elif fam == "bruma":
		mat = "particle_mist"
	quad.material = MaterialLibrary.get_material(mat)
	p.draw_pass_1 = quad
	p.emitting = true
	add_child(p)
	return p


## Color y opacidad en la vida: de inicio a fin; `fade` sube suave al nacer; `blink` enciende y apaga.
func _ramp(f: Dictionary) -> GradientTexture1D:
	var g := Gradient.new()
	var c0: Color = f.color[0]
	var c1: Color = f.color[1]
	var a0: float = f.alpha[0]
	var a1: float = f.alpha[1]
	var offs := PackedFloat32Array()
	var cols := PackedColorArray()
	if f.get("blink", false):
		# parpadeo: cuatro destellos con apagón entre medio, y nada al principio ni al final
		for i in 9:
			var t := i / 8.0
			offs.push_back(t)
			cols.push_back(Color(c0.lerp(c1, t), a0 if i % 2 == 1 else 0.0))
	elif f.get("fade", false):
		offs = PackedFloat32Array([0.0, 0.2, 1.0])
		cols = PackedColorArray([Color(c0, 0.0), Color(c0.lerp(c1, 0.2), a0), Color(c1, a1)])
	else:
		offs = PackedFloat32Array([0.0, 1.0])
		cols = PackedColorArray([Color(c0, a0), Color(c1, a1)])
	g.offsets = offs
	g.colors = cols
	var t := GradientTexture1D.new()
	t.gradient = g
	return t


func _process(delta: float) -> void:
	if _emitters.is_empty() or player == null:
		return
	var walking := vehicle_focus == null and player.visible
	var focus: Node3D = player if walking else vehicle_focus
	if focus == null or not is_instance_valid(focus):
		return
	var at := focus.global_position
	var ground := WorldData.height(at.x, at.z)
	var hour: float = sky.hour if sky else 12.0
	var wet: float = sky.wet if sky else 0.0
	var night: float = sky.night if sky else 0.0

	# ── Pasos: polvo fuera del pavimento y un golpe por pisada
	var v := Vector2(player.velocity.x, player.velocity.z).length()
	var stepping := walking and v > 1.2 and player.is_on_floor() and not player.swimming and not player.is_mounting()
	var paved := false
	if stepping:
		var road := WorldData.roads.nearest(Vector2(at.x, at.z), 10.0) if WorldData.roads else {}
		if not road.is_empty():
			var rc: Dictionary = WorldConfig.ROAD_CLASSES.get(WorldData.roads.roads[road.road].c, {})
			# la calzada y su andén (2 m) están pavimentados; trochas y senderos son de tierra
			paved = rc.get("surface", "") != "dirt" and float(road.d) < float(rc.get("width", 6.0)) * 0.5 + 2.0
		_step_acc += delta * v
		var stride := 2.4 if v > 5.0 else 1.6  # metros por pisada (corriendo, más largas)
		if _step_acc > stride:
			_step_acc = 0.0
			if AudioSystem.instance:
				AudioSystem.instance.footstep(paved, v > 5.0)
	var dust: GPUParticles3D = _emitters.polvo
	dust.global_position = at + Vector3(0, 0.06, 0)
	dust.amount_ratio = (1.0 if v > 5.0 else 0.5) if stepping and not paved and wet < 0.5 else 0.0

	# ── Atmósfera de la hora: bruma con la neblina de la mañana, motas con sol y aire seco
	var key := AtmosphereConfig.sample(hour)
	var mist := clampf((float(key.density) - 2.0) / 40.0, 0.0, 1.0) # la densidad de la niebla manda (45 = mañana cerrada)
	for fam: String in ["bruma", "motas"]:
		var e: GPUParticles3D = _emitters[fam]
		var w: Dictionary = AtmosphereConfig.PARTICLES[fam]
		var strength := 0.0
		if hour >= float(w.from) and hour <= float(w.to):
			strength = mist if fam == "bruma" else (1.0 - night) * (1.0 - wet) * (1.0 - mist * 0.7)
		e.amount_ratio = strength if strength >= 0.05 else 0.0
		e.global_position = Vector3(at.x, ground + (2.0 if fam == "bruma" else 2.3), at.z)
		(e.process_material as ParticleProcessMaterial).color = key.fog if fam == "bruma" else key.sun

	# ── Bajo los árboles: luciérnagas de noche, hojas de día (sin lluvia). Contar árboles es lo caro: cada 0,25 s.
	_slow_t -= delta
	if _slow_t <= 0.0:
		_slow_t = 0.25
		_trees = world.trees_near(at.x, at.z, ParticlesConfig.FOREST_RADIUS) if world else 0
	# bajo el monte cerrado la niebla se espesa: separa el valle abierto del bosque (AmbienceSystem.js)
	if sky:
		var closed := minf(1.0, _trees / 14.0)
		sky.fog_extra = lerpf(sky.fog_extra, 1.0 + closed * 0.9, minf(1.0, delta * 1.5))
		# tensión: enemigos cerca y monte cerrado cierran la imagen y le quitan color (no cambia escena ni música)
		var near := 0.0
		if CombatSystem.instance:
			var tc: Dictionary = ParticlesConfig.TENSION
			for c: Combatant in CombatSystem.instance.combatants:
				if c.team != "player" and c.is_alive():
					var d := Vector2(c.body.global_position.x - at.x, c.body.global_position.z - at.z).length()
					near = maxf(near, 1.0 - d / float(tc.radius))
			var want := minf(1.0, near * float(tc.enemy) + closed * float(tc.forest))
			_tension = lerpf(_tension, want, minf(1.0, delta * 1.5))
			sky.tension = _tension
	var forest := clampf(float(_trees - ParticlesConfig.FOREST_MIN + 1) / 6.0, 0.0, 1.0)
	var is_night := hour >= 18.5 or hour <= 5.5
	var flies: GPUParticles3D = _emitters.luciernagas
	flies.amount_ratio = forest * (1.0 - wet) if is_night else 0.0
	flies.global_position = Vector3(at.x, ground + 1.4, at.z)
	var leaves: GPUParticles3D = _emitters.hojas
	leaves.amount_ratio = forest if not is_night and wet < 0.3 else 0.0
	leaves.global_position = Vector3(at.x, ground + 4.0, at.z)
