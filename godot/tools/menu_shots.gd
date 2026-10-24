extends Node
## Herramienta: capturas de la carga y los menús (screenshots/menu_*.png). Uso: godot res://tools/menu_shots.tscn
## Para no recorrer todo, se nombran las secciones que interesan: `godot res://tools/menu_shots.tscn -- personaje`
## (garaje, personaje, menus, juego; varias separadas por espacio). Carga y portada se capturan siempre.

var _main: Node
var _only := OS.get_cmdline_user_args()


func _want(section: String) -> bool:
	return _only.is_empty() or section in _only


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	Settings.persist = false
	_main = load("res://scenes/main.tscn").instantiate()
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
	get_tree().quit()


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://screenshots")
	get_viewport().get_texture().get_image().save_png("res://screenshots/menu_%s.png" % name)
