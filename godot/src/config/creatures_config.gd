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

const DIR := "res://assets/models/externos/"

const CREATURES := {
	"caballo": {"name": "Caballo", "file": "fauna/caballo.glb", "role": "fauna", "height": 1.65, "humanoid": false,
		"clips": {"idle": "Horse_Idle", "walk": "Horse_Walk"}},
	"lobo": {"name": "Lobo de la jauría", "file": "mito/lobo.glb", "role": "mito", "height": 0.85, "humanoid": false,
		"clips": {"idle": "Wolf_Howl", "walk": "Wolf_WalkFast_F", "run": "Wolf_WalkFast_F", "attack": "Wolf_WalkFast_F"}},
	"venado-monte": {"name": "Venado del monte", "file": "mito/venado-monte.glb", "role": "mito", "height": 2.3, "humanoid": false,
		"clips": {"idle": "Deer_Idle", "walk": "Deer_WalkFast_F"}},
	"hojarasquin": {"name": "El Hojarasquín del monte", "file": "mito/hojarasquin.glb", "role": "mito", "height": 2.6, "humanoid": false,
		"clips": {"idle": "Take 001", "walk": "Take 001"}},
	"madremonte": {"name": "La Madremonte", "file": "mito/madremonte.glb", "role": "mito", "height": 2.0, "humanoid": true,
		"clips": {"idle": "Sword_Idle", "walk": "Walk", "run": "Jog_Fwd", "attack": "Sword_Attack", "hit": "Hit_Chest", "death": "Death01"}},
	"saqueador": {"name": "Saqueador", "file": "enemigo/saqueador.glb", "role": "enemigo", "height": 1.78, "humanoid": true,
		"clips": {"idle": "Pistol_Idle", "walk": "Walk", "run": "Jog_Fwd", "attack": "Pistol_Shoot", "hit": "Hit_Chest", "death": "Death01"}},
	"jefa-agris": {"name": "La Señora de la base", "file": "jefe/jefa-agris.glb", "role": "jefe", "height": 1.85, "humanoid": true,
		"clips": {"idle": "Sword_Idle", "walk": "Walk", "run": "Jog_Fwd", "attack": "Sword_Regular_A", "hit": "Hit_Chest", "death": "Death01"}},
	"jefe-elefante": {"name": "El Coloso", "file": "jefe/jefe-elefante.glb", "role": "jefe", "height": 3.4, "humanoid": false,
		"clips": {"idle": "01_Idle", "walk": "02_Walk", "run": "03_Run", "attack": "05_Attack"}},
	"jefe-tvman": {"name": "El Pantalla", "file": "jefe/jefe-tvman.glb", "role": "jefe", "height": 2.5, "humanoid": true,
		"clips": {"idle": "Idle", "walk": "Walk", "run": "Jog_Fwd", "attack": "Punch_Cross", "hit": "Hit_Chest", "death": "Death01"}},
}
