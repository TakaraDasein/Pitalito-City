"""Achica las texturas de un GLB sin re-exportarlo: decodifica cada imagen incrustada, la reduce a `lado` px y la
vuelve a guardar (JPG si no usa transparencia, PNG si sí), y rearma el buffer binario. La geometría, la piel y los
huesos quedan byte a byte como venían.

    python3 scripts/lib/glb-texturas.py <entrada.glb> <salida.glb> [lado=1024]

Por qué no glb-compactar.py: re-exportar con Blender un GLB que ya trae esqueleto rompió el soldado de Sketchfab
(en Godot la malla salía en su pose de origen, acostada y gigante). Para los FBX sí hace falta Blender (convertir).
"""
import io
import json
import struct
import sys

from PIL import Image


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, _ver, _length = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF", "no es un GLB"
    off = 12
    doc, binary = None, b""
    while off < len(data):
        clen, ctype = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            doc = json.loads(chunk)
        elif ctype == 0x004E4942:
            binary = chunk
        off += 8 + clen
    return doc, binary


def write_glb(path, doc, binary):
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    binary += b"\0" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    lado = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
    doc, binary = read_glb(src)
    views = doc.get("bufferViews", [])
    # nuevo contenido de cada bufferView que sea imagen
    replace = {}
    for img in doc.get("images", []):
        bv = img.get("bufferView")
        if bv is None:
            continue
        v = views[bv]
        raw = binary[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
        im = Image.open(io.BytesIO(raw))
        alpha = im.mode in ("RGBA", "LA", "P") and (im.convert("RGBA").getextrema()[3][0] < 250)
        if max(im.size) > lado:
            k = lado / max(im.size)
            im = im.resize((max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k))), Image.LANCZOS)
        out = io.BytesIO()
        if alpha:
            im.convert("RGBA").save(out, "PNG", optimize=True)
            img["mimeType"] = "image/png"
        else:
            im.convert("RGB").save(out, "JPEG", quality=85)
            img["mimeType"] = "image/jpeg"
        replace[bv] = out.getvalue()
    # rearmar el binario con cada vista en su sitio (alineadas a 4 bytes)
    new = bytearray()
    for i, v in enumerate(views):
        if v.get("buffer", 0) != 0:
            continue
        chunk = replace.get(i)
        if chunk is None:
            chunk = binary[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
        new += b"\0" * ((4 - len(new) % 4) % 4)
        v["byteOffset"] = len(new)
        v["byteLength"] = len(chunk)
        new += chunk
    doc["buffers"][0]["byteLength"] = len(new)
    write_glb(dst, doc, bytes(new))
    print(f"{src} → {dst}: {len(replace)} texturas a {lado} px")


if __name__ == "__main__":
    main()
