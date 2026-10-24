#!/usr/bin/env python3
"""Configura el retarget humanoide en los .import de los personajes de Quaternius (cuerpos, ropa, pelo y clips).

sync_from_web.sh borra los .import al copiar los modelos (rsync --delete): este script los vuelve a escribir.
Cada archivo recibe el BoneMap de assets/import/quaternius_bone_map.tres en su Skeleton3D, con el renombre de
huesos al perfil humanoide, el esqueleto único "GeneralSkeleton" y el arreglo de reposo de Godot. Así todos
comparten nombres (Hips, Head, LeftFoot…) y los clips llevan rutas "%GeneralSkeleton:…" que sirven para cualquier
modelo con el mismo perfil (Mixamo, Quaternius, propios) sin código de corrección.
Uso: python3 tools/import/apply_retarget.py   (luego godot --headless --import)
"""
import json, re, struct, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHAR = ROOT / "assets/models/characters"
BONE_MAP = 'Resource("res://assets/import/quaternius_bone_map.tres")'


def gltf_json(p: Path) -> dict:
    if p.suffix == ".glb":
        b = p.read_bytes()
        n = struct.unpack("<I", b[12:16])[0]
        return json.loads(b[20:20 + n])
    return json.loads(p.read_text())


def skeleton_path(g: dict) -> str | None:
    """Ruta del Skeleton3D que crea el importador: <nodo padre de los huesos>/Skeleton3D."""
    if not g.get("skins"):
        return None
    joints = set(g["skins"][0]["joints"])
    parent = {c: i for i, n in enumerate(g["nodes"]) for c in n.get("children", [])}
    root = next(j for j in joints if parent.get(j) not in joints)
    chain, p = [], parent.get(root)
    while p is not None:
        chain.append(g["nodes"][p]["name"])
        p = parent.get(p)
    return "/".join(reversed(chain)) + "/Skeleton3D" if chain else "Skeleton3D"


def subresources(skel: str) -> str:
    return ('_subresources={\n"nodes": {\n"PATH:%s": {\n'
            '"retarget/bone_map": %s,\n'
            '"retarget/bone_renamer/rename_bones": true,\n'
            '"retarget/bone_renamer/unique_node/make_unique": true,\n'
            '"retarget/bone_renamer/unique_node/skeleton_name": "GeneralSkeleton",\n'
            '"retarget/rest_fixer/overwrite_axis": true\n'
            '}\n}\n}' % (skel, BONE_MAP))


def main() -> int:
    files = [p for p in CHAR.rglob("*") if p.suffix in (".gltf", ".glb") and "animals" not in p.parts and "enemies" not in p.parts]
    done = 0
    for f in sorted(files):
        skel = skeleton_path(gltf_json(f))
        if not skel:
            continue
        imp = f.with_name(f.name + ".import")
        sub = subresources(skel)
        if imp.exists():
            text = imp.read_text()
            text = re.sub(r"_subresources=\{.*?\n\}(?=\n[a-z])|_subresources=\{\}", lambda _m: sub, text, count=1, flags=re.S)
        else:
            text = '[remap]\n\nimporter="scene"\nimporter_version=1\n\n[params]\n\n' + sub + "\n"
        imp.write_text(text)
        done += 1
    print(f"retarget humanoide en {done} archivos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
