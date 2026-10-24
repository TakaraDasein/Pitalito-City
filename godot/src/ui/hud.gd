class_name HUD
extends CanvasLayer
## Interfaz en juego: ubicación real (lat/lon), velocidad, ayuda de controles y atribución de los datos,
## que debe verse siempre en pantalla (web/docs/REGLAS.md).

var focus: Node3D
var sky: SkySystem
var gps: GPS
var minimap: Minimap
var _place: Label
var _street: Label
var _info: Label
var _hint: Label
var _gps: Label
var _toast: Label
var _toast_timer := 0.0


func _ready() -> void:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = GuaduaTheme.get_theme()
	add_child(root)

	var top := PanelContainer.new()
	top.position = Vector2(16, 16)
	root.add_child(top)
	var col := VBoxContainer.new()
	top.add_child(col)
	var title := Label.new()
	title.text = "PITALITO · HUILA"
	title.theme_type_variation = "Title"
	col.add_child(title)
	# Nombre real de la calle (OSM), en la placa verde de la nomenclatura de Pitalito
	_street = Label.new()
	var plate := StyleBoxFlat.new()
	plate.bg_color = GuaduaTheme.GREEN
	plate.set_corner_radius_all(3)
	plate.set_content_margin_all(4)
	plate.border_color = Color.WHITE
	plate.set_border_width_all(1)
	_street.add_theme_stylebox_override("normal", plate)
	_street.add_theme_color_override("font_color", Color.WHITE)
	col.add_child(_street)
	_place = Label.new()
	col.add_child(_place)
	_info = Label.new()
	_info.theme_type_variation = "Small"
	col.add_child(_info)
	_gps = Label.new()
	_gps.add_theme_color_override("font_color", CityMap.ROUTE.lightened(0.35))
	_gps.visible = false
	col.add_child(_gps)

	minimap = Minimap.new()
	minimap.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	minimap.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	minimap.position += Vector2(-16, 16)
	root.add_child(minimap)

	var toast_box := PanelContainer.new()
	toast_box.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	toast_box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	toast_box.position.y = 24
	toast_box.visible = false
	root.add_child(toast_box)
	_toast = Label.new()
	toast_box.add_child(_toast)

	var bottom := PanelContainer.new()
	bottom.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	bottom.position += Vector2(16, -16)
	bottom.grow_vertical = Control.GROW_DIRECTION_BEGIN
	root.add_child(bottom)
	_hint = Label.new()
	_hint.theme_type_variation = "Small"
	bottom.add_child(_hint)

	var credits := Label.new()
	credits.theme_type_variation = "Small"
	credits.text = " · ".join(_attribution())
	credits.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	credits.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	credits.grow_vertical = Control.GROW_DIRECTION_BEGIN
	credits.position += Vector2(-12, -8)
	root.add_child(credits)
	set_on_foot(true)


## Fuentes de lo que se ve, incluida la de Esri por el suelo satelital (ImageryGround).
func _attribution() -> Array:
	var out: Array = WorldData.manifest.get("attribution", []).duplicate()
	out.push_back("Modelos: Quaternius, Kenney (CC0)")
	return out


func set_on_foot(on_foot: bool) -> void:
	if on_foot:
		_hint.text = "WASD moverse · Shift correr · Espacio saltar · F subir / abrir · M mapa · Esc soltar el ratón"
	else:
		_hint.text = "W/S acelerar y frenar · A/D girar · Espacio freno · F bajarse · M mapa"


## Aviso breve arriba al centro (destino marcado, llegada…).
func toast(text: String, seconds := 4.0) -> void:
	_toast.text = text
	_toast.get_parent().visible = true
	_toast_timer = seconds


func _process(delta: float) -> void:
	if _toast_timer > 0.0:
		_toast_timer -= delta
		if _toast_timer <= 0.0:
			_toast.get_parent().visible = false
	if focus == null:
		return
	minimap.focus = focus
	minimap.gps = gps
	var d := gps.remaining() if gps else -1.0
	_gps.visible = d >= 0.0
	if d >= 0.0:
		_gps.text = "GPS · " + ("%.1f km" % (d / 1000.0) if d > 1000.0 else "%d m" % int(d))
	var p := focus.global_position
	var geo := GeoProjection.to_geo(WorldData.origin, p.x, p.z)
	var street := WorldData.roads.street_at(Vector2(p.x, p.z)) if WorldData.roads else {}
	_street.text = street.get("name", "") if not street.is_empty() else ""
	_street.visible = _street.text != ""
	_place.text = "%.5f° N, %.5f° O · %d m s. n. m." % [geo.x, -geo.y, int(p.y + WorldData.manifest.terrain.get("baseElevation", 0))]
	var extra := ""
	if focus is Vehicle:
		extra = " · %d km/h" % int(focus.speed_kmh())
	var clock := (sky.clock() + " · ") if sky else ""
	_info.text = "%stile %s · %d fps%s" % [clock, str(WorldData.tile_key(p.x, p.z)), Engine.get_frames_per_second(), extra]
