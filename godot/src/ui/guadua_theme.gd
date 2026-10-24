class_name GuaduaTheme
## Estilo café y guadua de toda la interfaz (mismos tonos que web/src/ui/styles.css). Un solo Theme para todos
## los Control: cualquier panel nuevo lo hereda sin escribir colores a mano.
## Tipografías: Anton para títulos (Title, Hero, Display) e Inter para el resto, las mismas de la web (SIL OFL,
## web/scripts/fetch-fonts.mjs). Sin ellas, la fuente por defecto de Godot.
## Los botones son "cañas": borde izquierdo de guadua que se ensancha y se enciende en crema al enfocar.

const CAFE_DARK := Color("#1c1008")
const CAFE := Color("#3b2414")
const CAFE_MID := Color("#6f4e37")
const CREMA := Color("#d9b98a")
const TEXT := Color("#f6eed9")
const GREEN := Color("#008351") # placas de nomenclatura de Pitalito
const GUADUA := Color("#8fa64a") # verde de la guadua viva (acentos activos)
const SALUD := Color("#a8322a")  # vida en las barras de combate (rojo achiote)

const FONTS := "res://assets/fonts"

static var _theme: Theme
static var display_font: Font
static var text_font: Font


static func _font(file: String, weight := 0) -> Font:
	var path := "%s/%s" % [FONTS, file]
	if not ResourceLoader.exists(path):
		return null
	var base: FontFile = load(path)
	if weight == 0:
		return base
	var v := FontVariation.new()
	v.base_font = base
	v.variation_opentype = {"wght": weight}
	return v


static func _box(bg: Color, border: Color, width := 1, left := 1, radius := 4, margin := 8) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(width)
	sb.border_width_left = left
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(margin)
	sb.content_margin_left = margin + left + 4
	sb.anti_aliasing = true
	return sb


static func get_theme() -> Theme:
	if _theme:
		return _theme
	_theme = Theme.new()
	display_font = _font("Anton-Regular.ttf")
	text_font = _font("Inter.ttf", 450)
	var semibold := _font("Inter.ttf", 620)
	if text_font:
		_theme.default_font = text_font
	_theme.default_font_size = 15

	# Paneles: café traslúcido, borde de guadua más grueso a la izquierda, sombra suave
	var panel := _box(Color(CAFE_DARK, 0.9), Color(CAFE_MID, 0.9), 1, 4, 8, 14)
	panel.shadow_color = Color(0, 0, 0, 0.35)
	panel.shadow_size = 12
	panel.shadow_offset = Vector2(0, 4)
	_theme.set_stylebox("panel", "PanelContainer", panel)
	_theme.set_color("font_color", "Label", TEXT)
	_theme.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.5))
	_theme.set_constant("shadow_offset_x", "Label", 0)
	_theme.set_constant("shadow_offset_y", "Label", 1)

	# Botón caña: normal tenue; hover y foco con borde crema grueso a la izquierda y fondo más claro
	var normal := _box(Color(CAFE_DARK, 0.75), Color(CAFE_MID, 0.6), 1, 3, 4, 9)
	var hover := _box(Color(CAFE, 0.92), CREMA, 1, 6, 4, 9)
	var focus := _box(Color(CAFE, 0.92), CREMA, 1, 6, 4, 9)
	var pressed := _box(CAFE_MID, CREMA, 1, 6, 4, 9)
	var disabled := _box(Color(CAFE_DARK, 0.4), Color(CAFE_MID, 0.3), 1, 3, 4, 9)
	for t in ["Button", "OptionButton"]:
		_theme.set_stylebox("normal", t, normal)
		_theme.set_stylebox("hover", t, hover)
		_theme.set_stylebox("focus", t, focus)
		_theme.set_stylebox("pressed", t, pressed)
		_theme.set_stylebox("hover_pressed", t, pressed)
		_theme.set_stylebox("disabled", t, disabled)
		_theme.set_color("font_color", t, TEXT)
		_theme.set_color("font_hover_color", t, CREMA)
		_theme.set_color("font_focus_color", t, CREMA)
		_theme.set_color("font_pressed_color", t, Color.WHITE)
		_theme.set_color("font_disabled_color", t, Color(TEXT, 0.35))
		_theme.set_font_size("font_size", t, 16)
		if semibold:
			_theme.set_font("font", t, semibold)

	# Campos y listas
	var field := _box(Color(CAFE_DARK, 0.95), Color(CAFE_MID, 0.8), 1, 1, 4, 8)
	var field_focus := _box(Color(CAFE_DARK, 0.95), CREMA, 1, 1, 4, 8)
	_theme.set_stylebox("normal", "LineEdit", field)
	_theme.set_stylebox("focus", "LineEdit", field_focus)
	_theme.set_color("font_color", "LineEdit", TEXT)
	_theme.set_color("font_placeholder_color", "LineEdit", Color(TEXT, 0.45))
	_theme.set_color("caret_color", "LineEdit", CREMA)
	_theme.set_color("selection_color", "LineEdit", Color(CAFE_MID, 0.8))
	_theme.set_stylebox("panel", "ItemList", field)
	_theme.set_stylebox("focus", "ItemList", field_focus)
	var row_hover := _box(Color(CAFE, 0.9), Color(0, 0, 0, 0), 0, 3, 3, 6)
	row_hover.border_color = Color(CREMA, 0.5)
	var row_sel := _box(CAFE_MID, CREMA, 0, 4, 3, 6)
	_theme.set_stylebox("hovered", "ItemList", row_hover)
	_theme.set_stylebox("selected", "ItemList", row_sel)
	_theme.set_stylebox("selected_focus", "ItemList", row_sel)
	_theme.set_stylebox("cursor", "ItemList", StyleBoxEmpty.new())
	_theme.set_stylebox("cursor_unfocused", "ItemList", StyleBoxEmpty.new())
	_theme.set_color("font_color", "ItemList", TEXT)
	_theme.set_color("font_hovered_color", "ItemList", CREMA)
	_theme.set_color("font_selected_color", "ItemList", Color.WHITE)
	_theme.set_constant("v_separation", "ItemList", 6)

	# Casillas, deslizadores y separadores
	for t in ["CheckBox", "CheckButton"]:
		_theme.set_stylebox("normal", t, StyleBoxEmpty.new())
		_theme.set_stylebox("hover", t, StyleBoxEmpty.new())
		_theme.set_stylebox("pressed", t, StyleBoxEmpty.new())
		_theme.set_stylebox("focus", t, _box(Color(0, 0, 0, 0), CREMA, 1, 1, 4, 4))
		_theme.set_color("font_color", t, TEXT)
		_theme.set_color("font_hover_color", t, CREMA)
		_theme.set_color("font_focus_color", t, CREMA)
		_theme.set_color("font_pressed_color", t, TEXT)
	var track := _box(Color(CAFE_MID, 0.6), Color(0, 0, 0, 0), 0, 0, 3, 0)
	track.content_margin_top = 3
	track.content_margin_bottom = 3
	var fill := _box(GUADUA, Color(0, 0, 0, 0), 0, 0, 3, 0)
	fill.content_margin_top = 3
	fill.content_margin_bottom = 3
	_theme.set_stylebox("slider", "HSlider", track)
	_theme.set_stylebox("grabber_area", "HSlider", fill)
	_theme.set_stylebox("grabber_area_highlight", "HSlider", fill)
	_theme.set_stylebox("focus", "HSlider", _box(Color(0, 0, 0, 0), CREMA, 1, 1, 4, 2))
	var sep := StyleBoxLine.new()
	sep.color = Color(CAFE_MID, 0.7)
	sep.vertical = true
	_theme.set_stylebox("separator", "VSeparator", sep)
	var hsep := StyleBoxLine.new()
	hsep.color = Color(CAFE_MID, 0.7)
	_theme.set_stylebox("separator", "HSeparator", hsep)

	# Variantes de texto
	_theme.set_type_variation("Title", "Label")
	_theme.set_color("font_color", "Title", CREMA)
	_theme.set_font_size("font_size", "Title", 26)
	_theme.set_type_variation("Hero", "Label")
	_theme.set_font_size("font_size", "Hero", 96)
	_theme.set_color("font_color", "Hero", CREMA)
	_theme.set_color("font_shadow_color", "Hero", Color(0, 0, 0, 0.55))
	_theme.set_constant("shadow_offset_y", "Hero", 4)
	_theme.set_type_variation("Display", "Label")
	_theme.set_font_size("font_size", "Display", 34)
	_theme.set_color("font_color", "Display", CREMA)
	if display_font:
		for t in ["Title", "Hero", "Display"]:
			_theme.set_font("font", t, display_font)
	_theme.set_type_variation("Small", "Label")
	_theme.set_font_size("font_size", "Small", 13)
	_theme.set_color("font_color", "Small", Color(TEXT, 0.72))
	_theme.set_type_variation("Caps", "Label")
	_theme.set_font_size("font_size", "Caps", 12)
	_theme.set_color("font_color", "Caps", Color(CREMA, 0.8))
	if semibold:
		_theme.set_font("font", "Caps", semibold)
	return _theme
