class_name CombatSystem
extends Node
## Resuelve la pelea entre combatientes: quién alcanza a quién y fijar blanco (port de web/src/systems/CombatSystem.js).
##
## Los combatientes no se conocen entre sí: aquí está la única lista y la única prueba de alcance. La prueba es un
## SECTOR (distancia menor que el alcance del arma y ángulo dentro de su arco): barato y se lee bien; no hacen
## falta cajas de daño por hueso a esta escala. La separación de cuerpos la hace la física (CharacterBody3D).

static var instance: CombatSystem

var combatants: Array[Combatant] = []
var player: Combatant
## Cámara a la que se le pide el temblor (la pone main.gd).
var camera_rig: CameraRig
var _hitstop_until := 0       # Time.get_ticks_msec() en que termina el tiempo casi detenido
var _attackers: Array = []   # enemigos con turno para atacar al jugador (CombatConfig.PACK.attackers)


func _ready() -> void:
	instance = self
	# corre también en pausa, solo para soltar el hitstop (si no, el menú quedaría en cámara lenta)
	process_mode = Node.PROCESS_MODE_ALWAYS
	# teclas del combate (CombatConfig.KEYS): se registran aquí para no tocar project.godot a mano
	for action: String in CombatConfig.KEYS:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action)
		var code: int = CombatConfig.KEYS[action]
		var ev: InputEvent
		if code < 0:
			ev = InputEventMouseButton.new()
			ev.button_index = -code
		else:
			ev = InputEventKey.new()
			ev.physical_keycode = code
		InputMap.action_add_event(action, ev)


func add(c: Combatant, is_player := false) -> Combatant:
	combatants.push_back(c)
	if is_player:
		player = c
	return c


func remove(c: Combatant) -> void:
	combatants.erase(c)
	_attackers.erase(c)
	for o in combatants:
		if o.lock_target == c:
			_set_lock(o, null)


static func _forward(c: Combatant) -> Vector3:
	var f := -c.body.global_basis.z
	f.y = 0.0
	return f.normalized()


## Enemigos vivos del otro bando a menos de max_dist: [[Combatant, distancia]] del más cercano al más lejano.
func _enemies_of(c: Combatant, max_dist: float) -> Array:
	var out := []
	var p := c.body.global_position
	for o in combatants:
		if o == c or not o.is_alive() or o.team == c.team:
			continue
		var d := Vector2(o.body.global_position.x - p.x, o.body.global_position.z - p.z).length()
		if d <= max_dist:
			out.push_back([o, d])
	out.sort_custom(func(a, b): return a[1] < b[1])
	return out


## Fija o suelta el blanco: el enemigo más cercano dentro del cono de la mirada (yaw de la cámara).
func toggle_lock(c: Combatant, yaw: float) -> Combatant:
	if c.lock_target:
		_set_lock(c, null)
		return null
	return _set_lock(c, _find(c, Vector3(-sin(yaw), 0, -cos(yaw))))


func _find(c: Combatant, look: Vector3) -> Combatant:
	var p := c.body.global_position
	for e: Array in _enemies_of(c, CombatConfig.LOCK_ON.range):
		var o: Combatant = e[0]
		var to := o.body.global_position - p
		to.y = 0.0
		if to.normalized().angle_to(look) <= CombatConfig.LOCK_ON.angle:
			return o
	return null


func _set_lock(c: Combatant, o: Combatant) -> Combatant:
	c.lock_target = o
	if c == player:
		EventBus.combat_lock.emit(o)
	return o


## Turno para atacar al jugador: pocos a la vez, el resto rodea. Se suelta al terminar el golpe (release_turn) o
## al morir. Devuelve true si este enemigo puede pegar ahora.
func take_turn(c: Combatant) -> bool:
	_attackers = _attackers.filter(func(o: Combatant): return o.is_alive() and combatants.has(o))
	if c in _attackers:
		return true
	if _attackers.size() >= int(CombatConfig.PACK.attackers):
		return false
	_attackers.push_back(c)
	return true


func release_turn(c: Combatant) -> void:
	_attackers.erase(c)


## Ayuda para apuntar: el enemigo vivo más cercano dentro del medio ángulo de la mirada y del alcance del arma
## más un poco. null si no hay (entonces el golpe va hacia donde mira).
func assist_target(c: Combatant) -> Combatant:
	if c.lock_target and c.lock_target.is_alive():
		return c.lock_target
	var fwd := _forward(c)
	var p := c.body.global_position
	for e: Array in _enemies_of(c, float(c.weapon.reach) + float(CombatConfig.FEEL.assist_extra)):
		var o: Combatant = e[0]
		var to := o.body.global_position - p
		to.y = 0.0
		if to.length() < 0.01 or to.normalized().angle_to(fwd) <= float(CombatConfig.FEEL.assist_angle):
			return o
	return null


## El tiempo casi se detiene un instante (en segundos reales): el golpe "pesa".
func hitstop(seconds: float) -> void:
	_hitstop_until = maxi(_hitstop_until, Time.get_ticks_msec() + int(seconds * 1000.0))
	Engine.time_scale = float(CombatConfig.FEEL.hitstop_scale)


func _process(_delta: float) -> void:
	# el hitstop se cuenta en tiempo real: con time_scale bajo, delta también es chico
	if _hitstop_until > 0 and Time.get_ticks_msec() >= _hitstop_until:
		_hitstop_until = 0
		Engine.time_scale = 1.0


func _shake(amount: float) -> void:
	if camera_rig:
		camera_rig.shake(amount)


## Golpe del combatiente que está en la fase activa de su ataque.
func _strike(c: Combatant) -> void:
	var w := c.weapon
	var fwd := _forward(c)
	var p := c.body.global_position
	for e: Array in _enemies_of(c, w.reach):
		var o: Combatant = e[0]
		var to := o.body.global_position - p
		to.y = 0.0
		if to.length() > 0.01 and to.normalized().angle_to(fwd) > float(w.arc):
			continue
		# la zona sale de la diferencia de altura: evita cajas por hueso
		var dy := o.body.global_position.y - p.y
		var zone := "head" if dy > 1.2 else ("limb" if dy < -0.4 else "body")
		var res := o.take_hit(float(w.damage) * c.hit_mult, float(w.poise) * c.hit_mult, zone, c)
		if res.is_empty():
			continue
		if res.get("parried", false):
			# parry: el arma rebota con chispas, el atacante sale hacia atrás y el tiempo se detiene más
			if c.body.has_method("push"):
				c.body.push(-to.normalized() * 0.9) # poco: tiene que quedar a tiro del contraataque
			EventBus.combat_impact.emit(o.body.global_position + Vector3.UP * 1.3 + to.normalized() * -0.5, "parry", 1.0)
			if c == player or o == player:
				res.attacker = c.team
				res.attacker_body = c.body
				res.target = o
				EventBus.combat_hit.emit(res)
				hitstop(float(CombatConfig.FEEL.hitstop_heavy) * 1.6)
				_shake(float(CombatConfig.FEEL.shake_heavy))
			continue
		# el golpe empuja: más con armas pesadas, si rompe el temple o lo tumba; casi nada si lo bloquea
		var force := 0.8 if res.blocked else (2.0 + float(w.poise) / 12.0) * (1.6 if res.staggered else 1.0) * (1.8 if res.dead else 1.0) * float(CombatConfig.HITSTUN.knockback)
		if o.body.has_method("push"):
			o.body.push(to.normalized() * force)
		if c == player or o == player:
			res.attacker = c.team
			res.attacker_body = c.body
			res.target = o
			EventBus.combat_hit.emit(res)
			# sensación: el golpe del jugador detiene el tiempo un instante (más si es pesado o remata); recibir
			# también, y la cámara tiembla
			var f: Dictionary = CombatConfig.FEEL
			var heavy: bool = float(w.poise) >= 40.0 or c.hit_mult > 1.0 or res.dead
			if o == player:
				hitstop(float(f.hitstop_taken) * (0.5 if res.blocked else 1.0))
				_shake(float(f.shake_block) if res.blocked else float(f.shake_taken))
			else:
				hitstop(float(f.hitstop_heavy) if heavy else float(f.hitstop_light))
				_shake(float(f.shake_heavy) if heavy else float(f.shake_deal))
		var kind := "hueso" if o.team == "faccion" else ("metal" if res.blocked else "carne")
		EventBus.combat_impact.emit(o.body.global_position + Vector3.UP * (1.6 if zone == "head" else 1.0), kind, minf(1.6, float(w.damage) / 20.0))
	c.mark_hit()


func _physics_process(delta: float) -> void:
	if not CombatConfig.ENABLED or get_tree().paused:
		return
	for c: Combatant in combatants.duplicate():
		c.update(delta)
		if c.is_striking():
			_strike(c)
		var t := c.lock_target
		if t:
			var d := Vector2(t.body.global_position.x - c.body.global_position.x, t.body.global_position.z - c.body.global_position.z).length()
			# si muere, salta al siguiente más cercano (como en Dark Souls); si se aleja, se suelta
			if not t.is_alive() and c == player:
				var look := t.body.global_position - c.body.global_position
				look.y = 0.0
				_set_lock(c, _find(c, look.normalized()))
			elif not t.is_alive() or d > CombatConfig.LOCK_ON.break_range:
				_set_lock(c, null)
