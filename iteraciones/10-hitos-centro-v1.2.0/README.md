# 10 · Los hitos del centro (v1.2.0 — 2026-10-01)

**P1 del [plan de pulido](../../docs/PLAN_PULIDO.md).** Cuatro cosas que existen en Pitalito y no estaban, más
una misión que apuntaba a un sitio inventado.

## Lo que se hizo

### El pipeline reconoce los hitos
`build-world.mjs` ahora registra ocho hitos con **su huella real de OSM**: Alcaldía, Coliseo, Concha Acústica,
Villa Olímpica, Patinódromo, Terminal, más los dos que ya estaban. No hay que estimar dónde está nada.

> Costó dos intentos: las huellas llegan por **Overture**, que trae su propio identificador aunque el dato venga
> de OSM, así que emparejar por id de OSM no funcionaba. Se emparejan por nombre.

### Alcaldía Municipal «La Chapolera»
Modelada sobre su polígono real (56 × 57 m), con lo que muestran las fotos: el **muro cortina de vidrio
inclinado** que domina la fachada con su retícula de montantes, el volumen de piedra oscura con el escudo y el
letrero, el cuerpo claro retranqueado encima, las tres astas de bandera, la escalinata de acceso y la **estatua
de bronce de la chapolera** en la plaza.

La altura la fija la foto (tres niveles ≈ 12 m): el dato de GHSL daba 7 m, que es el promedio de su celda de
90 m y no sirve para un edificio concreto.

La fachada se orienta sola hacia el centro, porque el marco orientado de un polígono no sabe cuál es el frente.

### Parque Principal: tres piezas que faltaban
- **La fuente**, que llevaba pendiente desde la v0.2 por falta de referencia y ahora la hay: vaso rectangular
  revestido en mármol oscuro, canal elevado que vierte en escalón y pila al centro, justo delante del letrero
  «Yo ❤ Pitalito» — la misma composición de la foto.
- **El Monumento al Recolector**: busto de bronce con sombrero de ala ancha, la herramienta al hombro y el
  abanico de manos detrás, que es lo que lo hace reconocible.
- **El letrero «200 Pitalito»** del bicentenario, con las cifras corpóreas azules sobre jardinera.

Los tres se pueden consultar con **E** y cuentan su dato con fuente.

### Una misión rota
«Municipio (1912)» mandaba al jugador a unas coordenadas inventadas (−36, 24) en vez de a la Alcaldía real
(73, 190).

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-alcaldia.jpg](01-alcaldia.jpg) | La Chapolera: muro cortina inclinado, banderas y la estatua |
| [02-fuente.jpg](02-fuente.jpg) | La fuente delante del letrero, con la Torre al fondo |
| [03-recolector.jpg](03-recolector.jpg) | El Monumento al Recolector |
| [04-bicentenario.jpg](04-bicentenario.jpg) | El letrero «200 Pitalito» |

## Qué quedó pendiente

- La fuente queda algo baja; el vaso real tiene más presencia.
- El texto de los letreros no se modela: a escala de juego no se leería.
- Siguen sin modelarse el Coliseo y la Concha (P2), Villa Olímpica, Patinódromo y Terminal (P3).
