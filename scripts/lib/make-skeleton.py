# Genera un modelo de esqueleto humano a partir del armature del personaje.
#
#   blender --background --python scripts/lib/make-skeleton.py -- <base.gltf> <salida.glb>
#
# Por qué se genera en vez de descargarse: los paquetes de monstruos traen su propio armature y sus propias
# animaciones, así que un esqueleto descargado no serviría con los 45 clips ni con el sistema de combate. Aquí se
# construye la geometría **sobre el mismo esqueleto de 65 huesos** que ya usan el jugador y la ropa: cada pieza va
# pegada al 100 % a su hueso, así que hereda todas las animaciones sin tocar nada.
#
# Resultado: `public/models/characters/enemies/skeleton.glb`, un cuerpo de huesos (costillar, pelvis, cráneo con
# cuencas y mandíbula) que se viste con la misma ropa modular que cualquier personaje.
import sys, bpy, bmesh
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
# Fuera la malla original: sólo interesa el armature.
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)

# Grosor de cada hueso, por familia. Los dedos y los huesos de punta se omiten o van muy finos.
GROSOR = [
    ('pelvis', 0.055), ('spine_', 0.040), ('neck_', 0.022), ('clavicle_', 0.018),
    ('upperarm_', 0.030), ('lowerarm_', 0.024), ('hand_', 0.018),
    ('thigh_', 0.045), ('calf_', 0.034), ('foot_', 0.026), ('ball_', 0.020),
    ('index_', 0.007), ('middle_', 0.007), ('pinky_', 0.006), ('ring_', 0.006), ('thumb_', 0.008),
]
OMITIR = ('root', 'Head', 'ik_', '_end_', '_leaf_')


def grosor(name):
    for pre, r in GROSOR:
        if name.startswith(pre):
            return r
    return None


bm = bmesh.new()
huesos = arm.data.bones


def hueso_geom(head, tail, r):
    """Un hueso: prisma que se estrecha hacia la punta, con los extremos redondeados (las epífisis).

    Los huesos finos (los dedos) van sin epífisis y con menos lados: son cuarenta de los sesenta y cinco y a
    tamaño de juego no se distinguen, pero se llevaban la mayor parte de los triángulos."""
    d = (tail - head)
    largo = d.length
    if largo < 1e-4:
        return
    fino = r < 0.012
    rot = Vector((0, 1, 0)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    base = Matrix.Translation(head) @ rot
    # Caña
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=4 if fino else 6,
                                radius1=r, radius2=r * 0.78, depth=largo)
    m = base @ Matrix.Translation((0, largo / 2, 0)) @ Matrix.Rotation(1.5707963, 4, 'X')
    bmesh.ops.transform(bm, matrix=m, verts=res['verts'])
    if fino:
        return
    # Cabezas del hueso
    for t, rr in ((0.0, r * 1.25), (1.0, r * 1.05)):
        s = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=rr)
        bmesh.ops.transform(bm, matrix=base @ Matrix.Translation((0, largo * t, 0)), verts=s['verts'])


for b in huesos:
    if any(k in b.name for k in OMITIR):
        continue
    r = grosor(b.name)
    if r:
        hueso_geom(b.head_local.copy(), b.tail_local.copy(), r)

# Costillar: cada costilla es un arco de cubitos alrededor de la columna. (Con aros de aristas no se veía nada:
# `create_circle` no genera caras.) Se abren por delante, como las costillas de verdad.
col = [huesos[n] for n in ('spine_01', 'spine_02', 'spine_03') if n in huesos]
if col:
    import math
    ini, fin = col[0].head_local.copy(), col[-1].tail_local.copy()
    SEG = 9
    for i in range(7):
        t = 0.14 + i * 0.125
        c = ini.lerp(fin, t)
        rx = 0.135 * (1 - abs(t - 0.40) * 0.8)     # ancho (de hombro a hombro)
        rz = 0.098 * (1 - abs(t - 0.40) * 0.8)     # fondo (de pecho a espalda)
        caida = 0.035 * t                           # las costillas bajan hacia el esternón
        for k in range(SEG):
            # De la espalda (0) hacia el frente, por los dos lados; se deja abierto justo al frente.
            a = math.pi * (0.10 + 0.80 * k / (SEG - 1))
            for lado in (-1, 1):
                px = math.sin(a) * rx * lado
                pz = -math.cos(a) * rz
                py = -caida * (k / (SEG - 1)) ** 2
                seg = bmesh.ops.create_cube(bm, size=1.0)
                m = (Matrix.Translation(c + Vector((px, py, pz)))
                     @ Matrix.Rotation(-a * lado, 4, 'Y')
                     @ Matrix.Diagonal((0.030, 0.014, 0.014, 1)).to_4x4())
                bmesh.ops.transform(bm, matrix=m, verts=seg['verts'])
    # Esternón
    e = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(ini.lerp(fin, 0.42) + Vector((0, -0.02, -0.095)))
                        @ Matrix.Diagonal((0.042, 0.20, 0.016, 1)).to_4x4(), verts=e['verts'])

# Cráneo y mandíbula, sobre el hueso de la cabeza.
if 'Head' in huesos:
    h = huesos['Head']
    centro = h.head_local.lerp(h.tail_local, 0.62)
    craneo = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=9, radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centro) @ Matrix.Diagonal((0.082, 0.098, 0.092, 1)).to_4x4(),
                        verts=craneo['verts'])
    # Cuencas y nariz: van en un material oscuro aparte, si no se pierden dentro del cráneo.
    cuencas = []
    for lado in (-1, 1):
        o = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.029)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(centro + Vector((lado * 0.036, -0.010, -0.068))),
                            verts=o['verts'])
        cuencas += o['verts']
    n = bmesh.ops.create_cone(bm, cap_ends=True, segments=3, radius1=0.016, radius2=0.0, depth=0.03)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centro + Vector((0, -0.040, -0.086)))
                        @ Matrix.Rotation(3.14159, 4, 'X'), verts=n['verts'])
    cuencas += n['verts']
    OSCURO = set(v for v in cuencas)
    # Mandíbula
    j = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centro + Vector((0, -0.075, -0.030)))
                        @ Matrix.Diagonal((0.062, 0.030, 0.085, 1)).to_4x4(), verts=j['verts'])

# Las caras de las cuencas llevan el segundo material.
try:
    for f in bm.faces:
        if all(v in OSCURO for v in f.verts):
            f.material_index = 1
except NameError:
    pass

me = bpy.data.meshes.new('Esqueleto')
bm.to_mesh(me)
bm.free()
obj = bpy.data.objects.new('Esqueleto', me)
bpy.context.collection.objects.link(obj)

# Hueso blanco, mate.
mat = bpy.data.materials.new('MI_Hueso')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.86, 0.83, 0.74, 1)
bsdf.inputs['Roughness'].default_value = 0.72
if 'Metallic' in bsdf.inputs:
    bsdf.inputs['Metallic'].default_value = 0.0
me.materials.append(mat)

# Segundo material: el hueco de las cuencas y la nariz.
oscuro = bpy.data.materials.new('MI_Cuenca')
oscuro.use_nodes = True
b2 = oscuro.node_tree.nodes['Principled BSDF']
b2.inputs['Base Color'].default_value = (0.05, 0.045, 0.04, 1)
b2.inputs['Roughness'].default_value = 0.9
me.materials.append(oscuro)

# Cada vértice se pega al hueso más cercano: como la geometría ES el hueso, el reparto es exacto.
for b in huesos:
    obj.vertex_groups.new(name=b.name)
centros = [(b.name, (b.head_local + b.tail_local) / 2) for b in huesos if not any(k in b.name for k in ('root', 'ik_'))]
for v in me.vertices:
    mejor = min(centros, key=lambda c: (c[1] - v.co).length_squared)[0]
    obj.vertex_groups[mejor].add([v.index], 1.0, 'REPLACE')

obj.parent = arm
mod = obj.modifiers.new('Armature', 'ARMATURE')
mod.object = arm

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_skins=True, export_animations=False,
                          export_morph=False, use_selection=True)
print('OK', dst, len(me.vertices), 'vertices')
