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
	_main._menus.open("opciones")
	await get_tree().create_timer(0.5).timeout
	await _shot("opciones")
	_main._start_playing()
	await get_tree().create_timer(2.0).timeout
	_main._pause()
	await get_tree().create_timer(0.5).timeout
	await _shot("pausa")
	get_tree().quit()


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://screenshots")
	get_viewport().get_texture().get_image().save_png("res://screenshots/menu_%s.png" % name)
