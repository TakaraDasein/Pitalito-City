extends Node
## Prueba de humo: arranca la escena principal, deja caer al jugador, lo sube al carro, acelera y verifica que
## todo quede sobre el relieve. Con ventana guarda capturas en screenshots/ (headless no renderiza).
## Uso: godot --headless res://tools/smoke_test.tscn   (solo verificación)
##      godot res://tools/smoke_test.tscn              (verificación + capturas)

var _main: Node
var _frame := 0
var _fails := 0
var _entry := {}


func _ready() -> void:
	# La prueba sigue corriendo cuando el mapa pausa el juego; el juego sí se pausa
	process_mode = Node.PROCESS_MODE_ALWAYS
	_main = load("res://scenes/main.tscn").instantiate()
	_main.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(_main)
	# El ratón del escritorio no debe mover la cámara durante la prueba
	_main.camera_rig.set_process_unhandled_input(false)


func _process(_delta: float) -> void:
	_frame += 1
	if _walk_active:
		_walk_step()
	var player: Player = _main.player
	var car: Vehicle = _main.vehicle
	match _frame:
		120:
			_check("jugador en el suelo", player.is_on_floor())
			_check_ground("jugador", player)
			_check("tiles cargados", _main.streamer.get_child_count() > 0)
			var lm: LandmarkSystem = _main.landmarks
			_check("hitos cargados (%d)" % lm.get_child_count(), lm.get_child_count() == 8)
			_check("puertas de la iglesia (%d)" % lm.doors.size(), lm.doors.size() >= 3)
			if not lm.doors.is_empty():
				lm.toggle(lm.doors[0])
			_shot("a_pie")
		122:
			_main.camera_rig.yaw += PI * 0.5
			_main.camera_rig.pitch = -0.05
		124:
			_shot("personaje")
		121:
			var det: DetailStreamer = _main.detail
			var n := 0
			var rec := 0
			var tiles := 0
			for t: Node in det.get_children():
				if t.has_meta("edificios"):
					tiles += 1
					n += t.get_meta("edificios")
					rec += t.get_meta("recorribles", 0)
			_check("edificios armados con piezas (%d en %d tiles, %d recorribles)" % [n, tiles, rec], n > 200 and rec > 10)
		125:
			player.global_position = car.global_position - car.global_basis.x * 2.0
		130:
			_press("interact")
		135:
			# Destino: el Terminal de Transportes (lugar real de OSM), buscado como lo haría la persona
			var hits := CityMap.search("terminal de transportes")
			_check("buscador encuentra el Terminal (%d)" % hits.size(), not hits.is_empty())
			if not hits.is_empty():
				_main.gps.set_waypoint({"x": hits[0].x, "z": hits[0].z, "name": hits[0].n})
			_check("ruta GPS trazada (%.0f m)" % _main.gps.remaining(), _main.gps.remaining() > 500.0)
		140:
			_check("manejando", car.driven)
			Input.action_press("move_forward")
		400:
			Input.action_release("move_forward")
			_check("el carro avanzó (%.1f km/h)" % car.speed_kmh(), car.speed_kmh() > 5.0)
			_check_ground("carro", car)
			_shot("manejando")
			var traffic: TrafficSystem = _main.traffic
			_check("tráfico circulando (%d carros)" % traffic.count(), traffic.count() >= 10)
			var moving := 0
			for c: Dictionary in traffic._cars:
				if c.speed > 1.0:
					moving += 1
				var g := WorldData.height(c.body.global_position.x, c.body.global_position.z)
				if absf(c.body.global_position.y - g) > 1.0:
					_check("carro IA %s fuera del relieve (y=%.1f suelo=%.1f en %s, vía %s)" % [c.type, c.body.global_position.y, g, str(c.body.global_position), WorldData.roads.roads[c.road].c], false)
			_check("carros IA en movimiento (%d)" % moving, moving >= 3)
			_check("semáforos cargados (%d tiles)" % _main.traffic_lights._by_tile.size(), not _main.traffic_lights._by_tile.is_empty())
			var r: PackedVector2Array = WorldData.roads.route(Vector2(0, 0), Vector2(1500, -1400))
			_check("ruta GPS al Terminal (%d puntos)" % r.size(), r.size() > 5)
		300:
			var d: Dictionary = _main.landmarks.doors[0] if not _main.landmarks.doors.is_empty() else {}
			_check("la puerta se abrió (%.2f rad)" % d.get("angle", 0.0), d.get("angle", 0.0) > 1.0)
		402:
			# Vista aérea: deja tiempo para que el suelo satelital termine de bajar
			_main.camera_rig.follow(car, 40.0, 6.0)
			_main.camera_rig._arm.collision_mask = 0
			_main.camera_rig.pitch = -0.55
		900:
			_shot("aerea")
		902:
			# Atardecer con lluvia: atmósfera, ventanas encendidas y gotas en GPU
			_main.sky.set_hour(18.4)
			_main.sky.set_weather(SkySystem.Weather.RAIN)
			_main.sky.wet = 1.0
		1000:
			_check("lluvia emitiendo", _main.sky._rain.emitting)
			_shot("atardecer_lluvia")
		1002:
			_main.sky.set_weather(SkySystem.Weather.CLEAR)
			_main.sky.wet = 0.0
			_main.sky.set_hour(21.0)
		1060:
			_check("de noche (%.2f)" % _main.sky.night, _main.sky.night > 0.9)
			_shot("noche")
		1062:
			_main.sky.set_hour(10.0)
			_main.map_screen.toggle(1)
		1070:
			_check("mapa abierto y juego en pausa", _main.map_screen.visible and get_tree().paused)
			_check("el mapa ocupa la pantalla", _main.map_screen._canvas.size.x > 400.0)
			_shot("mapa")
		1072:
			_main.map_screen.toggle(0)
			_main._exit_vehicle()
			var lm: Dictionary = WorldData.manifest.landmarks.coliseo
			_main.teleport(lm.c[0], lm.c[1])
		1080:
			_check_ground("jugador tras viaje rápido al Coliseo", _main.player)
			_check("cerca del Coliseo", Vector2(_main.player.global_position.x, _main.player.global_position.z).distance_to(Vector2(WorldData.manifest.landmarks.coliseo.c[0], WorldData.manifest.landmarks.coliseo.c[1])) < 120.0)
		1082:
			# Vista desde la plaza del norte (fachada de galerías), como la foto de Street View de 2025
			var cc: Array = WorldData.manifest.landmarks.coliseo.c
			_main.player.place(cc[0], cc[1] - 65.0)
			_main.camera_rig.follow(_main.player, 4.0, 6.0)
			_main.camera_rig.yaw = PI
			_main.camera_rig.pitch = -0.05
		1200:
			_shot("coliseo")
		1206:
			_water_test()
		1300:
			# 4 s de física (no de cuadros: con GPU se dibuja más rápido de lo que avanza la física)
			if Engine.get_physics_frames() - _water_t0 < 240:
				_frame -= 1
				return
			_water_check() # toma la foto del río y después arma los recorridos
		1345:
			if not _walks.is_empty() or _walk_active or _shooting:
				_frame -= 1 # espera a que terminen los recorridos
				return
			print("Tiles: %d · relieve cercano: %d" % [_main.streamer.get_child_count(), _main.terrain._near.size()])
			print("RESULTADO: ", "OK" if _fails == 0 else "%d FALLAS" % _fails)
			get_tree().quit(_fails)


## Recorridos a pie: el jugador camina con W desde `from` hacia `to`, corrigiendo el rumbo con la cámara.
## Cada uno: { label, from, to, frames, before (Callable, opcional), expect_block (bool), check (Callable, opcional) }
var _walks: Array = []
var _walk_active := false
var _walk := {}
var _walk_t := 0


var _water := {}
var _water_t0 := 0
var _crate: RigidBody3D


## Agua: el punto de río más cercano al Coliseo (el Guarapas, a ~150 m); jugador, caja de madera y carro adentro.
func _water_test() -> void:
	var ws: WaterSystem = WaterSystem.instance
	var c: Array = WorldData.manifest.landmarks.coliseo.c
	var best := {}
	var bd := INF
	for segs: Array in ws._by_tile.values():
		for sg: Array in segs:
			if float(sg[2]) < 6.0:
				continue
			var a: Vector3 = sg[0]
			var d := Vector2(a.x - c[0], a.z - c[1]).length()
			if d < bd:
				bd = d
				best = {"p": a, "flow": (Vector3(sg[1]) - a).normalized()}
	_check("río cerca del Coliseo (a %.0f m)" % bd, bd < 400.0)
	if best.is_empty():
		return
	_water = best
	_water_t0 = Engine.get_physics_frames()
	var p: Vector3 = best.p
	_main.player.global_position = p + Vector3.UP * 0.5
	_main.player.velocity = Vector3.ZERO
	_main.camera_rig.follow(_main.player, 9.0, 3.5)
	_main.camera_rig.yaw = atan2(-best.flow.x, -best.flow.z) + 1.2
	_main.camera_rig.pitch = -0.45
	_crate = RigidBody3D.new()
	_crate.mass = 250.0
	_crate.collision_mask = 1 | 16 # madera: ~500 kg/m³, medio metro cúbico
	var sh := CollisionShape3D.new()
	var bx := BoxShape3D.new()
	bx.size = Vector3(1, 0.5, 1)
	sh.shape = bx
	_crate.add_child(sh)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = bx.size
	mi.mesh = bm
	_crate.add_child(mi)
	_main.add_child(_crate)
	_crate.global_position = p + Vector3(2, 2, 0)
	# el carro del jugador, tirado al río aguas abajo de la caja
	var car: Vehicle = _main.vehicle
	car.global_transform = Transform3D(Basis(), p + Vector3(best.flow) * 10.0 + Vector3.UP * 1.5)
	car.linear_velocity = Vector3.ZERO
	var pts := []
	for x: float in [-0.4, 0.4]:
		for y: float in [-0.125, 0.125]:
			for z: float in [-0.4, 0.4]:
				pts.push_back(Vector3(x, y, z))
	ws.add_body(_crate, pts, 0.5, 0.125)


func _water_check() -> void:
	if _water.is_empty():
		_plan_walks()
		return
	var ws: WaterSystem = WaterSystem.instance
	var pl: Player = _main.player
	var w := ws.sample(pl.global_position.x, pl.global_position.z)
	_check("el jugador nada (%s)" % ("en el agua, %.2f m bajo la superficie" % (float(w.surface) - pl.global_position.y) if not w.is_empty() else "fuera del agua"), pl.swimming)
	var cw := ws.sample(_crate.global_position.x, _crate.global_position.z)
	# flotando en el agua, o varada en la orilla por encima del agua (la corriente la puede dejar ahí)
	var ok := not cw.is_empty() and absf(_crate.global_position.y - float(cw.surface)) < 0.6
	_check("la caja de madera flota (y=%.2f, superficie=%.2f)" % [_crate.global_position.y, float(cw.get("surface", NAN))], ok)
	var hv := Vector2(_crate.linear_velocity.x, _crate.linear_velocity.z).length()
	_check("la corriente arrastra la caja a su ritmo (%.2f m/s, corriente %.1f)" % [hv, WaterSystem.CURRENT], hv > 0.3 and hv < 1.6)
	var car: Vehicle = _main.vehicle
	var vw := ws.sample(car.global_position.x, car.global_position.z)
	_check("el carro flota en el río (y=%.2f, superficie=%.2f)" % [car.global_position.y, float(vw.get("surface", NAN))], not vw.is_empty() and car.global_position.y > float(vw.surface) - 1.5)
	_shooting = true
	_main.camera_rig.global_position = _main.player.global_position
	for i in 10:
		await get_tree().process_frame
	await _shot("rio")
	_shooting = false
	_crate.queue_free()
	_plan_walks()


func _plan_walks() -> void:
	var lm: LandmarkSystem = _main.landmarks
	for d: Dictionary in lm.doors:
		if String(d.name).contains("lateral"):
			var frame: Node3D = (d.leaves[0].hinge as Node3D).get_parent() # el marco de la puerta
			var out: Vector3 = frame.global_basis.z
			out.y = 0.0
			out = out.normalized()
			var pos: Vector3 = d.pos
			_walks.push_back({"label": "iglesia: puerta lateral", "from": pos + out * 3.5 + Vector3.UP, "to": pos - out * 3.0,
				"frames": 400, "delay": 0.0, "wait_door": d, "before": func(): if not d.open: lm.toggle(d)})
	for d: Dictionary in lm.doors:
		var dname := String(d.name)
		if dname.ends_with("_puerta"):
			var fr: Node3D = (d.leaves[0].hinge as Node3D).get_parent()
			var out_dir: Vector3 = fr.global_basis.z
			out_dir.y = 0.0
			out_dir = out_dir.normalized()
			var dp: Vector3 = d.pos
			_walks.push_back({"label": "iglesia: fachada", "from": dp + out_dir * 16.0 + Vector3.UP * 3.0,
				"to": dp + out_dir * 15.0, "frames": 90, "look": Vector2(dp.x, dp.z)})
	# Puentes: los dos del Guarapas junto al Coliseo, tablero sobre el agua, y la pasarela cruzable a pie
	var ws: WaterSystem = WaterSystem.instance
	var names := ws.crossings.map(func(c): return c.name)
	_check("puentes detectados (%d cruces vía–río; Libertador y Pastrana: %s)" % [ws.crossings.size(), str("Puente El Libertador" in names and "Avenida Pastrana" in names)],
		"Puente El Libertador" in names and "Avenida Pastrana" in names)
	for c: Dictionary in ws.crossings:
		if c.name == "Puente El Libertador":
			var q: Vector2 = c.point
			var dy := ws.deck_y(q.x, q.y)
			_check("el tablero del Libertador va sobre el agua (%.2f m)" % (dy - float(c.surface)), dy - float(c.surface) > 1.0)
			var d: Vector2 = c.dir
			var fpos: Vector3 = ws.footbridges[0].center if not ws.footbridges.is_empty() else Vector3(q.x, dy, q.y)
			_walks.push_back({"label": "puente El Libertador: vista a la pasarela", "from": Vector3(q.x, dy + 0.5, q.y),
				"to": Vector3(q.x, dy, q.y) + Vector3(d.x, 0, d.y) * 0.5, "frames": 60, "look": Vector2(fpos.x, fpos.z)})
	_check("pasarela peatonal armada (%d)" % ws.footbridges.size(), not ws.footbridges.is_empty())
	if not ws.footbridges.is_empty():
		var fbd: Dictionary = ws.footbridges[0]
		var fb: Vector3 = fbd.center
		var fa: Vector2 = fbd.a
		var fz: Vector2 = fbd.b
		_walks.push_back({"label": "pasarela: cruzar el río a pie, sin mojarse", "from": Vector3(fa.x, WorldData.height(fa.x, fa.y) + 0.5, fa.y),
			"to": Vector3(fz.x, WorldData.height(fz.x, fz.y), fz.y), "via": [fb], "frames": 1600, "look": Vector2(fb.x, fb.z),
			"no_swim": true, "check": func(): return not _swam})
	var marks := {}
	for pat in ["acceso_*", "gradas_*"]:
		for n: Node in lm.find_children(pat, "Node3D", true, false):
			marks[String(n.name)] = (n as Node3D).global_position
	if marks.has("acceso_coliseo_afuera"):
		_walks.push_back({"label": "coliseo: entrar por la puerta oeste", "from": marks.acceso_coliseo_afuera + Vector3.UP * 0.5,
			"to": marks.acceso_coliseo_adentro, "via": [marks.acceso_coliseo_tunel] if marks.has("acceso_coliseo_tunel") else [], "frames": 1800, "look": Vector2(marks.gradas_coliseo_arriba.x, marks.gradas_coliseo_arriba.z)})
		var top_y: float = marks.gradas_coliseo_arriba.y
		_walks.push_back({"label": "coliseo: subir la gradería por el pasillo amarillo", "from": marks.gradas_coliseo_pie + Vector3.UP * 0.3,
			"to": marks.gradas_coliseo_arriba, "frames": 500, "look": Vector2(marks.acceso_coliseo_adentro.x, marks.acceso_coliseo_adentro.z),
			"check": func(): return absf(_main.player.global_position.y - top_y) < 0.8})
	for k in ["salon", "vestibulo"]:
		if marks.has("acceso_%s_afuera" % k):
			_walks.push_back({"label": "alcaldía: " + ("salón de atención" if k == "salon" else "vestíbulo"),
				"from": marks["acceso_%s_afuera" % k] + Vector3.UP * 0.5, "to": marks["acceso_%s_adentro" % k], "frames": 300})
	var list: Array = _main.detail.entries()
	var house := {}
	for e: Dictionary in list:
		if e.get("has_stairs", false):
			house = e
			break
	_check("casa recorrible de dos pisos con escalera cerca", not house.is_empty())
	var od: Array = _main.detail.open_doors_check()
	_check("puertas interiores abiertas de verdad (%d de %d)" % [od[1], od[0]], od[0] > 0 and od[1] == od[0])
	var empty := 0
	var total := 0
	for e: Dictionary in list:
		total += 1
		if e.get("furniture", 0) < 3:
			empty += 1
	_check("recorribles amoblados (%d de %d con menos de 3 muebles)" % [empty, total], empty * 10 <= total)
	if house.is_empty():
		return
	var y0: float = house.floor_y[0]
	var door: Vector2 = house.door
	var inn: Vector2 = house.door_in
	var close: Vector2 = house.door_close
	_walks.push_back({"label": "casa: la puerta cerrada bloquea", "from": Vector3(close.x, y0 + 0.3, close.y),
		"to": Vector3(inn.x, y0, inn.y), "frames": 120, "expect_block": true})
	_walks.push_back({"label": "casa: abrir con F y entrar", "from": Vector3(close.x, y0 + 0.3, close.y),
		"to": Vector3(inn.x, y0, inn.y), "frames": 200, "look": house.inside, "before": func():
			_press("interact")})
	# Un negocio real de OSM (si hay uno cerca): letrero con su nombre y local amoblado según el tipo
	for e: Dictionary in list:
		if e.get("name", "") != "":
			var sdoor: Vector2 = e.door
			var sin_: Vector2 = e.door_in
			var sy0: float = e.floor_y[0]
			var outward := (sdoor - sin_).normalized()
			_walks.push_back({"label": "local real «%s» (%s): letrero y entrada" % [e.name, e.kind],
				"from": Vector3(sdoor.x + outward.x * 3.0, sy0 + 0.3, sdoor.y + outward.y * 3.0), "to": Vector3(sdoor.x, sy0, sdoor.y),
				"frames": 160})
			var sclose: Vector2 = e.door_close
			_walks.push_back({"label": "local real «%s»: adentro" % e.name, "from": Vector3(sclose.x, sy0 + 0.3, sclose.y),
				"to": Vector3(sin_.x, sy0, sin_.y), "frames": 220, "look": e.inside, "before": func(): _press("interact")})
			break
	# Subir la escalera siguiendo su recorrido (recta, o en U con descanso)
	var path: Array = house.stairs_path
	var y1: float = house.floor_y[1]
	var pts := []
	for q: Vector2 in path:
		pts.push_back(Vector3(q.x, y0, q.y))
	var first: Vector3 = pts.pop_front()
	_walks.push_back({"label": "casa: subir la escalera (%s, %d peldaños de %.0f cm)" % [house.stairs_type, ceili(float(house.heights[0]) / BuildingsConfig.RISER_MAX), float(house.heights[0]) / ceili(float(house.heights[0]) / BuildingsConfig.RISER_MAX) * 100.0],
		"from": first + Vector3.UP * 0.3, "to": pts.pop_back(), "via": pts, "frames": 500, "look": house.inside,
		"check": func(): return absf(_main.player.global_position.y - y1) < 0.6})
	# Altura libre: de cualquier punto del recorrido de la escalera, hacia arriba, nada a menos de HEADROOM
	var low := INF
	var floor_hits := 0
	var space: PhysicsDirectSpaceState3D = _main.get_world_3d().direct_space_state
	for i in range(0, 41):
		var a: Vector2 = path[0]
		var b: Vector2 = path[path.size() - 1]
		var q := a.lerp(b, i / 40.0) if path.size() == 2 else (path[mini(i * (path.size() - 1) / 40, path.size() - 2)] as Vector2).lerp(path[mini(i * (path.size() - 1) / 40 + 1, path.size() - 1)], fmod(i * (path.size() - 1) / 40.0, 1.0))
		var floor_ray := space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(q.x, y1 + 0.5, q.y), Vector3(q.x, y0 - 0.5, q.y)))
		if floor_ray.is_empty():
			continue
		var fy_: float = floor_ray.position.y
		floor_hits += 1
		var up_ray := space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(q.x, fy_ + 0.05, q.y), Vector3(q.x, fy_ + 8.0, q.y)))
		if not up_ray.is_empty():
			low = minf(low, up_ray.position.y - fy_)
	_check("altura libre sobre la escalera ≥ %.1f m (mínima medida %.2f m)" % [BuildingsConfig.HEADROOM, low], low >= BuildingsConfig.HEADROOM - 0.05 and low < INF)
	# Techos: altura libre de cada piso de las casas cercanas ≥ 2,4 m
	var worst := INF
	for e: Dictionary in list:
		var hs: Array = e.get("heights", [])
		for k in hs.size():
			# Todos los pisos menos el último tienen losa encima; el último, el techo
			worst = minf(worst, float(hs[k]) - (BuildingsConfig.SLAB if k < hs.size() - 1 else 0.0))
	_check("altura libre de los pisos ≥ 2,4 m (mínima %.2f m)" % worst, worst >= 2.4)
	_walk_next()


func _walk_next() -> void:
	_walk_active = false
	Input.action_release("move_forward")
	if _walks.is_empty():
		return
	_walk = _walks.pop_front()
	_walk_active = true
	_walk_t = 0
	var player: Player = _main.player
	var from: Vector3 = _walk.from
	player.global_position = from
	player.velocity = Vector3.ZERO
	_main.camera_rig.follow(player, 2.4, 1.6)
	_main.camera_rig._arm.collision_mask = 1
	_main.camera_rig.pitch = -0.15
	_main.camera_rig.global_position = from
	if _walk.has("before"):
		_walk.before.call()


var _swam := false


func _walk_step() -> void:
	_walk_t += 1
	var player: Player = _main.player
	if _walk_t == 1:
		_swam = false
	if player.swimming:
		_swam = true
	var p := player.global_position
	var to: Vector3 = _walk.to
	var via: Array = _walk.get("via", [])
	if not via.is_empty():
		var nx: Vector3 = via[0]
		if Vector2(nx.x - p.x, nx.z - p.z).length() < 1.0:
			via.pop_front()
		if not via.is_empty():
			to = via[0]
	var flat := Vector2(to.x - p.x, to.z - p.z)
	# Deja asentar al jugador y, si hay una puerta en el camino, que termine de abrirse (la animación va en
	# tiempo real: con GPU los cuadros pasan más rápido que la hoja)
	var door_ready := true
	if _walk.has("wait_door"):
		door_ready = absf(float(_walk.wait_door.angle)) > 1.5
	if _walk_t >= 30 and door_ready and not Input.is_action_pressed("move_forward"):
		Input.action_press("move_forward")
	if flat.length() > 0.05:
		_main.camera_rig.yaw = atan2(-flat.x, -flat.y)
	var reached := flat.length() < 1.0 and via.is_empty()
	if reached or _walk_t >= int(_walk.frames):
		var ok: bool = reached
		if _walk.get("expect_block", false):
			ok = not reached
		if ok and _walk.has("check"):
			ok = _walk.check.call()
		var why := ""
		if not ok:
			print("      pos final %s · objetivo %s · intermedios pendientes %d · colisiones %d" % [p.snapped(Vector3.ONE * 0.1), Vector3(_walk.to).snapped(Vector3.ONE * 0.1), via.size(), player.get_slide_collision_count()])
			for i in player.get_slide_collision_count():
				var cc := player.get_slide_collision(i)
				print("        con %s normal %s" % [(cc.get_collider() as Node).get_parent().name, cc.get_normal().snapped(Vector3.ONE * 0.01)])
		if not ok:
			for i in player.get_slide_collision_count():
				var col := player.get_slide_collision(i)
				var obj := col.get_collider() as Node
				if obj and col.get_normal().y < 0.7:
					var shape_owner := (obj as CollisionObject3D).shape_find_owner(col.get_collider_shape_index()) if obj is CollisionObject3D else -1
					var shape_node: Object = (obj as CollisionObject3D).shape_owner_get_owner(shape_owner) if shape_owner >= 0 else null
					why = " · chocó con %s/%s (normal %s, en %s)" % [obj.get_parent().name, shape_node.get("shape") if shape_node else "?", col.get_normal().snapped(Vector3.ONE * 0.01), col.get_position().snapped(Vector3.ONE * 0.01)]
		_check("%s (quedó a %.1f m, y=%.1f)%s" % [_walk.label, flat.length(), p.y, why], ok)
		if not ok and why.contains("Concave"):
			for e: Dictionary in _main.detail.entries():
				var c: Vector2 = e.inside
				if c.distance_to(Vector2(p.x, p.z)) < 25.0:
					print("      cerca: %s pisos=%s puerta=%s centro=%s nombre=%s" % [e.kind, str(e.floor_y), str(e.door), str(c), e.name])
		Input.action_release("move_forward")
		_walk_active = false
		_shooting = true
		await _shot("recorrido_%d" % (_shots_walk)) # la captura antes de mover al jugador al siguiente
		var lbl := String(_walk.label)
		if lbl.ends_with("entrar") or lbl.ends_with("adentro") or lbl.contains("escalera") or lbl.ends_with("fachada") or lbl.contains("vestíbulo") or lbl.contains("coliseo") or lbl.contains("pasarela"):
			# Vista del cuarto: cámara corta, a la altura de los ojos, mirando al centro del cuarto
			var cam_to: Vector2 = _walk.get("look", Vector2(_walk.to.x, _walk.to.z))
			var pp: Vector3 = _main.player.global_position
			_main.camera_rig.follow(_main.player, 0.4, 1.65)
			_main.camera_rig.yaw = atan2(-(cam_to.x - pp.x), -(cam_to.y - pp.z))
			_main.camera_rig.pitch = -0.12
			_main.player.visible = false
			for i in 6:
				await get_tree().process_frame
			await _shot("recorrido_%d_cuarto" % _shots_walk)
			_main.player.visible = true
		_shooting = false
		_shots_walk += 1
		_walk_next()


var _shots_walk := 0
var _shooting := false


func _press(action: String) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = true
	Input.parse_input_event(ev)


func _check(label: String, ok: bool) -> void:
	print(("  ok  " if ok else "FALLA ") + label)
	if not ok:
		_fails += 1


func _check_ground(label: String, n: Node3D) -> void:
	var p := n.global_position
	var g := WorldData.height(p.x, p.z)
	_check("%s sobre el relieve (y=%.1f, suelo=%.1f)" % [label, p.y, g], absf(p.y - g) < 2.0)


func _shot(name: String) -> void:
	if DisplayServer.get_name() == "headless":
		await get_tree().process_frame
		return
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://screenshots")
	get_viewport().get_texture().get_image().save_png("res://screenshots/%s.png" % name)
	print("  captura screenshots/%s.png" % name)
