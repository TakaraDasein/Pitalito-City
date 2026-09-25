# assets/

Material fuente del proyecto. **No se sirve al navegador**: lo que usa el juego vive en `public/`.

```
assets/
└── references/                 ← referencias visuales descargadas (npm run refs:fetch)
    ├── references.json         ← metadatos: archivo, uso en el juego, autor, licencia, fuente
    ├── CREDITS.md              ← atribuciones legibles (obligatorio conservarlas: CC BY / CC BY-SA)
    ├── landmarks/
    │   ├── parque-principal/   → src/world/landmarks/ParquePrincipal.js
    │   ├── catedral/           → src/world/landmarks/CatedralSanAntonio.js
    │   └── alcaldia/           → (pendiente de modelar)
    ├── city/panoramas/         → paleta de fachadas (src/config/palette.config.js), montañas
    ├── nature/cafe/            → vegetación periférica
    ├── vehicles/
    │   ├── willys/             → src/entities/vehicles/models/willys.js
    │   ├── taxi/               → src/entities/vehicles/models/taxi.js
    │   └── chiva/              → src/entities/vehicles/models/chiva.js
    ├── identity/               → bandera, escudo, placa de nomenclatura (HUD)
    ├── ui/guadua/              → estilo de menús (src/ui/guadua/)
    └── culture/                → Gemelas Danzantes (pendiente de modelar)
```

Convención: cada módulo que modela algo a partir de una referencia la cita en su comentario de cabecera.
Para agregar una referencia, añádela a `REFERENCES` en `scripts/fetch-references.mjs` (categoría + uso)
y vuelve a correr `npm run refs:fetch`: el manifiesto y los créditos se regeneran solos.

## public/ (lo que carga el juego)

```
public/
├── world/          ← generado por npm run data:build (no editar a mano)
│   ├── manifest.json, map.json, global.json
│   └── tiles/X_Z.json
└── textures/
    ├── <material>/{color,normal,roughness}.jpg   ← PBR CC0 de ambientCG
    └── decals/                                   ← bandera y escudo de Pitalito
```
