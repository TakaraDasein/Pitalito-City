class_name MapScreen
extends Control
## Mapa completo (tecla M), port de web/src/ui/MapScreen.js: arrastrar, zoom con la rueda, buscar lugares reales
## (OSM), clic = marcar destino, doble clic = viajar ahí. Navegable con teclado: el buscador recibe el foco al abrir,
## flechas para recorrer la lista, Enter marca el destino, Mayús+Enter viaja, Esc o M cierra.
## Mientras está abierto el juego queda en pausa (este nodo sigue procesando).

signal waypoint_requested(p: Dictionary)
signal teleport_requested(x: float, z: float)

var focus: Node3D
var gps: GPS
var is_open := false

var _zoom := 1.6  # píxeles de pantalla por píxel de mapa
var _center := Vector2.ZERO  # (x, z) del mundo en el centro de la vista
var _canvas: Control
var _search: LineEdit
var _list: ItemList
var _results: Array = []
var _drag_from := Vector2.ZERO
var _drag_center := Vector2.ZERO
var _dragging := false
var _moved := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = GuaduaTheme.get_theme()
	visible = false

	_canvas = Control.new()
	_canvas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_canvas.clip_contents = true
	_canvas.draw.connect(_draw_map)
	_canvas.gui_input.connect(_on_canvas_input)
	add_child(_canvas)

	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
	panel.offset_left = -340
	panel.offset_top = 16
	panel.offset_bottom = -16
	panel.offset_right = -16
	add_child(panel)
	var col := VBoxContainer.new()
	panel.add_child(col)
	var title := Label.new()
	title.text = "MAPA DE PITALITO"
	title.theme_type_variation = "Title"
	col.add_child(title)
	_search = LineEdit.new()
	_search.placeholder_text = "Buscar un lugar…"
	_search.clear_button_enabled = true
	_search.text_changed.connect(func(_t): _refresh_list())
	_search.text_submitted.connect(func(_t): _pick(0, Input.is_key_pressed(KEY_SHIFT)))
	_search.gui_input.connect(_on_search_input)
	col.add_child(_search)
	_list = ItemList.new()
	_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_list.item_activated.connect(func(i): _pick(i, Input.is_key_pressed(KEY_SHIFT)))
	_list.item_clicked.connect(func(i, _p, _b): _pick(i, false))
	col.add_child(_list)
	var help := Label.new()
	help.theme_type_variation = "Small"
	help.autowrap_mode = TextServer.AUTOWRAP_WORD
	help.text = "Clic: marcar destino · Doble clic o Mayús+Enter: viajar · Rueda: zoom · Arrastrar: mover · Supr: borrar destino · M / Esc: cerrar"
	col.add_child(help)


func toggle(force := -1) -> void:
	is_open = (not is_open) if force < 0 else bool(force)
	visible = is_open
	get_tree().paused = is_open
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if is_open else Input.MOUSE_MODE_CAPTURED
	if is_open:
		CityMap.ensure()
		if focus:
			_center = Vector2(focus.global_position.x, focus.global_position.z)
		_refresh_list()
		_search.grab_focus()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("map"):
		toggle()
		get_viewport().set_input_as_handled()
	elif is_open and event.is_action_pressed("ui_cancel"):
		toggle(0)
		get_viewport().set_input_as_handled()


func _on_search_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_DOWN:
				_list.grab_focus()
				if _list.item_count > 0:
					_list.select(0)
			KEY_ESCAPE:
				toggle(0)
			KEY_M when _search.text == "":
				toggle(0)
			KEY_DELETE when _search.text == "":
				gps.clear()


func _refresh_list() -> void:
	_results = CityMap.search(_search.text)
	_list.clear()
	for p: Dictionary in _results:
		_list.add_item("%s  ·  %s" % [p.n, p.k])


func _pick(i: int, travel: bool) -> void:
	if i < 0 or i >= _results.size():
		return
	var p: Dictionary = _results[i]
	_center = Vector2(p.x, p.z)
	_zoom = maxf(_zoom, 2.5)
	if travel:
		teleport_requested.emit(p.x, p.z)
		toggle(0)
	else:
		waypoint_requested.emit({"x": p.x, "z": p.z, "name": p.n})


func _screen_to_world(sp: Vector2) -> Vector2:
	var k := _zoom * CityMap.scale
	return _center + (sp - _canvas.size * 0.5) / k


func _world_to_screen(w: Vector2) -> Vector2:
	return _canvas.size * 0.5 + (w - _center) * _zoom * CityMap.scale


func _on_canvas_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.double_click:
				var w := _screen_to_world(mb.position)
				teleport_requested.emit(w.x, w.y)
				toggle(0)
			elif mb.pressed:
				_dragging = true
				_moved = false
				_drag_from = mb.position
				_drag_center = _center
			else:
				if _dragging and not _moved:
					var w := _screen_to_world(mb.position)
					waypoint_requested.emit({"x": w.x, "z": w.y})
				_dragging = false
		elif mb.pressed and mb.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			var before := _screen_to_world(mb.position)
			_zoom = clampf(_zoom * (1.18 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else 0.85), 0.25, 8.0)
			_center += before - _screen_to_world(mb.position)
	elif event is InputEventMouseMotion and _dragging:
		var d := (event as InputEventMouseMotion).position - _drag_from
		if d.length() > 4.0:
			_moved = true
		_center = _drag_center - d / (_zoom * CityMap.scale)


func _process(_delta: float) -> void:
	if is_open:
		_canvas.queue_redraw()


func _draw_map() -> void:
	_canvas.draw_rect(Rect2(Vector2.ZERO, _canvas.size), Color("#141a17"))
	if not CityMap.ensure():
		return
	var origin := _world_to_screen(CityMap.min_pos)
	var tex_size := Vector2(CityMap.texture.get_size()) * _zoom
	_canvas.draw_texture_rect(CityMap.texture, Rect2(origin, tex_size), false)
	if gps and gps.route.size() > 1:
		var pts := PackedVector2Array()
		for q in gps.route:
			pts.push_back(_world_to_screen(q))
		_canvas.draw_polyline(pts, CityMap.ROUTE, 5.0, true)
	var font := get_theme_default_font()
	for p: Dictionary in CityMap.places:
		var sp := _world_to_screen(Vector2(p.x, p.z))
		if sp.x < -50 or sp.y < -20 or sp.x > _canvas.size.x + 50 or sp.y > _canvas.size.y + 20:
			continue
		if not p.hito and _zoom < 1.4:
			continue
		_canvas.draw_circle(sp, 6.0 if p.hito else 4.0, Color("#ffd400") if p.hito else Color("#9ad1ff"))
		if p.hito or _zoom > 2.2:
			var tw := font.get_string_size(p.n, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
			_canvas.draw_rect(Rect2(sp + Vector2(8, -9), Vector2(tw + 8, 18)), Color(0, 0, 0, 0.75))
			_canvas.draw_string(font, sp + Vector2(12, 4), p.n, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)
	if gps and not gps.waypoint.is_empty():
		CityMap.draw_pin(_canvas, _world_to_screen(Vector2(gps.waypoint.x, gps.waypoint.z)))
	if focus:
		var heading := focus.global_rotation.y + (PI if focus is Vehicle else 0.0)
		CityMap.draw_arrow(_canvas, _world_to_screen(Vector2(focus.global_position.x, focus.global_position.z)), -heading, 11.0)
	# Escala
	var meters := 500.0
	var length := meters * _zoom * CityMap.scale
	var y := _canvas.size.y - 30.0
	_canvas.draw_rect(Rect2(24, y, length, 3), Color.WHITE)
	_canvas.draw_string(font, Vector2(24, y - 8), "%d m" % meters, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)
