# Pitalito City

Pitalito, Huila, reconstruido con datos geográficos reales: un juego de mundo abierto cuyo fin es reconstruir la
historia del Valle de Laboyos. Dos versiones en el mismo repositorio, cada una en su carpeta:

| Carpeta | Motor | Estado |
|---|---|---|
| [`web/`](web/) | three.js 0.170 + Vite | Versión completa: mundo, vehículos, tráfico, combate, supervivencia, historia. **Dueña del pipeline de datos.** |
| [`godot/`](godot/) | Godot 4.7 (Forward+, Jolt) | Versión nueva: mundo real transmitido en hilos, jugador animado, carro con física. Crece hacia la paridad. |

```
web/scripts  →  web/public/{world,models,textures}  →  web (navegador)
                                 └─ godot/tools/sync_from_web.sh  →  godot
```

Los datos (OSM, Overture, Google Open Buildings, Copernicus, Meta/WRI) y los modelos (Quaternius, Kenney…) se
descargan y procesan **una sola vez**, en `web/`, con su fuente y licencia registradas. Godot usa esa misma salida.

- Empezar con la web: [web/README.md](web/README.md)
- Empezar con Godot: [godot/README.md](godot/README.md)
- Reglas del proyecto (valen para las dos): [web/docs/REGLAS.md](web/docs/REGLAS.md)
