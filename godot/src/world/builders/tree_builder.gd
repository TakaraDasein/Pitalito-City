class_name TreeBuilder
## Árboles reales (Meta/WRI Canopy Height): posición, altura y radio de copa medidos.
## La especie no está en los datos: la forma se elige por la proporción de la copa, con la misma regla de la web
## (VegetationBuilder.js). Devuelve transformaciones para MultiMesh, una lista por forma.

const KINDS := ["broadleaf", "saman", "palm"]


static func kind_of(h: float, crown: float) -> String:
	if h >= 8.0 and crown / h < 0.22:
		return "palm"
	if crown / h > 0.55 and h >= 6.0:
		return "saman"
	return "broadleaf"


static func build(tile: Dictionary, world: Node) -> Dictionary:
	var out := {}
	for k: String in KINDS:
		out[k] = []
	var t: Array = tile.get("trees", [])
	for i in range(0, t.size() - 3, 4):
		var x: float = t[i]
		var z: float = t[i + 1]
		var h: float = t[i + 2]
		var crown: float = t[i + 3]
		if WaterSystem.instance and WaterSystem.instance.blocks_tree(x, z):
			continue # tronco en el río o sobre un puente: es la copa de un árbol de la orilla vista desde arriba
		var kind := kind_of(h, crown)
		if kind == "palm":
			crown = maxf(crown, h * 0.28)
		# Giro pseudoaleatorio estable por posición: el mismo árbol siempre mira igual
		var yaw := fmod(absf(x * 12.9898 + z * 78.233), TAU)
		var basis := Basis(Vector3.UP, yaw).scaled(Vector3(crown, h, crown))
		out[kind].push_back(Transform3D(basis, Vector3(x, world.height(x, z) - 0.2, z)))
	return out


## Mallas normalizadas (altura 1, radio de copa 1), se crean una vez en el hilo principal. Mismas formas que la web
## (VegetationBuilder.js). Alfa del color de vértice: 1 = follaje (se mueve con el viento), 0 = madera.
static func make_meshes() -> Dictionary:
	var bark := Color("#5a4330", 0.0)
	var broadleaf := _start()
	_trunk(broadleaf, 0.05, 0.5, bark)
	for b: Array in [[0.0, 0.68, 0.0, 0.62, 0.3], [0.45, 0.6, 0.2, 0.45, 0.24], [-0.4, 0.62, -0.2, 0.48, 0.25], [0.1, 0.8, -0.3, 0.4, 0.2]]:
		_crown(broadleaf, b, Color("#4f8032"))
	var saman := _start()
	_trunk(saman, 0.07, 0.55, bark)
	for a: float in [0.0, 2.1, 4.2]: # ramas abiertas en sombrilla bajo la copa
		var br := CylinderMesh.new()
		br.top_radius = 0.015
		br.bottom_radius = 0.025
		br.height = 0.45
		br.radial_segments = 4
		br.rings = 1
		var basis := Basis(Vector3.UP, a) * Basis(Vector3.BACK, 0.9)
		_append(saman, br, Transform3D(basis, Vector3(cos(a) * 0.15, 0.62, -sin(a) * 0.15)), bark)
	for b: Array in [[0.0, 0.78, 0.0, 0.95, 0.3], [0.45, 0.72, 0.35, 0.6, 0.26], [-0.45, 0.72, -0.3, 0.62, 0.26], [0.3, 0.88, -0.4, 0.5, 0.22], [-0.3, 0.86, 0.45, 0.5, 0.22]]:
		_crown(saman, b, Color("#47782c"))
	var palm := _start()
	_trunk(palm, 0.035, 0.9, Color("#8a7a62", 0.0))
	for i in 9:
		_frond(palm, TAU * i / 9.0, Color("#4f8a35"))
	return {"broadleaf": broadleaf.commit(), "saman": saman.commit(), "palm": palm.commit()}


static func _start() -> SurfaceTool:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	return st


static func _trunk(st: SurfaceTool, r: float, h: float, bark: Color) -> void:
	var trunk := CylinderMesh.new()
	trunk.top_radius = r * 0.7
	trunk.bottom_radius = r
	trunk.height = h
	trunk.radial_segments = 6
	trunk.rings = 1
	_append(st, trunk, Transform3D(Basis(), Vector3(0, h * 0.5, 0)), bark)


## Copa: esfera con el borde abollado (ruido por dirección, así los vértices compartidos no se separan) y oscurecida
## por debajo y hacia adentro, como la sombra propia del follaje.
static func _crown(st: SurfaceTool, b: Array, leaf: Color) -> void:
	var s := SphereMesh.new()
	s.radial_segments = 10
	s.rings = 6
	var arr := s.get_mesh_arrays()
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var n: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var center := Vector3(b[0], b[1], b[2])
	var scale := Vector3(b[3], b[4], b[3]) * 2.0
	for i in idx:
		var d := n[i]
		var bump := 1.0 + 0.22 * (_hash(d + center) - 0.5)
		var shade := 0.62 + 0.38 * (d.y * 0.5 + 0.5)
		var c := leaf * shade * (0.92 + 0.16 * _hash(d * 3.1 + center))
		c.a = 1.0
		st.set_color(c)
		st.set_normal((d * Vector3(1.0 / scale.x, 1.0 / scale.y, 1.0 / scale.z)).normalized())
		st.add_vertex(center + v[i] * bump * scale)


## Hoja de palma: una tira que se angosta y cuelga en parábola, como en la web.
static func _frond(st: SurfaceTool, yaw: float, leaf: Color) -> void:
	var rot := Basis(Vector3.UP, yaw)
	var seg := 4
	var pts: Array[Vector3] = []
	for k in seg + 1:
		var t := float(k) / seg
		var w := 0.11 * (1.0 - t * 0.6)
		pts.push_back(rot * Vector3(-w, 0.9 - 0.35 * t * t, t))
		pts.push_back(rot * Vector3(w, 0.9 - 0.35 * t * t, t))
	for k in seg:
		var a := pts[k * 2]
		var b := pts[k * 2 + 1]
		var c := pts[k * 2 + 2]
		var d := pts[k * 2 + 3]
		var nrm := (c - a).cross(b - a).normalized()
		if nrm.y < 0.0:
			nrm = -nrm
		var col := leaf * (0.85 + 0.15 * float(k) / seg)
		col.a = 1.0
		for p: Vector3 in [a, b, c, b, d, c]:
			st.set_color(col)
			st.set_normal(nrm)
			st.add_vertex(p)


static func _hash(p: Vector3) -> float:
	return fposmod(sin(p.dot(Vector3(12.9898, 78.233, 37.719))) * 43758.5453, 1.0)


static func _append(st: SurfaceTool, mesh: PrimitiveMesh, xf: Transform3D, color: Color) -> void:
	var arr := mesh.get_mesh_arrays()
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var n: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	for i in idx:
		st.set_color(color)
		st.set_normal((xf.basis * n[i]).normalized())
		st.add_vertex(xf * v[i])
