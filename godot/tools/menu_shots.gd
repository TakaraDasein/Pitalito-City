extends Node
## Herramienta: capturas de la carga y los menús (screenshots/menu_*.png). Uso: godot res://tools/menu_shots.tscn
## Para no recorrer todo, se nombran las secciones que interesan: `godot res://tools/menu_shots.tscn -- personaje`
## (garaje, personaje, menus, juego, pies, banca, subir; varias separadas por espacio). Carga y portada se capturan siempre.

var _main: Node
var _only := OS.get_cmdline_user_args()


func _want(section: String) -> bool:
	return _only.is_empty() or section in _only


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	Settings.persist = false
	_main = load("res://scenes/main.tscn").instantiate()
	_main.skip_mount = true
	_main.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(_main)
	var t0 := Time.get_ticks_msec()
	await get_tree().create_timer(0.4).timeout
	await _shot("carga")
	while _main.state == _main.State.LOADING:
		await get_tree().process_frame
	print("carga con GPU: %.1f s · calidad %s (%s) · GPU %s" % [(Time.get_ticks_msec() - t0) / 1000.0, Settings.quality, Settings.quality_reason, Settings.gpu_name])
	await get_tree().create_timer(2.0).timeout
	await _shot("principal")
	if _want("garaje"):
		_main._menus.open("garaje")
		await get_tree().create_timer(1.0).timeout
		await _shot("garaje")
		_main._menus._garage_show(_main._menus._garage_types.find("chiva"))
		_main._menus._paint("chiva", "#d62828")
		await get_tree().create_timer(1.0).timeout
		await _shot("garaje_chiva")
		_main._menus._garage_show(_main._menus._garage_types.find("sedan"))
		_main._menus._paint("sedan", "#cf534f")
		await get_tree().create_timer(1.0).timeout
		await _shot("garaje_sedan")
	if _want("personaje"):
		_main._menus.open("personaje")
		await get_tree().create_timer(1.0).timeout
		await _shot("personaje")
		# de cerca: la cara (aquí se vio el hundimiento de la piel)
		var cam: Camera3D = _main._menus._char_view.get_camera_3d()
		var cam_xf := cam.transform
		cam.position = Vector3(0, 1.45, 1.1)
		cam.rotation = Vector3(0.12, 0, 0)
		_main._menus._char_model.rotation.y = 0.3
		await get_tree().create_timer(0.6).timeout
		await _shot("personaje_cara")
		cam.transform = cam_xf
		_main._menus._char_set("cuerpo", "b")
		_main._menus._char_set("pelo", "largo")
		_main._menus._char_set("sombrero", false)
		_main._menus._char_set("pelocolor", "castano")
		_main._menus._char_set("ropa", "chaqueta")
		_main._menus._char_set("hombreras", true)
		await get_tree().create_timer(1.0).timeout
		await _shot("personaje_b")
	if _want("menus"):
		_main._menus.open("creditos")
		await get_tree().create_timer(0.5).timeout
		await _shot("creditos")
		_main._menus.open("opciones")
		await get_tree().create_timer(0.5).timeout
		await _shot("opciones")
	if _want("juego"):
		_main._start_playing()
		# a pie junto al carro: el aviso "F · Subir al …"
		var car: Vehicle = _main.vehicle
		_main.player.place(car.global_position.x - car.global_basis.x.x * 2.5, car.global_position.z - car.global_basis.x.z * 2.5)
		await get_tree().create_timer(1.5).timeout
		await _shot("hud_a_pie")
		# ficha de lo que se mira
		_main.camera_rig.yaw += PI * 0.5
		await get_tree().create_timer(0.3).timeout
		_main._show_info()
		await get_tree().create_timer(0.5).timeout
		await _shot("info")
		_main.hud.toggle_help()
		await get_tree().create_timer(0.3).timeout
		await _shot("ayuda")
		_main.hud.toggle_help()
		# manejando, con el velocímetro
		var sp: Dictionary = WorldData.spawn()
		_main.vehicle.place(sp.x, sp.z, sp.heading + PI)
		await get_tree().create_timer(0.5).timeout
		_main._enter_vehicle()
		_main.camera_rig.follow(_main.vehicle, 3.6, 1.2)
		_main.camera_rig.yaw = _main.vehicle.rotation.y + PI * 0.5 # de lado, por la puerta del conductor
		_main.camera_rig.pitch = -0.15
		await get_tree().create_timer(1.0).timeout
		await _shot("conductor")
		var body: Node3D = _main.vehicle.get_node("modelo/body")
		body.visible = false # corte: ver la postura dentro del vehículo
		await get_tree().create_timer(0.3).timeout
		await _shot("conductor_corte")
		body.visible = true
		_main._follow_camera()
		Input.action_press("move_forward")
		await get_tree().create_timer(3.0).timeout
		await _shot("manejando")
		var bus := AudioServer.get_bus_index("Mundo")
		print("audio: motor %.1f Hz · pico del bus Mundo %.1f dB · driver %s" % [_main._audio._freq, AudioServer.get_bus_peak_volume_left_db(bus, 0), AudioServer.get_driver_name() if AudioServer.has_method("get_driver_name") else ProjectSettings.get_setting("audio/driver/driver")])
		Input.action_release("move_forward")
		_main._cam_mode = 2
		_main._follow_camera()
		await get_tree().create_timer(1.5).timeout
		await _shot("aerea")
		_main._cam_mode = 0
		_main._follow_camera()
		_main._pause()
		await get_tree().create_timer(0.5).timeout
		await _shot("pausa")
	if _want("pies"):
		await _feet_shots()
	if _want("banca"):
		await _bench_shots()
	if _want("subir"):
		await _mount_shots()
	get_tree().quit()


## Pies sobre escalones: de pie en mitad de la gradería del coliseo, de lado, con y sin el ajuste de piernas.
## Imprime la altura de cada pie sobre el suelo que tiene debajo (con el ajuste debe quedar cerca de 0,1 m, el
## tobillo).
func _feet_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	var lm: LandmarkSystem = _main.landmarks
	var pie: Node3D = lm.find_child("gradas_coliseo_pie", true, false)
	var top: Node3D = lm.find_child("gradas_coliseo_arriba", true, false)
	if pie == null or top == null:
		print("pies: no está la gradería del coliseo")
		return
	var p := pie.global_position.lerp(top.global_position, 0.35)
	var player: Player = _main.player
	player.place(p.x, p.z)
	player.global_position.y = p.y + 0.6
	var d := top.global_position - pie.global_position
	player.rotation.y = atan2(-d.x, -d.z) + 0.25
	_main.camera_rig.yaw = player.rotation.y + PI * 0.5
	_main.camera_rig.pitch = -0.1
	for on in [false, true]:
		player._rig.active = on
		player._rig._ik.active = on
		await get_tree().create_timer(1.5).timeout
		var skel: Skeleton3D = player._model.find_child(CharacterModel.SKELETON, true, false)
		var space := player.get_world_3d().direct_space_state
		for side in ["LeftFoot", "RightFoot"]:
			var f: Vector3 = skel.global_transform * skel.get_bone_global_pose(skel.find_bone(side)).origin
			var hit := space.intersect_ray(PhysicsRayQueryParameters3D.create(f + Vector3.UP * 0.6, f + Vector3.DOWN * 1.5, 1 | 16, [player.get_rid()]))
			print("pies %s: %s sobre el suelo %.2f m" % ["con ajuste" if on else "sin ajuste", side, f.y - hit.position.y if hit else -1.0])
		await _shot("pies_" + ("ajuste" if on else "sin"))


## Bancas del parque: sentarse (clip de entrar y quieto) y levantarse, de tres cuartos.
func _bench_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	var lm: LandmarkSystem = _main.landmarks
	while not lm.is_ready():
		await get_tree().process_frame
	if lm.seats.is_empty():
		print("banca: no hay asientos")
		return
	var st: Dictionary = lm.seats[0]
	var player: Player = _main.player
	player.place(st.x + 0.7, st.z + 0.7)
	await get_tree().create_timer(0.5).timeout
	print("banca: opción = ", _main._interaction()[1] if not _main._interaction().is_empty() else "ninguna")
	player.sit(st)
	_main.camera_rig.yaw = float(st.heading) + 0.7 # de frente-lado
	_main.camera_rig.pitch = -0.15
	await get_tree().create_timer(2.5).timeout
	await _shot("banca_sentado")
	player.stand()
	await get_tree().create_timer(2.0).timeout
	print("banca: de pie en el suelo = %s, a %.2f m del asiento" % [player.is_on_floor(), Vector2(player.global_position.x - st.x, player.global_position.z - st.z).length()])
	await _shot("banca_de_pie")


## Subir y bajar del vehículo con la coreografía (caminar a la puerta, abrir, sentarse; y al revés).
func _mount_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	_main.skip_mount = false
	var car: Vehicle = _main.vehicle
	var player: Player = _main.player
	var d := car.door_world()
	player.place(d.x + car.global_basis.x.x * 2.0 + car.global_basis.z.x * 2.0, d.z + car.global_basis.x.z * 2.0 + car.global_basis.z.z * 2.0)
	_main.camera_rig.yaw = car.rotation.y + PI * 0.5
	_main.camera_rig.pitch = -0.2
	await get_tree().create_timer(1.0).timeout
	_main._enter_vehicle()
	var t0 := Time.get_ticks_msec()
	var shots := {0.9: "subir_camina", 2.0: "subir_puerta", 3.0: "subir_sienta"}
	for at: float in shots:
		while (Time.get_ticks_msec() - t0) / 1000.0 < at:
			await get_tree().process_frame
		await _shot(shots[at])
	while player.is_mounting():
		await get_tree().process_frame
	print("subir: %.1f s, manejando = %s" % [(Time.get_ticks_msec() - t0) / 1000.0, _main._driving])
	await get_tree().create_timer(0.5).timeout
	await _shot("subir_listo")
	_main._exit_vehicle()
	await get_tree().create_timer(0.5).timeout
	await _shot("bajar")
	while player.is_mounting():
		await get_tree().process_frame
	await get_tree().create_timer(0.5).timeout
	print("bajar: en el suelo = %s, a %.2f m de la puerta" % [player.is_on_floor(), player.global_position.distance_to(car.door_world())])
	await _shot("bajar_listo")
	_main.skip_mount = true


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://screenshots")
	get_viewport().get_texture().get_image().save_png("res://screenshots/menu_%s.png" % name)
