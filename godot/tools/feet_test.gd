extends Node3D
## Herramienta: pies sobre el terreno (CharacterRig). Tres casos con geometría conocida: piso plano, un escalón de
## 0,2 m bajo el pie izquierdo y una rampa de 20°. Mide la altura de cada tobillo sobre el suelo que tiene debajo,
## sin y con el ajuste, y guarda capturas de lado (screenshots/pies_*.png).
## Uso: godot res://tools/feet_test.tscn  (con ventana; sin GPU las capturas salen negras)

const CASES := ["plano", "escalon", "rampa"]
var _base := 0.0


func _ready() -> void:
	Settings.persist = false
	_base = WorldData.height(0, 0)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.9, 0.5, 0)
	sun.shadow_enabled = true
	add_child(sun)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("#3a4a5a")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.8, 0.8, 0.8)
	add_child(env)
	var cam := Camera3D.new()
	add_child(cam)
	cam.fov = 35
	var x := 0.0
	for c in CASES:
		_build_case(c, x)
		x += 6.0
	x = 0.0
	for c in CASES:
		var player: Player = load("res://src/player/player.gd").new()
		add_child(player)
		player.global_position = Vector3(x, _base + 0.6, 0)
		# de frente a −X: el pie izquierdo queda hacia +Z... se gira para dejar el escalón bajo el izquierdo
		player.rotation.y = 0.0
		cam.global_position = Vector3(x + 3.2, _base + 0.9, 0.4)
		cam.look_at(Vector3(x, _base + 0.6, 0))
		for on in [false, true]:
			await get_tree().physics_frame
			if player._rig:
				player._rig.active = on
				player._rig._ik.active = on
			for i in 60:
				await get_tree().physics_frame
			await RenderingServer.frame_post_draw
			await _report(player, c, on)
			get_viewport().get_texture().get_image().save_png("res://screenshots/pies_%s_%s.png" % [c, "ajuste" if on else "sin"])
		player.queue_free()
		x += 6.0
	get_tree().quit()


func _build_case(c: String, x: float) -> void:
	var body := StaticBody3D.new()
	add_child(body)
	_box(body, Vector3(x, _base - 0.5, 0), Vector3(4, 1, 4), Vector3.ZERO)
	match c:
		"escalon": # bajo el pie izquierdo (+X del modelo, que con el jugador sin girar es −X del mundo)
			_box(body, Vector3(x - 1.0, _base + 0.1, 0), Vector3(1.88, 0.2, 2), Vector3.ZERO)
		"rampa":
			_box(body, Vector3(x, _base - 0.3, 0), Vector3(4, 0.6, 3), Vector3(0, 0, deg_to_rad(20)))


func _box(body: StaticBody3D, pos: Vector3, size: Vector3, rot: Vector3) -> void:
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	cs.shape = shape
	cs.position = pos
	cs.rotation = rot
	body.add_child(cs)
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.position = pos
	mi.rotation = rot
	body.add_child(mi)


func _report(player: Player, c: String, on: bool) -> void:
	var skel: Skeleton3D = player._model.find_child(CharacterModel.SKELETON, true, false)
	await skel.skeleton_updated # la pose ya con los modificadores (antes de eso se lee la de la animación)
	var space := get_world_3d().direct_space_state
	var out := []
	for side in ["LeftFoot", "RightFoot"]:
		var f: Vector3 = skel.global_transform * skel.get_bone_global_pose(skel.find_bone(side)).origin
		var hit := space.intersect_ray(PhysicsRayQueryParameters3D.create(f + Vector3.UP * 0.6, f + Vector3.DOWN * 1.5, 0xFFFFFFFF, [player.get_rid()]))
		out.push_back("%s %.3f (x %.2f)" % [side, f.y - hit.position.y if hit else -1.0, f.x])
	print("pies %-8s %-11s %s" % [c, "con ajuste" if on else "sin ajuste", "  ".join(out)])
