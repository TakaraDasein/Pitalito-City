class_name CharacterModel
## Arma el personaje: cuerpo base de Quaternius (CC0) + biblioteca de 45 clips que comparte el mismo esqueleto
## de 65 huesos. Las animaciones vienen con la ruta "Rig/Skeleton3D" y los cuerpos con "Armature/Skeleton3D":
## se reescriben una sola vez y la biblioteca queda compartida entre todos los personajes.
## Ojo: el importador de Godot quita el sufijo "_Loop" del nombre y deja el clip cíclico ("Idle_Loop" → "Idle").

const ANIMATIONS := "res://assets/models/characters/animations.glb"
const LIB := "ual"

static var _library: AnimationLibrary


static func library() -> AnimationLibrary:
	if _library:
		return _library
	_library = AnimationLibrary.new()
	var src: Node = load(ANIMATIONS).instantiate()
	var player: AnimationPlayer = src.find_child("AnimationPlayer", true, false)
	var skeleton: Skeleton3D = src.find_child("Skeleton3D", true, false)
	for anim_name in player.get_animation_list():
		var anim: Animation = player.get_animation(anim_name).duplicate(true)
		var rotated := {}
		for t in anim.get_track_count():
			var path := String(anim.track_get_path(t))
			if path.begins_with("Rig/"):
				anim.track_set_path(t, NodePath("Armature/" + path.substr(4)))
			if anim.track_get_type(t) == Animation.TYPE_ROTATION_3D:
				rotated[path.get_slice(":", 1)] = true
		# Los huesos que el clip no rota quedarían en el reposo del cuerpo, que no es el mismo: el "root" de los
		# cuerpos está girado −90° (eje Z arriba de Unreal) y el personaje se acostaba. Se fija el reposo del clip.
		for b in skeleton.get_bone_count():
			var bone := skeleton.get_bone_name(b)
			if not rotated.has(bone):
				var t := anim.add_track(Animation.TYPE_ROTATION_3D)
				anim.track_set_path(t, NodePath("Armature/Skeleton3D:" + bone))
				anim.rotation_track_insert_key(t, 0.0, skeleton.get_bone_rest(b).basis.get_rotation_quaternion())
		_library.add_animation(anim_name, anim)
	src.free()
	return _library


## Devuelve el modelo listo, con un AnimationPlayer hijo que ya trae la biblioteca. null si faltan los assets.
## `look` (claves de CharacterConfig.DEFAULT_LOOK) arma cuerpo, ropa, pelo y sombrero; vacío = el de Settings.
static func create(look := {}) -> Node3D:
	if look.is_empty():
		look = Settings.look
	var body: Dictionary = CharacterConfig.BODIES.get(look.get("cuerpo", "a"), CharacterConfig.BODIES.a)
	var body_path: String = CharacterConfig.BASE + body.file
	if not ResourceLoader.exists(body_path) or not ResourceLoader.exists(ANIMATIONS):
		return null
	var model: Node3D = load(body_path).instantiate()
	_dress(model, look, body.clothes)
	var anim := AnimationPlayer.new()
	anim.name = "AnimationPlayer"
	model.add_child(anim)
	anim.root_node = NodePath("..")
	anim.add_animation_library(LIB, library())
	return model


## Viste el cuerpo. Ropa y pelo traen el mismo esqueleto de 65 huesos con los mismos nombres: sus mallas se pasan
## al Skeleton3D del cuerpo y la piel se enlaza por nombre de hueso, sin copiar esqueletos ni animar dos veces.
static func _dress(model: Node3D, look: Dictionary, sex: String) -> void:
	var skel: Skeleton3D = model.find_child("Skeleton3D", true, false)
	if skel == null:
		return
	var skin := Color(CharacterConfig.SKIN.get(look.get("piel", "3"), CharacterConfig.SKIN["3"])[1])
	var hair := Color(CharacterConfig.HAIR_COLOR.get(look.get("pelocolor", "negro"), CharacterConfig.HAIR_COLOR.negro)[1])
	var clothed: bool = not CharacterConfig.OUTFITS.get(look.get("ropa", "campo"), {}).get("parts", []).is_empty()
	# piel: tinte del tono y, con ropa, se mete un poco hacia adentro (el cuerpo es más ancho que la ropa)
	# el cuerpo trae tres mallas: cuerpo (piel), cejas (color del pelo) y ojos (sin tocar)
	for mi: MeshInstance3D in skel.find_children("*", "MeshInstance3D", false, false):
		if mi.name == "Eyebrows":
			_tint(mi, hair, 0.0)
		elif mi.name != "Eyes":
			_tint(mi, skin, CharacterConfig.SKIN_SHRINK if clothed else 0.0, true)
	var files: Array[String] = []
	for part: String in CharacterConfig.OUTFITS.get(look.get("ropa", "campo"), {}).get("parts", []):
		files.push_back(CharacterConfig.part_file(part, sex))
	if look.get("capucha", false):
		files.push_back(CharacterConfig.part_file(CharacterConfig.HOOD, sex))
	if look.get("hombreras", false):
		files.push_back(CharacterConfig.part_file(CharacterConfig.PAULDRONS, sex))
	var hair_files: Array[String] = []
	# con capucha o sombrero el pelo atravesaría la tela: debajo queda el corto, que sí cabe
	var pelo: String = look.get("pelo", "partido")
	if (look.get("capucha", false) or look.get("sombrero", false)) and pelo in ["largo", "monos", "partido"]:
		pelo = "corto" if look.get("cuerpo", "a") == "a" else "corto-b"
	for f: String in [CharacterConfig.HAIR.get(pelo, {}).get("file", ""), CharacterConfig.BEARD.get(look.get("barba", "ninguna"), {}).get("file", "")]:
		if f != "":
			hair_files.push_back(CharacterConfig.BASE + f)
	for f in files + hair_files:
		if not ResourceLoader.exists(f):
			continue
		var src: Node = load(f).instantiate()
		for mi: MeshInstance3D in src.find_children("*", "MeshInstance3D", true, false):
			mi.owner = null
			mi.get_parent().remove_child(mi)
			skel.add_child(mi)
			mi.skeleton = NodePath("..")
			if f in hair_files:
				_tint(mi, hair, 0.0)
		src.free()
	if look.get("sombrero", false) and not look.get("capucha", false):
		_hat(skel)


## `flat`: fuera la textura (la del cuerpo es un traje de superhéroe con manchas, no piel; igual que en la web),
## se conserva el mapa de normales para que el relieve del cuerpo se siga leyendo.
static func _tint(mi: MeshInstance3D, color: Color, shrink: float, flat := false) -> void:
	for i in mi.get_surface_override_material_count():
		var m := mi.get_active_material(i)
		if not m is StandardMaterial3D:
			continue
		var d := m.duplicate() as StandardMaterial3D
		d.albedo_color = color
		if flat:
			d.albedo_texture = null
			d.roughness_texture = null
		d.roughness = maxf(0.55, d.roughness)
		d.metallic = 0.0
		if shrink > 0.0:
			d.grow = true
			d.grow_amount = -shrink
		mi.set_surface_override_material(i, d)


## Sombrero aguadeño (paja toquilla, ala ancha y cinta negra), procedural sobre el hueso de la cabeza.
static func _hat(skel: Skeleton3D) -> void:
	if skel.find_bone("Head") < 0:
		return
	var att := BoneAttachment3D.new()
	att.bone_name = "Head"
	skel.add_child(att)
	var straw := StandardMaterial3D.new()
	straw.albedo_color = Color("#d9c08a")
	straw.roughness = 0.9
	var band := StandardMaterial3D.new()
	band.albedo_color = Color("#1a1410")
	# [radio arriba, radio abajo, alto, y, material]: ala, copa y cinta
	for p: Array in [[0.21, 0.21, 0.012, 0.0, straw], [0.105, 0.125, 0.12, 0.06, straw], [0.127, 0.127, 0.025, 0.016, band]]:
		var c := CylinderMesh.new()
		c.top_radius = p[0]
		c.bottom_radius = p[1]
		c.height = p[2]
		c.radial_segments = 24
		c.rings = 1
		var mi := MeshInstance3D.new()
		mi.mesh = c
		mi.material_override = p[4]
		mi.position.y = CharacterConfig.HAT_LIFT + p[3]
		att.add_child(mi)


static func clip(anim_name: String) -> String:
	return LIB + "/" + anim_name
