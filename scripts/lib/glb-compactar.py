# Compacta un GLB con texturas para la web: reduce cada imagen a `lado` px y la exporta en JPG.
#
#   blender --background --python scripts/lib/glb-compactar.py -- <entrada.glb> <salida.glb> [lado=512]
#
# Las armas de Styloo traen texturas PNG grandes (1,2–1,8 MB por arma); en la mano de un personaje que ocupa
# media pantalla, 512 px sobran. No se toca la geometría.
import sys, bpy

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
lado = int(argv[2]) if len(argv) > 2 else 512

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for img in bpy.data.images:
    if img.size[0] > lado or img.size[1] > lado:
        k = lado / max(img.size[0], img.size[1])
        img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85)
