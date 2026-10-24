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

var vehicle: Vehicle
var _driving := false


func _ready() -> void:
	var s := WorldData.spawn()
	var start := Vector3(s.x, WorldData.height(s.x, s.z), s.z)
	terrain.warm_up(start)
	streamer.warm_up(start)
	detail.world = streamer
	detail.warm_up(start)
	player.camera_rig = camera_rig
	player.place(s.x, s.z, s.heading)
	camera_rig.yaw = s.heading
	camera_rig.global_position = player.global_position

	# Un carro estacionado frente al spawn (ESTIMADO: ubicación de juego, no dato)
	traffic.lights = traffic_lights
	sky.camera = camera_rig.camera
	hud.sky = sky
	hud.gps = gps
	gps.message.connect(hud.toast)
	map_screen.gps = gps
	map_screen.waypoint_requested.connect(gps.set_waypoint)
	map_screen.teleport_requested.connect(teleport)
	vehicle = Vehicle.create("willys") # el primero del garaje de la web (PLAYER_ROSTER)
	add_child(vehicle)
	var ahead := player.global_position - player.global_basis.z * 6.0 + player.global_basis.x * 3.0
	vehicle.place(ahead.x, ahead.z, s.heading)
	_set_focus(player, 2.4, 1.6)


func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("interact"):
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
