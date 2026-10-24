class_name WorldStreamer
extends Node3D
## Transmite los tiles de 250 m alrededor del foco (equivale a web/src/world/WorldStreamer.js).
## Hilos (WorkerThreadPool): leer el JSON y armar la geometría con los constructores puros.
## Hilo principal: crear ArrayMesh, colisión y nodos, a lo sumo TILES_PER_FRAME por frame.
## Para sumar una capa nueva (señales, postes, peatones…): un constructor en builders/ y una línea en _instantiate.

var focus: Node3D

var _tiles: Dictionary = {}    # Vector2i → Node3D
var _pending: Dictionary = {}  # Vector2i → id de tarea
var _done: Array = []          # [key, Dictionary de resultados]
var _mutex := Mutex.new()
var _tree_meshes: Dictionary
var _pole_mesh: Mesh
var _lens_mesh: Mesh


func _ready() -> void:
	_tree_meshes = TreeBuilder.make_meshes()
	_pole_mesh = SignalBuilder.make_pole_mesh()
	_lens_mesh = SignalBuilder.make_lens_mesh()


func _process(_delta: float) -> void:
	if focus == null:
		return
	var center := WorldData.tile_key(focus.global_position.x, focus.global_position.z)
	var r := WorldConfig.STREAM_RADIUS
	# Pide primero los tiles más cercanos
	var wanted: Array[Vector2i] = []
	for dz in range(-r, r + 1):
		for dx in range(-r, r + 1):
			var key := center + Vector2i(dx, dz)
			if WorldData.tiles.has(key) and not _tiles.has(key) and not _pending.has(key):
				wanted.push_back(key)
	wanted.sort_custom(func(a, b): return (a - center).length_squared() < (b - center).length_squared())
	for key in wanted:
		_pending[key] = WorkerThreadPool.add_task(_build_task.bind(key))

	for key: Vector2i in _tiles.keys():
		if absi(key.x - center.x) > r + 1 or absi(key.y - center.y) > r + 1:
			_tiles[key].queue_free()
			_tiles.erase(key)
			EventBus.tile_unloaded.emit(key)

	_mutex.lock()
	var take := _done.slice(0, WorldConfig.TILES_PER_FRAME)
	_done = _done.slice(WorldConfig.TILES_PER_FRAME)
	_mutex.unlock()
	for item: Array in take:
		WorkerThreadPool.wait_for_task_completion(_pending[item[0]])
		_pending.erase(item[0])
		_instantiate(item[0], item[1])


## Carga síncrona de los tiles inmediatos (arranque o teletransporte), antes de soltar al jugador.
func warm_up(pos: Vector3) -> void:
	var center := WorldData.tile_key(pos.x, pos.z)
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			var key := center + Vector2i(dx, dz)
			if WorldData.tiles.has(key) and not _tiles.has(key):
				_instantiate(key, _build(key))


func _build_task(key: Vector2i) -> void:
	var result := _build(key)
	_mutex.lock()
	_done.push_back([key, result])
	_mutex.unlock()


func _build(key: Vector2i) -> Dictionary:
	var tile = JSON.parse_string(FileAccess.get_file_as_string(WorldData.tile_path(key)))
	if tile == null:
		return {}
	var spots := SignalBuilder.spots(tile)
	return {
		"buildings": BuildingBuilder.build(tile, WorldData),
		"roads": RoadBuilder.build(tile, WorldData),
		"trees": TreeBuilder.build(tile, WorldData),
		"spots": spots,
		"signals": SignalBuilder.build(spots, WorldData),
	}


func _instantiate(key: Vector2i, r: Dictionary) -> void:
	if _tiles.has(key):
		return
	var root := Node3D.new()
	root.name = "tile_%d_%d" % [key.x, key.y]
	add_child(root)
	_tiles[key] = root
	if r.is_empty():
		return

	var roads: Dictionary = r.roads
	for surface: String in roads:
		_add_mesh(root, roads[surface], MaterialLibrary.get_material(surface), 0.0, false)

	# Edificios: un MeshInstance por material (5 draw calls por tile, como la web) y una sola colisión
	var faces := PackedVector3Array()
	var buildings: Dictionary = r.buildings
	for mat: String in buildings:
		var batch: MeshBatch = buildings[mat]
		var mi := _add_mesh(root, batch, MaterialLibrary.get_material(mat), WorldConfig.TILE_VISIBILITY, true)
		if mi:
			mi.name = "edificios_" + mat # DetailStreamer las esconde cuando el tile tiene edificios armados
		faces.append_array(batch.faces)
	if not faces.is_empty():
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var concave := ConcavePolygonShape3D.new()
		concave.backface_collision = true # paredes y techos se tocan por los dos lados (ver detail_streamer)
		concave.set_faces(faces)
		shape.shape = concave
		body.add_child(shape)
		root.add_child(body)

	var signals: Dictionary = r.signals
	if not signals.poles.is_empty():
		_multimesh(root, _pole_mesh, signals.poles.map(func(x): return [x, Color()]), "signal_pole", true)
		_multimesh(root, _lens_mesh, signals.lenses, "signal_lens", false)
		# Colisión del poste: un cilindro delgado por semáforo
		var body := StaticBody3D.new()
		for xf: Transform3D in signals.poles:
			var shape := CollisionShape3D.new()
			var cyl := CylinderShape3D.new()
			cyl.radius = 0.2
			cyl.height = 5.6
			shape.shape = cyl
			shape.position = xf.origin + Vector3.UP * 2.8
			body.add_child(shape)
		root.add_child(body)
		EventBus.signals_loaded.emit(key, r.spots)

	var trees: Dictionary = r.trees
	for kind: String in trees:
		var xforms: Array = trees[kind]
		if xforms.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _tree_meshes[kind]
		mm.instance_count = xforms.size()
		for i in xforms.size():
			mm.set_instance_transform(i, xforms[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = MaterialLibrary.get_material("tree")
		mmi.visibility_range_end = WorldConfig.TILE_VISIBILITY
		root.add_child(mmi)
	EventBus.tile_loaded.emit(key)


## MultiMesh con dato por instancia (Color en INSTANCE_CUSTOM): items = [[Transform3D, Color], …].
func _multimesh(root: Node3D, mesh: Mesh, items: Array, mat: String, shadows: bool) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = mesh
	mm.instance_count = items.size()
	for i in items.size():
		mm.set_instance_transform(i, items[i][0])
		mm.set_instance_custom_data(i, items[i][1])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = MaterialLibrary.get_material(mat)
	mmi.visibility_range_end = WorldConfig.TILE_VISIBILITY
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mmi)


func tile_node(key: Vector2i) -> Node3D:
	return _tiles.get(key)


func _add_mesh(root: Node3D, batch: MeshBatch, mat: Material, range_end: float, shadows: bool) -> MeshInstance3D:
	if batch.is_empty():
		return null
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, batch.arrays())
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.visibility_range_end = range_end
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
	return mi


func _exit_tree() -> void:
	for id: int in _pending.values():
		WorkerThreadPool.wait_for_task_completion(id)
