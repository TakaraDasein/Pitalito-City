extends Node3D
## Herramienta: lámina de piezas de un kit para revisarlas (screenshots/piezas.png). Vistas desde +X.
## Uso: godot res://tools/preview_pieces.tscn
const PIECES := ["wall", "wall-window-square", "wall-window-square-detailed", "wall-window-round", "wall-window-round-detailed",
	"wall-doorway-square", "wall-doorway-round", "wall-window-wide-round-detailed", "wall-doorway-wide-round", "wall-corner-column",
	"column", "border", "roof-flat-side", "stairs-closed", "door-rotate-round-a", "plating-detailed-wide"]

func _ready() -> void:
	var z := 0.0
	for p in PIECES:
		var n: Node3D = load("res://assets/models/buildings/%s.glb" % p).instantiate()
		n.position = Vector3(0, 0, z)
		add_child(n)
		var l := Label3D.new()
		l.text = p
		l.font_size = 40
		l.position = Vector3(0.5, -0.4, z)
		l.rotation.y = PI * 0.5
		add_child(l)
		z -= 4.6 if p.contains("wide") or p.contains("stairs") else 2.6
	var cam := Camera3D.new()
	cam.position = Vector3(30, 6, z * 0.5)
	cam.fov = 50
	add_child(cam)
	cam.look_at(Vector3(0, 1.2, z * 0.5))
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.8, 0.9, 0)
	add_child(sun)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("#8aa")
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.6
	add_child(env)
	await get_tree().create_timer(1.0).timeout
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://screenshots")
	get_viewport().get_texture().get_image().save_png("res://screenshots/piezas.png")
	get_tree().quit()
