class_name GeoProjection
## Proyección local equirectangular, idéntica a web/src/geo/projection.js (precisa para ~10 km).
## Ejes: +X este, −Z norte, Y arriba, metros. Godot usa la misma convención que three.js: no hay que voltear nada.

const R_LAT := 110540.0
const R_LON := 111320.0


static func to_world(origin: Vector2, lat: float, lon: float) -> Vector2:
	var cos_lat := cos(deg_to_rad(origin.x))
	return Vector2((lon - origin.y) * cos_lat * R_LON, -(lat - origin.x) * R_LAT)


## Devuelve (lat, lon).
static func to_geo(origin: Vector2, x: float, z: float) -> Vector2:
	var cos_lat := cos(deg_to_rad(origin.x))
	return Vector2(origin.x - z / R_LAT, origin.y + x / (cos_lat * R_LON))
