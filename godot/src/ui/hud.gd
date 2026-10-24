class_name HUD
extends CanvasLayer
## Interfaz en juego, al nivel de la web (HUD.js e index.html):
##  · placa de calle con el diseño oficial de Pitalito (azul: PITALITO y el barrio; verde: la calle) y aviso al
##    entrar a otro barrio
##  · minimapa con aro de guadua, velocímetro de culmo (manejando)
##  · barra de controles: reloj, vehículo, GPS, clima y atajos (N hora, C cámara, M mapa, Esc pausa, H ayuda)
##  · aviso de interacción ("F · Subir al Jeep Willys"), ficha de información (E), avisos breves y ayuda
##  · atribución de los datos, siempre visible (web/docs/REGLAS.md)

const BLUE := Color("#005b8c")    # placas de nomenclatura de Pitalito
const ZONE_BANNER_TIME := 3.0

var focus: Node3D
var sky: SkySystem
var gps: GPS
var minimap: Minimap
var vehicle_name := ""

var _root: Control
var _zone_lbl: Label
var _street_lbl: Label
var _banner: Label
var _banner_t := 0.0
var _zone := ""
var _street_t := 0.0
var _clock: Label
var _vehicle_lbl: Label
var _gps_lbl: Label
var _weather_lbl: Label
var _speed: Speedometer
var _prompt: PanelContainer
var _prompt_key: Label
var _prompt_text: Label
var _toast: PanelContainer
var _toast_lbl: Label
var _toast_t := 0.0
var _info: PanelContainer
var _info_title: Label
var _info_body: Label
var _info_t := 0.0
var _help: PanelContainer
var _debug: Label


func _ready() -> void:
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.theme = GuaduaTheme.get_theme()
	add_child(_root)
	_build_plate()
	_build_bar()
	_build_widgets()
	_build_help()


# ── Construcción ──────────────────────────────────────────────────────────────────────────────────────

static func _flat(color: Color, radius := 4, margin := 6) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(margin)
	return sb


## Placa oficial: rectángulo azul con PITALITO y el barrio, unido al verde con el nombre de la calle; borde blanco.
func _build_plate() -> void:
	var plate := HBoxContainer.new()
	plate.position = Vector2(16, 16)
	plate.add_theme_constant_override("separation", 0)
	_root.add_child(plate)
	var blue := PanelContainer.new()
	var bs := _flat(BLUE, 4, 8)
	bs.border_color = Color.WHITE
	bs.set_border_width_all(2)
	bs.corner_radius_top_right = 0
	bs.corner_radius_bottom_right = 0
	blue.add_theme_stylebox_override("panel", bs)
	plate.add_child(blue)
	var bcol := VBoxContainer.new()
	bcol.add_theme_constant_override("separation", -2)
	blue.add_child(bcol)
	var city := Label.new()
	city.text = "PITALITO"
	city.add_theme_font_size_override("font_size", 16)
	city.add_theme_color_override("font_color", Color.WHITE)
	bcol.add_child(city)
	_zone_lbl = Label.new()
	_zone_lbl.add_theme_font_size_override("font_size", 14)
	_zone_lbl.add_theme_color_override("font_color", Color(1, 1, 1, 0.85))
	bcol.add_child(_zone_lbl)
	var green := PanelContainer.new()
	var gs := _flat(GuaduaTheme.GREEN, 4, 8)
	gs.border_color = Color.WHITE
	gs.set_border_width_all(2)
	gs.border_width_left = 0
	gs.corner_radius_top_left = 0
	gs.corner_radius_bottom_left = 0
	green.add_theme_stylebox_override("panel", gs)
	green.custom_minimum_size = Vector2(220, 0)
	plate.add_child(green)
	_street_lbl = Label.new()
	_street_lbl.add_theme_font_size_override("font_size", 26)
	_street_lbl.add_theme_color_override("font_color", Color.WHITE)
	_street_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	green.add_child(_street_lbl)
	# aviso grande al entrar a otro barrio
	_banner = Label.new()
	_banner.add_theme_font_size_override("font_size", 30)
	_banner.add_theme_color_override("font_color", GuaduaTheme.CREMA)
	_banner.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	_banner.add_theme_constant_override("shadow_offset_y", 2)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_banner.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_banner.position.y = 90
	_banner.modulate.a = 0.0
	_root.add_child(_banner)
	_debug = Label.new()
	_debug.theme_type_variation = "Small"
	_debug.position = Vector2(18, 74)
	_debug.visible = false
	_root.add_child(_debug)


## Barra de controles abajo a la izquierda: reloj · vehículo · GPS · clima | atajos.
func _build_bar() -> void:
	var bar := PanelContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bar.position += Vector2(16, -34)
	_root.add_child(bar)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	bar.add_child(row)
	_clock = Label.new()
	_clock.add_theme_font_size_override("font_size", 22)
	_clock.add_theme_color_override("font_color", GuaduaTheme.CREMA)
	row.add_child(_clock)
	_vehicle_lbl = _chip(row)
	_gps_lbl = Label.new()
	_gps_lbl.add_theme_color_override("font_color", CityMap.ROUTE.lightened(0.35))
	_gps_lbl.visible = false
	row.add_child(_gps_lbl)
	_weather_lbl = _chip(row)
	row.add_child(VSeparator.new())
	for k: Array in [["N", "+3 h"], ["C", "cámara"], ["M", "mapa"], ["V", "garaje"], ["H", "ayuda"], ["Esc", "pausa"]]:
		_keycap(row, k[0], k[1])


func _chip(parent: Container) -> Label:
	var l := Label.new()
	var sb := _flat(Color(GuaduaTheme.CAFE, 0.9), 10, 6)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.border_color = GuaduaTheme.CAFE_MID
	sb.set_border_width_all(1)
	l.add_theme_stylebox_override("normal", sb)
	l.add_theme_font_size_override("font_size", 15)
	parent.add_child(l)
	return l


## Tecla dibujada como tecla (crema sobre café) con su acción al lado.
func _keycap(parent: Container, key: String, what: String) -> void:
	var box := HBoxContainer.new()
	box.add_theme_constant_override("separation", 4)
	parent.add_child(box)
	var k := Label.new()
	k.text = key
	var sb := _flat(GuaduaTheme.CREMA, 3, 3)
	sb.content_margin_left = 6
	sb.content_margin_right = 6
	k.add_theme_stylebox_override("normal", sb)
	k.add_theme_color_override("font_color", GuaduaTheme.CAFE_DARK)
	k.add_theme_font_size_override("font_size", 13)
	box.add_child(k)
	var w := Label.new()
	w.text = what
	w.theme_type_variation = "Small"
	box.add_child(w)


func _build_widgets() -> void:
	minimap = Minimap.new()
	minimap.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	minimap.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	minimap.position += Vector2(-16, 16)
	_root.add_child(minimap)
	_speed = Speedometer.new()
	_speed.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	_speed.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_speed.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_speed.position += Vector2(-20, -40)
	_speed.visible = false
	_root.add_child(_speed)
	# aviso de interacción: píldora café al centro, un poco abajo
	_prompt = _pill(Vector2(0, -150))
	var prow := HBoxContainer.new()
	prow.add_theme_constant_override("separation", 8)
	_prompt.add_child(prow)
	_prompt_key = Label.new()
	var ksb := _flat(GuaduaTheme.CREMA, 3, 3)
	ksb.content_margin_left = 7
	ksb.content_margin_right = 7
	_prompt_key.add_theme_stylebox_override("normal", ksb)
	_prompt_key.add_theme_color_override("font_color", GuaduaTheme.CAFE_DARK)
	prow.add_child(_prompt_key)
	_prompt_text = Label.new()
	prow.add_child(_prompt_text)
	_toast = _pill(Vector2(0, -205))
	_toast_lbl = Label.new()
	_toast.add_child(_toast_lbl)
	# ficha de información (E) a la derecha, bajo el minimapa
	_info = PanelContainer.new()
	_info.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_info.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_info.position += Vector2(-16, 280)
	_info.custom_minimum_size = Vector2(300, 0)
	_info.visible = false
	_root.add_child(_info)
	var icol := VBoxContainer.new()
	_info.add_child(icol)
	_info_title = Label.new()
	_info_title.theme_type_variation = "Title"
	_info_title.autowrap_mode = TextServer.AUTOWRAP_WORD
	icol.add_child(_info_title)
	_info_body = Label.new()
	_info_body.autowrap_mode = TextServer.AUTOWRAP_WORD
	icol.add_child(_info_body)
	var foot := Label.new()
	foot.theme_type_variation = "Small"
	foot.text = "Datos: OpenStreetMap · Overture · Google Open Buildings"
	icol.add_child(foot)
	# atribución
	var credits := Label.new()
	credits.theme_type_variation = "Small"
	credits.text = " · ".join(_attribution())
	credits.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	credits.grow_vertical = Control.GROW_DIRECTION_BEGIN
	credits.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	credits.position.y -= 6
	_root.add_child(credits)


func _pill(offset: Vector2) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := _flat(Color(GuaduaTheme.CAFE_DARK, 0.88), 16, 8)
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.border_color = GuaduaTheme.CAFE_MID
	sb.set_border_width_all(1)
	p.add_theme_stylebox_override("panel", sb)
	p.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	p.grow_horizontal = Control.GROW_DIRECTION_BOTH
	p.grow_vertical = Control.GROW_DIRECTION_BEGIN
	p.position += offset
	p.visible = false
	_root.add_child(p)
	return p


func _build_help() -> void:
	_help = PanelContainer.new()
	_help.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_help.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_help.grow_vertical = Control.GROW_DIRECTION_BOTH
	_help.visible = false
	_root.add_child(_help)
	var col := VBoxContainer.new()
	_help.add_child(col)
	var t := Label.new()
	t.text = "CONTROLES"
	t.theme_type_variation = "Title"
	col.add_child(t)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 18)
	col.add_child(grid)
	for row: Array in [
		["W / S", "A pie: caminar · manejando: acelerar, frenar y reversa"], ["A / D", "A pie: de lado · manejando: girar"],
		["Shift", "Correr"], ["Espacio", "Saltar, salir del agua · manejando: freno"],
		["F", "Subir o bajar del vehículo, abrir y cerrar puertas"], ["E", "Información del edificio o lugar al frente"],
		["M", "Mapa: clic = destino GPS, doble clic = viajar"], ["C", "Cámara: cerca, lejos, aérea"],
		["N", "Adelantar 3 horas"], ["V", "Garaje"], ["H", "Esta ayuda"], ["F3", "Datos técnicos"], ["Esc", "Pausa, opciones"]]:
		var k := Label.new()
		k.text = row[0]
		k.add_theme_color_override("font_color", GuaduaTheme.CREMA)
		grid.add_child(k)
		var d := Label.new()
		d.text = row[1]
		grid.add_child(d)


## Fuentes de lo que se ve, incluida la de Esri por el suelo satelital (ImageryGround).
func _attribution() -> Array:
	var out: Array = WorldData.manifest.get("attribution", []).duplicate()
	out.push_back("Modelos: Quaternius, Kenney (CC0)")
	return out


# ── API ───────────────────────────────────────────────────────────────────────────────────────────────

func set_on_foot(on_foot: bool) -> void:
	_speed.visible = not on_foot


func set_vehicle(name: String, max_kmh: float) -> void:
	vehicle_name = name
	_vehicle_lbl.text = name
	_speed.max_kmh = max_kmh


## Aviso de interacción ("F" · "Subir al Jeep Willys"); key vacío lo esconde.
func set_prompt(key: String, text: String) -> void:
	_prompt.visible = key != ""
	if key != "":
		_prompt_key.text = key
		_prompt_text.text = text


## Aviso breve (destino marcado, llegada, calidad ajustada…).
func toast(text: String, seconds := 3.5) -> void:
	_toast_lbl.text = text
	_toast.visible = true
	_toast_t = seconds


## Ficha de información (E): título y líneas.
func info(title: String, lines: Array, seconds := 8.0) -> void:
	_info_title.text = title
	_info_body.text = "\n".join(lines)
	_info.visible = true
	_info_t = seconds


func toggle_help() -> void:
	_help.visible = not _help.visible


func toggle_debug() -> void:
	_debug.visible = not _debug.visible


func _process(delta: float) -> void:
	_toast_t -= delta
	_toast.visible = _toast.visible and _toast_t > 0.0
	_info_t -= delta
	_info.visible = _info.visible and _info_t > 0.0
	_banner_t -= delta
	_banner.modulate.a = clampf(minf(_banner_t, ZONE_BANNER_TIME - _banner_t) * 2.0, 0.0, 1.0)
	if focus == null:
		return
	minimap.focus = focus
	minimap.gps = gps
	if sky:
		_clock.text = sky.clock()
		_weather_lbl.text = ["Clima: automático", "Despejado", "Lluvia"][sky.mode] + (" · lloviendo" if sky.mode == SkySystem.Weather.AUTO and sky.wet > 0.5 else "")
	var p := focus.global_position
	_street_t -= delta
	if _street_t <= 0.0:
		_street_t = 0.25
		var st: Dictionary = WorldData.roads.street_at(Vector2(p.x, p.z)) if WorldData.roads else {}
		_street_lbl.text = (st.name if st.get("name", "") != "" else "Vía sin nombre") if not st.is_empty() else "Fuera de vía"
		var zone := WorldData.zone_at(p.x, p.z)
		_zone_lbl.text = zone
		if zone != _zone:
			if _zone != "":
				_banner.text = zone
				_banner_t = ZONE_BANNER_TIME
			_zone = zone
	var d := gps.remaining() if gps else -1.0
	_gps_lbl.visible = d >= 0.0
	if d >= 0.0:
		_gps_lbl.text = "GPS · " + ("%.1f km" % (d / 1000.0) if d > 1000.0 else "%d m" % int(d))
	if focus is Vehicle:
		_speed.kmh = (focus as Vehicle).speed_kmh()
	if _debug.visible:
		var geo := GeoProjection.to_geo(WorldData.origin, p.x, p.z)
		_debug.text = "%.5f° N, %.5f° O · %d m s. n. m. · tile %s · %d fps · calidad %s" % [geo.x, -geo.y,
			int(p.y + WorldData.manifest.terrain.get("baseElevation", 0)), str(WorldData.tile_key(p.x, p.z)),
			Engine.get_frames_per_second(), Settings.quality]
