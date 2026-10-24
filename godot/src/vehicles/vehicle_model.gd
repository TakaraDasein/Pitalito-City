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
	return {"visual": visual, "wheels": wheels, "size": size, "base_y": (box.position.y) * scale.y, "xf": xf}


## Puerta del conductor (spec.door, en el espacio del modelo de la web). Las carrocerías de la web son perfiles
## extruidos macizos: no hay un costado que abrir. Así que se recorta al dibujar:
##  · la carrocería deja de dibujarse dentro de la caja de la puerta (y se ve por dentro: sin descarte de caras
##    traseras, la pared del otro lado y el techo se leen como el interior);
##  · la hoja es una copia de esas mismas piezas que solo se dibuja dentro de la caja, colgada de una bisagra en
##    el borde delantero: calza exacto con la pintura, la manija, la franja o el espejo, porque es el modelo mismo.
## Los shaders salen del que Godot genera para cada StandardMaterial3D (mismo aspecto), con el recorte añadido.
## La caja va de 0,15 m afuera del costado a DOOR_DEPTH adentro. Devuelve { hinge, open, side } o {}.
const DOOR_DEPTH := 0.12  # cuánto se mete la caja desde el costado: el grosor de una puerta (con 0,3 se veía un bloque)
const DOOR_OPEN := 1.15   # ángulo de apertura (rad)

static var _door_shaders := {}


static func add_doors(visual: Node3D, spec: Dictionary) -> Dictionary:
	var d: Dictionary = spec.get("door", {})
	var body: Node3D = visual.get_node_or_null("body")
	if d.is_empty() or body == null or not spec.has("seat"):
		return {}
	var side := signf(float(spec.seat[0])) # lado del conductor en el modelo de la web (−x)
	var half := float(spec.width) * 0.5
	# caja en el espacio de `body`: desde 0,15 m afuera del costado hasta DOOR_DEPTH adentro
	var x_out := side * (half + 0.15)
	var x_in := side * (half - DOOR_DEPTH)
	var lo := Vector3(minf(x_out, x_in), d.y[0], d.z[0])
	var size := Vector3(absf(x_out - x_in), d.y[1] - d.y[0], d.z[1] - d.z[0])
	var frame := Transform3D(Basis(), lo)
	var hinge: Node3D = null
	if d.get("panel", false):
		hinge = Node3D.new()
		hinge.name = "puerta_conductor"
		hinge.position = Vector3(side * half, 0, d.z[0])
		body.add_child(hinge)
	for mi: MeshInstance3D in body.find_children("*", "MeshInstance3D", true, false):
		if mi.get_parent() == hinge:
			continue
		var rel := _rel(mi, body)
		var box := rel * mi.get_aabb()
		# el recorte es local a la caja: basta con que la pieza la toque (tablero o sillas quedan fuera de ella)
		if not box.intersects(AABB(lo, size)):
			continue
		var to_box := frame.affine_inverse() * rel
		_door_materials(mi, to_box, size, false)
		if hinge:
			var leaf := MeshInstance3D.new()
			leaf.mesh = mi.mesh
			leaf.transform = hinge.transform.affine_inverse() * rel
			leaf.cast_shadow = mi.cast_shadow
			hinge.add_child(leaf)
			for i in mi.mesh.get_surface_count():
				leaf.set_surface_override_material(i, mi.get_active_material(i))
			_door_materials(leaf, to_box, size, true, mi)
	return {"hinge": hinge, "open": side * DOOR_OPEN, "side": side}


static func _rel(n: Node3D, root: Node3D) -> Transform3D:
	var t := Transform3D()
	var cur: Node = n
	while cur and cur != root:
		t = (cur as Node3D).transform * t
		cur = cur.get_parent()
	return t


## Cambia cada superficie por la versión recortada de su material. `leaf`: se dibuja solo dentro de la caja.
static func _door_materials(mi: MeshInstance3D, to_box: Transform3D, size: Vector3, leaf: bool, src: MeshInstance3D = null) -> void:
	var from := src if src else mi
	for i in mi.mesh.get_surface_count():
		var m := from.get_active_material(i) as BaseMaterial3D
		if m == null:
			continue
		var clear := m.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED
		var sm := ShaderMaterial.new()
		sm.shader = _door_shader(clear)
		sm.render_priority = m.render_priority
		sm.set_shader_parameter("albedo", m.albedo_color)
		sm.set_shader_parameter("use_tex", m.albedo_texture != null)
		if m.albedo_texture:
			sm.set_shader_parameter("tex", m.albedo_texture)
		sm.set_shader_parameter("use_vcol", m.vertex_color_use_as_albedo)
		sm.set_shader_parameter("metallic", m.metallic)
		sm.set_shader_parameter("roughness", m.roughness)
		var em := m.emission * m.emission_energy_multiplier if m.emission_enabled else Color.BLACK
		sm.set_shader_parameter("emission", em)
		sm.set_shader_parameter("use_em_tex", m.emission_enabled and m.emission_texture != null)
		if m.emission_texture:
			sm.set_shader_parameter("em_tex", m.emission_texture)
		sm.set_shader_parameter("door_xf", to_box)
		sm.set_shader_parameter("door_size", size)
		sm.set_shader_parameter("door_leaf", 1.0 if leaf else 0.0)
		mi.set_surface_override_material(i, sm)


## Equivalente reducido de StandardMaterial3D (lo que usan los vehículos horneados: color, textura, color de
## vértice, metal, rugosidad, emisión y vidrio transparente) más el recorte de la caja de la puerta.
static func _door_shader(clear: bool) -> Shader:
	if _door_shaders.has(clear):
		return _door_shaders[clear]
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode cull_disabled%s;
uniform vec4 albedo : source_color = vec4(1.0);
uniform bool use_tex = false;
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform bool use_vcol = false;
uniform float metallic = 0.0;
uniform float roughness = 0.8;
uniform vec4 emission : source_color = vec4(0.0);
uniform bool use_em_tex = false;
uniform sampler2D em_tex : source_color, filter_linear_mipmap;
uniform mat4 door_xf;
uniform vec3 door_size;
uniform float door_leaf;
varying vec3 door_p;

void vertex() {
	door_p = (door_xf * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	bool door_in = all(greaterThanEqual(door_p, vec3(0.0))) && all(lessThanEqual(door_p, door_size));
	if (door_in == (door_leaf < 0.5)) { discard; }
	vec4 c = albedo;
	if (use_tex) { c *= texture(tex, UV); }
	if (use_vcol) { c *= COLOR; }
	ALBEDO = c.rgb;
	METALLIC = metallic;
	ROUGHNESS = roughness;
	EMISSION = emission.rgb * (use_em_tex ? texture(em_tex, UV).rgb : vec3(1.0));
	%s
}
""" % [", depth_draw_opaque, blend_mix" if clear else "", "ALPHA = c.a;" if clear else ""]
	_door_shaders[clear] = sh
	return sh


## Pintura y placa sobre el modelo ya armado. Pintura: el material del color de fábrica (colors[0]) se reemplaza
## por una copia con el color nuevo (los demás vehículos comparten el original). Placa: el material con la textura
## de placa (256×128 de la web) pasa a amarillo liso y encima va el texto con Label3D, una por placa.
static func customize(visual: Node3D, spec: Dictionary, paint: String, plate: String) -> void:
	if spec.source == "kenney":
		if paint != "" and VehiclesConfig.KENNEY_PALETTE.has(paint):
			_kenney_repaint(visual.get_node_or_null("body") as MeshInstance3D, VehiclesConfig.KENNEY_PALETTE[paint])
		return
	var cols: Array = spec.get("colors", [])
	var factory := Color(cols[0]) if not cols.is_empty() else Color(0, 0, 0, 0)
	var painted: StandardMaterial3D
	var glass: StandardMaterial3D
	for n: Node in visual.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		for i in mi.mesh.get_surface_count():
			var m := mi.mesh.surface_get_material(i) as StandardMaterial3D
			if m == null:
				continue
			# vidrios (#0f171e y #9fb0ba en los modelos de la web, opacos allá): translúcidos, para ver al conductor
			if m.albedo_texture == null and (_same(m.albedo_color, Color("#0f171e")) or _same(m.albedo_color, Color("#9fb0ba"))):
				if glass == null:
					glass = m.duplicate()
					glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
					glass.albedo_color = Color("#2a3b46", 0.38)
					glass.roughness = 0.05
					glass.metallic = 0.3
				mi.set_surface_override_material(i, glass)
			elif paint != "" and not cols.is_empty() and m.albedo_texture == null and _same(m.albedo_color, factory):
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


## Car Kit: la pintura es el par de muestras de la fila 1 con más área; sus triángulos se corren al par pedido.
## Se arma una malla nueva (la importada la comparten todos los carros del mismo modelo).
static func _kenney_repaint(mi: MeshInstance3D, to: Array) -> void:
	if mi == null:
		return
	const COLS := 16.0
	const ROWS := 4.0
	var src := mi.mesh
	var out := ArrayMesh.new()
	for si in src.get_surface_count():
		var arr := src.surface_get_arrays(si)
		var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var uv: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV]
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		var tri := func(t: int) -> Array: return [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]] if not idx.is_empty() else [t * 3, t * 3 + 1, t * 3 + 2]
		var n_tri := (idx.size() if not idx.is_empty() else v.size()) / 3
		var area := {}
		for t in n_tri:
			var k: Array = tri.call(t)
			var c: Vector2 = (uv[k[0]] + uv[k[1]] + uv[k[2]]) / 3.0
			if floori(c.y * ROWS) != 1:
				continue
			var col := floori(c.x * COLS) & ~1
			area[col] = area.get(col, 0.0) + (v[k[1]] - v[k[0]]).cross(v[k[2]] - v[k[0]]).length() * 0.5
		var best := -1
		var best_a := 0.0
		for col: int in area:
			if area[col] > best_a:
				best_a = area[col]
				best = col
		if best >= 0:
			var du := (float(to[1]) - best) / COLS
			var dv := (float(to[0]) - 1.0) / ROWS
			var moved := {}
			for t in n_tri:
				var k: Array = tri.call(t)
				var c: Vector2 = (uv[k[0]] + uv[k[1]] + uv[k[2]]) / 3.0
				if floori(c.y * ROWS) != 1 or (floori(c.x * COLS) & ~1) != best:
					continue
				for vi: int in k:
					if not moved.has(vi):
						moved[vi] = true
						uv[vi] += Vector2(du, dv)
			arr[Mesh.ARRAY_TEX_UV] = uv
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		out.surface_set_material(si, src.surface_get_material(si))
	mi.mesh = out


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
