# 11 · Coliseo, Concha y recintos (v1.3.0 — 2026-10-02)

**P2 y P3 del [plan de pulido](../../docs/PLAN_PULIDO.md).** Cinco sitios que existían en los datos como bloques
extruidos con la altura promedio de su celda de GHSL, y ahora tienen forma.

## Coliseo Cubierto y Concha Acústica

Van juntos porque están a 140 m y **salen en la misma foto** — la de la Concha (Jhysus, CC BY-SA 4.0) muestra al
fondo el exterior del Coliseo, y la del Coliseo (Daalecura, CC BY-SA 4.0) muestra su interior.

**Coliseo**: volumen alargado de ladrillo a la vista con cubierta metálica a dos aguas, franja alta de ventanas
corridas bajo el alero, galería de columnas en la fachada larga con el forjado del segundo nivel, y por dentro
las graderías de concreto en herradura alrededor de la cancha, con barandal amarillo, tableros de baloncesto y
las cerchas metálicas vistas. Altura de las fotos (14 m); GHSL daba 7.

**Concha Acústica**: tarima circular sobre zócalo de ladrillo, la cubierta de celosía colgada por tensores de dos
torres en A, y el anfiteatro de gradas en semicírculo.

> Las gradas salieron primero como **cintas blancas flotando en el aire**: un cilindro con `openEnded` es una
> cáscara, no un escalón. Ahora cada grada es un sector de cilindro macizo, dibujadas de fuera hacia dentro y
> cada una más alta que la siguiente, y el escalonado sale solo.

## Villa Olímpica, Patinódromo y Terminal

Son **recintos, no edificios**: lo que los hace reconocibles es el trazado del suelo. Van los tres en un módulo.

- **Villa Olímpica**: pista atlética con sus carriles alrededor de la cancha, graderías en los dos costados y
  cubierta de lámina en el principal.
- **Patinódromo**: óvalo peraltado —las curvas se levantan hacia afuera, las rectas quedan planas—, con el
  infield en pasto y su gradería. **No es un skatepark**: eso es otra cosa y no hay dato de que exista uno en el
  municipio ([PLAN_PULIDO.md § 2](../../docs/PLAN_PULIDO.md)).
- **Terminal de Transportes**: explanada de maniobras, edificio de taquillas en ladrillo con marquesina sobre el
  andén de abordaje, bahías en diente de sierra e isla central.

De estos tres **no hay fotos con licencia en Commons**, así que se modela lo que el polígono y el tipo de recinto
permiten afirmar, sin inventar edificios que no se sabe si existen. Lo estimado queda declarado en DATOS.md.

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-coliseo.jpg](01-coliseo.jpg) | El Coliseo: ladrillo, cubierta a dos aguas y franja de ventanas |
| [02-concha-acustica.jpg](02-concha-acustica.jpg) | La Concha: torres en A, viga de celosía y anfiteatro |
| [03-patinodromo-y-villa.jpg](03-patinodromo-y-villa.jpg) | El óvalo peraltado del Patinódromo y, detrás, la Villa Olímpica |
| [04-terminal.jpg](04-terminal.jpg) | El Terminal, con su edificio y la explanada |

## Qué quedó pendiente

- La pista de la Villa Olímpica se lee oscura; debería ser roja como la del Patinódromo.
- El anfiteatro de la Concha se ve como una masa clara desde arriba: los escalones son anchos y bajos, que es lo
  real, pero no se distinguen de lejos.
- Falta P4: peatones, que el tráfico respete los 99 semáforos, y las zonas de facción en el mapa.
