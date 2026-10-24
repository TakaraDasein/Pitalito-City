class_name FactionSystem
extends Node3D
## Pone y retira enemigos de los Restos en sus zonas (CombatConfig.ZONES, FICCIÓN DECLARADA, lejos de la
## cabecera): como el tráfico, solo existen cerca del jugador. Port reducido de web/src/systems/FactionSystem.js
## (sin reputación ni bases todavía).

var focus: Node3D
var _alive: Dictionary = {}     # id de zona → Array[Enemy]
var _cooldown: Dictionary = {}  # id de zona → segundos hasta poder volver a poblar
var _t := 0.0


func _process(delta: float) -> void:
	if not CombatConfig.ENABLED or focus == null:
		return
	for k in _cooldown.keys():
		_cooldown[k] -= delta
	_t -= delta
	if _t > 0.0:
		return
	_t = 0.5
	var p := focus.global_position
	var active := 0
	for list: Array in _alive.values():
		active += list.size()
	for z: Dictionary in CombatConfig.ZONES:
		var list: Array = _alive.get(z.id, [])
		var d := Vector2(z.x - p.x, z.z - p.z).length() - float(z.radius)
		# muertos de hace rato o zona lejana: se retiran
		for e: Enemy in list.duplicate():
			var far := Vector2(e.global_position.x - p.x, e.global_position.z - p.z).length() > CombatConfig.SPAWN.despawn_radius
			if far or e.dead_for(12.0):
				if not e.self_c.is_alive():
					_cooldown[z.id] = CombatConfig.SPAWN.respawn_seconds
				list.erase(e)
				e.queue_free()
				active -= 1
		_alive[z.id] = list
		if d > CombatConfig.SPAWN.spawn_radius or _cooldown.get(z.id, 0.0) > 0.0:
			continue
		while list.size() < int(z.enemies) and active < int(CombatConfig.SPAWN.max_active):
			var at := _spot(z, p)
			if at == Vector3.INF:
				break
			list.push_back(spawn(_pick(), at, z.id))
			active += 1


## Pone un enemigo en `at` (también lo usan las pruebas).
func spawn(kind: String, at: Vector3, zone_id := "") -> Enemy:
	var e := Enemy.create(kind, Vector3(at.x, WorldData.height(at.x, at.z) + 0.2, at.z), zone_id)
	add_child(e)
	return e


## Un punto de la zona, a más de min_distance del jugador y dentro del radio de aparición.
func _spot(z: Dictionary, p: Vector3) -> Vector3:
	for i in 8:
		var a := randf() * TAU
		var r := sqrt(randf()) * float(z.radius)
		var q := Vector3(z.x + cos(a) * r, 0, z.z + sin(a) * r)
		var d := Vector2(q.x - p.x, q.z - p.z).length()
		if d >= CombatConfig.SPAWN.min_distance and d <= CombatConfig.SPAWN.spawn_radius:
			return q
	return Vector3.INF


func _pick() -> String:
	var total := 0.0
	for w: float in CombatConfig.ENEMY_MIX.values():
		total += w
	var r := randf() * total
	for k: String in CombatConfig.ENEMY_MIX:
		r -= CombatConfig.ENEMY_MIX[k]
		if r <= 0.0:
			return k
	return "centinela"
