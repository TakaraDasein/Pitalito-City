class_name CityMap
## Mapa de la ciudad horneado desde web/src/ui/MapRenderer.js (map.png, 2 m por píxel) con su encuadre, y la
## lista de lugares buscables. Lo comparten el minimapa y el mapa completo. Se carga una vez.

const DIR := "res://assets/ui"
const ROUTE := Color("#b04dff")
const PLAYER := Color.WHITE
const WAYPOINT := Color("#ffd400")

## Agrupación de los tipos de OSM en categorías del buscador (PLACE_KINDS de web/src/ui/MapScreen.js).
const PLACE_KINDS := {
	"bus_station": "Transporte", "hospital": "Salud", "clinic": "Salud", "university": "Educación",
	"college": "Educación", "school": "Educación", "townhall": "Gobierno", "library": "Cultura",
	"fire_station": "Servicios", "police": "Servicios", "marketplace": "Comercio", "park": "Parques",
	"stadium": "Deporte", "sports_centre": "Deporte", "place_of_worship": "Iglesias", "building": "Lugares",
	"hotel": "Hoteles", "fuel": "Estaciones", "religious": "Iglesias", "community_centre": "Cultura",
}

static var texture: Texture2D
static var min_pos := Vector2.ZERO   # esquina (x, z) del mundo
static var scale := 0.5              # píxeles por metro
static var places: Array = []        # { n, k, x, z, hito }


static func ensure() -> bool:
	if texture:
		return true
	if not ResourceLoader.exists(DIR + "/map.png"):
		return false
	texture = load(DIR + "/map.png")
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(DIR + "/map.json"))
	min_pos = Vector2(meta.minX, meta.minZ)
	scale = meta.scale
	_build_places()
	return true


static func to_map(x: float, z: float) -> Vector2:
	return (Vector2(x, z) - min_pos) * scale


static func to_world(p: Vector2) -> Vector2:
	return p / scale + min_pos


static func normalize(s: String) -> String:
	# Sin tildes y en minúsculas, para buscar "jose hilario" o "galeria" igual que en la web
	var out := s.to_lower()
	for pair in [["á", "a"], ["é", "e"], ["í", "i"], ["ó", "o"], ["ú", "u"], ["ü", "u"], ["ñ", "n"]]:
		out = out.replace(pair[0], pair[1])
	return out


static func _build_places() -> void:
	places.clear()
	var seen := {"parque principal jose hilario lopez": true, "iglesia central san antonio de padua": true}
	var lm: Dictionary = WorldData.manifest.get("landmarks", {})
	if lm.has("parquePrincipal"):
		places.push_back({"n": "Parque Principal José Hilario López", "k": "Hitos", "x": lm.parquePrincipal.c[0], "z": lm.parquePrincipal.c[1], "hito": true})
	if lm.has("catedral"):
		places.push_back({"n": "Iglesia San Antonio de Padua", "k": "Hitos", "x": lm.catedral.c[0], "z": lm.catedral.c[1], "hito": true})
	for p: Dictionary in WorldData.pois:
		var group: String = PLACE_KINDS.get(p.k, "")
		var key := normalize(p.n)
		if group == "" or seen.has(key):
			continue
		seen[key] = true
		places.push_back({"n": p.n, "k": group, "x": p.x, "z": p.z, "hito": false})


static func search(q: String, limit := 80) -> Array:
	var nq := normalize(q)
	var out := []
	for p: Dictionary in places:
		if nq == "" or normalize(p.n).contains(nq):
			out.push_back(p)
			if out.size() >= limit:
				break
	return out


## Flecha del jugador (triángulo estilo GPS), como drawArrow de la web.
static func draw_arrow(ci: CanvasItem, at: Vector2, angle: float, size := 9.0) -> void:
	var pts := PackedVector2Array([Vector2(0, -size), Vector2(size * 0.72, size * 0.8), Vector2(0, size * 0.4), Vector2(-size * 0.72, size * 0.8)])
	var xf := Transform2D(angle, at)
	pts = xf * pts
	ci.draw_colored_polygon(pts, PLAYER)
	pts.push_back(pts[0])
	ci.draw_polyline(pts, Color.BLACK, 2.0, true)


static func draw_pin(ci: CanvasItem, at: Vector2) -> void:
	ci.draw_circle(at + Vector2(0, -12), 7.0, WAYPOINT)
	ci.draw_colored_polygon(PackedVector2Array([at + Vector2(-5, -9), at + Vector2(5, -9), at]), WAYPOINT)
	ci.draw_arc(at + Vector2(0, -12), 7.0, 0.0, TAU, 20, Color.BLACK, 1.5, true)
