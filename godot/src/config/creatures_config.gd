class_name CreaturesConfig
## Criaturas con modelo externo (Sketchfab, CC BY / CC BY-NC: ver web/assets/models/CREDITS_EXTERNOS.md; no se
## versionan, se importan con `pnpm models:import` en la web y llegan con tools/sync_from_web.sh).
##
## Roles (los textos y las fuentes de los mitos están en web/docs/HISTORIA.md § Mitos y leyendas):
##   fauna   — animal real del municipio
##   mito    — leyenda del Huila (el Hojarasquín, la Madremonte) o lo que los acompaña; lo que no tiene fuente es
##             FICCIÓN DECLARADA (la jauría, el venado del monte)
##   enemigo / jefe — FICCIÓN DECLARADA, sin nombre, sigla ni insignia de ningún grupo real (como los Restos)
##
## height: alto real al que se escala (m, hasta lo más alto del esqueleto; ESTIMADO salvo nota). humanoid: usa la
## biblioteca de clips del juego (retarget de tools/import/externos_retarget.py); si no, sus clips propios.
## clips: rol → nombre del clip (en los humanoides, de la biblioteca "ual"). face: giro para que mire a −Z.
## Cómo actúa (Creature): behavior — "pacific" (pasta y huye), "hostile" (ve, persigue y ataca), "guardian" (solo
## ataca si el jugador lleva el arma en la mano: así lo cuenta la leyenda del Hojarasquín); team (los del mismo
## bando no se atacan); stats como CombatConfig.PLAYER; attack como un arma de CombatConfig.WEAPONS (golpe por
## sector); firearm: dispara con esa arma (FirearmSystem) en vez de golpear; speed (m/s), sight (m); boss: barra de
## jefe arriba y más vida. aim_error multiplica la dispersión del arma (los saqueadores fallan mucho), burst = tiros
## por ráfaga y burst_pause = pausa entre ráfagas (s): sin eso un fusil mataba al jugador en 7 s. Cifras ESTIMADAS.

const DIR := "res://assets/models/externos/"

const CREATURES := {
	"caballo": {"name": "Caballo", "file": "fauna/caballo.glb", "role": "fauna", "height": 1.65, "behavior": "pacific", "team": "fauna", "speed": 5.5, "sight": 18.0, "stats": {"health": 110.0, "stamina": 100.0, "stamina_regen": 20.0, "stamina_delay": 0.5, "poise": 60.0, "invulnerable_after_hit": 0.3}, "humanoid": false,
		"clips": {"idle": "Horse_Idle", "walk": "Horse_Walk"}},
	"lobo": {"name": "Lobo de la jauría", "file": "mito/lobo.glb", "role": "mito", "height": 0.85, "behavior": "hostile", "team": "monte", "speed": 6.5, "sight": 28.0, "stats": {"health": 45.0, "stamina": 80.0, "stamina_regen": 20.0, "stamina_delay": 0.5, "poise": 15.0, "invulnerable_after_hit": 0.25}, "attack": {"damage": 10.0, "stamina": 10.0, "reach": 1.5, "arc": 0.6, "windup": 0.22, "active": 0.12, "recover": 0.45, "poise": 12.0}, "humanoid": false,
		"clips": {"idle": "Wolf_Howl", "walk": "Wolf_WalkFast_F", "run": "Wolf_WalkFast_F", "attack": "Wolf_WalkFast_F"}},
	"venado-monte": {"name": "Venado del monte", "file": "mito/venado-monte.glb", "role": "mito", "height": 2.3, "behavior": "pacific", "team": "monte", "speed": 8.0, "sight": 30.0, "stats": {"health": 70.0, "stamina": 100.0, "stamina_regen": 20.0, "stamina_delay": 0.5, "poise": 30.0, "invulnerable_after_hit": 0.3}, "humanoid": false,
		"clips": {"idle": "Deer_Idle", "walk": "Deer_WalkFast_F"}},
	"hojarasquin": {"name": "El Hojarasquín del monte", "file": "mito/hojarasquin.glb", "role": "mito", "height": 2.6, "behavior": "guardian", "team": "monte", "speed": 5.0, "sight": 30.0, "stats": {"health": 260.0, "stamina": 140.0, "stamina_regen": 18.0, "stamina_delay": 0.8, "poise": 70.0, "invulnerable_after_hit": 0.3}, "attack": {"damage": 28.0, "stamina": 20.0, "reach": 2.6, "arc": 0.8, "windup": 0.5, "active": 0.18, "recover": 0.7, "poise": 45.0}, "humanoid": false,
		"clips": {"idle": "Take 001", "walk": "Take 001"}},
	"madremonte": {"name": "La Madremonte", "file": "mito/madremonte.glb", "role": "mito", "height": 2.0, "behavior": "hostile", "team": "monte", "speed": 4.2, "sight": 32.0, "boss": true, "stats": {"health": 420.0, "stamina": 160.0, "stamina_regen": 16.0, "stamina_delay": 0.8, "poise": 80.0, "invulnerable_after_hit": 0.3}, "attack": {"damage": 30.0, "stamina": 22.0, "reach": 2.4, "arc": 0.8, "windup": 0.42, "active": 0.18, "recover": 0.6, "poise": 50.0}, "humanoid": true,
		"clips": {"idle": "Sword_Idle", "walk": "Walk", "run": "Jog_Fwd", "attack": "Sword_Attack", "hit": "Hit_Chest", "death": "Death01"}},
	"saqueador": {"name": "Saqueador", "file": "enemigo/saqueador.glb", "role": "enemigo", "height": 1.78, "behavior": "hostile", "team": "faccion", "speed": 3.6, "sight": 35.0, "firearm": "fusil", "aim_error": 7.0, "burst": [2, 4], "burst_pause": [1.4, 2.6], "stats": {"health": 70.0, "stamina": 90.0, "stamina_regen": 14.0, "stamina_delay": 0.8, "poise": 28.0, "invulnerable_after_hit": 0.3}, "attack": {"damage": 9.0, "stamina": 8.0, "reach": 1.2, "arc": 0.6, "windup": 0.2, "active": 0.1, "recover": 0.3, "poise": 10.0}, "humanoid": true,
		"clips": {"idle": "Pistol_Idle", "walk": "Walk", "run": "Jog_Fwd", "attack": "Pistol_Shoot", "hit": "Hit_Chest", "death": "Death01"}},
	"jefa-agris": {"name": "La Señora de la base", "file": "jefe/jefa-agris.glb", "role": "jefe", "height": 1.85, "behavior": "hostile", "team": "faccion", "speed": 4.6, "sight": 36.0, "boss": true, "stats": {"health": 520.0, "stamina": 180.0, "stamina_regen": 18.0, "stamina_delay": 0.7, "poise": 75.0, "invulnerable_after_hit": 0.25}, "attack": {"damage": 26.0, "stamina": 18.0, "reach": 2.4, "arc": 0.8, "windup": 0.3, "active": 0.16, "recover": 0.45, "poise": 40.0}, "humanoid": true,
		"clips": {"idle": "Sword_Idle", "walk": "Walk", "run": "Jog_Fwd", "attack": "Sword_Regular_A", "hit": "Hit_Chest", "death": "Death01"}},
	"jefe-elefante": {"name": "El Coloso", "file": "jefe/jefe-elefante.glb", "role": "jefe", "height": 3.4, "behavior": "hostile", "team": "faccion", "speed": 4.0, "sight": 40.0, "boss": true, "stats": {"health": 900.0, "stamina": 200.0, "stamina_regen": 14.0, "stamina_delay": 1.0, "poise": 200.0, "invulnerable_after_hit": 0.3}, "attack": {"damage": 45.0, "stamina": 30.0, "reach": 3.8, "arc": 0.9, "windup": 0.7, "active": 0.25, "recover": 1.0, "poise": 90.0}, "humanoid": false,
		"clips": {"idle": "01_Idle", "walk": "02_Walk", "run": "03_Run", "attack": "05_Attack"}},
	"jefe-tvman": {"name": "El Pantalla", "file": "jefe/jefe-tvman.glb", "role": "jefe", "height": 2.5, "behavior": "hostile", "team": "faccion", "speed": 4.4, "sight": 36.0, "boss": true, "stats": {"health": 640.0, "stamina": 180.0, "stamina_regen": 16.0, "stamina_delay": 0.8, "poise": 90.0, "invulnerable_after_hit": 0.3}, "attack": {"damage": 32.0, "stamina": 22.0, "reach": 2.8, "arc": 0.9, "windup": 0.4, "active": 0.2, "recover": 0.6, "poise": 55.0}, "humanoid": true,
		"clips": {"idle": "Idle", "walk": "Walk", "run": "Jog_Fwd", "attack": "Punch_Cross", "hit": "Hit_Chest", "death": "Death01"}},
}

## Dónde aparecen (CreatureSystem). forest = árboles a 40 m (WorldStreamer.trees_near); out_of_town = metros desde el
## Parque Principal (fuera de la cabecera); night/day: solo de noche o de día; group: [mín, máx]; chance: por
## intento (cada `every` s); max: a la vez.
const SPAWN := {
	"every": 6.0, "radius": [35.0, 70.0], "despawn": 140.0,
	"caballo": {"out_of_town": 1400.0, "forest_max": 10, "day": true, "group": [1, 3], "chance": 0.35, "max": 4},
	"venado-monte": {"forest": 14, "day": true, "group": [1, 2], "chance": 0.2, "max": 2},
	"lobo": {"forest": 14, "night": true, "group": [3, 4], "chance": 0.25, "max": 5},
	"hojarasquin": {"forest": 20, "night": true, "group": [1, 1], "chance": 0.06, "max": 1},
	"madremonte": {"forest": 28, "night": true, "group": [1, 1], "chance": 0.03, "max": 1},
}
## Bases de los Restos (CombatConfig.ZONES): su jefe en el centro y saqueadores entre los Restos.
const BOSSES := {"filo-norte": "jefa-agris", "quebrada-honda": "jefe-elefante", "camino-viejo": "jefe-tvman"}
const RAIDERS_PER_ZONE := 2
