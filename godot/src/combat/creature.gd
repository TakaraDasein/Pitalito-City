class_name Creature
extends CharacterBody3D
## Una criatura con modelo externo (CreaturesConfig): fauna, mito, saqueador o jefe. Usa el mismo Combatant y el
## mismo CombatSystem que el jugador y los Restos; lo propio es decidir:
##   pacific  — pasta en su sitio y, si el jugador se acerca o la golpea, huye
##   hostile  — vigila; si ve al jugador lo persigue y ataca (los saqueadores disparan con FirearmSystem)
##   guardian — el Hojarasquín: con el arma guardada solo observa y se aleja; con el arma en la mano, ataca
## Los jefes (boss) tienen barra arriba (HUD) y no huyen.

const LAYER := 8
const MASK := 1 | 2 | 4 | 8 | 16

var id := ""
var spec: Dictionary
var self_c: Combatant
var target: Combatant
var dist := INF
var home := Vector3.ZERO

var _m: Dictionary            # CreatureModel.create
var _anim_now := ""
var _push := Vector3.ZERO
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _next_swing := 0.0
var _time := 0.0
var _dead_t := 0.0
var _wander := Vector3.ZERO
var _wander_t := 0.0
var _flee_t := 0.0
var _shots_left := 0
var _reload_t := 0.0
var _burst := 0


static func create(kind: String, at: Vector3) -> Creature:
	var c := Creature.new()
	c.id = kind
	c.spec = CreaturesConfig.CREATURES[kind]
	c.position = at
	c.home = at
	c.rotation.y = randf() * TAU
	return c


func _ready() -> void:
	collision_layer = LAYER
	collision_mask = MASK
	var h := float(spec.height)
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	# los cuadrúpedos grandes son más anchos que altos de cadera: radio por el alto
	capsule.radius = clampf(h * (0.18 if spec.get("humanoid", false) else 0.3), 0.25, 1.4)
	capsule.height = maxf(h, capsule.radius * 2.0)
	shape.shape = capsule
	shape.position.y = capsule.height * 0.5
	add_child(shape)
	floor_snap_length = 0.6
	_m = CreatureModel.create(id)
	if not _m.is_empty():
		add_child(_m.root)
	self_c = Combatant.new(self, spec.stats, "manos", String(spec.get("team", "monte")), String(spec.name))
	if spec.has("attack"):
		self_c.set_custom_weapon(id, spec.attack)
	self_c.on_trigger = _on_combat
	if spec.has("firearm"):
		_shots_left = int(FirearmsConfig.FIREARMS[spec.firearm].magazine)
	if CombatSystem.instance:
		CombatSystem.instance.add(self_c)


func _exit_tree() -> void:
	if CombatSystem.instance and self_c:
		CombatSystem.instance.remove(self_c)


func is_boss() -> bool:
	return spec.get("boss", false)


func push(v: Vector3) -> void:
	_push += Vector3(v.x, 0.0, v.z) * (0.25 if is_boss() else 1.0)


func _play(role: String, blend := 0.2, speed := 1.0) -> void:
	if _m.is_empty() or _m.anim == null or not _m.clips.has(role):
		return
	var clip: String = _m.clips[role]
	if clip == _anim_now and _m.anim.is_playing():
		return
	_anim_now = clip
	_m.anim.play(clip, blend, speed)


func _on_combat(evt: String, data: Dictionary) -> void:
	match evt:
		"attack":
			var full: String = _m.clips.get("attack", "") if not _m.is_empty() else ""
			var length: float = _m.anim.get_animation(full).length if full != "" and _m.anim.has_animation(full) else 1.0
			_anim_now = ""
			_play("attack", 0.1, length / maxf(float(data.get("lock", 1.0)), 0.05))
			if AudioSystem.instance:
				AudioSystem.instance.swing(0.9)
		"hit", "flinch":
			_anim_now = ""
			_play("hit", 0.08)
			if spec.behavior == "pacific":
				_flee_t = 6.0
		"death":
			_anim_now = ""
			_play("death", 0.1)
			if CombatSystem.instance:
				CombatSystem.instance.release_turn(self_c)


func _perceive() -> void:
	var p: Combatant = CombatSystem.instance.player if CombatSystem.instance else null
	if p == null or not p.is_alive() or not p.body.visible:
		target = null
		dist = INF
		return
	var to := p.body.global_position - global_position
	to.y = 0.0
	dist = to.length()
	target = p if dist <= float(spec.sight) or (target != null and dist <= float(spec.sight) * 1.4) else null


func _physics_process(delta: float) -> void:
	_time += delta
	var c := self_c
	var move := Vector3.ZERO
	var running := false
	if c.is_alive():
		_perceive()
		if not c.is_busy():
			var b: String = spec.behavior
			var armed: bool = target != null and target.body.get("armed") == true
			if b == "guardian" and not armed:
				b = "watch"
			match b:
				"pacific":
					move = _pacific(delta)
				"watch":
					# el Hojarasquín observa al que entra sin arma y se aleja despacio
					if target:
						var to := target.body.global_position - global_position
						rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), minf(1.0, delta * 3.0))
						if dist < 8.0:
							move = -to.normalized() * float(spec.speed) * 0.4
				_:
					var r := _hostile(delta)
					move = r[0]
					running = r[1]
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
	if c.is_alive() or _dead_t < 3.0:
		move_and_slide()
	var ground := WorldData.height(global_position.x, global_position.z)
	if global_position.y < ground - 2.0:
		global_position.y = ground + 0.5
	if Vector2(move.x, move.z).length() > 0.2:
		var want := atan2(-move.x, -move.z)
		rotation.y = lerp_angle(rotation.y, want, minf(1.0, delta * 8.0))
	if c.is_alive() and not c.is_busy():
		var sp := Vector2(move.x, move.z).length()
		_play("idle" if sp < 0.2 else ("run" if running and _m.get("clips", {}).has("run") else "walk"),
			0.2, 1.0 if sp < 0.2 else clampf(sp / maxf(float(spec.speed) * (1.0 if running else 0.5), 0.1), 0.6, 1.6))


## Pasta y camina un poco alrededor de su sitio; con el jugador cerca o herida, huye.
func _pacific(delta: float) -> Vector3:
	_flee_t -= delta
	if target and (dist < 7.0 or _flee_t > 0.0):
		var away := global_position - target.body.global_position
		away.y = 0.0
		return away.normalized() * float(spec.speed)
	_wander_t -= delta
	if _wander_t <= 0.0:
		_wander_t = randf_range(3.0, 8.0)
		var a := randf() * TAU
		_wander = Vector3(cos(a), 0, sin(a)) * (0.0 if randf() < 0.5 else float(spec.speed) * 0.25)
		if global_position.distance_to(home) > 25.0:
			_wander = (home - global_position).normalized() * float(spec.speed) * 0.3
	return _wander


## Persigue y ataca (por turnos, como los Restos); los saqueadores disparan desde lejos. Devuelve [mov, corre].
func _hostile(delta: float) -> Array:
	if target == null:
		return [_pacific(delta) * 0.5, false]
	var to := target.body.global_position - global_position
	to.y = 0.0
	rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), minf(1.0, delta * 6.0))
	var cs := CombatSystem.instance
	if spec.has("firearm"):
		return [_shooter(delta, to), false]
	var reach := float(spec.attack.reach) * 0.9
	var my_turn := cs.take_turn(self_c) if cs and not is_boss() else true
	if dist <= reach:
		if my_turn and _time >= _next_swing and self_c.attack():
			_next_swing = _time + randf_range(0.9, 1.6)
			if cs:
				cs.release_turn(self_c)
		return [Vector3.ZERO, false]
	if not my_turn and dist < 6.0:
		return [to.normalized().cross(Vector3.UP) * float(spec.speed) * 0.4, false]
	return [to.normalized() * float(spec.speed), dist > 6.0]


## Saqueador: mantiene la distancia (8–18 m), dispara ráfagas cortas con mala puntería y recarga.
func _shooter(delta: float, to: Vector3) -> Vector3:
	var gun: String = spec.firearm
	var f: Dictionary = FirearmsConfig.FIREARMS[gun]
	_reload_t -= delta
	if _reload_t > 0.0:
		return -to.normalized() * float(spec.speed) * 0.3
	var move := Vector3.ZERO
	if dist > 18.0:
		move = to.normalized() * float(spec.speed)
	elif dist < 8.0:
		move = -to.normalized() * float(spec.speed) * 0.6
	if dist <= float(f.range) * 0.7 and _time >= _next_swing and FirearmSystem.instance:
		if _shots_left <= 0:
			_shots_left = int(f.magazine)
			_reload_t = float(f.reload)
			return move
		_shots_left -= 1
		# ráfagas cortas con pausa entre ellas
		_burst -= 1
		if _burst <= 0:
			_burst = randi_range(int(spec.get("burst", [2, 3])[0]), int(spec.get("burst", [2, 3])[1]))
			_next_swing = _time + randf_range(float(spec.get("burst_pause", [1.0, 2.0])[0]), float(spec.get("burst_pause", [1.0, 2.0])[1]))
		else:
			_next_swing = _time + maxf(float(f.rate), 0.14)
		var muzzle := global_position + Vector3.UP * 1.4 - global_basis.z * 0.6
		var aim := (target.body.global_position + Vector3.UP * 1.2 - muzzle).normalized()
		FirearmSystem.instance.shoot(self_c, muzzle, aim, gun, muzzle, float(spec.get("aim_error", 3.0)))
		_play("attack", 0.05)
	return move


## Lleva muerta más de `seconds` (para retirarla).
func dead_for(seconds: float) -> bool:
	return not self_c.is_alive() and _dead_t > seconds
