class_name VehicleModel
## Carga el modelo de un vehículo y lo normaliza: mirando a +Z (adelante de VehicleBody3D), a escala real y
## centrado a lo largo. Sirve igual para el Car Kit de Kenney y para los horneados desde la web.
## Devuelve { visual: Node3D, wheels: [{ node, front, pos, radius }], size: Vector3 }; las ruedas siguen siendo
## hijas de `visual` hasta que quien las use las reubique.


static func path_of(spec: Dictionary, driver := false) -> String:
	if spec.source == "kenney":
		return "res://assets/models/vehicles/%s.glb" % spec.type
	return "res://assets/models/vehicles/baked/%s%s.glb" % [spec.type, "-driver" if driver else ""]


static func create(spec: Dictionary, driver := false) -> Dictionary:
	var path := path_of(spec, driver)
	if not ResourceLoader.exists(path):
		push_warning("Falta el modelo %s: corre tools/sync_from_web.sh" % path)
		return {}
	var src: Node3D = load(path).instantiate()
	use_vertex_colors(src)
	var body: Node3D = src.find_child("body", true, false)
	var visual := Node3D.new()
	visual.name = "modelo"
	var wheels := []
	var scale := Vector3.ONE
	var flip: bool = spec.source != "kenney" # los de la web miran a −Z
	var box := body.transform * _aabb(body)
	if spec.source == "kenney":
		scale = Vector3(spec.width / box.size.x, spec.height / box.size.y, spec.length / box.size.z)
	var center_z := (box.position.z + box.size.z * 0.5) * scale.z
	var xf := Transform3D(Basis(Vector3.UP, PI if flip else 0.0), Vector3.ZERO) * Transform3D(Basis.from_scale(scale), Vector3(0, 0, -center_z))

	for n: Node in src.find_children("wheel-*", "Node3D", true, false):
		var w := n as Node3D
		var local := xf * w.transform
		var wbox := _aabb(w)
		wheels.push_back({
			"node": w, "front": String(w.name).contains("front"), "pos": local.origin,
			"radius": maxf(wbox.size.y * scale.y * 0.5, 0.15),
			# Ruedas redondas aunque la carrocería se estire a lo largo (Kenney): escala (x, y, y)
			"basis": Basis(Vector3.UP, PI if flip else 0.0) * w.basis * Basis.from_scale(Vector3(scale.x, scale.y, scale.y)),
		})
	for n: Node in [body] + wheels.map(func(w): return w.node):
		var node := n as Node3D
		var t := xf * node.transform
		node.owner = null
		node.reparent(visual, false)
		node.transform = t
	src.queue_free()
	var size := Vector3(box.size.x * scale.x, box.size.y * scale.y, box.size.z * scale.z)
	return {"visual": visual, "wheels": wheels, "size": size, "base_y": (box.position.y) * scale.y}


## Pintura y placa sobre el modelo ya armado. Pintura: el material del color de fábrica (colors[0]) se reemplaza
## por una copia con el color nuevo (los demás vehículos comparten el original). Placa: el material con la textura
## de placa (256×128 de la web) pasa a amarillo liso y encima va el texto con Label3D, una por placa.
static func customize(visual: Node3D, spec: Dictionary, paint: String, plate: String) -> void:
	var cols: Array = spec.get("colors", [])
	var factory := Color(cols[0]) if not cols.is_empty() else Color(0, 0, 0, 0)
	var painted: StandardMaterial3D
	for n: Node in visual.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		for i in mi.mesh.get_surface_count():
			var m := mi.mesh.surface_get_material(i) as StandardMaterial3D
			if m == null:
				continue
			if paint != "" and not cols.is_empty() and m.albedo_texture == null and _same(m.albedo_color, factory):
				if painted == null:
					painted = m.duplicate()
					painted.albedo_color = Color(paint)
				mi.set_surface_override_material(i, painted)
			elif plate != "" and m.albedo_texture and absf(float(m.albedo_texture.get_width()) / m.albedo_texture.get_height() - 2.0) < 0.05:
				var yellow := StandardMaterial3D.new()
				yellow.albedo_color = Color("#f7d117")
				yellow.roughness = 0.4
				mi.set_surface_override_material(i, yellow)
				_plate_labels(mi, i, plate)


static func _same(a: Color, b: Color) -> bool:
	return absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) < 0.03


## Las dos placas vienen fundidas en una superficie: se separan por el signo de la normal y se rotula cada una.
static func _plate_labels(mi: MeshInstance3D, surface: int, text: String) -> void:
	var arr := mi.mesh.surface_get_arrays(surface)
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var nr: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var groups := {}
	for k in v.size():
		var key := 1 if nr[k].z >= 0.0 else -1
		if not groups.has(key):
			groups[key] = [Vector3.ZERO, 0, nr[k]]
		groups[key][0] += v[k]
		groups[key][1] += 1
	for g: Array in groups.values():
		var c: Vector3 = g[0] / g[1]
		var n: Vector3 = (g[2] as Vector3).normalized()
		# placa de 0,44 × 0,22 m: número de ~0,36 m de ancho arriba y la ciudad abajo, como las colombianas
		for line: Array in [[text, 0.015, 0.0013, 64], ["PITALITO", -0.07, 0.0019, 20]]:
			var l := Label3D.new()
			l.text = line[0]
			l.font_size = line[3]
			l.pixel_size = line[2]
			l.modulate = Color("#111111")
			l.outline_size = 0
			l.double_sided = false
			l.shaded = true
			if GuaduaTheme.text_font:
				l.font = GuaduaTheme.text_font
			l.transform = Transform3D(Basis.looking_at(-n, Vector3.UP), c + n * 0.004 + Vector3.UP * line[1])
			mi.add_child(l)


## El GLTFExporter de three.js guarda los colores de vértice (llantas, rines pintados) pero no marca el material
## para usarlos. Se marcan aquí; el material es el recurso importado, compartido: se hace una vez por material.
static func use_vertex_colors(root: Node) -> void:
	for n: Node in root.find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = (n as MeshInstance3D).mesh
		for i in mesh.get_surface_count():
			var mat := mesh.surface_get_material(i) as StandardMaterial3D
			if mat and not mat.vertex_color_use_as_albedo and mesh.surface_get_format(i) & Mesh.ARRAY_FORMAT_COLOR:
				mat.vertex_color_use_as_albedo = true
				mat.vertex_color_is_srgb = true


## Caja que envuelve todas las mallas de un subárbol, en el espacio de `root`.
static func _aabb(root: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for n: Node in [root] + root.find_children("*", "MeshInstance3D", true, false):
		if not n is MeshInstance3D:
			continue
		var mi := n as MeshInstance3D
		var rel := Transform3D()
		var cur: Node = mi
		while cur != root and cur != null:
			rel = (cur as Node3D).transform * rel
			cur = cur.get_parent()
		var b := rel * mi.get_aabb()
		out = b if first else out.merge(b)
		first = false
	return out
