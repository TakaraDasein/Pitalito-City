extends Node
## Herramienta: capturas de la carga y los menús (screenshots/menu_*.png). Uso: godot res://tools/menu_shots.tscn
## Para no recorrer todo, se nombran las secciones que interesan: `godot res://tools/menu_shots.tscn -- personaje`
## (garaje, personaje, menus, juego, pies, banca, subir, faros, tomar, ambiente, combate, botin, disparos, criaturas, monte, uno; varias separadas por espacio). Carga y portada se capturan siempre.

var _main: Node
var _only := OS.get_cmdline_user_args()


func _want(section: String) -> bool:
	return _only.is_empty() or section in _only


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	Settings.persist = false
	_main = load("res://scenes/main.tscn").instantiate()
	_main.skip_mount = true
	_main.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(_main)
	var t0 := Time.get_ticks_msec()
	await get_tree().create_timer(0.4).timeout
	await _shot("carga")
	while _main.state == _main.State.LOADING:
		await get_tree().process_frame
	print("carga con GPU: %.1f s · calidad %s (%s) · GPU %s" % [(Time.get_ticks_msec() - t0) / 1000.0, Settings.quality, Settings.quality_reason, Settings.gpu_name])
	await get_tree().create_timer(2.0).timeout
	await _shot("principal")
	if _want("garaje"):
		_main._menus.open("garaje")
		await get_tree().create_timer(1.0).timeout
		await _shot("garaje")
		_main._menus._garage_show(_main._menus._garage_types.find("chiva"))
		_main._menus._paint("chiva", "#d62828")
		await get_tree().create_timer(1.0).timeout
		await _shot("garaje_chiva")
		_main._menus._garage_show(_main._menus._garage_types.find("sedan"))
		_main._menus._paint("sedan", "#cf534f")
		await get_tree().create_timer(1.0).timeout
		await _shot("garaje_sedan")
	if _want("personaje"):
		_main._menus.open("personaje")
		await get_tree().create_timer(1.0).timeout
		await _shot("personaje")
		# de cerca: la cara (aquí se vio el hundimiento de la piel)
		var cam: Camera3D = _main._menus._char_view.get_camera_3d()
		var cam_xf := cam.transform
		cam.position = Vector3(0, 1.45, 1.1)
		cam.rotation = Vector3(0.12, 0, 0)
		_main._menus._char_model.rotation.y = 0.3
		await get_tree().create_timer(0.6).timeout
		await _shot("personaje_cara")
		cam.transform = cam_xf
		_main._menus._char_set("cuerpo", "b")
		_main._menus._char_set("pelo", "largo")
		_main._menus._char_set("sombrero", false)
		_main._menus._char_set("pelocolor", "castano")
		_main._menus._char_set("ropa", "chaqueta")
		_main._menus._char_set("hombreras", true)
		await get_tree().create_timer(1.0).timeout
		await _shot("personaje_b")
	if _want("menus"):
		_main._menus.open("creditos")
		await get_tree().create_timer(0.5).timeout
		await _shot("creditos")
		_main._menus.open("opciones")
		await get_tree().create_timer(0.5).timeout
		await _shot("opciones")
	if _want("juego"):
		_main._start_playing()
		# a pie junto al carro: el aviso "F · Subir al …"
		var car: Vehicle = _main.vehicle
		_main.player.place(car.global_position.x - car.global_basis.x.x * 2.5, car.global_position.z - car.global_basis.x.z * 2.5)
		await get_tree().create_timer(1.5).timeout
		await _shot("hud_a_pie")
		# ficha de lo que se mira
		_main.camera_rig.yaw += PI * 0.5
		await get_tree().create_timer(0.3).timeout
		_main._show_info()
		await get_tree().create_timer(0.5).timeout
		await _shot("info")
		_main.hud.toggle_help()
		await get_tree().create_timer(0.3).timeout
		await _shot("ayuda")
		_main.hud.toggle_help()
		# manejando, con el velocímetro
		var sp: Dictionary = WorldData.spawn()
		_main.vehicle.place(sp.x, sp.z, sp.heading + PI)
		await get_tree().create_timer(0.5).timeout
		_main._enter_vehicle()
		_main.camera_rig.follow(_main.vehicle, 3.6, 1.2)
		_main.camera_rig.yaw = _main.vehicle.rotation.y + PI * 0.5 # de lado, por la puerta del conductor
		_main.camera_rig.pitch = -0.15
		await get_tree().create_timer(1.0).timeout
		await _shot("conductor")
		var body: Node3D = _main.vehicle.get_node("modelo/body")
		body.visible = false # corte: ver la postura dentro del vehículo
		await get_tree().create_timer(0.3).timeout
		await _shot("conductor_corte")
		body.visible = true
		_main._follow_camera()
		Input.action_press("move_forward")
		await get_tree().create_timer(3.0).timeout
		await _shot("manejando")
		var bus := AudioServer.get_bus_index("Mundo")
		print("audio: motor %.1f Hz · pico del bus Mundo %.1f dB · driver %s" % [_main._audio._freq, AudioServer.get_bus_peak_volume_left_db(bus, 0), AudioServer.get_driver_name() if AudioServer.has_method("get_driver_name") else ProjectSettings.get_setting("audio/driver/driver")])
		Input.action_release("move_forward")
		_main._cam_mode = 2
		_main._follow_camera()
		await get_tree().create_timer(1.5).timeout
		await _shot("aerea")
		_main._cam_mode = 0
		_main._follow_camera()
		_main._pause()
		await get_tree().create_timer(0.5).timeout
		await _shot("pausa")
	if _want("pies"):
		await _feet_shots()
	if _want("banca"):
		await _bench_shots()
	if _want("subir"):
		await _mount_shots()
	if _want("faros"):
		await _lights_shots()
	if _want("tomar"):
		await _take_shots()
	if _want("ambiente"):
		await _ambience_shots()
	if _want("combate"):
		await _combat_shots()
	if _want("botin"):
		await _loot_shots()
	if _want("disparos"):
		await _gun_shots()
	if _want("criaturas"):
		await _creature_shots()
	if _want("monte"):
		await _monte_shots()
	if _want("uno"):
		await _one_by_one()
	get_tree().quit()


## Combate: machete en mano, un centinela delante. Captura la guardia, el golpe, el blanco fijado y el rodar, e
## imprime la vida de los dos para comprobar que el golpe entra (y que el enemigo también pega).
func _combat_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	seed(1234) # el azar de la IA (esquivas, pausas) igual en cada corrida
	var player: Player = _main.player
	var sp: Dictionary = WorldData.spawn()
	player.place(sp.x, sp.z, sp.heading)
	await get_tree().create_timer(1.0).timeout
	# agarre de cada arma: de cerca, de lado, en la guardia quieta
	var cam := Camera3D.new()
	cam.fov = 40
	add_child(cam)
	for i in CombatConfig.ARSENAL.size():
		if i == 0:
			continue
		InventorySystem.instance.add(CombatConfig.ARSENAL[i], 1) # las que no son de serie hay que tenerlas
		player._weapon = CombatConfig.ARSENAL[i]
		player.set_armed(true)
		await get_tree().create_timer(0.5).timeout
		var side := player.global_basis.x
		cam.global_position = player.global_position + side * 1.6 - player.global_basis.z * 0.9 + Vector3.UP * 1.3
		cam.look_at(player.global_position + Vector3.UP * 1.0)
		cam.make_current()
		await _shot("agarre_" + CombatConfig.ARSENAL[i])
		var slot: Node3D = player._weapon_slot
		if slot and slot.get_child_count() > 0:
			var wb: Basis = (slot.get_child(0) as Node3D).global_basis
			var fwd := -player.global_basis.z
			print("agarre %s: hoja (+Y) arriba=%.2f adelante=%.2f · filo (+X) arriba=%.2f adelante=%.2f" % [CombatConfig.ARSENAL[i],
				wb.y.normalized().y, wb.y.normalized().dot(fwd), wb.x.normalized().y, wb.x.normalized().dot(fwd)])
	cam.queue_free()
	_main.camera_rig.camera.make_current()
	player._weapon = "machete"
	player.set_armed(true)
	var fwd := -player.global_basis.z
	var at := player.global_position + fwd * 6.0
	var enemy: Enemy = _main.factions.spawn("centinela", at)
	_main.camera_rig.yaw = player.rotation.y + 0.5
	_main.camera_rig.pitch = -0.2
	await get_tree().create_timer(1.5).timeout
	await _shot("combate_guardia")
	_main.combat.toggle_lock(player.combat, player.rotation.y)
	print("combate: blanco fijado = %s" % (player.combat.lock_target != null))
	# esperar a que se acerque a distancia de golpe
	var t0 := Engine.get_physics_frames()
	while enemy.dist > 2.2 and Engine.get_physics_frames() - t0 < 600:
		await get_tree().physics_frame
	print("combate: el centinela llegó a %.1f m" % enemy.dist)
	var h0 := enemy.self_c.health
	player.combat.attack()
	var f0 := Engine.get_physics_frames()
	while Engine.get_physics_frames() - f0 < 14:
		await get_tree().physics_frame
	await _shot("combate_golpe")
	while player.combat.is_busy():
		await get_tree().physics_frame
	print("combate: vida del centinela %.0f → %.0f" % [h0, enemy.self_c.health])
	await _shot("combate_blanco")
	var ph := player.combat.health
	f0 = Engine.get_physics_frames()
	while Engine.get_physics_frames() - f0 < 240 and player.combat.health >= ph:
		await get_tree().physics_frame
	print("combate: vida del jugador %.0f → %.0f" % [ph, player.combat.health])
	player._roll()
	f0 = Engine.get_physics_frames()
	while Engine.get_physics_frames() - f0 < 12:
		await get_tree().physics_frame
	await _shot("combate_rodar")
	# rematar: golpes hasta que caiga
	for i in 12:
		while player.combat.is_busy():
			await get_tree().physics_frame
		if not enemy.self_c.is_alive():
			break
		while player.combat.stamina < float(player.combat.weapon.stamina):
			await get_tree().physics_frame
		var to := enemy.global_position - player.global_position
		to.y = 0.0
		if to.length() > 1.6: # se apartó (rodando o empujado): acercarse a distancia de golpe
			player.global_position = enemy.global_position - to.normalized() * 1.4
		player.rotation.y = atan2(-to.x, -to.z)
		var ok := player.combat.attack()
		print("  golpe %d: pudo=%s dist=%.2f estado_enemigo=%d vida=%.0f resistencia=%.0f" % [i, ok, to.length(), enemy.self_c.state, enemy.self_c.health, player.combat.stamina])
		await get_tree().physics_frame
	await get_tree().create_timer(1.5).timeout
	print("combate: centinela vivo = %s, vida %.0f" % [enemy.self_c.is_alive(), enemy.self_c.health])
	await _shot("combate_caido")
	# manada: tres a la vez; solo dos deben ir a pegar, el otro rodea
	player.combat.revive()
	var pack := []
	for k in 3:
		var a := player.rotation.y + (k - 1) * 0.8
		var q := player.global_position + Vector3(-sin(a), 0, -cos(a)) * 9.0
		pack.push_back(_main.factions.spawn(["centinela", "machetero", "cabo"][k], q))
	_main.camera_rig.pitch = -0.45
	var f1 := Engine.get_physics_frames()
	var most := 0
	while Engine.get_physics_frames() - f1 < 300:
		await get_tree().physics_frame
		var near := pack.filter(func(e): return e.dist < 2.3).size()
		most = maxi(most, near)
	print("combate: manada — a la vez cerca del jugador como mucho %d de 3; turnos ocupados %d" % [most, _main.combat._attackers.size()])
	await _shot("combate_manada")
	for e in pack:
		e.queue_free()
	await get_tree().physics_frame
	# parry: un machetero delante; guardia justo antes de que llegue su golpe
	player.combat.revive()
	await get_tree().create_timer(2.2).timeout # revive deja 2 s de invulnerabilidad
	var m: Enemy = _main.factions.spawn("machetero", player.global_position - player.global_basis.z * 2.5)
	m.ai = m.ai.duplicate()
	m.ai.block = 0.0
	await get_tree().create_timer(1.0).timeout
	# de frente a 1,6 m, y que lance el golpe ya (sin depender de dónde lo dejó la IA)
	var front := -player.global_basis.z
	m.global_position = player.global_position + front * 1.6
	m.rotation.y = atan2(front.x, front.z)
	m._next_swing = 1e9
	await get_tree().physics_frame
	m.self_c.attack()
	# su preparación dura windup s: levantar la guardia 0,1 s antes del golpe
	# (se mira lo que le falta al golpe, no cuadros: durante el hitstop el tiempo del juego va más lento)
	var fw := Engine.get_physics_frames()
	while m.self_c.phase == "windup" and m.self_c._timer > 0.1:
		await get_tree().physics_frame
	var hp := player.combat.health
	print("combate: parry — el machetero empieza su golpe a %.2f m (alcance %.1f), jugador ocupado=%s" % [m.dist, m.self_c.weapon.reach, player.combat.is_busy()])
	player.combat.set_guard(true)
	print("combate: parry — guardia=%s ventana=%s" % [player.combat.guarding, player.combat.in_parry_window()])
	fw = Engine.get_physics_frames()
	while Engine.get_physics_frames() - fw < 40 and m.self_c.state != Combatant.State.HIT:
		await get_tree().physics_frame
	var stunned := m.self_c.state == Combatant.State.HIT
	await get_tree().process_frame
	await _shot("combate_parry")
	print("combate: parry — vida del jugador %.0f → %.0f, machetero aturdido = %s" % [hp, player.combat.health, stunned])
	player.combat.set_guard(false)
	var mh := m.self_c.health
	var to2 := m.global_position - player.global_position
	player.rotation.y = atan2(-to2.x, -to2.z)
	player.combat.attack()
	while player.combat.is_busy():
		await get_tree().physics_frame
	print("combate: contraataque — vida del machetero %.0f → %.0f (sin parry el machete quita 26)" % [mh, m.self_c.health])
	# recibir: sin cubrirse, que le pegue; cuánto retrocede
	var p0 := player.global_position
	hp = player.combat.health
	fw = Engine.get_physics_frames()
	while Engine.get_physics_frames() - fw < 400 and player.combat.health >= hp:
		await get_tree().physics_frame
	fw = Engine.get_physics_frames()
	while Engine.get_physics_frames() - fw < 8:
		await get_tree().physics_frame
	await _shot("combate_recibe")
	while Engine.get_physics_frames() - fw < 30:
		await get_tree().physics_frame
	print("combate: recibe — vida %.0f → %.0f, retrocede %.2f m, estado %d" % [hp, player.combat.health, Vector2(player.global_position.x - p0.x, player.global_position.z - p0.z).length(), player.combat.state])


## Uno a uno: cada criatura frente al jugador (armado), cada uno de sus ataques forzado a su distancia. Imprime si
## salió, el daño al jugador, el estado y el efecto; captura el momento del golpe (screenshots/menu_uno_<id>_<ataque>).
func _one_by_one() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	seed(3)
	var player: Player = _main.player
	var cs: CreatureSystem = _main.creatures
	cs.set_process(false)
	var sp: Dictionary = WorldData.spawn()
	player.place(sp.x, sp.z, sp.heading)
	await get_tree().create_timer(1.0).timeout
	player.set_armed(true)
	var cam := Camera3D.new()
	cam.fov = 55
	add_child(cam)
	for kind: String in CreaturesConfig.CREATURES:
		var spec: Dictionary = CreaturesConfig.CREATURES[kind]
		var fwd := -player.global_basis.z
		var c: Creature = cs.spawn(kind, player.global_position + fwd * 4.0)
		if c == null:
			print("uno: falta %s" % kind)
			continue
		await get_tree().physics_frame
		for a: Dictionary in spec.get("attacks", []):
			var d := clampf((float(a.range[0]) + minf(float(a.range[1]), 10.0)) * 0.5, 1.2, 9.0)
			var at := player.global_position + fwd * d
			c.global_position = Vector3(at.x, WorldData.height(at.x, at.z) + 0.1, at.z)
			c.rotation.y = player.rotation.y + PI
			c.self_c.revive()
			c.self_c._invulnerable = 0.0
			player.combat.revive()
			player.combat._invulnerable = 0.0
			player.combat.set_guard(false)
			c.target = player.combat
			c.dist = d
			c._cool.clear()
			var h0 := player.combat.health
			var ok := c._start(a)
			for o: Dictionary in spec.get("attacks", []):   # que no lance otro mientras se mide este
				c._cool[o.id] = c._time + 999.0
			var shot := false
			var f0 := Engine.get_physics_frames()
			while Engine.get_physics_frames() - f0 < 300 and c.self_c.state == Combatant.State.ATTACK:
				if not shot and c.self_c.phase == "active":
					shot = true
					var h := float(spec.height)
					cam.global_position = player.global_position + player.global_basis.x * (2.5 + h) - fwd * 1.5 + Vector3.UP * (1.2 + h * 0.5)
					cam.look_at((player.global_position + c.global_position) * 0.5 + Vector3.UP * h * 0.5)
					cam.make_current()
					await _shot("uno_%s_%s" % [kind, a.id])
				await get_tree().physics_frame
			print("uno: %-14s %-10s salió=%s · daño al jugador %.0f · animación %s · efecto %s" % [kind, a.id, ok, h0 - player.combat.health,
				a.get("clip", a.get("proc", "-")), a.get("effect", "-")])
			_main.camera_rig.camera.make_current()
		# muerte
		c.self_c.take_hit(99999.0, 0.0)
		await get_tree().create_timer(1.5).timeout
		cam.global_position = c.global_position + Vector3(3.0 + float(spec.height), 1.5 + float(spec.height) * 0.5, 2.0)
		cam.look_at(c.global_position + Vector3.UP * 0.3)
		cam.make_current()
		await _shot("uno_%s_muerte" % kind)
		print("uno: %-14s muerte     estado=%s" % [kind, c.state])
		_main.camera_rig.camera.make_current()
		c.queue_free()
		for o in cs._alive:
			if is_instance_valid(o) and o != c:
				o.queue_free()
		await get_tree().physics_frame
	cam.queue_free()
	cs.set_process(true)


## Comportamiento del monte y de las bases: la jauría ataca, el Hojarasquín solo mira si el arma va guardada y
## ataca si va en la mano, el saqueador dispara, la jefa muestra su barra. Y los créditos de los modelos.
func _monte_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	seed(9)
	var player: Player = _main.player
	var cs: CreatureSystem = _main.creatures
	cs.set_process(false)   # sin apariciones al azar durante la prueba
	var sp: Dictionary = WorldData.spawn()
	player.place(sp.x, sp.z, sp.heading)
	await get_tree().create_timer(1.0).timeout
	var fwd := -player.global_basis.z
	var wait := func(frames: int) -> void:
		var f0 := Engine.get_physics_frames()
		while Engine.get_physics_frames() - f0 < frames:
			await get_tree().physics_frame
	# jauría
	var h0 := player.combat.health
	var pack := []
	for i in 3:
		pack.push_back(cs.spawn("lobo", player.global_position + fwd * 10.0 + player.global_basis.x * (i - 1) * 1.5))
	await wait.call(360)
	print("monte: jauría — vida del jugador %.0f → %.0f" % [h0, player.combat.health])
	_main.camera_rig.yaw = player.rotation.y
	await _shot("monte_jauria")
	for w in pack:
		w.queue_free()
	player.combat.revive()
	await get_tree().create_timer(2.2).timeout
	# Hojarasquín: sin arma, luego con arma
	var hj: Creature = cs.spawn("hojarasquin", player.global_position + fwd * 6.0)
	player.set_armed(false)
	h0 = player.combat.health
	await wait.call(240)
	print("monte: Hojarasquín con el arma guardada — vida %.0f → %.0f, distancia %.1f m" % [h0, player.combat.health, hj.dist])
	await _shot("monte_hojarasquin_mira")
	player.set_armed(true)
	await wait.call(360)
	print("monte: Hojarasquín con el arma en la mano — vida %.0f → %.0f" % [h0, player.combat.health])
	hj.queue_free()
	player.combat.revive()
	await get_tree().create_timer(2.2).timeout
	# saqueador
	var sq: Creature = cs.spawn("saqueador", player.global_position + fwd * 14.0)
	h0 = player.combat.health
	await wait.call(420)
	print("monte: saqueador — vida del jugador %.0f → %.0f" % [h0, player.combat.health])
	await _shot("monte_saqueador")
	sq.queue_free()
	# jefa
	var boss: Creature = cs.spawn("jefa-agris", player.global_position + fwd * 12.0)
	await wait.call(90)
	print("monte: barra de jefe visible = %s (%s)" % [_main.hud._boss_box.visible, _main.hud._boss_name.text])
	await _shot("monte_jefa")
	boss.queue_free()
	cs.set_process(true)
	_main._menus.open("creditos")
	await get_tree().create_timer(0.6).timeout
	await _shot("monte_creditos")


## Criaturas externas (CreaturesConfig) en fila, caminando: para ver escala, orientación y que el retarget de los
## humanoides mueve bien el esqueleto. Imprime el alto medido de cada una.
func _creature_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	var player: Player = _main.player
	var sp: Dictionary = WorldData.spawn()
	player.place(sp.x, sp.z, sp.heading)
	await get_tree().create_timer(1.0).timeout
	var fwd := -player.global_basis.z
	var right := player.global_basis.x
	var ids: Array = CreaturesConfig.CREATURES.keys()
	var made := []
	for i in ids.size():
		var m: Dictionary = CreatureModel.create(ids[i])
		if m.is_empty():
			print("criaturas: falta %s" % ids[i])
			continue
		var at: Vector3 = player.global_position + fwd * 9.0 + right * (i - (ids.size() - 1) / 2.0) * 3.6
		m.root.position = Vector3(at.x, WorldData.height(at.x, at.z), at.z)
		m.root.rotation.y = player.rotation.y + PI * 0.5   # de perfil a la cámara
		add_child(m.root)
		if m.clips.has("walk"):
			m.anim.play(m.clips.walk)
		made.push_back(m)
		var aabb := AABB()
		var first := true
		for mi: MeshInstance3D in m.root.find_children("*", "MeshInstance3D", true, false):
			var b := mi.global_transform * mi.get_aabb()
			aabb = b if first else aabb.merge(b)
			first = false
		print("criaturas: %s — clips %s · caja %s, de y=%.2f a %.2f sobre el suelo · escala %s" % [ids[i], m.clips.keys(), aabb.size.snapped(Vector3.ONE * 0.01),
			aabb.position.y - m.root.position.y, aabb.end.y - m.root.position.y, (m.root.get_child(0) as Node3D).scale.x])
	# una por una, de cerca: misma escena, cámara a 2,2 × su alto
	for m in made:
		m.root.visible = false
	var solo := Camera3D.new()
	solo.fov = 45
	add_child(solo)
	solo.make_current()
	for m in made:
		m.root.visible = true
		var h: float = m.spec.height
		var at2: Vector3 = player.global_position + fwd * 6.0
		m.root.global_position = Vector3(at2.x, WorldData.height(at2.x, at2.z), at2.z)
		solo.global_position = m.root.global_position - fwd * (2.6 * h + 1.0) + right * (1.2 * h) + Vector3.UP * (0.8 * h)
		solo.look_at(m.root.global_position + Vector3.UP * (0.5 * h))
		await get_tree().create_timer(0.6).timeout
		await _shot("criatura_" + String(m.root.name))
		m.root.visible = false
	solo.queue_free()
	for m in made:
		m.root.visible = true
	var cam := Camera3D.new()
	cam.fov = 60
	add_child(cam)
	cam.global_position = player.global_position - fwd * 14.0 + Vector3.UP * 4.0
	cam.look_at(player.global_position + fwd * 9.0 + Vector3.UP * 1.0)
	cam.make_current()
	await get_tree().create_timer(1.5).timeout
	await _shot("criaturas_fila")
	cam.queue_free()
	for m in made:
		m.root.queue_free()


## Disparos: pistola, escopeta y fusil con su munición contra un centinela a 10 m; hacia dónde apunta el cañón,
## si la mano izquierda llega al guardamanos, y la vida que le quita cada uno.
func _gun_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	seed(5)
	var player: Player = _main.player
	var inv := InventorySystem.instance
	var sp: Dictionary = WorldData.spawn()
	player.place(sp.x, sp.z, sp.heading)
	await get_tree().create_timer(1.0).timeout
	for id in ["pistola", "escopeta", "fusil"]:
		var f: Dictionary = FirearmsConfig.FIREARMS[id]
		inv.add(id, 1)
		inv.add(f.ammo, int(f.magazine) * 2)
		player._weapon = id
		player.set_armed(true)
		player.reload()
		while player._reload_t > 0.0:
			await get_tree().physics_frame
		var front := -player.global_basis.z
		var e: Enemy = _main.factions.spawn("cabo", player.global_position + front * 10.0)
		e.ai = e.ai.duplicate()
		e.ai.sight = 0.0
		e.ai.hearing = 0.0
		e.ai.block = 0.0
		_main.camera_rig.yaw = player.rotation.y
		_main.camera_rig.pitch = -0.08
		player.aiming = true
		await get_tree().create_timer(0.9).timeout
		# pose de apuntar, de cerca y de lado
		var cam := Camera3D.new()
		cam.fov = 40
		add_child(cam)
		# armas largas: desde la izquierda, para ver la mano en el guardamanos
		var side := player.global_basis.x * (-1.0 if FirearmsConfig.FIREARMS[id].get("long", false) else 1.0)
		cam.global_position = player.global_position + side * 2.0 - player.global_basis.z * 0.6 + Vector3.UP * 1.5
		cam.look_at(player.global_position + Vector3.UP * 1.3 - player.global_basis.z * 0.3)
		cam.make_current()
		await get_tree().process_frame
		var muzzle: Vector3 = player._gun.muzzle.global_position
		var grip: Vector3 = player._gun.slot.global_position
		var barrel := (muzzle - grip).normalized()
		var fwd := -player.global_basis.z
		print("disparos %s: cañón adelante=%.2f arriba=%.2f · cargador %s" % [id, barrel.dot(fwd), barrel.y, player.ammo()])
		await _shot("disparos_pose_" + id)
		if player._rig:
			var r: CharacterRig = player._rig
			print("  rig: manos con objetivo izq=%s der=%s" % [r.left_hand_target != null, r.right_hand_target != null])
		cam.queue_free()
		_main.camera_rig.camera.make_current()
		# con el blanco fijado el tiro va a su pecho
		_main.combat.toggle_lock(player.combat, player.rotation.y)
		var h0 := e.self_c.health
		for k in 3:
			player._shot_queued = true
			player._trigger = true
			var f0 := Engine.get_physics_frames()
			while Engine.get_physics_frames() - f0 < 4:
				await get_tree().physics_frame
			if k == 0:
				await _shot("disparos_" + id)
			player._trigger = false
			while player._cooldown > 0.0:
				await get_tree().physics_frame
		if player.combat.lock_target:
			_main.combat.toggle_lock(player.combat, 0.0)
		if player._gun.get("handguard"):
			var lh: Vector3 = player._model.find_child(CharacterModel.SKELETON, true, false).get_bone_global_pose(player._model.find_child(CharacterModel.SKELETON, true, false).find_bone("LeftHand")).origin
			var skel: Skeleton3D = player._model.find_child(CharacterModel.SKELETON, true, false)
			print("disparos %s: mano izquierda a %.2f m del guardamanos" % [id, (skel.global_transform * lh).distance_to(player._gun.handguard.global_position)])
		print("disparos %s: vida del cabo %.0f → %.0f, cargador %s" % [id, h0, e.self_c.health, player.ammo()])
		player.aiming = false
		e.queue_free()
		await get_tree().create_timer(0.5).timeout


## Botín: el contenedor más cercano al Parque (de un lugar real), registrarlo, la mochila abierta, y lo que suelta
## un centinela al caer (su peinilla, que entra al arsenal).
func _loot_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	seed(77)
	var player: Player = _main.player
	var loot: LootSystem = _main.loot
	var sp: Dictionary = WorldData.spawn()
	var best := {}
	var bd := INF
	for c: Dictionary in loot.containers:
		var d := Vector2(c.x0 - sp.x, c.z0 - sp.z).length()
		if d < bd:
			bd = d
			best = c
	print("botín: %d contenedores en el mapa; el más cercano: %s (%s) a %.0f m" % [loot.containers.size(), best.spec.name, best.place, bd])
	await _main.teleport(best.x0 + 2.5, best.z0)
	await get_tree().create_timer(3.0).timeout
	loot._t = 0.0
	await get_tree().create_timer(0.8).timeout
	var c: Dictionary = best
	player.place(c.get("x", c.x0) + 1.2, c.get("z", c.z0))
	var to := Vector3(c.get("x", c.x0), 0, c.get("z", c.z0)) - player.global_position
	player.rotation.y = atan2(-to.x, -to.z)
	_main.camera_rig.yaw = player.rotation.y + 0.6
	await get_tree().create_timer(1.0).timeout
	var it: Array = _main._interaction()
	print("botín: interacción = %s" % (it[1] if not it.is_empty() else "ninguna"))
	await _shot("botin_contenedor")
	if not it.is_empty():
		it[2].call()
	await get_tree().create_timer(0.5).timeout
	print("botín: mochila %s, %.1f kg" % [InventorySystem.instance.items, InventorySystem.instance.weight()])
	# centinela: derribarlo y registrar lo que suelta
	var e: Enemy = _main.factions.spawn("centinela", player.global_position - player.global_basis.z * 3.0)
	await get_tree().physics_frame
	e.self_c.take_hit(999.0, 0.0)
	await get_tree().create_timer(1.0).timeout
	var drop: Dictionary = loot.nearest(e.global_position)
	print("botín: soltó %s" % [drop.items if not drop.is_empty() else "nada"])
	if not drop.is_empty():
		player.place(drop.x + 1.0, drop.z)
		loot.search(drop)
	print("botín: arsenal = %s" % [InventorySystem.instance.arsenal()])
	_main.inventory_panel.toggle(1)
	await get_tree().create_timer(0.5).timeout
	await _shot("botin_mochila")
	_main.inventory_panel.toggle(0)


## Ambiente: busca un sitio con árboles cerca del parque y lo retrata de noche (luciérnagas), de día (hojas,
## motas) y en la mañana de niebla (bruma). Imprime cuántas partículas pide cada familia.
func _ambience_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	var sp: Dictionary = WorldData.spawn()
	var best := Vector2(sp.x, sp.z)
	var most := -1
	for i in 60:
		var a := i * 2.4
		var r := 30.0 + i * 6.0
		var c := Vector2(sp.x + cos(a) * r, sp.z + sin(a) * r)
		var n: int = _main.streamer.trees_near(c.x, c.y, 25.0)
		if n > most:
			most = n
			best = c
	print("ambiente: %d árboles a 25 m de %s" % [most, best])
	var player: Player = _main.player
	player.place(best.x, best.y)
	_main.camera_rig.pitch = -0.15
	for h: Array in [[21.5, "noche"], [12.0, "dia"], [6.8, "bruma"]]:
		_main.sky.set_hour(h[0])
		await get_tree().create_timer(6.0).timeout
		var amb: AmbienceSystem = _main._ambience
		var txt := ""
		for fam: String in amb._emitters:
			txt += " %s=%.2f" % [fam, amb._emitters[fam].amount_ratio]
		print("ambiente %s:%s" % [h[1], txt])
		await _shot("ambiente_" + h[1])


## Pies sobre escalones: de pie en mitad de la gradería del coliseo, de lado, con y sin el ajuste de piernas.
## Imprime la altura de cada pie sobre el suelo que tiene debajo (con el ajuste debe quedar cerca de 0,1 m, el
## tobillo).
func _feet_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	var lm: LandmarkSystem = _main.landmarks
	var pie: Node3D = lm.find_child("gradas_coliseo_pie", true, false)
	var top: Node3D = lm.find_child("gradas_coliseo_arriba", true, false)
	if pie == null or top == null:
		print("pies: no está la gradería del coliseo")
		return
	var p := pie.global_position.lerp(top.global_position, 0.35)
	var player: Player = _main.player
	player.place(p.x, p.z)
	player.global_position.y = p.y + 0.6
	var d := top.global_position - pie.global_position
	player.rotation.y = atan2(-d.x, -d.z) + 0.25
	_main.camera_rig.yaw = player.rotation.y + PI * 0.5
	_main.camera_rig.pitch = -0.1
	for on in [false, true]:
		player._rig.active = on
		player._rig._ik.active = on
		await get_tree().create_timer(1.5).timeout
		var skel: Skeleton3D = player._model.find_child(CharacterModel.SKELETON, true, false)
		var space := player.get_world_3d().direct_space_state
		for side in ["LeftFoot", "RightFoot"]:
			var f: Vector3 = skel.global_transform * skel.get_bone_global_pose(skel.find_bone(side)).origin
			var hit := space.intersect_ray(PhysicsRayQueryParameters3D.create(f + Vector3.UP * 0.6, f + Vector3.DOWN * 1.5, 1 | 16, [player.get_rid()]))
			print("pies %s: %s sobre el suelo %.2f m" % ["con ajuste" if on else "sin ajuste", side, f.y - hit.position.y if hit else -1.0])
		await _shot("pies_" + ("ajuste" if on else "sin"))


## Bancas del parque: sentarse (clip de entrar y quieto) y levantarse, de tres cuartos.
func _bench_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	var lm: LandmarkSystem = _main.landmarks
	while not lm.is_ready():
		await get_tree().process_frame
	if lm.seats.is_empty():
		print("banca: no hay asientos")
		return
	var st: Dictionary = lm.seats[0]
	var player: Player = _main.player
	player.place(st.x + 0.7, st.z + 0.7)
	await get_tree().create_timer(0.5).timeout
	print("banca: opción = ", _main._interaction()[1] if not _main._interaction().is_empty() else "ninguna")
	player.sit(st)
	_main.camera_rig.yaw = float(st.heading) + 0.7 # de frente-lado
	_main.camera_rig.pitch = -0.15
	await get_tree().create_timer(2.5).timeout
	await _shot("banca_sentado")
	player.stand()
	await get_tree().create_timer(2.0).timeout
	print("banca: de pie en el suelo = %s, a %.2f m del asiento" % [player.is_on_floor(), Vector2(player.global_position.x - st.x, player.global_position.z - st.z).length()])
	await _shot("banca_de_pie")


## Subir y bajar del vehículo con la coreografía (caminar a la puerta, abrir, sentarse; y al revés), en los que
## tienen puerta (taxi, camioneta) y el de vano abierto (Willys).
func _mount_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	_main.skip_mount = false
	# sin tráfico: un carro que pase por el punto donde se coloca el vehículo lo dispara (cuerpo cinemático)
	_main.traffic.density = 0.0
	for c: Dictionary in _main.traffic._cars.duplicate():
		_main.traffic.take_car(c)
	var sp: Dictionary = WorldData.spawn()
	for type in (["moto"] if "moto" in _only else ["taxi", "pickup", "willys", "chiva", "sedan"]):
		# el jugador lejos antes de colocar el vehículo, y un cuadro de física para que el servidor lo sepa: encimados,
		# la física dispara al vehículo (una moto salió a 65 m/s)
		_main.player.place(sp.x + 15.0, sp.z + 15.0)
		await get_tree().physics_frame
		await get_tree().physics_frame
		_main.set_vehicle(type)
		var car: Vehicle = _main.vehicle
		car.place(sp.x, sp.z, sp.heading)
		await get_tree().create_timer(1.0).timeout
		var player: Player = _main.player
		var d := car.door_world()
		var out := Vector3(d.x - car.global_position.x, 0, d.z - car.global_position.z).normalized()
		player.place(d.x + out.x * 2.0 + car.global_basis.z.x * 1.5, d.z + out.z * 2.0 + car.global_basis.z.z * 1.5)
		# cámara fija al costado del conductor, un poco adelante, a la altura de los ojos
		var cam := Camera3D.new()
		cam.fov = 50
		add_child(cam)
		cam.global_position = d + out * 3.6 - car.global_basis.z * 1.8 + Vector3.UP * 1.5
		cam.look_at(d - out * 0.6 + Vector3.UP * 0.9)
		if type == "moto": # de frente en diagonal: el costado puede quedar contra una fachada
			var seat := car.seat_world()
			var cp := seat + car.global_basis.z * 3.2 + out * 1.6
			cam.global_position = Vector3(cp.x, WorldData.height(cp.x, cp.z) + 1.3, cp.z)
			cam.look_at(seat + Vector3.UP * 0.5)
		if type == "chiva": # grande: de más lejos y más alto, para ver el estribo y la cabina
			cam.global_position = d + out * 3.5 - car.global_basis.z * 3.5 + Vector3.UP * 4.5
			cam.look_at(d - out * 0.4 + Vector3.UP * 1.0)
		cam.make_current()
		if type == "moto": # tumbada de lado, como queda si la empujan: el personaje la levanta antes de montarse
			car.teleport(car.global_transform.rotated_local(Vector3.FORWARD, 1.35).translated(Vector3.DOWN * 0.3))
		await get_tree().create_timer(0.8).timeout
		if type == "moto":
			print("  moto caída = %s" % car.is_fallen())
			await _shot("subir_moto_caida")
		_main._enter_vehicle()
		var t0 := Time.get_ticks_msec()
		var shots := ({1.4: "puerta", 2.3: "sienta"} if type != "chiva" else {1.3: "camina", 2.0: "estribo", 2.6: "sienta"}) if type != "moto" else {1.0: "levanta", 3.4: "pierna1", 3.9: "pierna2"}
		for at: float in shots:
			while (Time.get_ticks_msec() - t0) / 1000.0 < at:
				await get_tree().process_frame
			await _shot("subir_%s_%s" % [type, shots[at]])
		while player.is_mounting():
			await get_tree().process_frame
		await get_tree().create_timer(0.6).timeout
		print("subir %s: %.1f s, manejando = %s" % [type, (Time.get_ticks_msec() - t0) / 1000.0, _main._driving])
		await _shot("subir_%s_listo" % type)
		_main._exit_vehicle()
		while player.is_mounting():
			await get_tree().process_frame
		await get_tree().create_timer(0.6).timeout
		print("bajar %s: en el suelo = %s" % [type, player.is_on_floor()])
		await _shot("subir_%s_bajo" % type)
		cam.queue_free()
	_main.skip_mount = true


## Faros de noche: manejando por la calle, cámara detrás.
func _lights_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	var sp: Dictionary = WorldData.spawn()
	_main.vehicle.place(sp.x, sp.z, sp.heading)
	await get_tree().create_timer(0.5).timeout
	_main._enter_vehicle()
	_main.sky.set_hour(21.0)
	_main._cam_mode = 0
	_main._follow_camera()
	await get_tree().create_timer(2.0).timeout
	print("faros: noche %.2f, energía %.1f" % [_main.sky.night, _main.vehicle._lamp.light_energy if _main.vehicle._lamp else -1.0])
	await _shot("faros_noche")
	_main.sky.set_hour(10.0)


## Tomar un vehículo del tráfico: junto a uno, la interacción ofrece tomarlo y se sube con la coreografía.
func _take_shots() -> void:
	if _main.state != _main.State.PLAYING:
		_main._start_playing()
	_main.skip_mount = false
	var tr: TrafficSystem = _main.traffic
	while tr.count() < 4:
		await get_tree().process_frame
	var car: Dictionary = tr._cars[0]
	var body: Node3D = car.body
	var side := body.global_basis.x * 2.4
	_main.player.place(body.global_position.x + side.x, body.global_position.z + side.z)
	_main.vehicle.place(body.global_position.x + 40.0, body.global_position.z + 40.0) # el propio, lejos
	await get_tree().physics_frame
	var it: Array = _main._interaction()
	print("tomar: opción = ", it[1] if not it.is_empty() else "ninguna")
	if it.is_empty():
		_main.skip_mount = true
		return
	(it[2] as Callable).call()
	await get_tree().create_timer(1.2).timeout
	await _shot("tomar_subiendo")
	while _main.player.is_mounting():
		await get_tree().process_frame
	print("tomar: manejando un %s = %s (tráfico: %d)" % [_main.vehicle.spec.type, _main._driving, tr.count()])
	await get_tree().create_timer(0.5).timeout
	await _shot("tomar_manejando")
	_main.skip_mount = true


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://screenshots")
	get_viewport().get_texture().get_image().save_png("res://screenshots/menu_%s.png" % name)
