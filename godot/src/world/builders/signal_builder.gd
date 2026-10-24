class_name SignalBuilder
## Semáforos: posición REAL (nodos OSM highway=traffic_signals, en el cruce). Poste amarillo con brazo y caja de
## tres luces, según las fotos del centro (may 2025). ESTIMADO: la esquina del poste (la libre más cercana al nodo,
## fuera de la calzada) y el ciclo de luces (no hay datos). Port de web/src/world/builders/TrafficSignalBuilder.js.
## Las luces se encienden en GPU (signal_light.gdshader) con el mismo reloj y desfase que usa TrafficLights.

const LENS_Y := [0.3, 0.0, -0.3] # rojo, amarillo, verde (desde arriba)


## Cruces del tile con su desfase y la esquina del poste. Determinista: misma entrada, mismo resultado.
static func spots(tile: Dictionary) -> Array:
	var sig: Array = tile.get("signals", [])
	if sig.is_empty():
		return []
	var segs := []
	for r: Dictionary in tile.get("roads", []):
		var hw: float = WorldConfig.road_class(r.c).width * 0.5
		var p: Array = r.p
		for i in range(0, p.size() - 2, 2):
			segs.push_back([Vector2(p[i], p[i + 1]), Vector2(p[i + 2], p[i + 3]), hw])
	var out := []
	for k in range(0, sig.size() - 1, 2):
		var node := Vector2(sig[k], sig[k + 1])
		var best = null
		for d: float in [5.5, 7.0, 8.5]:
			for a in 16:
				var ang := TAU * a / 16.0 + 0.2
				var q := node + Vector2(cos(ang), sin(ang)) * d
				if _free(q, segs):
					best = q
					break
			if best != null:
				break
		if best == null:
			continue
		var rot := atan2(-(node.x - best.x), -(node.y - best.y)) # brazo (−Z) hacia el cruce
		out.push_back({
			"pos": best, "rot": rot, "cross": node,
			"phase": 0 if absf(cos(rot)) >= absf(sin(rot)) else 1,
			"offset": TrafficLights.offset_of(node),
		})
	return out


static func _free(q: Vector2, segs: Array) -> bool:
	for s: Array in segs:
		if Geometry2D.get_closest_point_to_segment(q, s[0], s[1]).distance_to(q) <= s[2] + 0.8:
			return false
	return true


## Transformaciones para los MultiMesh: postes y lentes (dos caras por luz) con su dato de instancia.
static func build(list: Array, world: Node) -> Dictionary:
	var poles := []
	var lenses := [] # [Transform3D, Color(desfase, fase, luz, 0)]
	for s: Dictionary in list:
		var p: Vector2 = s.pos
		var xf := Transform3D(Basis(Vector3.UP, s.rot), Vector3(p.x, world.height(p.x, p.y), p.y))
		poles.push_back(xf)
		for li in 3:
			for face in [[PI, -0.155], [0.0, 0.155]]:
				var local := Transform3D(Basis(Vector3.UP, face[0]), Vector3(0, 4.85 + LENS_Y[li], -3.1 + face[1]))
				lenses.push_back([xf * local, Color(s.offset, s.phase, li, 0)])
	return {"poles": poles, "lenses": lenses}


## Malla del poste + brazo + caja, con colores de vértice. Se crea una vez.
static func make_pole_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var yellow := Color("#e9b40c")
	var pole := CylinderMesh.new()
	pole.top_radius = 0.08
	pole.bottom_radius = 0.11
	pole.height = 5.6
	pole.radial_segments = 8
	TreeBuilder._append(st, pole, Transform3D(Basis(), Vector3(0, 2.8, 0)), yellow)
	var arm := CylinderMesh.new()
	arm.top_radius = 0.05
	arm.bottom_radius = 0.05
	arm.height = 3.2
	arm.radial_segments = 6
	TreeBuilder._append(st, arm, Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0, 5.4, -1.6)), yellow)
	var box := BoxMesh.new()
	box.size = Vector3(0.34, 0.95, 0.3)
	TreeBuilder._append(st, box, Transform3D(Basis(), Vector3(0, 4.85, -3.1)), Color("#141414"))
	return st.commit()


static func make_lens_mesh() -> Mesh:
	var q := QuadMesh.new()
	q.size = Vector2(0.2, 0.2)
	return q
