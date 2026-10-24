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
## Sentado en una banca: sin física ni control hasta que termina de levantarse.
var sitting := false
var _standing_t := 0.0  # > 0 mientras dura el clip de levantarse
## Subir o bajar de un vehículo en curso: { phase, t, dur, from, to, rot0, rot1, done }
var _mount := {}

## Combate (CombatSystem): el mismo Combatant que los enemigos. A pie hay dos modos que no se pisan: arma guardada
## (construir, interactuar) y arma en mano (pelear); X cambia entre los dos, como en la web.
var combat: Combatant
var armed := false
var _weapon_index := 1   # machete
var _weapon_slot: BoneAttachment3D
var _dead_t := 0.0
var _push := Vector3.ZERO
var _push_applied := Vector3.ZERO  # lo que se sumó del empujón el cuadro anterior (se quita antes de acelerar)
var _recoil := 0.0       # sacudida del cuerpo al recibir sin aturdirse (rad, vuelve sola)
var _lunge_t := 0.0      # medio paso adelante del golpe en curso

## Cámara de la que se toma el rumbo (la asigna main.gd).
var camera_rig: CameraRig
var _model: Node3D
var _tree: AnimationTree
var _rig: CharacterRig
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")


func _ready() -> void:
	collision_layer = 2
	collision_mask = 1 | 4 | 8 | 16 # 8: personas (enemigos)
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.3
	capsule.height = 1.8
	shape.shape = capsule
	shape.position.y = 0.9
	add_child(shape)
	floor_snap_length = 0.6
	floor_max_angle = deg_to_rad(50)

	apply_look()
	combat = Combatant.new(self, CombatConfig.PLAYER, "manos", "player", "Tú")
	combat.on_trigger = _on_combat


## (Re)arma el modelo con la apariencia de Settings.look: al entrar y al salir del creador de personaje.
func apply_look() -> void:
	var was_visible := true
	if _model:
		was_visible = _model.visible
		_model.queue_free()
		_tree = null
		_rig = null
	_model = CharacterModel.create()
	if _model == null:
		var mi := MeshInstance3D.new()
		var mesh := CapsuleMesh.new()
		mi.mesh = mesh
		mi.position.y = 1.0
		add_child(mi)
		return
	_model.rotation.y = PI # los modelos de Quaternius miran a +Z; en Godot "adelante" es −Z
	_model.visible = was_visible
	add_child(_model)
	_setup_tree(_model.get_node("AnimationPlayer"))
	_rig = CharacterRig.attach(_model.find_child(CharacterModel.SKELETON, true, false))
	_weapon_slot = null
	if armed:
		_show_weapon(CombatConfig.ARSENAL[_weapon_index])
	if _rig:
		_rig.exclude = [get_rid()]


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
	# sentarse: entrar → quieto (en bucle) → salir; las de entrar y salir pasan solas al terminar el clip
	for p: Array in [["sit_enter", "Sitting_Enter"], ["sit", "Sitting_Idle"], ["sit_exit", "Sitting_Exit"]]:
		var node := AnimationNodeAnimation.new()
		node.animation = CharacterModel.clip(p[1])
		sm.add_node(p[0], node)
	var interact := AnimationNodeAnimation.new()
	interact.animation = CharacterModel.clip("Interact")
	sm.add_node("interact", interact)
	var pick := AnimationNodeAnimation.new()
	pick.animation = CharacterModel.clip("PickUp_Table")
	sm.add_node("pickup", pick)
	for pair: Array in [["move", "sit_enter", false], ["sit_enter", "sit", true], ["sit", "sit_exit", false], ["sit_exit", "move", true],
			["move", "interact", false], ["interact", "move", true], ["interact", "sit_enter", false],
			["move", "pickup", false], ["pickup", "move", true]]:
		var t := AnimationNodeStateMachineTransition.new()
		t.xfade_time = 0.25
		if pair[2]:
			t.switch_mode = AnimationNodeStateMachineTransition.SWITCH_MODE_AT_END
			t.advance_mode = AnimationNodeStateMachineTransition.ADVANCE_MODE_AUTO
		sm.add_transition(pair[0], pair[1], t)
	for pair: Array in [["Start", "move"], ["move", "air"], ["air", "move"], ["move", "swim"], ["swim", "move"], ["air", "swim"], ["swim", "air"]]:
		var tr := AnimationNodeStateMachineTransition.new()
		tr.xfade_time = 0.2
		sm.add_transition(pair[0], pair[1], tr)

	# combate: un nodo por clip ("c_<clip>"); el de ataque se estira a lo que dura el golpe (_on_combat)
	var clips := ["Roll", "Hit_Chest", "Hit_Head", "Death01", "Sword_Block"]
	for w: Dictionary in CombatConfig.WEAPONS.values():
		for c: String in w.combo:
			if not c in clips:
				clips.push_back(c)
	for c: String in clips:
		if not player.has_animation(CharacterModel.clip(c)):
			continue
		var node := AnimationNodeAnimation.new()
		node.animation = CharacterModel.clip(c)
		node.use_custom_timeline = true
		node.timeline_length = player.get_animation(CharacterModel.clip(c)).length
		node.stretch_time_scale = true
		node.loop_mode = Animation.LOOP_LINEAR if c == "Sword_Block" else Animation.LOOP_NONE
		sm.add_node("c_" + c, node)
	var combat_nodes: Array = clips.filter(func(c): return sm.has_node("c_" + c)).map(func(c): return "c_" + c)
	for a: String in combat_nodes + ["move"]:
		for b: String in combat_nodes + ["move"]:
			if a != b and not (a == "move" and b == "move"):
				var tr := AnimationNodeStateMachineTransition.new()
				tr.xfade_time = 0.1
				sm.add_transition(a, b, tr)

	_tree = AnimationTree.new()
	_tree.tree_root = sm
	_model.add_child(_tree)
	_tree.anim_player = _tree.get_path_to(player)
	_tree.active = true


func _physics_process(delta: float) -> void:
	if not _mount.is_empty():
		_mounting(delta)
		return
	if sitting or _standing_t > 0.0:
		_seated(delta)
		return
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var yaw := camera_rig.yaw if camera_rig else 0.0
	var dir := Vector3(input.x, 0.0, input.y).rotated(Vector3.UP, yaw)
	var speed := SPRINT if Input.is_action_pressed("sprint") else JOG
	if input.length() < 0.5 and input.length() > 0.0:
		speed = WALK
	# combate: rodando manda el impulso; atacando, aturdido o muerto no se camina; cubriéndose, despacio
	var rolling := combat.state == Combatant.State.ROLL
	if combat.state in [Combatant.State.ATTACK, Combatant.State.HIT, Combatant.State.DEAD]:
		dir = Vector3.ZERO
	elif combat.guarding:
		speed = minf(speed, JOG) * 0.45
	_combat_tick(delta)


	var water: Dictionary = WaterSystem.instance.sample(global_position.x, global_position.z) if WaterSystem.instance else {}
	# Se nada donde el cauce es hondo (profundidad estimada del río): el relieve de 25 m marca el cauce a la altura
	# del agua, así que al nadar se deja de pisar el relieve y el fondo es el del río (surface − depth)
	swimming = not water.is_empty() and float(water.depth) > SWIM_DEPTH and global_position.y < float(water.surface) + 0.5
	set_collision_mask_value(5, not swimming)
	_update_rig()
	# nadando el arma no se ve (va a la espalda) ni se usa
	if _weapon_slot:
		_weapon_slot.visible = not swimming
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
	# el empujón no es velocidad propia: se quita el del cuadro anterior antes de acelerar (si no, se acumulaba
	# cuadro a cuadro y un golpe mandaba al jugador a 15 m)
	velocity -= _push_applied
	velocity.x = move_toward(velocity.x, target.x, 30.0 * delta)
	velocity.z = move_toward(velocity.z, target.z, 30.0 * delta)
	if _lunge_t > 0.0 and combat.state == Combatant.State.ATTACK:
		_lunge_t -= delta
		var f := -global_basis.z * float(CombatConfig.FEEL.lunge)
		velocity.x = f.x
		velocity.z = f.z
	if rolling:
		var r := combat.roll_step(delta) / maxf(delta, 0.0001)
		velocity.x = r.x
		velocity.z = r.z
	velocity += _push
	_push_applied = _push
	_push = _push.lerp(Vector3.ZERO, minf(1.0, delta * 8.0))
	_step_up(delta)
	move_and_slide()

	var lock := combat.lock_target
	if lock and lock.is_alive() and not rolling:
		# con blanco fijado el personaje encara al enemigo aunque camine de lado
		var to := lock.body.global_position - global_position
		rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), minf(1.0, TURN * delta))
	elif dir.length() > 0.05:
		var want := atan2(-dir.x, -dir.z)
		rotation.y = lerp_angle(rotation.y, want, minf(1.0, TURN * delta))

	# Red de seguridad: si algo falla con la colisión, nunca quedar bajo el relieve (salvo nadando en el río)
	var ground := WorldData.height(global_position.x, global_position.z)
	if not swimming and global_position.y < ground - 2.0:
		global_position.y = ground + 0.5
		velocity.y = 0.0

	if _tree and combat.state == Combatant.State.IDLE and not combat.guarding:
		var sm: AnimationNodeStateMachinePlayback = _tree.get("parameters/playback")
		sm.travel("move" if is_on_floor() else "air")
		_tree.set("parameters/move/blend_position", Vector2(velocity.x, velocity.z).length())


## Subir al vehículo, sin cortes: camina hasta la puerta del conductor, la abre (no en la moto), y se sienta
## deslizándose al asiento mientras gira hacia el frente del vehículo. `done` se llama al quedar sentado: ahí
## main.gd pasa al conductor sentado del vehículo, que sigue con el clip de manejar.
func mount(v: Vehicle, done: Callable) -> void:
	_holster()
	velocity = Vector3.ZERO
	collision_layer = 0
	collision_mask = 0
	var door := v.door_world()
	var to_door := door - global_position
	to_door.y = 0.0
	var fwd := v.global_basis.z
	var out := (door - v.global_position)
	out.y = 0.0
	var steps: Array = []
	if to_door.length() > 0.2:
		steps.push_back({"phase": "walk", "dur": clampf(to_door.length() / WALK, 0.2, 2.5), "from": global_position, "to": door,
			"rot0": rotation.y, "rot1": atan2(-to_door.x, -to_door.z)})
	if v.two_wheels and v.is_fallen():
		# caída: primero la levanta (al costado, de frente a ella) y después se monta como siempre
		var c := v.global_position
		var near := c + (global_position - c).normalized() * 0.9
		near.y = WorldData.height(near.x, near.z)
		var to_near := near - global_position
		to_near.y = 0.0
		steps = []
		if to_near.length() > 0.2:
			steps.push_back({"phase": "walk", "dur": clampf(to_near.length() / WALK, 0.2, 2.5), "from": global_position, "to": near,
				"rot0": rotation.y, "rot1": atan2(-to_near.x, -to_near.z)})
		var at_moto := c - near
		steps.push_back({"phase": "levantar", "dur": 1.3, "from": near, "to": near, "rot0": atan2(-to_near.x, -to_near.z) if to_near.length() > 0.2 else rotation.y,
			"rot1": atan2(-at_moto.x, -at_moto.z)})
		_mount = {"steps": steps, "i": -1, "t": 0.0, "done": done, "vehicle": v}
		_next_step()
		return
	if v.two_wheels:
		_moto_steps(v, steps, door, false)
		_mount = {"steps": steps, "i": -1, "t": 0.0, "done": done, "vehicle": v}
		_next_step()
		return
	if not v.spec.has("seat"):
		# Car Kit: una sola pieza, sin puerta que abrir ni asiento: el gesto de abrir junto a la carrocería y
		# desaparece al "entrar" (el conductor no se ve tras los vidrios oscuros); así no atraviesa la lata
		var face := atan2(out.x, out.z)
		steps.push_back({"phase": "open", "dur": 0.8, "from": door, "to": door,
			"rot0": atan2(-to_door.x, -to_door.z) if to_door.length() > 0.2 else rotation.y, "rot1": face})
		var near := door.lerp(Vector3(v.global_position.x, door.y, v.global_position.z), 0.12)
		steps.push_back({"phase": "ocultar", "dur": 0.25, "from": door, "to": near, "rot0": face, "rot1": face})
		_mount = {"steps": steps, "i": -1, "t": 0.0, "done": done, "vehicle": v}
		_next_step()
		return
	if v.has_door_leaf():
		steps.push_back({"phase": "open", "dur": 0.9, "from": door, "to": door, "rot0": atan2(-to_door.x, -to_door.z) if to_door.length() > 0.2 else rotation.y,
			"rot1": atan2(out.x, out.z)}) # de frente a la puerta (hacia el vehículo)
	var from := door
	if v.spec.has("step"):
		# vehículo alto: primero pisa el estribo, de frente a la cabina
		from = v.step_world()
		steps.push_back({"phase": "subir", "dur": 0.6, "from": door, "to": from,
			"rot0": atan2(-to_door.x, -to_door.z) if to_door.length() > 0.2 else rotation.y, "rot1": atan2(out.x, out.z)})
	# de espaldas al asiento, baja y entra; termina mirando al frente del vehículo
	steps.push_back({"phase": "enter", "dur": 1.0, "from": from, "to": v.seat_world(), "rot0": atan2(-out.x, -out.z), "rot1": atan2(-fwd.x, -fwd.z)})
	_mount = {"steps": steps, "i": -1, "t": 0.0, "done": done, "vehicle": v}
	_next_step()


## Bajar: aparece sentado en el asiento y sale con el clip de levantarse hasta quedar de pie junto a la puerta.
func dismount(v: Vehicle, done: Callable) -> void:
	velocity = Vector3.ZERO
	collision_layer = 0
	collision_mask = 0
	var fwd := v.global_basis.z
	var door := v.door_world()
	var out := door - v.global_position
	out.y = 0.0
	if v.two_wheels:
		var steps: Array = []
		_moto_steps(v, steps, door, true)
		global_position = steps[0].from
		rotation.y = atan2(-fwd.x, -fwd.z)
		_mount = {"steps": steps, "i": -1, "t": 0.0, "done": done, "vehicle": v}
		_next_step()
		return
	if not v.spec.has("seat"):
		# Car Kit: aparece pegado a la carrocería y se aparta un paso
		var near := door.lerp(Vector3(v.global_position.x, door.y, v.global_position.z), 0.12)
		global_position = near
		rotation.y = atan2(-out.x, -out.z)
		_mount = {"steps": [{"phase": "exit", "dur": 0.45, "from": near, "to": door, "rot0": rotation.y, "rot1": rotation.y}],
			"i": -1, "t": 0.0, "done": done, "vehicle": v}
		_next_step()
		return
	global_position = v.seat_world()
	rotation.y = atan2(-fwd.x, -fwd.z)
	if _tree:
		_playback().start("sit")
	var steps: Array = [{"phase": "exit", "dur": 1.1, "from": v.seat_world(), "to": door, "rot0": rotation.y, "rot1": atan2(-out.x, -out.z)}]
	if v.spec.has("step"):
		# se levanta sobre el estribo y de ahí baja al suelo
		steps[0].to = v.step_world()
		steps.push_back({"phase": "bajar", "dur": 0.5, "from": steps[0].to, "to": door, "rot0": steps[0].rot1, "rot1": steps[0].rot1})
	_mount = {"steps": steps,
		"i": -1, "t": 0.0, "done": done, "vehicle": v}
	v.set_door(true, 0.3)
	_next_step()


## Moto (como #horcajadas de la web): de pie a la izquierda, el cuerpo pasa al centro mientras la pierna
## derecha sube por encima de la parte trasera del sillín y la izquierda sigue en el suelo; luego baja al
## asiento. Bajarse es lo mismo al revés.
func _moto_steps(v: Vehicle, steps: Array, door: Vector3, reverse: bool) -> void:
	var fwd := v.global_basis.z
	var face := atan2(-fwd.x, -fwd.z)
	var seat := v.seat_world()
	var under := Vector3(seat.x, WorldData.height(seat.x, seat.z), seat.z)
	var side := Vector3(door.x, under.y, door.z)
	var straddle := {"phase": "pierna", "dur": 1.2, "from": side, "to": under, "rot0": face, "rot1": face,
		"seat": seat, "fwd": fwd, "out": (side - under).normalized(), "reverse": reverse}
	# al final empieza a sentarse (el clip baja la cadera) y entra el conductor sentado de la moto
	var settle := {"phase": "sentar", "dur": 0.35, "from": under, "to": under, "rot0": face, "rot1": face}
	if reverse:
		straddle.from = under
		straddle.to = side
		steps.push_back(straddle)
	else:
		steps.push_back(straddle)
		steps.push_back(settle)


## Pies durante la pierna sobre la moto. k: 0 de pie al lado, 1 a horcajadas.
func _moto_feet(st: Dictionary, k: float) -> void:
	if _rig == null:
		return
	var out: Vector3 = st.out
	var fwd: Vector3 = st.fwd
	var under: Vector3 = st.to if not st.reverse else st.from
	var ankle := Vector3.UP * 0.085
	# izquierdo: da un paso hacia la moto y se queda plantado al costado
	var l_end := under + out * 0.32 + ankle
	var l_start: Vector3 = (st.from if not st.reverse else st.to) + ankle
	_rig.foot_override[0] = l_start.lerp(l_end, smoothstep(0.0, 0.3, k))
	# derecho: curva por encima de la parte trasera del sillín hasta el suelo del otro lado
	var r := smoothstep(0.15, 0.85, k)
	var a := l_start + out * -0.1 - fwd * 0.05
	var b: Vector3 = st.seat + Vector3.UP * 0.55 - fwd * 0.55
	var c := under - out * 0.32 + ankle
	var q := 1.0 - r
	_rig.foot_override[1] = a * q * q + b * 2.0 * q * r + c * r * r


func is_mounting() -> bool:
	return not _mount.is_empty()


func _next_step() -> void:
	# recién levantada la moto: ahora sí, ir a su costado izquierdo y montarse
	if _mount.i >= 0 and _mount.steps[_mount.i].phase == "levantar":
		var v: Vehicle = _mount.vehicle
		var door := v.door_world()
		var to_door := door - global_position
		to_door.y = 0.0
		if to_door.length() > 0.2:
			_mount.steps.push_back({"phase": "walk", "dur": clampf(to_door.length() / WALK, 0.2, 2.0), "from": global_position, "to": door,
				"rot0": rotation.y, "rot1": atan2(-to_door.x, -to_door.z)})
		_moto_steps(v, _mount.steps, door, false)
	_mount.i += 1
	_mount.t = 0.0
	if _mount.i >= _mount.steps.size():
		var done: Callable = _mount.done
		var last: Dictionary = _mount.steps[-1]
		var v: Vehicle = _mount.vehicle
		_mount = {}
		if is_instance_valid(v):
			v.set_door(false) # cierra al quedar sentado, o al salir y quedar de pie
		if last.phase in ["exit", "bajar"] or (last.phase == "pierna" and last.reverse):
			collision_layer = 2
			collision_mask = 1 | 4 | 8 | 16 # 8: personas (enemigos)
		done.call()
		return
	if _tree == null:
		return
	match _mount.steps[_mount.i].phase:
		"open":
			_playback().travel("interact")
			(_mount.vehicle as Vehicle).set_door(true)
		"enter", "sentar":
			_playback().travel("sit")
		"levantar":
			_playback().travel("pickup")
			(_mount.vehicle as Vehicle).lift_up(1.0)
		"exit":
			_playback().travel("move")
		"ocultar":
			visible = false
		"subir", "bajar":
			_playback().travel("move")
			_tree.set("parameters/move/blend_position", WALK * 0.6)


func _mounting(delta: float) -> void:
	var st: Dictionary = _mount.steps[_mount.i]
	_mount.t += delta / float(st.dur)
	var k := smoothstep(0.0, 1.0, minf(_mount.t, 1.0))
	var p: Vector3 = st.from.lerp(st.to, k if st.phase != "walk" else minf(_mount.t, 1.0))
	if st.phase == "walk" or st.phase == "exit":
		p.y = maxf(p.y, WorldData.height(p.x, p.z)) if st.phase == "walk" else p.y
	global_position = p
	# giro: al caminar enseguida hacia la puerta, en lo demás repartido en todo el paso
	var kr := minf(_mount.t * 4.0, 1.0) if st.phase == "walk" else k
	rotation.y = lerp_angle(st.rot0, st.rot1, kr)
	if _tree and st.phase == "walk":
		_playback().travel("move")
		_tree.set("parameters/move/blend_position", WALK)
	if st.phase == "pierna":
		var kk := minf(_mount.t, 1.0)
		var kp: float = (1.0 - kk) if st.reverse else kk
		# el cuerpo llega al centro antes de que la pierna termine de pasar
		global_position = st.from.lerp(st.to, smoothstep(0.0, 0.7, kk) if not st.reverse else smoothstep(0.3, 1.0, kk))
		_moto_feet(st, kp)
		if _tree:
			_playback().travel("move")
			_tree.set("parameters/move/blend_position", 0.0)
	if _rig:
		_rig.feet_enabled = st.phase in ["walk", "pierna"]
		if st.phase != "pierna":
			_rig.foot_override = [null, null]
	if _mount.t >= 1.0:
		if _rig and st.phase == "pierna":
			_rig.foot_override = [null, null]
		_next_step()


## Sentarse en un asiento de LandmarkSystem.seats: se coloca en él (los pies a su altura, mirando a su frente) y
## el clip baja el cuerpo. Sin colisión mientras tanto: la cápsula atravesaría la banca.
func sit(seat: Dictionary) -> void:
	_holster()
	if sitting or _tree == null:
		return
	sitting = true
	velocity = Vector3.ZERO
	collision_layer = 0
	collision_mask = 0
	global_position = Vector3(seat.x, seat.y, seat.z)
	# heading de la web es el giro del cuerpo con su modelo; aquí el modelo va girado PI dentro del cuerpo y eso ya
	# lo compensa (medido: con + PI quedaba mirando al espaldar)
	rotation.y = float(seat.heading)
	_playback().travel("sit")


## Levantarse: el clip de salir, y al terminar un paso al frente antes de volver a tener colisión.
func stand() -> void:
	if not sitting:
		return
	sitting = false
	_standing_t = 1.2
	_playback().travel("move")


func _seated(delta: float) -> void:
	_update_rig()
	if sitting:
		# cualquier intento de caminar o saltar levanta al personaje
		if Input.get_vector("move_left", "move_right", "move_forward", "move_back").length() > 0.5 or Input.is_action_just_pressed("jump"):
			stand()
		return
	_standing_t -= delta
	if _standing_t <= 0.0:
		global_position += -global_basis.z * 0.45 + Vector3.UP * 0.1
		collision_layer = 2
		collision_mask = 1 | 4 | 8 | 16 # 8: personas (enemigos)


func _playback() -> AnimationNodeStateMachinePlayback:
	return _tree.get("parameters/playback")


## Pies al suelo y mirada hacia donde apunta la cámara (un punto lejano en su eje, no la cámara misma).
func _update_rig() -> void:
	if _rig == null:
		return
	_rig.feet_enabled = is_on_floor() and not swimming and not sitting and _standing_t <= 0.0
	_rig.look_enabled = not swimming
	var cam := get_viewport().get_camera_3d()
	if cam:
		_rig.look_point = cam.global_position - cam.global_basis.z * 30.0


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


# ───────────── Combate ─────────────

func _unhandled_input(event: InputEvent) -> void:
	if not CombatConfig.ENABLED or not visible or sitting or is_mounting() or swimming:
		return
	if event.is_action_pressed("combat_toggle"):
		set_armed(not armed)
	elif not armed:
		return
	elif event.is_action_pressed("combat_attack"):
		_attack()
	elif event.is_action_pressed("combat_guard"):
		combat.set_guard(true)
	elif event.is_action_released("combat_guard"):
		combat.set_guard(false)
	elif event.is_action_pressed("combat_roll"):
		_roll()
	elif event.is_action_pressed("combat_lock") and CombatSystem.instance:
		CombatSystem.instance.toggle_lock(combat, camera_rig.yaw if camera_rig else rotation.y)
	elif event.is_action_pressed("combat_cycle"):
		cycle_weapon(1)
	elif event is InputEventMouseButton and event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
		cycle_weapon(1 if event.button_index == MOUSE_BUTTON_WHEEL_DOWN else -1)


## Golpear con ayuda: se gira hacia el enemigo que tiene delante (o el fijado) y, si está un poco lejos, da
## medio paso hacia él al soltar el golpe. Sin enemigo cerca, el golpe va hacia donde se camina o mira la cámara.
func _attack() -> void:
	var t := CombatSystem.instance.assist_target(combat) if CombatSystem.instance else null
	if not combat.is_busy() or combat.phase == "recover":
		if t:
			var to := t.body.global_position - global_position
			rotation.y = atan2(-to.x, -to.z)
		else:
			var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
			if input.length() > 0.1 and camera_rig:
				var d := Vector3(input.x, 0, input.y).rotated(Vector3.UP, camera_rig.yaw)
				rotation.y = atan2(-d.x, -d.z)
	if combat.attack() and t:
		var dist := Vector2(t.body.global_position.x - global_position.x, t.body.global_position.z - global_position.z).length()
		_lunge_t = 0.18 if dist > float(CombatConfig.FEEL.lunge_min) else 0.0


## Guarda el arma sin aviso (al subir a un vehículo o sentarse: con las manos ocupadas no se pelea).
func _holster() -> void:
	if armed:
		armed = false
		combat.set_guard(false)
		if CombatSystem.instance and combat.lock_target:
			CombatSystem.instance.toggle_lock(combat, 0.0)
		combat.set_weapon("manos")
		_show_weapon("")


## Sacar o guardar el arma. Guardada: sin blanco ni guardia.
func set_armed(on: bool) -> void:
	armed = on
	combat.set_guard(false)
	if not on:
		if CombatSystem.instance and combat.lock_target:
			CombatSystem.instance.toggle_lock(combat, 0.0)
		combat.set_weapon("manos")
		_show_weapon("")
	else:
		var id: String = CombatConfig.ARSENAL[_weapon_index]
		combat.set_weapon(id)
		_show_weapon(id)
	if HUD.instance:
		HUD.instance.toast(("En la mano: " + combat.weapon.name) if on else "Arma guardada", 1.4)


func cycle_weapon(step: int) -> void:
	if combat.is_busy():
		return
	_weapon_index = (_weapon_index + step + CombatConfig.ARSENAL.size()) % CombatConfig.ARSENAL.size()
	set_armed(true)


## Cuelga el modelo del arma de la mano derecha (vacío = manos libres).
func _show_weapon(id: String) -> void:
	if _weapon_slot:
		_weapon_slot.queue_free()
		_weapon_slot = null
	_weapon_slot = CharacterModel.attach_weapon(_model, id) if _model else null


## Rueda hacia donde se mueve; quieto, hacia donde mira la cámara.
func _roll() -> void:
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var yaw := camera_rig.yaw if camera_rig else rotation.y
	var dir := Vector3(input.x, 0.0, input.y).rotated(Vector3.UP, yaw) if input.length() > 0.1 else Vector3(-sin(yaw), 0, -cos(yaw))
	dir = dir.normalized()
	if combat.roll(dir):
		rotation.y = atan2(-dir.x, -dir.z)


## Empujón de un golpe (CombatSystem): se suma a la velocidad y se apaga solo.
func push(v: Vector3) -> void:
	_push += Vector3(v.x, 0.0, v.z)


## El cuerpo responde a lo que pasa en el combate: clip del golpe estirado a lo que dura, rodar, aturdirse, morir.
func _on_combat(evt: String, data: Dictionary) -> void:
	if _tree == null:
		return
	var sm: AnimationNodeStateMachine = _tree.tree_root
	var node := ""
	match evt:
		"attack":
			node = "c_" + str(data.clip)
			if AudioSystem.instance:
				AudioSystem.instance.swing(float(combat.weapon.poise) / 30.0)
		"roll":
			node = "c_Roll"
		"hit":
			node = "c_Hit_Head" if data.get("zone", "") == "head" else "c_Hit_Chest"
			_hurt(1.0)
		"flinch":
			_recoil = float(CombatConfig.FEEL.recoil)
			_hurt(0.6)
			return
		"blocked":
			_recoil = float(CombatConfig.FEEL.recoil) * 0.4
			return
		"parry":
			# desvió el golpe: el brazo cede un poco y aviso en pantalla
			_recoil = float(CombatConfig.FEEL.recoil) * 0.6
			if HUD.instance:
				HUD.instance.toast("¡Desviado!", 0.8)
			return
		"parried":
			node = "c_Hit_Chest"
		"tired":
			if HUD.instance:
				HUD.instance.flash_stamina()
			return
		"death":
			_hurt(1.0)
			node = "c_Death01"
			_dead_t = 4.0
			if HUD.instance:
				HUD.instance.toast("Caíste. Te levantas en un momento…", 3.5)
	if node == "" or not sm.has_node(node):
		return
	if data.has("lock"):
		(sm.get_node(node) as AnimationNodeAnimation).timeline_length = float(data.lock)
	_playback().start(node)


## Recibió daño: destello en el borde de la pantalla.
func _hurt(k: float) -> void:
	if HUD.instance:
		HUD.instance.flash_hurt(k)


## Por cuadro: guardia (clip en bucle), volver al movimiento al terminar, y levantarse después de caer.
func _combat_tick(delta: float) -> void:
	if _tree == null:
		return
	var pb := _playback()
	# sacudida: el cuerpo se echa atrás y vuelve (golpe que entra sin aturdir)
	if _model:
		_recoil = move_toward(_recoil, 0.0, delta * float(CombatConfig.FEEL.recoil_back) * maxf(_recoil, 0.05))
		_model.rotation.x = -_recoil
	if combat.state == Combatant.State.DEAD:
		_dead_t -= delta
		if _dead_t <= 0.0:
			combat.revive()
			pb.travel("move")
		return
	# mantener el clic derecho: al terminar otra acción vuelve a cubrirse solo
	if armed and combat.state == Combatant.State.IDLE and not combat.guarding and Input.is_action_pressed("combat_guard"):
		combat.set_guard(true)
	if combat.state == Combatant.State.IDLE:
		if combat.guarding:
			if pb.get_current_node() != "c_Sword_Block":
				pb.travel("c_Sword_Block")
		elif str(pb.get_current_node()).begins_with("c_"):
			pb.travel("move")
	if camera_rig:
		camera_rig.lock_target = combat.lock_target.body if combat.lock_target and combat.lock_target.is_alive() else null
