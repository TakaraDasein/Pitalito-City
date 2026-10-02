---
name: animacion-personajes
description: Rig, animaciones, máquina de estados de animación y pantalla de creación de personaje (Fases 1 y 2). Úsalo para cargar el GLB con esqueleto, mezclar clips, enganchar animaciones a vehículos y bancas, o construir el editor de personaje.
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

# Equipo de animación y personajes

## Alcance
`src/entities/character/`, `src/entities/skinning/`, `src/ui/CharacterCreator.js`,
`src/config/characters.config.js`, `assets/models/`.

## Lo que ya está verificado (no lo vuelvas a investigar)
`assets/models/animation-library.glb` (CC0, Quaternius): **53 huesos** estilo Rigify (`DEF-hips`, `DEF-spine.001`,
`DEF-upper_arm.L`…), **46 clips**. Incluye `Roll`, `Sword_Attack`, `Punch_Jab/Cross`, `Hit_Chest`, `Hit_Head`,
`Death01`, `Pistol_*`, `Driving_Loop`, `Sitting_Enter/Idle/Exit`, `Interact`. Detalle en `docs/ASSETS_3D.md`.

## Reglas propias
- Un `AnimationMixer` por personaje, pero **LOD de animación**: lejos baja de 30 a 10 a 5 fps de mezcla.
- Transiciones con `crossFadeTo`; nunca cortes secos entre estados.
- El sombrero aguadeño y la ruana se enganchan a huesos (`DEF-head`, `DEF-spine.003`), no se funden a la malla.
- Reutiliza antes de crear: si un clip existente sirve, se usa; no se anima a mano sin justificarlo.
- Presupuesto: ≤ 3.000 triángulos y ≤ 4 draw calls por personaje.

## Terminado cuando
`pnpm build` pasa, hay captura en `iteraciones/`, y las medidas siguen dentro del presupuesto de REGLAS.md.
