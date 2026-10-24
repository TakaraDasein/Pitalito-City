// Interacción del personaje a pie con el mundo (tecla E / F), organizada por categorías.
//
// Cada cosa con la que se puede interactuar declara su `tipo`. El tipo decide:
//   · prioridad — si hay varias al alcance, gana la de más prioridad; a igual prioridad, la más cercana y la
//                 que está delante del personaje (ver `alFrente`).
//   · accion    — el gesto que hace el personaje (acciones de src/entities/character/AnimationGraph.js), o null
//                 si quien ejecuta la interacción ya anima por su cuenta (subir al vehículo, sentarse).
//   · encarar   — si el personaje se gira hacia el objeto antes del gesto.
//   · icono     — glifo del aviso en pantalla.
//
// Quien registra un objeto en PlayerSystem (`register`) o devuelve uno desde un sistema (botín, trueque) sólo
// tiene que poner `tipo`, `x`, `z` y `run`. Sin `tipo` se trata como `info`.

export const INTERACCION = {
  // Búsqueda del objeto al alcance: veces por segundo. Antes corría en cada fotograma, y con la mira sobre un
  // edificio recorría todos los puntos de interés del mapa cada vez.
  hz: 10,
  // Cuánto pesa que el objeto esté delante (0 = sólo la distancia). Evita que gane lo que queda a la espalda.
  alFrente: 0.35,
  // Giro hacia el objeto, en rad/s, y ángulo bajo el cual ya se da por encarado.
  giro: 9,
  encarado: 0.12,
  // Al levantarse de una banca no se camina hasta que el clip termina (si no, se desliza sentado).
  levantarse: 0.7,

  tipos: {
    vehiculo: { prioridad: 6, accion: null, encarar: false, icono: '⛟' },
    hablar:   { prioridad: 5, accion: 'hablar', encarar: true, icono: '❝' },
    recoger:  { prioridad: 4, accion: null, encarar: true, icono: '✋' },      // LootSystem ya hace el gesto
    puerta:   { prioridad: 4, accion: 'empujar', encarar: true, icono: '⌂' },
    asiento:  { prioridad: 3, accion: null, encarar: false, icono: '⑁' },     // Character.sitAt anima
    info:     { prioridad: 2, accion: 'interact', encarar: true, icono: 'ℹ' },
    edificio: { prioridad: 1, accion: 'interact', encarar: true, icono: '▣' },
    bloque:   { prioridad: 0, accion: null, encarar: false, icono: '◧' },
  },
};
