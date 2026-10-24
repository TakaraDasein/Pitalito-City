class_name BuildingBuilder
## Edificios reales (Overture + Google Open Buildings + OSM): huella, altura y color del techo medidos.
## Port de web/src/world/builders/BuildingBuilder.js. Se apoyan en el relieve: la base arranca en la cota más baja
## de la huella y el cuerpo mide `h` sobre la más alta. Forma del techo ESTIMADA (no está en los datos): lámina
## inclinada en casas rectangulares bajas, terraza con pretil en el resto. El color del techo sí es real (`rc`).
## Constructor puro: devuelve un MeshBatch por material. Corre en hilos del WorkerThreadPool.

const GROUND_H := 3.2          # altura del primer piso (locales)
const BAY := 3.2 * 4           # ancho del atlas de pisos superiores (4 bahías)
const BAY_G := 3.2 * 8         # ancho del atlas del primer piso (8 bahías: tiendas, portones, avisos)
const FLOOR_ATLAS := 3.0 * 4   # alto del atlas de pisos superiores (4 pisos)

## Material de cada lote (claves de MaterialLibrary).
const BATCHES := ["facade_upper", "facade_ground", "roof_flat", "roof_sheet", "wall_plain"]
const TANK := Color("#141414")
const RAIL := Color("#2a2a2a")


static func build(tile: Dictionary, world: Node) -> Dictionary:
	var out := {}
	for k: String in BATCHES:
		out[k] = MeshBatch.new(true)
	# Los recorribles no llevan colisión maciza: adentro manda la de ModularBuilder
	var hollow := {}
	for k: String in BATCHES:
		hollow[k] = MeshBatch.new(false)
	var overlapped := ModularBuilder.suppressed(tile)
	var all: Array = tile.get("buildings", [])
	for bi in all.size():
		var b: Dictionary = all[bi]
		var dest: Dictionary = hollow if ModularBuilder.is_enterable(b) or overlapped.has(bi) else out
		var upper: MeshBatch = dest.facade_upper
		var ground: MeshBatch = dest.facade_ground
		var plain: MeshBatch = dest.wall_plain
		var p := _ccw(PackedFloat32Array(b.p))
		if p.size() < 6:
			continue
		# Bajo un hito modelado no van edificios genéricos (los cubre el hito)
		if LandmarkSystem.excluded(_centroid(p)):
			continue
		var lo := INF
		var hi := -INF
		for i in range(0, p.size(), 2):
			var h: float = world.height(p[i], p[i + 1])
			lo = minf(lo, h)
			hi = maxf(hi, h)
		var base := lo - 0.4
		var top: float = hi + float(b.h)
		var seed := int(b.get("c", 0))
		var color := Color.html(WorldConfig.FACADE_COLORS[seed % WorldConfig.FACADE_COLORS.size()])
		var g_top := minf(hi + GROUND_H, top)
		# En pendiente, lo que queda bajo la cota más alta es un zócalo liso (no se repite la fachada del primer piso)
		if hi - base > 0.6:
			_walls(plain, p, base, hi, color * 0.72, func(_y): return 0.02, BAY)
		_walls(ground, p, maxf(base, hi - 0.6), g_top, color, func(y): return 1.0 - maxf(0.0, y - hi) / GROUND_H, BAY_G)
		if top > g_top + 0.3:
			_walls(upper, p, g_top, top, color, func(y): return 1.0 - (y - g_top) / FLOOR_ATLAS, BAY)
		var roof := _roof_color(b, seed)
		var o := _obb(p)
		var area := _area(p)
		var sloped: bool = o.rect > 0.82 and area < 450.0 and float(b.h) < 7.5 and o.W > 3.0
		if sloped:
			_sloped_roof(dest.roof_sheet, plain, o, top, roof, color, o.W >= 5.5 and seed % 3 != 0)
		else:
			_flat_roof(dest.roof_flat, p, top, roof)
			_parapet(plain, p, top, 0.6, color)
			if seed % 4 == 0 and area > 40.0:
				var c: Vector2 = (o.A + o.C) * 0.5 + o.u * o.L * 0.25
				_water_tank(dest.roof_flat, Vector3(c.x, top, c.y), 0.55, 1.1)
		if top > g_top + 2.5 and seed % 2 == 1:
			_balconies(plain, o, p, g_top, top, color)
	# Mismo material, mismo lote visual: se juntan; solo cambia qué triángulos entran a la colisión
	for k: String in BATCHES:
		_merge(out[k], hollow[k])
	return out


static func _merge(into: MeshBatch, from: MeshBatch) -> void:
	var base := into.verts.size()
	into.verts.append_array(from.verts)
	into.normals.append_array(from.normals)
	into.uvs.append_array(from.uvs)
	into.colors.append_array(from.colors)
	for i in from.indices:
		into.indices.push_back(i + base)


## El satélite ve los techos oscuros y apagados: se aclaran un poco, como en la web.
static func _roof_color(b: Dictionary, seed: int) -> Color:
	if b.has("rc"):
		var rgb := int(b.rc)
		var c := Color8((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
		return Color(minf(c.r * 1.25, 1.0), minf(c.g * 1.25, 1.0), minf(c.b * 1.25, 1.0))
	return Color.html(WorldConfig.ROOF_COLORS[(seed >> 3) % WorldConfig.ROOF_COLORS.size()])


static func _area(p: PackedFloat32Array) -> float:
	var s := 0.0
	var n := p.size()
	for i in range(0, n, 2):
		var j := (i + 2) % n
		s += p[i] * p[j + 1] - p[j] * p[i + 1]
	return s * 0.5


static func _ccw(p: PackedFloat32Array) -> PackedFloat32Array:
	if _area(p) >= 0.0:
		return p
	var out := PackedFloat32Array()
	for i in range(p.size() - 2, -1, -2):
		out.append_array([p[i], p[i + 1]])
	return out


static func _centroid(p: PackedFloat32Array) -> Vector2:
	var c := Vector2.ZERO
	for i in range(0, p.size(), 2):
		c += Vector2(p[i], p[i + 1])
	return c / (p.size() / 2)


## Rectángulo orientado de la huella (lado largo = AB). rect = área de la huella / área del rectángulo.
static func _obb(p: PackedFloat32Array) -> Dictionary:
	var best := 0.0
	var u := Vector2.RIGHT
	var n := p.size()
	for i in range(0, n, 2):
		var j := (i + 2) % n
		var d := Vector2(p[j] - p[i], p[j + 1] - p[i + 1])
		if d.length() > best:
			best = d.length()
			u = d / best
	var v := Vector2(-u.y, u.x)
	var u0 := INF
	var u1 := -INF
	var v0 := INF
	var v1 := -INF
	for i in range(0, n, 2):
		var q := Vector2(p[i], p[i + 1])
		u0 = minf(u0, q.dot(u))
		u1 = maxf(u1, q.dot(u))
		v0 = minf(v0, q.dot(v))
		v1 = maxf(v1, q.dot(v))
	var L := u1 - u0
	var W := v1 - v0
	return {
		"A": u * u0 + v * v0, "B": u * u1 + v * v0, "C": u * u1 + v * v1, "D": u * u0 + v * v1,
		"L": L, "W": W, "rect": _area(p) / maxf(L * W, 0.001), "u": u, "v": v,
	}


## Pared vertical entre y0 e y1 en todo el perímetro, normales hacia afuera. `v_of(y)` da la V del atlas.
## La U decrece a lo largo del perímetro antihorario: así los avisos se leen de izquierda a derecha desde afuera.
static func _walls(batch: MeshBatch, p: PackedFloat32Array, y0: float, y1: float, color: Color, v_of: Callable, bay: float) -> void:
	var dist := 0.0
	var n := p.size()
	for i in range(0, n, 2):
		var j := (i + 2) % n
		var a := Vector2(p[i], p[i + 1])
		var b := Vector2(p[j], p[j + 1])
		var length := a.distance_to(b)
		if length < 0.05:
			continue
		var d := (b - a) / length
		var normal := Vector3(d.y, 0.0, -d.x)
		var u0 := -dist / bay
		var u1 := -(dist + length) / bay
		var a0 := batch.vertex(Vector3(a.x, y0, a.y), normal, Vector2(u0, v_of.call(y0)), color)
		var b0 := batch.vertex(Vector3(b.x, y0, b.y), normal, Vector2(u1, v_of.call(y0)), color)
		var b1 := batch.vertex(Vector3(b.x, y1, b.y), normal, Vector2(u1, v_of.call(y1)), color)
		var a1 := batch.vertex(Vector3(a.x, y1, a.y), normal, Vector2(u0, v_of.call(y1)), color)
		batch.quad(a0, b0, b1, a1, normal)
		dist += length


static func _flat_roof(batch: MeshBatch, p: PackedFloat32Array, y: float, color: Color) -> void:
	var contour := PackedVector2Array()
	for i in range(0, p.size(), 2):
		contour.push_back(Vector2(p[i], p[i + 1]))
	var tris := Geometry2D.triangulate_polygon(contour)
	if tris.is_empty():
		return
	var base := batch.verts.size()
	for v in contour:
		batch.vertex(Vector3(v.x, y, v.y), Vector3.UP, v / 6.0, color)
	for k in range(0, tris.size(), 3):
		batch.tri(base + tris[k], base + tris[k + 1], base + tris[k + 2], Vector3.UP)


static func _expand(pt: Vector2, c: Vector2, d: float) -> Vector2:
	return pt + (pt - c).normalized() * d


## Faldón plano de cuatro puntos; normal hacia arriba.
static func _quad_roof(batch: MeshBatch, pts: Array, color: Color) -> void:
	var a: Vector3 = pts[0]
	var n: Vector3 = (pts[3] - a).cross(pts[1] - a).normalized()
	if n.y < 0.0:
		n = -n
	var length: float = (pts[1] - a).length()
	var slope: float = (pts[3] - a).length()
	var uvs := [Vector2(0, 0), Vector2(length / 2.0, 0), Vector2(length / 2.0, slope / 2.0), Vector2(0, slope / 2.0)]
	var idx := []
	for k in 4:
		idx.push_back(batch.vertex(pts[k], n, uvs[k], color))
	batch.quad(idx[0], idx[1], idx[2], idx[3], n)


## Triángulo del hastial, visible por las dos caras (evita huecos si la orientación falla).
static func _gable(batch: MeshBatch, p0: Vector2, p1: Vector2, y: float, apex: Vector3, color: Color) -> void:
	var d := (p1 - p0).normalized()
	var n := Vector3(d.y, 0.0, -d.x)
	var a := batch.vertex(Vector3(p0.x, y, p0.y), n, Vector2(0, 0.5), color)
	var b := batch.vertex(Vector3(p1.x, y, p1.y), n, Vector2(0.2, 0.5), color)
	var c := batch.vertex(apex, n, Vector2(0.1, 0.5), color)
	batch.tri(a, b, c, n)
	batch.tri(a, b, c, -n)


## Techo de lámina (una o dos aguas) sobre el rectángulo orientado, con alero de 0,45 m.
static func _sloped_roof(roof: MeshBatch, wall: MeshBatch, o: Dictionary, top: float, roof_col: Color, wall_col: Color, two_water: bool) -> void:
	var c: Vector2 = (o.A + o.C) * 0.5
	var A := _expand(o.A, c, 0.45)
	var B := _expand(o.B, c, 0.45)
	var C := _expand(o.C, c, 0.45)
	var D := _expand(o.D, c, 0.45)
	var v3 := func(q: Vector2, y: float) -> Vector3: return Vector3(q.x, y, q.y)
	if two_water:
		var rise := minf(2.6, o.W * 0.22)
		var m1 := (B + C) * 0.5
		var m2 := (D + A) * 0.5
		_quad_roof(roof, [v3.call(A, top), v3.call(B, top), v3.call(m1, top + rise), v3.call(m2, top + rise)], roof_col)
		_quad_roof(roof, [v3.call(C, top), v3.call(D, top), v3.call(m2, top + rise), v3.call(m1, top + rise)], roof_col)
		_gable(wall, o.B, o.C, top, v3.call((o.B + o.C) * 0.5, top + rise), wall_col)
		_gable(wall, o.D, o.A, top, v3.call((o.D + o.A) * 0.5, top + rise), wall_col)
	else:
		# Una sola agua: alto sobre AB, bajo sobre CD
		var rise := minf(1.6, o.W * 0.12)
		_quad_roof(roof, [v3.call(D, top), v3.call(C, top), v3.call(B, top + rise), v3.call(A, top + rise)], roof_col)
		_gable(wall, o.B, o.C, top, v3.call(o.B, top + rise), wall_col)
		_gable(wall, o.D, o.A, top, v3.call(o.A, top + rise), wall_col)
		var n := Vector3(o.v.x, 0, o.v.y) * -1.0
		var a0 := wall.vertex(v3.call(o.A, top), n, Vector2(0, 0.5), wall_col)
		var b0 := wall.vertex(v3.call(o.B, top), n, Vector2(0.3, 0.5), wall_col)
		var b1 := wall.vertex(v3.call(o.B, top + rise), n, Vector2(0.3, 0.5), wall_col)
		var a1 := wall.vertex(v3.call(o.A, top + rise), n, Vector2(0, 0.5), wall_col)
		wall.quad(a0, b0, b1, a1, n)
		wall.quad(a0, b0, b1, a1, -n)


## Pretil de terraza: franja delgada alrededor de la huella, levemente sobresaliente.
static func _parapet(batch: MeshBatch, p: PackedFloat32Array, y: float, h: float, color: Color) -> void:
	var c := _centroid(p)
	var q := PackedFloat32Array()
	for i in range(0, p.size(), 2):
		var e := _expand(Vector2(p[i], p[i + 1]), c, 0.12)
		q.append_array([e.x, e.y])
	_walls(batch, q, y - 0.25, y + h, color, func(_y): return 0.02, BAY)


## Tanque de agua negro sobre la terraza (muy común en los techos colombianos).
static func _water_tank(batch: MeshBatch, at: Vector3, r: float, h: float) -> void:
	var seg := 10
	var base := batch.verts.size()
	for i in seg + 1:
		var a := TAU * i / seg
		var d := Vector3(cos(a), 0, sin(a))
		batch.vertex(at + d * r, d, Vector2.ZERO, TANK)
		batch.vertex(at + d * r * 0.95 + Vector3.UP * h, (d + Vector3.UP * 0.2).normalized(), Vector2.ZERO, TANK)
	for i in seg:
		var k := base + i * 2
		var out := Vector3(cos(TAU * (i + 0.5) / seg), 0, sin(TAU * (i + 0.5) / seg))
		batch.quad(k, k + 2, k + 3, k + 1, out)
	var lid := batch.vertex(at + Vector3.UP * (h + 0.12), Vector3.UP, Vector2.ZERO, TANK)
	for i in seg:
		batch.tri(lid, base + i * 2 + 1, base + (i + 1) * 2 + 1, Vector3.UP)


## Balcón con losa y baranda en el lado largo, en cada piso superior.
static func _balconies(batch: MeshBatch, o: Dictionary, p: PackedFloat32Array, g_top: float, top: float, color: Color) -> void:
	if o.L < 6.0:
		return
	var c := _centroid(p)
	var n: Vector2 = o.v
	if n.dot(o.A - c) < 0.0:
		n = -n
	var w: float = o.L * 0.4
	var mid: Vector2 = (o.A + o.B) * 0.5
	var dark := color * 0.8
	var y := g_top + 0.05
	while y < top - 2.5:
		var p0: Vector2 = mid - o.u * w * 0.5
		var p1: Vector2 = mid + o.u * w * 0.5
		var q0 := p0 + n * 0.9
		var q1 := p1 + n * 0.9
		var slab := PackedFloat32Array([p0.x, p0.y, p1.x, p1.y, q1.x, q1.y, q0.x, q0.y])
		if _area(slab) < 0.0:
			slab = _ccw(slab)
		_walls(batch, slab, y, y + 0.15, dark, func(_y): return 0.02, BAY)
		var t := [q0, q1, p1, p0].map(func(v: Vector2): return batch.vertex(Vector3(v.x, y + 0.15, v.y), Vector3.UP, Vector2(0, 0.02), dark))
		batch.quad(t[0], t[1], t[2], t[3], Vector3.UP)
		var rail := PackedFloat32Array([q0.x, q0.y, q1.x, q1.y, q1.x - n.x * 0.02, q1.y - n.y * 0.02, q0.x - n.x * 0.02, q0.y - n.y * 0.02])
		_walls(batch, _ccw(rail), y + 0.15, y + 1.05, RAIL, func(_y): return 0.02, BAY)
		y += 3.0
