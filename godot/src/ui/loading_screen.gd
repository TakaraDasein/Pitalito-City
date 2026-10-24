class_name LoadingScreen
extends CanvasLayer
## Carga: fondo café, un tallo de guadua delgado que se llena con el progreso (los nudos se encienden al pasar),
## un grano de café que respira y la etapa en curso. Sin barras ni porcentajes: sutil. Se desvanece al terminar.
## El progreso lo pone main.gd según lo que de verdad está listo (ver Main._boot), no un temporizador.

var progress := 0.0      # 0..1, objetivo
var stage := ""

var _shown := 0.0        # progreso dibujado (se acerca suave al objetivo)
var _t := 0.0
var _root: Control
var _canvas: Control
var _label: Label


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.theme = GuaduaTheme.get_theme()
	add_child(_root)
	var bg := ColorRect.new()
	bg.color = GuaduaTheme.CAFE_DARK
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(bg)
	_canvas = Control.new()
	_canvas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_canvas.draw.connect(_draw_canvas)
	_root.add_child(_canvas)
	_label = Label.new()
	_label.theme_type_variation = "Small"
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_label.position.y += 46
	_label.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_root.add_child(_label)


func set_stage(text: String, p: float) -> void:
	stage = text
	progress = maxf(progress, p)


func _process(delta: float) -> void:
	_t += delta
	_shown = lerpf(_shown, progress, minf(1.0, delta * 4.0))
	_label.text = stage
	_canvas.queue_redraw()


func _draw_canvas() -> void:
	var c := _canvas.size * 0.5
	var w := minf(320.0, _canvas.size.x * 0.6)
	var a := c + Vector2(-w * 0.5, 0)
	var b := c + Vector2(w * 0.5, 0)
	var font: Font = GuaduaTheme.display_font if GuaduaTheme.display_font else _canvas.get_theme_default_font()
	# nombre, con un leve respiro de opacidad
	var title := "PITALITO"
	var ts := font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, 44)
	_canvas.draw_string(font, c + Vector2(-ts.x * 0.5, -30), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 44, Color(GuaduaTheme.CREMA, 0.82 + 0.1 * sin(_t * 1.5)))
	# tallo: base tenue y tramo lleno
	_canvas.draw_line(a, b, Color(GuaduaTheme.CAFE_MID, 0.55), 3.0, true)
	var fill := a.lerp(b, clampf(_shown, 0.0, 1.0))
	_canvas.draw_line(a, fill, GuaduaTheme.CREMA, 3.0, true)
	# nudos de la guadua cada 1/8: se encienden al pasar el relleno
	for k in 9:
		var p := a.lerp(b, k / 8.0)
		var lit := _shown >= k / 8.0 - 0.001
		_canvas.draw_line(p + Vector2(0, -5), p + Vector2(0, 5), GuaduaTheme.CREMA if lit else Color(GuaduaTheme.CAFE_MID, 0.8), 2.0, true)
	# grano de café que respira, en la punta del relleno
	var s := 1.0 + 0.08 * sin(_t * 3.0)
	var bean := fill + Vector2(0, -16)
	var pts := PackedVector2Array()
	for i in 24:
		var ang := TAU * i / 24.0
		pts.push_back(bean + Vector2(cos(ang) * 5.0, sin(ang) * 7.0).rotated(0.5) * s)
	_canvas.draw_colored_polygon(pts, Color("#7a4a2a"))
	_canvas.draw_line(bean + Vector2(-1.5, -5.5).rotated(0.5) * s, bean + Vector2(1.5, 5.5).rotated(0.5) * s, GuaduaTheme.CAFE_DARK, 1.2, true)


## Desvanecer y liberar.
func finish() -> void:
	progress = 1.0
	stage = ""
	var tw := create_tween()
	tw.tween_interval(0.25)
	tw.tween_property(_root, "modulate:a", 0.0, 0.45)
	tw.tween_callback(queue_free)
