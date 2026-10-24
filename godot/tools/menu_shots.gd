extends Node
## Herramienta: capturas de la carga y los menús (screenshots/menu_*.png). Uso: godot res://tools/menu_shots.tscn

var _main: Node


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
	_main._menus.open("garaje")
	await get_tree().create_timer(1.0).timeout
	await _shot("garaje")
	_main._menus._garage_show(_main._menus._garage_types.find("chiva"))
	_main._menus._paint("chiva", "#d62828")
	await get_tree().create_timer(1.0).timeout
	await _shot("garaje_chiva")
	_main._menus.open("creditos")
	await get_tree().create_timer(0.5).timeout
	await _shot("creditos")
	_main._menus.open("opciones")
	await get_tree().create_timer(0.5).timeout
	await _shot("opciones")
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
	_main._enter_vehicle()
	Input.action_press("move_forward")
	await get_tree().create_timer(3.0).timeout
	await _shot("manejando")
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
