class_name LandmarkSystem
extends Node3D
## Hitos modelados a mano en la web (Parque Principal, Catedral y Torre San Antonio, Alcaldía La Chapolera, Coliseo,
## Concha Acústica, Villa Olímpica, Patinódromo, Terminal), horneados a GLB en coordenadas del mundo por
## web/tools/bake-godot.mjs. Cada uno es una escena normal de Godot: se puede abrir y retocar en el editor.
## Adaptación a Godot:
##   · colisión = malla de triángulos del propio modelo (escalones, gradas y la escalera de la torre se pisan solos,
##     sin registrar sólidos a mano como SolidWorld en la web);
##   · puertas = hojas como AnimatableBody3D que giran en su bisagra con colisión real (la web intercambia
##     segmentos 2D al abrir);
##   · exclusión = polígonos donde el streamer no dibuja edificios genéricos (los cubre el hito).

const DIR := "res://assets/models/landmarks"
## 90° (la web usa 0,92·90° porque su colisión es 2D): más cerrada, la punta del arco invade el vano y no deja pasar
const OPEN_ANGLE := PI * 0.5

## Polígonos (PackedVector2Array) reservados por hitos. Solo lectura: los consultan los hilos del streamer.
static var exclusions: Array[PackedVector2Array] = []

var doors: Array[Dictionary] = [] # { name, pos, leaves: [{ hinge, sd }], open, angle }
var lights := 0
## Asientos (bancas del parque…), horneados desde las interacciones de la web: { x, y, z, heading } con y = altura
## de los pies del personaje sentado y heading = giro del cuerpo sentado (convención de la web).
var seats: Array[Dictionary] = []


## Carga las exclusiones antes de que el streamer construya el primer tile.
static func load_exclusions() -> void:
	exclusions.clear()
	var path := DIR + "/landmarks.json"
	if not FileAccess.file_exists(path):
		return
	var index: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(path))
	for id: String in index:
		for poly: Array in index[id].exclusion:
			var pts := PackedVector2Array()
			for i in range(0, poly.size() - 1, 2):
				pts.push_back(Vector2(poly[i], poly[i + 1]))
			exclusions.push_back(pts)


static func excluded(p: Vector2) -> bool:
	for poly in exclusions:
		if Geometry2D.is_point_in_polygon(p, poly):
			return true
	return false


## Hitos listos en escena (lo espera la pantalla de carga) y cuántos van, para el progreso.
var loaded := 0
var total := 0
var _queue: Array = [] # rutas pedidas en segundo plano, en orden


func _ready() -> void:
	var path := DIR + "/landmarks.json"
	if not FileAccess.file_exists(path):
		return
	var index: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(path))
	for id: String in index:
		for st: Dictionary in index[id].get("seats", []):
			seats.push_back(st)
		var file := "%s/%s.glb" % [DIR, id]
		if ResourceLoader.exists(file):
			# carga de recursos en hilos: los GLB de los hitos pesan 60 MB y bloqueaban el arranque
			ResourceLoader.load_threaded_request(file)
			_queue.push_back([id, file])
	total = _queue.size()


func is_ready() -> bool:
	return _queue.is_empty()


func _process(_delta: float) -> void:
	# uno por cuadro, cuando su carga termina: armar colisiones y puertas también cuesta
	if _queue.is_empty():
		return
	var id: String = _queue[0][0]
	var file: String = _queue[0][1]
	var st := ResourceLoader.load_threaded_get_status(file)
	if st == ResourceLoader.THREAD_LOAD_IN_PROGRESS:
		return
	_queue.pop_front()
	loaded += 1
	var packed := ResourceLoader.load_threaded_get(file) as PackedScene if st == ResourceLoader.THREAD_LOAD_LOADED else null
	if packed == null:
		push_warning("No se pudo cargar el hito " + file)
		return
	var scene: Node3D = packed.instantiate()
	scene.name = id
	add_child(scene)
	VehicleModel.use_vertex_colors(scene)
	_setup_doors(scene)
	_add_collision(scene)
	_setup_lights(scene)


## Una colisión de triángulos por malla estática; las hojas de las puertas quedan fuera (llevan la suya).
func _add_collision(root: Node3D) -> void:
	for n: Node in root.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		if _in_door(mi):
			continue
		mi.create_trimesh_collision()
		var body := mi.get_child(mi.get_child_count() - 1) as StaticBody3D
		if body:
			body.collision_layer = 1
			for c: Node in body.get_children():
				var sh := (c as CollisionShape3D).shape as ConcavePolygonShape3D
				if sh:
					sh.backface_collision = true # techos, losas y gradas se tocan por las dos caras


func _in_door(n: Node) -> bool:
	var cur := n.get_parent()
	while cur:
		if String(cur.name).contains("__bisagra_"):
			return true
		cur = cur.get_parent()
	return false


## Marcadores "luz_interior" que el hito trae desde la web: una lámpara cálida en cada uno (interiores recorribles).
func _setup_lights(root: Node3D) -> void:
	for n: Node in root.find_children("luz_interior*", "Node3D", true, false):
		var l := OmniLight3D.new()
		l.light_color = Color("#fff1d6")
		l.light_energy = 0.9
		l.omni_range = 11.0
		# "luz_interior_r24": alcance de 24 m (naves grandes como el coliseo)
		var nm := String(n.name)
		if nm.contains("_r"):
			l.omni_range = float(nm.get_slice("_r", 1).to_int())
			l.light_energy = 1.6
		l.omni_attenuation = 1.4 # reparte la luz: sin punto caliente pegado al cielo raso
		l.distance_fade_enabled = true
		l.distance_fade_begin = 60.0
		l.distance_fade_length = 20.0
		(n as Node3D).add_child(l)
		lights += 1


func _setup_doors(root: Node3D) -> void:
	var by_door := {}
	for n: Node in root.find_children("*__bisagra_*", "Node3D", true, false):
		var hinge := n as Node3D
		var door_name := String(hinge.name).get_slice("__bisagra_", 0)
		if not by_door.has(door_name):
			by_door[door_name] = {"name": door_name, "leaves": [], "open": false, "angle": 0.0, "pos": Vector3.ZERO}
		var sd := -1.0 if String(hinge.name).ends_with("izq") else 1.0
		# La hoja gira como AnimatableBody3D propio, puesto en el lugar de la bisagra: el cuerpo animable solo
		# sincroniza su colisión cuando cambia SU transformación (girar un padre no la mueve; medido).
		var body := AnimatableBody3D.new()
		body.name = String(hinge.name) + "_cuerpo"
		body.collision_layer = 1
		var parent := hinge.get_parent()
		parent.add_child(body)
		body.transform = hinge.transform
		hinge.owner = null
		hinge.reparent(body, false)
		hinge.transform = Transform3D()
		for c: Node in hinge.get_children():
			if c is MeshInstance3D:
				var shape := CollisionShape3D.new()
				shape.shape = (c as MeshInstance3D).mesh.create_convex_shape()
				shape.transform = (c as Node3D).transform
				body.add_child(shape)
		by_door[door_name].leaves.push_back({"hinge": body, "sd": sd, "yaw0": body.rotation.y})
	for d: Dictionary in by_door.values():
		var c := Vector3.ZERO
		for l: Dictionary in d.leaves:
			c += (l.hinge as Node3D).global_position
		d.pos = c / d.leaves.size()
		doors.push_back(d)


## Puerta más cercana a `p` dentro de `radius`, o vacío.
func door_near(p: Vector3, radius := 3.5) -> Dictionary:
	var best := {}
	var bd := radius
	for d: Dictionary in doors:
		var dist := Vector2(d.pos.x - p.x, d.pos.z - p.z).length()
		if dist < bd:
			bd = dist
			best = d
	return best


func seat_near(p: Vector3, radius := 1.4) -> Dictionary:
	var best := {}
	var bd := radius
	for st: Dictionary in seats:
		var dist := Vector2(st.x - p.x, st.z - p.z).length()
		if dist < bd and absf(st.y - p.y) < 1.0:
			bd = dist
			best = st
	return best


func toggle(door: Dictionary) -> void:
	door.open = not door.open


func _physics_process(delta: float) -> void:
	for d: Dictionary in doors:
		var target := OPEN_ANGLE if d.open else 0.0
		if absf(target - d.angle) < 0.001:
			continue
		d.angle += (target - d.angle) * minf(1.0, delta * 4.0)
		for l: Dictionary in d.leaves:
			(l.hinge as Node3D).rotation.y = l.yaw0 - l.sd * d.angle # hacia adentro (−Z del marco)
