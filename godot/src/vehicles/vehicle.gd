class_name Vehicle
extends VehicleBody3D
## Vehículo del jugador con física real de Godot (VehicleBody3D + VehicleWheel3D): suspensión, tracción y fricción
## por rueda, en lugar del modelo cinemático de la web. Cualquier vehículo del catálogo (VehiclesConfig).
## Dos ruedas (moto): VehicleBody3D sola se cae de lado. Un control de equilibrio (proporcional-derivativo sobre el
## eje longitudinal) mantiene el cuerpo FÍSICO derecho; lo que se inclina hacia la curva es el modelo visible (moto
## y piloto), con el ángulo de una moto real: tan(inclinación) = v² / (g · radio). Inclinar el cuerpo físico obliga a
## las ruedas a sostenerlo, y VehicleWheel3D no modela eso: se caía (medido).

var spec: Dictionary
var driven := false
## Con puerta del conductor que abre (solo el vehículo del jugador: el tráfico no la necesita y así no paga
## los materiales recortados). Se fija antes de add_child.
var with_doors := false
var _door := {}
## Cielo del que se lee la noche para los faros (lo asigna main.gd en el vehículo del jugador).
var sky: SkySystem
var _lamp: SpotLight3D
var _glow: Array[BaseMaterial3D] = []  # faros, stops y avisos: copias propias, se encienden de noche
var _glow_base: Array[float] = []
var _door_tw: Tween
var two_wheels := false
var lean := 0.0
## Conductor visible (el personaje del jugador sentado con el clip Driving), si el vehículo tiene asiento.
var _driver: Node3D
var _model_xf := Transform3D()


## Crea el vehículo del tipo pedido. Se usa en vez de .new() porque el modelo depende del tipo.
static func create(type: String) -> Vehicle:
	var v := Vehicle.new()
	v.spec = VehiclesConfig.spec(type)
	v.name = v.spec.name
	return v


func _ready() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4 | 16
	mass = spec.mass
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, 0.35, 0)
	var m := VehicleModel.create(spec)
	if m.is_empty():
		return
	add_child(m.visual)
	_model_xf = m.xf
	VehicleModel.customize(m.visual, spec, Settings.paint_of(spec.type), Settings.plate_of(spec.type))
	var size: Vector3 = m.size
	if with_doors:
		_add_lights(m.visual, size, m.base_y)
		_door = VehicleModel.add_doors(m.visual, spec)

	var shape := CollisionShape3D.new()
	var b := BoxShape3D.new()
	b.size = Vector3(size.x, size.y * 0.75, size.z)
	shape.shape = b
	shape.position.y = m.base_y + size.y * 0.55
	add_child(shape)

	# Flotación: ocho puntos en la parte baja de la carrocería; desplaza el 45 % de su caja (el resto es motor y
	# lámina: ESTIMADO). Flota a media altura y la corriente lo arrastra; no se simula que se llene de agua.
	if WaterSystem.instance:
		var pts := []
		for sx: float in [-0.4, 0.4]:
			for sy: float in [0.25, 0.75]:
				for sz: float in [-0.4, -0.13, 0.13, 0.4]:
					pts.push_back(Vector3(size.x * sx, m.base_y + size.y * sy, size.z * sz))
		WaterSystem.instance.add_body(self, pts, size.x * size.y * size.z * 0.45, size.y * 0.25)

	two_wheels = m.wheels.size() == 2
	if two_wheels:
		# centro de masa bajo y algo adelante; las ruedas, más agarre
		center_of_mass = Vector3(0, 0.25, 0.1)
	for w: Dictionary in m.wheels:
		var wheel := VehicleWheel3D.new()
		var front: bool = w.front
		wheel.position = w.pos
		wheel.use_as_steering = front
		wheel.use_as_traction = not front
		wheel.wheel_radius = w.radius
		wheel.suspension_travel = 0.2
		wheel.suspension_stiffness = 40.0
		wheel.wheel_rest_length = 0.15
		wheel.damping_compression = 2.0
		wheel.damping_relaxation = 3.0
		wheel.wheel_friction_slip = 3.5
		# tope de fuerza de cada resorte: el de Godot (6000 N) no aguanta un camión (5–9 t: 12 000–22 000 N por
		# rueda) y la carrocería se hundía hasta el suelo. Tres veces su parte del peso, para los baches.
		wheel.suspension_max_force = maxf(6000.0, float(spec.mass) * 9.8 / m.wheels.size() * 3.0)
		add_child(wheel)
		var node: Node3D = w.node
		node.reparent(wheel, false)
		node.transform = Transform3D(w.basis, Vector3.ZERO)


## Faros del vehículo propio (como Game.headlamp de la web): una luz focal al frente, sin sombras, y los
## materiales con emisión del modelo (faros, stops, aviso del taxi) que brillan más de noche.
func _add_lights(visual: Node3D, size: Vector3, base_y: float) -> void:
	_lamp = SpotLight3D.new()
	_lamp.light_color = Color("#fff2d0")
	_lamp.spot_range = 60.0
	_lamp.spot_angle = 28.0
	_lamp.spot_attenuation = 1.2
	_lamp.light_energy = 0.0
	_lamp.shadow_enabled = false
	_lamp.position = Vector3(0, base_y + size.y * 0.4, size.z * 0.5 + 0.1)
	# SpotLight3D alumbra hacia −Z y el vehículo mira a +Z: media vuelta, y un poco hacia la calle
	_lamp.rotation = Vector3(-0.06, PI, 0)
	add_child(_lamp)
	var seen := {}
	for mi: MeshInstance3D in visual.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var mat := mi.get_active_material(i) as BaseMaterial3D
			if mat == null or not mat.emission_enabled:
				continue
			if not seen.has(mat):
				var own := mat.duplicate() as BaseMaterial3D
				seen[mat] = own
				_glow.push_back(own)
				_glow_base.push_back(own.emission_energy_multiplier)
			mi.set_surface_override_material(i, seen[mat])


func _process(_delta: float) -> void:
	if _lamp == null or sky == null:
		return
	var night := sky.night
	_lamp.light_energy = night * 14.0
	_lamp.visible = night > 0.02
	for k in _glow.size():
		_glow[k].emission_energy_multiplier = _glow_base[k] * (1.0 + night * 5.0)


func _physics_process(delta: float) -> void:
	if two_wheels:
		_balance(delta)
	if not driven:
		engine_force = 0.0
		brake = 2.0
		return
	var throttle := Input.get_action_strength("move_forward") - Input.get_action_strength("move_back")
	var turn := Input.get_action_strength("move_left") - Input.get_action_strength("move_right")
	var speed := linear_velocity.dot(global_basis.z)
	# Menos giro a más velocidad: el carro no se voltea a 50 km/h
	var max_steer: float = spec.max_steer * clampf(1.0 - absf(speed) / 40.0, 0.35, 1.0)
	steering = move_toward(steering, turn * max_steer, 2.5 * delta)
	# Frenar cuando se acelera en sentido contrario a la marcha; tope de velocidad del catálogo
	if throttle * speed < -0.5:
		engine_force = 0.0
		brake = spec.brake
	else:
		var limited: bool = absf(speed) * 3.6 > spec.max_speed
		engine_force = 0.0 if limited else throttle * spec.engine
		brake = spec.brake if Input.is_action_pressed("brake") else 0.0


## Equilibrio de la moto: par sobre el eje longitudinal que lleva la inclinación al objetivo (0 quieta, hacia la
## curva en marcha), con amortiguación. Quieta, además, se sostiene sola (como con el pie en el suelo).
func _balance(delta: float) -> void:
	var fwd := global_basis.z
	var right := global_basis.x
	var speed := linear_velocity.dot(fwd)
	var g: float = ProjectSettings.get_setting("physics/3d/default_gravity")
	var wheelbase := 1.3
	var target := 0.0
	if absf(steering) > 0.01 and absf(speed) > 1.0:
		var radius := wheelbase / tan(absf(steering))
		target = clampf(atan(speed * speed / (g * radius)), 0.0, 0.7) * signf(steering) * signf(speed)
	lean = lerpf(lean, target, minf(1.0, delta * 4.0))
	# cuerpo físico: derecho, con un control firme sobre el balanceo y amortiguación del cabeceo
	var up := global_basis.y
	var roll := atan2(-up.dot(right), up.dot(Vector3.UP))
	var inertia := mass * 0.35
	apply_torque(fwd * (-roll * 220.0 - angular_velocity.dot(fwd) * 30.0) * inertia)
	# cabeceo: corregido también (si no, estacionada se iba de trompa); firme quieta, como si tuviera la pata
	# puesta, y suave en marcha para no pelear con la suspensión
	var pitch := atan2(up.dot(fwd), up.dot(Vector3.UP))
	var hold := 120.0 if absf(speed) < 1.0 and not driven else 25.0
	apply_torque(right * (-pitch * hold - angular_velocity.dot(right) * 4.0) * inertia)
	# modelo visible y piloto: inclinados alrededor del punto de apoyo de las ruedas
	for n: Node3D in [get_node_or_null("modelo"), _driver]:
		if n:
			n.rotation.z = -lean


## Sienta al personaje: modelo con la biblioteca de clips, en el asiento, con el clip de manejar en bucle.
## El modelo de Quaternius mira a +Z, igual que el vehículo en Godot: no hace falta girarlo.
func seat_driver() -> void:
	if _driver or not spec.has("seat"):
		return
	_driver = CharacterModel.create()
	if _driver == null:
		return
	var s: Array = spec.seat
	# el asiento se midió con los pies del muñeco de la web en el piso del vehículo; la cadera del clip Driving
	# queda 0,45 m sobre ese punto (ESTIMADO, ajustado mirando)
	_driver.position = _model_xf * Vector3(s[0], s[1], s[2]) + Vector3(0, -0.05, 0)
	add_child(_driver)
	var anim: AnimationPlayer = _driver.get_node("AnimationPlayer")
	var clip := CharacterModel.clip("Driving")
	if anim.has_animation(clip):
		anim.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
		anim.play(clip)


func unseat_driver() -> void:
	if _driver:
		_driver.queue_free()
		_driver = null


## Coloca el vehículo sobre el relieve en (x, z) mirando a `heading`.
func place(x: float, z: float, heading := 0.0) -> void:
	teleport(Transform3D(Basis(Vector3.UP, heading), Vector3(x, _surface_y(x, z) + 0.6, z)))


## Altura de la superficie real (calzada, andén, puente), no solo del relieve.
func _surface_y(x: float, z: float) -> float:
	var y := WorldData.height(x, z)
	if is_inside_tree():
		var q := PhysicsRayQueryParameters3D.create(Vector3(x, y + 6.0, z), Vector3(x, y - 2.0, z), 1 | 16, [get_rid()])
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		if not hit.is_empty():
			y = maxf(y, hit.position.y)
	return y


## Caída: de lado o de trompa (la moto cuando la tumban).
func is_fallen() -> bool:
	return global_basis.y.dot(Vector3.UP) < 0.8


## Levantarla: congelada mientras gira hasta quedar derecha con el mismo rumbo (lo que hace el personaje con las
## manos, ver Player.mount), y suelta de nuevo en la física al terminar.
func lift_up(dur: float) -> void:
	var f := Vector3(global_basis.z.x, 0, global_basis.z.z)
	if f.length() < 0.1:
		f = Vector3(global_basis.y.x, 0, global_basis.y.z) # de trompa: el frente apunta abajo
	f = f.normalized()
	var p := global_position
	var target := Transform3D(Basis(Vector3.UP, atan2(f.x, f.z)), Vector3(p.x, _surface_y(p.x, p.z) + 0.55, p.z))
	var start := global_transform
	freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
	freeze = true
	var tw := create_tween()
	tw.tween_method(func(k: float): global_transform = start.interpolate_with(target, k), 0.0, 1.0, dur).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func():
		freeze = false
		teleport(target))


## Salto sin arrastre: además del nodo, el estado del servidor de física (si no, el cuerpo arrastraba la posición
## vieja y al primer paso salía disparado: una moto llegó a 65 m/s).
func teleport(xf: Transform3D) -> void:
	global_transform = xf
	if is_inside_tree():
		PhysicsServer3D.body_set_state(get_rid(), PhysicsServer3D.BODY_STATE_TRANSFORM, xf)
		PhysicsServer3D.body_set_state(get_rid(), PhysicsServer3D.BODY_STATE_LINEAR_VELOCITY, Vector3.ZERO)
		PhysicsServer3D.body_set_state(get_rid(), PhysicsServer3D.BODY_STATE_ANGULAR_VELOCITY, Vector3.ZERO)
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO


## Punto de bajada: al lado izquierdo del conductor, sobre el relieve.
## true si hay hoja que abrir (taxi, camioneta); el Willys tiene vano abierto y la moto nada.
func has_door_leaf() -> bool:
	return _door.get("hinge") != null


func set_door(open: bool, dur := 0.45) -> void:
	var h: Node3D = _door.get("hinge")
	if h == null:
		return
	if _door_tw and _door_tw.is_valid():
		_door_tw.kill()
	_door_tw = create_tween()
	_door_tw.tween_property(h, "rotation:y", float(_door.open) if open else 0.0, dur).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT if open else Tween.EASE_IN)


## Asiento del conductor en el mundo (donde quedan los pies del personaje sentado, igual que seat_driver).
func seat_world() -> Vector3:
	var s: Array = spec.get("seat", [0.0, 0.5, 0.0])
	return global_transform * (_model_xf * Vector3(s[0], s[1], s[2]) + Vector3(0, -0.05, 0))


## Junto a la puerta del conductor, a la altura del asiento a lo largo del vehículo, en el suelo.
func door_world() -> Vector3:
	# Car Kit (sin asiento medido): puerta del conductor a la izquierda, algo adelante del centro
	var s: Array = spec.get("seat", [-0.4, 0.5, -float(spec.length) * 0.08])
	var local := _model_xf * Vector3(s[0], 0, s[2])
	local.x = signf(local.x if local.x != 0.0 else 1.0) * (float(spec.width) * 0.5 + 0.6)
	var p := global_transform * local
	return Vector3(p.x, WorldData.height(p.x, p.z), p.z)


## Sobre el estribo (vehículos altos como la chiva): entre la puerta y el asiento, a `step` del suelo.
func step_world() -> Vector3:
	var d := door_world()
	var p := d.lerp(seat_world(), 0.35)
	return Vector3(p.x, d.y + float(spec.step), p.z)


func exit_point() -> Vector3:
	var p: Vector3 = global_position + global_basis.x * (spec.width * 0.5 + 0.8)
	return Vector3(p.x, WorldData.height(p.x, p.z), p.z)


func speed_kmh() -> float:
	return linear_velocity.length() * 3.6
