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


## Corral del jefe: cerca de guadua en círculo alrededor del centro de la zona, con un hueco de entrada. Una malla
## por pieza (MultiMesh: varas y amarres) y colisión por tramos de 2 m. Se arma una vez por zona y queda.
var _arenas := {}
func _arena(z: Dictionary) -> void:
	var a: Dictionary = CreaturesConfig.ARENA
	if _arenas.has(z.id):
		return
	var root := Node3D.new()
	root.name = "corral_" + String(z.id)
	add_child(root)
	_arenas[z.id] = root
	var r := float(a.radius)
	var entry := randf() * TAU
	var gap_ang := float(a.gap) / r
	var n := int(TAU * r / float(a.spacing))
	var poles := []
	for i in n:
		var ang := i * TAU / n
		if absf(angle_difference(ang, entry)) < gap_ang * 0.5:
			continue
		var p := Vector3(z.x + cos(ang) * r, 0, z.z + sin(ang) * r)
		p.y = WorldData.height(p.x, p.z)
		# altura y grosor algo distintos: no hay dos varas iguales
		var h := float(a.height) * randf_range(0.85, 1.1)
		poles.push_back(Transform3D(Basis().scaled(Vector3(1, h / float(a.height), 1)).rotated(Vector3.UP, randf() * TAU), p + Vector3.UP * h * 0.5))
	var pole := CylinderMesh.new()
	pole.top_radius = float(a.pole) * 0.85
	pole.bottom_radius = float(a.pole)
	pole.height = float(a.height)
	pole.radial_segments = 6
	_mm(root, pole, poles, Color(a.color))
	# dos amarres horizontales (tramos rectos entre varas cada ~2 m)
	var ties := []
	var segs := int(TAU * r / 2.0)
	for i in segs:
		var a0 := i * TAU / segs
		var a1 := (i + 1) * TAU / segs
		var mid := (a0 + a1) * 0.5
		if absf(angle_difference(mid, entry)) < gap_ang * 0.5 + 0.05:
			continue
		var p0 := Vector3(z.x + cos(a0) * r, 0, z.z + sin(a0) * r)
		var p1 := Vector3(z.x + cos(a1) * r, 0, z.z + sin(a1) * r)
		p0.y = WorldData.height(p0.x, p0.z)
		p1.y = WorldData.height(p1.x, p1.z)
		var dir := p1 - p0
		var len := dir.length()
		for hy in [0.5, 1.5]:
			var c: Vector3 = (p0 + p1) * 0.5 + Vector3.UP * float(hy)
			var b := Basis.looking_at(dir.normalized(), Vector3.UP).scaled(Vector3(1, 1, len))
			ties.push_back(Transform3D(b, c))
		# colisión del tramo
		var body := StaticBody3D.new()
		body.collision_layer = 1
		var cs := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(0.2, float(a.height), len)
		cs.shape = box
		body.add_child(cs)
		body.transform = Transform3D(Basis.looking_at(dir.normalized(), Vector3.UP), (p0 + p1) * 0.5 + Vector3.UP * float(a.height) * 0.5)
		root.add_child(body)
	var tie := BoxMesh.new()
	tie.size = Vector3(0.05, 0.05, 1.0)
	_mm(root, tie, ties, Color(a.tie))


func _mm(root: Node3D, mesh: Mesh, xforms: Array, color: Color) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = MaterialLibrary.plain(color, 0.8)
	root.add_child(mmi)


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
