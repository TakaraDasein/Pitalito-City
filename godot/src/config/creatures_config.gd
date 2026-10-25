class_name CreaturesConfig
## Criaturas con modelo externo (Sketchfab, CC BY / CC BY-NC: ver web/assets/models/CREDITS_EXTERNOS.md; no se
## versionan, se importan con `pnpm models:import` en la web y llegan con tools/sync_from_web.sh).
##
## Roles (los textos y las fuentes de los mitos están en web/docs/HISTORIA.md § Mitos y leyendas):
##   fauna — animal real del municipio · mito — leyenda del Huila o lo que la acompaña (lo que no tiene fuente es
##   FICCIÓN DECLARADA) · enemigo / jefe — FICCIÓN DECLARADA, sin nombre, sigla ni insignia de ningún grupo real.
##
## Ficha de cada una:
##   height (m, ESTIMADO), humanoid (usa la biblioteca de clips del juego), matte (quita el brillo metálico que deja
##   la conversión de FBX: el venado salía casi negro)
##   clips: estado → clip. Estados: idle, walk, run, hit, death y los que pidan sus ataques. Sin clip, el estado se
##   anima por código (Creature._proc): lunge (embestida), kick (coz), charge (carga), slam (salto y golpe al
##   suelo); y siempre topple (cae de lado al morir, si no hay clip) y recoil (retrocede al recibir).
##   moves_by: "hojarasca" = no camina (no tiene clip para eso): se deshace en hojas y reaparece más cerca
##   behavior: pacific (pasta y huye; con defend se defiende) · hostile · guardian (solo si el jugador va armado)
##   stats como CombatConfig.PLAYER; speed (caminar) y run (correr), m/s; sight (m)
##   attacks: la IA elige entre los que están a su distancia (range [mín, máx]) y sin espera (cooldown, s), al azar
##     según weight. Cada uno es un arma de CombatConfig (damage, reach, arc, windup, active, recover, poise,
##     stamina) más: clip (estado que lo anima; combo / combo2 = siguientes golpes de la cadena), proc (animación
##     por código), area (golpea en redondo), push (empuje extra), dash (m que avanza al soltarlo), behind (golpea
##     hacia atrás: la coz), effect: howl (llama a los de su bando y les da prisa) · summon (trae jauría) ·
##     teleport (se deshace en hojarasca y aparece detrás) · flash (la pantalla ciega: aturde) · shoot (dispara su
##     arma de fuego) · eat (se cura comiendo, lejos del jugador)
##   variants: variantes del mismo modelo (hide = mallas que esconde; el resto pisa la ficha)
##   spawn: dónde aparece (CreatureSystem). habitat: finca (lejos de la cabecera y con pocos árboles), monte
##     (árboles a 40 m ≥ forest), monte_hondo (más árboles y a menos de `river` m de un río), base (lo pone
##     FactionSystem); night/day; group; chance por intento; max a la vez
##   lod (sobre LOD_DEFAULT): anim (m: más lejos la animación va a 1/4 de cuadros), think (m: más lejos piensa 4
##     veces por segundo), shadow (m: sin sombra más allá), hide (m: deja de dibujarse)
## Cifras de juego ESTIMADAS salvo nota.

const DIR := "res://assets/models/externos/"
const LOD_DEFAULT := {"anim": 45.0, "think": 50.0, "shadow": 40.0, "hide": 170.0}

const CREATURES := {
	# ── Fauna ────────────────────────────────────────────────────────────────────────────────────────────────
	"caballo": {"name": "Caballo", "file": "fauna/caballo.glb", "role": "fauna", "height": 1.65, "humanoid": false, "matte": true,
		"clips": {"idle": "Horse_Idle", "walk": "Horse_Walk", "run": "Horse_Walk"},
		"behavior": "pacific", "defend": true, "team": "fauna", "speed": 1.6, "run": 7.5, "sight": 16.0,
		"stats": {"health": 110.0, "stamina": 100.0, "stamina_regen": 20.0, "stamina_delay": 0.5, "poise": 60.0, "invulnerable_after_hit": 0.3},
		"attacks": [
			# coz: si lo golpean o lo rodean por detrás, gira y patea con las de atrás
			{"id": "coz", "proc": "kick", "behind": true, "damage": 22.0, "reach": 2.0, "arc": 0.9, "windup": 0.35, "active": 0.12, "recover": 0.7, "poise": 45.0, "stamina": 20.0,
				"range": [0.0, 2.2], "cooldown": 2.5, "weight": 1.0, "push": 4.0},
		],
		"spawn": {"habitat": "finca", "day": true, "group": [2, 4], "chance": 0.35, "max": 5},
		"lod": {}},

	# ── Mitos del monte ──────────────────────────────────────────────────────────────────────────────────────
	"venado-monte": {"name": "Venado del monte", "file": "mito/venado-monte.glb", "role": "mito", "height": 2.3, "humanoid": false, "matte": true,
		"clips": {"idle": "Deer_Idle", "walk": "Deer_WalkFast_F", "run": "Deer_WalkFast_F"},
		"behavior": "pacific", "defend": true, "team": "monte", "speed": 1.8, "run": 9.0, "sight": 28.0,
		"stats": {"health": 80.0, "stamina": 100.0, "stamina_regen": 20.0, "stamina_delay": 0.5, "poise": 35.0, "invulnerable_after_hit": 0.3},
		"attacks": [
			# acorralado o herido: baja las astas y carga
			{"id": "astas", "proc": "charge", "damage": 18.0, "reach": 2.0, "arc": 0.6, "windup": 0.45, "active": 0.3, "recover": 0.8, "poise": 40.0, "stamina": 25.0,
				"range": [2.0, 9.0], "cooldown": 4.0, "weight": 1.0, "dash": 6.0, "push": 5.0},
		],
		# la hembra: el mismo modelo sin astas, no ataca nunca (solo huye); salen un macho y una o dos hembras
		"variants": {"hembra": {"name": "Venada del monte", "hide": ["Deer_Antler"], "defend": false, "attacks": [], "height": 2.0}},
		"spawn": {"habitat": "monte", "forest": 14, "day": true, "group": [2, 3], "mix": ["", "hembra"], "chance": 0.2, "max": 3},
		"lod": {}},
	"lobo": {"name": "Lobo de la jauría", "file": "mito/lobo.glb", "role": "mito", "height": 0.85, "humanoid": false, "matte": true,
		"clips": {"idle": "Wolf_Howl", "walk": "Wolf_WalkFast_F", "run": "Wolf_WalkFast_F", "howl": "Wolf_Howl"},
		"behavior": "hostile", "team": "monte", "speed": 2.5, "run": 7.0, "sight": 28.0,
		"stats": {"health": 45.0, "stamina": 80.0, "stamina_regen": 20.0, "stamina_delay": 0.5, "poise": 15.0, "invulnerable_after_hit": 0.25},
		"attacks": [
			{"id": "mordisco", "proc": "lunge", "damage": 9.0, "reach": 1.5, "arc": 0.6, "windup": 0.2, "active": 0.1, "recover": 0.45, "poise": 12.0, "stamina": 10.0,
				"range": [0.0, 1.6], "cooldown": 0.8, "weight": 3.0},
			# salto: desde unos metros se lanza encima
			{"id": "salto", "proc": "lunge", "damage": 14.0, "reach": 1.8, "arc": 0.7, "windup": 0.35, "active": 0.2, "recover": 0.7, "poise": 25.0, "stamina": 22.0,
				"range": [2.5, 6.0], "cooldown": 3.5, "weight": 2.0, "dash": 4.5},
			# aullido: los de la jauría a 40 m vienen a toda carrera unos segundos
			{"id": "aullido", "clip": "howl", "effect": "howl", "damage": 0.0, "reach": 0.0, "arc": 0.0, "windup": 0.4, "active": 0.05, "recover": 1.6, "poise": 0.0, "stamina": 0.0,
				"range": [4.0, 30.0], "cooldown": 18.0, "weight": 1.0},
		],
		"spawn": {"habitat": "monte", "forest": 14, "night": true, "group": [3, 4], "chance": 0.25, "max": 5},
		"lod": {}},
	"hojarasquin": {"name": "El Hojarasquín del monte", "file": "mito/hojarasquin.glb", "role": "mito", "height": 2.6, "humanoid": false,
		# su único clip es una pose de acecho que respira (46 pistas, sin avance): no camina. Se mueve en hojarasca
		"clips": {"idle": "Take 001"}, "moves_by": "hojarasca",
		"behavior": "guardian", "team": "monte", "speed": 2.0, "run": 6.0, "sight": 32.0,
		"stats": {"health": 220.0, "stamina": 140.0, "stamina_regen": 18.0, "stamina_delay": 0.8, "poise": 70.0, "invulnerable_after_hit": 0.3},
		"attacks": [
			{"id": "zarpa", "proc": "lunge", "damage": 18.0, "reach": 2.6, "arc": 0.8, "windup": 0.38, "active": 0.16, "recover": 0.55, "poise": 35.0, "stamina": 14.0,
				"range": [0.0, 2.6], "cooldown": 0.9, "weight": 3.0},
			# salta sobre el que entró armado y cae en redondo
			{"id": "caida", "proc": "slam", "area": true, "damage": 26.0, "reach": 3.4, "arc": PI, "windup": 0.7, "active": 0.2, "recover": 1.0, "poise": 60.0, "stamina": 30.0,
				"range": [3.0, 9.0], "cooldown": 7.0, "weight": 1.5, "dash": 5.0, "push": 6.0},
			# «hace perder»: se deshace en hojarasca y aparece detrás
			{"id": "hojarasca", "effect": "teleport", "damage": 0.0, "reach": 0.0, "arc": 0.0, "windup": 0.6, "active": 0.05, "recover": 0.3, "poise": 0.0, "stamina": 20.0,
				"range": [6.0, 25.0], "cooldown": 12.0, "weight": 1.0},
		],
		"spawn": {"habitat": "monte", "forest": 20, "night": true, "group": [1, 1], "chance": 0.06, "max": 1},
		"lod": {}},
	"madremonte": {"name": "La Madremonte", "file": "mito/madremonte.glb", "role": "mito", "height": 2.0, "humanoid": true, "boss": true,
		"clips": {"idle": "Sword_Idle", "walk": "Walk", "run": "Jog_Fwd", "hit": "Hit_Chest", "death": "Death01",
			"tajo_a": "Sword_Regular_A", "tajo_b": "Sword_Regular_B", "estocada": "Sword_Attack", "llamado": "Spell_Simple_Shoot"},
		"behavior": "hostile", "team": "monte", "speed": 2.2, "run": 4.6, "sight": 32.0,
		"stats": {"health": 420.0, "stamina": 160.0, "stamina_regen": 16.0, "stamina_delay": 0.8, "poise": 80.0, "invulnerable_after_hit": 0.3},
		"attacks": [
			{"id": "tajo", "clip": "tajo_a", "combo": "tajo_b", "damage": 22.0, "reach": 2.3, "arc": 0.8, "windup": 0.35, "active": 0.16, "recover": 0.45, "poise": 40.0, "stamina": 16.0,
				"range": [0.0, 2.4], "cooldown": 1.0, "weight": 3.0},
			# estocada con la lanza: alcanza lejos
			{"id": "estocada", "clip": "estocada", "damage": 30.0, "reach": 3.4, "arc": 0.35, "windup": 0.55, "active": 0.18, "recover": 0.7, "poise": 55.0, "stamina": 24.0,
				"range": [2.0, 3.6], "cooldown": 3.0, "weight": 2.0, "dash": 1.5},
			# llama a su jauría: dos lobos salen del monte
			{"id": "llamado", "clip": "llamado", "effect": "summon", "summon": ["lobo", 2], "damage": 0.0, "reach": 0.0, "arc": 0.0, "windup": 0.8, "active": 0.05, "recover": 1.0, "poise": 0.0, "stamina": 30.0,
				"range": [4.0, 30.0], "cooldown": 25.0, "weight": 1.0},
		],
		"spawn": {"habitat": "monte_hondo", "forest": 28, "river": 120.0, "night": true, "group": [1, 1], "chance": 0.03, "max": 1},
		"lod": {}},

	# ── Bases de los Restos ──────────────────────────────────────────────────────────────────────────────────
	"saqueador": {"name": "Saqueador", "file": "enemigo/saqueador.glb", "role": "enemigo", "height": 1.78, "humanoid": true,
		"clips": {"idle": "Pistol_Idle", "walk": "Walk", "run": "Jog_Fwd", "hit": "Hit_Chest", "death": "Death01",
			"disparo": "Pistol_Shoot", "recarga": "Pistol_Reload", "culatazo": "Punch_Cross"},
		"behavior": "hostile", "team": "faccion", "speed": 1.8, "run": 4.0, "sight": 35.0,
		"firearm": "fusil", "aim_error": 7.0, "keep": [8.0, 18.0], "burst": [2, 4], "burst_pause": [1.4, 2.6],
		"stats": {"health": 70.0, "stamina": 90.0, "stamina_regen": 14.0, "stamina_delay": 0.8, "poise": 28.0, "invulnerable_after_hit": 0.3},
		"attacks": [
			{"id": "rafaga", "clip": "disparo", "effect": "shoot", "damage": 0.0, "reach": 0.0, "arc": 0.0, "windup": 0.05, "active": 0.02, "recover": 0.1, "poise": 0.0, "stamina": 0.0,
				"range": [3.0, 60.0], "cooldown": 0.0, "weight": 4.0},
			# de cerca: culatazo
			{"id": "culatazo", "clip": "culatazo", "damage": 12.0, "reach": 1.4, "arc": 0.6, "windup": 0.25, "active": 0.1, "recover": 0.4, "poise": 30.0, "stamina": 12.0,
				"range": [0.0, 1.6], "cooldown": 1.5, "weight": 3.0, "push": 3.0},
		],
		"spawn": {"habitat": "base"},
		"lod": {}},
	"jefa-agris": {"name": "La Señora de la base", "file": "jefe/jefa-agris.glb", "role": "jefe", "height": 1.85, "humanoid": true, "boss": true,
		"clips": {"idle": "Sword_Idle", "walk": "Walk", "run": "Jog_Fwd", "hit": "Hit_Chest", "death": "Death01", "rodar": "Roll",
			"tajo_a": "Sword_Regular_A", "tajo_b": "Sword_Regular_B", "tajo_c": "Sword_Regular_C", "giro": "Sword_Attack"},
		"behavior": "hostile", "team": "faccion", "speed": 2.4, "run": 5.2, "sight": 36.0,
		"stats": {"health": 520.0, "stamina": 180.0, "stamina_regen": 18.0, "stamina_delay": 0.7, "poise": 75.0, "invulnerable_after_hit": 0.25},
		"attacks": [
			{"id": "combo", "clip": "tajo_a", "combo": "tajo_b", "combo2": "tajo_c", "damage": 20.0, "reach": 2.3, "arc": 0.8, "windup": 0.28, "active": 0.14, "recover": 0.35, "poise": 35.0, "stamina": 14.0,
				"range": [0.0, 2.4], "cooldown": 1.2, "weight": 3.0},
			# giro: golpea en redondo (castiga rodearla)
			{"id": "giro", "clip": "giro", "area": true, "damage": 28.0, "reach": 2.8, "arc": PI, "windup": 0.5, "active": 0.22, "recover": 0.8, "poise": 55.0, "stamina": 26.0,
				"range": [0.0, 2.8], "cooldown": 5.0, "weight": 1.5, "push": 4.0},
			# acometida: rueda hacia el jugador y corta al levantarse
			{"id": "acometida", "clip": "rodar", "damage": 24.0, "reach": 2.2, "arc": 0.7, "windup": 0.45, "active": 0.2, "recover": 0.6, "poise": 45.0, "stamina": 22.0,
				"range": [3.5, 9.0], "cooldown": 4.0, "weight": 2.0, "dash": 5.5},
		],
		"spawn": {"habitat": "base"},
		"lod": {}},
	"jefe-elefante": {"name": "El Coloso", "file": "jefe/jefe-elefante.glb", "role": "jefe", "height": 3.4, "humanoid": false, "boss": true,
		"clips": {"idle": "01_Idle", "walk": "02_Walk", "run": "03_Run", "pisoton": "05_Attack", "comer": "04_Eating"},
		"behavior": "hostile", "team": "faccion", "speed": 1.6, "run": 6.5, "sight": 40.0,
		"stats": {"health": 900.0, "stamina": 200.0, "stamina_regen": 14.0, "stamina_delay": 1.0, "poise": 200.0, "invulnerable_after_hit": 0.3},
		"attacks": [
			# pisotón: golpe en redondo
			{"id": "pisoton", "clip": "pisoton", "area": true, "damage": 40.0, "reach": 4.5, "arc": PI, "windup": 0.9, "active": 0.25, "recover": 1.2, "poise": 90.0, "stamina": 30.0,
				"range": [0.0, 4.5], "cooldown": 4.0, "weight": 2.0, "push": 7.0},
			# colmillos: barrido al frente
			{"id": "colmillos", "proc": "lunge", "damage": 30.0, "reach": 3.8, "arc": 0.9, "windup": 0.55, "active": 0.2, "recover": 0.8, "poise": 70.0, "stamina": 20.0,
				"range": [0.0, 3.8], "cooldown": 1.8, "weight": 3.0, "push": 5.0},
			# carga: arranca desde lejos en línea recta y atropella
			{"id": "carga", "clip": "run", "proc": "charge", "damage": 45.0, "reach": 3.0, "arc": 0.6, "windup": 0.8, "active": 0.9, "recover": 1.4, "poise": 120.0, "stamina": 40.0,
				"range": [7.0, 25.0], "cooldown": 9.0, "weight": 2.0, "dash": 16.0, "push": 9.0},
			# herido y con el jugador lejos: come y se cura un poco
			{"id": "comer", "clip": "comer", "effect": "eat", "heal": 80.0, "damage": 0.0, "reach": 0.0, "arc": 0.0, "windup": 0.3, "active": 2.5, "recover": 0.5, "poise": 0.0, "stamina": 0.0,
				"range": [15.0, 40.0], "cooldown": 30.0, "weight": 1.0},
		],
		"spawn": {"habitat": "base"},
		"lod": {"anim": 60.0, "hide": 220.0}},
	"jefe-tvman": {"name": "El Pantalla", "file": "jefe/jefe-tvman.glb", "role": "jefe", "height": 2.5, "humanoid": true, "boss": true,
		"clips": {"idle": "Idle", "walk": "Walk", "run": "Jog_Fwd", "hit": "Hit_Chest", "death": "Death01",
			"jab": "Punch_Jab", "cruzado": "Punch_Cross", "gancho": "Melee_Hook", "destello": "Spell_Simple_Shoot", "golpe": "Sword_Attack"},
		"behavior": "hostile", "team": "faccion", "speed": 2.2, "run": 5.0, "sight": 36.0,
		"stats": {"health": 640.0, "stamina": 180.0, "stamina_regen": 16.0, "stamina_delay": 0.8, "poise": 90.0, "invulnerable_after_hit": 0.3},
		"attacks": [
			{"id": "puños", "clip": "jab", "combo": "cruzado", "combo2": "gancho", "damage": 18.0, "reach": 2.2, "arc": 0.7, "windup": 0.22, "active": 0.12, "recover": 0.3, "poise": 35.0, "stamina": 12.0,
				"range": [0.0, 2.3], "cooldown": 1.0, "weight": 3.0},
			# golpe al suelo con los parlantes: en redondo
			{"id": "estruendo", "clip": "golpe", "proc": "slam", "area": true, "damage": 30.0, "reach": 4.0, "arc": PI, "windup": 0.65, "active": 0.2, "recover": 0.9, "poise": 70.0, "stamina": 26.0,
				"range": [0.0, 4.0], "cooldown": 6.0, "weight": 1.5, "push": 6.0},
			# destello de la pantalla: aturde al que lo mira de frente a menos de 12 m
			{"id": "destello", "clip": "destello", "effect": "flash", "stun": 1.2, "damage": 6.0, "reach": 12.0, "arc": 0.0, "windup": 0.7, "active": 0.1, "recover": 0.8, "poise": 0.0, "stamina": 20.0,
				"range": [3.0, 12.0], "cooldown": 10.0, "weight": 1.5},
		],
		"spawn": {"habitat": "base"},
		"lod": {}},
}

## Intentos de aparición y retiro (CreatureSystem). finca: a más de `finca_from_park` m del Parque y con a lo sumo
## `finca_forest_max` árboles a 40 m (potreros).
const SPAWN := {"every": 6.0, "radius": [35.0, 70.0], "despawn": 140.0, "finca_from_park": 1400.0, "finca_forest_max": 10}
## Bases de los Restos (CombatConfig.ZONES): su jefe en el centro, dentro de un corral de barricadas, y saqueadores.
const BOSSES := {"filo-norte": "jefa-agris", "quebrada-honda": "jefe-elefante", "camino-viejo": "jefe-tvman"}
const RAIDERS_PER_ZONE := 2
## Corral del jefe: cerca de guadua en círculo (radio m), varas cada `spacing` m de `height` m con dos amarres, y un
## hueco de entrada de `gap` m. Las barricadas del kit salían como tablones estirados y torcidos. ESTIMADO.
const ARENA := {"radius": 14.0, "spacing": 0.32, "height": 2.2, "pole": 0.06, "gap": 4.0, "color": "#a98b4f", "tie": "#6e5a33"}

## Equilibrio (medido con tools/menu_shots -- situaciones: la Señora y el Pantalla mataban al jugador en 6 s sin que
## alcanzara a responder, y un saqueador le quitaba 70 de vida desarmado):
##   boss_damage: multiplica el daño de los jefes y la Madremonte
##   rest: respiro después de cada ataque (s) en que solo rodea — la ventana para pegarle, como en Souls
##   npc_gun_damage: los saqueadores disparan el mismo fusil, con este factor de daño
const BALANCE := {"boss_damage": 0.65, "rest": {"boss": [0.8, 1.6], "normal": [0.25, 0.7]}, "npc_gun_damage": 0.5}

