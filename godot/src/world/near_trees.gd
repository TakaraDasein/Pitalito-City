class_name NearTrees
extends Node3D
## Árboles de cerca con modelo (Quaternius, Stylized Nature MegaKit, CC0; ver web/assets/models/CREDITS.md).
## La distancia de visibilidad de Godot se aplica a un MultiMesh entero (un tile de 250 m), no a cada árbol: por
## eso este nodo rearma cada tanto un MultiMesh con los frondosos y samanes a menos de NEAR_TREE_RADIUS del foco, y
## publica ese centro en la global de shader `tree_near`; el árbol procedural (tree.gdshader) se esconde dentro del
## mismo círculo. Mismo centro para los dos: nunca se ven ambos ni queda un hueco. Las palmas siguen procedurales
## (la versión gratuita del kit no trae palmas).

const MODELS := ["CommonTree_3", "CommonTree_4", "CommonTree_5"]
const KINDS := ["broadleaf", "saman"]

var world: WorldStreamer

## Por modelo: { mesh, norm: Transform3D (lleva el modelo a altura 1 y radio de copa 1), mmi }
var _models: Array[Dictionary] = []
var _center := Vector3(INF, 0, INF)
var _timer := 0.0


func _ready() -> void:
	var leaves := ShaderMaterial.new()
	leaves.shader = preload("res://src/world/tree_leaves.gdshader")
	for name: String in MODELS:
		var scene: PackedScene = load("res://assets/models/nature/%s.gltf" % name)
		if scene == null:
			continue
		var root := scene.instantiate()
		var mi := _find_mesh(root)
		if mi == null:
			root.free()
			continue
		var mesh := mi.mesh.duplicate() as ArrayMesh
		root.free()
		var aabb := mesh.get_aabb()
		var height := aabb.end.y
		var crown := maxf(maxf(-aabb.position.x, aabb.end.x), maxf(-aabb.position.z, aabb.end.z))
		for s in mesh.get_surface_count():
			var m := mesh.surface_get_material(s) as StandardMaterial3D
			if m and m.resource_name.begins_with("Leaves"):
				var lm := leaves.duplicate() as ShaderMaterial
				lm.set_shader_parameter("leaf_tex", m.albedo_texture)
				lm.set_shader_parameter("model_height", height)
				mesh.surface_set_material(s, lm)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = mesh
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		add_child(mmi)
		_models.push_back({"norm": Transform3D(Basis().scaled(Vector3(1.0 / crown, 1.0 / height, 1.0 / crown)), Vector3.ZERO), "mmi": mmi})
	RenderingServer.global_shader_parameter_set("tree_near", Vector4(0, 0, 0, 0)) # w = radio (0: apagado)


func _find_mesh(n: Node) -> MeshInstance3D:
	if n is MeshInstance3D:
		return n
	for c in n.get_children():
		var r := _find_mesh(c)
		if r:
			return r
	return null


func _process(delta: float) -> void:
	if _models.is_empty() or world == null or world.focus == null:
		return
	_timer -= delta
	var p := world.focus.global_position
	# Se rearma al moverse (o cada tanto, por los tiles que van llegando)
	if _timer > 0.0 and Vector2(p.x - _center.x, p.z - _center.z).length() < WorldConfig.NEAR_TREE_STEP:
		return
	_timer = 1.0
	_center = p
	var r := WorldConfig.NEAR_TREE_RADIUS
	var by_model: Array = []
	for i in _models.size():
		by_model.push_back([])
	for item: Array in world.trees_within(Vector2(p.x, p.z), r, KINDS):
		var xf: Transform3D = item[0]
		var h := absi(int(xf.origin.x * 3.0) * 17 + int(xf.origin.z * 3.0))
		by_model[h % _models.size()].push_back(item)
	for i in _models.size():
		var mm: MultiMesh = _models[i].mmi.multimesh
		var norm: Transform3D = _models[i].norm
		var items: Array = by_model[i]
		mm.instance_count = items.size()
		for k in items.size():
			mm.set_instance_transform(k, items[k][0] * norm)
			mm.set_instance_color(k, items[k][1])
	RenderingServer.global_shader_parameter_set("tree_near", Vector4(p.x, 0, p.z, r))
