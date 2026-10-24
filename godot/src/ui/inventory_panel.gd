class_name InventoryPanel
extends Control
## Mochila (port de web/src/ui/InventoryPanel.js). Tecla I la abre y la cierra; Esc también la cierra. Pausa el
## juego mientras está abierta. Cada objeto es un botón (navegable con teclado): Enter o clic = usar, Supr = tirar.
## Estilo café y guadua (GuaduaTheme), como el resto de la interfaz.

var is_open := false
var allowed := true          # main.gd lo apaga fuera de la partida o manejando
var _list: VBoxContainer
var _weight: Label


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	theme = GuaduaTheme.get_theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	if not InputMap.has_action("inventory"):
		InputMap.add_action("inventory")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_I
		InputMap.action_add_event("inventory", ev)
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.custom_minimum_size = Vector2(420, 0)
	add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	panel.add_child(col)
	var title := Label.new()
	title.text = "MOCHILA"
	title.theme_type_variation = "Title"
	col.add_child(title)
	_weight = Label.new()
	_weight.add_theme_color_override("font_color", GuaduaTheme.CREMA)
	col.add_child(_weight)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 360)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)
	var foot := Label.new()
	foot.text = "Enter o clic: usar · Supr: tirar · I o Esc: cerrar"
	foot.add_theme_font_size_override("font_size", 12)
	col.add_child(foot)
	if InventorySystem.instance:
		InventorySystem.instance.changed.connect(func(): if is_open: _paint())


func toggle(force := -1) -> void:
	is_open = (not is_open) if force < 0 else bool(force)
	visible = is_open
	get_tree().paused = is_open
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if is_open else Input.MOUSE_MODE_CAPTURED
	if is_open:
		_paint()


func _paint() -> void:
	var inv := InventorySystem.instance
	for c in _list.get_children():
		c.queue_free()
	_weight.text = "%.1f / %.0f kg" % [inv.weight(), LootConfig.LOOT.max_load]
	var items := inv.list()
	if items.is_empty():
		var empty := Label.new()
		empty.text = "Vacía. Busca en hospitales, CAI, iglesias, tiendas, plazas de mercado y bombas."
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_list.add_child(empty)
		return
	var first: Button
	for it: Dictionary in items:
		var b := Button.new()
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var what := "usar" if it.has("use") else ("arma · Z para cambiar" if it.get("melee", false) else String(it.get("detail", "")))
		b.text = "%d×  %s   —  %s" % [it.n, it.name, what]
		b.tooltip_text = String(it.get("detail", ""))
		var id: String = it.id
		b.pressed.connect(func(): inv.use(id))
		b.gui_input.connect(func(e: InputEvent):
			if e is InputEventKey and e.pressed and e.physical_keycode == KEY_DELETE:
				inv.drop_all(id)
				get_viewport().set_input_as_handled())
		_list.add_child(b)
		if first == null:
			first = b
	if first:
		first.call_deferred("grab_focus")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("inventory") and (allowed or is_open):
		toggle()
		get_viewport().set_input_as_handled()
	elif is_open and event.is_action_pressed("ui_cancel"):
		toggle(0)
		get_viewport().set_input_as_handled()
