class_name Enemy
extends CharacterBody3D
## Un enemigo de los Restos (FICCIÓN DECLARADA, ver CombatConfig): cuerpo de esqueleto sobre el mismo armazón
## que el jugador + Combatant + la decisión de la web (web/src/entities/combat/Enemy.js, su árbol inline):
## muerto no hace nada; sin nadie a la vista vigila girando despacio; si ve al jugador lo encara, se acerca y a
## distancia de golpe pega (con pausa entre golpes) o, de vez en cuando, se aparta rodando.
##
## No trae combate propio: el mismo Combatant y el mismo CombatSystem que el jugador.

const LAYER := 8          # capa 4 = personas (jugador y enemigos se empujan)
const MASK := 1 | 2 | 4 | 8 | 16

var spec: Dictionary
var ai: Dictionary
var self_c: Combatant
var zone := ""
var target: Combatant      # el jugador, si lo percibe
var dist := INF

var _anim: AnimationPlayer
var _model: Node3D
var _next_swing := 0.0
var _time := 0.0
var _push := Vector3.ZERO
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _dead_t := 0.0


static func create(kind: String, at: Vector3, zone_id := "") -> Enemy:
	var e := Enemy.new()
	e.spec = CombatConfig.ENEMIES.get(kind, CombatConfig.ENEMIES.centinela)
	e.ai = e.spec.ai
	e.zone = zone_id
	e.position = at
	e.rotation.y = randf() * TAU
	return e


func _ready() -> void:
	collision_layer = LAYER
	collision_mask = MASK
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.3
	capsule.height = 1.8
	shape.shape = capsule
	shape.position.y = 0.9
	add_child(shape)
	floor_snap_length = 0.6
	if ResourceLoader.exists(CombatConfig.ENEMY_BODY):
		_model = load(CombatConfig.ENEMY_BODY).instantiate()
		_model.rotation.y = PI
		add_child(_model)
		_anim = AnimationPlayer.new()
		_model.add_child(_anim)
		_anim.root_node = NodePath("..")
		_anim.add_animation_library(CharacterModel.LIB, CharacterModel.library())
		var u: Dictionary = CombatConfig.ENEMY_UNIFORM
		CharacterModel.dress_parts(_model, u.parts, u.sex, u.color)
		_attach_weapon(CombatConfig.WEAPONS[spec.weapon].model)
		_anim.play(CharacterModel.clip("Sword_Idle"))
	self_c = Combatant.new(self, spec.stats, spec.weapon, "faccion", spec.name)
	self_c.on_trigger = _on_combat
	if CombatSystem.instance:
		CombatSystem.instance.add(self_c)


func _exit_tree() -> void:
	if CombatSystem.instance and self_c:
		CombatSystem.instance.remove(self_c)


func _attach_weapon(model: String) -> void:
	var skel: Skeleton3D = _model.find_child(CharacterModel.SKELETON, true, false)
	var path: String = CombatConfig.WEAPON_DIR + model + ".glb"
	if skel == null or skel.find_bone("RightHand") < 0 or not ResourceLoader.exists(path):
		return
	var slot := BoneAttachment3D.new()
	slot.bone_name = "RightHand"
	skel.add_child(slot)
	var w: Node3D = load(path).instantiate()
	w.rotation = CombatConfig.GRIP_ROTATION
	w.position = CombatConfig.GRIP_POSITION
	slot.add_child(w)


func push(v: Vector3) -> void:
	_push += Vector3(v.x, 0.0, v.z)


func _on_combat(evt: String, data: Dictionary) -> void:
	if _anim == null:
		return
	var clip := ""
	match evt:
		"attack": clip = str(data.clip)
		"roll": clip = "Roll"
		"hit": clip = "Hit_Chest"
		"death": clip = "Death01"
	var full := CharacterModel.clip(clip)
	if not _anim.has_animation(full):
		return
	var speed := 1.0
	if data.has("lock"): # el clip dura lo que el golpe
		speed = _anim.get_animation(full).length / maxf(float(data.lock), 0.05)
	_anim.play(full, 0.1, speed)


# ───────────── Percepción y decisión ─────────────

func _perceive() -> void:
	var p: Combatant = CombatSystem.instance.player if CombatSystem.instance else null
	if p == null or not p.is_alive() or not p.body.visible:
		target = null
		dist = INF
		return
	var to := p.body.global_position - global_position
	to.y = 0.0
	dist = to.length()
	# ve de lejos si está delante; de cerca lo oye aunque esté detrás
	var ahead := to.normalized().dot(-global_basis.z) > 0.15
	var sensed := dist <= float(ai.hearing) or (ahead and dist <= float(ai.sight))
	# una vez visto no lo suelta hasta que se aleje bastante (si no, parpadea entre perseguir y vigilar)
	target = p if sensed or (target != null and dist <= float(ai.sight) * 1.4) else null


func _physics_process(delta: float) -> void:
	_time += delta
	var c := self_c
	var move := 0.0
	if c.is_alive():
		_perceive()
		if not c.is_busy():
			if target:
				var to := target.body.global_position - global_position
				rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), minf(1.0, delta * 6.0))
				if dist <= float(ai.attack_distance):
					if randf() < float(ai.dodge) * delta: # de vez en cuando se aparta a un lado
						var side := global_basis.x * (1.0 if randf() < 0.5 else -1.0)
						c.roll(Vector3(side.x, 0, side.z).normalized())
					elif _time >= _next_swing and c.attack():
						_next_swing = _time + float(ai.pause)
				else:
					move = float(ai.speed) * (1.6 if dist > 8.0 else 1.0)
			else:
				rotation.y += delta * 0.35 # vigila: gira despacio sobre su sitio
	else:
		_dead_t += delta
	var fwd := -global_basis.z
	var v := Vector3(fwd.x, 0, fwd.z) * move
	if c.state == Combatant.State.ROLL:
		v = c.roll_step(delta) / maxf(delta, 0.0001)
	velocity.x = v.x + _push.x
	velocity.z = v.z + _push.z
	_push = _push.lerp(Vector3.ZERO, minf(1.0, delta * 8.0))
	if not is_on_floor():
		velocity.y -= _gravity * delta
	move_and_slide()
	var ground := WorldData.height(global_position.x, global_position.z)
	if global_position.y < ground - 2.0:
		global_position.y = ground + 0.5
	# animación de andar / quieto cuando no hay clip de combate en curso
	if _anim and c.is_alive() and not c.is_busy():
		var want := CharacterModel.clip("Walk" if move > 0.0 and move < 4.0 else ("Jog_Fwd" if move > 0.0 else "Sword_Idle"))
		if _anim.current_animation != want:
			_anim.play(want, 0.2)


## Lleva muerto más de `seconds` (para retirarlo).
func dead_for(seconds: float) -> bool:
	return not self_c.is_alive() and _dead_t > seconds
