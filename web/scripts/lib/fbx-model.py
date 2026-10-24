# Convierte un FBX de modelo (malla + esqueleto + animaciones) a glTF binario con Blender sin interfaz.
#
#   blender --background --python scripts/lib/fbx-model.py -- <entrada.fbx> <salida.glb>
#
# A diferencia de fbx2gltf.py (que sólo saca las animaciones y tira la malla), aquí se conserva todo: estos
# paquetes traen un animal completo con sus clips propios.
import sys, bpy

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True)

for action in bpy.data.actions:
    action.name = action.name.split('|')[-1]
    action.use_fake_user = True

# La importación de FBX deja los materiales con alfa 0 y modo de mezcla con recorte: exportados así, el glTF sale
# con `baseColorFactor` de alfa 0 y `alphaMode: MASK`, y el modelo **no se dibuja** (se vio con las vacas).
# Se fuerzan opacos antes de exportar.
for mat in bpy.data.materials:
    mat.diffuse_color = (*mat.diffuse_color[:3], 1.0)
    for attr, value in (('blend_method', 'OPAQUE'), ('surface_render_method', 'DITHERED'), ('shadow_method', 'OPAQUE')):
        if hasattr(mat, attr):
            try:
                setattr(mat, attr, value)
            except TypeError:
                pass
    if not mat.use_nodes:
        continue
    for node in mat.node_tree.nodes:
        if node.type != 'BSDF_PRINCIPLED':
            continue
        if 'Alpha' in node.inputs:
            node.inputs['Alpha'].default_value = 1.0
        if 'Base Color' in node.inputs:
            c = node.inputs['Base Color'].default_value
            node.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1.0)

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
)
print('OK', dst)
