class_name Creature
extends CharacterBody3D
## Una criatura con modelo externo (CreaturesConfig): fauna, mito, saqueador o jefe. Usa el mismo Combatant y el
## mismo CombatSystem que el jugador y los Restos (el golpe lo resuelve el sector del arma); lo propio es:
##   · decidir — pacific (pasta, huye; con defend se defiende), hostile, guardian (solo si el jugador va armado)
##   · elegir ataque — entre los de su ficha que están a su distancia y sin espera, al azar según el peso; los de
##     combo se encadenan pidiendo el siguiente golpe durante la recuperación (Combatant lo guarda)
##   · animar — cada estado con su clip; lo que el modelo no trae se anima por código sobre el pivote del modelo
##     (embestida, coz, carga, salto, caída de lado al morir, retroceso al recibir)
##   · efectos — aullido, llamado de la jauría, hojarasca (aparece detrás), destello, comer, ráfaga de fusil
##   · optimizar — según la distancia a la cámara: animación a 1/4 de cuadros, pensar 4 veces por segundo, sin
##     sombra, sin dibujar (CreaturesConfig.LOD_DEFAULT / lod)

const LAYER := 8
const MASK := 1 | 2 | 4 | 8 | 16

var id := ""
var variant := ""               # "" o una de spec.variants (la hembra del venado)
var spec: Dictionary
var self_c: Combatant
var target: Combatant
var dist := INF
var home := Vector3.ZERO
var hit_radius := 0.3           # radio del cuerpo: el alcance de los golpes se cuenta hasta aquí (CombatSystem)
var state := "idle"            # idle · walk · run · attack · hit · dead (para depurar y las pruebas)

var _m: Dictionary             # CreatureModel.create
var _pivot: Node3D             # el modelo: lo mueven las animaciones por código
var _lod: Dictionary
var _anim_now := ""
var _push := Vector3.ZERO
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _time := 0.0
var _dead_t := 0.0
var _wander := Vector3.ZERO
var _wander_t := 0.0
var _flee_t := 0.0
var _provoked := 0.0           # pacíficas: segundos que se defienden tras recibir
var _cool := {}                # id de ataque → instante en que vuelve a estar disponible
var _move: Dictionary = {}     # el ataque en curso
var _combo_left := 0
var _effect_done := false
var _hurry := 0.0              # aullido: corre más unos segundos
var _recoil := 0.0
var _think := 0.0
var _far := false
var _frame := 0
var _shadow_on := true
# fusil del saqueador
var _shots_left := 0
var _reload_t := 0.0
var _burst := 0
var _next_shot := 0.0
var _next_hop := 0.0
var _rest_until := 0.0


static func create(kind: String, at: Vector3, variant := "") -> Creature:
	var c := Creature.new()
	c.id = kind
	c.variant = variant
	var base: Dictionary = CreaturesConfig.CREATURES[kind]
	c.spec = base.merged(base.get("variants", {}).get(variant, {}), true) if variant != "" else base
	c.position = at
	c.home = at
	c.rotation.y = randf() * TAU
	return c


func _ready() -> void:
	collision_layer = LAYER
	collision_mask = MASK
	_lod = CreaturesConfig.LOD_DEFAULT.merged(spec.get("lod", {}), true)
	var h := float(spec.height)
	_m = CreatureModel.create(id, variant)
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	# radio por el ancho real del esqueleto (los cuadrúpedos y el Hojarasquín son mucho más anchos que una persona:
	# con un radio por el alto se metían en los carros)
	var w: float = _m.get("width", 0.0)
	capsule.radius = clampf(h * 0.18, 0.25, 0.5) if spec.get("humanoid", false) else clampf(w * 0.3, 0.25, 1.6)
	capsule.height = maxf(h, capsule.radius * 2.0)
	shape.shape = capsule
	hit_radius = capsule.radius
	shape.position.y = capsule.height * 0.5
	add_child(shape)
	floor_snap_length = 0.6
	if not _m.is_empty():
		_pivot = Node3D.new()
		_pivot.name = "pivote"
		add_child(_pivot)
		_pivot.add_child(_m.root)
		if spec.get("matte", false):
			_matte(_m.root)
		for mi: MeshInstance3D in _m.root.find_children("*", "MeshInstance3D", true, false):
			mi.visibility_range_end = float(_lod.hide)
	self_c = Combatant.new(self, spec.stats, "manos", String(spec.get("team", "monte")), String(spec.name))
	self_c.on_trigger = _on_combat
	if spec.has("firearm"):
		_shots_left = int(FirearmsConfig.FIREARMS[spec.firearm].magazine)
	if CombatSystem.instance:
		CombatSystem.instance.add(self_c)


func _exit_tree() -> void:
	if CombatSystem.instance and self_c:
		CombatSystem.instance.remove(self_c)


## La conversión de FBX deja los materiales metálicos y, sin reflejos que mostrar, se ven casi negros.
static func _matte(root: Node) -> void:
	for mi: MeshInstance3D in root.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var m := mi.get_active_material(i) as StandardMaterial3D
			if m == null:
				continue
			var d := m.duplicate() as StandardMaterial3D
			d.metallic = 0.0
			d.roughness = maxf(d.roughness, 0.75)
			d.metallic_texture = null
			mi.set_surface_override_material(i, d)


func is_boss() -> bool:
	return spec.get("boss", false)


func push(v: Vector3) -> void:
	_push += Vector3(v.x, 0.0, v.z) * (0.25 if is_boss() else 1.0)


# ───────────── Animación ─────────────

func _play(role: String, blend := 0.2, speed := 1.0) -> bool:
	if _m.is_empty() or _m.anim == null or not _m.clips.has(role):
		return false
	var clip: String = _m.clips[role]
	if clip == _anim_now and _m.anim.is_playing():
		_m.anim.speed_scale = speed
		return true
	_anim_now = clip
	_m.anim.play(clip, blend)
	_m.anim.speed_scale = speed
	return true


## Animación por código del ataque en curso, sobre el pivote (fase y fracción de la fase).
func _proc(delta: float) -> void:
	if _pivot == null:
		return
	var h := float(spec.height)
	var want_rot := Vector3.ZERO
	var want_y := 0.0
	var c := self_c
	if c.state == Combatant.State.DEAD:
		# sin clip de muerte: cae de lado y se hunde despacio
		if not _m.clips.has("death"):
			want_rot.z = deg_to_rad(88.0)
			want_y = -0.15 * h * clampf((_dead_t - 2.0) / 3.0, 0.0, 1.0)
	elif c.state == Combatant.State.ATTACK and _move.has("proc"):
		var ph := c.phase
		match String(_move.proc):
			"lunge":   # se recoge y se lanza
				want_rot.x = 0.22 if ph == "windup" else (-0.32 if ph == "active" else 0.0)
			"kick":    # se da la vuelta (solo el modelo: el golpe va hacia el jugador) y levanta las de atrás
				want_rot.y = PI if ph != "recover" else 0.0
				want_rot.x = 0.15 if ph == "windup" else (0.5 if ph == "active" else 0.0)
			"charge":  # cabeza baja todo el tiempo
				want_rot.x = -0.25 if ph != "recover" else 0.0
			"slam":    # salta y cae
				want_y = h * 0.45 if ph == "windup" else 0.0
				want_rot.x = 0.15 if ph == "windup" else (-0.2 if ph == "active" else 0.0)
	_recoil = move_toward(_recoil, 0.0, delta * 2.5)
	want_rot.x += _recoil
	var k := minf(1.0, delta * (14.0 if c.phase == "active" else 7.0))
	_pivot.rotation = _pivot.rotation.lerp(want_rot, k)
	_pivot.position.y = lerpf(_pivot.position.y, want_y, k)


func _on_combat(evt: String, data: Dictionary) -> void:
	match evt:
		"attack":
			state = "attack"
			_effect_done = false
			var role: String = String(data.get("clip", _move.get("clip", "")))
			if role != "" and _m.get("clips", {}).has(role):
				var full: String = _m.clips[role]
				var length: float = _m.anim.get_animation(full).length if _m.anim.has_animation(full) else 1.0
				_anim_now = ""
				_play(role, 0.1, length / maxf(float(data.get("lock", 1.0)), 0.05))
			if AudioSystem.instance and float(_move.get("damage", 0.0)) > 0.0:
				AudioSystem.instance.swing(clampf(float(spec.height) / 2.0, 0.6, 1.5))
		"hit", "flinch", "blocked":
			if evt != "blocked":
				state = "hit"
				_anim_now = ""
				if not _play("hit", 0.08):
					_recoil = 0.25
			if spec.behavior == "pacific":
				_flee_t = 6.0
				_provoked = 5.0
		"parried":
			state = "hit"
			_anim_now = ""
			if not _play("hit", 0.08):
				_recoil = 0.35
		"death":
			state = "dead"
			_anim_now = ""
			_play("death", 0.1)
			if CombatSystem.instance:
				CombatSystem.instance.release_turn(self_c)


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
	target = p if dist <= float(spec.sight) or (target != null and dist <= float(spec.sight) * 1.4) else null


## El ataque que toca: entre los que están a su distancia y sin espera, al azar por peso ({} si ninguno).
func _choose() -> Dictionary:
	var options := []
	var total := 0.0
	for a: Dictionary in spec.get("attacks", []):
		var r: Array = a.range
		if dist < float(r[0]) or dist > float(r[1]) or _time < float(_cool.get(a.id, 0.0)):
			continue
		if a.get("effect", "") == "eat" and self_c.health > float(self_c.stats.health) * 0.6:
			continue
		if a.get("effect", "") == "shoot" and (_reload_t > 0.0 or _time < _next_shot):
			continue
		if a.get("effect", "") == "summon" and self_c.health > float(self_c.stats.health) * 0.85:
			continue
		options.push_back(a)
		total += float(a.weight)
	var x := randf() * total
	for a: Dictionary in options:
		x -= float(a.weight)
		if x <= 0.0:
			return a
	return {}


func _start(a: Dictionary) -> bool:
	var combo: Array = [a.get("clip", a.id)]
	for k in ["combo", "combo2"]:
		if a.has(k):
			combo.push_back(a[k])
	var w := a.merged({"name": a.id, "model": "", "combo": combo}, true)
	if is_boss():
		w.damage = float(w.damage) * float(CreaturesConfig.BALANCE.boss_damage)
	if a.get("area", false):
		w.arc = PI
	self_c.set_custom_weapon(String(a.id), w)
	if not self_c.attack():
		return false
	_move = a
	_combo_left = combo.size() - 1
	_cool[a.id] = _time + float(a.cooldown)
	return true


func _physics_process(delta: float) -> void:
	_time += delta
	_frame += 1
	var c := self_c
	var cam := get_viewport().get_camera_3d()
	var cam_d := global_position.distance_to(cam.global_position) if cam else 0.0
	_apply_lod(cam_d, delta)
	var move := Vector3.ZERO
	var running := false
	if c.is_alive():
		_think -= delta
		if not _far or _think <= 0.0:
			_think = 0.25
			_perceive()
		_hurry = maxf(0.0, _hurry - delta)
		_provoked = maxf(0.0, _provoked - delta)
		if c.state == Combatant.State.ATTACK:
			move = _attacking(delta)
		elif not c.is_busy():
			if not _move.is_empty():
				# acaba de terminar un ataque: respiro (rodea sin atacar)
				var r: Array = CreaturesConfig.BALANCE.rest.boss if is_boss() else CreaturesConfig.BALANCE.rest.normal
				_rest_until = _time + randf_range(float(r[0]), float(r[1]))
			_move = {}
			var b: String = spec.behavior
			var armed: bool = target != null and target.body.get("armed") == true
			if b == "guardian" and not armed:
				b = "watch"
			if b == "pacific" and spec.get("defend", false) and _provoked > 0.0:
				b = "defend"
			match b:
				"pacific":
					move = _pacific(delta)
				"watch":
					move = _watch(delta)
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
	if c.is_alive() and c.state != Combatant.State.ATTACK and Vector2(move.x, move.z).length() > 0.2:
		rotation.y = lerp_angle(rotation.y, atan2(-move.x, -move.z), minf(1.0, delta * 8.0))
	_proc(delta)
	if c.is_alive() and not c.is_busy():
		var sp := Vector2(move.x, move.z).length()
		state = "idle" if sp < 0.2 else ("run" if running else "walk")
		var base := float(spec.run) if running else float(spec.speed)
		_play(state, 0.2, 1.0 if sp < 0.2 else clampf(sp / maxf(base, 0.1), 0.6, 1.8))


## Durante un ataque: avance del dash, combo encadenado y el efecto en la fase activa.
func _attacking(delta: float) -> Vector3:
	var c := self_c
	var move := Vector3.ZERO
	if target and c.phase == "windup":
		var to := target.body.global_position - global_position
		rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), minf(1.0, delta * 5.0))
	if c.phase == "active":
		if float(_move.get("dash", 0.0)) > 0.0:
			move = -global_basis.z * float(_move.dash) / maxf(float(_move.active), 0.05)
		if not _effect_done:
			_effect_done = true
			_effect(String(_move.get("effect", "")))
	elif c.phase == "recover" and _combo_left > 0 and target and dist <= float(_move.reach) + 0.8:
		_combo_left -= 1
		c.attack()   # el Combatant lo guarda y encadena el siguiente golpe del combo
	return move


func _effect(e: String) -> void:
	match e:
		"howl":
			for o in (CreatureSystem.instance._alive if CreatureSystem.instance else []):
				if is_instance_valid(o) and o != self and o.id == id and o.global_position.distance_to(global_position) < 40.0:
					o.target = target
					o._hurry = 6.0
			_hurry = 6.0
		"summon":
			var s: Array = _move.get("summon", ["lobo", 2])
			for i in int(s[1]):
				var a := randf() * TAU
				var at := global_position + Vector3(cos(a), 0, sin(a)) * randf_range(6.0, 10.0)
				var w: Creature = CreatureSystem.instance.spawn(String(s[0]), at) if CreatureSystem.instance else null
				if w:
					w.target = target
					w._hurry = 5.0
					EventBus.combat_impact.emit(w.global_position + Vector3.UP * 0.5, "hojarasca", 1.0)
		"teleport":
			if target:
				EventBus.combat_impact.emit(global_position + Vector3.UP * 1.2, "hojarasca", 1.4)
				var behind: Vector3 = target.body.global_position + target.body.global_basis.z * 2.2
				global_position = Vector3(behind.x, WorldData.height(behind.x, behind.z) + 0.2, behind.z)
				var to := target.body.global_position - global_position
				rotation.y = atan2(-to.x, -to.z)
				EventBus.combat_impact.emit(global_position + Vector3.UP * 1.2, "hojarasca", 1.4)
				_cool["zarpa"] = 0.0
		"flash":
			# ciega al que lo mira de frente
			if target and dist <= float(_move.reach):
				var to := (global_position - target.body.global_position).normalized()
				var facing := (-target.body.global_basis.z).dot(to) > 0.3
				if HUD.instance:
					HUD.instance.flash_white(1.0 if facing else 0.35)
				if facing:
					target.stun(float(_move.get("stun", 1.0)))
					target.take_hit(float(_move.damage), 0.0, "head")
		"eat":
			self_c.health = minf(float(self_c.stats.health), self_c.health + float(_move.get("heal", 50.0)))
		"shoot":
			_fire_burst()


## El saqueador: una ráfaga corta con mala puntería; recarga al vaciar el cargador.
func _fire_burst() -> void:
	if target == null or FirearmSystem.instance == null:
		return
	var gun: String = spec.firearm
	var f: Dictionary = FirearmsConfig.FIREARMS[gun]
	var n := randi_range(int(spec.burst[0]), int(spec.burst[1]))
	for i in n:
		if _shots_left <= 0:
			_shots_left = int(f.magazine)
			_reload_t = float(f.reload)
			_anim_now = ""
			_play("recarga", 0.1, _m.anim.get_animation(_m.clips.recarga).length / float(f.reload) if _m.get("clips", {}).has("recarga") else 1.0)
			break
		_shots_left -= 1
		var muzzle := global_position + Vector3.UP * 1.4 - global_basis.z * 0.6
		var aim := (target.body.global_position + Vector3.UP * 1.2 - muzzle).normalized()
		FirearmSystem.instance.shoot(self_c, muzzle, aim, gun, muzzle, float(spec.get("aim_error", 3.0)), float(CreaturesConfig.BALANCE.npc_gun_damage))
		if i < n - 1:
			await get_tree().create_timer(maxf(float(f.rate), 0.14)).timeout
			if not is_instance_valid(self) or not self_c.is_alive():
				return
	_next_shot = _time + randf_range(float(spec.burst_pause[0]), float(spec.burst_pause[1]))


## Pasta y camina un poco alrededor de su sitio; con el jugador cerca o herida, huye.
func _pacific(delta: float) -> Vector3:
	if spec.get("moves_by", "") == "hojarasca":
		return Vector3.ZERO   # quieto, acechando (su clip)
	_flee_t -= delta
	if target and (dist < 7.0 or _flee_t > 0.0):
		var away := global_position - target.body.global_position
		away.y = 0.0
		return away.normalized() * float(spec.run)
	_wander_t -= delta
	if _wander_t <= 0.0:
		_wander_t = randf_range(3.0, 8.0)
		var a := randf() * TAU
		_wander = Vector3(cos(a), 0, sin(a)) * (0.0 if randf() < 0.5 else float(spec.speed))
		if global_position.distance_to(home) > 25.0:
			_wander = (home - global_position).normalized() * float(spec.speed)
	return _wander


## El Hojarasquín con el jugador desarmado: lo mira y se aleja despacio si se le acerca.
func _watch(delta: float) -> Vector3:
	if target == null:
		return _pacific(delta) * 0.5
	var to := target.body.global_position - global_position
	to.y = 0.0
	rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), minf(1.0, delta * 3.0))
	if dist < 8.0:
		if spec.get("moves_by", "") == "hojarasca":
			# se aparta como vino: en hojarasca, más lejos
			if _time >= _next_hop:
				_next_hop = _time + 3.0
				_hop_toward(global_position - to.normalized() * 10.0, 6.0)
			return Vector3.ZERO
		return -to.normalized() * float(spec.speed) * 0.6
	return Vector3.ZERO


## Persigue y ataca (por turnos con los demás, salvo los jefes). Devuelve [movimiento, corre].
func _hostile(delta: float) -> Array:
	_reload_t -= delta
	if target == null:
		return [_pacific(delta) * 0.5, false]
	var to := target.body.global_position - global_position
	to.y = 0.0
	rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), minf(1.0, delta * 6.0))
	var cs := CombatSystem.instance
	var my_turn := cs.take_turn(self_c) if cs and not is_boss() else true
	if _time < _rest_until:
		if spec.get("moves_by", "") == "hojarasca":
			return [Vector3.ZERO, false]   # no camina: en su respiro se queda quieto, acechando
		# respiro: rodea al jugador a la distancia de su golpe
		return [to.normalized().cross(Vector3.UP) * float(spec.speed) * 0.7 + to.normalized() * clampf(dist - 2.5, -1.0, 1.0), false]
	if my_turn:
		var a := _choose()
		if not a.is_empty() and _start(a):
			if cs:
				cs.release_turn(self_c)
			return [Vector3.ZERO, false]
	# guarda su distancia de tiro (saqueador) o se acerca; sin turno, rodea
	var keep: Array = spec.get("keep", [0.0, 0.0])
	if float(keep[1]) > 0.0:
		if dist > float(keep[1]):
			return [to.normalized() * float(spec.run), true]
		if dist < float(keep[0]):
			return [-to.normalized() * float(spec.speed), false]
		return [to.normalized().cross(Vector3.UP) * float(spec.speed) * 0.5, false]
	if not my_turn and dist < 6.0:
		return [to.normalized().cross(Vector3.UP) * float(spec.speed) * 0.6, false]
	var reach := 1.0
	for a: Dictionary in spec.get("attacks", []):
		reach = maxf(reach, float(a.get("reach", 0.0)) * 0.85) if float(a.get("damage", 0.0)) > 0.0 and float(a.range[0]) == 0.0 else reach
	if dist <= reach:
		return [Vector3.ZERO, false]
	# sin clip de caminar (el Hojarasquín): no camina, se acerca deshaciéndose en hojarasca y reapareciendo
	if spec.get("moves_by", "") == "hojarasca":
		if _time >= _next_hop:
			_next_hop = _time + randf_range(1.6, 2.6)
			_hop_toward(target.body.global_position, minf(dist - reach * 0.8, randf_range(5.0, 9.0)))
		return [Vector3.ZERO, false]
	var fast := dist > 6.0 or _hurry > 0.0
	return [to.normalized() * (float(spec.run) if fast else float(spec.speed)) * (1.25 if _hurry > 0.0 else 1.0), fast]


## Se deshace en hojarasca y reaparece `d` m más cerca de `goal` (un poco de lado, para que no sea recto).
func _hop_toward(goal: Vector3, d: float) -> void:
	if d <= 0.5:
		return
	var to := goal - global_position
	to.y = 0.0
	var dir := to.normalized().rotated(Vector3.UP, randf_range(-0.5, 0.5))
	EventBus.combat_impact.emit(global_position + Vector3.UP * 1.2, "hojarasca", 1.0)
	var at := global_position + dir * d
	global_position = Vector3(at.x, WorldData.height(at.x, at.z) + 0.2, at.z)
	var face := goal - global_position
	rotation.y = atan2(-face.x, -face.z)
	EventBus.combat_impact.emit(global_position + Vector3.UP * 1.2, "hojarasca", 1.0)


# ───────────── Optimización por distancia ─────────────

func _apply_lod(cam_d: float, delta: float) -> void:
	_far = cam_d > float(_lod.think)
	if _m.is_empty() or _m.anim == null:
		return
	# lejos: la animación se avanza a mano cada 4 cuadros (el esqueleto cuesta)
	var slow := cam_d > float(_lod.anim)
	var manual: bool = _m.anim.callback_mode_process == AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	if slow != manual:
		_m.anim.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL if slow else AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_IDLE
	if slow and _frame % 4 == 0:
		_m.anim.advance(delta * 4.0)
	var shadow := cam_d < float(_lod.shadow)
	if shadow != _shadow_on:
		_shadow_on = shadow
		for mi: MeshInstance3D in _m.root.find_children("*", "MeshInstance3D", true, false):
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


## Lleva muerta más de `seconds` (para retirarla).
func dead_for(seconds: float) -> bool:
	return not self_c.is_alive() and _dead_t > seconds
