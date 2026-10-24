# Saca de un GLB sólo los clips de animación pedidos, con el esqueleto y sin mallas.
#
#   python3 -I scripts/lib/gltf-clips.py entrada.glb salida.glb Clip_A Clip_B …
#
# Se reescribe el binario con únicamente los datos que usan esos clips: un paquete de 8 MB con 43 clips queda en
# unos cientos de KB con los 5 que el juego necesita. Sin dependencias: el formato GLB es JSON + un binario.
import json, struct, sys

src, dst, *wanted = sys.argv[1:]
data = open(src, 'rb').read()
jlen = struct.unpack('<I', data[12:16])[0]
gltf = json.loads(data[20:20 + jlen])
blob = data[20 + jlen + 8:]

anims = [a for a in gltf['animations'] if a['name'] in wanted]
missing = set(wanted) - {a['name'] for a in anims}
if missing:
    sys.exit(f'faltan clips: {sorted(missing)}')

out_views, out_acc, out_bin = [], [], bytearray()
acc_map = {}

def copy_accessor(i):
    if i in acc_map:
        return acc_map[i]
    acc = dict(gltf['accessors'][i])
    view = gltf['bufferViews'][acc['bufferView']]
    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    comps = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[acc['type']]
    size = {5126: 4, 5125: 4, 5123: 2, 5121: 1, 5122: 2, 5120: 1}[acc['componentType']]
    stride = view.get('byteStride', comps * size)
    chunk = b''.join(data_slice(start + k * stride, comps * size) for k in range(acc['count']))
    while len(out_bin) % 4:
        out_bin.append(0)
    out_views.append({'buffer': 0, 'byteOffset': len(out_bin), 'byteLength': len(chunk)})
    out_bin.extend(chunk)
    acc['bufferView'] = len(out_views) - 1
    acc.pop('byteOffset', None)
    out_acc.append(acc)
    acc_map[i] = len(out_acc) - 1
    return acc_map[i]

def data_slice(offset, n):
    return blob[offset:offset + n]

for a in anims:
    for s in a['samplers']:
        s['input'] = copy_accessor(s['input'])
        s['output'] = copy_accessor(s['output'])

# Nodos: se conservan todos (los clips los nombran por índice), sin mallas ni pieles.
nodes = []
for n in gltf['nodes']:
    n = {k: v for k, v in n.items() if k not in ('mesh', 'skin')}
    nodes.append(n)

out = {
    'asset': gltf['asset'],
    'scene': gltf.get('scene', 0),
    'scenes': gltf['scenes'],
    'nodes': nodes,
    'animations': anims,
    'accessors': out_acc,
    'bufferViews': out_views,
    'buffers': [{'byteLength': len(out_bin)}],
}
js = json.dumps(out, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
while len(out_bin) % 4:
    out_bin.append(0)
total = 12 + 8 + len(js) + 8 + len(out_bin)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(out_bin), 0x004E4942)); f.write(out_bin)
print(f'{dst}: {len(anims)} clips, {total / 1024:.0f} KB')
