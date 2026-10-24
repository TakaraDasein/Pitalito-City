class_name BridgeBuilder
## Puentes sobre los ríos (ver BridgesConfig): tablero de concreto con andenes, rampas a la calle, barandas
## amarillas y negras sobre la defensa metálica gris, y pasarelas peatonales de acero con estribos de concreto.
## Devuelve geometría (MeshBatch por material), cajas de colisión y las zonas donde el suelo es el tablero (para el
## tráfico, que si no pasaría por debajo).
## Las barandas se arman con bandas alternas: los colores son de la foto del usuario.

const YELLOW := Color("#e2b21c")
const BLACK := Color("#1d1d1d")
const STEEL := Color("#9aa0a4")
const CONCRETE := Color("#b9b4ab")


class Out:
	var batch := MeshBatch.new()    # todo con colores de vértice
	var boxes := []                 # [Transform3D, Vector3]
	var decks := []                 # { a: Vector2, b: Vector2, hw, y0 (en a), y1 (en b), y_mid } a lo largo del eje
	var footbridges := []           # { center: Vector3, a: Vector2, b: Vector2 } (pie de cada escalera)


## `crossings`: [{ point: Vector2, dir: Vector2 (de la vía), hw (media calzada), river_hw, surface, name }]
static func build(crossings: Array, foot: Array) -> Out:
	var out := Out.new()
	for c: Dictionary in crossings:
		_road_bridge(out, c)
	for f: Dictionary in foot:
		_footbridge(out, f)
	return out


static func _basis(dir: Vector2) -> Basis:
	var z := Vector3(dir.x, 0, dir.y)
	return Basis(Vector3.UP.cross(z), Vector3.UP, z)


static func _box(out: Out, xf: Transform3D, size: Vector3, color: Color, solid := true) -> void:
	ModularBuilder._box_mesh(out.batch, xf, size, color)
	if solid:
		out.boxes.push_back([xf, size])


static func _road_bridge(out: Out, c: Dictionary) -> void:
	var p: Vector2 = c.point
	var d: Vector2 = c.dir
	var hw: float = c.hw + BridgesConfig.SIDEWALK
	var half_span: float = c.river_hw + BridgesConfig.ABUTMENT
	var top: float = c.surface + BridgesConfig.CLEARANCE
	var basis := _basis(d)
	var side := Vector2(-d.y, d.x)
	# tablero y andenes (andén 15 cm más alto)
	_box(out, Transform3D(basis, Vector3(p.x, top - BridgesConfig.DECK_T * 0.5, p.y)), Vector3(hw * 2.0, BridgesConfig.DECK_T, half_span * 2.0), Color("#6e6e6c"))
	for s: float in [-1.0, 1.0]:
		var q := p + side * s * (hw - BridgesConfig.SIDEWALK * 0.5)
		_box(out, Transform3D(basis, Vector3(q.x, top + 0.075, q.y)), Vector3(BridgesConfig.SIDEWALK, 0.15, half_span * 2.0), CONCRETE)
		_railing(out, p + side * s * (hw - 0.1), d, half_span, top + 0.15)
	# rampas de cada lado, del tablero a la calle (la calle está a ras del relieve)
	for s: float in [-1.0, 1.0]:
		var a := p + d * s * half_span
		var ground_y: float = c.get("ground_" + ("b" if s > 0 else "a"), c.surface - 0.4)
		var b := a + d * s * BridgesConfig.RAMP
		var rise: float = top - ground_y
		var len := sqrt(BridgesConfig.RAMP * BridgesConfig.RAMP + rise * rise)
		var mid := (a + b) * 0.5
		var tilt := atan2(rise, BridgesConfig.RAMP) * s
		var rb := basis.rotated(basis.x, tilt)
		var center_y := (top + ground_y) * 0.5 - BridgesConfig.DECK_T * 0.5
		_box(out, Transform3D(rb, Vector3(mid.x, center_y, mid.y)), Vector3(hw * 2.0, BridgesConfig.DECK_T, len), Color("#6e6e6c"))
		out.decks.push_back({"a": a, "b": b, "hw": hw, "y0": top, "y1": ground_y})
	out.decks.push_back({"a": p - d * half_span, "b": p + d * half_span, "hw": hw, "y0": top, "y1": top})
	# pilas en el agua bajo el tablero, cada ~8 m
	var n := maxi(1, int(float(c.river_hw) * 2.0 / 8.0))
	for k in n:
		var t := (k + 0.5) / n * 2.0 - 1.0
		var q: Vector2 = p + d * t * float(c.river_hw)
		var h: float = top - (c.surface - 2.5)
		_box(out, Transform3D(basis, Vector3(q.x, top - BridgesConfig.DECK_T - h * 0.5, q.y)), Vector3(hw * 1.6, h, 0.8), CONCRETE, false)


## Baranda del puente vial: defensa metálica gris (perfil en W) y encima la barra de bandas amarillas y negras.
static func _railing(out: Out, along: Vector2, d: Vector2, half: float, y: float) -> void:
	var basis := _basis(d)
	var a := along - d * half
	var len := half * 2.0
	# postes cada 2 m y la defensa gris
	var posts := int(len / 2.0) + 1
	for k in posts:
		var q := a + d * (k * len / (posts - 1))
		_box(out, Transform3D(basis, Vector3(q.x, y + BridgesConfig.RAIL_H * 0.5, q.y)), Vector3(0.12, BridgesConfig.RAIL_H, 0.12), STEEL, false)
	var mid := along
	_box(out, Transform3D(basis, Vector3(mid.x, y + 0.45, mid.y)), Vector3(0.08, 0.32, len), STEEL, false)
	# barra superior de bandas alternas de 0,5 m (la foto)
	var bands := int(len / 0.5)
	for k in bands:
		var q := a + d * ((k + 0.5) * len / bands)
		_box(out, Transform3D(basis, Vector3(q.x, y + BridgesConfig.RAIL_H, q.y)), Vector3(0.14, 0.14, len / bands), YELLOW if k % 2 == 0 else BLACK, false)
	# colisión de la baranda completa: no se cae al río desde el puente
	out.boxes.push_back([Transform3D(basis, Vector3(mid.x, y + 0.55, mid.y)), Vector3(0.15, 1.1, len)])


## Pasarela peatonal (foto: tablero delgado de acero, baranda de malla a los lados, estribos de concreto en la orilla).
static func _footbridge(out: Out, f: Dictionary) -> void:
	var p: Vector2 = f.point
	var d: Vector2 = f.dir           # perpendicular al río
	var hw: float = f.width * 0.5
	var half: float = f.river_hw + 2.5
	var top: float = f.surface + f.clearance
	var basis := _basis(d)
	var side := Vector2(-d.y, d.x)
	_box(out, Transform3D(basis, Vector3(p.x, top - 0.08, p.y)), Vector3(hw * 2.0, 0.16, half * 2.0), STEEL)
	for s: float in [-1.0, 1.0]:
		# estribos de concreto en cada orilla y escalones hasta el suelo
		var e := p + d * s * half
		var ground: float = f.get("ground_" + ("b" if s > 0 else "a"), f.surface)
		var h: float = top - ground
		_box(out, Transform3D(basis, Vector3(e.x, ground + h * 0.5 - 0.1, e.y)), Vector3(hw * 2.0 + 0.6, h, 1.6), CONCRETE)
		var steps := ceili(maxf(0.0, h - 0.1) / 0.17)
		for k in steps:
			var q := e + d * s * (1.0 + k * 0.28)
			var sy: float = top - (k + 1) * (h / maxf(steps, 1))
			_box(out, Transform3D(basis, Vector3(q.x, (sy + ground) * 0.5, q.y)), Vector3(hw * 2.0, maxf(sy - ground, 0.02), 0.3), CONCRETE)
		# baranda: pasamanos, rodapié y parales delgados
		var r := p + side * s * (hw - 0.03)
		var basis_r := basis
		_box(out, Transform3D(basis_r, Vector3(r.x, top + 1.0, r.y)), Vector3(0.05, 0.05, half * 2.0), STEEL, false)
		_box(out, Transform3D(basis_r, Vector3(r.x, top + 0.1, r.y)), Vector3(0.04, 0.12, half * 2.0), STEEL, false)
		var n := int(half * 2.0 / 1.2)
		for k in n + 1:
			var q := r - d * half + d * (k * half * 2.0 / n)
			_box(out, Transform3D(basis_r, Vector3(q.x, top + 0.5, q.y)), Vector3(0.04, 1.0, 0.04), STEEL, false)
		out.boxes.push_back([Transform3D(basis_r, Vector3(r.x, top + 0.55, r.y)), Vector3(0.08, 1.1, half * 2.0)])
	# pie de cada escalera (afuera), para pruebas y para la IA
	var steps_out := 1.0 + ceili(maxf(0.0, top - f.surface) / 0.17) * 0.28 + 1.0
	out.footbridges.push_back({"center": Vector3(p.x, top, p.y), "a": p - d * (half + steps_out), "b": p + d * (half + steps_out)})
