# 02 · Creación de personaje y mallas reales (v0.5.0 — 2026-09-30)

**Fase 2 del [plan](../../docs/PLAN_JUEGO.md).** El maniquí se cambia por un personaje de verdad — cuerpo, piel,
pelo, ropa y sombrero — y se puede elegir todo antes de jugar, con el oficio como clase de origen.

## Qué cambió

### Pipeline de modelos: 423 MB → 12,4 MB
- **`scripts/lib/itch.mjs`** — resuelve la descarga de los paquetes CC0 de itch.io (cookie, csrf, enlace firmado).
  Antes había que bajarlos a mano; ahora `pnpm models:fetch` lo hace todo desde cero.
- **`scripts/lib/fbx2gltf.py`** — Blender sin interfaz convierte el FBX de animaciones a glTF. **Hacía falta:**
  la exportación del paquete para Godot trae nombres de hueso Rigify (`DEF-head`), que **no coinciden** con los
  de las mallas de personaje, exportadas con nombres de Unreal (`Head`, `spine_01`). La de Unreal sí coincide,
  hueso por hueso, pero viene en FBX. De paso se quita la malla del maniquí y se limpian los nombres de clip.
- **`scripts/lib/gltfpack.mjs`** — deja los modelos listos para la web: texturas de 4096 px a 1024, PNG a JPG
  salvo las que usan transparencia, y se quitan las referencias a imágenes que el paquete no incluye.

### Composición de personajes
- **`Rig.js` reescrito**: un personaje es **un cuerpo + N piezas**. Cada prenda o peinado viene en su archivo y
  se **reengancha al esqueleto del cuerpo** emparejando huesos por nombre, así una sola animación mueve a la vez
  la piel y la ropa. Los clips y los archivos se cargan una vez y se comparten.
- **`Rig.attach(hueso, objeto, { lift, upright })`** resuelve la colocación **en el espacio del personaje**, no
  en el del hueso. Los ejes locales de un hueso no apuntan "hacia arriba" y cada esqueleto los orienta a su
  manera: sin esto, el sombrero se iba a cualquier parte (pasó, y se ve en la iteración 01).
- **`skinning/skinFit.js`** — encoge la piel bajo la ropa. **Por qué:** el paquete gratuito trae cuerpos de
  complexión *Superhero* pero la ropa está cortada para *Regular*, que sólo viene en la versión de pago; el
  pecho, el abdomen y los muslos atravesaban la tela ([captura del antes](03-antes-piel-atraviesa-ropa.jpg)).
  Se mira a qué hueso está pegado cada vértice y se mete hacia adentro sólo donde la ropa cubre: la cabeza, el
  cuello y las manos no se tocan, y el torso se mete más que los brazos.

### Pantalla de creación
- **`src/ui/CharacterCreator.js`** — escena propia con tarima giratoria de guadua, como el garaje. Ocho
  categorías (oficio, complexión, piel, pelo, color de pelo, barba, ropa, sombrero), navegables con ← → ↑ ↓ o con
  el ratón. Al acercar la rueda, la cámara sube la mirada a la cara.
- **Seis oficios de Pitalito como clase de origen**, con las cifras reales del municipio en su descripción:
  caficultor, arriero, chivero, guaquero, de la galería, estudiante. El oficio arrastra su ropa y su sombrero.
- Lo elegido se guarda en los ajustes y el personaje del mundo lo recoge: lo que se ve en la pantalla es lo que
  se juega.
- **Sombrero aguadeño** remodelado (ala más ancha, copa alta que tapa el pelo, cinta negra), enganchado al hueso.

## Medidas (Chromium con render por software, 1280×720)

| | Draw calls | Triángulos |
|---|---|---|
| Centro, v0.3.0 (línea base) | 490 | 887.428 |
| Centro, v0.4.0 (maniquí) | 458–495 | ~886.000 |
| **Centro, v0.5.0 (vestido)** | **470** | **917.144** |
| Presupuesto | ≤ 700 | ≤ 1 M ✅ |

**Coste del personaje completo: 11 draw calls y 28.825 triángulos** (cuerpo 3 + pelo 1 + cuatro prendas 5 +
sombrero 2). Cabe de sobra para uno, **no para treinta**. Lo que falta para bajarlo está escrito en
`characters.config.js`: fusionar las prendas que comparten material —las cuatro del atuendo usan `MI_Peasant`—,
lo que exige renumerar los índices de hueso a un orden común antes de unir las mallas. Es el trabajo de la Fase 4,
cuando haya multitud.

Peso de descarga de los personajes: **12,4 MB** (2,8 animaciones + 3,3 cuerpos y peinados + 6,3 ropa).

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-creador.jpg](01-creador.jpg) | La pantalla de creación con el oficio de caficultor |
| [02-sombrero-aguadeno.jpg](02-sombrero-aguadeno.jpg) | El sombrero enganchado al hueso de la cabeza |
| [03-antes-piel-atraviesa-ropa.jpg](03-antes-piel-atraviesa-ropa.jpg) | **El problema que resolvió `skinFit`:** el cuerpo atravesando la camisa |
| [04-en-el-mundo.jpg](04-en-el-mundo.jpg) | El mismo personaje en el Parque Principal |
| [05-corriendo.jpg](05-corriendo.jpg) | Corriendo con la ropa siguiendo el esqueleto |

Comparar con [01-esqueleto-v0.4.0](../01-esqueleto-v0.4.0/) y [00-base-v0.3.0](../00-base-v0.3.0/).

## Qué quedó pendiente

- **Fusionar prendas por material** para bajar de 11 a ~5 draw calls (ver arriba).
- La versión gratuita sólo trae **una complexión por sexo** (*Superhero*) y **dos atuendos** (trabajo y camino).
  Las complexiones *Regular* y *Teen* y los otros diez atuendos son de la versión de pago.
- Faltan prendas de la región que ningún paquete trae: **ruana, poncho, delantal de caficultor, botas de caucho**.
  Se modelan a mano, como los vehículos, y se enganchan a huesos.
- `Driving_Loop` y `Sitting_*` siguen sin verse: falta sentar al personaje en el vehículo y en las bancas.
- Fps en GPU real, todavía sin medir.
