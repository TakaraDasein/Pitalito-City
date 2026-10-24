class_name RoadNetwork
extends RefCounted
## Grafo vial de toda la ciudad (map.json): calle más cercana, rutas para el GPS y aristas para el tráfico IA.
## Port de web/src/world/RoadNetwork.js. Las rutas usan AStar2D (nativo, en C++) en vez del A* propio de la web;
## los sentidos únicos (`o`) se conectan en una sola dirección.

const CELL := 40.0

var verts: PackedVector2Array
var roads: Array
var names: PackedStringArray
## adj[i] = [{to, road, len}] solo por vías vehiculares, respetando sentido único.
var adj: Array = []
var astar := AStar2D.new()
var _grid: Dictionary = {} # Vector2i → Array de [a, b, road]


func _init(map: Dictionary) -> void:
	var v: Array = map.verts
	verts.resize(v.size() / 2)
	for i in verts.size():
		verts[i] = Vector2(v[i * 2], v[i * 2 + 1])
	roads = map.roads
	names = PackedStringArray(map.get("names", []))
	adj.resize(verts.size())
	for i in verts.size():
		adj[i] = []
		astar.add_point(i, verts[i])
	for ri in roads.size():
		var r: Dictionary = roads[ri]
		var drivable := is_drivable(r.c)
		var one_way: bool = r.get("o", false)
		var rv: Array = r.v
		for k in rv.size() - 1:
			var a: int = rv[k]
			var b: int = rv[k + 1]
			if a == b:
				continue
			var length := verts[a].distance_to(verts[b])
			if drivable:
				adj[a].push_back({"to": b, "road": ri, "len": length})
				if not one_way:
					adj[b].push_back({"to": a, "road": ri, "len": length})
				astar.connect_points(a, b, not one_way)
			_index([a, b, ri])
	# Los puntos sin aristas no deben servir de llegada
	for i in verts.size():
		if adj[i].is_empty() and astar.get_point_connections(i).is_empty():
			astar.set_point_disabled(i, true)


func _index(seg: Array) -> void:
	var p := verts[seg[0]]
	var q := verts[seg[1]]
	for cx in range(floori(minf(p.x, q.x) / CELL), floori(maxf(p.x, q.x) / CELL) + 1):
		for cz in range(floori(minf(p.y, q.y) / CELL), floori(maxf(p.y, q.y) / CELL) + 1):
			var k := Vector2i(cx, cz)
			if not _grid.has(k):
				_grid[k] = []
			_grid[k].push_back(seg)


## Vías por donde circula el tráfico (velocidad > 0 en la web: ni andenes, ni senderos, ni escaleras).
static func is_drivable(c: String) -> bool:
	return not c in ["pedestrian", "footway", "path", "steps"]


## Segmento más cercano: { a, b, road, d, t, point } o vacío.
func nearest(p: Vector2, max_dist := 60.0, drivable := false) -> Dictionary:
	var best := {}
	var r := ceili(max_dist / CELL)
	var c0 := Vector2i(floori(p.x / CELL), floori(p.y / CELL))
	for dz in range(-r, r + 1):
		for dx in range(-r, r + 1):
			for seg: Array in _grid.get(c0 + Vector2i(dx, dz), []):
				if drivable and not is_drivable(roads[seg[2]].c):
					continue
				var a := verts[seg[0]]
				var b := verts[seg[1]]
				var q := Geometry2D.get_closest_point_to_segment(p, a, b)
				var d := q.distance_to(p)
				if d <= max_dist and (best.is_empty() or d < best.d):
					var length := a.distance_to(b)
					best = {"a": seg[0], "b": seg[1], "road": seg[2], "d": d, "point": q,
						"t": a.distance_to(q) / length if length > 0.0 else 0.0}
	return best


## Nombre y clase de la calle bajo `p`, o vacío.
func street_at(p: Vector2) -> Dictionary:
	var n := nearest(p, 25.0)
	if n.is_empty():
		return {}
	var r: Dictionary = roads[n.road]
	var idx := int(r.get("n", -1))
	return {"name": names[idx] if idx >= 0 and idx < names.size() else "", "class": r.c}


## Ruta por vías vehiculares entre dos puntos del mundo: PackedVector2Array vacío si no hay.
func route(from: Vector2, to: Vector2) -> PackedVector2Array:
	var s := nearest(from, 200.0, true)
	var e := nearest(to, 400.0, true)
	if s.is_empty() or e.is_empty():
		return PackedVector2Array()
	var path := astar.get_point_path(s.a, e.b)
	if path.is_empty():
		path = astar.get_point_path(s.b, e.a)
	if path.is_empty():
		return path
	path.insert(0, s.point)
	path.push_back(e.point)
	return path
