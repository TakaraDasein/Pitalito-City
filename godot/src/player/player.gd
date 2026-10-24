class_name Player
extends CharacterBody3D
## Jugador a pie: física de CharacterBody3D (Jolt) sobre la colisión real del relieve y los edificios.
## Animación con AnimationTree: máquina de estados (suelo / aire) y un BlendSpace1D por velocidad.

const WALK := 1.8
const JOG := 4.2
const SPRINT := 7.0
const JUMP := 4.6
const TURN := 12.0
## Escalón más alto que se sube caminando (m): peldaños de la iglesia y de las casas (≤ 0,3), bordillos (0,18).
const STEP_HEIGHT := 0.4
## Agua: a partir de qué profundidad se nada (m sobre los pies) y a qué altura flota el cuerpo bajo la superficie.
const SWIM_DEPTH := 1.15
const FLOAT_AT := 1.3
const SWIM_SPEED := 1.9

var swimming := false

## Cámara de la que se toma el rumbo (la asigna main.gd).
var camera_rig: CameraRig
var _model: Node3D
var _tree: AnimationTree
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")


func _ready() -> void:
	collision_layer = 2
	collision_mask = 1 | 4 | 16
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.3
	capsule.height = 1.8
	shape.shape = capsule
	shape.position.y = 0.9
	add_child(shape)
	floor_snap_length = 0.6
	floor_max_angle = deg_to_rad(50)

	_model = CharacterModel.create()
	if _model == null:
		var mi := MeshInstance3D.new()
		var mesh := CapsuleMesh.new()
		mi.mesh = mesh
		mi.position.y = 1.0
		add_child(mi)
		return
	_model.rotation.y = PI # los modelos de Quaternius miran a +Z; en Godot "adelante" es −Z
	add_child(_model)
	_setup_tree(_model.get_node("AnimationPlayer"))


func _setup_tree(player: AnimationPlayer) -> void:
	var move := AnimationNodeBlendSpace1D.new()
	for p: Array in [["Idle", 0.0], ["Walk", WALK], ["Jog_Fwd", JOG], ["Sprint", SPRINT]]:
		var node := AnimationNodeAnimation.new()
		node.animation = CharacterModel.clip(p[0])
		move.add_blend_point(node, p[1], -1, p[0])
	move.min_space = 0.0
	move.max_space = SPRINT
	var air := AnimationNodeAnimation.new()
	air.animation = CharacterModel.clip("Jump")

	var swim := AnimationNodeBlendSpace1D.new()
	for p: Array in [["Swim_Idle", 0.0], ["Swim_Fwd", SWIM_SPEED]]:
		var node := AnimationNodeAnimation.new()
		node.animation = CharacterModel.clip(p[0])
		swim.add_blend_point(node, p[1], -1, p[0])
	swim.max_space = SWIM_SPEED

	var sm := AnimationNodeStateMachine.new()
	sm.add_node("move", move)
	sm.add_node("air", air)
	sm.add_node("swim", swim)
	for pair: Array in [["Start", "move"], ["move", "air"], ["air", "move"], ["move", "swim"], ["swim", "move"], ["air", "swim"], ["swim", "air"]]:
		var tr := AnimationNodeStateMachineTransition.new()
		tr.xfade_time = 0.2
		sm.add_transition(pair[0], pair[1], tr)

	_tree = AnimationTree.new()
	_tree.tree_root = sm
	_model.add_child(_tree)
	_tree.anim_player = _tree.get_path_to(player)
	_tree.active = true


func _physics_process(delta: float) -> void:
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var yaw := camera_rig.yaw if camera_rig else 0.0
	var dir := Vector3(input.x, 0.0, input.y).rotated(Vector3.UP, yaw)
	var speed := SPRINT if Input.is_action_pressed("sprint") else JOG
	if input.length() < 0.5 and input.length() > 0.0:
		speed = WALK


	var water: Dictionary = WaterSystem.instance.sample(global_position.x, global_position.z) if WaterSystem.instance else {}
	# Se nada donde el cauce es hondo (profundidad estimada del río): el relieve de 25 m marca el cauce a la altura
	# del agua, así que al nadar se deja de pisar el relieve y el fondo es el del río (surface − depth)
	swimming = not water.is_empty() and float(water.depth) > SWIM_DEPTH and global_position.y < float(water.surface) + 0.5
	set_collision_mask_value(5, not swimming)
	if swimming:
		_swim(dir, water, delta)
		return
	# La gravedad, solo fuera del agua (nadando la maneja el resorte de flotación; aplicada antes, el cuerpo
	# quedaba medio metro más hondo)
	if not is_on_floor():
		velocity.y -= _gravity * delta
	elif Input.is_action_just_pressed("jump"):
		velocity.y = JUMP
	if not water.is_empty() and float(water.surface) > global_position.y + 0.2:
		speed *= 0.55 # caminar con el agua a las rodillas
	var target := dir * speed
	velocity.x = move_toward(velocity.x, target.x, 30.0 * delta)
	velocity.z = move_toward(velocity.z, target.z, 30.0 * delta)
	_step_up(delta)
	move_and_slide()

	if dir.length() > 0.05:
		var want := atan2(-dir.x, -dir.z)
		rotation.y = lerp_angle(rotation.y, want, minf(1.0, TURN * delta))

	# Red de seguridad: si algo falla con la colisión, nunca quedar bajo el relieve (salvo nadando en el río)
	var ground := WorldData.height(global_position.x, global_position.z)
	if not swimming and global_position.y < ground - 2.0:
		global_position.y = ground + 0.5
		velocity.y = 0.0

	if _tree:
		var sm: AnimationNodeStateMachinePlayback = _tree.get("parameters/playback")
		sm.travel("move" if is_on_floor() else "air")
		_tree.set("parameters/move/blend_position", Vector2(velocity.x, velocity.z).length())


## Nadar: flota con la cabeza afuera (resorte hacia surface − FLOAT_AT), avanza despacio y la corriente arrastra.
## Espacio sube a la orilla (impulso), por si el borde es alto.
func _swim(dir: Vector3, water: Dictionary, delta: float) -> void:
	var target_y: float = maxf(float(water.surface) - FLOAT_AT, float(water.surface) - float(water.depth))
	velocity.y = lerpf(velocity.y, (target_y - global_position.y) * 3.0, minf(1.0, 6.0 * delta))
	var flow: Vector3 = water.flow
	var want := dir * SWIM_SPEED + flow * WaterSystem.CURRENT * 0.8
	velocity.x = move_toward(velocity.x, want.x, 6.0 * delta)
	velocity.z = move_toward(velocity.z, want.z, 6.0 * delta)
	if Input.is_action_just_pressed("jump"):
		velocity.y = JUMP
	move_and_slide()
	if dir.length() > 0.05:
		rotation.y = lerp_angle(rotation.y, atan2(-dir.x, -dir.z), minf(1.0, TURN * 0.5 * delta))
	if _tree:
		var sm: AnimationNodeStateMachinePlayback = _tree.get("parameters/playback")
		sm.travel("swim")
		_tree.set("parameters/swim/blend_position", Vector2(velocity.x, velocity.z).length())


## Subir escalones: CharacterBody3D se detiene ante cualquier cara vertical, aunque sea un peldaño de 18 cm.
## Si el paso horizontal choca, se prueba el mismo paso elevado STEP_HEIGHT y luego se baja hasta el piso; vale
## solo si se llega a una superficie caminable. Técnica estándar con test_move (sin física aparte).
func _step_up(delta: float) -> void:
	if not is_on_floor():
		return
	var motion := Vector3(velocity.x, 0.0, velocity.z) * delta
	if motion.length() < 0.0005:
		return
	var xf := global_transform
	if not test_move(xf, motion):
		return # nada adelante: el paso normal basta
	var up := Vector3.UP * STEP_HEIGHT
	if test_move(xf, up):
		return # techo encima
	var raised := xf.translated(up)
	# Un poco más largo que el paso: la cápsula tiene que quedar encima del borde del peldaño, no rozándolo
	var reach := motion.normalized() * maxf(motion.length(), 0.12)
	if test_move(raised, reach):
		return # también choca arriba: es una pared, no un escalón
	var moved := raised.translated(reach)
	var hit := KinematicCollision3D.new()
	if not test_move(moved, -up * 1.05, hit):
		return # no hay piso al otro lado (sería bajar al vacío)
	if hit.get_normal().angle_to(Vector3.UP) > floor_max_angle:
		return
	global_position = moved.origin + hit.get_travel()


## Coloca al jugador sobre el relieve en (x, z) mirando a `heading` (rad, convención de la web).
func place(x: float, z: float, heading := 0.0) -> void:
	global_position = Vector3(x, WorldData.height(x, z) + 0.2, z)
	rotation.y = heading
	velocity = Vector3.ZERO
