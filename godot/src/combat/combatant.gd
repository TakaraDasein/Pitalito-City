class_name Combatant
extends RefCounted
## Un combatiente: vida, resistencia, temple y el estado de lo que está haciendo (atacar, rodar, recibir, morir).
## Port de web/src/entities/combat/Combatant.js.
##
## Es el mismo objeto para el jugador y los enemigos: lo único que cambia son las cifras y el arma. La IA llama a
## attack() y roll() igual que lo hace el teclado. No conoce a los demás: quién recibe el golpe lo decide
## CombatSystem. Al cuerpo le avisa por `on_trigger(evento, datos)`: "attack" {clip, lock}, "roll", "hit", "death".

enum State { IDLE, ATTACK, ROLL, HIT, DEAD }

var body: Node3D          # el cuerpo en el mundo (posición y rumbo: rotation.y)
var name := ""
var team := "player"
var stats: Dictionary
var weapon: Dictionary
var weapon_id := "manos"
var health := 0.0
var stamina := 0.0
var state := State.IDLE
var phase := ""           # en un ataque: windup → active → recover
var guarding := false
var lock_target: Combatant
var roll_dir := Vector3.ZERO
var on_trigger: Callable

var _timer := 0.0
var _elapsed := 0.0
var _hit_once := false
var _stamina_hold := 0.0
var _invulnerable := 0.0
var _combo_step := -1
var _since_swing := INF
var _queued := false
var _times := {}
var hit_mult := 1.0


func _init(b: Node3D, s: Dictionary, w := "manos", t := "player", n := "") -> void:
	body = b
	stats = s
	team = t
	name = n
	health = s.health
	stamina = s.stamina
	set_weapon(w)


func is_alive() -> bool:
	return state != State.DEAD


func is_busy() -> bool:
	return state in [State.ATTACK, State.ROLL, State.HIT]


## ¿Este cuadro el golpe hace daño? (fase activa, y todavía no cobró)
func is_striking() -> bool:
	return state == State.ATTACK and phase == "active" and not _hit_once


func set_weapon(id: String) -> void:
	if CombatConfig.WEAPONS.has(id):
		weapon_id = id
		weapon = CombatConfig.WEAPONS[id]


## Intenta atacar. Durante el golpe (ya soltado o recuperándose) el clic se guarda y encadena el siguiente.
func attack() -> bool:
	if not is_alive():
		return false
	if state == State.ATTACK and phase != "windup":
		_queued = true
		return false
	if is_busy() or stamina < float(weapon.stamina):
		return false
	_spend(weapon.stamina)
	var combo: Array = weapon.combo
	_combo_step = (_combo_step + 1) % combo.size() if _since_swing < CombatConfig.COMBO.window else 0
	var finisher := combo.size() > 1 and _combo_step == combo.size() - 1
	var slow: float = CombatConfig.COMBO.finisher_time if finisher else 1.0
	hit_mult = CombatConfig.COMBO.finisher_damage if finisher else 1.0
	_times = {"windup": float(weapon.windup) * slow, "active": float(weapon.active), "recover": float(weapon.recover) * slow}
	state = State.ATTACK
	phase = "windup"
	_timer = _times.windup
	_hit_once = false
	_queued = false
	_fire("attack", {"clip": combo[_combo_step], "lock": _times.windup + _times.active + _times.recover})
	return true


## Rueda en una dirección del mundo (vector horizontal normalizado).
func roll(dir: Vector3) -> bool:
	if not is_alive() or is_busy() or stamina < float(CombatConfig.ROLL.stamina):
		return false
	_spend(CombatConfig.ROLL.stamina)
	state = State.ROLL
	_timer = CombatConfig.ROLL.duration
	_elapsed = 0.0
	roll_dir = dir
	_fire("roll", {"lock": CombatConfig.ROLL.duration})
	return true


func set_guard(on: bool) -> void:
	guarding = on and is_alive() and not is_busy()


## Recibe un golpe: { damage, blocked, staggered, dead } o {} si no entró (muerto o invulnerable).
func take_hit(damage: float, poise: float, zone := "body") -> Dictionary:
	if not is_alive() or _invulnerable > 0.0:
		return {}
	var mult: float = CombatConfig.HIT_MULTIPLIER.get(zone, 1.0)
	var dmg := damage * mult
	var blocked := false
	if guarding:
		blocked = true
		dmg *= CombatConfig.GUARD.damage_through
		_spend(CombatConfig.GUARD.stamina)
		if stamina <= 0.0: # sin resistencia la guardia se rompe y el golpe entra entero
			blocked = false
			dmg = damage * mult
			guarding = false
	health = maxf(0.0, health - dmg)
	_invulnerable = stats.invulnerable_after_hit
	if health <= 0.0:
		state = State.DEAD
		_timer = INF
		_fire("death", {})
		return {"damage": dmg, "blocked": blocked, "staggered": false, "dead": true}
	var staggered := not blocked and poise >= float(stats.poise)
	if staggered:
		state = State.HIT
		_timer = 0.5
		_fire("hit", {})
	return {"damage": dmg, "blocked": blocked, "staggered": staggered, "dead": false}


## Vuelve a la vida (con unos segundos de invulnerabilidad).
func revive() -> void:
	state = State.IDLE
	phase = ""
	health = stats.health
	stamina = stats.stamina
	_invulnerable = 2.0


## Cuánto avanza el rodar este cuadro (m): arranca rápido y frena, como un impulso.
func roll_step(dt: float) -> Vector3:
	if state != State.ROLL:
		return Vector3.ZERO
	var r: Dictionary = CombatConfig.ROLL
	var t := minf(1.0, _elapsed / float(r.duration))
	return roll_dir * (float(r.distance) / float(r.duration)) * 2.0 * (1.0 - t) * dt


func update(dt: float) -> void:
	_invulnerable = maxf(0.0, _invulnerable - dt)
	if state != State.ATTACK:
		_since_swing += dt
	_regen(dt)
	if state == State.DEAD:
		return
	if state == State.ROLL:
		_elapsed += dt
		var r: Dictionary = CombatConfig.ROLL
		if _elapsed >= float(r.iframe_start) and _elapsed <= float(r.iframe_end):
			_invulnerable = maxf(_invulnerable, 0.02)
	_timer -= dt
	if _timer > 0.0:
		return
	if state == State.ATTACK:
		if phase == "windup":
			phase = "active"
			_timer = _times.active
		elif phase == "active":
			phase = "recover"
			_timer = _times.recover
		else:
			state = State.IDLE
			phase = ""
			_since_swing = 0.0
			if _queued:
				_queued = false
				attack()
		return
	if state == State.ROLL or state == State.HIT:
		state = State.IDLE
		roll_dir = Vector3.ZERO


## Marca que el golpe ya cobró (dura varios cuadros pero cobra una vez).
func mark_hit() -> void:
	_hit_once = true


func _fire(evt: String, data: Dictionary) -> void:
	if on_trigger.is_valid():
		on_trigger.call(evt, data)


func _spend(n: float) -> void:
	stamina = maxf(0.0, stamina - n)
	_stamina_hold = stats.stamina_delay


func _regen(dt: float) -> void:
	if _stamina_hold > 0.0:
		_stamina_hold -= dt
		return
	var drain: float = CombatConfig.GUARD.drain_per_second if guarding else 0.0
	stamina = clampf(stamina + (float(stats.stamina_regen) - drain) * dt, 0.0, float(stats.stamina))
