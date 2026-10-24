class_name RoadBuilder
## Calzadas sobre el relieve real: eje de OSM (posición real), ancho ESTIMADO por clase (WorldConfig.ROAD_CLASSES).
## Una cinta por vía, agrupada por superficie (asfalto, adoquín, tierra). Constructor puro, corre en hilos.

const SURFACES := ["asphalt", "brick", "dirt"]


static func build(tile: Dictionary, world: Node) -> Dictionary:
	var out := {}
	for s: String in SURFACES:
		out[s] = MeshBatch.new()
	var roads: Array = tile.get("roads", []).duplicate()
	roads.sort_custom(func(a, b): return WorldConfig.road_class(a.c).rank < WorldConfig.road_class(b.c).rank)
	for r: Dictionary in roads:
		var spec := WorldConfig.road_class(r.c)
		var surface: String = r.get("s", spec.get("surface", "asphalt")) # r.s: superficie real marcada en el pipeline
		if not out.has(surface):
			surface = "asphalt"
		# Las vías de más rango quedan un poco arriba: evita parpadeo en los cruces
		var lift: float = WorldConfig.ROAD_LIFT + spec.rank * 0.008
		_ribbon(out[surface], PackedFloat32Array(r.p), spec.width * 0.5, lift, world)
	return out


static func _ribbon(batch: MeshBatch, p: PackedFloat32Array, hw: float, lift: float, world: Node) -> void:
	var n := p.size() / 2
	if n < 2:
		return
	var dist := 0.0
	var prev_l := -1
	var prev_r := -1
	for k in n:
		var c := Vector2(p[k * 2], p[k * 2 + 1])
		# Dirección promedio de los segmentos vecinos (unión en inglete sencilla)
		var dir := Vector2.ZERO
		if k > 0:
			dir += (c - Vector2(p[k * 2 - 2], p[k * 2 - 1])).normalized()
		if k < n - 1:
			dir += (Vector2(p[k * 2 + 2], p[k * 2 + 3]) - c).normalized()
		dir = dir.normalized()
		if k > 0:
			dist += c.distance_to(Vector2(p[k * 2 - 2], p[k * 2 - 1]))
		var side := Vector2(-dir.y, dir.x) * hw
		var l := c + side
		var r := c - side
		# UV en metros; cada material fija su escala (asfalto 1/12, adoquín 1/4, como la web)
		var il := batch.vertex(Vector3(l.x, world.height(l.x, l.y) + lift, l.y), Vector3.UP, Vector2(0.0, dist))
		var ir := batch.vertex(Vector3(r.x, world.height(r.x, r.y) + lift, r.y), Vector3.UP, Vector2(hw * 2.0, dist))
		if prev_l >= 0:
			batch.quad(prev_l, prev_r, ir, il, Vector3.UP)
		prev_l = il
		prev_r = ir
