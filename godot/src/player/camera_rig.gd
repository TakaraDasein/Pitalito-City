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
	if target == null:
		return
	global_position = global_position.lerp(target.global_position, minf(1.0, 14.0 * delta))
