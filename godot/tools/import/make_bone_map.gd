extends SceneTree
## Herramienta: genera res://assets/import/quaternius_bone_map.tres, el mapa del esqueleto de Quaternius (nombres
## de Unreal) al perfil humanoide de Godot. Lo usan los .import de cuerpos, ropa, pelo y clips (ver
## tools/import/apply_retarget.py). Uso: godot --headless --script res://tools/import/make_bone_map.gd

const MAP := {
	"Root": "root", "Hips": "pelvis", "Spine": "spine_01", "Chest": "spine_02", "UpperChest": "spine_03",
	"Neck": "neck_01", "Head": "Head",
}


func _init() -> void:
	var bm := BoneMap.new()
	bm.profile = SkeletonProfileHumanoid.new()
	var m := MAP.duplicate()
	for side: Array in [["Left", "l"], ["Right", "r"]]:
		var S: String = side[0]
		var s: String = side[1]
		m[S + "Shoulder"] = "clavicle_" + s
		m[S + "UpperArm"] = "upperarm_" + s
		m[S + "LowerArm"] = "lowerarm_" + s
		m[S + "Hand"] = "hand_" + s
		m[S + "UpperLeg"] = "thigh_" + s
		m[S + "LowerLeg"] = "calf_" + s
		m[S + "Foot"] = "foot_" + s
		m[S + "Toes"] = "ball_" + s
		m[S + "ThumbMetacarpal"] = "thumb_01_" + s
		m[S + "ThumbProximal"] = "thumb_02_" + s
		m[S + "ThumbDistal"] = "thumb_03_" + s
		for f: Array in [["Index", "index"], ["Middle", "middle"], ["Ring", "ring"], ["Little", "pinky"]]:
			m[S + f[0] + "Proximal"] = "%s_01_%s" % [f[1], s]
			m[S + f[0] + "Intermediate"] = "%s_02_%s" % [f[1], s]
			m[S + f[0] + "Distal"] = "%s_03_%s" % [f[1], s]
	for k: String in m:
		bm.set_skeleton_bone_name(k, m[k])
	DirAccess.make_dir_recursive_absolute("res://assets/import")
	print(ResourceSaver.save(bm, "res://assets/import/quaternius_bone_map.tres"))
	quit()
