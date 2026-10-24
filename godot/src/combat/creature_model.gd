class_name CreatureModel
## Arma el modelo de una criatura externa (CreaturesConfig): lo escala a su alto real midiendo el esqueleto (las
## mallas con piel de Sketchfab traen escalas sueltas: medir la malla daba 1–2 cm), apoya los pies en y = 0, lo
## orienta hacia −Z y le cuelga un AnimationPlayer: los humanoides con la biblioteca del juego, los demás con sus
## clips propios. Devuelve {root, anim, clips} o {} si falta el archivo (no se versionan).

static func create(id: String) -> Dictionary:
	var c: Dictionary = CreaturesConfig.CREATURES.get(id, {})
	var path: String = CreaturesConfig.DIR + String(c.get("file", ""))
	if c.is_empty() or not ResourceLoader.exists(path):
		return {}
	var model: Node3D = load(path).instantiate()
	var root := Node3D.new()
	root.name = id
	root.add_child(model)
	# alto: el punto más alto y más bajo del esqueleto en reposo, en el espacio del modelo
	var lo := INF
	var hi := -INF
	for sk: Skeleton3D in model.find_children("*", "Skeleton3D", true, false):
		var xf := _rel(sk, model)
		for i in sk.get_bone_count():
			var y := (xf * sk.get_bone_global_rest(i)).origin.y
			lo = minf(lo, y)
			hi = maxf(hi, y)
	# humanoides: hasta la cabeza (algunos traen huesos de cámara o efectos por encima, y el alto salía corto); la
	# cabeza está a ~0,92 del alto total
	var target := float(c.height)
	if c.get("humanoid", false):
		var sk: Skeleton3D = model.find_child(CharacterModel.SKELETON, true, false)
		if sk and sk.find_bone("Head") >= 0:
			hi = (_rel(sk, model) * sk.get_bone_global_rest(sk.find_bone("Head"))).origin.y
			target *= 0.92
	if hi > lo:
		var s := target / (hi - lo)
		model.scale = Vector3.ONE * s
		model.position.y = -lo * s
	# las mallas con piel de Sketchfab traen su caja en otra escala que lo que se dibuja: sin margen, Godot las
	# recortaba como si estuvieran fuera de cámara (el saqueador no se veía)
	for mi: MeshInstance3D in model.find_children("*", "MeshInstance3D", true, false):
		mi.extra_cull_margin = float(c.height) * 2.0
	model.rotation.y = float(c.get("face", PI)) # los modelos de Sketchfab miran a +Z; en Godot adelante es −Z
	var anim: AnimationPlayer
	if c.get("humanoid", false):
		for ap: AnimationPlayer in model.find_children("*", "AnimationPlayer", true, false):
			ap.stop()
			ap.queue_free()
		var skel: Skeleton3D = model.find_child(CharacterModel.SKELETON, true, false)
		anim = AnimationPlayer.new()
		(skel.owner if skel and skel.owner else model).add_child(anim)
		anim.root_node = anim.get_path_to(skel.owner if skel and skel.owner else model)
		anim.add_animation_library(CharacterModel.LIB, CharacterModel.library_fixed_hips())
	else:
		var aps: Array = model.find_children("*", "AnimationPlayer", true, false)
		anim = aps[0] if not aps.is_empty() else null
	var clips := {}
	for role: String in c.clips:
		var name: String = c.clips[role]
		var full := CharacterModel.clip(name) if c.get("humanoid", false) else name
		if anim and anim.has_animation(full):
			clips[role] = full
			anim.get_animation(full).loop_mode = Animation.LOOP_LINEAR if role in ["idle", "walk", "run"] else Animation.LOOP_NONE
	if anim and clips.has("idle"):
		anim.play(clips.idle)
	return {"root": root, "anim": anim, "clips": clips, "spec": c}


static func _rel(n: Node, root: Node) -> Transform3D:
	var t := Transform3D()
	var cur: Node = n
	while cur and cur != root:
		if cur is Node3D:
			t = (cur as Node3D).transform * t
		cur = cur.get_parent()
	return t
