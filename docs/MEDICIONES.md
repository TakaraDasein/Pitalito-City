# Medición de fps en GPU real

> **Medición parcial.** Lo de abajo se midió de verdad, con la tarjeta, no con SwiftShader. Falta completar el
> barrido: ver "Qué falta" al final. Regenerar con `npm run bench`.

## Dónde se midió

- **Renderizador:** `ANGLE (NVIDIA, Vulkan 1.4.341 (NVIDIA GeForce RTX 4060 Laptop GPU (0x000028A0)), NVIDIA)`
- **Equipo:** Intel Alder Lake-P UHD + NVIDIA RTX 4060 Max-Q · Linux · ventana 1920×1080
- **Fecha:** 1 de octubre de 2026 · preset **alta**

El informe del bench siempre empieza diciendo qué renderizador tocó. **Si pone SwiftShader o llvmpipe, la medida
no vale**: es render por software y da ≈0,5 fps con el personaje con esqueleto.

## Resultados

| Preset | Escena | fps | Peor fotograma | Draw calls | Triángulos |
|---|---|---|---|---|---|
| alta | Centro, conduciendo | **144** | 27 ms | 679 | 875.000 |
| alta | Centro, a pie | **124** | 26 ms | 691 | 926.000 |
| alta | Combate con seis enemigos | **101** | 29 ms | 806 | 1.048.000 |

## Qué dicen estos números

**El presupuesto va conservador para esta tarjeta.** En combate el juego se pasa de los dos límites de REGLAS.md
—806 draw calls y 1,05 M de triángulos— y sigue por encima de **100 fps**. El presupuesto no se toca: existe
para las máquinas flojas, no para una RTX 4060. Pero ahora se sabe cuánto margen hay, que es lo que faltaba para
decidir con criterio en vez de a ojo.

**El peor fotograma es lo que hay que vigilar**, no la media: 26–29 ms de pico frente a 7–10 ms de media. Esos
picos son construcción de tiles en el hilo principal. Mover el streaming a un Web Worker —que lleva en la hoja de
ruta desde el principio— atacaría justo eso.

**El coste del combate es moderado**: de 124 a 101 fps al meter seis esqueletos, un 19 %. Con el escalonado por
distancia y el director de presupuesto, los seis enemigos no son el cuello.

## Qué falta

1. **Los presets baja, media y ultra**, y las escenas de campo y de noche con lluvia. El barrido completo se
   cortó dos veces por error propio (recompilar durante la medición recarga la página y tira el bench) y una
   tercera porque la tarjeta dejó de entregar contexto WebGL a Chromium sin ventana. Se relanza con
   `npm run bench`.
2. **Una máquina floja.** Es para la que existe el presupuesto: una gráfica integrada y un portátil viejo. Sin
   eso, no se sabe si el preset "baja" sirve de algo.
3. **Medir con el panel del juego** (tecla B) jugando de verdad, no sólo en escenas preparadas.
