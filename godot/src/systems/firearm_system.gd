class_name FirearmSystem
extends Node3D
## Disparos (port de web/src/systems/FirearmSystem.js): lo mismo para el jugador y para quien lleve un arma. El
## tiro es instantáneo (rayo), con dispersión y, en las escopetas, varios perdigones. Recibe el primero en la línea:
##   · combatientes del otro bando: un cilindro vertical (FirearmsConfig.TARGET)
##   · el mundo (edificios, relieve, vehículos) corta el rayo: no se dispara a través de las paredes
## Los perdigones de un tiro se suman y se cobran de una vez (si no, la invulnerabilidad que deja el primero se
## tragaría los demás). Fogonazo: una sola luz que se enciende un instante donde se dispare.

static var instance: FirearmSystem

var _flash: OmniLight3D
var _flash_t := 0.0
var _spent: Array = []        # [RigidBody3D, vida] casquillos y cargadores en el suelo (FirearmsConfig.SPENT)


func _ready() -> void:
	instance = self
	_flash = OmniLight3D.new()
	_flash.light_color = Color("#ffcf7a")
	_flash.omni_range = 9.0
	_flash.light_energy = 0.0
	_flash.shadow_enabled = false
	add_child(_flash)


## shooter: Combatant que dispara · from: de donde sale el rayo (la cámara del jugador) · dir: normalizada ·
## muzzle: boca del arma (fogonazo) · precision: multiplica la dispersión. Devuelve true si le dio a alguien.
func shoot(shooter: Combatant, from: Vector3, dir: Vector3, id: String, muzzle: Vector3, precision := 1.0, damage_mult := 1.0) -> bool:
	var f: Dictionary = FirearmsConfig.FIREARMS[id]
	var hits := {}   # Combatant → {damage, zone}
	for p in int(f.pellets):
		var s := float(f.spread) * precision
		var d := (dir + Vector3(randf_range(-s, s), randf_range(-s, s), randf_range(-s, s))).normalized()
		var h := _ray(shooter, from, d, f)
		if h.is_empty():
			continue
		var prev: Dictionary = hits.get(h.c, {"damage": 0.0, "zone": "limb"})
		hits[h.c] = {"damage": float(prev.damage) + float(h.damage), "zone": "head" if prev.zone == "head" or h.zone == "head" else h.zone}
	var cs := CombatSystem.instance
	for c: Combatant in hits:
		var g: Dictionary = hits[c]
		var res := c.take_hit(float(g.damage) * damage_mult, float(FirearmsConfig.HIT.poise), g.zone)
		if res.is_empty():
			continue
		# el tiro empuja en la dirección del disparo, más cuanto más daño (la escopeta tumba)
		if not res.blocked and c.body.has_method("push"):
			var k := minf(float(FirearmsConfig.HIT.push_max), 1.0 + float(g.damage) / 12.0) * (1.6 if res.dead else 1.0)
			c.body.push(Vector3(dir.x, 0, dir.z) * k)
		if cs and (c == cs.player or shooter == cs.player):
			res.attacker = shooter.team
			res.attacker_body = shooter.body
			res.target = c
			EventBus.combat_hit.emit(res)
			if shooter == cs.player:
				cs.hitstop(float(CombatConfig.FEEL.hitstop_light) * (1.6 if res.dead else 1.0))
	_flash.global_position = muzzle
	_flash.light_energy = 6.0
	_flash_t = 0.05
	if AudioSystem.instance:
		var cam := get_viewport().get_camera_3d()
		var dist := cam.global_position.distance_to(muzzle) if cam else 0.0
		AudioSystem.instance.gunshot(float(f.noise) / 100.0, dist)
	return not hits.is_empty()


## Un casquillo (o el cartucho de la escopeta) sale disparado y rebota: cuerpo rígido chiquito, de latón o rojo.
func eject_casing(at: Vector3, dir: Vector3, shell := false) -> void:
	var c: Dictionary = FirearmsConfig.SPENT
	var r: float = c.casing_size[0] * (2.0 if shell else 1.0)
	var h: float = c.casing_size[1] * (3.0 if shell else 1.0)
	var mesh := CylinderMesh.new()
	mesh.top_radius = r
	mesh.bottom_radius = r
	mesh.height = h
	mesh.radial_segments = 6
	mesh.rings = 1
	var shape := CylinderShape3D.new()
	shape.radius = r
	shape.height = h
	var v := dir.normalized() * float(c.eject_speed) * randf_range(0.8, 1.2)
	_spawn(mesh, shape, Transform3D(Basis(Vector3(randf(), randf(), randf()).normalized(), randf() * TAU), at), v,
		MaterialLibrary.plain(Color("#b8323a") if shell else Color("#c9a24a"), 0.35), 0.01 if not shell else 0.03)


## El cargador vacío se suelta del arma y cae (caja del tamaño del cargador, oscura).
func drop_magazine(xf: Transform3D, size: Array) -> void:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(size[0], size[1], size[2])
	var shape := BoxShape3D.new()
	shape.size = mesh.size
	_spawn(mesh, shape, xf, Vector3(0, -0.5, 0), MaterialLibrary.plain(Color("#2b2b2b"), 0.5), 0.25)


func _spawn(mesh: Mesh, shape: Shape3D, xf: Transform3D, v: Vector3, mat: Material, mass: float) -> void:
	var b := RigidBody3D.new()
	b.collision_layer = 0
	b.collision_mask = 1 | 16   # edificios y relieve
	b.mass = mass
	b.continuous_cd = true
	var pm := PhysicsMaterial.new()
	pm.bounce = 0.35
	pm.friction = 0.8
	b.physics_material_override = pm
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	b.add_child(mi)
	var cs := CollisionShape3D.new()
	cs.shape = shape
	b.add_child(cs)
	add_child(b)
	b.global_transform = xf
	b.linear_velocity = v
	b.angular_velocity = Vector3(randf_range(-20, 20), randf_range(-20, 20), randf_range(-20, 20))
	_spent.push_back([b, float(FirearmsConfig.SPENT.life)])
	while _spent.size() > int(FirearmsConfig.SPENT.max):
		(_spent.pop_front()[0] as Node).queue_free()


## El primero en la línea: { c, damage, zone } o {} (y la partícula del impacto donde dio).
func _ray(shooter: Combatant, from: Vector3, dir: Vector3, f: Dictionary) -> Dictionary:
	var reach := float(f.range)
	var t_world := reach
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * reach, 1 | 4 | 16)
	if shooter.body is CollisionObject3D:
		q.exclude = [(shooter.body as CollisionObject3D).get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty():
		t_world = from.distance_to(hit.position)
	var best: Combatant = null
	var t_best := t_world
	for c: Combatant in (CombatSystem.instance.combatants if CombatSystem.instance else []):
		if c == shooter or not c.is_alive() or c.team == shooter.team or not c.body.visible:
			continue
		var t := _cylinder(from, dir, c.body.global_position)
		if t < t_best:
			t_best = t
			best = c
	var at := from + dir * minf(t_best, reach)
	if best:
		var dy := at.y - best.body.global_position.y
		var zone := "head" if dy > 1.45 else ("limb" if dy < 0.8 else "body")
		EventBus.combat_impact.emit(at, "hueso" if best.team == "faccion" else "carne", 0.8)
		return {"c": best, "damage": float(f.damage) * (1.0 - 0.5 * minf(1.0, t_best / reach)), "zone": zone}
	if t_world < reach:
		EventBus.combat_impact.emit(at, "metal", 0.4)
	return {}


## Distancia a la que el rayo entra en el cilindro vertical de un combatiente (base en p), o INF.
func _cylinder(o: Vector3, d: Vector3, p: Vector3) -> float:
	var r := float(FirearmsConfig.TARGET.radius)
	var ox := o.x - p.x
	var oz := o.z - p.z
	var a := d.x * d.x + d.z * d.z
	if a < 1e-8:
		return INF
	var b := 2.0 * (ox * d.x + oz * d.z)
	var c := ox * ox + oz * oz - r * r
	var disc := b * b - 4.0 * a * c
	if disc < 0.0:
		return INF
	var t := (-b - sqrt(disc)) / (2.0 * a)
	if t < 0.0:
		return INF
	var y := o.y + d.y * t
	return t if y >= p.y and y <= p.y + float(FirearmsConfig.TARGET.height) else INF


func _process(delta: float) -> void:
	for e: Array in _spent.duplicate():
		e[1] -= delta
		if e[1] <= 0.0:
			(e[0] as Node).queue_free()
			_spent.erase(e)
	if _flash_t > 0.0:
		_flash_t -= delta
		if _flash_t <= 0.0:
			_flash.light_energy = 0.0
