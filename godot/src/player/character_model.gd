class_name CharacterModel
## Arma el personaje: cuerpo base de Quaternius (CC0) + biblioteca de 45 clips que comparte el mismo esqueleto
## de 65 huesos. Las animaciones vienen con la ruta "Rig/Skeleton3D" y los cuerpos con "Armature/Skeleton3D":
## se reescriben una sola vez y la biblioteca queda compartida entre todos los personajes.
## Ojo: el importador de Godot quita el sufijo "_Loop" del nombre y deja el clip cíclico ("Idle_Loop" → "Idle").

const BODY := "res://assets/models/characters/base/Superhero_Male_FullBody.gltf"
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
static func create(body_path := BODY) -> Node3D:
	if not ResourceLoader.exists(body_path) or not ResourceLoader.exists(ANIMATIONS):
		return null
	var model: Node3D = load(body_path).instantiate()
	var anim := AnimationPlayer.new()
	anim.name = "AnimationPlayer"
	model.add_child(anim)
	anim.root_node = NodePath("..")
	anim.add_animation_library(LIB, library())
	return model


static func clip(anim_name: String) -> String:
	return LIB + "/" + anim_name
