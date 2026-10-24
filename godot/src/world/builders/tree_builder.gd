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


## Mallas normalizadas (altura 1, radio de copa 1), se crean una vez en el hilo principal.
static func make_meshes() -> Dictionary:
	var bark := Color("#5a4330")
	return {
		"broadleaf": _tree([[0.0, 0.68, 0.0, 0.62, 0.3], [0.45, 0.6, 0.2, 0.45, 0.24], [-0.4, 0.62, -0.2, 0.48, 0.25]], 0.05, 0.5, bark, Color("#4f8032")),
		"saman": _tree([[0.0, 0.78, 0.0, 0.95, 0.3], [0.45, 0.72, 0.35, 0.6, 0.26], [-0.45, 0.72, -0.3, 0.62, 0.26]], 0.07, 0.6, bark, Color("#47782c")),
		"palm": _tree([[0.0, 0.92, 0.0, 0.9, 0.12]], 0.035, 0.92, Color("#8a7a62"), Color("#4f8a35")),
	}


static func _tree(blobs: Array, trunk_r: float, trunk_h: float, bark: Color, leaf: Color) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var trunk := CylinderMesh.new()
	trunk.top_radius = trunk_r * 0.7
	trunk.bottom_radius = trunk_r
	trunk.height = trunk_h
	trunk.radial_segments = 6
	trunk.rings = 1
	_append(st, trunk, Transform3D(Basis(), Vector3(0, trunk_h * 0.5, 0)), bark)
	for b: Array in blobs:
		var s := SphereMesh.new()
		s.radial_segments = 8
		s.rings = 5
		_append(st, s, Transform3D(Basis().scaled(Vector3(b[3], b[4], b[3]) * 2.0), Vector3(b[0], b[1], b[2])), leaf)
	return st.commit()


static func _append(st: SurfaceTool, mesh: PrimitiveMesh, xf: Transform3D, color: Color) -> void:
	var arr := mesh.get_mesh_arrays()
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var n: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	for i in idx:
		st.set_color(color)
		st.set_normal((xf.basis * n[i]).normalized())
		st.add_vertex(xf * v[i])
