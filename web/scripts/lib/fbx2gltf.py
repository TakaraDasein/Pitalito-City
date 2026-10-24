# Convierte el FBX de animaciones a glTF binario con Blender sin interfaz.
# Uso: blender --background --python scripts/lib/fbx2gltf.py -- <entrada.fbx> <salida.glb>
#
# Por qué hace falta: la exportación del paquete para Godot trae nombres de hueso Rigify (DEF-hips, DEF-head…),
# que NO coinciden con los de las mallas de personaje, exportadas con nombres de Unreal (pelvis, spine_01, Head…).
# La exportación para Unreal sí coincide hueso por hueso, pero viene en FBX. Se convierte aquí, una sola vez.
#
# Además: se quita la malla del maniquí (sólo hacen falta el esqueleto y los clips), se limpian los nombres de los
# clips ("Rig|Rig|Walk_Loop" → "Walk_Loop") y se descartan las curvas de los huesos de punta de los dedos, que las
# mallas no tienen y ensucian la consola del navegador.
import sys, re, bpy

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True)

# Fuera la malla: el juego usa sus propios cuerpos y ropa.
for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    bpy.data.objects.remove(obj, do_unlink=True)

END_BONE = re.compile(r'_end_[lr]"')


def channelbags(action):
    # Blender 5 guarda las curvas en capas ("slotted actions"); antes estaban en action.fcurves.
    if hasattr(action, 'fcurves'):
        return [action]
    return [cb for layer in action.layers for strip in layer.strips for cb in strip.channelbags]


for action in bpy.data.actions:
    action.name = action.name.split('|')[-1]
    for holder in channelbags(action):
        for fc in [f for f in holder.fcurves if END_BONE.search(f.data_path)]:
            holder.fcurves.remove(fc)
    action.use_fake_user = True

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_nla_strips=False,
    export_bake_animation=False,
    export_optimize_animation_size=True,
    export_skins=True,
    export_morph=False,
    export_materials='NONE',
)
print('OK', dst)
