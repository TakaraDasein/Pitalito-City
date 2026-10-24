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
		add_child(wheel)
		var node: Node3D = w.node
		node.reparent(wheel, false)
		node.transform = Transform3D(w.basis, Vector3.ZERO)


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
	apply_torque(right * -angular_velocity.dot(right) * 4.0 * inertia)
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
	global_transform = Transform3D(Basis(Vector3.UP, heading), Vector3(x, WorldData.height(x, z) + 0.6, z))
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO


## Punto de bajada: al lado izquierdo del conductor, sobre el relieve.
func exit_point() -> Vector3:
	var p: Vector3 = global_position + global_basis.x * (spec.width * 0.5 + 0.8)
	return Vector3(p.x, WorldData.height(p.x, p.z), p.z)


func speed_kmh() -> float:
	return linear_velocity.length() * 3.6
