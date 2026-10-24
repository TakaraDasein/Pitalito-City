class_name TerrainStreamer
extends Node3D
## Relieve en bloques de 1 km con dos niveles: el lejano (cada 100 m) cubre todo el valle desde el arranque;
## el cercano (25 m, con colisión) se construye en hilos alrededor del foco y oculta al lejano de su bloque.

var focus: Node3D
## Desplazamiento solo visual del relieve: con suelo satelital queda debajo de la imagen (la colisión no se mueve).
var visual_offset := 0.0

var _far: Dictionary = {}     # Vector2i → MeshInstance3D
var _near: Dictionary = {}    # Vector2i → Node3D (malla + cuerpo estático)
var _pending: Dictionary = {} # Vector2i → id de tarea
var _done: Array = []         # [key, MeshBatch] listos para instanciar
var _mutex := Mutex.new()


## true cuando el relieve lejano de todo el valle ya está en escena (lo espera la pantalla de carga).
var coarse_ready := false
var _coarse_task := -1
var _coarse: Array = []   # MeshBatch por bloque (lo llena el grupo de hilos)
var _coarse_keys: Array[Vector2i] = []


func _ready() -> void:
	visual_offset = -4.0 # el satélite (ImageryGround) cubre el valle; el relieve queda de respaldo debajo
	if not WorldData.has_terrain():
		coarse_ready = true
		return
	# El relieve lejano (576 bloques) se arma en hilos: la pantalla de carga sigue animada mientras tanto
	var count := TerrainBuilder.chunk_count(WorldData)
	for cz in count:
		for cx in count:
			_coarse_keys.push_back(Vector2i(cx, cz))
	_coarse.resize(_coarse_keys.size())
	_coarse_task = WorkerThreadPool.add_group_task(func(i: int):
		_coarse[i] = TerrainBuilder.build(_coarse_keys[i].x, _coarse_keys[i].y, WorldConfig.TERRAIN_COARSE_STEP, WorldData),
		_coarse_keys.size())


func _finish_coarse() -> void:
	WorkerThreadPool.wait_for_group_task_completion(_coarse_task)
	_coarse_task = -1
	for i in _coarse.size():
		var batch: MeshBatch = _coarse[i]
		if batch.is_empty():
			continue
		var mi := _mesh_instance(batch)
		mi.visibility_range_end = WorldConfig.TERRAIN_FAR_RANGE
		add_child(mi)
		_far[_coarse_keys[i]] = mi
	_coarse.clear()
	coarse_ready = true


## Bloquea hasta tener el relieve con colisión bajo `pos`: el jugador no debe aparecer sobre el vacío.
func warm_up(pos: Vector3) -> void:
	var key := TerrainBuilder.chunk_of(pos.x, pos.z, WorldData)
	_add_near(key, TerrainBuilder.build(key.x, key.y, 1, WorldData))


func _process(_delta: float) -> void:
	if _coarse_task >= 0 and WorkerThreadPool.is_group_task_completed(_coarse_task):
		_finish_coarse()
	if focus == null or not WorldData.has_terrain() or not coarse_ready:
		return
	var center := TerrainBuilder.chunk_of(focus.global_position.x, focus.global_position.z, WorldData)
	var r := int(ceil(WorldConfig.TERRAIN_NEAR_RANGE / (WorldConfig.TERRAIN_CHUNK_CELLS * WorldData.terrain_cell)))
	for dz in range(-r, r + 1):
		for dx in range(-r, r + 1):
			var key := center + Vector2i(dx, dz)
			if _far.has(key) and not _near.has(key) and not _pending.has(key):
				_pending[key] = WorkerThreadPool.add_task(_build_task.bind(key))
	for key: Vector2i in _near.keys():
		if absi(key.x - center.x) > r + 1 or absi(key.y - center.y) > r + 1:
			_near[key].queue_free()
			_near.erase(key)
			_far[key].visible = true
	_mutex.lock()
	var ready := _done
	_done = []
	_mutex.unlock()
	for item: Array in ready:
		WorkerThreadPool.wait_for_task_completion(_pending[item[0]])
		_pending.erase(item[0])
		_add_near(item[0], item[1])
	_update_collision(center)


func _build_task(key: Vector2i) -> void:
	var batch := TerrainBuilder.build(key.x, key.y, 1, WorldData)
	_mutex.lock()
	_done.push_back([key, batch])
	_mutex.unlock()


func _add_near(key: Vector2i, batch: MeshBatch) -> void:
	if _near.has(key) or batch.is_empty():
		return
	var root := Node3D.new()
	root.name = "terreno_%d_%d" % [key.x, key.y]
	root.add_child(_mesh_instance(batch))
	var body := StaticBody3D.new()
	body.collision_layer = 16 # capa "relieve": el agua la deja de lado (ver Player._swim)
	var shape := CollisionShape3D.new()
	var concave := ConcavePolygonShape3D.new()
	concave.set_faces(batch.faces)
	shape.shape = concave
	body.add_child(shape)
	root.add_child(body)
	add_child(root)
	_near[key] = root
	if _far.has(key):
		_far[key].visible = false


## Solo los bloques vecinos del foco tienen la colisión activa: el resto pesa en memoria pero no en la física.
func _update_collision(center: Vector2i) -> void:
	var cr := WorldConfig.TERRAIN_COLLISION_RADIUS
	for key: Vector2i in _near:
		var on := absi(key.x - center.x) <= cr and absi(key.y - center.y) <= cr
		var shape: CollisionShape3D = _near[key].get_child(1).get_child(0)
		if shape.disabled == on:
			shape.set_deferred("disabled", not on)


func _mesh_instance(batch: MeshBatch) -> MeshInstance3D:
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, batch.arrays())
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = MaterialLibrary.get_material("terrain")
	mi.position.y = visual_offset
	return mi


func _exit_tree() -> void:
	if _coarse_task >= 0:
		WorkerThreadPool.wait_for_group_task_completion(_coarse_task)
	for id: int in _pending.values():
		WorkerThreadPool.wait_for_task_completion(id)
