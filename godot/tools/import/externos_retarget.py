#!/usr/bin/env python3
"""Retarget humanoide de los modelos externos (Sketchfab) con esqueleto de bípedo: así usan la biblioteca de clips
del juego (caminar, correr, espada, pistola, recibir, morir) como el jugador.

Cada modelo trae su propio sistema de nombres: Character Creator (CC_Base_*), el bípedo de 3ds Max (Bip001_*) o el
de Valve (ValveBiped.Bip01_*). Aquí se normaliza el nombre (sin prefijo ni sufijo numérico) y se busca cada hueso
del perfil humanoide de Godot; se genera un BoneMap por modelo en assets/import/externos/ y se aplica en su
.import (subresources del Skeleton3D, como apply_retarget.py). Los huesos «*_scaleCompensation» (Agris) se saltan.

Uso: python3 tools/import/externos_retarget.py   (lo llama tools/sync_from_web.sh). Después: godot --headless --import
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from apply_retarget import gltf_json, skeleton_path  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
EXT = ROOT / "assets/models/externos"
OUT = ROOT / "assets/import/externos"
# Los humanoides (el Hojarasquín tiene cola y el resto son animales: usan sus propios clips)
HUMANOIDES = ["enemigo/saqueador", "jefe/jefa-agris", "mito/madremonte", "jefe/jefe-tvman"]

# Perfil humanoide de Godot → nombres normalizados posibles, en orden de preferencia
PERFIL = {
    "Hips": ["pelvis"],
    "Spine": ["waist", "spine"],
    "Chest": ["spine01", "spine1"],
    "UpperChest": ["spine02", "spine2"],
    "Neck": ["necktwist01", "neck", "neck1"],
    "Head": ["head", "head1"],
}
for side, s in (("Left", "l"), ("Right", "r")):
    PERFIL.update({
        f"{side}Shoulder": [f"{s}_clavicle"], f"{side}UpperArm": [f"{s}_upperarm"], f"{side}LowerArm": [f"{s}_forearm"],
        f"{side}Hand": [f"{s}_hand"], f"{side}UpperLeg": [f"{s}_thigh"], f"{side}LowerLeg": [f"{s}_calf"],
        f"{side}Foot": [f"{s}_foot"], f"{side}Toes": [f"{s}_toebase", f"{s}_toe0"],
    })


def normal(name: str) -> str:
    n = name.lower().replace(" ", "_")
    for pre in ("cc_base_", "valvebiped.bip01_", "bip001_", "bip01_"):
        if n.startswith(pre):
            n = n[len(pre):]
    return re.sub(r"_\d+$", "", n)


def bone_map(joints: list[str]) -> dict[str, str]:
    found = {}
    by_norm = {}
    for j in joints:
        if "scalecompensation" in j.lower():
            continue
        by_norm.setdefault(normal(j), j)
    for prof, options in PERFIL.items():
        for o in options:
            if o in by_norm:
                found[prof] = by_norm[o]
                break
    return found


def write_map(name: str, m: dict[str, str]) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{name}.tres"
    lines = ['[gd_resource type="BoneMap" format=3]', "", '[sub_resource type="SkeletonProfileHumanoid" id="perfil"]', "",
             "[resource]", 'profile = SubResource("perfil")']
    lines += [f'bone_map/{k} = &"{v}"' for k, v in m.items()]
    p.write_text("\n".join(lines) + "\n")
    return p


def main() -> int:
    done = 0
    for rel in HUMANOIDES:
        f = EXT / f"{rel}.glb"
        if not f.exists():
            continue
        g = gltf_json(f)
        joints = [g["nodes"][j]["name"] for j in g["skins"][0]["joints"]]
        m = bone_map(joints)
        missing = [k for k in PERFIL if k not in m]
        res = write_map(f.stem, m)
        # Godot cambia los puntos de los nombres de nodo por «_» (Mark_1.fbx → Mark_1_fbx)
        skel = skeleton_path(g).replace(".", "_")
        imp = f.with_name(f.name + ".import")
        sub = ('_subresources={\n"nodes": {\n"PATH:%s": {\n'
               '"retarget/bone_map": Resource("res://%s"),\n'
               '"retarget/bone_renamer/rename_bones": true,\n'
               '"retarget/bone_renamer/unique_node/make_unique": true,\n'
               '"retarget/bone_renamer/unique_node/skeleton_name": "GeneralSkeleton",\n'
               '"retarget/rest_fixer/overwrite_axis": true\n'
               '}\n}\n}') % (skel, res.relative_to(ROOT))
        if imp.exists():
            text = re.sub(r"_subresources=\{.*?\n\}(?=\n[a-z])|_subresources=\{\}", lambda _m: sub, imp.read_text(), count=1, flags=re.S)
        else:
            text = '[remap]\n\nimporter="scene"\nimporter_version=1\n\n[params]\n\n' + sub + "\n"
        imp.write_text(text)
        print(f"{rel}: {len(m)} huesos del perfil" + (f" (faltan {', '.join(missing)})" if missing else ""))
        done += 1
    print(f"retarget de externos en {done} modelos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
