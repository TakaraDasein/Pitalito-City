class_name Speedometer
extends Control
## Velocímetro de la web (HUD.js): aro de culmo de guadua con nudos y un arco de 270° en verde guadua que crece
## con la velocidad relativa a la máxima del vehículo. Cifra grande al centro y "km/h" debajo.

const SIZE := 150.0
const GREEN_LIGHT := Color("#b5d672")
const GREEN_DARK := Color("#2c4a17")

var kmh := 0.0
var max_kmh := 120.0
var _shown := 0.0


func _ready() -> void:
	custom_minimum_size = Vector2(SIZE, SIZE)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	_shown = lerpf(_shown, kmh, minf(1.0, delta * 8.0))
	queue_redraw()


func _draw() -> void:
	var c := Vector2(SIZE, SIZE) * 0.5
	var r := SIZE * 0.5 - 10.0
	draw_circle(c, r + 6.0, Color(GuaduaTheme.CAFE_DARK, 0.82))
	# aro de culmo y sus nudos
	draw_arc(c, r + 3.0, 0.0, TAU, 72, GuaduaTheme.CAFE_MID, 6.0, true)
	for i in 8:
		var a := TAU * i / 8.0 + 0.4
		var d := Vector2(cos(a), sin(a))
		draw_line(c + d * (r - 1.0), c + d * (r + 7.0), GuaduaTheme.CREMA, 2.0, true)
	# arco de 135° a 405°: base tenue y tramo verde que degrada de claro a oscuro
	var a0 := deg_to_rad(135.0)
	var span := deg_to_rad(270.0)
	draw_arc(c, r - 9.0, a0, a0 + span, 60, Color(0.08, 0.05, 0.02, 0.65), 4.0, true)
	var p := clampf(_shown / maxf(max_kmh, 1.0), 0.0, 1.0)
	var steps := maxi(1, int(40 * p))
	for i in steps:
		var t0 := float(i) / steps * p
		var t1 := float(i + 1) / steps * p
		draw_arc(c, r - 9.0, a0 + span * t0, a0 + span * t1, 3, GREEN_LIGHT.lerp(GREEN_DARK, t1), 4.0, true)
	var font := get_theme_default_font()
	var txt := str(int(round(_shown)))
	var ts := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 40)
	draw_string(font, c + Vector2(-ts.x * 0.5, 12), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 40, GuaduaTheme.TEXT)
	var us := font.get_string_size("km/h", HORIZONTAL_ALIGNMENT_LEFT, -1, 12)
	draw_string(font, c + Vector2(-us.x * 0.5, 32), "km/h", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(GuaduaTheme.CREMA, 0.8))
