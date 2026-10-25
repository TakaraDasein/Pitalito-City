class_name CreatureSystem
extends Node3D
## Fauna y seres del monte con modelo externo (CreaturesConfig.SPAWN): como el tráfico, solo existen cerca del
## jugador. Cada `every` s se intenta poblar alrededor según el sitio (árboles cerca, distancia al Parque) y la
## hora; se retiran al alejarse o un rato después de caer. Los jefes y saqueadores los pone FactionSystem.
## Si los modelos no se importaron (no se versionan), no aparece nada.

static var instance: CreatureSystem

var focus: Node3D
var world: WorldStreamer
var sky: SkySystem
var _t := 2.0
var _alive: Array[Creature] = []


func _ready() -> void:
	instance = self


func _process(delta: float) -> void:
	if focus == null:
		return
	var p := focus.global_position
	# las que retiró otro sistema (FactionSystem, pruebas) salen de la lista
	_alive = _alive.filter(func(c): return is_instance_valid(c))
	for c: Creature in _alive.duplicate():
		var far := Vector2(c.global_position.x - p.x, c.global_position.z - p.z).length() > float(CreaturesConfig.SPAWN.despawn)
		if far or c.dead_for(20.0):
			_alive.erase(c)
			c.queue_free()
	_t -= delta
	if _t > 0.0:
		return
	_t = float(CreaturesConfig.SPAWN.every)
	var trees := world.trees_near(p.x, p.z, 40.0) if world else 0
	var hour: float = sky.hour if sky else 12.0
	var night := hour >= 18.5 or hour <= 5.5
	var from_park := Vector2(p.x, p.z).length()
	var cfg: Dictionary = CreaturesConfig.SPAWN
	for kind: String in CreaturesConfig.CREATURES:
		var rule: Dictionary = CreaturesConfig.CREATURES[kind].get("spawn", {})
		var hab: String = rule.get("habitat", "base")
		if hab == "base":
			continue  # las pone FactionSystem
		if rule.get("night", false) and not night or rule.get("day", false) and night:
			continue
		match hab:
			"finca":
				if from_park < float(cfg.finca_from_park) or trees > int(cfg.finca_forest_max):
					continue
			"monte":
				if trees < int(rule.get("forest", 14)):
					continue
			"monte_hondo":
				if trees < int(rule.get("forest", 28)) or not _river_near(p, float(rule.get("river", 120.0))):
					continue
		if _count(kind) >= int(rule.get("max", 1)) or randf() > float(rule.get("chance", 0.1)):
			continue
		var g: Array = rule.get("group", [1, 1])
		var n := randi_range(int(g[0]), int(g[1]))
		var a := randf() * TAU
		var r := randf_range(cfg.radius[0], cfg.radius[1])
		var center := p + Vector3(cos(a), 0, sin(a)) * r
		# grupos con variantes (el venado: un macho con astas y el resto hembras)
		var mix: Array = rule.get("mix", [])
		for i in n:
			spawn(kind, center + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3)), String(mix[mini(i, mix.size() - 1)]) if not mix.is_empty() else "")


## ¿Hay un río a menos de `radius` m? (12 rumbos a tres distancias contra WaterSystem)
func _river_near(p: Vector3, radius: float) -> bool:
	if WaterSystem.instance == null:
		return false
	for k in 12:
		var a := k * TAU / 12.0
		for f in [0.33, 0.66, 1.0]:
			var q: Vector3 = p + Vector3(cos(a), 0, sin(a)) * radius * float(f)
			if not WaterSystem.instance.sample(q.x, q.z).is_empty():
				return true
	return false


func _count(kind: String) -> int:
	return _alive.filter(func(c): return is_instance_valid(c) and c.id == kind and c.self_c.is_alive()).size()


## Pone una criatura en (x, z) sobre el relieve (también lo usan FactionSystem y las pruebas). null sin modelo.
func spawn(kind: String, at: Vector3, variant := "") -> Creature:
	if not ResourceLoader.exists(CreaturesConfig.DIR + String(CreaturesConfig.CREATURES[kind].file)):
		return null
	var c := Creature.create(kind, Vector3(at.x, WorldData.height(at.x, at.z) + 0.3, at.z), variant)
	add_child(c)
	_alive.push_back(c)
	return c
