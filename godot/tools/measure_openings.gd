extends Node3D
## Herramienta: mide el vano real (hueco por donde pasa la luz o la gente) de las piezas de pared del Building Kit,
## lanzando rayos a través de la pieza en una rejilla de 2 cm. Imprime ancho y alturas del hueco (metros del kit).
## Uso: godot --headless res://tools/measure_openings.tscn
const PIECES := ["wall-window-square", "wall-window-square-detailed", "wall-window-round", "wall-window-round-detailed",
	"wall-window-wide-square", "wall-window-wide-square-detailed", "wall-window-wide-round", "wall-window-wide-round-detailed",
	"wall-doorway-square", "wall-doorway-round", "wall-doorway-wide-square", "wall-doorway-wide-round"]

func _ready() -> void:
	# Sin física: los triángulos de la malla proyectados sobre el plano de la pared (z, y); el vano es la región de
	# la rejilla que ningún triángulo cubre, dentro del contorno de la pieza.
	for p in PIECES:
		var n: Node3D = load("res://assets/models/buildings/%s.glb" % p).instantiate()
		var tris := []
		for mi: MeshInstance3D in n.find_children("*", "MeshInstance3D", true, false):
			var faces: PackedVector3Array = mi.mesh.get_faces()
			for i in range(0, faces.size(), 3):
				tris.push_back([Vector2(faces[i].z, faces[i].y), Vector2(faces[i + 1].z, faces[i + 1].y), Vector2(faces[i + 2].z, faces[i + 2].y)])
		n.free()
		var zmin := INF
		var zmax := -INF
		var ymin := INF
		var ymax := -INF
		var half := 2.0 if p.contains("wide") else 1.0
		for zi in range(int(-half * 50) + 2, int(half * 50) - 1):
			for yi in range(1, 119):
				var q := Vector2(zi * 0.02, yi * 0.02)
				var solid := false
				for t: Array in tris:
					if Geometry2D.point_is_inside_triangle(q, t[0], t[1], t[2]):
						solid = true
						break
				if not solid:
					zmin = minf(zmin, q.x); zmax = maxf(zmax, q.x); ymin = minf(ymin, q.y); ymax = maxf(ymax, q.y)
		print("%s: ancho %.2f (z %.2f…%.2f) · alto %.2f…%.2f" % [p, zmax - zmin, zmin, zmax, ymin, ymax])
	get_tree().quit()
