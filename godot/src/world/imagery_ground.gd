class_name ImageryGround
extends Node3D
## Suelo = imagen satelital real (Esri World Imagery) sobre el relieve real. Port de web/src/world/ImageryGround.js:
## teselas Web Mercator en tres niveles, z18 (~0,6 m/px) cerca, z16 alrededor, z14 todo el valle. Cada tesela es una
## malla que sigue el relieve; los niveles gruesos van un poco más abajo para que el fino quede encima.
## Licencia: la imagen NO se versiona. Se descarga en juego y se guarda en la caché del usuario (user://imagery),
## igual que la caché del navegador en la web. La atribución de Esri se muestra en el HUD mientras esto esté activo.

const URL := "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const CACHE := "user://imagery"
const MAX_REQUESTS := 6
const LEVELS := [
	{"zoom": 18, "radius": 420.0, "segments": 16, "sink": 0.0},
	{"zoom": 16, "radius": 1800.0, "segments": 24, "sink": 0.6},
	{"zoom": 14, "radius": 10500.0, "segments": 40, "sink": 2.5},
]

var focus: Node3D

var _tiles: Array[Dictionary] = []  # por nivel: "x_y" → MeshInstance3D
var _queue: Array = []              # [nivel, tx, ty, material] pendientes de descarga
var _free_http: Array[HTTPRequest] = []
var _detail: Texture2D
## Texturas PBR de cerca (ambientCG / Poly Haven, CC0; ver web/docs/DATOS.md): pasto, tierra y pavimento.
var _pbr: Dictionary = {}
var _timer := 0.0


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(CACHE)
	for l in LEVELS:
		_tiles.push_back({})
	for i in MAX_REQUESTS:
		var http := HTTPRequest.new()
		http.timeout = 20.0
		add_child(http)
		_free_http.push_back(http)
	# Grano de detalle: ruido nativo de Godot en vez del canvas de la web (misma media 0,5)
	var noise := FastNoiseLite.new()
	noise.frequency = 0.03
	var tex := NoiseTexture2D.new()
	tex.noise = noise
	tex.seamless = true
	tex.generate_mipmaps = true
	_detail = tex
	for kind: String in ["grass", "ground", "asphalt"]:
		_pbr[kind + "_color"] = load("res://assets/textures/%s/color.jpg" % kind)
		_pbr[kind + "_normal"] = load("res://assets/textures/%s/normal.jpg" % kind)


static func lon2x(lon: float, z: int) -> float:
	return (lon + 180.0) / 360.0 * pow(2.0, z)


static func lat2y(lat: float, z: int) -> float:
	return (1.0 - asinh(tan(deg_to_rad(lat))) / PI) / 2.0 * pow(2.0, z)


static func x2lon(x: float, z: int) -> float:
	return x / pow(2.0, z) * 360.0 - 180.0


static func y2lat(y: float, z: int) -> float:
	return rad_to_deg(atan(sinh(PI * (1.0 - 2.0 * y / pow(2.0, z)))))


func _process(delta: float) -> void:
	_pump()
	_timer -= delta
	if focus == null or _timer > 0.0:
		return
	_timer = 0.5
	var geo := GeoProjection.to_geo(WorldData.origin, focus.global_position.x, focus.global_position.z)
	for li in LEVELS.size():
		_update_level(li, geo)


func _update_level(li: int, geo: Vector2) -> void:
	var l: Dictionary = LEVELS[li]
	var z: int = l.zoom
	var cx := lon2x(geo.y, z)
	var cy := lat2y(geo.x, z)
	var tile_m := 40075016.0 * cos(deg_to_rad(geo.x)) / pow(2.0, z)
	var r := ceili(l.radius / tile_m)
	var needed := {}
	for dy in range(-r, r + 1):
		for dx in range(-r, r + 1):
			var tx := floori(cx) + dx
			var ty := floori(cy) + dy
			var key := "%d_%d" % [tx, ty]
			needed[key] = true
			if not _tiles[li].has(key):
				_tiles[li][key] = _make_tile(li, tx, ty)
	for key: String in _tiles[li].keys():
		if not needed.has(key):
			_tiles[li][key].queue_free()
			_tiles[li].erase(key)


func _make_tile(li: int, tx: int, ty: int) -> MeshInstance3D:
	var l: Dictionary = LEVELS[li]
	var z: int = l.zoom
	var s: int = l.segments
	var batch := MeshBatch.new()
	for j in s + 1:
		var lat := y2lat(ty + float(j) / s, z)
		for i in s + 1:
			var lon := x2lon(tx + float(i) / s, z)
			var w := GeoProjection.to_world(WorldData.origin, lat, lon)
			batch.vertex(Vector3(w.x, WorldData.height(w.x, w.y) - l.sink, w.y), Vector3.UP, Vector2(float(i) / s, float(j) / s))
	for j in s:
		for i in s:
			var a := j * (s + 1) + i
			batch.quad(a, a + 1, a + s + 2, a + s + 1, Vector3.UP)
	var arr := batch.arrays()
	arr[Mesh.ARRAY_NORMAL] = _normals(batch, s)
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://src/world/imagery.gdshader")
	mat.set_shader_parameter("detail", _detail)
	mat.set_shader_parameter("use_detail", z >= 18)
	for k: String in _pbr:
		mat.set_shader_parameter(k, _pbr[k])
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	_queue.push_back([z, tx, ty, mat, mi])
	return mi


## Normales por vértice a partir de la rejilla (el relieve de una tesela no es plano).
func _normals(batch: MeshBatch, s: int) -> PackedVector3Array:
	var n := PackedVector3Array()
	n.resize(batch.verts.size())
	for j in s + 1:
		for i in s + 1:
			var k := j * (s + 1) + i
			var dx := batch.verts[k + (1 if i < s else 0)] - batch.verts[k - (1 if i > 0 else 0)]
			var dz := batch.verts[k + (s + 1 if j < s else 0)] - batch.verts[k - (s + 1 if j > 0 else 0)]
			var v := dz.cross(dx).normalized()
			n[k] = v if v.y > 0.0 else -v
	return n


## Atiende la cola: primero la caché en disco, si no hay, una descarga (máximo MAX_REQUESTS a la vez).
func _pump() -> void:
	while not _queue.is_empty():
		var job: Array = _queue[0]
		if not is_instance_valid(job[4]):
			_queue.pop_front()
			continue
		var path := "%s/%d_%d_%d.jpg" % [CACHE, job[0], job[1], job[2]]
		if FileAccess.file_exists(path):
			_queue.pop_front()
			_apply(job, FileAccess.get_file_as_bytes(path))
			continue
		if _free_http.is_empty():
			return
		_queue.pop_front()
		var http: HTTPRequest = _free_http.pop_back()
		http.request_completed.connect(_on_done.bind(http, job, path), CONNECT_ONE_SHOT)
		var url := URL.replace("{z}", str(job[0])).replace("{y}", str(job[2])).replace("{x}", str(job[1]))
		if http.request(url) != OK:
			_free_http.push_back(http)


func _on_done(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest, job: Array, path: String) -> void:
	_free_http.push_back(http)
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		return
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f:
		f.store_buffer(body)
	if is_instance_valid(job[4]):
		_apply(job, body)


## true cuando todas las teselas del nivel más fino (z18, alrededor del foco) ya tienen su imagen.
func near_ready() -> bool:
	if _tiles.is_empty() or _tiles[0].is_empty():
		return false
	for mi: MeshInstance3D in _tiles[0].values():
		if not (mi.material_override as ShaderMaterial).get_shader_parameter("has_imagery"):
			return false
	return true


func _apply(job: Array, bytes: PackedByteArray) -> void:
	var img := Image.new()
	if img.load_jpg_from_buffer(bytes) != OK and img.load_png_from_buffer(bytes) != OK:
		return
	img.generate_mipmaps()
	var mat: ShaderMaterial = job[3]
	mat.set_shader_parameter("imagery", ImageTexture.create_from_image(img))
	mat.set_shader_parameter("has_imagery", true)
