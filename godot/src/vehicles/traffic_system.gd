class_name TrafficSystem
extends Node3D
## Tráfico IA (port de web/src/systems/TrafficSystem.js): vehículos que recorren el grafo vial por el carril
## derecho, prefieren seguir derecho, frenan detrás de otros, del jugador y ante el semáforo en rojo, y aparecen y
## se retiran alrededor del foco.
## Adaptación a Godot: cada carro es un AnimatableBody3D cinemático. Simular 36 VehicleBody3D sería desperdicio,
## pero así chocan con el jugador y su carro dentro de la física real, sin el `collidePlayer` manual de la web.
## Los carros retirados vuelven a un pool por tipo: no se instancia ni se libera en cada aparición.

var focus: Node3D
var lights: TrafficLights
## 0..1; el modo supervivencia la baja (casi nadie conduce ya).
var density := 1.0

var _net: RoadNetwork
var _cars: Array[Dictionary] = []
var _pool: Dictionary = {}  # tipo → Array[AnimatableBody3D]
var _spawn_timer := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_net = WorldData.roads
	_rng.randomize()


func count() -> int:
	return _cars.size()


## Carro del tráfico a menos de su media eslora + `reach` de `p` (el más cercano), o {}.
func car_near(p: Vector3, reach := 2.2) -> Dictionary:
	var best := {}
	var bd := INF
	for car in _cars:
		var d: float = car.body.global_position.distance_to(p)
		if d < float(car.half_len) + reach and d < bd:
			bd = d
			best = car
	return best


## Lo saca del tráfico (vuelve al pool) y devuelve dónde estaba: el jugador se queda con uno igual ahí mismo.
func take_car(car: Dictionary) -> Dictionary:
	var out := {"type": car.type, "xf": (car.body as Node3D).global_transform}
	var i := _cars.find(car)
	if i >= 0:
		_release(car)
		_cars.remove_at(i)
	return out


func _physics_process(delta: float) -> void:
	if focus == null or _net == null:
		return
	var fp := focus.global_position
	var max_cars := roundi(VehiclesConfig.TRAFFIC_MAX * density)
	_spawn_timer -= delta
	if _cars.size() < max_cars and _spawn_timer <= 0.0:
		_spawn(Vector2(fp.x, fp.z))
		_spawn_timer = 0.12

	for i in range(_cars.size() - 1, -1, -1):
		var car := _cars[i]
		var body: AnimatableBody3D = car.body
		if body.global_position.distance_to(fp) > VehiclesConfig.TRAFFIC_DESPAWN_RADIUS:
			_release(car)
			_cars.remove_at(i)
			continue
		_drive(car, delta, fp)


func _drive(car: Dictionary, delta: float, focus_pos: Vector3) -> void:
	var body: AnimatableBody3D = car.body
	var pos := body.global_position
	var fwd: Vector3 = car.dir
	# ¿Hay algo adelante? (foco u otro vehículo en un cono frontal) + el semáforo en rojo
	var block := INF
	for o: Vector3 in [focus_pos] + _cars.map(func(c): return c.body.global_position):
		var d := o - pos
		var ahead := d.x * fwd.x + d.z * fwd.z
		var side := absf(d.x * -fwd.z + d.z * fwd.x)
		if ahead > 0.1 and ahead < 16.0 and side < 2.2:
			block = minf(block, ahead)
	if lights:
		block = minf(block, lights.distance_to_red(pos, fwd))
	car.stop = maxf(0.0, car.stop - delta)
	var target := 0.0
	if car.stop <= 0.0 and block >= 5.0:
		target = car.max_speed if block >= 16.0 else car.max_speed * (block - 5.0) / 11.0
	car.speed += (target - car.speed) * minf(1.0, delta * (4.0 if target < car.speed else 1.2))

	car.s += car.speed * delta
	var guard := 0
	while car.s > car.len and guard < 5:
		guard += 1
		car.s -= car.len
		if not _next_edge(car):
			car.s = car.len
			car.speed = 0.0
			break
	var a := _net.verts[car.a]
	var b := _net.verts[car.b]
	var dir := (b - a) / maxf(car.len, 0.001)
	var t: float = car.s / maxf(car.len, 0.001)
	# Desplazamiento al carril derecho (derecha de la marcha = (−dir.y, dir.x) en x, z)
	var p: Vector2 = a.lerp(b, t) + Vector2(-dir.y, dir.x) * car.lane
	var want := atan2(dir.x, dir.y) # el modelo mira a +Z
	car.yaw = lerp_angle(car.yaw, want, minf(1.0, delta * 6.0))
	car.dir = Vector3(sin(car.yaw), 0.0, cos(car.yaw))
	# Se apoya en el relieve: altura en el centro e inclinación por la diferencia entre adelante y atrás
	var half: float = car.half_len
	var h_front := _ground(p.x + car.dir.x * half, p.y + car.dir.z * half)
	var h_back := _ground(p.x - car.dir.x * half, p.y - car.dir.z * half)
	var pitch := atan2(h_back - h_front, half * 2.0)
	body.global_transform = Transform3D(Basis.from_euler(Vector3(pitch, car.yaw, 0.0), EULER_ORDER_YXZ),
		Vector3(p.x, _ground(p.x, p.y), p.y))
	var spin: float = car.speed * delta
	for w: Node3D in car.wheels:
		w.rotate_object_local(Vector3.RIGHT, spin / w.get_meta("radius"))


## Suelo del tráfico: el tablero del puente si hay uno; si no, el relieve (si no, pasaba por debajo del puente).
func _ground(x: float, z: float) -> float:
	var y := WaterSystem.instance.deck_y(x, z) if WaterSystem.instance else NAN
	return WorldData.height(x, z) if is_nan(y) else y


## Siguiente arista en el cruce: evita devolverse y prefiere seguir derecho (como la web).
func _next_edge(car: Dictionary) -> bool:
	var options: Array = _net.adj[car.b].filter(func(e): return e.to != car.a)
	if options.is_empty():
		options = _net.adj[car.b]
	if options.is_empty():
		return false
	var d := (_net.verts[car.b] - _net.verts[car.a]).normalized()
	var best: Dictionary = {}
	var best_w := -INF
	for e: Dictionary in options:
		var ed := (_net.verts[e.to] - _net.verts[car.b]).normalized()
		var w := 0.3 + maxf(0.0, d.dot(ed)) * 2.0 + _rng.randf()
		if w > best_w:
			best_w = w
			best = e
	car.a = car.b
	car.b = best.to
	car.len = best.len
	car.road = best.road
	_set_lane(car)
	return true


func _set_lane(car: Dictionary) -> void:
	var r: Dictionary = _net.roads[car.road]
	var width: float = WorldConfig.road_class(r.c).width
	car.lane = 0.0 if r.get("o", false) else width * 0.25
	var speed: float = WorldConfig.road_class(r.c).get("speed", 30.0)
	var k := 1.15 if car.type == "moto" else (0.8 if car.type in VehiclesConfig.SLOW else 1.0)
	car.max_speed = speed / 3.6 * k


func _spawn(center: Vector2) -> void:
	for tries in 30:
		# Muestreo local: un punto del anillo y la vía más cercana
		var ang := _rng.randf() * TAU
		var dist := 90.0 + _rng.randf() * (VehiclesConfig.TRAFFIC_SPAWN_RADIUS - 90.0)
		var near := _net.nearest(center + Vector2(cos(ang), sin(ang)) * dist, 40.0, true)
		if near.is_empty():
			continue
		var road: Dictionary = _net.roads[near.road]
		if road.c in ["service", "track"]:
			continue
		var forward: bool = _rng.randf() < 0.5 or road.get("o", false)
		var a: int = near.a if forward else near.b
		var b: int = near.b if forward else near.a
		if not _net.adj[a].any(func(e): return e.to == b):
			continue
		var p: Vector2 = near.point
		if _cars.any(func(c): return Vector2(c.body.global_position.x, c.body.global_position.z).distance_to(p) < 14.0):
			continue
		var type := VehiclesConfig.pick_traffic(_rng)
		var body := _acquire(type)
		if body == null:
			continue
		var length := _net.verts[a].distance_to(_net.verts[b])
		var t: float = near.t if forward else 1.0 - near.t
		var dir := (_net.verts[b] - _net.verts[a]).normalized()
		var car := {
			"type": type, "body": body, "a": a, "b": b, "s": t * length, "len": length, "road": near.road,
			"speed": 0.0, "stop": 0.0, "lane": 0.0, "max_speed": 8.0, "yaw": atan2(dir.x, dir.y),
			"dir": Vector3(dir.x, 0, dir.y), "half_len": body.get_meta("half_len"), "wheels": body.get_meta("wheels"),
		}
		_set_lane(car)
		body.visible = true
		body.process_mode = Node.PROCESS_MODE_INHERIT
		_cars.push_back(car)
		_drive(car, 0.0, Vector3(INF, 0, INF))
		_teleport(body, body.global_transform)
		return


func _acquire(type: String) -> AnimatableBody3D:
	var free: Array = _pool.get(type, [])
	if not free.is_empty():
		return free.pop_back()
	var spec := VehiclesConfig.spec(type)
	var m := VehicleModel.create(spec, true)
	if m.is_empty():
		return null
	var body := AnimatableBody3D.new()
	body.name = "%s_%d" % [type, get_child_count()]
	body.collision_layer = 4
	body.collision_mask = 0
	# Sin sync_to_physics: el cuerpo se mueve a mano en cada paso de física; con sync, Godot lo resincronizaba
	# desde el estado físico viejo y un carro recién aparecido saltaba al origen
	body.sync_to_physics = false
	body.add_child(m.visual)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	var size: Vector3 = m.size
	box.size = Vector3(size.x, size.y * 0.8, size.z)
	shape.shape = box
	shape.position.y = m.base_y + size.y * 0.5
	body.add_child(shape)
	var wheels: Array[Node3D] = []
	for w: Dictionary in m.wheels:
		var n: Node3D = w.node
		n.set_meta("radius", w.radius)
		wheels.push_back(n)
	body.set_meta("wheels", wheels)
	body.set_meta("half_len", size.z * 0.5)
	add_child(body)
	return body


## Salto sin barrido: con sync_to_physics el nodo se resincroniza desde el estado físico, y moverlo solo a él
## haría que el cuerpo se arrastrara desde donde estaba (desde el origen, si es nuevo) empujando lo que encuentre.
func _teleport(body: AnimatableBody3D, xf: Transform3D) -> void:
	body.global_transform = xf
	PhysicsServer3D.body_set_state(body.get_rid(), PhysicsServer3D.BODY_STATE_TRANSFORM, xf)


func _release(car: Dictionary) -> void:
	var body: AnimatableBody3D = car.body
	body.visible = false
	body.process_mode = Node.PROCESS_MODE_DISABLED
	_teleport(body, Transform3D(Basis(), Vector3(0, -1000, 0)))
	if not _pool.has(car.type):
		_pool[car.type] = []
	_pool[car.type].push_back(body)
