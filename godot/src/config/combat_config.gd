class_name CombatConfig
## Combate: números del sistema de pelea, arsenal y arquetipos enemigos. Espejo de web/src/config/combat.config.js
## y de web/src/config/factions.config.js. Nada de esto se escribe dentro de la lógica.
##
## Diseño (web/docs/PLAN_JUEGO.md § Fase 3): pelea con peso, no botón repetido. La resistencia se gasta al atacar,
## al rodar y al cubrirse, y se recupera al parar. Rodar da invulnerabilidad breve. Fijar blanco mantiene al
## enemigo encuadrado. Un golpe interrumpe si supera el temple (poise) de quien lo recibe.
##
## FACCIONES: FICCIÓN DECLARADA. Los enemigos («los Restos», esqueletos con uniforme) no representan a ningún grupo
## armado real: sin nombre, sigla, bandera ni consigna de ninguno. Ver la cabecera de factions.config.js.

const ENABLED := true

const PLAYER := {"health": 100.0, "stamina": 100.0, "stamina_regen": 22.0, "stamina_delay": 0.55, "poise": 35.0,
	"invulnerable_after_hit": 0.45}
## Rodar: el tramo invulnerable empieza un poco después de arrancar (hay que rodar HACIA el golpe).
const ROLL := {"stamina": 26.0, "distance": 4.2, "duration": 0.62, "iframe_start": 0.10, "iframe_end": 0.42}
const GUARD := {"stamina": 14.0, "damage_through": 0.25, "drain_per_second": 4.0}
## Parry: cubrirse justo antes de que llegue el golpe (dentro de `window` s desde que se levanta la guardia) lo
## desvía sin daño; el atacante queda aturdido `stagger` s y el siguiente golpe que reciba pega × `riposte`.
## Fallar cuesta: levantar la guardia de nuevo antes de `cooldown` s no abre otra ventana (no vale apretar sin parar).
const PARRY := {"window": 0.2, "stagger": 1.1, "riposte": 1.6, "cooldown": 0.6, "stamina_back": 10.0}
## Golpe recibido fuera de un ataque: aunque no rompa el temple, el cuerpo se sacude con el clip de recibir y
## retrocede (`hitstun` s sin poder actuar). Atacando aguanta (no se interrumpe) y solo se sacude.
const HITSTUN := {"time": 0.32, "knockback": 1.5}
## Pantalla quebrada al recibir (src/ui/shaders/fracture.gdshader): daño que la rompe del todo, cuánto dura, y lo
## poco que la raja un golpe bloqueado.
## Tajo verde del parry (src/ui/shaders/parry_slash.gdshader): cuánto dura en pantalla.
const PARRY_SLASH := {"fade": 0.55}
const FRACTURE := {"full_damage": 30.0, "fade": 0.9, "blocked": 0.15, "min": 0.25}
## Combo: un golpe que empieza antes de `window` s tras el anterior sigue la cadena; el último (remate) tarda más.
const COMBO := {"window": 0.55, "finisher_time": 1.3, "finisher_damage": 1.45}
const LOCK_ON := {"range": 22.0, "angle": PI * 0.55, "break_range": 30.0}
const HIT_MULTIPLIER := {"head": 1.8, "body": 1.0, "limb": 0.75}

## Sensación del golpe (lo que hace que pegue "de verdad"). ESTIMADO: ajustado a ojo con tools/menu_shots -- combate.
##   hitstop: segundos que el tiempo casi se detiene al conectar (más con armas pesadas y al recibir)
##   shake: temblor de cámara (0..1) al dar, al recibir y al bloquear
##   assist: al golpear, el personaje se gira hacia el enemigo más cercano dentro de este medio ángulo y alcance extra
##   lunge: medio paso adelante al soltar el golpe (m/s de impulso), solo si el blanco está más lejos que `lunge_min`
##   recoil: cuánto se sacude el cuerpo golpeado aunque no se aturda (rad), y cuánto tarda en volver
##   roll_cancel: se puede rodar en la recuperación del golpe (como en Souls), no en la preparación
const FEEL := {
	"hitstop_light": 0.045, "hitstop_heavy": 0.09, "hitstop_taken": 0.07, "hitstop_scale": 0.06,
	"shake_deal": 0.25, "shake_heavy": 0.45, "shake_taken": 0.6, "shake_block": 0.3,
	"assist_angle": 1.1, "assist_extra": 1.8, "lunge": 3.2, "lunge_min": 1.2,
	"recoil": 0.28, "recoil_back": 9.0, "roll_cancel": true,
}
## Enemigos: cuántos pueden atacar a la vez al jugador (el resto rodea esperando turno), a qué distancia rodean,
## y el aviso antes de pegar (el arma "brilla" con un sonido corto al empezar la preparación).
const PACK := {"attackers": 2, "circle_distance": 3.6, "circle_speed": 1.4, "tell": true}
## Al morir: cuánto queda el cuerpo antes de hundirse, y cuánto tarda en hundirse.
const CORPSE := {"stay": 8.0, "sink": 2.5}

## Arsenal: herramientas de la región (web/src/entities/weapons/models.js). model = GLB horneado de la web.
##   damage, stamina, reach (m), arc (medio ángulo, rad), windup / active / recover (s), poise; combo = clips;
##   grip = dónde está el centro de la empuñadura en el eje del arma (m, medido sobre models.js de la web);
##   twist = giro sobre su eje para que lo que corta mire hacia el golpe (la pala del azadón sale hacia −Z).
const WEAPONS := {
	"zarpazo": {"name": "Zarpazo", "model": "", "grip": 0.0, "combo": ["Zombie_Scratch"],
		"damage": 9.0, "stamina": 6.0, "reach": 1.25, "arc": 0.6, "windup": 0.45, "active": 0.2, "recover": 0.5, "poise": 12.0},
	"manos": {"name": "Manos", "model": "", "grip": 0.0, "combo": ["Punch_Jab", "Punch_Cross", "Melee_Hook"],
		"damage": 7.0, "stamina": 8.0, "reach": 1.1, "arc": 0.5, "windup": 0.12, "active": 0.1, "recover": 0.2, "poise": 8.0},
	"machete": {"name": "Machete", "model": "machete", "grip": -0.065, "combo": ["Sword_Regular_A", "Sword_Regular_B", "Sword_Attack"],
		"damage": 26.0, "stamina": 22.0, "reach": 2.2, "arc": 0.7, "windup": 0.26, "active": 0.16, "recover": 0.34, "poise": 30.0},
	"peinilla": {"name": "Peinilla", "model": "peinilla", "grip": -0.06, "combo": ["Sword_Regular_A", "Sword_Regular_B", "Sword_Regular_A", "Sword_Attack"],
		"damage": 18.0, "stamina": 15.0, "reach": 1.7, "arc": 0.6, "windup": 0.18, "active": 0.13, "recover": 0.24, "poise": 20.0},
	"garrote": {"name": "Garrote de guadua", "model": "garrote", "grip": -0.075, "combo": ["Sword_Regular_B", "TreeChopping"],
		"damage": 20.0, "stamina": 18.0, "reach": 2.4, "arc": 0.55, "windup": 0.3, "active": 0.14, "recover": 0.4, "poise": 45.0},
	"azadon": {"name": "Azadón", "model": "azadon", "grip": -0.06, "twist": -PI / 2, "combo": ["TreeChopping", "TreeChopping"],
		"damage": 34.0, "stamina": 30.0, "reach": 2.1, "arc": 0.45, "windup": 0.42, "active": 0.18, "recover": 0.55, "poise": 60.0},
	"rejo": {"name": "Rejo", "model": "rejo", "grip": -0.07, "combo": ["Sword_Regular_A", "Sword_Regular_B"],
		"damage": 11.0, "stamina": 12.0, "reach": 3.1, "arc": 0.35, "windup": 0.22, "active": 0.12, "recover": 0.3, "poise": 12.0},
}
const ARSENAL := ["manos", "machete", "peinilla", "garrote", "azadon", "rejo"]
const WEAPON_DIR := "res://assets/models/weapons/baked/"
## Cómo se empuña (medido en los cuerpos con tools: hueso RightHand del perfil humanoide). En el espacio de la mano
## los dedos van hacia +Y, el cruce de la palma (meñique → índice) hacia +X y la palma hacia +Z. Las armas vienen
## de la web con el mango hacia −Y, la hoja hacia +Y y el filo hacia +X. Puño cerrado: el mango va a lo largo de
## la palma (+Y del arma = +X de la mano: la hoja sale por el lado del pulgar) y el filo mira hacia donde apuntan
## los nudillos (+X del arma = +Y de la mano).
const GRIP_BASIS := Basis(Vector3(0, 1, 0), Vector3(1, 0, 0), Vector3(0, 0, -1))
## Centro del puño: a esta fracción del largo de la mano (hasta el nudillo del medio) y hacia la palma (m).
const GRIP_ALONG := 0.78
const GRIP_PALM := 0.03
## Teclas (las mismas de la web): X sacar/guardar, clic izq. golpear, clic der. cubrirse, Ctrl rodar, Q fijar,
## Z o rueda cambiar de arma; con un arma de fuego: clic disparar, clic der. apuntar, R recargar. physical_keycode o botón del ratón (negativo).
const KEYS := {
	"combat_toggle": KEY_X, "combat_attack": -MOUSE_BUTTON_LEFT, "combat_guard": -MOUSE_BUTTON_RIGHT,
	"combat_roll": KEY_CTRL, "combat_lock": KEY_Q, "combat_cycle": KEY_Z, "combat_reload": KEY_R, "combat_safety": KEY_B,
}

## Arquetipos de los Restos: mismo combatiente, otras cifras (ENEMIGOS de factions.config.js). `block`: probabilidad
## de cubrirse al ver venir un golpe (de Godot; la web no la tiene todavía). Reacciona tarde o temprano al azar: a
## veces desvía (parry), casi siempre solo bloquea.
const ENEMIES := {
	"centinela": {"name": "Centinela", "weapon": "peinilla",
		"stats": {"health": 55.0, "stamina": 70.0, "stamina_regen": 16.0, "stamina_delay": 0.7, "poise": 20.0, "invulnerable_after_hit": 0.3},
		"ai": {"sight": 26.0, "hearing": 14.0, "speed": 3.4, "attack_distance": 1.6, "pause": 1.1, "dodge": 0.15, "block": 0.3}},
	"machetero": {"name": "Machetero", "weapon": "machete",
		"stats": {"health": 85.0, "stamina": 90.0, "stamina_regen": 14.0, "stamina_delay": 0.8, "poise": 32.0, "invulnerable_after_hit": 0.3},
		"ai": {"sight": 30.0, "hearing": 16.0, "speed": 3.0, "attack_distance": 2.0, "pause": 1.5, "dodge": 0.25, "block": 0.4}},
	"cabo": {"name": "Cabo", "weapon": "azadon",
		"stats": {"health": 130.0, "stamina": 110.0, "stamina_regen": 12.0, "stamina_delay": 1.0, "poise": 55.0, "invulnerable_after_hit": 0.35},
		"ai": {"sight": 32.0, "hearing": 18.0, "speed": 2.6, "attack_distance": 1.9, "pause": 2.0, "dodge": 0.1, "block": 0.15}},
}
const ENEMY_MIX := {"centinela": 5.0, "machetero": 3.0, "cabo": 1.0}
const ENEMY_BODY := "res://assets/models/characters/enemies/skeleton.glb"
## Uniforme (FACTIONS.restos.look de la web): la ropa de camino teñida; debajo no hay nadie.
const ENEMY_UNIFORM := {"parts": ["{S}_Ranger_Body", "{S}_Ranger_Legs"], "sex": "Male", "color": Color("#8a9163")}
## Zonas de control (ficción, lejos de la cabecera para que la ciudad quede siempre segura) y aparición.
const ZONES := [
	{"id": "filo-norte", "name": "El filo del norte", "x": -1900.0, "z": -3400.0, "radius": 520.0, "enemies": 5},
	{"id": "quebrada-honda", "name": "La quebrada honda", "x": 2600.0, "z": 2900.0, "radius": 460.0, "enemies": 4},
	{"id": "camino-viejo", "name": "El camino viejo", "x": -3200.0, "z": 2100.0, "radius": 480.0, "enemies": 4},
]
const SPAWN := {"spawn_radius": 140.0, "despawn_radius": 240.0, "min_distance": 22.0, "max_active": 6, "respawn_seconds": 45.0}
