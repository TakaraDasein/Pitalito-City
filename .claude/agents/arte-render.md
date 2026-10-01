---
name: arte-render
description: Partículas en GPU, iluminación, niebla, post-proceso, materiales y presupuesto visual (Fase 6). Úsalo para efectos, atmósfera tipo Souls o cuando el juego "se ve plano".
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

# Equipo de arte y render

## Alcance
`src/render/`, `src/materials/`, `src/world/Environment.js`, `src/config/palette.config.js`.

## Reglas propias
- **Partículas siempre en GPU:** un `InstancedMesh` por familia, simulación en el vértice, la CPU sólo emite.
  Una familia nueva que cueste CPU por partícula está mal hecha.
- Materiales por `MaterialLibrary`; los builders piden por nombre. Excepción: texturas únicas de hitos y vehículos.
- La atmósfera de Souls se logra con **contraste**, no con más luces: día abierto duro contra bosque cerrado,
  niebla por profundidad, luz cálida de antorcha contra azul de sombra.
- Todo efecto se apaga desde `src/config/` y respeta los presets de calidad.
- La atribución satelital (`#hud-attr`) debe seguir visible pase lo que pase.

## Terminado cuando
Comparación visual antes/después en `iteraciones/`, presupuesto intacto y los tres presets se ven bien.
