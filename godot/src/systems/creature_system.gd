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
	for kind: String in CreaturesConfig.SPAWN:
		var rule = CreaturesConfig.SPAWN[kind]
		if not rule is Dictionary or not CreaturesConfig.CREATURES.has(kind):
			continue
		if rule.get("night", false) and not night or rule.get("day", false) and night:
			continue
		if trees < int(rule.get("forest", 0)) or trees > int(rule.get("forest_max", 9999)):
			continue
		if from_park < float(rule.get("out_of_town", 0.0)):
			continue
		if _count(kind) >= int(rule.max) or randf() > float(rule.chance):
			continue
		var n := randi_range(int(rule.group[0]), int(rule.group[1]))
		var a := randf() * TAU
		var r := randf_range(CreaturesConfig.SPAWN.radius[0], CreaturesConfig.SPAWN.radius[1])
		var center := p + Vector3(cos(a), 0, sin(a)) * r
		for i in n:
			var q := center + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3))
			spawn(kind, q)


func _count(kind: String) -> int:
	return _alive.filter(func(c): return is_instance_valid(c) and c.id == kind and c.self_c.is_alive()).size()


## Pone una criatura en (x, z) sobre el relieve (también lo usan FactionSystem y las pruebas). null sin modelo.
func spawn(kind: String, at: Vector3) -> Creature:
	if not ResourceLoader.exists(CreaturesConfig.DIR + String(CreaturesConfig.CREATURES[kind].file)):
		return null
	var c := Creature.create(kind, Vector3(at.x, WorldData.height(at.x, at.z) + 0.3, at.z))
	add_child(c)
	_alive.push_back(c)
	return c
