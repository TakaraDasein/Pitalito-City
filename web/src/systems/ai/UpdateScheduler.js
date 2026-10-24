// Reparto de actualizaciones por distancia: lo lejos se piensa menos veces.
//
// El problema: cada enemigo y cada animal corría su ciclo entero —percepción, árbol de comportamiento, física,
// animación— **todos los fotogramas**, estuviera a dos metros o a doscientos. A dos metros hace falta; a
// doscientos, no se nota aunque decida cuatro veces por segundo en vez de sesenta.
//
// Cómo funciona: cada entidad acumula el tiempo que le toca y sólo se actualiza cuando le llega el turno, con el
// dt acumulado. Así la física sigue saliendo igual (recorre lo mismo) pero se piensa mucho menos.
//
// Es la contrapartida natural de las zonas de aparición: éstas deciden **qué existe**, esto decide **cuánto
// cuesta lo que existe**.

// Cada escalón: hasta `distancia` metros, actualizar cada `cada` segundos. 0 = todos los fotogramas.
export const ESCALONES = [
  { distancia: 30, cada: 0 },
  { distancia: 80, cada: 1 / 20 },
  { distancia: 150, cada: 1 / 8 },
  { distancia: Infinity, cada: 1 / 3 },
];

/**
 * Decide si a una entidad le toca turno y cuánto tiempo ha pasado desde el suyo.
 *
 * @param e   entidad con `x`, `z` y un hueco donde guardar su reloj (`_acum`)
 * @param px, pz  dónde está el jugador
 * @param dt  tiempo del fotograma
 * @returns   el dt que debe usar la entidad, o 0 si no le toca
 */
export function turno(e, px, pz, dt) {
  const d = Math.hypot(e.x - px, e.z - pz);
  const escalon = ESCALONES.find((s) => d < s.distancia) || ESCALONES[ESCALONES.length - 1];
  if (escalon.cada === 0) { e._acum = 0; return dt; }
  e._acum = (e._acum || 0) + dt;
  if (e._acum < escalon.cada) return 0;
  const usado = e._acum;
  e._acum = 0;
  return usado;
}

/** Cuántas entidades de una lista caerían en cada escalón. Para el panel de depuración. */
export function reparto(lista, px, pz) {
  const cuenta = ESCALONES.map(() => 0);
  for (const e of lista) {
    const d = Math.hypot(e.x - px, e.z - pz);
    cuenta[ESCALONES.findIndex((s) => d < s.distancia)]++;
  }
  return cuenta;
}
