class_name DetailStreamer
extends Node3D
## Edificios armados con piezas en los tiles cercanos al foco (BuildingsConfig.DETAIL_RADIUS); más lejos queda la
## caja con atlas del WorldStreamer, que aquí se esconde mientras el tile tiene detalle (HLOD de dos niveles).
## Hilos: ModularBuilder (puro). Hilo principal: un MultiMesh por pieza y por tile (una draw call por tipo de
## pieza, no por edificio), la colisión de los recorribles y los muebles.

var focus: Node3D
var world: WorldStreamer

var _tiles: Dictionary = {}    # Vector2i → Node3D
var _pending: Dictionary = {}
var _done: Array = []
var _mutex := Mutex.new()
var _recheck := 0.0
var _lights: Array[OmniLight3D] = []
## Puertas que se abren (todas las de los tiles con detalle): { hinge: Node3D, open, angle, swing, pos }
var _doors: Array[Dictionary] = []


func _ready() -> void:
	PieceLibrary.ensure_loaded()
	for i in int(Settings.preset().lights):
		var l := OmniLight3D.new()
		l.light_color = Color("#ffd9a0") # bombillo cálido
		l.light_energy = 2.2
		l.shadow_enabled = false
		l.visible = false
		add_child(l)
		_lights.push_back(l)


func _process(delta: float) -> void:
	if focus == null or not BuildingsConfig.ENABLED or not PieceLibrary.available():
		return
	# Un tile de atlas que llega después que su detalle aparecería encima: se vuelve a esconder
	_recheck -= delta
	if _recheck <= 0.0:
		_recheck = 0.5
		for key: Vector2i in _tiles:
			_set_atlas(key, false)
		_place_lights()
	var center := WorldData.tile_key(focus.global_position.x, focus.global_position.z)
	var r: int = Settings.preset().detail
	for dz in range(-r, r + 1):
		for dx in range(-r, r + 1):
			var key := center + Vector2i(dx, dz)
			if WorldData.tiles.has(key) and not _tiles.has(key) and not _pending.has(key):
				_pending[key] = WorkerThreadPool.add_task(_task.bind(key))
	for key: Vector2i in _tiles.keys():
		if absi(key.x - center.x) > r + 1 or absi(key.y - center.y) > r + 1:
			var gone: Node3D = _tiles[key]
			_doors = _doors.filter(func(dd): return not gone.is_ancestor_of(dd.hinge))
			gone.queue_free()
			_tiles.erase(key)
			_set_atlas(key, true)
	_mutex.lock()
	var take := _done.slice(0, 1)
	_done = _done.slice(1)
	_mutex.unlock()
	for item: Array in take:
		WorkerThreadPool.wait_for_task_completion(_pending[item[0]])
		_pending.erase(item[0])
		_instantiate(item[0], item[1])


## Arranque o viaje rápido: el tile del foco con detalle antes de soltar al jugador (si no, atraviesa la caja).
func warm_up(pos: Vector3) -> void:
	if not BuildingsConfig.ENABLED or not PieceLibrary.available():
		return
	var key := WorldData.tile_key(pos.x, pos.z)
	if WorldData.tiles.has(key) and not _tiles.has(key):
		_instantiate(key, _build(key))


func _task(key: Vector2i) -> void:
	var out := _build(key)
	_mutex.lock()
	_done.push_back([key, out])
	_mutex.unlock()


func _build(key: Vector2i) -> ModularBuilder.Out:
	var tile = JSON.parse_string(FileAccess.get_file_as_string(WorldData.tile_path(key)))
	if tile == null:
		return ModularBuilder.Out.new()
	return ModularBuilder.build(tile, WorldData)


func _instantiate(key: Vector2i, out: ModularBuilder.Out) -> void:
	if _tiles.has(key):
		return
	var root := Node3D.new()
	root.name = "detalle_%d_%d" % [key.x, key.y]
	add_child(root)
	_tiles[key] = root
	for name: String in out.pieces:
		_multimesh(root, PieceLibrary.piece(name), out.pieces[name], PieceLibrary.material(), 0.0, true)
	# Muebles y revestimiento por celdas de 50 m: así el rango de visibilidad se mide cerca de cada casa
	for cell: Vector2i in out.furniture:
		var items: Dictionary = out.furniture[cell]
		for name: String in items:
			_multimesh(root, PieceLibrary.furniture(name), items[name], null, float(Settings.preset().furniture), false)
	for mat: String in out.batches:
		var batch: MeshBatch = out.batches[mat]
		if batch.is_empty():
			continue
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, batch.arrays())
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.material_override = MaterialLibrary.get_material(mat)
		root.add_child(mi)
	for cell: Vector2i in out.glass:
		var gb: MeshBatch = out.glass[cell]
		if gb.is_empty():
			continue
		var gm := ArrayMesh.new()
		gm.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, gb.arrays())
		var gmi := MeshInstance3D.new()
		gmi.mesh = gm
		gmi.material_override = MaterialLibrary.get_material("glass_in")
		gmi.visibility_range_end = float(Settings.preset().furniture)
		gmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(gmi)
	for cell: Vector2i in out.lining:
		var batch: MeshBatch = out.lining[cell]
		if batch.is_empty():
			continue
		var lm := ArrayMesh.new()
		lm.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, batch.arrays())
		var lmi := MeshInstance3D.new()
		lmi.mesh = lm
		lmi.material_override = MaterialLibrary.get_material("lining")
		lmi.visibility_range_end = float(Settings.preset().furniture)
		lmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(lmi)
	for d: Dictionary in out.doors:
		_add_door(root, d)
	for sg: Dictionary in out.signs:
		_add_sign(root, sg)
	for v: Dictionary in out.vehicles:
		var m := VehicleModel.create(VehiclesConfig.spec(v.type), false)
		if m.is_empty():
			continue
		var visual: Node3D = m.visual
		visual.transform = v.xf
		for mi: Node in visual.find_children("*", "MeshInstance3D", true, false):
			(mi as MeshInstance3D).visibility_range_end = float(Settings.preset().furniture)
		root.add_child(visual)
	# Entrepisos, paredes y escaleras de los recorribles
	var body := StaticBody3D.new()
	body.collision_layer = 1
	if not out.slabs.is_empty():
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, out.slabs.arrays())
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.material_override = MaterialLibrary.get_material("slab")
		root.add_child(mi)
		var shape := CollisionShape3D.new()
		var concave := ConcavePolygonShape3D.new()
		# Doble cara: las losas se tocan desde arriba (piso) y desde abajo (cielo raso, cabeza, rayos); el orden de
		# vértices que el render toma como frente no es el que toma la física
		concave.backface_collision = true
		concave.set_faces(out.slabs.faces)
		shape.shape = concave
		body.add_child(shape)
	for bx: Array in out.boxes:
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = bx[1]
		shape.shape = box
		shape.transform = bx[0]
		body.add_child(shape)
	root.add_child(body)
	root.set_meta("edificios", out.count)
	root.set_meta("recorribles", out.enterable)
	root.set_meta("entradas", out.entries)
	_set_atlas(key, false)


## Muestra u oculta la caja con atlas del tile (la del WorldStreamer).
## Puerta con bisagra: la hoja del kit (sus mallas) y un cuerpo animable que gira con ella y bloquea de verdad.
## Empieza cerrada; F la abre hacia adentro (ver door_near / toggle).
func _add_door(root: Node3D, d: Dictionary) -> void:
	var info := PieceLibrary.piece(d.piece)
	if info.is_empty():
		return
	# La bisagra ES el cuerpo animable: AnimatableBody3D sincroniza con la física cuando cambia SU transformación;
	# si girara el nodo padre, la hoja se vería abierta pero su colisión seguiría cerrada (medido).
	var hinge := AnimatableBody3D.new()
	hinge.collision_layer = 1
	hinge.transform = d.hinge
	root.add_child(hinge)
	var scale: Vector3 = d.scale
	for part: Array in info.parts:
		var mi := MeshInstance3D.new()
		mi.mesh = part[0]
		mi.transform = Transform3D(Basis.from_scale(scale), Vector3.ZERO) * part[1]
		mi.material_override = PieceLibrary.material()
		mi.visibility_range_end = float(Settings.preset().furniture)
		hinge.add_child(mi)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	var w := 0.9 * scale.z
	var h := 2.1 * scale.y
	box.size = Vector3(0.08, h, w)
	shape.shape = box
	shape.position = Vector3(0, h * 0.5, w * 0.5)
	hinge.add_child(shape)
	var open: bool = d.get("open", false)
	var swing := -float(d.sd)
	var yaw0 := hinge.rotation.y
	if open: # puertas interiores: arrancan abiertas, sin animar al cargar
		hinge.rotation.y = yaw0 + PI * 0.5 * swing
	_doors.push_back({"hinge": hinge, "open": open, "angle": PI * 0.5 * swing if open else 0.0, "swing": swing, "pos": d.center,
		"yaw0": yaw0, "z0": (d.hinge as Transform3D).basis.z})


## Letrero del negocio real (nombre de OSM) sobre la puerta: placa oscura con letras claras, como los avisos.
func _add_sign(root: Node3D, sg: Dictionary) -> void:
	var holder := Node3D.new()
	holder.transform = sg.xf
	root.add_child(holder)
	var text: String = sg.text
	var plate := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(clampf(text.length() * 0.16 + 0.4, 1.2, 4.5), 0.5)
	plate.mesh = q
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GuaduaTheme.CAFE_DARK
	mat.roughness = 0.6
	plate.material_override = mat
	plate.position.z = 0.01
	holder.add_child(plate)
	var label := Label3D.new()
	label.text = text
	label.font_size = 64
	label.pixel_size = 0.004
	label.modulate = GuaduaTheme.CREMA
	label.outline_size = 0
	label.position.z = 0.02
	label.double_sided = false
	holder.add_child(label)


## Puerta más cercana a `p` (de las casas armadas), o vacío.
func door_near(p: Vector3, reach := BuildingsConfig.DOOR_REACH) -> Dictionary:
	var best := {}
	var bd := reach
	for d: Dictionary in _doors:
		var pos: Vector3 = d.pos
		var dist := Vector2(pos.x - p.x, pos.z - p.z).length()
		if dist < bd and absf(pos.y - p.y) < 2.5:
			bd = dist
			best = d
	return best


func toggle(door: Dictionary) -> void:
	door.open = not door.open


func door_count() -> int:
	return _doors.size()


## Para pruebas: [puertas que deberían estar abiertas, cuántas lo están de verdad (≈ 90° de su base)].
func open_doors_check() -> Array:
	var want := 0
	var ok := 0
	for d: Dictionary in _doors:
		if not d.open:
			continue
		want += 1
		var z0: Vector3 = d.z0
		if absf(rad_to_deg((d.hinge as Node3D).global_basis.z.angle_to(z0)) - 90.0) < 8.0:
			ok += 1
	return [want, ok]


func _physics_process(delta: float) -> void:
	for d: Dictionary in _doors:
		# 90°: la hoja queda pegada al muro de adentro y no invade el vano
		var target: float = (PI * 0.5 * d.swing) if d.open else 0.0
		if absf(target - d.angle) < 0.001:
			continue
		d.angle += (target - d.angle) * minf(1.0, delta * 5.0)
		var hinge: Node3D = d.hinge
		hinge.rotation.y = d.yaw0 + d.angle


## Cada luz del pool al piso recorrible más cercano al foco (centro del cuarto, cerca del techo).
func _place_lights() -> void:
	var fp := focus.global_position
	var spots := []
	for e: Dictionary in entries():
		var c: Vector2 = e.inside
		if Vector2(fp.x, fp.z).distance_to(c) > BuildingsConfig.INTERIOR_LIGHT_RADIUS:
			continue
		for lp: Vector3 in e.get("lights", []):
			spots.push_back([lp, 6.0])
	spots.sort_custom(func(a, b): return a[0].distance_squared_to(fp) < b[0].distance_squared_to(fp))
	for i in _lights.size():
		var on := i < spots.size()
		_lights[i].visible = on
		if on:
			_lights[i].global_position = spots[i][0]
			_lights[i].omni_range = clampf(spots[i][1] * 0.8, 5.0, 11.0)


## Entradas de los recorribles cargados (para pruebas, misiones y el mapa).
func entries() -> Array:
	var out := []
	for root: Node3D in _tiles.values():
		out.append_array(root.get_meta("entradas", []))
	return out


func _set_atlas(key: Vector2i, on: bool) -> void:
	if world == null:
		return
	var tile := world.tile_node(key)
	if tile == null:
		return
	for c: Node in tile.get_children():
		if String(c.name).begins_with("edificios_"):
			(c as Node3D).visible = on


func _multimesh(root: Node3D, info: Dictionary, items: Array, mat: Material, range_end: float, shadows: bool) -> void:
	if info.is_empty() or items.is_empty():
		return
	for part: Array in info.parts:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = mat != null
		mm.mesh = part[0]
		mm.instance_count = items.size()
		var local: Transform3D = part[1]
		for i in items.size():
			mm.set_instance_transform(i, items[i][0] * local)
			if mat != null:
				mm.set_instance_custom_data(i, items[i][1])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		if mat:
			mmi.material_override = mat
		mmi.visibility_range_end = range_end
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(mmi)


func _exit_tree() -> void:
	for id: int in _pending.values():
		WorkerThreadPool.wait_for_task_completion(id)
