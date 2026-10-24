// Árbol de comportamiento mínimo: lo compartido por todo lo que se mueve solo (facciones, fauna).
//
// Tres estados por nodo: 'ok' (terminó bien), 'fail' (no se pudo), 'run' (sigue en ello). Un nodo que devuelve
// 'run' se vuelve a llamar el siguiente fotograma desde la raíz, así que los nodos deben poder reanudarse.
//
// Sólo hay unas pocas piezas, y alcanzan: secuencia, selector, condición, acción y temporizadores. Nada de código
// por enemigo: un enemigo es un árbol + unas cifras (ver src/config/factions.config.js).

export const OK = 'ok', FAIL = 'fail', RUN = 'run';

// Ejecuta los hijos en orden; se corta en el primero que falle o siga en marcha.
export const secuencia = (...hijos) => (ctx) => {
  for (const h of hijos) {
    const r = h(ctx);
    if (r !== OK) return r;
  }
  return OK;
};

// Ejecuta hasta que uno funcione; el primero que no falle manda.
export const selector = (...hijos) => (ctx) => {
  for (const h of hijos) {
    const r = h(ctx);
    if (r !== FAIL) return r;
  }
  return FAIL;
};

// Condición: sigue si se cumple.
export const si = (test) => (ctx) => (test(ctx) ? OK : FAIL);

// Acción: lo que devuelva (por defecto, terminada).
export const hacer = (fn) => (ctx) => fn(ctx) ?? OK;

// Deja pasar sólo si ya venció la espera guardada con `marcar`.
export const listo = (key) => (ctx) => ((ctx.timers[key] ?? 0) <= ctx.time ? OK : FAIL);

// Guarda una espera para más tarde. `segundos` puede ser un número o una función del contexto.
export const marcar = (key, segundos) => (ctx) => {
  ctx.timers[key] = ctx.time + (typeof segundos === 'function' ? segundos(ctx) : segundos);
  return OK;
};

// Con probabilidad p continúa; si no, falla. Sirve para que no todos hagan lo mismo a la vez.
export const azar = (p) => () => (Math.random() < p ? OK : FAIL);
