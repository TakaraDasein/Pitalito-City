class_name LootSystem
extends Node3D
## Botín (port de web/src/systems/LootSystem.js): contenedores alrededor de los lugares reales de OSM (hospitales,
## CAI, iglesias, tiendas, plazas de mercado, bombas, bomberos: WorldData.pois) que se registran con F, y lo que
## sueltan los Restos al caer. FICCIÓN DECLARADA: lo de adentro es inventado (LootConfig).
##   · determinista: cada contenedor tiene un id fijo (<índice del POI>:<n>) y su contenido sale de un sorteo
##     sembrado con ese id: el mismo hospital tiene siempre lo mismo hasta que alguien lo saquea
##   · lo saqueado se recuerda en user://botin.cfg, entre partidas
##   · nada existe lejos: las piezas se arman al acercarse y se retiran al alejarse; al armarse se aparta del
##     edificio (el punto del POI suele caer adentro y los contenedores van en el predio)

static var instance: LootSystem

var focus: Node3D
var containers: Array = []     # {id, type, spec, place, x0, z0, heading, node, items?, life?}
var _looted := {}              # id → true
var _left := {}                # id → [{id, n}] lo que no cupo en la mochila
var _t := 0.0
var _materials := {}


func _ready() -> void:
	instance = self
	var cfg := ConfigFile.new()
	if cfg.load(LootConfig.LOOT.save) == OK:
		for id: String in cfg.get_value("botin", "saqueados", []):
			_looted[id] = true
		_left = cfg.get_value("botin", "restos", {})
	for i in WorldData.pois.size():
		var poi: Dictionary = WorldData.pois[i]
		var place: Dictionary = LootConfig.PLACES.get(poi.get("k", ""), {})
		if place.is_empty():
			continue
		var r := RandomNumberGenerator.new()
		r.seed = hash("lugar:%d" % i)
		for n in int(place.count):
			var type: String = place.containers[n % place.containers.size()]
			var a := r.randf() * TAU
			var d := 4.0 + r.randf() * 7.0
			containers.push_back({"id": "%d:%d" % [i, n], "type": type, "spec": LootConfig.CONTAINERS[type], "place": poi.get("n", ""),
				"x0": float(poi.x) + cos(a) * d, "z0": float(poi.z) + sin(a) * d, "heading": r.randf() * TAU, "node": null})


func _save() -> void:
	var cfg := ConfigFile.new()
	cfg.load(LootConfig.LOOT.save)
	cfg.set_value("botin", "saqueados", _looted.keys())
	cfg.set_value("botin", "restos", _left)
	cfg.save(LootConfig.LOOT.save)


## Lo que hay dentro, sorteado con la semilla del contenedor. Vacío si ya se saqueó.
func contents(c: Dictionary) -> Array:
	if _looted.has(c.id):
		return []
	if _left.has(c.id):
		return _left[c.id]
	if c.has("items"):
		return c.items
	var r := RandomNumberGenerator.new()
	r.seed = hash("botin:" + String(c.id))
	var rolls: Array = c.spec.rolls
	var n := int(rolls[0]) + r.randi_range(0, int(rolls[1]) - int(rolls[0]))
	var table: Array = LootConfig.TABLES[c.spec.table]
	var total := 0.0
	for e: Array in table:
		total += float(e[1])
	var got := {}
	for t in n:
		var x := r.randf() * total
		var pick: Array = table[0]
		for e: Array in table:
			x -= float(e[1])
			if x <= 0.0:
				pick = e
				break
		got[pick[0]] = got.get(pick[0], 0) + int(pick[2]) + r.randi_range(0, int(pick[3]) - int(pick[2]))
	var out := []
	for id: String in got:
		out.push_back({"id": id, "n": got[id]})
	return out


func _process(delta: float) -> void:
	# lo que soltaron los enemigos se pierde al rato
	for c: Dictionary in containers.duplicate():
		if c.has("life"):
			c.life -= delta
			if c.life <= 0.0:
				if c.node:
					c.node.queue_free()
				containers.erase(c)
	_t -= delta
	if _t > 0.0 or focus == null:
		return
	_t = 0.5
	var p := focus.global_position
	for c: Dictionary in containers:
		var near := Vector2(c.x0 - p.x, c.z0 - p.z).length() < float(LootConfig.LOOT.visible_radius)
		if near and c.node == null:
			_show(c)
		elif not near and c.node != null:
			c.node.queue_free()
			c.node = null


## Arma la pieza: caja del tamaño y color de su clase; la camilla lleva patas y colchoneta. Se aparta de los muros
## probando posiciones alrededor hasta que no toque nada (los tiles ya tienen colisión al acercarse).
func _show(c: Dictionary) -> void:
	var s: Dictionary = c.spec
	var size := Vector3(s.size[0], s.size[1], s.size[2])
	var at := _free_spot(Vector3(c.x0, 0, c.z0), size)
	c.x = at.x
	c.z = at.z
	var root := Node3D.new()
	root.position = Vector3(at.x, WorldData.height(at.x, at.z), at.z)
	root.rotation.y = c.heading
	if s.shape == "camilla":
		_box(root, Vector3(size.x, 0.08, size.z), Vector3(0, size.y - 0.1, 0), "#c9ced3")
		_box(root, Vector3(size.x * 0.92, 0.1, size.z * 0.95), Vector3(0, size.y, 0), "#6f8fa8")
		for sx in [-1, 1]:
			for sz in [-1, 1]:
				_box(root, Vector3(0.04, size.y - 0.1, 0.04), Vector3(sx * (size.x / 2 - 0.05), (size.y - 0.1) / 2, sz * (size.z / 2 - 0.08)), "#9aa0a6")
	else:
		_box(root, size, Vector3(0, size.y / 2 + float(s.get("lift", 0.0)), 0), s.color)
	# sólido: no se atraviesa (capa 1, como los edificios; lo que soltó un enemigo es bajo y se pisa)
	if size.y > 0.3:
		var body := StaticBody3D.new()
		body.collision_layer = 1
		body.collision_mask = 0
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		cs.position = Vector3(0, size.y / 2 + float(s.get("lift", 0.0)), 0)
		body.add_child(cs)
		root.add_child(body)
	add_child(root)
	c.node = root


func _box(root: Node3D, size: Vector3, at: Vector3, color: String) -> void:
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.position = at
	mi.material_override = MaterialLibrary.plain(Color(color))
	root.add_child(mi)


func _free_spot(p: Vector3, size: Vector3) -> Vector3:
	var space := get_world_3d().direct_space_state
	var shape := BoxShape3D.new()
	shape.size = size + Vector3(0.3, 0, 0.3)
	var q := PhysicsShapeQueryParameters3D.new()
	q.shape = shape
	q.collision_mask = 1
	for ring in 6:
		for k in (1 if ring == 0 else 8):
			var a := k * TAU / 8.0
			var c := p + Vector3(cos(a), 0, sin(a)) * ring * 1.5
			var y := WorldData.height(c.x, c.z)
			q.transform = Transform3D(Basis(), Vector3(c.x, y + size.y / 2 + 0.15, c.z))
			if space.intersect_shape(q, 1).is_empty():
				return c
	return p


## El contenedor más cercano al alcance de `at` (o {}), para la interacción (F).
func nearest(at: Vector3) -> Dictionary:
	var best := {}
	var bd := float(LootConfig.LOOT.reach)
	for c: Dictionary in containers:
		if c.node == null:
			continue
		var d := Vector2(c.x - at.x, c.z - at.z).length() - maxf(c.spec.size[0], c.spec.size[2]) / 2.0
		if d < bd:
			bd = d
			best = c
	return best


func label(c: Dictionary) -> String:
	return String(c.spec.name) + (" · vacío" if contents(c).is_empty() else "")


## Pasa a la mochila lo que quepa; lo que no, se queda dentro (y no cuenta como saqueado).
func search(c: Dictionary) -> void:
	var items := contents(c)
	var hud := HUD.instance
	if items.is_empty():
		if hud:
			hud.toast(String(c.spec.name) + ": no queda nada", 2.0)
		return
	var inv := InventorySystem.instance
	if inv.player:
		inv.player.pick_up(Vector3(c.x, 0, c.z))
	var left := []
	var taken := []
	for e: Dictionary in items:
		var k := inv.add(e.id, int(e.n))
		if k > 0:
			taken.push_back("%s ×%d" % [LootConfig.ITEMS[e.id].name, k])
		if int(e.n) - k > 0:
			left.push_back({"id": e.id, "n": int(e.n) - k})
	if c.has("items"):
		c.items = left
		if left.is_empty() and c.node:
			c.node.queue_free()
			containers.erase(c)
	elif left.is_empty():
		_looted[c.id] = true
		_left.erase(c.id)
	else:
		_left[c.id] = left
	_save()
	if hud:
		hud.toast((String(c.spec.name) + ": " + ", ".join(taken)) if not taken.is_empty() else "La mochila va llena", 3.6)
		if not left.is_empty() and not taken.is_empty():
			hud.toast("Tomaste lo que cabía. Queda algo en " + String(c.spec.name).to_lower() + ".", 3.6)


## Deja en el suelo lo que llevaba un enemigo abatido (no se guarda: si te vas, se pierde).
func drop(at: Vector3, items: Array, name := "Lo que llevaba") -> void:
	if items.is_empty():
		return
	var c := {"id": "suelto:%d" % Time.get_ticks_usec(), "type": "suelto", "place": name, "x0": at.x, "z0": at.z, "heading": randf() * TAU,
		"spec": {"name": name, "shape": "caja", "size": [0.5, 0.25, 0.35], "color": "#5a4630"}, "items": items, "node": null,
		"life": LootConfig.LOOT.drop_life}
	containers.push_back(c)
	_show(c)
