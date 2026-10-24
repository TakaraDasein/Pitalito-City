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
var state := State.LOADING
var vehicle: Vehicle
var _driving := false
var _loading: LoadingScreen
var _menus: Menus
var _orbit := 0.0
var _fps_samples: Array[float] = []
var _play_time := 0.0
var _measured := false


func _ready() -> void:
	_loading = LoadingScreen.new()
	add_child(_loading)
	_menus = Menus.new()
	add_child(_menus)
	_menus.play_requested.connect(_start_playing)
	_menus.resume_requested.connect(_resume)
	_menus.main_menu_requested.connect(_to_menu)
	_menus.vehicle_chosen.connect(set_vehicle)
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
	map_screen.allowed = false
	get_tree().paused = false
	hud.visible = false
	camera_rig.input_enabled = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_menus.open("principal", true)


func _start_playing() -> void:
	state = State.PLAYING
	map_screen.allowed = true
	_menus.hide_all()
	get_tree().paused = false
	hud.visible = true
	camera_rig.input_enabled = true
	camera_rig.follow(vehicle if _driving else player, 6.5 if _driving else 2.4, 2.2 if _driving else 1.6)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_play_time = 0.0
	_fps_samples.clear()


func _pause() -> void:
	state = State.PAUSED
	map_screen.allowed = false
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
	add_child(vehicle)
	if had:
		vehicle.global_transform = Transform3D(Basis(Vector3.UP, xf.basis.get_euler().y), xf.origin + Vector3.UP * 0.5)
		vehicle.driven = _driving
		if _driving:
			_set_focus(vehicle, 6.5, 2.2)
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
			camera_rig.pitch = -0.18
			camera_rig.follow(null, 70.0, 22.0)
		State.PLAYING:
			_measure_quality(delta)


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
	if state == State.PLAYING and event.is_action_pressed("toggle_mouse") and not map_screen.is_open:
		_pause()
		get_viewport().set_input_as_handled()
		return
	if state != State.PLAYING or not event.is_action_pressed("interact"):
		return
	if _driving:
		_exit_vehicle()
		return
	# Prioridad como en la web: lo más cercano entre el carro, las puertas de los hitos y las de las casas
	var here := player.global_position
	var options := []
	var to_car := here.distance_to(vehicle.global_position)
	if to_car < ENTER_DISTANCE:
		options.push_back([to_car, func(): _enter_vehicle()])
	var door := landmarks.door_near(here)
	if not door.is_empty():
		options.push_back([Vector2(door.pos.x - here.x, door.pos.z - here.z).length(), func(): landmarks.toggle(door)])
	var house_door := detail.door_near(here)
	if not house_door.is_empty():
		options.push_back([Vector2(house_door.pos.x - here.x, house_door.pos.z - here.z).length() - 0.5, func(): detail.toggle(house_door)])
	if options.is_empty():
		return
	options.sort_custom(func(a, b): return a[0] < b[0])
	options[0][1].call()


func _enter_vehicle() -> void:
	_driving = true
	vehicle.driven = true
	player.visible = false
	player.process_mode = Node.PROCESS_MODE_DISABLED
	player.global_position = vehicle.global_position + Vector3.UP * 50.0 # fuera del camino de la física
	_set_focus(vehicle, 6.5, 2.2)
	hud.set_on_foot(false)
	EventBus.vehicle_entered.emit(vehicle)


func _exit_vehicle() -> void:
	_driving = false
	vehicle.driven = false
	var p := vehicle.exit_point()
	player.process_mode = Node.PROCESS_MODE_INHERIT
	player.visible = true
	player.place(p.x, p.z, vehicle.rotation.y)
	_set_focus(player, 2.4, 1.6)
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
