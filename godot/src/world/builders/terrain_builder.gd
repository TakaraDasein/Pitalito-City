class_name TerrainBuilder
## Bloques del relieve real (Copernicus GLO-30) a partir de la rejilla de WorldData.
## Constructor puro: `step` 1 = resolución completa (25 m) con colisión; step > 1 = lejano, sin colisión.


static func build(cx: int, cz: int, step: int, world: Node) -> MeshBatch:
	var batch := MeshBatch.new(step == 1)
	var cells := WorldConfig.TERRAIN_CHUNK_CELLS
	var n: int = world.terrain_size
	var cell: float = world.terrain_cell
	var mn: float = world.terrain_min
	var i0 := cx * cells
	var j0 := cz * cells
	var i1 := mini(i0 + cells, n - 1)
	var j1 := mini(j0 + cells, n - 1)
	if i0 >= i1 or j0 >= j1:
		return batch
	var cols := 0
	var rows := 0
	for j in range(j0, j1 + 1, step):
		rows += 1
		cols = 0
		for i in range(i0, i1 + 1, step):
			cols += 1
			var x := mn + i * cell
			var z := mn + j * cell
			# Normal por diferencias centrales: suave aunque el bloque sea lejano
			var dx: float = world.grid_height(i + step, j) - world.grid_height(i - step, j)
			var dz: float = world.grid_height(i, j + step) - world.grid_height(i, j - step)
			var normal := Vector3(-dx, 2.0 * step * cell, -dz).normalized()
			batch.vertex(Vector3(x, world.grid_height(i, j), z), normal, Vector2(x, z) / 8.0)
	for r in rows - 1:
		for c in cols - 1:
			var a := r * cols + c
			batch.quad(a, a + 1, a + cols + 1, a + cols, Vector3.UP)
	return batch


static func chunk_count(world: Node) -> int:
	return ceili(float(world.terrain_size - 1) / WorldConfig.TERRAIN_CHUNK_CELLS)


static func chunk_of(x: float, z: float, world: Node) -> Vector2i:
	var size: float = WorldConfig.TERRAIN_CHUNK_CELLS * world.terrain_cell
	return Vector2i(floori((x - world.terrain_min) / size), floori((z - world.terrain_min) / size))
