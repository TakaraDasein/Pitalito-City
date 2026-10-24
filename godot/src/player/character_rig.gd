class_name CharacterRig
extends SkeletonModifier3D
## Ajustes del esqueleto después de la animación, con los modificadores nativos de Godot (orden = orden de hijos):
##  1. este nodo: lanza un rayo bajo cada pie, guarda cuánto sube o baja el suelo ahí y baja la cadera si un pie
##     tiene que llegar más abajo (escalones, pendientes, bordillos). Mueve los objetivos de las piernas.
##  2. TwoBoneIK3D: muslo → pantorrilla → pie hasta su objetivo, con la rodilla hacia adelante.
##  3. LookAtModifier3D en el pecho y la cabeza: miran hacia donde apunta la cámara, con límites de cuello.
## Se apaga suave en el aire, nadando o sentado (`feet_enabled`, `look_enabled`).

## Diferencia máxima de suelo que se corrige con las piernas (m): más que eso es un borde, no un escalón.
const MAX_STEP := 0.45
## Por encima de este ángulo entre el frente del cuerpo y la mirada se deja de mirar (detrás no se tuerce el cuello).
const LOOK_BACK := deg_to_rad(110.0)

var feet_enabled := true
var look_enabled := true
## Punto del mundo hacia el que mira (lo pone el jugador con la cámara).
var look_point := Vector3.ZERO
## Cuerpo que los rayos ignoran (el propio jugador).
var exclude: Array[RID] = []

var _ik: TwoBoneIK3D
var _looks: Array[LookAtModifier3D] = []
var _look_target: Marker3D
var _targets: Array[Marker3D] = []
var _feet := PackedInt32Array()
var _hips := -1
var _offset := [0.0, 0.0]   # subida del suelo bajo cada pie, suavizada
var _hips_drop := 0.0
var _feet_w := 0.0
var _look_w := 0.0


## Arma la cadena de modificadores en el esqueleto del modelo. null si el esqueleto no tiene el perfil humanoide.
static func attach(skel: Skeleton3D) -> CharacterRig:
	if skel.find_bone("LeftFoot") < 0 or skel.find_bone("Head") < 0:
		return null
	var rig := CharacterRig.new()
	rig.name = "Rig"
	skel.add_child(rig)
	rig._build(skel)
	return rig


func _build(skel: Skeleton3D) -> void:
	_hips = skel.find_bone("Hips")
	_ik = TwoBoneIK3D.new()
	_ik.name = "PiernasIK"
	_ik.set_setting_count(2)
	skel.add_child(_ik)
	var model := skel.owner as Node3D
	for i in 2:
		var side := "Left" if i == 0 else "Right"
		_feet.push_back(skel.find_bone(side + "Foot"))
		var t := Marker3D.new()
		t.top_level = true
		add_child(t)
		_targets.push_back(t)
		# polo: un punto delante de la rodilla (el modelo mira a +Z local)
		var pole := Marker3D.new()
		var x := skel.get_bone_global_rest(_feet[i]).origin.x
		pole.position = Vector3(x, 0.55, 1.5)
		model.add_child(pole)
		_ik.set_root_bone_name(i, side + "UpperLeg")
		_ik.set_middle_bone_name(i, side + "LowerLeg")
		_ik.set_end_bone_name(i, side + "Foot")
		_ik.set_target_node(i, _ik.get_path_to(t))
		_ik.set_pole_node(i, _ik.get_path_to(pole))
	_look_target = Marker3D.new()
	_look_target.top_level = true
	add_child(_look_target)
	# el pecho toma una parte del giro y la cabeza el resto: se lee como girar el cuerpo, no solo el cuello
	for p: Array in [["UpperChest", 25.0, 15.0], ["Head", 55.0, 30.0]]:
		if skel.find_bone(p[0]) < 0:
			continue
		var la := LookAtModifier3D.new()
		la.name = "Mirar" + p[0]
		la.bone_name = p[0]
		# el arreglo de reposo del importador deja los huesos con +Z hacia el frente del modelo (perfil humanoide)
		la.forward_axis = SkeletonModifier3D.BONE_AXIS_PLUS_Z
		la.primary_rotation_axis = Vector3.AXIS_Y
		la.use_secondary_rotation = true
		la.use_angle_limitation = true
		la.symmetry_limitation = true
		la.primary_limit_angle = deg_to_rad(p[1]) * 2.0
		la.secondary_limit_angle = deg_to_rad(p[2]) * 2.0
		la.duration = 0.25
		la.transition_type = Tween.TRANS_SINE
		skel.add_child(la)
		la.target_node = la.get_path_to(_look_target)
		_looks.push_back(la)


func _process_modification() -> void:
	var skel := get_skeleton()
	if skel == null:
		return
	var dt := get_process_delta_time()
	var model := skel.owner as Node3D
	var xf := skel.global_transform
	var ground := model.global_position.y
	_feet_w = move_toward(_feet_w, 1.0 if feet_enabled else 0.0, dt * 4.0)
	var space := skel.get_world_3d().direct_space_state
	var feet_pos: Array[Vector3] = []
	var low := 0.0
	for i in 2:
		var p: Vector3 = xf * skel.get_bone_global_pose(_feet[i]).origin
		feet_pos.push_back(p)
		var d := 0.0
		if _feet_w > 0.0:
			var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, ground + MAX_STEP + 0.3, p.z), Vector3(p.x, ground - MAX_STEP - 0.3, p.z), 1 | 16, exclude)
			var hit := space.intersect_ray(q)
			if not hit.is_empty():
				d = clampf(hit.position.y - ground, -MAX_STEP, MAX_STEP)
		_offset[i] = lerpf(_offset[i], d, minf(1.0, dt * 14.0))
		low = minf(low, _offset[i])
	# la cadera baja lo que pida el pie más hondo; el otro pie se dobla para quedar arriba
	_hips_drop = lerpf(_hips_drop, low, minf(1.0, dt * 10.0))
	if _hips >= 0 and _feet_w > 0.0:
		var parent := skel.get_bone_parent(_hips)
		var down := Vector3(0, _hips_drop * _feet_w, 0)
		if parent >= 0:
			down = (xf.basis * skel.get_bone_global_pose(parent).basis).inverse() * (xf.basis * down)
		else:
			down = xf.basis.inverse() * down
		skel.set_bone_pose_position(_hips, skel.get_bone_pose_position(_hips) + down)
	for i in 2:
		_targets[i].global_position = feet_pos[i] + Vector3(0, _offset[i] * _feet_w, 0)
	_ik.influence = _feet_w
	# mirada: se apaga si el punto queda detrás del cuerpo
	var fwd := model.global_basis.z
	var to := look_point - (xf * skel.get_bone_global_pose(_feet[0]).origin)
	var want := look_enabled and to.length() > 0.5 and absf(Vector2(fwd.x, fwd.z).angle_to(Vector2(to.x, to.z))) < LOOK_BACK
	_look_w = move_toward(_look_w, 1.0 if want else 0.0, dt * 3.0)
	_look_target.global_position = look_point
	for la in _looks:
		la.influence = _look_w
