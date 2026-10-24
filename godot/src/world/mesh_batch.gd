class_name MeshBatch
extends RefCounted
## Acumula triángulos en arreglos planos (equivale a web/src/world/GeometryBatch.js). Es seguro en hilos:
## no toca el RenderingServer. El hilo principal convierte arrays() en ArrayMesh y faces en colisión.

var verts := PackedVector3Array()
var normals := PackedVector3Array()
var uvs := PackedVector2Array()
var colors := PackedColorArray()
var indices := PackedInt32Array()
## Triángulos sueltos para ConcavePolygonShape3D (solo si collect_faces).
var faces := PackedVector3Array()
var collect_faces := false


func _init(with_faces := false) -> void:
	collect_faces = with_faces


func is_empty() -> bool:
	return indices.is_empty()


func vertex(p: Vector3, n: Vector3, uv: Vector2, c := Color.WHITE) -> int:
	verts.push_back(p)
	normals.push_back(n)
	uvs.push_back(uv)
	colors.push_back(c)
	return verts.size() - 1


## Agrega el triángulo con la cara frontal hacia `facing`. Godot toma como frontal el orden horario,
## distinto de three.js: decidirlo por la normal evita tener que pensar el orden en cada constructor.
func tri(a: int, b: int, c: int, facing: Vector3) -> void:
	var cross := (verts[b] - verts[a]).cross(verts[c] - verts[a])
	if cross.dot(facing) > 0.0:
		indices.append_array([a, c, b])
	else:
		indices.append_array([a, b, c])
	if collect_faces:
		faces.append_array([verts[a], verts[b], verts[c]])


func quad(a: int, b: int, c: int, d: int, facing: Vector3) -> void:
	tri(a, b, c, facing)
	tri(a, c, d, facing)


func arrays() -> Array:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = normals
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_COLOR] = colors
	arr[Mesh.ARRAY_INDEX] = indices
	return arr
