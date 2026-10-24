extends Node
## Datos del mundo cargados una vez: manifest, relieve y nombres de calles. Solo lectura después de _ready,
## por eso los hilos del streaming pueden consultar height() sin candados.

var manifest: Dictionary = {}
var origin := Vector2.ZERO          # (lat, lon) del Parque Principal
var tile_size := 250.0
var tiles: Dictionary = {}          # Vector2i → true: tiles que existen en disco
var street_names: PackedStringArray = []
## Grafo vial de toda la ciudad (map.json): GPS, tráfico y nombre de la calle.
var roads: RoadNetwork
## Lugares con nombre de OSM (map.json): { n, k, x, z }. Los usa el buscador del mapa.
var pois: Array = []
## Los mismos, por tile (Vector2i → Array): los edificios buscan su negocio real sin recorrer la lista entera.
var pois_by_tile: Dictionary = {}
## Ríos y quebradas completos (map.json): el Guarapas, la Cálamo y los demás cauces de OSM.
var water: Array = []

# Relieve: rejilla size × size de cell metros desde min, en metros (Float32, ver tools/sync_from_web.sh)
var terrain_size := 0
var terrain_cell := 25.0
var terrain_min := 0.0
var _heights: PackedFloat32Array


func _ready() -> void:
	var path := WorldConfig.DATA_DIR + "/manifest.json"
	if not FileAccess.file_exists(path):
		push_error("Faltan los datos del mundo: corre tools/sync_from_web.sh")
		return
	manifest = JSON.parse_string(FileAccess.get_file_as_string(path))
	origin = Vector2(manifest.origin.lat, manifest.origin.lon)
	tile_size = manifest.tileSize
	for k: String in manifest.tiles:
		var p := k.split("_")
		tiles[Vector2i(int(p[0]), int(p[1]))] = true
	var t: Dictionary = manifest.terrain
	terrain_size = t.size
	terrain_cell = t.cell
	terrain_min = t.min
	_heights = FileAccess.get_file_as_bytes(WorldConfig.DATA_DIR + "/terrain_f32.bin").to_float32_array()
	_load_names()
	LandmarkSystem.load_exclusions()


func _load_names() -> void:
	var map_path := WorldConfig.DATA_DIR + "/map.json"
	if not FileAccess.file_exists(map_path):
		return
	var map: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(map_path))
	if map.has("names"):
		street_names = PackedStringArray(map.names)
	roads = RoadNetwork.new(map)
	pois = map.get("pois", [])
	water = map.get("water", [])
	for poi: Dictionary in pois:
		var k := tile_key(poi.x, poi.z)
		if not pois_by_tile.has(k):
			pois_by_tile[k] = []
		pois_by_tile[k].push_back(poi)


func has_terrain() -> bool:
	return not _heights.is_empty()


## Altura del relieve real (bilineal). Todo lo que toca el suelo pasa por aquí, nunca por y = 0.
func height(x: float, z: float) -> float:
	if _heights.is_empty():
		return 0.0
	var n := terrain_size
	var fx := clampf((x - terrain_min) / terrain_cell, 0.0, n - 1.001)
	var fz := clampf((z - terrain_min) / terrain_cell, 0.0, n - 1.001)
	var i := int(fx)
	var j := int(fz)
	var tx := fx - i
	var tz := fz - j
	var k := j * n + i
	var a := lerpf(_heights[k], _heights[k + 1], tx)
	var b := lerpf(_heights[k + n], _heights[k + n + 1], tx)
	return lerpf(a, b, tz)


## Altura del vértice (i, j) de la rejilla, sin interpolar.
func grid_height(i: int, j: int) -> float:
	var n := terrain_size
	return _heights[clampi(j, 0, n - 1) * n + clampi(i, 0, n - 1)]


func tile_key(x: float, z: float) -> Vector2i:
	return Vector2i(floori(x / tile_size), floori(z / tile_size))


func tile_path(key: Vector2i) -> String:
	return "%s/tiles/%d_%d.json" % [WorldConfig.DATA_DIR, key.x, key.y]


func spawn() -> Dictionary:
	return manifest.get("spawn", {"x": 0.0, "z": 0.0, "heading": 0.0})
