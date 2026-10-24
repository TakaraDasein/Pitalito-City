class_name Menus
extends CanvasLayer
## Menús en café y guadua (equivale a web/src/ui/Menus.js, y más): portada, pausa, opciones por secciones,
## garaje de pantalla completa (vista previa grande, fichas de desempeño, pintura y placa) y créditos.
## Teclado, ratón y mando: foco visible, realce al enfocar, Esc o B vuelve, y abajo una línea con los controles
## del dispositivo en uso. Las pantallas entran con fundido y desplazamiento (UiFx).

signal play_requested
signal resume_requested
signal main_menu_requested
signal vehicle_chosen(type: String)
signal map_requested
signal weather_changed(mode: int)
signal look_changed

var current_vehicle := "willys"

var _root: Control
var _dim: ColorRect
var _panels: Dictionary = {}       # nombre → Control
var _stack: Array[String] = []
var _hints: Label
# garaje
var _garage_list: VBoxContainer
var _garage_types: Array[String] = []
var _garage_sel := 0
var _garage_view: SubViewport
var _garage_model: Node3D
var _garage_name: Label
var _garage_desc: Label
var _garage_stats: VBoxContainer
var _garage_paints: HFlowContainer
var _garage_plate: LineEdit
var _garage_use: Button
var _cam_pivot: Node3D
var _drag := false
# personaje
var _char_view: SubViewport
var _char_model: Node3D
var _char_form: VBoxContainer
var _char_origin: Label
# opciones
var _quality: OptionButton
var _quality_note: Label

const DESCRIPTIONS := {
	"willys": "El campero de las veredas del Huila. Aguanta todo, no corre tanto.",
	"taxi": "Hatchback amarillo de servicio público. Ágil en las calles del centro.",
	"pickup": "Platón para el café y el mercado. Fuerte y estable.",
	"chiva": "El bus escalera de colores. Lento, pesado y el alma del Valle de Laboyos.",
	"motocarro": "Tres ruedas para el reparto del barrio. Corto y cabe en todas partes.",
	"moto": "La que más se ve en Pitalito. Ligera, rápida y se mete por todo.",
	"sedan": "Automóvil particular.", "suv": "Campero moderno.", "van": "Van del transporte intermunicipal.",
	"truck": "Camioneta.", "delivery": "Furgón de carga.", "garbage-truck": "Recolector de basura del municipio.",
	"ambulance": "Ambulancia.",
}


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	current_vehicle = Settings.vehicle
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.theme = GuaduaTheme.get_theme()
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	# velo: degradado café de izquierda a derecha (el texto se lee, el mundo se ve)
	_dim = ColorRect.new()
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = "shader_type canvas_item; uniform vec4 c : source_color; void fragment(){ COLOR = vec4(c.rgb, c.a * mix(0.92, 0.25, smoothstep(0.0, 0.75, UV.x))); }"
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("c", GuaduaTheme.CAFE_DARK)
	_dim.material = mat
	_root.add_child(_dim)
	_build_main()
	_build_pause()
	_build_options()
	_build_garage()
	_build_character()
	_build_credits()
	_hints = Label.new()
	_hints.theme_type_variation = "Small"
	_hints.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	_hints.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_hints.position += Vector2(64, -28)
	_root.add_child(_hints)
	UiFx.device_changed.connect(func(_g): _update_hints())
	hide_all()


# ── Piezas comunes ────────────────────────────────────────────────────────────────────────────────────

## Columna a la izquierda: rótulo pequeño en mayúsculas, título grande y el contenido.
func _screen(name: String, kicker: String, title: String, width := 400.0) -> VBoxContainer:
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER_LEFT)
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.position.x = 64
	box.custom_minimum_size = Vector2(width, 0)
	box.add_theme_constant_override("separation", 10)
	_root.add_child(box)
	var k := Label.new()
	k.text = kicker.to_upper()
	k.theme_type_variation = "Caps"
	box.add_child(k)
	var t := Label.new()
	t.text = title
	t.theme_type_variation = "Display"
	box.add_child(t)
	var line := HSeparator.new()
	line.custom_minimum_size = Vector2(width, 6)
	box.add_child(line)
	_panels[name] = box
	return box


func _button(parent: Container, text: String, action: Callable, hint := "") -> Button:
	var b := Button.new()
	b.text = text
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size = Vector2(0, 44)
	b.pressed.connect(action)
	b.tooltip_text = hint
	parent.add_child(b)
	UiFx.wire_button(b)
	b.focus_entered.connect(func(): if AudioSystem.instance: AudioSystem.instance.ui_click())
	b.pressed.connect(func(): if AudioSystem.instance: AudioSystem.instance.ui_click(true))
	return b


func _section(parent: Container, text: String) -> void:
	var l := Label.new()
	l.text = text.to_upper()
	l.theme_type_variation = "Caps"
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 6)
	parent.add_child(spacer)
	parent.add_child(l)


func _row(parent: Container, label: String, control: Control) -> void:
	var r := HBoxContainer.new()
	r.add_theme_constant_override("separation", 14)
	var l := Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(150, 0)
	r.add_child(l)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	r.add_child(control)
	parent.add_child(r)


# ── Portada ───────────────────────────────────────────────────────────────────────────────────────────

func _build_main() -> void:
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER_LEFT)
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.position.x = 64
	box.add_theme_constant_override("separation", 4)
	_root.add_child(box)
	var kicker := Label.new()
	kicker.text = "VALLE DE LABOYOS · HUILA · COLOMBIA"
	kicker.theme_type_variation = "Caps"
	box.add_child(kicker)
	var title := Label.new()
	title.text = "PITALITO"
	title.theme_type_variation = "Hero"
	box.add_child(title)
	var sub := Label.new()
	sub.text = "El municipio reconstruido con datos reales, calle por calle."
	sub.add_theme_color_override("font_color", Color(GuaduaTheme.TEXT, 0.85))
	box.add_child(sub)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 26)
	box.add_child(spacer)
	var col := VBoxContainer.new()
	col.custom_minimum_size = Vector2(320, 0)
	col.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	col.add_theme_constant_override("separation", 8)
	box.add_child(col)
	_button(col, "Jugar", func(): play_requested.emit())
	_button(col, "Personaje", func(): open("personaje"))
	_button(col, "Garaje", func(): open("garaje"))
	_button(col, "Opciones", func(): open("opciones"))
	_button(col, "Créditos", func(): open("creditos"))
	if OS.get_name() != "Web":
		_button(col, "Salir", func(): get_tree().quit())
	_panels["principal"] = box


func _build_pause() -> void:
	var col := _screen("pausa", "Juego en pausa", "Pausa")
	_button(col, "Continuar", func(): resume_requested.emit())
	_button(col, "Mapa", func(): map_requested.emit())
	_button(col, "Personaje", func(): open("personaje"))
	_button(col, "Garaje", func(): open("garaje"))
	_button(col, "Opciones", func(): open("opciones"))
	_button(col, "Menú principal", func(): main_menu_requested.emit())


# ── Opciones ──────────────────────────────────────────────────────────────────────────────────────────

func _build_options() -> void:
	var col := _screen("opciones", "Ajustes", "Opciones", 520)
	_section(col, "Gráficos")
	_quality = OptionButton.new()
	for item in ["Automática", "Baja", "Media", "Alta"]:
		_quality.add_item(item)
	_quality.item_selected.connect(func(i):
		if i == 0:
			Settings.set_auto()
		else:
			Settings.set_quality(Settings.LEVELS[i - 1])
		_refresh_options())
	_row(col, "Calidad", _quality)
	_quality_note = Label.new()
	_quality_note.theme_type_variation = "Small"
	_quality_note.autowrap_mode = TextServer.AUTOWRAP_WORD
	_quality_note.custom_minimum_size = Vector2(500, 0)
	col.add_child(_quality_note)
	_section(col, "Pantalla")
	var fs := CheckButton.new()
	fs.text = "Pantalla completa"
	fs.button_pressed = Settings.fullscreen
	fs.toggled.connect(func(on): Settings.fullscreen = on; Settings.save(); Settings.apply_display())
	col.add_child(fs)
	var scale := HSlider.new()
	scale.min_value = 0.8
	scale.max_value = 1.4
	scale.step = 0.05
	scale.value = Settings.ui_scale
	scale.drag_ended.connect(func(_c): Settings.ui_scale = scale.value; Settings.save(); Settings.apply_display())
	_row(col, "Tamaño de la interfaz", scale)
	_section(col, "Controles")
	var sens := HSlider.new()
	sens.min_value = 0.3
	sens.max_value = 2.5
	sens.step = 0.05
	sens.value = Settings.sensitivity
	sens.value_changed.connect(func(v): Settings.sensitivity = v; Settings.save())
	_row(col, "Sensibilidad", sens)
	var inv := CheckButton.new()
	inv.text = "Invertir el eje vertical de la cámara"
	inv.button_pressed = Settings.invert_y
	inv.toggled.connect(func(on): Settings.invert_y = on; Settings.save())
	col.add_child(inv)
	_section(col, "Sonido")
	var vol := HSlider.new()
	vol.max_value = 1.0
	vol.step = 0.05
	vol.value = Settings.volume
	vol.value_changed.connect(func(v): Settings.volume = v; Settings.save(); Settings.changed.emit())
	_row(col, "Volumen", vol)
	var amb := HSlider.new()
	amb.max_value = 1.0
	amb.step = 0.05
	amb.value = Settings.ambience
	amb.value_changed.connect(func(v): Settings.ambience = v; Settings.save())
	_row(col, "Ambiente", amb)
	var mus := HSlider.new()
	mus.max_value = 1.0
	mus.step = 0.05
	mus.value = Settings.music
	mus.value_changed.connect(func(v): Settings.music = v; Settings.save())
	_row(col, "Música", mus)
	_section(col, "Mundo")
	var weather := OptionButton.new()
	for item in ["Automático (aguaceros)", "Despejado", "Lluvia"]:
		weather.add_item(item)
	weather.select(Settings.weather)
	weather.item_selected.connect(func(i): Settings.weather = i; Settings.save(); weather_changed.emit(i))
	_row(col, "Clima", weather)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 8)
	col.add_child(spacer)
	_button(col, "Volver", back)


func _refresh_options() -> void:
	_quality.select(0 if Settings.auto_quality else Settings.LEVELS.find(Settings.quality) + 1)
	var why := {"equipo": "elegida según tu equipo", "fps": "ajustada con los fps medidos", "manual": "elegida a mano"}
	_quality_note.text = "En uso: %s, %s · %s" % [Settings.quality.capitalize(), why.get(Settings.quality_reason, ""), Settings.gpu_name]


# ── Garaje ────────────────────────────────────────────────────────────────────────────────────────────

func _build_garage() -> void:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(root)
	_panels["garaje"] = root
	# escenario: el vehículo grande a la derecha, con piso y luz de estudio; arrastrar lo gira
	var frame := SubViewportContainer.new()
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	frame.anchor_left = 0.36
	frame.stretch = true
	frame.gui_input.connect(_garage_drag)
	root.add_child(frame)
	_garage_view = SubViewport.new()
	_garage_view.own_world_3d = true
	_garage_view.transparent_bg = false
	_garage_view.msaa_3d = Viewport.MSAA_4X
	frame.add_child(_garage_view)
	_cam_pivot = Node3D.new()
	_garage_view.add_child(_cam_pivot)
	var cam := _studio(_garage_view, 3.4)
	cam.position = Vector3(0, 1.9, 8.2)
	cam.rotation.x = -0.17
	cam.fov = 34
	_cam_pivot.add_child(cam)
	# columna izquierda: lista y ficha
	var col := VBoxContainer.new()
	col.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	col.position.x = 64
	col.offset_top = 56
	col.offset_bottom = -64
	col.custom_minimum_size = Vector2(440, 0)
	col.add_theme_constant_override("separation", 10)
	root.add_child(col)
	var k := Label.new()
	k.text = "GARAJE"
	k.theme_type_variation = "Caps"
	col.add_child(k)
	_garage_name = Label.new()
	_garage_name.theme_type_variation = "Display"
	col.add_child(_garage_name)
	_garage_desc = Label.new()
	_garage_desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	_garage_desc.custom_minimum_size = Vector2(430, 0)
	_garage_desc.add_theme_color_override("font_color", Color(GuaduaTheme.TEXT, 0.85))
	col.add_child(_garage_desc)
	_garage_stats = VBoxContainer.new()
	_garage_stats.add_theme_constant_override("separation", 4)
	col.add_child(_garage_stats)
	_section(col, "Pintura")
	_garage_paints = HFlowContainer.new()
	_garage_paints.add_theme_constant_override("h_separation", 8)
	col.add_child(_garage_paints)
	_section(col, "Placa")
	_garage_plate = LineEdit.new()
	_garage_plate.max_length = 7
	_garage_plate.placeholder_text = "ABC 123"
	_garage_plate.custom_minimum_size = Vector2(160, 0)
	_garage_plate.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_garage_plate.text_changed.connect(_plate_changed)
	col.add_child(_garage_plate)
	_section(col, "Vehículos")
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(scroll)
	_garage_list = VBoxContainer.new()
	_garage_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_garage_list.add_theme_constant_override("separation", 4)
	scroll.add_child(_garage_list)
	for t: String in VehiclesConfig.VEHICLES:
		var i := _garage_types.size()
		_garage_types.push_back(t)
		var b := _button(_garage_list, VehiclesConfig.VEHICLES[t].name, func(): _garage_choose(i))
		b.custom_minimum_size.y = 36
		b.focus_entered.connect(func(): _garage_show(i))
	var bottom := HBoxContainer.new()
	bottom.add_theme_constant_override("separation", 10)
	col.add_child(bottom)
	_garage_use = _button(bottom, "Usar este vehículo", func(): _garage_choose(_garage_sel))
	_button(bottom, "Volver", back)


func _stat(label: String, value: float, text: String) -> void:
	var r := HBoxContainer.new()
	r.add_theme_constant_override("separation", 10)
	var l := Label.new()
	l.text = label
	l.theme_type_variation = "Small"
	l.custom_minimum_size = Vector2(110, 0)
	r.add_child(l)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(200, 8)
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.value = clampf(value, 0.05, 1.0) * 100.0
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(GuaduaTheme.CAFE_MID, 0.5)
	bg.set_corner_radius_all(3)
	var fg := StyleBoxFlat.new()
	fg.bg_color = GuaduaTheme.GUADUA
	fg.set_corner_radius_all(3)
	bar.add_theme_stylebox_override("background", bg)
	bar.add_theme_stylebox_override("fill", fg)
	r.add_child(bar)
	var v := Label.new()
	v.text = text
	v.theme_type_variation = "Small"
	r.add_child(v)
	_garage_stats.add_child(r)


func _garage_show(i: int) -> void:
	_garage_sel = i
	var t := _garage_types[i]
	var spec := VehiclesConfig.spec(t)
	if _garage_model:
		_garage_model.queue_free()
	var m := VehicleModel.create(spec, false)
	if not m.is_empty():
		_garage_model = m.visual
		VehicleModel.customize(_garage_model, spec, Settings.paint_of(t), Settings.plate_of(t))
		_garage_model.scale = Vector3.ONE * (3.8 / maxf(float(spec.length), 2.0))
		_garage_model.rotation.y = -0.6
		_garage_view.add_child(_garage_model)
		UiFx.pulse(_garage_name)
	_garage_name.text = spec.name
	_garage_desc.text = DESCRIPTIONS.get(t, "")
	for c in _garage_stats.get_children():
		c.queue_free()
	# desempeño relativo al catálogo (las cifras son las de la configuración; las barras, para comparar)
	_stat("Velocidad", float(spec.max_speed) / 150.0, "%d km/h" % int(spec.max_speed))
	_stat("Aceleración", float(spec.engine) / float(spec.mass) / 2.1 * (1.0 - float(spec.mass) / 12000.0), "")
	_stat("Manejo", (float(spec.max_steer) - 0.4) / 0.3, "")
	_stat("Tamaño", float(spec.length) / 8.5, "%.1f × %.1f m · %d kg" % [spec.length, spec.width, int(spec.mass)])
	for c in _garage_paints.get_children():
		c.queue_free()
	var cols: Array = spec.get("colors", [])
	var current := Settings.paint_of(t)
	if cols.is_empty():
		var l := Label.new()
		l.text = "Color fijo" if spec.source == "baked" else "Color de fábrica"
		l.theme_type_variation = "Small"
		_garage_paints.add_child(l)
	for hex: String in cols:
		var sw := Button.new()
		sw.custom_minimum_size = Vector2(34, 34)
		sw.tooltip_text = hex
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(hex)
		sb.set_corner_radius_all(17)
		sb.set_border_width_all(3 if hex == current else 1)
		sb.border_color = GuaduaTheme.CREMA if hex == current else Color(0, 0, 0, 0.6)
		for st in ["normal", "hover", "pressed", "focus"]:
			var s2 := sb.duplicate() as StyleBoxFlat
			if st != "normal":
				s2.border_color = GuaduaTheme.CREMA
				s2.set_border_width_all(3)
			sw.add_theme_stylebox_override(st, s2)
		sw.pressed.connect(func(): _paint(t, hex))
		_garage_paints.add_child(sw)
	# los del Car Kit no traen placa
	_garage_plate.get_parent().get_child(_garage_plate.get_index() - 1).visible = spec.source == "baked"
	_garage_plate.visible = spec.source == "baked"
	_garage_plate.text = Settings.plate_of(t)
	_garage_use.text = "En uso" if t == current_vehicle else "Usar este vehículo"
	_garage_use.disabled = t == current_vehicle


func _paint(t: String, hex: String) -> void:
	Settings.paints[t] = hex
	Settings.save()
	_garage_show(_garage_sel)
	if t == current_vehicle:
		vehicle_chosen.emit(t) # repinta el del juego


## Placa colombiana: tres letras y tres números. Se normaliza mientras se escribe y se guarda al quedar completa.
func _plate_changed(text: String) -> void:
	var clean := text.to_upper().replace(" ", "")
	var out := ""
	for ch in clean:
		if out.length() < 3 and ch >= "A" and ch <= "Z":
			out += ch
		elif out.length() >= 3 and out.length() < 6 and ch >= "0" and ch <= "9":
			out += ch
	var shown := out if out.length() <= 3 else out.substr(0, 3) + " " + out.substr(3)
	if shown != text:
		_garage_plate.text = shown
		_garage_plate.caret_column = shown.length()
	if out.length() == 6:
		var t := _garage_types[_garage_sel]
		Settings.plates[t] = shown
		Settings.save()
		_garage_show(_garage_sel)
		_garage_plate.grab_focus()
		_garage_plate.caret_column = shown.length()
		if t == current_vehicle:
			vehicle_chosen.emit(t)


func _garage_choose(i: int) -> void:
	current_vehicle = _garage_types[i]
	Settings.vehicle = current_vehicle
	Settings.save()
	vehicle_chosen.emit(current_vehicle)
	_garage_show(i)


func _garage_drag(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_drag = event.pressed
	elif event is InputEventMouseMotion and _drag:
		var m := _char_model if _panels.personaje.visible else _garage_model
		if m:
			m.rotate_y(event.relative.x * 0.01)


## Estudio compartido (garaje y personaje): luz principal con sombra, contraluz crema, piso de disco y fondo café
## con niebla. Devuelve la cámara sin colocar.
func _studio(view: SubViewport, radius: float) -> Camera3D:
	var cam := Camera3D.new()
	var key := DirectionalLight3D.new()
	key.rotation = Vector3(-0.8, 0.7, 0)
	key.light_energy = 1.3
	key.shadow_enabled = true
	view.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation = Vector3(-0.3, -2.4, 0)
	rim.light_energy = 0.6
	rim.light_color = GuaduaTheme.CREMA
	view.add_child(rim)
	var floor_mi := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = radius
	disc.bottom_radius = radius
	disc.height = 0.05
	floor_mi.mesh = disc
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color("#2a1a0f")
	fm.roughness = 0.35
	fm.metallic = 0.2
	floor_mi.material_override = fm
	floor_mi.position.y = -0.03
	view.add_child(floor_mi)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	# estudio: fondo café oscuro con un velo de niebla que funde el piso con el fondo
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("#140b06")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(1, 0.93, 0.85)
	env.environment.ambient_light_energy = 0.55
	env.environment.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.environment.fog_enabled = true
	env.environment.fog_light_color = Color("#140b06")
	env.environment.fog_density = 0.06
	env.environment.glow_enabled = true
	view.add_child(env)
	return cam


# ── Personaje ─────────────────────────────────────────────────────────────────────────────────────────

func _build_character() -> void:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(root)
	_panels["personaje"] = root
	var frame := SubViewportContainer.new()
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	frame.anchor_left = 0.4
	frame.stretch = true
	frame.gui_input.connect(_garage_drag)
	root.add_child(frame)
	_char_view = SubViewport.new()
	_char_view.own_world_3d = true
	_char_view.msaa_3d = Viewport.MSAA_4X
	frame.add_child(_char_view)
	var cam := _studio(_char_view, 1.3)
	cam.position = Vector3(0, 1.15, 4.4)
	cam.rotation.x = -0.06
	cam.fov = 30
	_char_view.add_child(cam)
	var col := VBoxContainer.new()
	col.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	col.position.x = 64
	col.offset_top = 56
	col.offset_bottom = -64
	col.custom_minimum_size = Vector2(470, 0)
	col.add_theme_constant_override("separation", 8)
	root.add_child(col)
	var k := Label.new()
	k.text = "PERSONAJE"
	k.theme_type_variation = "Caps"
	col.add_child(k)
	var t := Label.new()
	t.text = "Quién eres en el valle"
	t.theme_type_variation = "Display"
	col.add_child(t)
	_char_origin = Label.new()
	_char_origin.autowrap_mode = TextServer.AUTOWRAP_WORD
	_char_origin.custom_minimum_size = Vector2(460, 0)
	_char_origin.add_theme_color_override("font_color", Color(GuaduaTheme.TEXT, 0.85))
	col.add_child(_char_origin)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(scroll)
	_char_form = VBoxContainer.new()
	_char_form.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_char_form.add_theme_constant_override("separation", 6)
	scroll.add_child(_char_form)
	_section(_char_form, "Origen")
	_choice("origen", CharacterConfig.ORIGINS, "Oficio")
	_section(_char_form, "Cuerpo")
	_choice("cuerpo", CharacterConfig.BODIES, "Complexión")
	_swatches("piel", CharacterConfig.SKIN, "Piel")
	_section(_char_form, "Cabeza")
	_choice("pelo", CharacterConfig.HAIR, "Pelo")
	_swatches("pelocolor", CharacterConfig.HAIR_COLOR, "Color")
	_choice("barba", CharacterConfig.BEARD, "Barba")
	_toggle("sombrero", "Sombrero aguadeño")
	_toggle("capucha", "Capucha")
	_section(_char_form, "Ropa")
	_choice("ropa", CharacterConfig.OUTFITS, "Conjunto")
	_toggle("hombreras", "Hombreras de cuero")
	var bottom := HBoxContainer.new()
	bottom.add_theme_constant_override("separation", 10)
	col.add_child(bottom)
	_button(bottom, "Listo", back)
	_button(bottom, "Al azar", _char_random)


## Fila con un selector de lista (nombre de cada opción en su ficha del catálogo).
func _choice(key: String, catalog: Dictionary, label: String) -> void:
	var ob := OptionButton.new()
	ob.set_meta("key", key)
	for id: String in catalog:
		ob.add_item(catalog[id].name)
		ob.set_item_metadata(ob.item_count - 1, id)
	ob.item_selected.connect(func(i): _char_set(key, ob.get_item_metadata(i)))
	ob.focus_entered.connect(func(): if AudioSystem.instance: AudioSystem.instance.ui_click())
	_row(_char_form, label, ob)


## Fila de muestras de color ([nombre, hex] por clave).
func _swatches(key: String, catalog: Dictionary, label: String) -> void:
	var flow := HFlowContainer.new()
	flow.set_meta("key", key)
	flow.add_theme_constant_override("h_separation", 6)
	for id: String in catalog:
		var sw := Button.new()
		sw.custom_minimum_size = Vector2(30, 30)
		sw.tooltip_text = catalog[id][0]
		sw.set_meta("id", id)
		sw.set_meta("hex", catalog[id][1])
		sw.pressed.connect(func(): _char_set(key, id))
		sw.focus_entered.connect(func(): if AudioSystem.instance: AudioSystem.instance.ui_click())
		flow.add_child(sw)
	_row(_char_form, label, flow)


func _toggle(key: String, label: String) -> void:
	var cb := CheckButton.new()
	cb.set_meta("key", key)
	cb.toggled.connect(func(on): _char_set(key, on))
	_row(_char_form, label, cb)


func _char_set(key: String, value: Variant) -> void:
	if Settings.look.get(key) == value:
		return
	Settings.look[key] = value
	# el origen fija la ropa y el sombrero iniciales (luego se pueden cambiar)
	if key == "origen":
		Settings.look.merge(CharacterConfig.ORIGINS[value].look, true)
	Settings.save()
	_char_refresh()
	look_changed.emit()


func _char_random() -> void:
	for key: String in ["cuerpo", "piel", "pelo", "pelocolor", "barba", "ropa"]:
		var cat: Dictionary = {"cuerpo": CharacterConfig.BODIES, "piel": CharacterConfig.SKIN, "pelo": CharacterConfig.HAIR,
			"pelocolor": CharacterConfig.HAIR_COLOR, "barba": CharacterConfig.BEARD, "ropa": CharacterConfig.OUTFITS}[key]
		Settings.look[key] = cat.keys().pick_random()
	Settings.look.sombrero = randf() < 0.5
	Settings.look.capucha = randf() < 0.15
	Settings.look.hombreras = randf() < 0.2
	Settings.save()
	_char_refresh()
	look_changed.emit()


## Pone los controles en el valor actual y rearma el muñeco del estudio (sin perder el giro que tenía).
func _char_refresh() -> void:
	var look := Settings.look
	for c: Node in _char_form.find_children("*", "", true, false):
		if not c.has_meta("key"):
			continue
		var v: Variant = look.get(c.get_meta("key"))
		if c is OptionButton:
			for i in c.item_count:
				if c.get_item_metadata(i) == v:
					c.select(i)
		elif c is CheckButton:
			c.set_pressed_no_signal(bool(v))
		elif c is HFlowContainer:
			for sw: Button in c.get_children():
				var on: bool = sw.get_meta("id") == v
				for st in ["normal", "hover", "pressed", "focus"]:
					var sb := StyleBoxFlat.new()
					sb.bg_color = Color(sw.get_meta("hex"))
					sb.set_corner_radius_all(15)
					sb.set_border_width_all(3 if on or st != "normal" else 1)
					sb.border_color = GuaduaTheme.CREMA if on or st != "normal" else Color(0, 0, 0, 0.6)
					sw.add_theme_stylebox_override(st, sb)
	var o: Dictionary = CharacterConfig.ORIGINS.get(look.origen, {})
	_char_origin.text = "%s. %s" % [o.get("name", ""), o.get("detail", "")]
	var yaw := 0.4
	if _char_model:
		yaw = _char_model.rotation.y
		_char_model.queue_free()
	_char_model = CharacterModel.create()
	if _char_model:
		_char_model.rotation.y = yaw
		_char_view.add_child(_char_model)
		var anim: AnimationPlayer = _char_model.get_node("AnimationPlayer")
		anim.play(CharacterModel.clip("Idle"))


# ── Créditos ──────────────────────────────────────────────────────────────────────────────────────────

func _build_credits() -> void:
	var col := _screen("creditos", "Fuentes y licencias", "Créditos", 600)
	var text := RichTextLabel.new()
	text.bbcode_enabled = true
	text.fit_content = true
	text.custom_minimum_size = Vector2(580, 0)
	var crema := GuaduaTheme.CREMA.to_html(false)
	var b := "[color=#%s]%s[/color]"
	var lines := [b % [crema, "DATOS DEL MUNDO"]]
	for a: String in WorldData.manifest.get("attribution", []):
		lines.push_back("· " + a)
	lines += ["· Edificios: Overture Maps (ODbL) y Google Open Buildings (CC BY 4.0)", "",
		b % [crema, "MODELOS 3D (CC0, DOMINIO PÚBLICO)"],
		"· Personajes y animaciones: Quaternius",
		"· Vehículos del tráfico, piezas de edificios y muebles: Kenney",
		"· Vehículos típicos, hitos y texturas propias: hechos para el proyecto", "",
		b % [crema, "MODELOS 3D EXTERNOS (SKETCHFAB, CON ATRIBUCIÓN)"]]
	# los CC BY obligan a atribuir en pantalla; los CC BY-NC además a que el juego sea no comercial
	var cred := "res://assets/models/externos/creditos.json"
	if FileAccess.file_exists(cred):
		for c: Dictionary in JSON.parse_string(FileAccess.get_file_as_string(cred)):
			lines.push_back("· «%s» de %s — %s · %s%s" % [c.titulo, c.autor, c.licencia, c.uso, (" · " + String(c.ip)) if c.get("ip") else ""])
		lines.push_back("[i]Con modelos CC BY-NC: el juego es gratuito y no comercial.[/i]")
	else:
		lines.push_back("· (no importados en esta copia)")
	lines += ["",
		b % [crema, "TEXTURAS Y TIPOGRAFÍA"],
		"· ambientCG y Poly Haven (CC0) · Anton e Inter (SIL OFL 1.1)", "",
		b % [crema, "MOTOR"], "· Godot Engine 4.7 (MIT) · física Jolt (MIT)", "",
		"[i]Los grupos armados del juego son ficción: no representan a ningún grupo real.[/i]",
		"[i]Los seres del monte son leyendas de la tradición oral del Huila y el Tolima; lo que no tiene fuente es ficción del juego.[/i]"]
	text.text = "\n".join(lines)
	text.add_theme_color_override("default_color", Color(GuaduaTheme.TEXT, 0.85))
	col.add_child(text)
	_button(col, "Volver", back)


# ── Navegación ────────────────────────────────────────────────────────────────────────────────────────

func open(name: String, reset := false) -> void:
	if reset:
		_stack.clear()
	for n: String in _panels:
		if n != name:
			_panels[n].visible = false
	if not _dim.visible:
		UiFx.enter(_dim, Vector2.ZERO, 0.25)
	UiFx.enter(_panels[name], Vector2(-18, 0))
	if _stack.is_empty() or _stack[-1] != name:
		_stack.push_back(name)
	if name == "opciones":
		_refresh_options()
	if name == "personaje":
		_char_refresh()
	if name == "garaje":
		var i := maxi(_garage_types.find(current_vehicle), 0)
		_garage_show(i)
		(_garage_list.get_child(i) as Control).grab_focus()
	else:
		_focus_first(_panels[name])
	_update_hints()
	_hints.visible = true


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
	if _hints:
		_hints.visible = false


func is_open() -> bool:
	return not _stack.is_empty()


func _focus_first(node: Node) -> void:
	for c: Node in node.find_children("*", "Control", true, false):
		if c is BaseButton and (c as Control).is_visible_in_tree() and not (c as BaseButton).disabled:
			(c as Control).grab_focus()
			return


func _update_hints() -> void:
	if UiFx.gamepad:
		_hints.text = "Cruceta: elegir   ·   A: aceptar   ·   B: volver"
	else:
		_hints.text = "↑ ↓ elegir   ·   Enter aceptar   ·   Esc volver" + ("   ·   arrastrar: girar el vehículo" if _panels.garaje.visible else "") + ("   ·   arrastrar: girar" if _panels.personaje.visible else "")


func _unhandled_input(event: InputEvent) -> void:
	if is_open() and event.is_action_pressed("ui_cancel") and not _garage_plate.has_focus():
		back()
		get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	if _char_model and _panels.personaje.visible and not _drag:
		_char_model.rotate_y(delta * 0.25)
	if _garage_model and _panels.garaje.visible and not _drag:
		_garage_model.rotate_y(delta * 0.35)
