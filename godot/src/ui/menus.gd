class_name Menus
extends CanvasLayer
## Menús en café y guadua (equivale a web/src/ui/Menus.js): principal, pausa, opciones, garaje y créditos.
## Navegables con teclado y mando (foco visible en crema; Esc o B vuelve). El mundo sigue de fondo: en el principal,
## la cámara gira sobre el Parque Principal (Main._process).

signal play_requested
signal resume_requested
signal main_menu_requested
signal vehicle_chosen(type: String)
signal map_requested
signal weather_changed(mode: int)

var current_vehicle := "willys"

var _root: Control
var _panels: Dictionary = {}       # nombre → PanelContainer
var _stack: Array[String] = []     # navegación: Esc vuelve al anterior
var _garage_list: ItemList
var _garage_info: Label
var _garage_view: SubViewport
var _garage_model: Node3D
var _garage_types: Array[String] = []
var _quality: OptionButton
var _quality_note: Label
var _dim: ColorRect
var _hero: Control


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.theme = GuaduaTheme.get_theme()
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	# velo café detrás de los menús: el mundo sigue visible, atenuado (como .screen.dim en la web)
	_dim = ColorRect.new()
	_dim.color = Color(GuaduaTheme.CAFE_DARK, 0.45)
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_dim)
	_build_main()
	_build_pause()
	_build_options()
	_build_garage()
	_build_credits()
	hide_all()


# ── Construcción ──────────────────────────────────────────────────────────────────────────────────────

func _panel(name: String, title: String, width := 380.0) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(width, 0)
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_LEFT)
	panel.position = Vector2(64, -180)
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	_root.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	panel.add_child(col)
	var t := Label.new()
	t.text = title
	t.theme_type_variation = "Title"
	col.add_child(t)
	_panels[name] = panel
	return col


func _button(parent: Container, text: String, action: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size = Vector2(0, 40)
	b.pressed.connect(action)
	parent.add_child(b)
	return b


## Portada: PITALITO en grande y centrado, el valle debajo, y los botones en un panel al centro.
func _build_main() -> void:
	_hero = VBoxContainer.new()
	_hero.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_hero.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_hero.grow_vertical = Control.GROW_DIRECTION_BOTH
	_hero.add_theme_constant_override("separation", 6)
	_root.add_child(_hero)
	var title := Label.new()
	title.text = "PITALITO"
	title.theme_type_variation = "Hero"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hero.add_child(title)
	var sub := Label.new()
	sub.text = "Valle de Laboyos · Huila"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_color_override("font_color", Color(GuaduaTheme.TEXT, 0.85))
	_hero.add_child(sub)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 22)
	_hero.add_child(spacer)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(340, 0)
	panel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_hero.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	panel.add_child(col)
	_panels["principal"] = _hero
	_button(col, "Jugar", func(): play_requested.emit())
	_button(col, "Garaje", func(): open("garaje"))
	_button(col, "Opciones", func(): open("opciones"))
	_button(col, "Créditos", func(): open("creditos"))
	if OS.get_name() != "Web":
		_button(col, "Salir", func(): get_tree().quit())
	var note := Label.new()
	note.text = "Datos reales de OpenStreetMap, Copernicus, Meta/WRI y Esri · Esc vuelve"
	note.theme_type_variation = "Small"
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hero.add_child(note)


func _build_pause() -> void:
	var col := _panel("pausa", "PAUSA")
	_button(col, "Continuar", func(): resume_requested.emit())
	_button(col, "Mapa", func(): map_requested.emit())
	_button(col, "Garaje", func(): open("garaje"))
	_button(col, "Opciones", func(): open("opciones"))
	_button(col, "Menú principal", func(): main_menu_requested.emit())


func _build_options() -> void:
	var col := _panel("opciones", "OPCIONES", 460)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 16)
	grid.add_theme_constant_override("v_separation", 10)
	col.add_child(grid)
	var l1 := Label.new()
	l1.text = "Calidad"
	grid.add_child(l1)
	_quality = OptionButton.new()
	for item in ["Automática", "Baja", "Media", "Alta"]:
		_quality.add_item(item)
	_quality.item_selected.connect(func(i):
		if i == 0:
			Settings.set_auto()
		else:
			Settings.set_quality(Settings.LEVELS[i - 1])
		_refresh_options())
	grid.add_child(_quality)
	var lw := Label.new()
	lw.text = "Clima"
	grid.add_child(lw)
	var weather := OptionButton.new()
	for item in ["Automático (aguaceros)", "Despejado", "Lluvia"]:
		weather.add_item(item)
	weather.select(Settings.weather)
	weather.item_selected.connect(func(i): Settings.weather = i; Settings.save(); weather_changed.emit(i))
	grid.add_child(weather)
	var l2 := Label.new()
	l2.text = "Sensibilidad"
	grid.add_child(l2)
	var sens := HSlider.new()
	sens.min_value = 0.3
	sens.max_value = 2.5
	sens.step = 0.05
	sens.value = Settings.sensitivity
	sens.custom_minimum_size = Vector2(200, 0)
	sens.value_changed.connect(func(v): Settings.sensitivity = v; Settings.save())
	grid.add_child(sens)
	var inv := CheckBox.new()
	inv.text = "Invertir eje vertical"
	inv.button_pressed = Settings.invert_y
	inv.toggled.connect(func(on): Settings.invert_y = on; Settings.save())
	col.add_child(inv)
	var fs := CheckBox.new()
	fs.text = "Pantalla completa"
	fs.button_pressed = Settings.fullscreen
	fs.toggled.connect(func(on): Settings.fullscreen = on; Settings.save(); Settings.apply_display())
	col.add_child(fs)
	_quality_note = Label.new()
	_quality_note.theme_type_variation = "Small"
	_quality_note.autowrap_mode = TextServer.AUTOWRAP_WORD
	_quality_note.custom_minimum_size = Vector2(420, 0)
	col.add_child(_quality_note)
	var keys := Label.new()
	keys.theme_type_variation = "Small"
	keys.text = "A pie: WASD · Shift correr · Espacio saltar o nadar a la orilla · F subir, abrir · M mapa · Esc pausa\nManejando: W/S acelerar y frenar · A/D girar · Espacio freno · F bajarse"
	col.add_child(keys)
	_button(col, "Volver", back)


func _refresh_options() -> void:
	_quality.select(0 if Settings.auto_quality else Settings.LEVELS.find(Settings.quality) + 1)
	var why := {"equipo": "elegida por tu equipo", "fps": "ajustada por los fps medidos", "manual": "elegida a mano"}
	_quality_note.text = "En uso: %s (%s). Tarjeta gráfica: %s" % [Settings.quality.capitalize(), why.get(Settings.quality_reason, ""), Settings.gpu_name]


func _build_garage() -> void:
	var col := _panel("garaje", "GARAJE", 640)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	col.add_child(row)
	_garage_list = ItemList.new()
	_garage_list.custom_minimum_size = Vector2(220, 320)
	for t: String in VehiclesConfig.VEHICLES:
		if t == "moto":
			continue # dos ruedas: necesita equilibrio propio (pendiente); el tráfico sí la usa
		_garage_types.push_back(t)
		_garage_list.add_item(VehiclesConfig.VEHICLES[t].name)
	_garage_list.item_selected.connect(_garage_show)
	_garage_list.item_activated.connect(func(i): _garage_choose(i))
	row.add_child(_garage_list)
	var right := VBoxContainer.new()
	row.add_child(right)
	var frame := SubViewportContainer.new()
	frame.custom_minimum_size = Vector2(360, 220)
	frame.stretch = true
	right.add_child(frame)
	_garage_view = SubViewport.new()
	_garage_view.own_world_3d = true
	_garage_view.transparent_bg = true
	frame.add_child(_garage_view)
	var cam := Camera3D.new()
	cam.position = Vector3(0, 1.6, 5.2)
	cam.rotation.x = -0.2
	cam.fov = 40
	_garage_view.add_child(cam)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.9, 0.6, 0)
	_garage_view.add_child(sun)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(1, 0.95, 0.88)
	env.environment.ambient_light_energy = 0.7
	_garage_view.add_child(env)
	_garage_info = Label.new()
	_garage_info.autowrap_mode = TextServer.AUTOWRAP_WORD
	_garage_info.custom_minimum_size = Vector2(360, 0)
	right.add_child(_garage_info)
	_button(right, "Usar este vehículo", func(): _garage_choose(_garage_list.get_selected_items()[0] if _garage_list.is_anything_selected() else 0))
	_button(col, "Volver", back)


func _garage_show(i: int) -> void:
	var t := _garage_types[i]
	var spec := VehiclesConfig.spec(t)
	if _garage_model:
		_garage_model.queue_free()
	var m := VehicleModel.create(spec, false)
	if not m.is_empty():
		_garage_model = m.visual
		# centrado: el modelo mira a +Z; la vista lo muestra de tres cuartos
		# todos del mismo tamaño en pantalla (la chiva de 8,5 m y el motocarro de 2,6 m)
		_garage_model.scale = Vector3.ONE * (4.6 / maxf(float(spec.length), 2.0))
		_garage_view.add_child(_garage_model)
	_garage_info.text = "%s\nLargo %.1f m · ancho %.1f m · %d kg · hasta %d km/h%s" % [spec.name, spec.length, spec.width, int(spec.mass), int(spec.max_speed),
		"\n(en uso)" if t == current_vehicle else ""]


func _garage_choose(i: int) -> void:
	current_vehicle = _garage_types[i]
	vehicle_chosen.emit(current_vehicle)
	_garage_show(i)


func _build_credits() -> void:
	var col := _panel("creditos", "CRÉDITOS", 560)
	var text := Label.new()
	text.autowrap_mode = TextServer.AUTOWRAP_WORD
	text.custom_minimum_size = Vector2(520, 0)
	var lines := ["Datos del mundo"]
	for a: String in WorldData.manifest.get("attribution", []):
		lines.push_back("  · " + a)
	lines += ["  · Edificios: Overture Maps (ODbL) y Google Open Buildings (CC BY 4.0)", "",
		"Modelos 3D (CC0, dominio público)",
		"  · Personajes y animaciones: Quaternius",
		"  · Vehículos del tráfico, piezas de edificios y muebles: Kenney (Car Kit, Building Kit, Furniture Kit)",
		"  · Vehículos típicos, hitos y texturas propias: hechos para el proyecto", "",
		"Texturas: ambientCG y Poly Haven (CC0)",
		"Motor: Godot Engine 4.7 (MIT) · física: Jolt (MIT)", "",
		"Los grupos armados del juego son ficción: no representan a ningún grupo real."]
	text.text = "\n".join(lines)
	text.theme_type_variation = "Small"
	col.add_child(text)
	_button(col, "Volver", back)


# ── Navegación ────────────────────────────────────────────────────────────────────────────────────────

func open(name: String, reset := false) -> void:
	if reset:
		_stack.clear()
	for p: Control in _panels.values():
		p.visible = false
	_panels[name].visible = true
	_dim.visible = true
	if _stack.is_empty() or _stack[-1] != name:
		_stack.push_back(name)
	if name == "opciones":
		_refresh_options()
	if name == "garaje":
		var i := _garage_types.find(current_vehicle)
		_garage_list.select(maxi(i, 0))
		_garage_show(maxi(i, 0))
	_focus_first(_panels[name])


func back() -> void:
	if _stack.size() <= 1:
		if not _stack.is_empty() and _stack[0] == "pausa":
			resume_requested.emit()
		return
	_stack.pop_back()
	open(_stack[-1])


func hide_all() -> void:
	_dim.visible = false
	for p: Control in _panels.values():
		p.visible = false
	_stack.clear()


func is_open() -> bool:
	return not _stack.is_empty()


func _focus_first(node: Node) -> void:
	for c: Node in node.find_children("*", "Control", true, false):
		if (c is Button or c is ItemList) and (c as Control).is_visible_in_tree():
			(c as Control).grab_focus()
			return


func _unhandled_input(event: InputEvent) -> void:
	if is_open() and event.is_action_pressed("ui_cancel"):
		back()
		get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	if _garage_model and _panels.garaje.visible:
		_garage_model.rotate_y(delta * 0.5)
