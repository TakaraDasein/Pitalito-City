# Modelos 3D externos: búsqueda, licencias y pertinencia

> Qué modelo de personaje usamos, por qué, y bajo qué licencia. Rige la [regla 2 de REGLAS.md](REGLAS.md#2-licencias-y-atribución):
> nada entra al repositorio a mano; todo por un script que registre fuente y licencia.

## Decisión

**Ecosistema Quaternius (CC0).** Los cuatro paquetes comparten **el mismo esqueleto**, con los mismos nombres de
huesos y la misma pose de enlace, así que no hay que reorientar nada entre modelos y animaciones.

| Paquete | Para qué | Licencia |
|---|---|---|
| [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | Todas las animaciones | CC0 |
| [Universal Animation Library 2](https://quaternius.itch.io/universal-animation-library-2) | Zombis (modo supervivencia): `Zombie_Walk_Fwd_Loop`, `Zombie_Idle_Loop`, `Zombie_Scratch`, `Hit_Knockback`, `LayToIdle` — se recortan a `ual2.glb` con `scripts/lib/gltf-clips.py` | CC0 |
| [Guns Asset Pack (Styloo)](https://styloo.itch.io/guns-asset-pack) | Pistola (`pew`), escopeta, fusil (`ak47`) y rifle (`awp`): textura pintada y normales, ≈ 2 000 triángulos; texturas reducidas a 512 px JPG con `scripts/lib/glb-compactar.py` | CC0 |
| [50+ LowPoly Guns](https://quaternius.itch.io/50-lowpoly-guns) | Armas de fuego (supervivencia): `Pistol_1`, `Revolver_1`, `Shotgun_1`, `Shotgun_SawedOff`, `AssaultRifle_1`, `SniperRifle_1` → FBX a GLB con Blender, escaladas al largo real | CC0 |
| [Universal Base Characters](https://quaternius.itch.io/universal-base-characters) | Cuerpos base (6 complexiones, 20 peinados) → creación de personaje | CC0 |
| [Modular Character Outfits](https://quaternius.itch.io/modular-character-outfits-fantasy) | 62 piezas de ropa intercambiables → sombrero, ruana, uniforme | CC0 |
| LowPoly Animated Monsters / Animals | Fauna y enemigos del bosque | CC0 |

**Vehículos del tráfico: [Kenney Car Kit 3.1](https://kenney.nl/assets/car-kit) (CC0).** GLB con un solo material
(atlas de paleta de 512 px compartido), ≈ 2 000 triángulos y las ruedas como nodos con nombre, que es justo la
interfaz de `models/index.js`. Se usan 7 de 45: automóvil, campero, van, camioneta, furgón, recolector y ambulancia.
Quaternius (Low Poly Cars, Car Pack) se descartó: FBX con varios materiales por carro, más draw calls. **Ningún
paquete CC0 revisado trae motos**: las motos y el motocarro siguen modelados a mano.

**CC0 = dominio público.** Se puede versionar en el repositorio, modificar y publicar sin atribuir (igual la
registramos en `assets/models/CREDITS.md` por cortesía y trazabilidad). Es la única familia de licencias que no
choca con la regla de no versionar material de terceros con restricciones.

## Verificación hecha (no es promesa, se descargó y se abrió)

`AnimationLibrary_Godot_Standard.glb` — 6,7 MB, exportado desde Blender 4.3:

- **53 huesos**, un solo `skin`, una sola malla. Nombres estilo Rigify (`DEF-hips`, `DEF-spine.001`,
  `DEF-upper_arm.L`, `DEF-f_index.01.L`…), con dedos completos.
- **46 clips** listos, que cubren casi todo el diseño sin tener que animar a mano:

| Necesidad del plan | Clips disponibles |
|---|---|
| Combate tipo Dark Souls | `Sword_Attack`, `Sword_Attack_RM`, `Sword_Idle`, `Punch_Jab`, `Punch_Cross`, `Punch_Enter`, **`Roll`**, `Roll_RM`, `Hit_Chest`, `Hit_Head`, `Death01` |
| Armas de fuego | `Pistol_Idle_Loop`, `Pistol_Aim_Up/Neutral/Down`, `Pistol_Shoot`, `Pistol_Reload` |
| Locomoción | `Walk_Loop`, `Walk_Formal_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Crouch_Idle_Loop`, `Crouch_Fwd_Loop`, `Jump_Start/Loop/Land`, `Swim_Fwd_Loop` |
| **Ya lo usamos hoy** | `Driving_Loop` (va en los 6 vehículos), `Sitting_Enter/Idle/Exit` (las bancas del parque), `Interact` (la tecla E), `PickUp_Table` |
| Ambiente | `Idle_Loop`, `Idle_Talking_Loop`, `Dance_Loop`, `Push_Loop`, `Fixing_Kneeling` |

`Roll` y `Sitting_*` son la prueba de pertinencia: la mecánica central del combate (esquiva rodando) y las
interacciones que **ya existen** en el juego vienen resueltas en el mismo paquete.

## Qué falta y qué no cubre

- **Sombrero aguadeño y ruana** no existen en los paquetes: se modelan aparte (como ya hacemos con los vehículos)
  y se enganchan al hueso `DEF-head` / `DEF-spine.003`. Se mantiene la referencia fotográfica.
- **Esqueleto humano** (para los enemigos): **resuelto generándolo**, no descargándolo. Los paquetes de monstruos
  traen su propio armature y sus propias animaciones, así que no servirían con los 45 clips ni con el sistema de
  combate. `scripts/lib/make-skeleton.py` lo construye con Blender **sobre el mismo armature** que ya usamos: un
  hueso de geometría por cada hueso del rig, costillar, pelvis y cráneo con cuencas. 4.184 triángulos, 2
  materiales, 65 huesos; hereda todas las animaciones y se viste con la misma ropa modular. Queda registrado como
  derivado CC0 en `assets/models/CREDITS.md`.
- Los paquetes de mallas se descargan desde itch.io, que no da URL directa estable: `scripts/lib/itch.mjs`
  reproduce el flujo del navegador (cookie, csrf, enlace firmado) para paquetes **gratuitos y CC0**.
- **Trampa importante, verificada:** la exportación del paquete de animaciones **para Godot** usa nombres de hueso
  Rigify (`DEF-head`, `DEF-hand.L`, 53 huesos) y **no coincide** con las mallas de personaje, exportadas con
  nombres de Unreal (`Head`, `hand_l`, 65 huesos). La exportación **para Unreal sí coincide hueso por hueso**,
  pero viene en FBX: `scripts/lib/fbx2gltf.py` la convierte con Blender sin interfaz.
- Las texturas vienen en PNG de 4096 px (10-13 MB cada una). `scripts/lib/gltfpack.mjs` las baja a 1024 y a JPG
  —salvo las que usan transparencia— y reescribe las rutas: **423 MB de paquetes quedan en 12,4 MB**.
- Los cuerpos del paquete gratuito son de complexión *Superhero* pero la ropa está cortada para *Regular* (de
  pago): el cuerpo atraviesa la tela. Se corrige encogiendo la piel bajo la ropa
  (`src/entities/skinning/skinFit.js`).

## Descartados y por qué

| Fuente | Por qué no |
|---|---|
| **Mixamo** (Adobe) | Gratis pero no libre: exige cuenta y su licencia no permite redistribuir los archivos. Choca con la regla 2.1. |
| **Sketchfab** | Catálogo mezclado; la mayoría es CC BY (obliga a atribuir en pantalla) o licencia propietaria. Sirve para piezas sueltas, no como base. |
| **Kenney** (CC0) | Buenísimo y CC0, pero su rig es propio: no comparte esqueleto con la biblioteca de animaciones y habría que reorientar todo. |
| **Ready Player Me** | Depende de un servicio en línea y de su API. |

## Presupuesto

Un personaje con esqueleto cuesta más que una caja: skinning en GPU, un `SkinnedMesh` por entidad y un
`AnimationMixer` por entidad. Límites que se fijan en `src/config/characters.config.js`:

- ≤ 3.000 triángulos por personaje, ≤ 4 draw calls (cuerpo + ropa fusionada + pelo + accesorio).
- ≤ 30 personajes animados a la vez; más allá, animación por instancias con textura de huesos (ver PLAN_JUEGO.md).

**Medido en la Fase 2** (iteración 02), con el personaje vestido completo: **11 draw calls y 28.825 triángulos**
(cuerpo 3 + pelo 1 + cuatro prendas 5 + sombrero 2). Peso de descarga: 12,4 MB.

Cabe de sobra para el jugador, que es uno y se ve de cerca. **No cabe para treinta.** Lo que falta para la
multitud (Fases 4 y 5), por orden:

1. Fusionar las prendas que comparten material —las cuatro del atuendo usan `MI_Peasant`—, lo que exige
   renumerar los índices de hueso a un orden común antes de unir las mallas. Baja de 11 a ~5 draw calls.
2. Mallas simplificadas para los personajes de fondo (decimación en el pipeline).
3. Animación por instancias con textura de huesos, ya prevista en PLAN_JUEGO.md.

**Medido con enemigos** (iteración 04): cada esqueleto uniformado cuesta **10 mallas y 10.214 triángulos**. Con
cinco en pantalla el juego va a 645 draw calls y 982.641 triángulos — dentro del presupuesto, pero justo: por eso
el tope está en 6 (`SPAWN.maxActive`).
