class_name GPS
extends Node3D
## Destino y ruta (port de setWaypoint / #updateRoute de web/src/core/Game.js): ruta por vías vehiculares
## (RoadNetwork.route, AStar2D), cinta morada sobre el relieve, se recorta el tramo andado y se recalcula si el foco
## se desvía más de 35 m. Al llegar a 25 m del destino avisa y se borra.

signal changed
signal message(text: String)

const ARRIVE := 25.0
const DEVIATE := 35.0
const WIDTH := 0.7
const LIFT := 0.2

var focus: Node3D
var waypoint := {}                # { x, z, name? } o vacío
var route := PackedVector2Array()

var _mesh := MeshInstance3D.new()
var _timer := 0.0


func _ready() -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("#b04dff", 0.85)
	mat.emission_enabled = true
	mat.emission = Color("#b04dff")
	mat.emission_energy_multiplier = 0.9
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.no_depth_test = false
	mat.render_priority = 2
	_mesh.material_override = mat
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_mesh)


func set_waypoint(p: Dictionary) -> void:
	waypoint = p
	route = PackedVector2Array()
	if not p.is_empty() and focus:
		route = WorldData.roads.route(_here(), Vector2(p.x, p.z))
		if p.has("name"):
			message.emit("Destino: " + p.name)
		else:
			message.emit("Ruta GPS trazada" if route.size() > 1 else "Destino marcado (sin ruta vehicular)")
	_rebuild()
	changed.emit()


func clear() -> void:
	set_waypoint({})


## Distancia restante de la ruta (m), o −1 sin ruta.
func remaining() -> float:
	if route.size() < 2:
		return -1.0
	var d := 0.0
	for i in range(1, route.size()):
		d += route[i].distance_to(route[i - 1])
	return d


func _here() -> Vector2:
	return Vector2(focus.global_position.x, focus.global_position.z)


func _process(delta: float) -> void:
	if waypoint.is_empty() or focus == null:
		return
	_timer -= delta
	if _timer > 0.0:
		return
	_timer = 0.5
	var here := _here()
	if here.distance_to(Vector2(waypoint.x, waypoint.z)) < ARRIVE:
		message.emit("¡Llegaste a tu destino!")
		clear()
		return
	if route.size() < 2:
		return
	# Recortar el tramo recorrido y recalcular si el foco se desvió
	var best_d := INF
	var best_i := 0
	var best_p := Vector2.ZERO
	for i in route.size() - 1:
		var q := Geometry2D.get_closest_point_to_segment(here, route[i], route[i + 1])
		var d := q.distance_to(here)
		if d < best_d:
			best_d = d
			best_i = i
			best_p = q
	if best_d > DEVIATE:
		route = WorldData.roads.route(here, Vector2(waypoint.x, waypoint.z))
	else:
		var rest := route.slice(best_i + 1)
		rest.insert(0, best_p)
		route = rest
	_rebuild()
	changed.emit()


## Cinta sobre el relieve a lo largo de la ruta (misma idea que el ribbon de la web).
func _rebuild() -> void:
	if route.size() < 2:
		_mesh.mesh = null
		return
	var batch := MeshBatch.new()
	var prev_l := -1
	var prev_r := -1
	for k in route.size():
		var c := route[k]
		var dir := Vector2.ZERO
		if k > 0:
			dir += (c - route[k - 1]).normalized()
		if k < route.size() - 1:
			dir += (route[k + 1] - c).normalized()
		dir = dir.normalized()
		var side := Vector2(-dir.y, dir.x) * WIDTH
		var l := c + side
		var r := c - side
		var il := batch.vertex(Vector3(l.x, WorldData.height(l.x, l.y) + LIFT, l.y), Vector3.UP, Vector2.ZERO)
		var ir := batch.vertex(Vector3(r.x, WorldData.height(r.x, r.y) + LIFT, r.y), Vector3.UP, Vector2.ZERO)
		if prev_l >= 0:
			batch.quad(prev_l, prev_r, ir, il, Vector3.UP)
		prev_l = il
		prev_r = ir
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, batch.arrays())
	_mesh.mesh = mesh
