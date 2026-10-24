class_name Minimap
extends Control
## Minimapa circular con aro de guadua (port del de web/src/ui/HUD.js). Gira con la cámara: arriba es hacia
## donde se mira. El círculo es un Panel con clip_children (recorte nativo de Godot, en vez de la máscara CSS).

const SIZE := 220.0
const METERS := 260.0 # diámetro visible

var focus: Node3D
var camera_rig: CameraRig
var gps: GPS

var _map: Control


func _ready() -> void:
	custom_minimum_size = Vector2(SIZE, SIZE) + Vector2(24, 24)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var clip := Panel.new()
	var round := StyleBoxFlat.new()
	round.bg_color = Color("#141a17")
	round.set_corner_radius_all(int(SIZE / 2))
	clip.add_theme_stylebox_override("panel", round)
	clip.clip_children = CanvasItem.CLIP_CHILDREN_ONLY
	clip.position = Vector2(12, 12)
	clip.size = Vector2(SIZE, SIZE)
	clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(clip)
	_map = Control.new()
	_map.size = clip.size
	_map.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_map.draw.connect(_draw_map)
	clip.add_child(_map)


func _process(_delta: float) -> void:
	_map.queue_redraw()
	queue_redraw()


## Aro de guadua: culmo café con nudos claros, como culmRing de la web.
func _draw() -> void:
	var c := Vector2(SIZE, SIZE) * 0.5 + Vector2(12, 12)
	var r := SIZE * 0.5 + 5.0
	draw_arc(c, r, 0.0, TAU, 96, GuaduaTheme.CAFE_MID, 12.0, true)
	draw_arc(c, r + 4.0, 0.0, TAU, 96, GuaduaTheme.CAFE_DARK, 2.0, true)
	draw_arc(c, r - 4.0, 0.0, TAU, 96, Color(GuaduaTheme.CREMA, 0.35), 1.5, true)
	for i in 9:
		var a := TAU * i / 9.0 + 0.2
		var d := Vector2(cos(a), sin(a))
		draw_line(c + d * (r - 6.0), c + d * (r + 6.0), GuaduaTheme.CREMA, 3.0, true)
	# Norte: una N sobre el aro, girando con la cámara
	var yaw := camera_rig.yaw if camera_rig else 0.0
	var north := c + Vector2(sin(yaw), -cos(yaw)) * r
	draw_circle(north, 9.0, GuaduaTheme.CAFE_DARK)
	draw_string(get_theme_default_font(), north + Vector2(-4.5, 5), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, GuaduaTheme.CREMA)


func _draw_map() -> void:
	if focus == null or not CityMap.ensure():
		return
	var p := focus.global_position
	var yaw := camera_rig.yaw if camera_rig else 0.0
	var k := SIZE / METERS / CityMap.scale # píxeles de pantalla por píxel de mapa
	var center := Vector2(SIZE, SIZE) * 0.5
	# El mapa gira para que la dirección de la cámara quede arriba (−Z del mundo = arriba del mapa)
	var xf := Transform2D(yaw, center) * Transform2D(0.0, Vector2(k, k), 0.0, -CityMap.to_map(p.x, p.z) * k)
	_map.draw_set_transform_matrix(xf)
	_map.draw_texture(CityMap.texture, Vector2.ZERO)
	if gps and gps.route.size() > 1:
		var pts := PackedVector2Array()
		for q in gps.route:
			pts.push_back(CityMap.to_map(q.x, q.y))
		_map.draw_polyline(pts, CityMap.ROUTE, 5.0 / k, true)
	_map.draw_set_transform_matrix(Transform2D.IDENTITY)
	if gps and not gps.waypoint.is_empty():
		var wp := xf * CityMap.to_map(gps.waypoint.x, gps.waypoint.z)
		wp = center + (wp - center).limit_length(SIZE * 0.5 - 10.0) # en el borde si está lejos
		CityMap.draw_pin(_map, wp)
	# Flecha: rumbo del foco relativo a la cámara
	var heading := focus.global_rotation.y
	if focus is Vehicle:
		heading += PI # el carro avanza por +Z
	CityMap.draw_arrow(_map, center, yaw - heading, 9.0)
