class_name Enemy
extends CharacterBody3D
## Un enemigo de los Restos (FICCIÓN DECLARADA, ver CombatConfig): cuerpo de esqueleto sobre el mismo armazón
## que el jugador + Combatant + la decisión de la web (web/src/entities/combat/Enemy.js, su árbol inline):
## muerto no hace nada; sin nadie a la vista vigila girando despacio; si ve al jugador lo encara, se acerca y a
## distancia de golpe pega (con pausa entre golpes) o, de vez en cuando, se aparta rodando.
## Pulido de Godot (CombatConfig.PACK y FEEL): solo unos pocos atacan a la vez (turno en CombatSystem) y el
## resto rodea al jugador esperando; avisa antes de pegar (sonido corto); se sacude al recibir; el cuerpo se
## hunde en el suelo un rato después de caer.
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
var _recoil := 0.0
var _circle_dir := 1.0       # hacia qué lado rodea esperando turno
var _circle_flip := 0.0
var _saw_swing := false      # ya decidió si se cubre de este golpe del jugador
var _guard_left := 0.0       # cuánto le queda cubierto
var _guard_delay := -1.0     # reacción: se cubre después de esta espera


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
		CharacterModel.attach_weapon(_model, spec.weapon)
		_anim.play(CharacterModel.clip("Sword_Idle"))
	self_c = Combatant.new(self, spec.stats, spec.weapon, "faccion", spec.name)
	self_c.on_trigger = _on_combat
	if CombatSystem.instance:
		CombatSystem.instance.add(self_c)


func _exit_tree() -> void:
	if CombatSystem.instance and self_c:
		CombatSystem.instance.remove(self_c)


func push(v: Vector3) -> void:
	_push += Vector3(v.x, 0.0, v.z)


func _on_combat(evt: String, data: Dictionary) -> void:
	if _anim == null:
		return
	var clip := ""
	match evt:
		"attack": clip = str(data.clip)
		"roll": clip = "Roll"
		"hit": clip = "Hit_Head" if data.get("zone", "") == "head" else "Hit_Chest"
		"parried": clip = "Hit_Chest"
		"parry": clip = "Sword_Block"
		"flinch", "blocked":
			_recoil = float(CombatConfig.FEEL.recoil) * (0.4 if evt == "blocked" else 1.0)
			return
		"death": clip = "Death01"
	var full := CharacterModel.clip(clip)
	if not _anim.has_animation(full):
		return
	var speed := 1.0
	if data.has("lock"): # el clip dura lo que el golpe
		speed = _anim.get_animation(full).length / maxf(float(data.lock), 0.05)
	_anim.play(full, 0.1, speed)
	if evt == "attack" and AudioSystem.instance:
		# aviso: el tajo suena al empezar la preparación, así se puede leer y esquivar
		AudioSystem.instance.swing(0.7)
	if evt == "death" and CombatSystem.instance:
		CombatSystem.instance.release_turn(self_c)
	if evt == "death":
		_drop_loot()


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
	var move := Vector3.ZERO
	var running := false
	var cs := CombatSystem.instance
	if c.is_alive():
		_perceive()
		if cs and target == null:
			cs.release_turn(c)
		_react(delta)
		if not c.is_busy() and not c.guarding:
			if target:
				var to := target.body.global_position - global_position
				to.y = 0.0
				rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), minf(1.0, delta * 6.0))
				var my_turn := cs.take_turn(c) if cs else true
				var reach := float(ai.attack_distance)
				if my_turn and dist <= reach:
					if randf() < float(ai.dodge) * delta: # de vez en cuando se aparta a un lado
						var side := global_basis.x * (1.0 if randf() < 0.5 else -1.0)
						c.roll(Vector3(side.x, 0, side.z).normalized())
					elif _time >= _next_swing and c.attack():
						_next_swing = _time + float(ai.pause) * randf_range(0.8, 1.3)
						# suelta el turno al pegar: si hay más esperando, se van alternando
						if cs:
							cs.release_turn(c)
				elif my_turn:
					move = to.normalized() * float(ai.speed) * (1.6 if dist > 8.0 else 1.0)
					running = dist > 8.0
				else:
					# sin turno: rodea a distancia, cambiando de lado de vez en cuando (no se amontonan)
					_circle_flip -= delta
					if _circle_flip <= 0.0:
						_circle_flip = randf_range(1.5, 3.5)
						_circle_dir = -_circle_dir if randf() < 0.5 else _circle_dir
					var keep: float = CombatConfig.PACK.circle_distance
					var radial := to.normalized() * clampf(dist - keep, -1.0, 1.0) * float(ai.speed)
					var tangent := to.normalized().cross(Vector3.UP) * _circle_dir * float(CombatConfig.PACK.circle_speed)
					move = radial + tangent
			else:
				rotation.y += delta * 0.35 # vigila: gira despacio sobre su sitio
	else:
		_dead_t += delta
	var v := move
	if c.state == Combatant.State.ROLL:
		v = c.roll_step(delta) / maxf(delta, 0.0001)
	velocity.x = v.x + _push.x
	velocity.z = v.z + _push.z
	_push = _push.lerp(Vector3.ZERO, minf(1.0, delta * 8.0))
	if not is_on_floor():
		velocity.y -= _gravity * delta
	# el cuerpo, después de un rato, se hunde en el suelo (sin colisión) y luego lo retira FactionSystem
	var cp: Dictionary = CombatConfig.CORPSE
	if not c.is_alive() and _dead_t > float(cp.stay):
		collision_layer = 0
		collision_mask = 0
		if _model:
			_model.position.y = -1.9 * minf(1.0, (_dead_t - float(cp.stay)) / float(cp.sink))
	else:
		move_and_slide()
	var ground := WorldData.height(global_position.x, global_position.z)
	if global_position.y < ground - 2.0:
		global_position.y = ground + 0.5
	if _model:
		_recoil = move_toward(_recoil, 0.0, delta * float(CombatConfig.FEEL.recoil_back) * maxf(_recoil, 0.05))
		_model.rotation.x = -_recoil
	# andar / correr / de lado / quieto cuando no hay clip de combate en curso
	if _anim and c.is_alive() and not c.is_busy() and not c.guarding:
		var speed := Vector2(move.x, move.z).length()
		var want := CharacterModel.clip("Sword_Idle")
		if speed > 0.2:
			want = CharacterModel.clip("Jog_Fwd" if running else "Walk")
		if _anim.current_animation != want:
			_anim.play(want, 0.2)


## Al caer suelta lo que llevaba (LootConfig.DROPS por arquetipo): su arma y, a veces, algo más.
func _drop_loot() -> void:
	if LootSystem.instance == null:
		return
	var items := []
	for e: Array in LootConfig.DROPS.get(spec_kind(), []):
		if randf() < float(e[1]):
			items.push_back({"id": e[0], "n": int(e[2])})
	var front := -global_basis.z
	LootSystem.instance.drop(global_position + Vector3(front.x, 0, front.z) * 0.6, items, "Lo que llevaba el " + String(spec.name).to_lower())


func spec_kind() -> String:
	for k: String in CombatConfig.ENEMIES:
		if CombatConfig.ENEMIES[k] == spec:
			return k
	return "centinela"


## Ver venir el golpe del jugador: con probabilidad `block` se cubre, tras una reacción al azar (si llega justo,
## desvía). Se baja la guardia al rato.
func _react(delta: float) -> void:
	var c := self_c
	var p: Combatant = target
	var swinging := p != null and p.state == Combatant.State.ATTACK and p.phase == "windup"
	if swinging and not _saw_swing and dist <= float(p.weapon.reach) + 0.6:
		_saw_swing = true
		if randf() < float(ai.get("block", 0.0)) and not c.is_busy():
			_guard_delay = randf_range(0.0, 0.22)
	elif not swinging and p != null and p.state != Combatant.State.ATTACK:
		_saw_swing = false
	if _guard_delay >= 0.0:
		_guard_delay -= delta
		if _guard_delay < 0.0:
			c.set_guard(true)
			_guard_left = 0.7
			if _anim:
				_anim.play(CharacterModel.clip("Sword_Block"), 0.08)
	if c.guarding:
		_guard_left -= delta
		if _guard_left <= 0.0 or c.is_busy():
			c.set_guard(false)


## Lleva muerto más de `seconds` (para retirarlo).
func dead_for(seconds: float) -> bool:
	return not self_c.is_alive() and _dead_t > seconds


## Retirar ya (se hundió del todo).
func gone() -> bool:
	return not self_c.is_alive() and _dead_t > float(CombatConfig.CORPSE.stay) + float(CombatConfig.CORPSE.sink)
