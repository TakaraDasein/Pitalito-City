class_name GuaduaTheme
## Estilo café y guadua de toda la interfaz (mismos tonos que web/src/ui/styles.css). Un solo Theme para todos
## los Control: cualquier panel nuevo lo hereda sin escribir colores a mano.

const CAFE_DARK := Color("#1c1008")
const CAFE := Color("#3b2414")
const CAFE_MID := Color("#6f4e37")
const CREMA := Color("#d9b98a")
const TEXT := Color("#f6eed9")
const GREEN := Color("#008351") # placas de nomenclatura de Pitalito

static var _theme: Theme


static func get_theme() -> Theme:
	if _theme:
		return _theme
	_theme = Theme.new()
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color(CAFE_DARK, 0.86)
	panel.border_color = CAFE_MID
	panel.set_border_width_all(2)
	panel.border_width_left = 5 # la caña de guadua del borde
	panel.set_corner_radius_all(6)
	panel.set_content_margin_all(10)
	_theme.set_stylebox("panel", "PanelContainer", panel)
	_theme.set_color("font_color", "Label", TEXT)
	_theme.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.6))
	_theme.set_constant("shadow_offset_x", "Label", 1)
	_theme.set_constant("shadow_offset_y", "Label", 1)
	_theme.set_font_size("font_size", "Label", 15)
	# Campos, listas y botones: fondo café oscuro, borde de guadua, foco en crema (navegación con teclado visible)
	var field := StyleBoxFlat.new()
	field.bg_color = Color(CAFE_DARK, 0.95)
	field.border_color = CAFE_MID
	field.set_border_width_all(2)
	field.set_corner_radius_all(4)
	field.set_content_margin_all(8)
	var focus := field.duplicate() as StyleBoxFlat
	focus.border_color = CREMA
	focus.draw_center = false
	var hover := field.duplicate() as StyleBoxFlat
	hover.bg_color = Color(CAFE, 0.95)
	var selected := field.duplicate() as StyleBoxFlat
	selected.bg_color = CAFE_MID
	for t in ["LineEdit", "Button", "ItemList", "OptionButton"]:
		_theme.set_stylebox("normal", t, field)
		_theme.set_stylebox("focus", t, focus)
		_theme.set_color("font_color", t, TEXT)
	_theme.set_stylebox("panel", "ItemList", field)
	_theme.set_stylebox("hover", "Button", hover)
	_theme.set_stylebox("pressed", "Button", selected)
	_theme.set_stylebox("hovered", "ItemList", hover)
	_theme.set_stylebox("selected", "ItemList", selected)
	_theme.set_stylebox("selected_focus", "ItemList", selected)
	_theme.set_stylebox("cursor", "ItemList", focus)
	_theme.set_stylebox("cursor_unfocused", "ItemList", StyleBoxEmpty.new())
	_theme.set_color("font_hovered_color", "ItemList", CREMA)
	_theme.set_color("font_selected_color", "ItemList", Color.WHITE)
	_theme.set_color("font_placeholder_color", "LineEdit", Color(TEXT, 0.45))
	_theme.set_color("caret_color", "LineEdit", CREMA)
	_theme.set_color("selection_color", "LineEdit", Color(CAFE_MID, 0.8))
	_theme.set_type_variation("Title", "Label")
	_theme.set_color("font_color", "Title", CREMA)
	_theme.set_font_size("font_size", "Title", 22)
	_theme.set_type_variation("Small", "Label")
	_theme.set_font_size("font_size", "Small", 12)
	_theme.set_color("font_color", "Small", Color(TEXT, 0.75))
	return _theme
