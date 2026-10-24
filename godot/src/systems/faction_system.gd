class_name FactionSystem
extends Node3D
## Pone y retira enemigos de los Restos en sus zonas (CombatConfig.ZONES, FICCIÓN DECLARADA, lejos de la
## cabecera): como el tráfico, solo existen cerca del jugador. Port reducido de web/src/systems/FactionSystem.js
## (sin reputación ni bases todavía).

var focus: Node3D
var _alive: Dictionary = {}     # id de zona → Array[Enemy]
var _cooldown: Dictionary = {}  # id de zona → segundos hasta poder volver a poblar
var _t := 0.0
var _bosses := {}               # id de zona → Creature (su jefe, CreaturesConfig.BOSSES)
var _raiders := {}              # id de zona → [Creature] saqueadores


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
			if far or e.gone():
				if not e.self_c.is_alive():
					_cooldown[z.id] = CombatConfig.SPAWN.respawn_seconds
				list.erase(e)
				e.queue_free()
				active -= 1
		_alive[z.id] = list
		_extras(z, p, d)
		if d > CombatConfig.SPAWN.spawn_radius or _cooldown.get(z.id, 0.0) > 0.0:
			continue
		while list.size() < int(z.enemies) and active < int(CombatConfig.SPAWN.max_active):
			var at := _spot(z, p)
			if at == Vector3.INF:
				break
			list.push_back(spawn(_pick(), at, z.id))
			active += 1


## El jefe de la base en su centro y unos saqueadores entre los Restos (CreatureSystem: modelos externos). Se
## retiran al alejarse; un jefe abatido no vuelve en esta partida.
func _extras(z: Dictionary, p: Vector3, d: float) -> void:
	var cs := CreatureSystem.instance
	if cs == null:
		return
	var near := d <= float(CombatConfig.SPAWN.spawn_radius)
	var far := d > float(CombatConfig.SPAWN.despawn_radius)
	var boss_kind: String = CreaturesConfig.BOSSES.get(z.id, "")
	var b: Creature = _bosses.get(z.id)
	if b and is_instance_valid(b):
		if far and b.self_c.is_alive():
			b.queue_free()
			_bosses.erase(z.id)
	elif near and boss_kind != "" and not _bosses.has(z.id):
		_bosses[z.id] = cs.spawn(boss_kind, Vector3(z.x, 0, z.z))
		_arena(z)
	var list: Array = _raiders.get(z.id, [])
	list = list.filter(func(c): return is_instance_valid(c))
	if far:
		for c in list:
			c.queue_free()
		list = []
	elif near and list.is_empty():
		for i in CreaturesConfig.RAIDERS_PER_ZONE:
			var at := _spot(z, p)
			if at != Vector3.INF:
				var c := cs.spawn("saqueador", at)
				if c:
					list.push_back(c)
	_raiders[z.id] = list


## Corral del jefe: barricadas (Kenney, CC0) en círculo alrededor del centro de la zona, con un hueco de entrada
## hacia el jugador que llega. Sólidas (capa 1). Se arma una vez por zona y queda.
var _arenas := {}
func _arena(z: Dictionary) -> void:
	var a: Dictionary = CreaturesConfig.ARENA
	if _arenas.has(z.id) or not ResourceLoader.exists(a.model):
		return
	var root := Node3D.new()
	root.name = "corral_" + String(z.id)
	add_child(root)
	_arenas[z.id] = root
	var scene: PackedScene = load(a.model)
	var n := int(a.pieces)
	var entry := randi() % n
	for i in n:
		if absi(i - entry) < int(a.gap) / 2 + 1 and int(a.gap) > 0:
			continue
		var ang := i * TAU / n
		var at := Vector3(z.x + cos(ang) * float(a.radius), 0, z.z + sin(ang) * float(a.radius))
		var piece: Node3D = scene.instantiate()
		piece.position = Vector3(at.x, WorldData.height(at.x, at.z), at.z)
		piece.rotation.y = -ang + PI * 0.5
		piece.scale = Vector3.ONE * (TAU * float(a.radius) / n) / 1.0
		root.add_child(piece)
		var body := StaticBody3D.new()
		body.collision_layer = 1
		var cs := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(1.0, 1.0, 0.15)
		cs.shape = box
		cs.position.y = 0.5
		body.add_child(cs)
		piece.add_child(body)


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
