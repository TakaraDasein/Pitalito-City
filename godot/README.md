# Pitalito — versión Godot

Mundo abierto de Pitalito, Huila, en **Godot 4.7** (Forward+, Jolt Physics, GDScript tipado), construido con los
mismos datos reales y modelos de la versión web.

## Arrancar

```bash
# 1. Datos y modelos: los produce la versión web (una vez, o cuando cambien)
cd ../web && pnpm install && pnpm setup     # o solo pnpm data:build si ya hay datos crudos
# 2. Traerlos a Godot
cd ../godot && ./tools/sync_from_web.sh
# 3. Importar y jugar
godot --headless --import
godot                                       # o abrir la carpeta en el editor y F5
```

## Controles

| A pie | Manejando |
|---|---|
| WASD moverse · Shift correr · Espacio saltar | W/S acelerar y frenar · A/D girar · Espacio freno |
| F subir al carro (a menos de 5 m) | F bajarse |
| Ratón: cámara · Esc soltar el ratón | |

## Qué hay

- Relieve real del Valle de Laboyos (±12 km), cercano con colisión y lejano en todo el valle.
- Edificios, calles y árboles reales, transmitidos por tiles de 250 m construidos en hilos.
- Jugador con cuerpo y animaciones de Quaternius, cámara en tercera persona.
- Carro con física de Godot (suspensión y tracción por rueda).
- HUD café y guadua con ubicación geográfica real y atribución de los datos.

La arquitectura, las decisiones y lo que falta están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
