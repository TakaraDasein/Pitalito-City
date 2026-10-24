extends SceneTree
## Herramienta: imprime la jerarquía de una escena importada.
## Uso: godot --headless --script tools/inspect_scene.gd -- res://ruta.glb
func _init() -> void:
	for path in OS.get_cmdline_user_args():
		var s: Node = load(path).instantiate()
		print("== ", path)
		_dump(s, 0)
		s.free()
	quit()

func _dump(n: Node, d: int) -> void:
	var extra := ""
	if n is Skeleton3D: extra = " huesos=%d raíz=%s" % [n.get_bone_count(), n.get_bone_name(0)]
	if n is AnimationPlayer: extra = " libs=%s anims=%d" % [n.get_animation_library_list(), n.get_animation_list().size()]
	if n is MeshInstance3D: extra = " aabb=%s" % n.get_aabb()
	if n is Node3D: extra += " pos=%s" % n.position
	print("  ".repeat(d), n.name, " (", n.get_class(), ")", extra)
	if d < 3:
		for c in n.get_children(): _dump(c, d + 1)
