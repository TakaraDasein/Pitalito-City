class_name CameraRig
extends Node3D
## Cámara en tercera persona: pivote con yaw/pitch + SpringArm3D, que se acorta solo contra paredes
## (lo que en la web resolvía CameraSystem.js a mano). Sigue a `target` con suavizado.

const SENSITIVITY := 0.0025

var target: Node3D
## false en menús y pausa: el ratón queda libre y no mueve la cámara.
var input_enabled := true
var yaw := 0.0
var pitch := -0.25
## Blanco fijado del combate: la cámara gira sola hasta encuadrarlo (como en Dark Souls).
var lock_target: Node3D
## Apuntar con un arma de fuego (0 o 1, lo pone el jugador): brazo corto sobre el hombro derecho y menos campo de
## visión (FirearmsConfig.AIM_CAMERA). Se mezcla suave.
var aim := 0.0
var _aim_k := 0.0
var _base_length := 2.4
var _base_fov := 65.0
## Temblor (modelo de "trauma"): sube con cada golpe y baja solo; el desplazamiento es trauma² para que los
## golpes leves apenas se noten y los fuertes sí.
var _trauma := 0.0
var _shake_t := 0.0
var _arm: SpringArm3D
var camera: Camera3D


func _ready() -> void:
	top_level = true
	_arm = SpringArm3D.new()
	_arm.collision_mask = 1 | 16
	_arm.margin = 0.3
	add_child(_arm)
	camera = Camera3D.new()
	camera.far = 30000.0
	camera.fov = 65.0
	_arm.add_child(camera)


## Distancia y altura del brazo según lo que se sigue (a pie o en carro).
func follow(node: Node3D, distance: float, height: float) -> void:
	target = node
	_base_length = distance
	_arm.spring_length = distance
	_arm.position.y = height
	_arm.clear_excluded_objects()
	if node is CollisionObject3D:
		_arm.add_excluded_object(node.get_rid())


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var k := SENSITIVITY * Settings.sensitivity
		yaw -= event.relative.x * k
		pitch = clampf(pitch - event.relative.y * k * (-1.0 if Settings.invert_y else 1.0), -1.2, 0.5)
	elif event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _process(delta: float) -> void:
	if lock_target and target:
		var to := lock_target.global_position - target.global_position
		yaw = lerp_angle(yaw, atan2(-to.x, -to.z), minf(1.0, 6.0 * delta))
	rotation = Vector3(pitch, yaw, 0.0)
	var ac: Dictionary = FirearmsConfig.AIM_CAMERA
	var real_dt := delta / maxf(Engine.time_scale, 0.01)
	_aim_k = move_toward(_aim_k, aim, real_dt * float(ac.speed) * 0.5)
	if camera and (_aim_k > 0.0 or aim > 0.0):
		var k := smoothstep(0.0, 1.0, _aim_k)
		_arm.spring_length = lerpf(_base_length, float(ac.distance), k)
		_arm.position.x = float(ac.shoulder) * k
		camera.fov = lerpf(_base_fov, float(ac.fov), k)
		if _aim_k == 0.0:
			_arm.position.x = 0.0
	if _trauma > 0.0 and camera:
		# tiempo real: el temblor sigue durante el hitstop
		var real := delta / maxf(Engine.time_scale, 0.01)
		_shake_t += real * 38.0
		var k := _trauma * _trauma
		camera.h_offset = sin(_shake_t * 1.3) * 0.09 * k
		camera.v_offset = sin(_shake_t * 1.9 + 1.1) * 0.07 * k
		camera.rotation.z = sin(_shake_t * 1.1 + 2.3) * 0.025 * k
		_trauma = maxf(0.0, _trauma - real * 1.6)
		if _trauma == 0.0:
			camera.h_offset = 0.0
			camera.v_offset = 0.0
			camera.rotation.z = 0.0
	if target == null:
		return
	global_position = global_position.lerp(target.global_position, minf(1.0, 14.0 * delta))


## Sacude la cámara (0..1; se acumula hasta 1).
func shake(amount: float) -> void:
	_trauma = minf(1.0, _trauma + amount)
