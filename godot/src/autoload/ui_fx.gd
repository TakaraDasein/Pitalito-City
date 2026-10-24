extends Node
## Apoyo de la interfaz:
##  · qué control usa la persona (teclado/ratón o mando), para mostrar la tecla o el botón correcto en los avisos
##  · animaciones cortas y consistentes: entrar (fundido + desplazamiento), salir, latido, y el realce de los
##    botones al enfocarlos (se corren un poco a la derecha, como empujando la caña)

signal device_changed(gamepad: bool)

const DUR := 0.18

var gamepad := false

## Nombre de cada acción en teclado y en mando (diseño Xbox, el más común en Linux y Steam). Deben coincidir con
## el mapa de controles de project.godot; "—" = sin botón (el aviso se esconde con mando).
const GLYPHS := {
	"interact": ["F", "Y"], "info": ["E", "X"], "map": ["M", "LB"], "jump": ["Espacio", "A"],
	"toggle_mouse": ["Esc", "Start"], "camera": ["C", "RS"], "time_skip": ["N", "—"], "garage": ["V", "Back"],
	"help": ["H", "—"], "sprint": ["Shift", "LS"], "brake": ["Espacio", "A"],
}


func _input(event: InputEvent) -> void:
	var pad: bool = event is InputEventJoypadButton or (event is InputEventJoypadMotion and absf(event.axis_value) > 0.4)
	var kb: bool = event is InputEventKey or event is InputEventMouseButton or (event is InputEventMouseMotion and event.relative.length() > 2.0)
	if (pad and not gamepad) or (kb and gamepad):
		gamepad = pad
		device_changed.emit(gamepad)


func glyph(action: String) -> String:
	var g: Array = GLYPHS.get(action, [action, action])
	return g[1] if gamepad else g[0]


## Entrada: aparece desde `offset` con fundido.
func enter(c: CanvasItem, offset := Vector2(0, 12), dur := DUR) -> void:
	if c is Control:
		var ctl := c as Control
		var base: Vector2 = ctl.get_meta("fx_base", ctl.position)
		ctl.set_meta("fx_base", base)
		ctl.position = base + offset
		_tween(c).tween_property(ctl, "position", base, dur).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	c.modulate.a = 0.0
	c.visible = true
	_tween(c, true).tween_property(c, "modulate:a", 1.0, dur)


## Salida: fundido y se esconde.
func leave(c: CanvasItem, dur := DUR * 0.8) -> void:
	if not c.visible:
		return
	var tw := _tween(c, true)
	tw.tween_property(c, "modulate:a", 0.0, dur)
	tw.tween_callback(func(): c.visible = false; c.modulate.a = 1.0)


## Latido corto (confirmar una elección).
func pulse(c: Control) -> void:
	c.pivot_offset = c.size * 0.5
	var tw := c.create_tween()
	tw.tween_property(c, "scale", Vector2(1.06, 1.06), 0.08)
	tw.tween_property(c, "scale", Vector2.ONE, 0.12)


## Realce al enfocar o pasar el ratón: el botón se corre 6 px a la derecha, y vuelve al soltar.
func wire_button(b: BaseButton) -> void:
	var on := func():
		if not b.has_meta("fx_x"):
			b.set_meta("fx_x", b.position.x)
		b.create_tween().tween_property(b, "position:x", float(b.get_meta("fx_x")) + 6.0, 0.12).set_trans(Tween.TRANS_CUBIC)
	var off := func():
		if b.has_meta("fx_x") and not b.has_focus():
			b.create_tween().tween_property(b, "position:x", float(b.get_meta("fx_x")), 0.12).set_trans(Tween.TRANS_CUBIC)
	b.focus_entered.connect(on)
	b.mouse_entered.connect(func(): b.grab_focus())
	b.focus_exited.connect(off)
	b.mouse_exited.connect(off)


func _tween(c: CanvasItem, alpha := false) -> Tween:
	var key := "fx_tw_a" if alpha else "fx_tw_p"
	if c.has_meta(key):
		var old: Tween = c.get_meta(key)
		if old and old.is_valid():
			old.kill()
	var tw := c.create_tween()
	tw.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	c.set_meta(key, tw)
	return tw
