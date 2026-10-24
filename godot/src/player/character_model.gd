class_name CharacterModel
## Arma el personaje: cuerpo base de Quaternius (CC0) + biblioteca de 45 clips que comparte el mismo esqueleto.
## Todo pasa por el retarget humanoide del importador (tools/import/apply_retarget.py): el esqueleto se llama
## "GeneralSkeleton" con nombres del perfil de Godot (Hips, Head, LeftFoot…) y los clips usan rutas
## "%GeneralSkeleton:…", así que la biblioteca sirve tal cual para cualquier cuerpo con ese perfil.
## Ojo: el importador de Godot quita el sufijo "_Loop" del nombre y deja el clip cíclico ("Idle_Loop" → "Idle").

const ANIMATIONS := "res://assets/models/characters/animations.glb"
## Clips extra (Universal Animation Library 2, CC0): espada, bloqueo, zarpazo, levantarse. Mismo perfil humanoide.
const EXTRA := ["res://assets/models/characters/ual2.glb"]
const LIB := "ual"
const SKELETON := "GeneralSkeleton"

static var _library: AnimationLibrary


static func library() -> AnimationLibrary:
	if _library:
		return _library
	_library = AnimationLibrary.new()
	for path: String in [ANIMATIONS] + EXTRA:
		if not ResourceLoader.exists(path):
			continue
		var src: Node = load(path).instantiate()
		var player: AnimationPlayer = src.find_child("AnimationPlayer", true, false)
		for anim_name in player.get_animation_list():
			if not _library.has_animation(anim_name):
				_library.add_animation(anim_name, player.get_animation(anim_name))
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
	var skel: Skeleton3D = model.find_child(SKELETON, true, false)
	if skel == null:
		return
	var skin := Color(CharacterConfig.SKIN.get(look.get("piel", "3"), CharacterConfig.SKIN["3"])[1])
	var hair := Color(CharacterConfig.HAIR_COLOR.get(look.get("pelocolor", "negro"), CharacterConfig.HAIR_COLOR.negro)[1])
	var parts: Array = CharacterConfig.OUTFITS.get(look.get("ropa", "campo"), {}).get("parts", [])
	# piel: tinte del tono, y lo que tapa la ropa se mete hacia adentro (el cuerpo es más ancho que su ropa)
	# el cuerpo trae tres mallas: cuerpo (piel), cejas (color del pelo) y ojos (sin tocar)
	for mi: MeshInstance3D in skel.find_children("*", "MeshInstance3D", false, false):
		if mi.name == "Eyebrows":
			_tint(mi, hair, 0.0)
		elif mi.name != "Eyes":
			_tint(mi, skin, true)
			mi.mesh = _fitted(mi, parts)
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
				_tint(mi, hair)
		src.free()
	if look.get("sombrero", false) and not look.get("capucha", false):
		_hat(skel)


## Cuelga el arma de la mano derecha empuñada de verdad (CombatConfig.GRIP_*): el centro del puño se mide en
## este cuerpo (la mano femenina es más chica) y el arma se pone con su empuñadura ahí. null si no hay arma.
static func attach_weapon(model: Node3D, id: String) -> BoneAttachment3D:
	var w: Dictionary = CombatConfig.WEAPONS.get(id, {})
	var file: String = w.get("model", "")
	var skel: Skeleton3D = model.find_child(SKELETON, true, false) if model else null
	var path := CombatConfig.WEAPON_DIR + file + ".glb"
	if file == "" or skel == null or skel.find_bone("RightHand") < 0 or not ResourceLoader.exists(path):
		return null
	var hand := skel.get_bone_global_rest(skel.find_bone("RightHand"))
	var knuckle := Vector3(0, 0.1, 0)
	if skel.find_bone("RightMiddleProximal") >= 0:
		knuckle = hand.affine_inverse() * skel.get_bone_global_rest(skel.find_bone("RightMiddleProximal")).origin
	var palm := Vector3(0.0, knuckle.y * CombatConfig.GRIP_ALONG, CombatConfig.GRIP_PALM)
	var slot := BoneAttachment3D.new()
	slot.name = "arma"
	slot.bone_name = "RightHand"
	skel.add_child(slot)
	var mesh: Node3D = load(path).instantiate()
	var b := CombatConfig.GRIP_BASIS
	mesh.transform = Transform3D(b * Basis(Vector3.UP, float(w.get("twist", 0.0))), palm - b * Vector3(0, float(w.get("grip", 0.0)), 0))
	slot.add_child(mesh)
	return slot


## Arma de fuego en la mano derecha (FirearmsConfig). El GLB se normaliza: a escala real (`length`), con la
## empuñadura en el origen y el cañón hacia +X; después se empuña igual que las de mano (GRIP_BASIS): el cañón
## sigue los dedos y el lomo queda del lado del pulgar. Devuelve {slot, hold, palm, kick, muzzle, handguard, port,
## mag} o {}: hold = lo que sostiene el arma (el jugador lo orienta por la línea de tiro), palm = la palma en el
## espacio de la mano, kick = retroceso (gira en el eje del arma), muzzle = boca (fogonazo), handguard = mano
## izquierda o null, port = ventana de expulsión (casquillos), mag = de donde sale el cargador o null.
static func attach_firearm(model: Node3D, id: String) -> Dictionary:
	var f: Dictionary = FirearmsConfig.FIREARMS.get(id, {})
	var skel: Skeleton3D = model.find_child(SKELETON, true, false) if model else null
	var path: String = FirearmsConfig.DIR + String(f.get("file", ""))
	if f.is_empty() or skel == null or skel.find_bone("RightHand") < 0 or not ResourceLoader.exists(path):
		return {}
	var gun: Node3D = load(path).instantiate()
	# caja del modelo en su propio espacio
	var box := AABB()
	var first := true
	for mi: MeshInstance3D in gun.find_children("*", "MeshInstance3D", true, false):
		var rel := Transform3D()
		var n: Node = mi
		while n and n != gun:
			rel = (n as Node3D).transform * rel
			n = n.get_parent()
		var b := rel * mi.get_aabb()
		box = b if first else box.merge(b)
		first = false
	var dir := float(f.get("barrel", 1))
	var size := box.size
	var s := float(f.length) / maxf(size.x, 0.001)
	var along := func(frac: float, height: float) -> Vector3:
		var x := box.position.x + frac * size.x if dir > 0 else box.end.x - frac * size.x
		return Vector3(x, box.position.y + height * size.y, box.get_center().z)
	var grip: Vector3 = along.call(f.grip[0], f.grip[1]) if f.has("grip") else Vector3.ZERO
	# archivo → arma: escala, cañón a +X, empuñadura al origen
	var basis := Basis(Vector3.UP, 0.0 if dir > 0 else PI).scaled(Vector3.ONE * s)
	var to_gun := Transform3D(basis, -(basis * grip))
	var palm := Vector3(0.0, 0.1 * CombatConfig.GRIP_ALONG, CombatConfig.GRIP_PALM)
	if skel.find_bone("RightMiddleProximal") >= 0:
		var hand := skel.get_bone_global_rest(skel.find_bone("RightHand"))
		var knuckle := hand.affine_inverse() * skel.get_bone_global_rest(skel.find_bone("RightMiddleProximal")).origin
		palm = Vector3(0.0, knuckle.y * CombatConfig.GRIP_ALONG, CombatConfig.GRIP_PALM)
	var slot := BoneAttachment3D.new()
	slot.name = "arma"
	slot.bone_name = "RightHand"
	skel.add_child(slot)
	# el que sostiene el arma va suelto (top_level): el jugador lo pone cada cuadro con la empuñadura en la palma y
	# el cañón por la línea de tiro (FirearmsConfig.HOLD); hasta entonces, como un arma de mano
	var hold := Node3D.new()
	hold.transform = Transform3D(CombatConfig.GRIP_BASIS, palm)
	slot.add_child(hold)
	hold.top_level = true
	var kick := Node3D.new()
	hold.add_child(kick)
	gun.transform = to_gun
	kick.add_child(gun)
	var muzzle := Marker3D.new()
	muzzle.position = to_gun * along.call(1.0, 0.7)
	kick.add_child(muzzle)
	var port := Marker3D.new()   # ventana de expulsión: por donde sale el casquillo (a la derecha del arma)
	var g0: float = f.grip[0] if f.has("grip") else 0.3
	port.position = to_gun * along.call(minf(0.95, g0 + 0.12), 0.85)
	kick.add_child(port)
	var mag: Marker3D = null
	if f.has("mag_at"):
		mag = Marker3D.new()
		mag.position = to_gun * along.call(f.mag_at[0], f.mag_at[1])
		kick.add_child(mag)
	var guard: Marker3D = null
	if f.has("handguard"):
		guard = Marker3D.new()
		guard.position = to_gun * along.call(f.handguard[0], f.handguard[1])
		kick.add_child(guard)
	return {"slot": slot, "hold": hold, "palm": palm, "kick": kick, "muzzle": muzzle, "handguard": guard, "port": port, "mag": mag}


## Viste un cuerpo cualquiera con estas piezas (mismo armazón), teñidas de un color: el uniforme de los Restos.
static func dress_parts(model: Node3D, parts: Array, sex: String, color: Color) -> void:
	var skel: Skeleton3D = model.find_child(SKELETON, true, false)
	if skel == null:
		return
	for part: String in parts:
		var f := CharacterConfig.part_file(part, sex)
		if not ResourceLoader.exists(f):
			continue
		var src: Node = load(f).instantiate()
		for mi: MeshInstance3D in src.find_children("*", "MeshInstance3D", true, false):
			mi.owner = null
			mi.get_parent().remove_child(mi)
			skel.add_child(mi)
			mi.skeleton = NodePath("..")
			_tint(mi, color)
		src.free()


## `flat`: fuera la textura (la del cuerpo es un traje de superhéroe con manchas, no piel; igual que en la web),
## se conserva el mapa de normales para que el relieve del cuerpo se siga leyendo.
static func _tint(mi: MeshInstance3D, color: Color, flat := false) -> void:
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
		mi.set_surface_override_material(i, d)


static var _fit_cache := {}


## Piel ajustada a la ropa. La web encoge todo el cuerpo por igual, y eso hunde también la cara y las manos
## (la cara quedaba de calavera, con ojos y cejas por fuera). Aquí cada vértice se mete según cuánto lo mueven
## huesos tapados por las piezas puestas: la cara, el cuello y las manos no se tocan, y como el peso de la piel
## cambia suave entre huesos, el borde (muñeca, cuello del camisón) no hace escalón. Se hornea una vez por
## combinación de cuerpo y piezas, en la pose de enlace, y la piel lo anima igual.
static func _fitted(mi: MeshInstance3D, parts: Array) -> Mesh:
	var covered := {}
	for part: String in parts:
		for bone: String in CharacterConfig.COVERS.get(part.get_slice("_", 2), []):
			covered[bone] = true
	if covered.is_empty() or mi.skin == null or not mi.mesh is ArrayMesh:
		return mi.mesh
	var key := "%s|%s" % [mi.mesh.resource_path, ",".join(covered.keys())]
	if _fit_cache.has(key):
		return _fit_cache[key]
	var shrink_of := PackedFloat32Array()
	for b in mi.skin.get_bind_count():
		var bone := String(mi.skin.get_bind_name(b))
		var on := false
		for part: String in covered:
			on = on or bone.contains(part)
		shrink_of.push_back(CharacterConfig.SKIN_SHRINK if on else 0.0)
	var src := mi.mesh as ArrayMesh
	var out := ArrayMesh.new()
	for si in src.get_surface_count():
		var arrays := src.surface_get_arrays(si)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
		var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
		var per := bones.size() / maxi(verts.size(), 1)
		for v in verts.size():
			var d := 0.0
			for k in per:
				var b := bones[v * per + k]
				if b < shrink_of.size():
					d += shrink_of[b] * weights[v * per + k]
			verts[v] -= normals[v] * d
		arrays[Mesh.ARRAY_VERTEX] = verts
		# canales extra del glTF que el material no usa: sin su formato exacto, add_surface los rechaza
		for c in [Mesh.ARRAY_CUSTOM0, Mesh.ARRAY_CUSTOM1, Mesh.ARRAY_CUSTOM2, Mesh.ARRAY_CUSTOM3]:
			arrays[c] = null
		var flags := src.surface_get_format(si) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		out.add_surface_from_arrays(src.surface_get_primitive_type(si), arrays, [], {}, flags)
		out.surface_set_material(si, src.surface_get_material(si))
	_fit_cache[key] = out
	return out


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
