class_name InventorySystem
extends Node
## Mochila (port de web/src/systems/InventorySystem.js): objetos por cantidad con tope de peso
## (LootConfig.LOOT.max_load). Se guarda con el botín en user://, así que lo que llevas sigue ahí al volver.
## use() aplica el efecto: hoy la vida (Combatant del jugador); hambre, sed e infección quedan en `state` para la
## supervivencia. Las armas cuerpo a cuerpo que se cargan entran al arsenal (arsenal()).

signal changed

static var instance: InventorySystem

var items: Dictionary = {}     # id → cantidad
var state := {"hunger": 100.0, "thirst": 100.0, "infection": 0.0}
var player: Player


func _ready() -> void:
	instance = self
	var cfg := ConfigFile.new()
	if cfg.load(LootConfig.LOOT.save) == OK:
		var saved: Dictionary = cfg.get_value("mochila", "items", {})
		for id: String in saved:
			if LootConfig.ITEMS.has(id):
				items[id] = int(saved[id])
		state.merge(cfg.get_value("mochila", "estado", {}), true)


func weight() -> float:
	var w := 0.0
	for id: String in items:
		w += float(LootConfig.ITEMS[id].weight) * items[id]
	return w


func count(id: String) -> int:
	return items.get(id, 0)


## Lo que hay, ordenado por nombre: [{id, n, name, weight, use?, detail?}]
func list() -> Array:
	var out := []
	for id: String in items:
		out.push_back(LootConfig.ITEMS[id].merged({"id": id, "n": items[id]}))
	out.sort_custom(func(a, b): return String(a.name).naturalnocasecmp_to(b.name) < 0)
	return out


## Armas del arsenal que se tienen: las de serie y las cuerpo a cuerpo que se cargan, en el orden de ARSENAL.
func arsenal() -> Array:
	return CombatConfig.ARSENAL.filter(func(id): return id in LootConfig.STARTING_WEAPONS or count(id) > 0)


## Mete hasta n unidades sin pasarse del peso. Devuelve cuántas entraron.
func add(id: String, n: int) -> int:
	var item: Dictionary = LootConfig.ITEMS.get(id, {})
	if item.is_empty():
		return 0
	var room := maxi(0, floori((float(LootConfig.LOOT.max_load) - weight() + 1e-6) / float(item.weight)))
	var k := mini(n, room)
	if k > 0:
		items[id] = count(id) + k
		_save()
	return k


func remove(id: String, n := 1) -> void:
	if count(id) <= n:
		items.erase(id)
	else:
		items[id] = count(id) - n
	_save()


## Usa una unidad. false si el objeto no se usa directamente (velas, gasolina, armas…).
func use(id: String) -> bool:
	var item: Dictionary = LootConfig.ITEMS.get(id, {})
	if not item.has("use") or count(id) == 0:
		return false
	var e: Dictionary = item.use
	if e.has("life") and player:
		player.combat.health = minf(float(player.combat.stats.health), player.combat.health + float(e.life))
	for k: String in ["hunger", "thirst", "infection"]:
		if e.has(k):
			state[k] = clampf(float(state[k]) + float(e[k]), 0.0, 100.0)
	remove(id)
	if HUD.instance:
		HUD.instance.toast("Usaste: " + String(item.name), 1.8)
	return true


## Tira todo lo que hay de ese objeto (si es el arma en la mano, se guarda).
func drop_all(id: String) -> void:
	remove(id, count(id))
	if player and player.armed and player.combat.weapon_id == id:
		player.set_armed(false)


func _save() -> void:
	var cfg := ConfigFile.new()
	cfg.load(LootConfig.LOOT.save)
	cfg.set_value("mochila", "items", items)
	cfg.set_value("mochila", "estado", state)
	cfg.save(LootConfig.LOOT.save)
	changed.emit()
