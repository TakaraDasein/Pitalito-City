class_name WaterBuilder
## Ríos y quebradas reales (OSM waterway: río 14 m, quebrada 5 m, canal 2,5 m; el ancho es el de la clase, ESTIMADO).
## Cinta sobre el cauce con UV para el shader: x a lo ancho (0..1), y a lo largo en metros (el flujo avanza en +y,
## en el sentido en que OSM dibuja el cauce, que es aguas abajo). La superficie va un poco sobre el relieve y se
## suaviza a lo largo: el modelo de elevación tiene ruido de metros y el agua no puede subir y bajar a saltos.
## Devuelve la malla y los tramos (para la flotación). Constructor puro: corre en hilos.

const LIFT := 0.5         # superficie sobre el relieve del cauce (m)
const DEPTH := {14.0: 2.2, 5.0: 1.2, 2.5: 0.6}   # profundidad ESTIMADA por clase (m)


static func build(tile: Dictionary, world: Node) -> Dictionary:
	var batch := MeshBatch.new()
	var segs := [] # [a: Vector3, b: Vector3, half_width, depth] (a, b sobre la superficie)
	for w: Dictionary in tile.get("water", []):
		var p: Array = w.p
		var n := p.size() / 2
		if n < 2:
			continue
		var hw: float = float(w.get("w", 5.0)) * 0.5
		var depth: float = DEPTH.get(float(w.get("w", 5.0)), 1.0)
		# alturas suavizadas (media móvil de 5) y nunca subiendo aguas abajo más de 5 cm por tramo
		var raw := []
		for k in n:
			raw.push_back(world.height(p[k * 2], p[k * 2 + 1]) + LIFT)
		var ys := []
		for k in n:
			var acc := 0.0
			var cnt := 0
			for j in range(maxi(0, k - 2), mini(n, k + 3)):
				acc += raw[j]
				cnt += 1
			ys.push_back(acc / cnt)
		for k in range(1, n):
			ys[k] = minf(ys[k], ys[k - 1] + 0.05)
		# …pero pegada al cauce: a lo largo de 40 km de Guarapas la regla de arriba se acumula, y el agua nunca puede
		# quedar bajo el suelo (el satélite y la grama la tapaban): siempre ≥ 20 cm sobre el relieve
		for k in n:
			ys[k] = clampf(ys[k], float(raw[k]) - (LIFT - 0.2), float(raw[k]) + 0.3)
		var dist := 0.0
		var prev_l := -1
		var prev_r := -1
		for k in n:
			var c := Vector2(p[k * 2], p[k * 2 + 1])
			var dir := Vector2.ZERO
			if k > 0:
				dir += (c - Vector2(p[k * 2 - 2], p[k * 2 - 1])).normalized()
			if k < n - 1:
				dir += (Vector2(p[k * 2 + 2], p[k * 2 + 3]) - c).normalized()
			dir = dir.normalized()
			if k > 0:
				dist += c.distance_to(Vector2(p[k * 2 - 2], p[k * 2 - 1]))
			var side := Vector2(-dir.y, dir.x) * hw
			var y: float = ys[k]
			var il := batch.vertex(Vector3(c.x + side.x, y, c.y + side.y), Vector3.UP, Vector2(0.0, dist))
			var ir := batch.vertex(Vector3(c.x - side.x, y, c.y - side.y), Vector3.UP, Vector2(1.0, dist))
			if prev_l >= 0:
				batch.quad(prev_l, prev_r, ir, il, Vector3.UP)
				var a := Vector2(p[k * 2 - 2], p[k * 2 - 1])
				segs.push_back([Vector3(a.x, ys[k - 1], a.y), Vector3(c.x, y, c.y), hw, depth])
			prev_l = il
			prev_r = ir
	return {"mesh": batch, "segs": segs}
