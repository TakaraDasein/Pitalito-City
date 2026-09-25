# Estado del proyecto

> Qué hay hoy, por qué se decidió así, qué falla y qué sigue. Actualizar al cerrar cada etapa de trabajo.

**Versión:** 0.3.0 · **Última actualización:** 2026-09-24

## Qué funciona hoy

- Mundo de Pitalito reconstruido con datos reales: 21.508 edificios (sin invadir calzadas), 21.527 árboles, 1.849 vías con nombre, 99 semáforos, relieve
  de ±12 km (montañas del Valle de Laboyos) y suelo satelital en tres niveles de detalle.
- Arranque en el Parque Principal José Hilario López, frente a la Iglesia y la Torre San Antonio (modeladas a mano).
- 6 vehículos modelados sobre fotos (Jeep Willys, taxi, camioneta de platón, chiva, motocarro, moto), con física
  arcade, pendientes reales, suspensión visual y garaje 3D para elegir, pintar y cambiar la placa.
- Tráfico IA por el carril derecho, GPS con A*, minimapa, mapa interactivo con buscador y viaje rápido.
- Menús e HUD en estilo café y guadua (principal, pausa, opciones, créditos, barra de controles en pantalla),
  presets de calidad, ciclo día/noche, lluvia.
- Verificado en Chromium con render por software (sin GPU). **Fps reales en GPU: pendiente de medir.**

## Bitácora de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-09-24 | three.js + Vite, JavaScript plano | Mundo generado por datos; publicación web simple (ver TECNOLOGIAS.md) |
| 2026-09-24 | Streaming por tiles de 250 m + LOD de toda la ciudad | 1.100+ tiles; solo se construye el entorno del jugador |
| 2026-09-24 | v0.1: calles OSM + edificios Overture + relleno procedural de manzanas | Primera versión rápida |
| 2026-09-24 | **v0.2: se abandona lo procedural; todo con datos reales** | El usuario reportó que "muchas zonas no coinciden con la vegetación, los lugares…" |
| 2026-09-24 | Datos abiertos en vez de Google Photorealistic 3D Tiles | Sin cuentas ni costos; elegido por el usuario |
| 2026-09-24 | Huellas: OSM > Google Open Buildings > Microsoft | Overture solo traía ~60 % de los techos visibles en el satélite |
| 2026-09-24 | Descartar huellas que invaden el eje de las vías | 1.262 huellas bloqueaban calles (aleros, errores de detección) |
| 2026-09-24 | Alturas GHSL × 1,6 | GHSL subestima; calibrado con fotos del parque (ver DATOS.md) |
| 2026-09-24 | Árboles por segmentación de copas | Los máximos locales simples partían un árbol grande en muchos pequeños |
| 2026-09-24 | Parque sin jardineras, monumento ni faroles inventados | Solo lo confirmado por fotos: bolardos y letrero "200" |
| 2026-09-24 | v0.3: presets de calidad, PostFX, PMREM, clima | Plan de mejora gráfica |
| 2026-09-24 | Sombras estabilizadas en vez de sombras en cascada (CSM) | CSM exige preparar cada material; se priorizó robustez |
| 2026-09-24 | Vehículos por perfil extruido (carkit) en vez de GLTF | Control total, sin binarios, citan su foto de referencia |
| 2026-09-24 | Tráfico con detalle bajo y materiales fusionados | De 14–31 a 6–13 draw calls por vehículo |
| 2026-09-24 | Menús de guadua generados en SVG | Nítidos a cualquier resolución, sin imágenes |
| 2026-09-24 | Afinar parque e iglesia con fotos a nivel de calle (may 2025) | El parque y la iglesia no se parecían: la nave es de ladrillo, la torre está en la esquina de la Calle 5, el piso tiene retícula |
| 2026-09-24 | Despeje de calzadas en el pipeline | 4.710 huellas invadían las vías; el usuario pidió "carreteras libres de casas o tiendas" |
| 2026-09-24 | Semáforos desde OSM | Dato real disponible y visibles en las fotos |
| 2026-09-24 | Fuente del parque pendiente | Existe, pero no hay foto de su diseño; no se inventa |
| 2026-09-24 | HUD en café y guadua + barra de controles en pantalla | Pedido del usuario: cambiar vehículo y clima sin teclado, estética unificada |

## Limitaciones conocidas

- **Rendimiento en GPU real sin medir.** Presupuesto en REGLAS.md; medir con la tecla B.
- El suelo satelital se ve borroso a ras de calle (0,6 m/px); el detalle procedural lo mitiga, no lo resuelve.
- Alturas por celda de 90 m, no por edificio; fachadas y forma de techos estimadas.
- Algunas huellas de Microsoft son manzanas enteras.
- Vías: ancho estimado por tipo; sin andenes ni demarcación.
- Sin peatones. Los semáforos existen (99, de OSM) pero la IA aún no los respeta ni la prelación en cruces.
- **Fuente del Parque Principal sin modelar:** falta una foto de su diseño y ubicación.
- La imagen satelital depende del servicio de Esri en vivo; sin conexión el suelo queda gris verdoso.
- Sin controles táctiles; en celular solo se puede navegar menús.
- No hay pruebas automatizadas de lógica; la verificación es visual (VERIFICACION.md).

## Hoja de ruta

**Siguiente (alto valor, bajo riesgo)**
- Medir fps en 2–3 GPUs y ajustar presets.
- Modelar la fuente del parque en cuanto haya una foto de referencia.
- Peatones en andenes y en el parque; que la IA respete semáforos y prelación en cruces.
- Hitos: Alcaldía "La Chapolera", Terminal de Transportes, Villa Olímpica, Gemelas Danzantes.

**Después**
- Misiones sobre el GPS existente (carreras de taxi, entregas de café, rutas de chiva).
- Controles táctiles.
- Mover la construcción de tiles a un Web Worker.
- Pruebas unitarias del pipeline (`src/geo/`, fusión de edificios, segmentación de copas).

**Investigación**
- Alturas por edificio con Google Open Buildings 2.5D (requiere Earth Engine).
- Fachadas reales desde fotos a nivel de calle (Mapillary, CC BY-SA).
- Fuente satelital con licencia que permita guardarla en el repositorio (para jugar sin conexión).
- Multijugador por WebSocket (el estado del vehículo ya es serializable).
