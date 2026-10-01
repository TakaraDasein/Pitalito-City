# 06 · Partículas, luz y sonido (v0.9.0 — 2026-09-30)

**Fase 6 del [plan](../../docs/PLAN_JUEGO.md).** Lo que hace que un golpe **se sienta** y que el mundo parezca
vivo cuando no pasa nada.

## Partículas: toda la simulación en la GPU

La CPU no mueve ni una partícula. Cada familia es **un solo `InstancedMesh`** con un buffer por instancia (origen,
velocidad, instante de nacimiento, semilla); el sombreador de vértices calcula dónde está cada una a partir del
tiempo transcurrido, integrando la trayectoria de forma analítica:

```
p = origen + velocidad · f(t) + ½ · gravedad · t²      f(t) = (1 − e^(−k·t)) / k   ← frenado por arrastre
```

Emitir cuesta escribir unos números; dibujar cuesta **un draw call por familia, pase lo que pase**. Medido:

> **1.200 partículas emitidas de golpe → los draw calls no se movieron** (500 antes y después). Siete familias =
> siete draw calls en total.

Siete familias: polvo de los pasos, chispas del machete, polvo de hueso de los esqueletos, salpicadura de la
lluvia, luciérnagas, hojas al viento y humo. Todo se apaga con `PARTICLES.enabled = false` y cada familia tiene
su tope por preset de calidad.

## El ambiente sale del sitio y de la hora

`src/systems/AmbienceSystem.js` no tiene listas de sitios: mira dónde está el jugador, igual que la fauna.

- **Pasos**: polvo bajo los pies al correr, sólo cuando se mueve de verdad y toca suelo.
- **Lluvia**: salpicaduras alrededor, para que el agua toque algo en vez de sólo caer.
- **Luciérnagas** de noche y **hojas** de día, pero sólo si hay árboles cerca. El umbral es más bajo que el de la
  fauna: para unas luciérnagas basta un par de árboles; para un venado hace falta monte.
- **Chicharras**: el coro arranca al caer la tarde y baja de madrugada. Es el fondo sonoro del valle.

## Dirección de atmósfera: el contraste de Souls

No con más luces, sino con **contraste**. Un director mide dos cosas —enemigos cerca y monte cerrado— y con eso
mueve la gradación y la niebla:

| | Tranquilo | Con tres esqueletos cerca |
|---|---|---|
| Tensión | 0,01 | **0,54** |
| Viñeta | 0,35 | **0,51** |
| Saturación | 1,08 | **0,93** |

Bajo el monte cerrado la niebla se espesa hasta el doble. El efecto es deliberadamente **sutil**: la imagen se
cierra y pierde color sin que haya un cambio de escena ni un golpe de música.

## Sonido, sintetizado y sin un solo archivo

El `AudioSystem` ya generaba el motor con WebAudio; se le añaden **el filo cortando el aire** (ruido filtrado que
barre de agudo a grave), **el golpe según contra qué entre** —hueso seco y agudo, metal con dos parciales
inarmónicos que suenan a lámina, carne sordo—, **la caída** y **las chicharras**. Que sea sintetizado no es un
atajo: evita descargar megas de audio y evita el problema de licencia de cualquier biblioteca de efectos.

## Medidas

| | Draw calls | Triángulos |
|---|---|---|
| Centro, a pie | 500 | 868.801 |
| Siete familias de partículas | **+7 draw calls fijos** | despreciable |
| Presupuesto | ≤ 700 | ≤ 1 M ✅ |

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-impacto.jpg](01-impacto.jpg) | Polvo de hueso al entrar el machetazo |
| [02-luciernagas.jpg](02-luciernagas.jpg) | Luciérnagas de noche en el Parque Principal |
| [03-polvo-al-correr.jpg](03-polvo-al-correr.jpg) | El polvo que levanta el pie en el camino |
| [04-tension.jpg](04-tension.jpg) | La imagen cerrada con tres esqueletos encima |

## Qué quedó pendiente

- Un fallo que costó una pasada: las partículas salían como **cuadrados blancos duros**. Faltaba el recorte
  circular en el fragmento (había dejado un `gl_PointCoord` que no aplica a triángulos).
- Falta el humo del fogón: la familia existe, pero no hay fogones en el mundo que lo emitan.
- Los dios-rayos del cafetal al amanecer siguen pendientes: hacen falta pases de volumen.
- El sonido no tiene posición en el espacio todavía (es monofónico).
- Falta la música de la región (bambuco, rajaleña) en los momentos clave.
