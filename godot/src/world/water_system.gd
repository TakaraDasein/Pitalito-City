class_name WaterSystem
extends Node3D
## Ríos completos del municipio (map.json: el Guarapas de punta a punta, la Cálamo y los demás cauces), armados una
## vez al arrancar —no por tiles: se ven de lejos como la línea azul del mapa— en tramos de ~50 puntos para que
## Godot descarte los que no están en cámara. Y el agua para la física (Jolt, la física libre de Godot; sin complementos externos): dice dónde hay
## agua y a qué altura, y empuja a los cuerpos que se meten. Los tramos llegan de WaterBuilder por tile.
##  · flotación de Arquímedes por puntos (cuerpos rígidos y vehículos): empuje = ρ·g·volumen sumergido
##  · arrastre del agua (frena) y empuje de la corriente aguas abajo
## El jugador la consulta para nadar (Player._swim).

const RHO := 1000.0                  # kg/m³
const CURRENT := 0.9                 # m/s de la corriente (ESTIMADO, el mismo del shader)
const CELL := 40.0

static var instance: WaterSystem

var _by_tile: Dictionary = {}        # Vector2i → Array de tramos
var _grid: Dictionary = {}           # Vector2i (celda) → Array de tramos
var _bodies: Array[Dictionary] = []  # { body: RigidBody3D, points: [Vector3 locales], volume }


const PIECE := 50


func _ready() -> void:
	instance = self
	var pieces := []
	for w: Dictionary in WorldData.water:
		var p: Array = w.p
		var n := p.size() / 2
		var k := 0
		while k < n - 1:
			var e := mini(n, k + PIECE + 1) # un punto de traslape: los tramos quedan unidos
			pieces.push_back({"p": p.slice(k * 2, e * 2), "w": w.get("w", 5.0)})
			k = e - 1
	var all := []
	for piece: Dictionary in pieces:
		var r := WaterBuilder.build({"water": [piece]}, WorldData)
		var batch: MeshBatch = r.mesh
		if batch.is_empty():
			continue
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, batch.arrays())
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.material_override = MaterialLibrary.get_material("water")
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		all.append_array(r.segs)
	_by_tile[Vector2i.ZERO] = all
	_rebuild_grid()
	if BridgesConfig.ENABLED:
		_build_bridges()


func _rebuild_grid() -> void:
	_grid.clear()
	for segs: Array in _by_tile.values():
		for s: Array in segs:
			var a: Vector3 = s[0]
			var b: Vector3 = s[1]
			var r: float = s[2]
			for cx in range(floori((minf(a.x, b.x) - r) / CELL), floori((maxf(a.x, b.x) + r) / CELL) + 1):
				for cz in range(floori((minf(a.z, b.z) - r) / CELL), floori((maxf(a.z, b.z) + r) / CELL) + 1):
					var k := Vector2i(cx, cz)
					if not _grid.has(k):
						_grid[k] = []
					_grid[k].push_back(s)


var decks: Array = []          # tableros y rampas de los puentes (BridgeBuilder.Out.decks)
var footbridges: Array = []    # puntos medios de las pasarelas
var crossings: Array = []      # cruces vía–río detectados


## Cruces de las vías de OSM con los ríos → puentes; y las pasarelas peatonales de BridgesConfig.
func _build_bridges() -> void:
	var net: RoadNetwork = WorldData.roads
	if net == null:
		return
	for ri in net.roads.size():
		var r: Dictionary = net.roads[ri]
		var rv: Array = r.v
		var name := ""
		var ni := int(r.get("n", -1))
		if ni >= 0 and ni < net.names.size():
			name = net.names[ni]
		for k in rv.size() - 1:
			var a := net.verts[rv[k]]
			var b := net.verts[rv[k + 1]]
			var hit := _river_crossing(a, b)
			if hit.is_empty():
				continue
			var q: Vector2 = hit.point
			if crossings.any(func(c): return c.road == ri and Vector2(c.point).distance_to(q) < 20.0):
				continue
			var d := (b - a).normalized()
			var half: float = float(hit.river_hw) + BridgesConfig.ABUTMENT + BridgesConfig.RAMP
			crossings.push_back({"point": q, "dir": d, "hw": WorldConfig.road_class(r.c).width * 0.5, "river_hw": hit.river_hw,
				"surface": hit.surface, "name": name, "road": ri, "river": hit.river,
				"ground_a": WorldData.height(q.x - d.x * half, q.y - d.y * half) + WorldConfig.ROAD_LIFT,
				"ground_b": WorldData.height(q.x + d.x * half, q.y + d.y * half) + WorldConfig.ROAD_LIFT})
	var foot := []
	for fb: Dictionary in BridgesConfig.FOOTBRIDGES:
		for c: Dictionary in crossings:
			if c.name != fb.near:
				continue
			var at := _along_river(c.river, c.point, float(fb.along) * float(fb.dir))
			if at.is_empty():
				break
			var w := sample(at.point.x, at.point.y)
			if w.is_empty():
				break
			var flow: Vector3 = w.flow
			var across := Vector2(-flow.z, flow.x)
			var half: float = float(c.river_hw) + 2.5
			foot.push_back({"point": at.point, "dir": across, "width": fb.width, "clearance": fb.clearance, "river_hw": c.river_hw,
				"surface": w.surface, "ground_a": WorldData.height(at.point.x - across.x * half, at.point.y - across.y * half),
				"ground_b": WorldData.height(at.point.x + across.x * half, at.point.y + across.y * half)})
			break
	var out := BridgeBuilder.build(crossings, foot)
	decks = out.decks
	footbridges = out.footbridges
	if out.batch.is_empty():
		return
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, out.batch.arrays())
	var mi := MeshInstance3D.new()
	mi.name = "puentes"
	mi.mesh = mesh
	mi.material_override = MaterialLibrary.get_material("bridge")
	add_child(mi)
	var body := StaticBody3D.new()
	body.collision_layer = 1
	for bx: Array in out.boxes:
		var sh := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = bx[1]
		sh.shape = box
		sh.transform = bx[0]
		body.add_child(sh)
	add_child(body)


## Primer cruce del segmento a–b con un río (no con quebradas angostas de menos de 4 m).
func _river_crossing(a: Vector2, b: Vector2) -> Dictionary:
	var seen := {}
	for cx in range(floori(minf(a.x, b.x) / CELL), floori(maxf(a.x, b.x) / CELL) + 1):
		for cz in range(floori(minf(a.y, b.y) / CELL), floori(maxf(a.y, b.y) / CELL) + 1):
			for sg: Array in _grid.get(Vector2i(cx, cz), []):
				if seen.has(sg) or float(sg[2]) < 2.0:
					continue
				seen[sg] = true
				var p: Vector3 = sg[0]
				var q: Vector3 = sg[1]
				var hit = Geometry2D.segment_intersects_segment(a, b, Vector2(p.x, p.z), Vector2(q.x, q.z))
				if hit != null:
					var t := Vector2(p.x, p.z).distance_to(hit) / maxf(Vector2(p.x, p.z).distance_to(Vector2(q.x, q.z)), 0.001)
					return {"point": hit, "river_hw": sg[2], "surface": lerpf(p.y, q.y, t), "river": sg}
	return {}


## Punto a `dist` m por el río desde `from` (+ aguas abajo), siguiendo los tramos del mismo cauce.
func _along_river(start_seg: Array, from: Vector2, dist: float) -> Dictionary:
	var segs: Array = _by_tile[Vector2i.ZERO]
	var i := segs.find(start_seg)
	if i < 0:
		return {}
	var pos := from
	var left := absf(dist)
	var step := 1 if dist > 0.0 else -1
	while left > 0.0 and i >= 0 and i < segs.size():
		var sg: Array = segs[i]
		var target: Vector3 = sg[1] if step > 0 else sg[0]
		var t2 := Vector2(target.x, target.z)
		var dd := pos.distance_to(t2)
		if dd >= left:
			return {"point": pos + (t2 - pos).normalized() * left}
		left -= dd
		pos = t2
		i += step
	return {"point": pos}


## ¿Puede haber un tronco en (x, z)? No en el cauce de un río ni sobre un puente o pasarela. El mapa de dosel
## (Meta/WRI) ve la copa de los árboles de la orilla encima del agua y la toma por un árbol en el río.
## Seguro en hilos: solo lee datos armados en _ready.
func blocks_tree(x: float, z: float) -> bool:
	var w := sample(x, z)
	if not w.is_empty() and float(w.depth) > 0.8:
		return true
	if not is_nan(deck_y(x, z)):
		return true
	for fb: Dictionary in footbridges:
		var a: Vector2 = fb.a
		var b: Vector2 = fb.b
		if Geometry2D.get_closest_point_to_segment(Vector2(x, z), a, b).distance_to(Vector2(x, z)) < 2.5:
			return true
	return false


## Altura del tablero o la rampa de un puente en (x, z), o NAN si no hay puente ahí.
func deck_y(x: float, z: float) -> float:
	var p := Vector2(x, z)
	for dk: Dictionary in decks:
		var a: Vector2 = dk.a
		var b: Vector2 = dk.b
		var ab := b - a
		var t := (p - a).dot(ab) / maxf(ab.length_squared(), 0.001)
		if t < 0.0 or t > 1.0:
			continue
		if (a + ab * t).distance_to(p) > float(dk.hw):
			continue
		return lerpf(dk.y0, dk.y1, t)
	return NAN


## Agua en (x, z): { surface, depth, flow (Vector3 aguas abajo) } o vacío si es tierra.
func sample(x: float, z: float) -> Dictionary:
	var p := Vector2(x, z)
	for s: Array in _grid.get(Vector2i(floori(x / CELL), floori(z / CELL)), []):
		var a: Vector3 = s[0]
		var b: Vector3 = s[1]
		var a2 := Vector2(a.x, a.z)
		var b2 := Vector2(b.x, b.z)
		var q := Geometry2D.get_closest_point_to_segment(p, a2, b2)
		if q.distance_to(p) > float(s[2]):
			continue
		var t := a2.distance_to(q) / maxf(a2.distance_to(b2), 0.001)
		var dir := (b2 - a2).normalized()
		return {"surface": lerpf(a.y, b.y, t), "depth": s[3], "flow": Vector3(dir.x, 0, dir.y)}
	return {}


## Registra un cuerpo para que flote. `points`: puntos locales repartidos en todo el volumen (arriba y abajo: si
## solo hay puntos abajo, al voltearse el empuje queda arriba y flota invertido); cada uno representa una tajada de
## `half_h` m hacia arriba y hacia abajo. `volume`: m³ que desplaza sumergido del todo.
func add_body(body: RigidBody3D, points: Array, volume: float, half_h := 0.25) -> void:
	body.can_sleep = false # dormido, Jolt ignora las fuerzas: flotaría quieto contra la corriente
	_bodies.push_back({"body": body, "points": points, "volume": volume, "half_h": half_h})


func _physics_process(delta: float) -> void:
	var g: float = ProjectSettings.get_setting("physics/3d/default_gravity")
	_bodies = _bodies.filter(func(e): return is_instance_valid(e.body))
	for e: Dictionary in _bodies:
		var body: RigidBody3D = e.body
		var pts: Array = e.points
		var per_point: float = float(e.volume) / pts.size()
		var wet := 0
		var deep_pts := 0
		for lp: Vector3 in pts:
			var wp: Vector3 = body.global_transform * lp
			var w := sample(wp.x, wp.z)
			if w.is_empty():
				continue
			if float(w.depth) > 0.8:
				deep_pts += 1
			var hh: float = e.half_h
			var sub := clampf((float(w.surface) - wp.y + hh) / (2.0 * hh), 0.0, 1.0) # fracción sumergida de la tajada
			if sub <= 0.0:
				continue
			wet += 1
			var offset := wp - body.global_position
			body.apply_force(Vector3.UP * RHO * g * per_point * sub, offset)
			# arrastre relativo al agua que corre
			var vel := body.linear_velocity + body.angular_velocity.cross(offset)
			var rel: Vector3 = vel - Vector3(w.flow) * CURRENT
			# arrastre: la velocidad relativa al agua se iguala en ~0,5 s con el cuerpo medio hundido
			body.apply_force(-rel * body.mass * 2.0 / pts.size() * minf(1.0, sub * 2.0), offset)
		if wet > 0:
			body.angular_velocity *= 1.0 - minf(1.0, 0.8 * delta)
		# Con el cuerpo entero en el cauce hondo, el fondo es el del río y no el relieve (que marca el cauce a la
		# altura del agua); si una parte toca la orilla, la orilla se pisa (si no, se hundía en ella)
		body.set_collision_mask_value(5, deep_pts < pts.size())
