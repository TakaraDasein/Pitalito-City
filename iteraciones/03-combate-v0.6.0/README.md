# 03 · Combate y arsenal (v0.6.0 — 2026-09-30)

**Fase 3 del [plan](../../docs/PLAN_JUEGO.md).** Pelea con peso: resistencia que se gasta, esquiva rodando con
invulnerabilidad, guardia, fijar blanco y seis armas que son herramientas reales de la región.

## Qué cambió

### Dos modos que no se pisan
Con el arma **guardada** se construye igual que antes (clic = poner/quitar bloque, 1–9 = elegir). Con el arma
**en la mano** se pelea (clic izq. = golpe, clic der. = cubrirse). `X` saca o guarda, `Z` cambia de arma. La
barra de bloques y el panel de combate nunca se ven a la vez. Es la separación que pide el plan: Minecraft manda
en la construcción, Dark Souls en la pelea.

### El sistema
- **`src/entities/combat/Combatant.js`** — vida, resistencia, temple y estado (atacar, rodar, recibir, morir).
  **Es el mismo objeto para el jugador, la fauna y las facciones**: la IA de las Fases 4 y 5 llamará a `attack()`
  y `roll()` igual que lo hace el teclado. No hay ni una referencia al jugador dentro.
- **`src/systems/CombatSystem.js`** — la única lista de combatientes y la única prueba de alcance. El golpe es un
  **sector**: distancia menor que el alcance del arma y ángulo dentro de su arco. Barato y legible; no hacen
  falta cajas de daño por hueso a esta escala.
- **`src/config/combat.config.js`** — todos los números fuera de la lógica, y el combate entero se apaga con
  `COMBAT.enabled = false`.
- La animación del golpe **se estira para durar lo que dura el golpe**: un azadón tarda más que una peinilla, y
  la mano tiene que llegar cuando el daño entra.

### Arsenal, modelado a mano
Ningún paquete CC0 trae herramientas del sur del Huila, así que se modelan como los vehículos
(`src/entities/weapons/models.js`), se fusionan por material y se cuelgan del hueso de la mano derecha:

| Arma | Qué es | Daño | Alcance | Resistencia |
|---|---|---|---|---|
| Manos | Sin nada | 7 | 1,1 m | 8 |
| **Machete** | La herramienta del cafetal | 26 | 2,2 m | 22 |
| Peinilla | Machete corto y recto | 18 | 1,7 m | 15 |
| Garrote de guadua | Un tramo de culmo, con sus nudos | 20 | 2,4 m | 18 |
| Azadón | Pesado y lento | 34 | 2,1 m | 30 |
| Rejo | La correa del arriero | 11 | 3,1 m | 12 |

### HUD
Vida y resistencia en café y guadua arriba a la izquierda, con el arma debajo, y retícula del blanco fijado
proyectada sobre el enemigo.

## Verificación

**El render por software cayó a ≈ 0,5 fotogramas por segundo** desde que el personaje tiene esqueleto y ropa
(medido: `game.time` avanzó 0,56 s en 4 s de reloj). Con eso **nada que dependa del tiempo se puede comprobar
esperando**: un ataque de 0,76 s no termina en dos segundos de espera. Se verifica haciendo avanzar la
simulación a mano, que además es determinista (ver [VERIFICACION.md](../../docs/VERIFICACION.md)):

| Regla | Resultado |
|---|---|
| Daño del machete (26 × 0,75 por zona) | **19,5** ✅ |
| Un golpe no cobra dos veces | vida sin cambios tras seguir avanzando ✅ |
| Sin resistencia no se ataca | `attack()` devuelve `false` ✅ |
| Cubrirse deja pasar el 25 % | **4,9** en vez de 19,5 ✅ |
| Rodar da invulnerabilidad | un golpe de 50 durante el rodar → vida intacta ✅ |
| Muerte | cae al cuarto golpe y queda en estado `dead` ✅ |

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-machete-en-mano.jpg](01-machete-en-mano.jpg) | Postura de guardia con el machete, HUD de combate |
| [02-blanco-fijado.jpg](02-blanco-fijado.jpg) | Blanco fijado sobre el muñeco de entrenamiento |
| [03-golpe.jpg](03-golpe.jpg) | El corte, con la animación ajustada a la duración del arma |

## Qué quedó pendiente

- **No hay enemigos todavía.** El muñeco de entrenamiento se pone desde la consola (`game.debugSpawnDummy()`) y
  no es contenido del mundo: existe para verificar hasta la Fase 5.
- Afinar cómo queda el arma en la mano: en guardia el machete roza la pierna.
- Falta el golpe fuerte (mantener el clic), encadenar golpes y el contraataque al bloquear a tiempo.
- Sin partículas ni sonido en el impacto: es la Fase 6.
- Fps en GPU real, todavía sin medir — y ahora hace más falta que nunca.
