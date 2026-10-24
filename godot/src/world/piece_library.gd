class_name PieceLibrary
## Piezas de los kits de Kenney listas para MultiMesh: por cada modelo, sus mallas con la transformación local
## horneada y su caja. Se carga una vez en el hilo principal (load() de recursos); después es de solo lectura y los
## constructores en hilos consultan `size_of` sin candados.

## Escala del Furniture Kit: viene a ~0,5 (la nevera mide 0,92 m). ×2 la lleva a tamaño real.
const FURNITURE_SCALE := 2.0

## nombre → { parts: [[Mesh, Transform3D]], aabb: AABB }
static var _pieces: Dictionary = {}
static var _furniture: Dictionary = {}
static var _material: ShaderMaterial
static var _loaded := false


static func ensure_loaded() -> void:
	if _loaded:
		return
	_loaded = true
	_material = ShaderMaterial.new()
	_material.shader = preload("res://src/world/building_kit.gdshader")
	# La paleta se lee del PNG sin comprimir: la compresión de VRAM altera las muestras de color exactas que el
	# shader usa para saber qué es pared (y granula los vidrios). Son 512×512 de colores planos: no pesa.
	var tex_path := BuildingsConfig.PIECES_DIR + "/Textures/colormap.png"
	if FileAccess.file_exists(tex_path):
		var img := Image.new()
		if img.load_png_from_buffer(FileAccess.get_file_as_bytes(tex_path)) == OK:
			img.generate_mipmaps() # sin mipmaps los vidrios y marcos titilaban (granulado) a distancia
			_material.set_shader_parameter("palette", ImageTexture.create_from_image(img))
	_load_dir(BuildingsConfig.PIECES_DIR, _pieces, 1.0)
	_load_dir(BuildingsConfig.FURNITURE_DIR, _furniture, FURNITURE_SCALE)


static func available() -> bool:
	return not _pieces.is_empty()


static func _load_dir(dir: String, into: Dictionary, scale: float) -> void:
	if not DirAccess.dir_exists_absolute(dir):
		return
	for f in DirAccess.get_files_at(dir):
		if not f.ends_with(".glb"):
			continue
		var packed := load(dir + "/" + f) as PackedScene
		if packed == null:
			continue
		var root: Node3D = packed.instantiate()
		var parts := []
		var box := AABB()
		var first := true
		for n: Node in root.find_children("*", "MeshInstance3D", true, false):
			var mi := n as MeshInstance3D
			var t := Transform3D()
			var cur: Node = mi
			while cur != root:
				t = (cur as Node3D).transform * t
				cur = cur.get_parent()
			t = Transform3D(Basis.from_scale(Vector3.ONE * scale), Vector3.ZERO) * t
			parts.push_back([mi.mesh, t])
			var b := t * mi.get_aabb()
			box = b if first else box.merge(b)
			first = false
		root.free()
		if not parts.is_empty():
			into[f.get_basename()] = {"parts": parts, "aabb": box}


static func piece(name: String) -> Dictionary:
	return _pieces.get(name, {})


static func furniture(name: String) -> Dictionary:
	return _furniture.get(name, {})


static func material() -> ShaderMaterial:
	return _material
