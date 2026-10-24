extends Node3D
## Orquestador (equivale a web/src/core/Game.js): arma el mundo, coloca al jugador en el spawn real del manifest
## y cambia el foco entre ir a pie y manejar. La lógica de cada sistema vive en su propio nodo.

const ENTER_DISTANCE := 5.0

@onready var terrain: TerrainStreamer = $Terrain
@onready var streamer: WorldStreamer = $World
@onready var player: Player = $Player
@onready var camera_rig: CameraRig = $CameraRig
@onready var hud: HUD = $HUD
@onready var imagery: ImageryGround = $Imagery
@onready var traffic_lights: TrafficLights = $TrafficLights
@onready var traffic: TrafficSystem = $Traffic
@onready var landmarks: LandmarkSystem = $Landmarks
@onready var sky: SkySystem = $Sky
@onready var gps: GPS = $GPS
@onready var detail: DetailStreamer = $Detail
@onready var map_screen: MapScreen = $UI/MapScreen

enum State { LOADING, MENU, PLAYING, PAUSED }

## true en las pruebas: al terminar de cargar entra directo a jugar, sin menú.
var skip_menu := false
## Sin coreografía al subir y bajar (pruebas que necesitan el cambio inmediato).
var skip_mount := false
var state := State.LOADING
var vehicle: Vehicle
var _driving := false
var _loading: LoadingScreen
var _menus: Menus
var _orbit := 0.0
var _fps_samples: Array[float] = []
var _play_time := 0.0
var _measured := false
## Modos de cámara (C): distancia y altura del brazo a pie y manejando; la aérea mira casi hacia abajo.
const CAMERA_MODES := [
	{"name": "cerca", "foot": [2.4, 1.6], "car": [6.5, 2.2], "pitch": null},
	{"name": "lejos", "foot": [5.5, 2.4], "car": [11.0, 3.0], "pitch": null},
	{"name": "aérea", "foot": [45.0, 2.0], "car": [60.0, 2.0], "pitch": -1.25},
]
var _cam_mode := 0
var _audio: AudioSystem
var _ambience: AmbienceSystem
var combat: CombatSystem
var factions: FactionSystem
var inventory: InventorySystem
var loot: LootSystem
var firearms: FirearmSystem
var inventory_panel: InventoryPanel
var _prompt_t := 0.0


func _ready() -> void:
	_audio = AudioSystem.new()
	add_child(_audio)
	combat = CombatSystem.new()
	add_child(combat)
	combat.add(player.combat, true)
	combat.camera_rig = camera_rig
	inventory = InventorySystem.new()
	inventory.player = player
	add_child(inventory)
	loot = LootSystem.new()
	loot.name = "Botin"
	loot.focus = player
	add_child(loot)
	inventory_panel = InventoryPanel.new()
	$UI.add_child(inventory_panel)
	firearms = FirearmSystem.new()
	add_child(firearms)
	factions = FactionSystem.new()
	factions.name = "Restos"
	factions.focus = player
	add_child(factions)
	hud.combat = player.combat
	_loading = LoadingScreen.new()
	add_child(_loading)
	_menus = Menus.new()
	add_child(_menus)
	_menus.play_requested.connect(_start_playing)
	_menus.resume_requested.connect(_resume)
	_menus.main_menu_requested.connect(_to_menu)
	_menus.vehicle_chosen.connect(set_vehicle)
	_menus.look_changed.connect(_on_look_changed)
	_menus.weather_changed.connect(func(m): sky.set_weather(m))
	_menus.map_requested.connect(func(): _resume(); map_screen.toggle(1))
	Settings.changed.connect(_apply_quality)
	_apply_quality()
	hud.visible = false
	camera_rig.input_enabled = false
	_boot()


## Arranque: el mundo se arma por etapas mientras la pantalla de carga anima. Cada etapa espera lo que de verdad
## hace falta para jugar sin tirones (no un temporizador), y al final se esperan cuadros estables.
func _boot() -> void:
	var s := WorldData.spawn()
	var start := Vector3(s.x, WorldData.height(s.x, s.z), s.z)
	_loading.set_stage("Levantando el relieve del Valle de Laboyos", 0.05)
	await get_tree().process_frame
	while not terrain.coarse_ready:
		await get_tree().process_frame
	terrain.warm_up(start)
	player.camera_rig = camera_rig
	player.place(s.x, s.z, s.heading)
	camera_rig.yaw = s.heading
	camera_rig.global_position = player.global_position
	traffic.lights = traffic_lights
	sky.camera = camera_rig.camera
	hud.camera = camera_rig.camera
	sky.set_weather(Settings.weather)
	_audio.sky = sky
	_ambience = AmbienceSystem.new()
	_ambience.sky = sky
	_ambience.world = streamer
	_ambience.player = player
	add_child(_ambience)
	hud.sky = sky
	hud.gps = gps
	gps.message.connect(hud.toast)
	map_screen.gps = gps
	map_screen.waypoint_requested.connect(gps.set_waypoint)
	map_screen.teleport_requested.connect(teleport)
	detail.world = streamer
	set_vehicle(_menus.current_vehicle)
	_set_focus(player, 2.4, 1.6)
	# calles, edificios y árboles: los 9 tiles alrededor del parque, construidos en hilos
	var center := WorldData.tile_key(start.x, start.z)
	var ring := []
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			if WorldData.tiles.has(center + Vector2i(dx, dz)):
				ring.push_back(center + Vector2i(dx, dz))
	while true:
		var have := ring.filter(func(k): return streamer.tile_node(k) != null).size()
		_loading.set_stage("Trazando calles y casas reales", 0.15 + 0.35 * have / maxf(ring.size(), 1))
		if have == ring.size():
			break
		await get_tree().process_frame
	# hitos (Catedral, Alcaldía, Coliseo…) cargados en segundo plano
	while not landmarks.is_ready():
		_loading.set_stage("Construyendo la Catedral, la Alcaldía y el Coliseo", 0.5 + 0.2 * landmarks.loaded / maxf(landmarks.total, 1))
		await get_tree().process_frame
	# casas por dentro del tile del parque
	var t0 := Time.get_ticks_msec()
	while detail.get_child_count() <= int(Settings.preset().lights) and Time.get_ticks_msec() - t0 < 8000:
		_loading.set_stage("Amoblando las casas", 0.75)
		await get_tree().process_frame
	# suelo satelital cercano (se descarga; sin red, se sigue sin esperar más de 5 s)
	t0 = Time.get_ticks_msec()
	while not imagery.near_ready() and Time.get_ticks_msec() - t0 < 5000:
		_loading.set_stage("Bajando la imagen satelital", 0.85)
		await get_tree().process_frame
	# cuadros estables: 20 seguidos sin un tirón de más de 1,6× la mediana (máximo 3 s)
	_loading.set_stage("Listo", 0.95)
	var frames: Array[float] = []
	var steady := 0
	t0 = Time.get_ticks_msec()
	while steady < 20 and Time.get_ticks_msec() - t0 < 3000:
		await get_tree().process_frame
		var dt := get_process_delta_time()
		frames.push_back(dt)
		var sorted := frames.duplicate()
		sorted.sort()
		var median: float = sorted[sorted.size() / 2]
		steady = steady + 1 if dt < median * 1.6 + 0.004 else 0
	_loading.finish()
	_loading = null
	if skip_menu:
		_start_playing()
	else:
		_to_menu()


func _apply_quality() -> void:
	var env: WorldEnvironment = $WorldEnvironment
	Settings.apply_to(get_viewport(), env.environment, $Sol)


func _to_menu() -> void:
	state = State.MENU
	_audio.active = false
	map_screen.allowed = false
	inventory_panel.allowed = false
	get_tree().paused = false
	hud.visible = false
	camera_rig.input_enabled = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_menus.open("principal", true)


func _start_playing() -> void:
	state = State.PLAYING
	_audio.active = true
	map_screen.allowed = true
	inventory_panel.allowed = true
	_menus.hide_all()
	get_tree().paused = false
	hud.visible = true
	camera_rig.input_enabled = true
	_follow_camera()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_play_time = 0.0
	_fps_samples.clear()


func _pause() -> void:
	state = State.PAUSED
	_audio.active = false
	map_screen.allowed = false
	inventory_panel.allowed = false
	get_tree().paused = true
	camera_rig.input_enabled = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_menus.open("pausa", true)


func _resume() -> void:
	_menus.hide_all()
	_start_playing()


## Cambia el vehículo del jugador (garaje). Si estaba manejando, sigue manejando el nuevo en el mismo lugar.
func set_vehicle(type: String) -> void:
	var xf := Transform3D()
	var had := vehicle != null
	if had:
		xf = vehicle.global_transform
		vehicle.queue_free()
	vehicle = Vehicle.create(type)
	vehicle.with_doors = true
	vehicle.sky = sky
	add_child(vehicle)
	hud.set_vehicle(vehicle.spec.name, vehicle.spec.max_speed)
	if had:
		vehicle.global_transform = Transform3D(Basis(Vector3.UP, xf.basis.get_euler().y), xf.origin + Vector3.UP * 0.5)
		vehicle.driven = _driving
		if _driving:
			_set_focus(vehicle, 6.5, 2.2)
			_audio.vehicle = vehicle
			_ambience.vehicle_focus = vehicle
			vehicle.seat_driver()
	else:
		var s := WorldData.spawn()
		var ahead := player.global_position - player.global_basis.z * 6.0 + player.global_basis.x * 3.0
		vehicle.place(ahead.x, ahead.z, s.heading)


func _process(delta: float) -> void:
	match state:
		State.MENU:
			# cámara que gira lento sobre el Parque Principal, con la Catedral al fondo
			_orbit += delta * 0.05
			var c: Array = WorldData.manifest.landmarks.get("parquePrincipal", {"c": [0, 0]}).c
			var center := Vector3(c[0], WorldData.height(c[0], c[1]) + 2.0, c[1])
			camera_rig.global_position = center + Vector3(sin(_orbit), 0, cos(_orbit)) * 4.0
			camera_rig.yaw = _orbit
			camera_rig.pitch = -0.3
			# la Torre San Antonio mide 33 m: el sobrevuelo va por encima, a 95 m del parque
			camera_rig.follow(null, 95.0, 40.0)
			camera_rig._arm.collision_mask = 0 # sobrevuelo: sin chocar con la torre ni los techos
		State.PLAYING:
			_measure_quality(delta)
			_prompt_t -= delta
			if _prompt_t <= 0.0:
				_prompt_t = 0.1 # a 10 Hz, como la web
				var it := _interaction()
				hud.set_prompt(UiFx.glyph("interact") if not it.is_empty() else "", it[1] if not it.is_empty() else "")


## Calidad automática: tras 3 s de juego se miden 5 s de fps; si no llega a 40 baja un nivel, si pasa de 110 sube.
func _measure_quality(delta: float) -> void:
	if _measured or not Settings.auto_quality:
		return
	_play_time += delta
	if _play_time < 3.0:
		return
	_fps_samples.push_back(1.0 / maxf(delta, 0.0001))
	if _play_time < 8.0:
		return
	_measured = true
	var avg := 0.0
	for f in _fps_samples:
		avg += f
	avg /= _fps_samples.size()
	var q := Settings.measure(avg)
	if q != "":
		hud.toast("Calidad ajustada a %s para tu equipo (%d fps)" % [q.capitalize(), int(avg)])


func _unhandled_input(event: InputEvent) -> void:
	if state == State.PLAYING and event.is_action_pressed("toggle_mouse") and not map_screen.is_open and not inventory_panel.is_open:
		_pause()
		get_viewport().set_input_as_handled()
		return
	if state != State.PLAYING:
		return
	if event.is_action_pressed("camera"):
		_cam_mode = (_cam_mode + 1) % CAMERA_MODES.size()
		_follow_camera()
		hud.toast("Cámara: " + CAMERA_MODES[_cam_mode].name, 1.5)
	elif event.is_action_pressed("time_skip"):
		sky.set_hour(sky.hour + 3.0)
		hud.toast("Son las " + sky.clock(), 1.5)
	elif event.is_action_pressed("help"):
		hud.toggle_help()
	elif event.is_action_pressed("debug"):
		hud.toggle_debug()
	elif event.is_action_pressed("garage"):
		_pause()
		_menus.open("garaje")
	elif event.is_action_pressed("info") and not _driving:
		_show_info()
	if not event.is_action_pressed("interact"):
		return
	var it := _interaction()
	if not it.is_empty():
		it[2].call()


## Subir: la coreografía del jugador (Player.mount) y al terminar el conductor sentado del vehículo.
func _enter_vehicle() -> void:
	if player.is_mounting():
		return
	if player.visible and player.process_mode != Node.PROCESS_MODE_DISABLED and not skip_mount:
		vehicle.linear_velocity = Vector3.ZERO
		player.mount(vehicle, _seat_in_vehicle)
		return
	_seat_in_vehicle()


func _seat_in_vehicle() -> void:
	_driving = true
	vehicle.driven = true
	player.visible = false
	player.process_mode = Node.PROCESS_MODE_DISABLED
	player.global_position = vehicle.global_position + Vector3.UP * 50.0 # fuera del camino de la física
	_set_focus(vehicle, 6.5, 2.2)
	_audio.vehicle = vehicle
	_ambience.vehicle_focus = vehicle
	vehicle.seat_driver()
	_follow_camera()
	hud.set_on_foot(false)
	EventBus.vehicle_entered.emit(vehicle)


## Tomar un vehículo del tráfico (como PlayerSystem.takeTraffic de la web): sale del tráfico y el del jugador pasa a
## ser uno igual en el mismo sitio; luego se sube con la coreografía de siempre.
func _take_traffic(car: Dictionary) -> void:
	var t := traffic.take_car(car)
	set_vehicle(t.type)
	var xf: Transform3D = t.xf
	vehicle.global_transform = Transform3D(xf.basis, xf.origin + Vector3.UP * 0.3)
	vehicle.linear_velocity = Vector3.ZERO
	vehicle.angular_velocity = Vector3.ZERO
	hud.toast("Tomaste un %s del tráfico" % String(vehicle.spec.name).to_lower())
	_enter_vehicle()


## Bajar: detenido, el jugador sale del asiento con el clip de levantarse; en marcha (> 8 km/h) sale de una vez.
func _exit_vehicle() -> void:
	_driving = false
	_audio.vehicle = null
	_ambience.vehicle_focus = null
	vehicle.unseat_driver()
	vehicle.driven = false
	player.process_mode = Node.PROCESS_MODE_INHERIT
	player.visible = true
	if vehicle.speed_kmh() < 8.0 and not skip_mount:
		player.dismount(vehicle, func(): pass)
	else:
		var p := vehicle.exit_point()
		player.place(p.x, p.z, vehicle.rotation.y)
	_set_focus(player, 2.4, 1.6)
	_follow_camera()
	hud.set_on_foot(true)
	EventBus.vehicle_exited.emit(vehicle)


## Viaje rápido (port de Game.teleport de la web): a la vía vehicular más cercana, 2 m a la derecha del eje y
## mirando a lo largo de ella. Construye de una vez el relieve y los tiles del destino antes de soltar al foco.
func teleport(x: float, z: float) -> void:
	var n := WorldData.roads.nearest(Vector2(x, z), 400.0, true)
	var at := Vector2(x, z)
	var heading := 0.0
	if not n.is_empty():
		var d := (WorldData.roads.verts[n.b] - WorldData.roads.verts[n.a]).normalized()
		at = n.point + Vector2(-d.y, d.x) * 2.0
		heading = atan2(-d.x, -d.y)
	var target := Vector3(at.x, WorldData.height(at.x, at.y), at.y)
	terrain.warm_up(target)
	streamer.warm_up(target)
	detail.warm_up(target)
	if _driving:
		vehicle.place(at.x, at.y, heading + PI) # el carro avanza por +Z
	else:
		player.place(at.x, at.y, heading)
	camera_rig.global_position = target
	camera_rig.yaw = heading
	hud.toast("Viaje rápido")


## Cámara según el modo (C) y si se va a pie o manejando.
func _follow_camera() -> void:
	camera_rig._arm.collision_mask = 1 | 16
	var m: Dictionary = CAMERA_MODES[_cam_mode]
	var arm: Array = m.car if _driving else m.foot
	camera_rig.follow(vehicle if _driving else player, arm[0], arm[1])
	if m.pitch != null:
		camera_rig.pitch = m.pitch


## Lo que F haría ahora: [distancia, texto, acción]. Lo usan el aviso en pantalla y la tecla.
func _interaction() -> Array:
	if _driving:
		return [0.0, "Bajarse", func(): _exit_vehicle()]
	# con el arma en la mano no se interactúa: los dos modos a pie no se pisan (X guarda el arma)
	if player.is_mounting() or player.armed:
		return []
	if player.sitting:
		return [0.0, "Levantarse", func(): player.stand()]
	var here := player.global_position
	var options := []
	var seat := landmarks.seat_near(here)
	if not seat.is_empty():
		options.push_back([Vector2(seat.x - here.x, seat.z - here.z).length() + 0.3, "Sentarse en la banca", func(): player.sit(seat)])
	var to_car := here.distance_to(vehicle.global_position)
	if to_car < ENTER_DISTANCE:
		options.push_back([to_car, "Subir al " + vehicle.spec.name, func(): _enter_vehicle()])
	else:
		var tc := traffic.car_near(here)
		if not tc.is_empty():
			options.push_back([here.distance_to(tc.body.global_position), "Tomar el " + String(VehiclesConfig.spec(tc.type).name).to_lower(), func(): _take_traffic(tc)])
	var door := landmarks.door_near(here)
	if not door.is_empty():
		options.push_back([Vector2(door.pos.x - here.x, door.pos.z - here.z).length(),
			("Cerrar" if door.open else "Abrir") + " la puerta", func(): landmarks.toggle(door)])
	var house_door := detail.door_near(here)
	if not house_door.is_empty():
		options.push_back([Vector2(house_door.pos.x - here.x, house_door.pos.z - here.z).length() - 0.5,
			("Cerrar" if house_door.open else "Abrir") + " la puerta", func(): detail.toggle(house_door)])
	var box := loot.nearest(here)
	if not box.is_empty():
		options.push_back([Vector2(box.x - here.x, box.z - here.z).length() - 0.2, "Registrar: " + loot.label(box), func(): loot.search(box)])
	if options.is_empty():
		return []
	options.sort_custom(func(a, b): return a[0] < b[0])
	return options[0]


## Ficha (E) de lo que se mira: hito, negocio real de OSM o edificio (dato del tile: altura, pisos, fuente).
func _show_info() -> void:
	var cam := camera_rig.camera
	var from := cam.global_position
	var to := from - cam.global_basis.z * 60.0
	var q := PhysicsRayQueryParameters3D.create(from, to, 1, [player.get_rid()])
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	var p: Vector3 = hit.position if not hit.is_empty() else player.global_position - player.global_basis.z * 4.0
	# hito
	var cur := hit.get("collider") as Node
	while cur:
		if cur.get_parent() == landmarks:
			var lm: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(LandmarkSystem.DIR + "/landmarks.json")).get(String(cur.name), {})
			hud.info(lm.get("name", String(cur.name)), ["Hito modelado a mano con fotos y Street View", WorldData.zone_at(p.x, p.z)])
			return
		cur = cur.get_parent()
	var b := streamer.building_at(p.x, p.z)
	if b.is_empty():
		var st := WorldData.roads.street_at(Vector2(p.x, p.z))
		hud.info(st.get("name", "") if st.get("name", "") != "" else "Pitalito", ["Barrio: " + WorldData.zone_at(p.x, p.z)])
		return
	var src := {"osm": "OpenStreetMap", "google": "Google Open Buildings", "ms": "Microsoft Building Footprints", "overture": "Overture Maps"}
	var lines := ["%d %s · %.1f m de alto" % [int(b.get("f", 1)), "piso" if int(b.get("f", 1)) == 1 else "pisos", float(b.get("h", 0.0))],
		"Huella: " + src.get(b.get("s", ""), String(b.get("s", "dato"))),
		"Barrio: " + WorldData.zone_at(p.x, p.z)]
	var poi := ModularBuilder.poi_of(BuildingBuilder._ccw(PackedFloat32Array(b.p)))
	var title: String = b.get("n", "")
	if not poi.is_empty():
		title = poi.n
		lines.push_front("Negocio registrado en OpenStreetMap")
	if ModularBuilder.is_enterable(b):
		lines.push_back("Se puede entrar")
	hud.info(title if title != "" else "Edificio", lines)


func _set_focus(node: Node3D, distance: float, height: float) -> void:
	terrain.focus = node
	imagery.focus = node
	traffic.focus = node
	gps.focus = node
	detail.focus = node
	map_screen.focus = node
	streamer.focus = node
	hud.focus = node
	camera_rig.follow(node, distance, height)
	EventBus.focus_changed.emit(node)


## Nueva apariencia: el jugador se rearma, y si va manejando también el conductor sentado.
func _on_look_changed() -> void:
	if player:
		player.apply_look()
	if vehicle and is_instance_valid(vehicle) and _driving:
		vehicle.unseat_driver()
		vehicle.seat_driver()
