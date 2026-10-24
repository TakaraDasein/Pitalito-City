class_name ModularBuilder
## Edificios cercanos armados con las piezas del Building Kit sobre la huella REAL (ver BuildingsConfig).
## Cada lado de la huella se parte en módulos de ~2 m y cada piso (dato `f`, altura real `h`) lleva su fila de
## paredes, ventanas o vanos según el estilo del edificio. Los recorribles: puerta hacia la calle más cercana que se
## abre con F, revestimiento interior propio (tapa la pared del vecino), cielo raso, entrepisos con escalera, un
## tabique con puerta por piso, muebles según el cuarto y, si OSM trae un negocio ahí, el local de ese negocio con
## su nombre real en el letrero.
## Constructor puro: devuelve listas de transformaciones (para MultiMesh) y lotes de geometría. Corre en hilos.

const WALL_T := 0.2      # grosor de pared para la colisión (m)
const INSET := 0.15      # entrepisos un poco adentro de las paredes
const LINING := 0.13     # revestimiento interior, a esta distancia de la cara de la pared
const STAIR_V0 := 0.32   # la escalera arranca a esta distancia de la pared AB (revestimiento + holgura)


## Celda de agrupación de lo que se ve solo de cerca (muebles, revestimiento): el rango de visibilidad de Godot se
## mide al centro de la malla; con una malla por tile (250 m) los muebles aparecían o no según dónde quedara la casa.
const CELL := 50.0


class Out:
	var pieces := {}      # nombre → [[Transform3D, Color]]
	var furniture := {}   # celda (Vector2i) → nombre → [[Transform3D, Color]]
	var batches := {}     # material → MeshBatch (techos, zócalos, hastiales)
	var lining := {}      # celda (Vector2i) → MeshBatch: pintura interior de los recorribles
	var glass := {}       # celda (Vector2i) → MeshBatch: vidrio de las ventanas visto desde adentro
	var cell := Vector2i.ZERO  # celda del edificio que se está armando
	var slabs := MeshBatch.new(true)    # entrepisos y cielos rasos (con colisión)
	var boxes := []       # [Transform3D, Vector3] colisión de paredes, peldaños y barandas
	## Puertas que se abren: { piece, hinge (Transform3D: bisagra, la hoja crece en +Z local), scale (Vector3), sd }
	var doors := []
	## Letreros con el nombre real del negocio: { text, xf }
	var signs := []
	## Vehículos en exhibición (concesionarios, talleres): { type, xf }; el modelo mira a +Z
	var vehicles := []
	## Recorribles: { door, door_in, inside, floor_y, floor_h, size, stairs_bottom, stairs_dir, kind, name }
	var entries := []
	var count := 0
	var enterable := 0

	func add(dict: Dictionary, name: String, xf: Transform3D, tint := Color(1, 1, 1, 0)) -> void:
		if not dict.has(name):
			dict[name] = []
		dict[name].push_back([xf, tint])

	## Muebles de la celda actual.
	func furniture_here() -> Dictionary:
		if not furniture.has(cell):
			furniture[cell] = {}
		return furniture[cell]

	## Vidrio interior de la celda actual.
	func glass_here() -> MeshBatch:
		if not glass.has(cell):
			glass[cell] = MeshBatch.new()
		return glass[cell]

	## Revestimiento de la celda actual.
	func lining_here() -> MeshBatch:
		if not lining.has(cell):
			lining[cell] = MeshBatch.new()
		return lining[cell]


## Negocio real de OSM en esta huella (dentro o a menos de POI_REACH m), o vacío. Solo tipos con local propio.
static func poi_of(p: PackedFloat32Array) -> Dictionary:
	var c := BuildingBuilder._centroid(p)
	var key := WorldData.tile_key(c.x, c.y)
	var poly := PackedVector2Array()
	for i in range(0, p.size(), 2):
		poly.push_back(Vector2(p[i], p[i + 1]))
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			for poi: Dictionary in WorldData.pois_by_tile.get(key + Vector2i(dx, dz), []):
				if not BuildingsConfig.POI_ROOMS.has(poi.k):
					continue
				var q := Vector2(poi.x, poi.z)
				if Geometry2D.is_point_in_polygon(q, poly) or q.distance_to(c) < BuildingsConfig.POI_REACH:
					return poi
	return {}


## true si el edificio se recorre por dentro (determinista). BuildingBuilder lo consulta para no ponerle colisión
## maciza a la caja lejana: adentro manda la colisión de este constructor.
static func is_enterable(b: Dictionary) -> bool:
	if not BuildingsConfig.ENABLED:
		return false
	var p := BuildingBuilder._ccw(PackedFloat32Array(b.p))
	if p.size() < 8:
		return false
	var area := BuildingBuilder._area(p)
	if area < BuildingsConfig.ENTERABLE_AREA.x or area > BuildingsConfig.ENTERABLE_AREA.y:
		return false
	var o := BuildingBuilder._obb(p)
	if o.rect <= 0.8 or o.W < 4.0 or o.L < 5.5:
		return false
	# Muy bajo para un interior habitable (dato `h` < 2,7 m): se queda cerrado
	if float(b.get("h", 0.0)) < BuildingsConfig.FLOOR_MIN - 0.05:
		return false
	return int(b.get("c", 0)) % BuildingsConfig.ENTERABLE_EVERY == 0 or not poi_of(p).is_empty()


## Edificios del tile que se encima con uno recorrible (los datos traen huellas duplicadas de OSM, Google y
## Overture): índice → true. Se suprimen en el detalle y pierden su colisión maciza, si no tapan el interior.
static func suppressed(tile: Dictionary) -> Dictionary:
	var buildings: Array = tile.get("buildings", [])
	var kept := []   # polígonos de los recorribles que se quedan
	var out := {}
	# Primero los recorribles: si dos se enciman, se queda el primero (sus entrepisos se cruzarían)
	for i in buildings.size():
		var b: Dictionary = buildings[i]
		if not is_enterable(b):
			continue
		var poly := _poly(PackedFloat32Array(b.p))
		if _overlaps(poly, kept):
			out[i] = true
		else:
			kept.push_back(poly)
	if kept.is_empty():
		return out
	# Después los demás: un duplicado encima de un recorrible se lo come por dentro
	for i in buildings.size():
		if out.has(i) or is_enterable(buildings[i]):
			continue
		if _overlaps(_poly(PackedFloat32Array(buildings[i].p)), kept):
			out[i] = true
	return out


static func _overlaps(poly: PackedVector2Array, others: Array) -> bool:
	var own := absf(_area2(poly))
	for q: PackedVector2Array in others:
		var overlap := 0.0
		for r: PackedVector2Array in Geometry2D.intersect_polygons(poly, q):
			overlap += absf(_area2(r))
		if overlap > 0.15 * own or overlap > 4.0:
			return true
	return false


static func _poly(p: PackedFloat32Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	for i in range(0, p.size(), 2):
		out.push_back(Vector2(p[i], p[i + 1]))
	return out


static func _style_of(seed: int) -> String:
	var total := 0.0
	for s: Dictionary in BuildingsConfig.STYLES.values():
		total += s.weight
	var r := fmod(float((seed * 2654435761) & 0xffffff) / float(0xffffff) * total, total)
	for k: String in BuildingsConfig.STYLES:
		r -= BuildingsConfig.STYLES[k].weight
		if r <= 0.0:
			return k
	return "popular"


static func _hash(a: int, b: int, c: int, d: int) -> int:
	return absi((a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2971215073)) % 1000


static func build(tile: Dictionary, world: Node) -> Out:
	var out := Out.new()
	for k: String in BuildingBuilder.BATCHES:
		out.batches[k] = MeshBatch.new()
	var skip := suppressed(tile)
	var buildings: Array = tile.get("buildings", [])
	for i in buildings.size():
		if skip.has(i):
			continue
		var b: Dictionary = buildings[i]
		var p := BuildingBuilder._ccw(PackedFloat32Array(b.p))
		if p.size() < 6 or LandmarkSystem.excluded(BuildingBuilder._centroid(p)):
			continue
		_building(out, b, p, world)
	return out


static func _building(out: Out, b: Dictionary, p: PackedFloat32Array, world: Node) -> void:
	var lo := INF
	var hi := -INF
	for i in range(0, p.size(), 2):
		var h: float = world.height(p[i], p[i + 1])
		lo = minf(lo, h)
		hi = maxf(hi, h)
	var seed := int(b.get("c", 0))
	var top: float = hi + float(b.h)
	var style_name := _style_of(seed)
	var enterable := is_enterable(b)
	var poi := poi_of(p) if enterable else {}
	var commercial: bool = style_name == "comercial" or BuildingsConfig.POI_ROOMS.get(poi.get("k", ""), "") in BuildingsConfig.COMMERCIAL
	# Pisos (dato `f`) con alturas de verdad: si la altura real no da para FLOOR_MIN por piso, son menos pisos (no
	# pisos aplastados); el primero de un local es más alto (GROUND_COMMERCIAL)
	var floors := maxi(1, int(b.get("f", roundi(float(b.h) / 3.0))))
	floors = clampi(floors, 1, maxi(1, floori((top - hi) / BuildingsConfig.FLOOR_MIN)))
	var heights := _floor_heights(top - hi, floors, commercial)
	var fy := []
	var acc := hi
	for k in floors:
		fy.push_back(acc)
		acc += heights[k]
	var style: Dictionary = BuildingsConfig.STYLES[style_name]
	var color := Color.html(WorldConfig.FACADE_COLORS[seed % WorldConfig.FACADE_COLORS.size()])
	if style.colors == "light" and color.get_luminance() < 0.75:
		color = color.lerp(Color("#f4f1ea"), 0.6)
	var tint := Color(color.r, color.g, color.b, 1.0)
	var inner_color := Color.html(BuildingsConfig.INTERIOR_COLORS[(seed >> 2) % BuildingsConfig.INTERIOR_COLORS.size()])
	var front := _front_edge(p)
	var cc := BuildingBuilder._centroid(p)
	out.cell = Vector2i(floori(cc.x / CELL), floori(cc.y / CELL))
	out.count += 1

	# Zócalo en pendiente (liso, como la caja lejana) y techo: los mismos de BuildingBuilder
	var base := lo - 0.4
	if hi - base > 0.3:
		BuildingBuilder._walls(out.batches.wall_plain, p, base, hi + 0.02, color * 0.72, func(_y): return 0.02, BuildingBuilder.BAY)
	var o := BuildingBuilder._obb(p)
	var area := BuildingBuilder._area(p)
	var roof := BuildingBuilder._roof_color(b, seed)
	var sloped: bool = o.rect > 0.82 and area < 450.0 and float(b.h) < 7.5 and o.W > 3.0
	if sloped:
		BuildingBuilder._sloped_roof(out.batches.roof_sheet, out.batches.wall_plain, o, top, roof, color, o.W >= 5.5 and seed % 3 != 0)
	else:
		BuildingBuilder._flat_roof(out.batches.roof_flat, p, top, roof)

	var n := p.size() / 2
	var entry := {}
	for e in n:
		var a := Vector2(p[e * 2], p[e * 2 + 1])
		var c := Vector2(p[(e * 2 + 2) % p.size()], p[(e * 2 + 3) % p.size()])
		var length := a.distance_to(c)
		if length < 0.6:
			continue
		var d := (c - a) / length
		var normal := Vector2(d.y, -d.x)
		# En el lado de la entrada de un recorrible, módulos de al menos 2 m: el vano de la puerta (medio módulo)
		# nunca queda más angosto que 1 m (con 1,5 m de módulo quedaba de 75 cm y la cápsula rozaba las jambas)
		var segs := maxi(1, (floori if enterable and e == front else roundi).call(length / BuildingsConfig.MODULE))
		var sl := length / segs
		for f in floors:
			var y0: float = fy[f]
			var fh: float = heights[f]
			var s := 0
			while s < segs:
				var want_entry: bool = enterable and e == front and f == 0 and entry.is_empty() and s >= segs / 2
				var name: String = style.door if want_entry else _choose(style, seed, e, s, f, e == front)
				var wide := name.contains("wide")
				if wide and s + 1 >= segs:
					name = style.window[0] if f > 0 else "wall"
					wide = false
				var span := 2 if wide else 1
				var center := a + d * (s * sl + sl * span * 0.5)
				var seg_len := sl * span
				var xf := _piece_xf(center, d, normal, y0, seg_len, fh, wide)
				out.add(out.pieces, name, xf, tint)
				# Vano medido de la pieza, al tamaño real del módulo (largo) y del piso (alto)
				var op := BuildingsConfig.opening(name)
				var opening: float = float(op[0]) * seg_len / (4.0 if wide else BuildingsConfig.MODULE)
				var door_h: float = float(op[2]) * fh / BuildingsConfig.KIT_FLOOR
				if name.contains("doorway"):
					if want_entry:
						# Entrada del recorrible: puerta de verdad (abre con F)
						_dynamic_leaves(out, style.leaf, center, d, normal, y0, opening, door_h, false)
						var landing := _entry_steps(out, center, d, normal, y0, opening, world, color)
						# door: al pie (afuera, pasando la escalinata); door_close: frente a la puerta, al alcance de F
						entry = {"door": center + normal * (1.6 + landing), "door_close": center + normal * 0.9,
							"door_in": center - normal * 1.4}
					elif wide and style.has("shutters"):
						_shutter(out, center, d, normal, y0, opening, door_h, tint)
					else:
						_static_leaves(out, style.leaf, center, d, normal, y0, opening, door_h, wide)
				if enterable:
					# Las puertas cerradas que no son la entrada tienen colisión (antes se atravesaban)
					var shut: bool = name.contains("doorway") and not want_entry
					_wall_boxes(out, "wall" if shut else name, center, d, normal, y0, seg_len, fh, opening, door_h)
					_lining(out.lining_here(), name, center, d, normal, y0, seg_len, fh, opening, door_h, wide, inner_color, out.glass_here())
				s += span
			# Cornisa en cada piso del frente y arriba de todo en todos los lados
			if f == floors - 1 or e == front:
				for k in segs:
					var cm := a + d * ((k + 0.5) * sl)
					out.add(out.pieces, "border", _piece_xf(cm, d, normal, y0 + fh - (0.3 if f == floors - 1 else 0.15), sl, 0.3, false, true), tint)
		# Columna en la esquina, de abajo arriba
		for f in floors:
			var cxf := Transform3D(Basis.from_scale(Vector3(1, float(heights[f]) / BuildingsConfig.KIT_FLOOR, 1)), Vector3(a.x, fy[f], a.y))
			out.add(out.pieces, "column" if style.has("columns") else "column-thin", cxf, tint)

	if enterable and not entry.is_empty():
		out.enterable += 1
		var kind: String = BuildingsConfig.POI_ROOMS.get(poi.get("k", ""), "tienda" if style_name == "comercial" else "")
		entry.merge({"inside": BuildingBuilder._centroid(p), "floor_y": fy, "floor_h": heights[0], "heights": heights,
			"size": maxf(o.L, o.W), "kind": kind, "name": poi.get("n", "")})
		var before := _count(out.furniture)
		_interior(out, entry, p, o, fy, heights, top, seed, kind, inner_color)
		entry["furniture"] = _count(out.furniture) - before
		if poi.has("n"):
			var door_pt: Vector2 = entry.door
			var din: Vector2 = entry.door_in
			var nrm := (door_pt - din).normalized()
			var at := (door_pt + din) * 0.5 + nrm * 0.05
			# Letrero en la fachada, sobre la puerta, legible desde la calle (+Z del letrero hacia afuera)
			var z3 := Vector3(nrm.x, 0, nrm.y)
			var sign_basis := Basis(Vector3.UP.cross(z3), Vector3.UP, z3)
			out.signs.push_back({"text": poi.n, "xf": Transform3D(sign_basis, Vector3(at.x, hi + minf(float(heights[0]) - 0.25, 2.9), at.y))})
		out.entries.push_back(entry)


## Alturas de piso a piso: iguales, salvo el primero de un local, más alto si la altura total lo permite.
static func _floor_heights(total: float, floors: int, commercial: bool) -> Array:
	if floors <= 1:
		return [total]
	var ground := total / floors
	if commercial:
		ground = clampf(total - (floors - 1) * BuildingsConfig.FLOOR_MIN, ground, BuildingsConfig.GROUND_COMMERCIAL)
	var rest := (total - ground) / (floors - 1)
	var out := [ground]
	for k in floors - 1:
		out.push_back(rest)
	return out


## Escalinata de la entrada en pendiente: el piso va a la cota más alta de la huella y el andén frente a la puerta
## puede quedar abajo (medido: 55 cm en un local de la Calle 1A). Peldaños de ≤ 17 cm y 30 cm de huella hacia la
## calle, con colisión. Devuelve cuánto sobresale (m), para que el punto de "afuera" quede al pie.
static func _entry_steps(out: Out, center: Vector2, d: Vector2, normal: Vector2, floor_y: float, opening: float, world: Node, color: Color) -> float:
	var outside := center + normal * 0.6
	var ground: float = world.height(outside.x, outside.y)
	var rise := floor_y - ground
	if rise < 0.12:
		return 0.0
	var n := ceili(rise / 0.17)
	var h := rise / n
	var w := opening + 0.5
	var basis := Basis(Vector3(normal.x, 0, normal.y), Vector3.UP, Vector3(d.x, 0, d.y))
	var batch: MeshBatch = out.batches.wall_plain
	var tone := color * 0.8
	for k in n:
		# El peldaño k (de arriba hacia abajo) baja h por cada 30 cm hacia afuera
		var top := floor_y - k * h
		var dist := 0.15 + k * 0.3
		var c := center + normal * dist
		var size := Vector3(0.3, top - ground + 0.05, w)
		var y_mid := (top + ground - 0.05) * 0.5
		out.boxes.push_back([Transform3D(basis, Vector3(c.x, y_mid, c.y)), size])
		_box_mesh(batch, Transform3D(basis, Vector3(c.x, y_mid, c.y)), size, tone)
	return n * 0.3


## Caja visible (6 caras) en un MeshBatch: peldaños y otras piezas sueltas sin modelo.
static func _box_mesh(batch: MeshBatch, xf: Transform3D, size: Vector3, color: Color) -> void:
	var hs := size * 0.5
	for axis in 3:
		for sgn: float in [-1.0, 1.0]:
			var n := Vector3.ZERO
			n[axis] = sgn
			var t1 := Vector3.ZERO
			var t2 := Vector3.ZERO
			t1[(axis + 1) % 3] = 1.0
			t2[(axis + 2) % 3] = 1.0
			var c := n * hs[axis]
			var a := t1 * hs[(axis + 1) % 3]
			var b := t2 * hs[(axis + 2) % 3]
			var wn := (xf.basis * n).normalized()
			var i0 := batch.vertex(xf * (c - a - b), wn, Vector2(0, 0), color)
			var i1 := batch.vertex(xf * (c + a - b), wn, Vector2(1, 0), color)
			var i2 := batch.vertex(xf * (c + a + b), wn, Vector2(1, 1), color)
			var i3 := batch.vertex(xf * (c - a + b), wn, Vector2(0, 1), color)
			batch.quad(i0, i1, i2, i3, wn)


## Lado que da a la calle: el de punto medio más cercano a una vía (dato OSM). La puerta va ahí (ESTIMADO).
static func _front_edge(p: PackedFloat32Array) -> int:
	var best := 0
	var best_d := INF
	var n := p.size() / 2
	for e in n:
		var a := Vector2(p[e * 2], p[e * 2 + 1])
		var c := Vector2(p[(e * 2 + 2) % p.size()], p[(e * 2 + 3) % p.size()])
		if a.distance_to(c) < 2.5:
			continue
		var d := (c - a).normalized()
		var probe := (a + c) * 0.5 + Vector2(d.y, -d.x) * 3.0
		var near: Dictionary = WorldData.roads.nearest(probe, 40.0, false) if WorldData.roads else {}
		var dist: float = near.d if not near.is_empty() else 999.0
		if dist < best_d:
			best_d = dist
			best = e
	return best


## Qué pieza va en el módulo `s` del lado `e`, piso `f`. Determinista.
static func _choose(style: Dictionary, seed: int, e: int, s: int, f: int, front: bool) -> String:
	var h := _hash(seed, e, s, f)
	var windows: Array = style.window
	if f == 0:
		if front:
			if style.has("shutters") and h < 650:
				return style.wide
			if h < 300:
				return style.door
			return windows[h % windows.size()] if h < 800 else "wall"
		return windows[h % windows.size()] if h < 250 else "wall"
	# Pisos altos: el frente casi todo ventanas; los lados, pocas (suelen pegar con el vecino)
	if front:
		return windows[h % windows.size()] if h < 780 else "wall"
	return windows[h % windows.size()] if h < 300 else "wall"


## Transformación de una pieza de pared: el kit abre la pieza a lo largo de Z (2 m; 4 m las anchas) y la cara
## mira por X. Se estira al largo real del módulo y a la altura real del piso.
static func _piece_xf(center: Vector2, d: Vector2, normal: Vector2, y0: float, length: float, height: float, wide: bool, keep_height := false) -> Transform3D:
	var kit_len := 4.0 if wide else BuildingsConfig.MODULE
	var sy := 1.0 if keep_height else height / BuildingsConfig.KIT_FLOOR
	var basis := Basis(Vector3(normal.x, 0, normal.y), Vector3(0, sy, 0), Vector3(d.x, 0, d.y) * (length / kit_len))
	return Transform3D(basis, Vector3(center.x, y0, center.y))


## Persiana metálica de local cerrado, a la medida del portón (la pieza del kit mide 2 × 1 m).
static func _shutter(out: Out, center: Vector2, d: Vector2, normal: Vector2, y0: float, opening: float, door_h: float, tint: Color) -> void:
	var basis := Basis(Vector3(normal.x, 0, normal.y), Vector3(0, door_h, 0), Vector3(d.x, 0, d.y) * (opening / 2.0))
	out.add(out.pieces, "plating-detailed-wide", Transform3D(basis, Vector3(center.x, y0, center.y)), Color(tint, 0.0))


## Bisagra de una hoja: la hoja del kit crece desde la bisagra hacia +Z local (0,9 m) y gira en Y.
static func _leaf(center: Vector2, d: Vector2, normal: Vector2, y0: float, opening: float, door_h: float, leaves: int, k: int) -> Dictionary:
	var w := opening / leaves
	var sd := 1.0 if k == 0 else -1.0 # la segunda hoja nace del otro lado, mirando al centro
	var hinge := center - d * sd * (opening * 0.5)
	var z3 := Vector3(d.x, 0, d.y) * sd
	var x3 := Vector3(normal.x, 0, normal.y) * sd
	var scale := Vector3(1, door_h / 2.1, w / 0.9)
	return {"hinge": Transform3D(Basis(x3, Vector3.UP, z3), Vector3(hinge.x, y0, hinge.y)), "scale": scale, "sd": sd}


static func _static_leaves(out: Out, piece: String, center: Vector2, d: Vector2, normal: Vector2, y0: float, opening: float, door_h: float, wide: bool) -> void:
	var leaves := 2 if wide else 1
	for k in leaves:
		var l := _leaf(center, d, normal, y0, opening, door_h, leaves, k)
		var hinge: Transform3D = l.hinge
		out.add(out.pieces, piece, Transform3D(hinge.basis.scaled_local(l.scale), hinge.origin), Color(1, 1, 1, 0))


## Puertas interiores (`start_open`): empiezan abiertas, la casa se lee y se recorre sin abrir cada cuarto.
static func _dynamic_leaves(out: Out, piece: String, center: Vector2, d: Vector2, normal: Vector2, y0: float, opening: float, door_h: float, wide: bool, start_open := false) -> void:
	var leaves := 2 if wide else 1
	for k in leaves:
		var l := _leaf(center, d, normal, y0, opening, door_h, leaves, k)
		out.doors.push_back({"piece": piece, "hinge": l.hinge, "scale": l.scale, "sd": l.sd,
			"center": Vector3(center.x, y0, center.y), "open": start_open})


## Colisión de una pieza de pared (solo en los recorribles): caja maciza, o dos jambas y dintel si es un vano.
## Las ventanas también son macizas (no se sale por la ventana).
static func _wall_boxes(out: Out, name: String, center: Vector2, d: Vector2, normal: Vector2, y0: float, length: float, fh: float, opening: float, door_h: float) -> void:
	var basis := Basis(Vector3(normal.x, 0, normal.y), Vector3.UP, Vector3(d.x, 0, d.y))
	if not name.contains("doorway"):
		out.boxes.push_back([Transform3D(basis, Vector3(center.x, y0 + fh * 0.5, center.y)), Vector3(WALL_T, fh, length)])
		return
	var jamb := (length - opening) * 0.5
	for sgn: float in [-1.0, 1.0]:
		var c: Vector2 = center + d * sgn * (opening * 0.5 + jamb * 0.5)
		out.boxes.push_back([Transform3D(basis, Vector3(c.x, y0 + fh * 0.5, c.y)), Vector3(WALL_T, fh, jamb)])
	out.boxes.push_back([Transform3D(basis, Vector3(center.x, y0 + (fh + door_h) * 0.5, center.y)), Vector3(WALL_T, fh - door_h, opening)])


## Pintura interior: una cara a LINING m de la pared, mirando adentro, con el hueco del vano (ventana o puerta).
## Tapa la pared del vecino que en el dato comparte el muro.
static func _lining(batch: MeshBatch, name: String, center: Vector2, d: Vector2, normal: Vector2, y0: float, length: float, fh: float, opening: float, door_h: float, wide: bool, color: Color, glass: MeshBatch = null) -> void:
	var inward := -normal
	var c := center + inward * LINING
	var half := length * 0.5
	var sy := fh / BuildingsConfig.KIT_FLOOR
	var hole := Rect2() # x: a lo largo de la pared (desde el centro), y: altura desde el piso
	if name.contains("doorway"):
		hole = Rect2(-opening * 0.5, 0.0, opening, door_h)
	elif name.contains("window"):
		# Vano medido de la pieza (la ventana ancha cuadrada arranca a 1,20 m del kit, no a 0,85: antes quedaba una
		# franja sin pintar bajo la ventana)
		var op := BuildingsConfig.opening(name)
		var ow: float = float(op[0]) * length / (4.0 if wide else BuildingsConfig.MODULE)
		hole = Rect2(-ow * 0.5, float(op[1]) * sy, ow, (float(op[2]) - float(op[1])) * sy)
	var rects := []
	if hole.size == Vector2.ZERO:
		rects.push_back(Rect2(-half, 0.0, length, fh))
	else:
		rects.push_back(Rect2(-half, 0.0, hole.position.x + half, fh))                               # izquierda
		rects.push_back(Rect2(hole.end.x, 0.0, half - hole.end.x, fh))                               # derecha
		rects.push_back(Rect2(hole.position.x, hole.end.y, hole.size.x, fh - hole.end.y))            # arriba
		if hole.position.y > 0.0:
			rects.push_back(Rect2(hole.position.x, 0.0, hole.size.x, hole.position.y))               # antepecho
	var n3 := Vector3(inward.x, 0, inward.y)
	# Vidrio de la ventana visto desde adentro: las piezas del kit solo se dibujan por fuera (cara trasera
	# descartada) y desde adentro la ventana era un hueco al vacío
	if glass and name.contains("window"):
		var g0 := c + d * hole.position.x
		var g1 := c + d * hole.end.x
		var gy0 := y0 + hole.position.y
		var gy1 := y0 + hole.end.y
		var k0 := glass.vertex(Vector3(g0.x, gy0, g0.y), n3, Vector2.ZERO)
		var k1 := glass.vertex(Vector3(g1.x, gy0, g1.y), n3, Vector2.ZERO)
		var k2 := glass.vertex(Vector3(g1.x, gy1, g1.y), n3, Vector2.ZERO)
		var k3 := glass.vertex(Vector3(g0.x, gy1, g0.y), n3, Vector2.ZERO)
		glass.quad(k0, k1, k2, k3, n3)
	for r: Rect2 in rects:
		if r.size.x <= 0.01 or r.size.y <= 0.01:
			continue
		var p0 := c + d * r.position.x
		var p1 := c + d * r.end.x
		var ya := y0 + r.position.y
		var yb := y0 + r.end.y
		var i0 := batch.vertex(Vector3(p0.x, ya, p0.y), n3, Vector2(r.position.x, ya) / 2.0, color)
		var i1 := batch.vertex(Vector3(p1.x, ya, p1.y), n3, Vector2(r.end.x, ya) / 2.0, color)
		var i2 := batch.vertex(Vector3(p1.x, yb, p1.y), n3, Vector2(r.end.x, yb) / 2.0, color)
		var i3 := batch.vertex(Vector3(p0.x, yb, p0.y), n3, Vector2(r.position.x, yb) / 2.0, color)
		batch.quad(i0, i1, i2, i3, n3)


## Interior: entrepisos de losa, escalera de mampostería contra el lado AB, tabique con puerta, cuartos amoblados,
## cielo raso bajo el techo. Todo en el marco del rectángulo orientado: u a lo largo de AB desde A, v hacia adentro.
static func _interior(out: Out, entry: Dictionary, p: PackedFloat32Array, o: Dictionary, fy: Array, heights: Array, top: float, seed: int, kind: String, inner_color: Color) -> void:
	var inner := _shrink(p, INSET)
	var u: Vector2 = o.u
	var v: Vector2 = o.v
	var c := BuildingBuilder._centroid(p)
	var inward := v if v.dot(c - (o.A + o.B) * 0.5) > 0.0 else -v
	var a0: Vector2 = o.A if inward.dot(o.D - o.A) > 0.0 else o.D
	var floors := fy.size()
	# Escalera: la más alta de las subidas manda (todos los tramos iguales en la casa)
	var stair := _plan_stairs(o, heights) if floors > 1 else {}
	var has_stairs := not stair.is_empty()
	entry["has_stairs"] = has_stairs
	if has_stairs:
		# Recorrido de la escalera en planta (pie → … → llegada arriba): para pruebas y para la IA que la use
		var w := BuildingsConfig.STAIR_WIDTH
		var vc := STAIR_V0 + w * 0.5
		var path := [a0 + u * (float(stair.u_start) - 0.7) + inward * vc]
		if stair.type == "recta":
			path.push_back(a0 + u * (float(stair.u_end) + 0.7) + inward * vc)
		else:
			var land := float(stair.u_start) + int(stair.n1) * BuildingsConfig.TREAD + BuildingsConfig.LANDING * 0.5
			path.push_back(a0 + u * land + inward * vc)
			path.push_back(a0 + u * land + inward * (vc + w + 0.1))
			path.push_back(a0 + u * (float(stair.hole_u0) - 0.6) + inward * (vc + w + 0.1))
		entry["stairs_path"] = path
		entry["stairs_bottom"] = path[0]
		entry["stairs_type"] = stair.type
	var clear_u: float = (float(stair.u_end) + 1.2) if has_stairs else 3.0
	var door_u: float = (Vector2(entry.door_in) - a0).dot(u)
	var lights := []
	for f in floors:
		var y: float = fy[f]
		var fh: float = heights[f]
		var slab := inner
		if f > 0 and has_stairs:
			# Hueco sobre toda la escalera que llega a este piso: altura libre ≥ HEADROOM en todo el recorrido.
			# Se abre hacia la pared AB (sin agujeros internos en el polígono de la losa)
			var h0: Vector2 = a0 + u * (float(stair.hole_u0)) - inward * 1.2
			var hole := PackedVector2Array([h0, a0 + u * float(stair.hole_u1) - inward * 1.2,
				a0 + u * float(stair.hole_u1) + inward * float(stair.hole_v1), a0 + u * float(stair.hole_u0) + inward * float(stair.hole_v1)])
			slab = _clip(inner, hole)
			_railings(out, a0, u, inward, y, stair)
		_slab(out.slabs, slab, y + (0.05 if f == 0 else 0.0), f > 0, true)
		if has_stairs and f < floors - 1:
			_build_stairs(out, a0, u, inward, y, heights[f], stair)
		var rooms: Array
		if f == 0:
			rooms = ["sala", "cocina"] if kind == "" else [kind, kind]
		else:
			rooms = BuildingsConfig.UPPER_ROOMS.get(kind, BuildingsConfig.UPPER_ROOMS.default)
		# Tabique: el baño es un cuarto propio de 2,6 m de fondo; la cocina, de 3,6 m; si no, a la mitad
		var split := _split_for(o.L, String(rooms[1]), clear_u, door_u if f == 0 else -1.0)
		# El local de un negocio queda abierto (sin tabique); las casas, dos cuartos por piso
		var divided: bool = split > 0.0 and not (f == 0 and kind != "")
		var part_door_v := -1.0
		if divided:
			part_door_v = _partition(out, o, inward, y, fh, split, inner_color)
		var ranges := [[0.0, split], [split, o.L]] if divided else [[0.0, o.L]]
		var blocked := {"stairs": has_stairs, "stair": stair, "entry": entry.door_in if f == 0 else null,
			"part_u": split if divided else -1.0, "part_v": part_door_v}
		for ri in ranges.size():
			_furnish(out, o, inward, y, rooms[mini(ri, rooms.size() - 1)], ranges[ri], blocked)
			# Una luz por cuarto, en el centro y cerca del cielo raso
			var r_mid: float = (float(ranges[ri][0]) + float(ranges[ri][1])) * 0.5
			var lc: Vector2 = a0 + u * r_mid + inward * (o.W * 0.5)
			lights.push_back(Vector3(lc.x, y + fh - 0.35, lc.y))
	entry["lights"] = lights
	# Cielo raso bajo el techo del último piso (antes, desde adentro se veía el cielo)
	_slab(out.slabs, inner, top - 0.02, true, false)


## Dónde va el tabique de un piso según el segundo cuarto (−1: sin tabique). Respeta la escalera y, en el primer
## piso, que el cuarto al que da la entrada tenga al menos 3,5 m de fondo.
static func _split_for(length: float, second: String, clear_u: float, door_u: float) -> float:
	var split: float = {"bano": length - 2.6, "cocina": length - 3.6}.get(second, length * 0.5)
	split = maxf(split, clear_u)
	if door_u > length * 0.75:
		split = minf(split, length - 3.5)
	elif door_u >= 0.0 and door_u < length * 0.25:
		split = maxf(split, 3.5)
	if split > length - 2.2 or split < clear_u:
		return -1.0
	return split


## Plan de la escalera (práctica constructiva): contrahuella ≤ RISER_MAX, huella TREAD, ancho STAIR_WIDTH.
## Tramo recto si el largo alcanza (con 1,2 m de llegada); si no, en U con descanso. Vacío si no cabe.
## Devuelve medidas en el marco (u, v): dónde arranca y termina, y el hueco que debe tener la losa de arriba.
static func _plan_stairs(o: Dictionary, heights: Array) -> Dictionary:
	var rise_h: float = 0.0
	for k in heights.size() - 1:
		rise_h = maxf(rise_h, heights[k])
	var n := ceili(rise_h / BuildingsConfig.RISER_MAX)
	var t := BuildingsConfig.TREAD
	var w := BuildingsConfig.STAIR_WIDTH
	var u_start := 1.2 # deja llegar al pie desde la esquina
	var straight := n * t
	if u_start + straight + 1.2 <= o.L and o.W >= w + STAIR_V0 + 1.8:
		return {"type": "recta", "n": n, "u_start": u_start, "u_end": u_start + straight,
			"hole_u0": u_start - 0.05, "hole_u1": u_start + straight + 0.05, "hole_v1": STAIR_V0 + w + 0.05}
	# En U: primer tramo hacia +u, descanso, segundo tramo de vuelta (pegado al primero, del lado de adentro)
	var n1 := ceili(n / 2.0)
	var n2 := n - n1
	var run1 := n1 * t
	if u_start + run1 + BuildingsConfig.LANDING + 0.6 <= o.L and o.W >= 2.0 * w + STAIR_V0 + 0.1 + 1.6:
		return {"type": "U", "n": n, "n1": n1, "n2": n2, "u_start": u_start, "u_end": u_start + run1 + BuildingsConfig.LANDING,
			"hole_u0": u_start + (n1 - n2) * t - 0.05, "hole_u1": u_start + run1 + BuildingsConfig.LANDING + 0.05,
			"hole_v1": STAIR_V0 + 2.0 * w + 0.15}
	return {}


## Peldaños macizos (mampostería, como las escaleras de concreto de las casas): cada uno es una caja del piso a su
## huella, visible y con colisión. El jugador los sube con la subida de escalones (contrahuella ≤ 17,5 cm).
static func _build_stairs(out: Out, a0: Vector2, u: Vector2, inward: Vector2, y: float, fh: float, st: Dictionary) -> void:
	var n: int = st.n
	var rise := fh / n
	var t := BuildingsConfig.TREAD
	var w := BuildingsConfig.STAIR_WIDTH
	var basis := Basis(Vector3(inward.x, 0, inward.y), Vector3.UP, Vector3(u.x, 0, u.y))
	if basis.determinant() < 0.0:
		basis = Basis(Vector3(-inward.x, 0, -inward.y), Vector3.UP, Vector3(u.x, 0, u.y))
	var tone := Color("#cbbba5")
	var step := func(uu: float, vc: float, top_y: float, depth: float, width: float) -> void:
		var c: Vector2 = a0 + u * uu + inward * vc
		var size := Vector3(width, top_y - y, depth)
		var xf := Transform3D(basis, Vector3(c.x, (y + top_y) * 0.5, c.y))
		out.boxes.push_back([xf, size])
		_box_mesh(out.batches.wall_plain, xf, size, tone)
	var u0: float = st.u_start
	if st.type == "recta":
		for k in n:
			step.call(u0 + (k + 0.5) * t, STAIR_V0 + w * 0.5, y + (k + 1) * rise, t, w)
		return
	var n1: int = st.n1
	var n2: int = st.n2
	for k in n1:
		step.call(u0 + (k + 0.5) * t, STAIR_V0 + w * 0.5, y + (k + 1) * rise, t, w)
	# Descanso a media altura, del ancho de los dos tramos
	var land_u := u0 + n1 * t
	step.call(land_u + BuildingsConfig.LANDING * 0.5, STAIR_V0 + w + 0.05, y + n1 * rise, BuildingsConfig.LANDING, 2.0 * w + 0.1)
	for k in n2:
		step.call(land_u - (k + 0.5) * t, STAIR_V0 + 1.5 * w + 0.1, y + (n1 + k + 1) * rise, t, w)


## Baranda alrededor del hueco de la escalera en el piso de arriba (no se cae uno por el hueco), menos el lado por
## donde se llega. Barra y parales visibles; colisión de una caja delgada por tramo.
static func _railings(out: Out, a0: Vector2, u: Vector2, inward: Vector2, y: float, st: Dictionary) -> void:
	var v1: float = st.hole_v1
	var u0: float = st.hole_u0
	var u1: float = st.hole_u1
	var h := BuildingsConfig.RAIL_HEIGHT
	var tone := Color("#3a2c22")
	# Tramos [desde, hasta] en (u, v). Recta: llega por u1 (lado lejano); U: llega por u0, entre v de 1 w y 2 w
	var runs := []
	runs.push_back([Vector2(u0, v1), Vector2(u1, v1)])               # borde largo, del lado del cuarto
	if st.type == "recta":
		runs.push_back([Vector2(u0, STAIR_V0 - 0.05), Vector2(u0, v1)])
	else:
		runs.push_back([Vector2(u1, STAIR_V0 - 0.05), Vector2(u1, v1)])
		runs.push_back([Vector2(u0, STAIR_V0 - 0.05), Vector2(u0, STAIR_V0 + BuildingsConfig.STAIR_WIDTH + 0.1)])
	for r: Array in runs:
		var pa: Vector2 = a0 + u * r[0].x + inward * r[0].y
		var pb: Vector2 = a0 + u * r[1].x + inward * r[1].y
		var length := pa.distance_to(pb)
		if length < 0.1:
			continue
		var d := (pb - pa) / length
		var basis := Basis(Vector3(-d.y, 0, d.x), Vector3.UP, Vector3(d.x, 0, d.y))
		if basis.determinant() < 0.0:
			basis = Basis(Vector3(d.y, 0, -d.x), Vector3.UP, Vector3(d.x, 0, d.y))
		var mid := (pa + pb) * 0.5
		var top_xf := Transform3D(basis, Vector3(mid.x, y + h - 0.03, mid.y))
		_box_mesh(out.batches.wall_plain, top_xf, Vector3(0.06, 0.06, length), tone)
		out.boxes.push_back([Transform3D(basis, Vector3(mid.x, y + h * 0.5, mid.y)), Vector3(0.08, h, length)])
		var posts := maxi(2, ceili(length / 0.12))
		for k in posts:
			var q := pa + d * (length * k / (posts - 1))
			_box_mesh(out.batches.wall_plain, Transform3D(basis, Vector3(q.x, y + h * 0.5, q.y)), Vector3(0.025, h, 0.025), tone)


## Tabique a lo largo del lado corto, en u = split: muro del kit con una puerta (que abre con F) hacia el centro y
## revestimiento por las dos caras. Devuelve la posición de la puerta a lo largo del tabique (v desde AB).
static func _partition(out: Out, o: Dictionary, inward: Vector2, y: float, fh: float, split: float, color: Color) -> float:
	var u: Vector2 = o.u
	var start: Vector2 = (o.A if inward.dot(o.D - o.A) > 0.0 else o.D) + u * split + inward * INSET
	var length: float = o.W - INSET * 2.0
	var segs := maxi(1, roundi(length / BuildingsConfig.MODULE))
	var sl := length / segs
	var door_seg := segs / 2 if segs > 1 else 0
	var tint := Color(color.r, color.g, color.b, 1.0)
	# Base derecha (no espejada) según hacia dónde quede el interior: las cajas de colisión no admiten espejo
	var normal: Vector2 = u if Vector2(-u.y, u.x).dot(inward) > 0.0 else -u
	var door_v := 0.0
	for s in segs:
		var center := start + inward * (s * sl + sl * 0.5)
		var name := "wall-doorway-square" if s == door_seg else "wall"
		out.add(out.pieces, name, _piece_xf(center, inward, normal, y, sl, fh, false), tint)
		var op := BuildingsConfig.opening("wall-doorway-square")
		var opening: float = float(op[0]) * sl / BuildingsConfig.MODULE
		var door_h: float = float(op[2]) * fh / BuildingsConfig.KIT_FLOOR
		_wall_boxes(out, name, center, inward, normal, y, sl, fh, opening, door_h)
		# Revestimiento por las dos caras: a 7 cm del eje del tabique, cada uno mirando hacia su cuarto.
		# _lining pone la cara en (centro − normal·LINING) mirando a −normal: se le pasa la normal invertida.
		for side: float in [-1.0, 1.0]:
			_lining(out.lining_here(), name, center - normal * side * (LINING - 0.07), inward, -normal * side, y, sl, fh, opening, door_h, false, color)
		if s == door_seg:
			door_v = INSET + s * sl + sl * 0.5
			_dynamic_leaves(out, "door-rotate-square-d", center, inward, normal, y, opening, door_h, false, true)
	return door_v


## Muebles del cuarto [u0, u1]. Las paredes disponibles son los cuatro lados del cuarto (también el tabique), menos
## la escalera o su hueco (contra AB, u ∈ [0,4; 5,0]), la entrada y la puerta del tabique. "pared" se reparte por
## turnos entre las paredes, mirando adentro; "centro" va en fila al medio; "encima", sobre el anterior. La lista
## del cuarto se repite según el área (un local de 80 m² no queda con cinco muebles).
static func _furnish(out: Out, o: Dictionary, inward: Vector2, y: float, room: String, span: Array, blocked: Dictionary) -> void:
	var u: Vector2 = o.u
	var vv := inward # +v hacia adentro desde AB
	var a0: Vector2 = o.A if inward.dot(o.D - o.A) > 0.0 else o.D # esquina de AB en u = 0
	var u0: float = span[0]
	var u1: float = span[1]
	var W: float = o.W
	var off := LINING + INSET + 0.03
	var P := func(uu: float, v: float) -> Vector2: return a0 + u * uu + vv * v
	# Paredes: [inicio, dirección de recorrido, largo, mirando hacia, coordenada fija para excluir]
	var walls := [
		{"from": P.call(u0, off), "dir": u, "len": u1 - u0, "face": vv, "axis": "u", "base": u0},              # AB
		{"from": P.call(u0, W - off), "dir": u, "len": u1 - u0, "face": -vv, "axis": "u", "base": u0},         # DC
		{"from": P.call(u0 + off, 0.0), "dir": vv, "len": W, "face": u, "axis": "v", "base": 0.0},             # lado en u0
		{"from": P.call(u1 - off, 0.0), "dir": vv, "len": W, "face": -u, "axis": "v", "base": 0.0},            # lado en u1
	]
	# Tramos libres de cada pared (intervalos a lo largo de ella)
	for wi in walls.size():
		var w: Dictionary = walls[wi]
		var free := [[0.35, w.len - 0.35]]
		if wi == 0 and blocked.stairs:
			free = _cut(free, float(blocked.stair.hole_u0) - 0.8 - u0, float(blocked.stair.hole_u1) + 0.3 - u0)
		if w.axis == "v" and blocked.part_v >= 0.0:
			var at_u: float = u0 if wi == 2 else u1
			if absf(at_u - blocked.part_u) < 0.01:
				free = _cut(free, blocked.part_v - 0.75, blocked.part_v + 0.75)
		if wi == 2 and blocked.stairs and u0 < 0.5:
			free = _cut(free, 0.0, float(blocked.stair.hole_v1) + 0.3) # el pie/llegada de la escalera junto a A
		if blocked.entry != null:
			var e2: Vector2 = Vector2(blocked.entry) - a0
			var eu := e2.dot(u)
			var ev := e2.dot(vv)
			var along: float = (eu - u0) if w.axis == "u" else ev
			var across: float = ev if w.axis == "u" else eu
			var wall_at: float = (off if wi == 0 else W - off) if w.axis == "u" else (u0 + off if wi == 2 else u1 - off)
			if absf(across - wall_at) < 2.2:
				free = _cut(free, along - 1.0, along + 1.0)
		w["free"] = free
	var area: float = (u1 - u0) * W
	var items: Array = BuildingsConfig.ROOMS[room]
	var repeats := clampi(int(area / 18.0), 1, 4) if room in BuildingsConfig.COMMERCIAL else 1
	var wall_k := 0
	var center_k := 0
	var last_xf := Transform3D()
	var last_h := 0.0
	var have_last := false
	for rep in repeats:
		for it: Array in items:
			if rep > 0 and it[1] == "centro" and (center_k > 6 or it[0].begins_with("rug")):
				continue
			if String(it[0]).begins_with("@"):
				var vt := String(it[0]).substr(1)
				if not VehiclesConfig.VEHICLES.has(vt) or (rep > 0 and center_k > 6):
					continue
				var vs: Dictionary = VehiclesConfig.VEHICLES[vt]
				# En fila al medio, de lado (mirando a lo largo del cuarto), con el ancho del vehículo de separación
				var pitch_u: float = float(vs.width) + 0.8
				var v_mid2: float = (W + (1.9 if blocked.stairs else 0.0)) * 0.5
				var uu2: float = u0 + 1.2 + center_k * pitch_u
				if uu2 > u1 - 1.0 or float(vs.length) > W - (2.2 if blocked.stairs else 0.6):
					continue
				var at3: Vector2 = P.call(uu2, v_mid2)
				var z5 := Vector3(vv.x, 0, vv.y)
				out.vehicles.push_back({"type": vt, "xf": Transform3D(Basis(Vector3.UP.cross(z5), Vector3.UP, z5), Vector3(at3.x, y + 0.06, at3.y))})
				center_k += 1
				have_last = false
				continue
			var info := PieceLibrary.furniture(it[0])
			if info.is_empty():
				continue
			var box: AABB = info.aabb
			var wdt := box.size.x
			var wall_mounted := box.position.y < -0.05 # lavamanos y espejos: el origen está a la altura de montaje
			var pivot := Vector3(box.position.x + wdt * 0.5, 0.0 if wall_mounted else box.position.y, box.position.z)
			var lift := 0.85 if wall_mounted else 0.0
			var xf: Transform3D
			var placed := false
			match it[1]:
				"encima":
					if have_last:
						xf = Transform3D(last_xf.basis, last_xf.origin + Vector3.UP * last_h)
						placed = true
				"pared":
					# Por turnos: la siguiente pared con un tramo libre donde quepa
					for t in walls.size():
						var w: Dictionary = walls[(wall_k + t) % walls.size()]
						var slot := _take(w.free, wdt + 0.15)
						if slot < 0.0:
							continue
						var at: Vector2 = Vector2(w.from) + Vector2(w.dir) * (slot + wdt * 0.5)
						var f: Vector2 = w.face
						var z3 := Vector3(f.x, 0, f.y)
						xf = Transform3D(Basis(Vector3.UP.cross(z3), Vector3.UP, z3), Vector3(at.x, y + 0.06 + lift, at.y))
						wall_k = (wall_k + t + 1) % walls.size()
						placed = true
						break
				_:
					# En filas al medio del cuarto, lejos de la escalera (que ocupa ~1,9 m junto a AB)
					var v_mid: float = (W + (float(blocked.stair.hole_v1) if blocked.stairs else 0.0)) * 0.5
					var row := center_k / 3
					var col := center_k % 3
					var uu: float = (u0 + u1) * 0.5 + (col - 1) * 1.0
					var at2: Vector2 = P.call(uu, v_mid + row * 1.1 - 0.4)
					if uu < u0 + 0.6 or uu > u1 - 0.6 or v_mid + row * 1.1 > W - 0.8:
						continue
					var z4 := Vector3(-vv.x, 0, -vv.y)
					xf = Transform3D(Basis(Vector3.UP.cross(z4), Vector3.UP, z4), Vector3(at2.x, y + 0.06, at2.y))
					center_k += 1
					placed = true
			if not placed:
				have_last = false
				continue
			out.add(out.furniture_here(), it[0], xf * Transform3D(Basis(), -pivot))
			last_xf = xf
			last_h = box.size.y
			have_last = true


## Quita [a, b] de una lista de tramos libres [[ini, fin], …].
static func _cut(free: Array, a: float, b: float) -> Array:
	var out := []
	for f: Array in free:
		if b <= f[0] or a >= f[1]:
			out.push_back(f)
			continue
		if a > f[0]:
			out.push_back([f[0], a])
		if b < f[1]:
			out.push_back([b, f[1]])
	return out


## Toma `w` m del primer tramo libre donde quepa; devuelve dónde empieza (−1 si no cabe) y achica el tramo.
static func _take(free: Array, w: float) -> float:
	for f: Array in free:
		if f[1] - f[0] >= w:
			var at: float = f[0]
			f[0] = at + w
			return at
	return -1.0


static func _count(cells: Dictionary) -> int:
	var n := 0
	for c: Dictionary in cells.values():
		for v: Array in c.values():
			n += v.size()
	return n


static func _shrink(p: PackedFloat32Array, d: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in range(0, p.size(), 2):
		pts.push_back(Vector2(p[i], p[i + 1]))
	var off := Geometry2D.offset_polygon(pts, -d)
	return off[0] if not off.is_empty() else pts


static func _clip(poly: PackedVector2Array, hole: PackedVector2Array) -> PackedVector2Array:
	var res := Geometry2D.clip_polygons(poly, hole)
	var best := PackedVector2Array()
	var best_a := 0.0
	for r: PackedVector2Array in res:
		if Geometry2D.is_polygon_clockwise(r) != Geometry2D.is_polygon_clockwise(poly):
			continue # un agujero: el hueco quedó adentro, se ignora
		var a := absf(_area2(r))
		if a > best_a:
			best_a = a
			best = r
	return best if not best.is_empty() else poly


static func _area2(p: PackedVector2Array) -> float:
	var s := 0.0
	for i in p.size():
		var j := (i + 1) % p.size()
		s += p[i].x * p[j].y - p[j].x * p[i].y
	return s * 0.5


## Losa: `floor` = cara de arriba (piso de baldosa), `ceiling` = cara de abajo (cielo raso blanco), 0,15 m abajo.
## El alfa del color de vértice distingue piso (1, baldosa) de cielo raso (0, liso) en el material "slab".
static func _slab(batch: MeshBatch, poly: PackedVector2Array, y: float, ceiling: bool, floor := true) -> void:
	var tris := Geometry2D.triangulate_polygon(poly)
	if tris.is_empty():
		return
	if floor:
		var base := batch.verts.size()
		for q in poly:
			batch.vertex(Vector3(q.x, y, q.y), Vector3.UP, q / 2.0, Color("#b9a184"))
		for k in range(0, tris.size(), 3):
			batch.tri(base + tris[k], base + tris[k + 1], base + tris[k + 2], Vector3.UP)
	if ceiling:
		var under := batch.verts.size()
		var cy := y - (0.15 if floor else 0.0)
		for q in poly:
			batch.vertex(Vector3(q.x, cy, q.y), Vector3.DOWN, q / 2.0, Color(0.94, 0.91, 0.87, 0.0))
		for k in range(0, tris.size(), 3):
			batch.tri(under + tris[k], under + tris[k + 1], under + tris[k + 2], Vector3.DOWN)
