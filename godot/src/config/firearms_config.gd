class_name FirearmsConfig
## Armas de fuego. Espejo de web/src/config/firearms.config.js. Modelos CC0: «Guns Asset Pack» de Styloo (pistola,
## escopeta, fusil y rifle) y «50+ LowPoly Guns» de Quaternius (revólver y recortada); ver web/scripts/fetch-characters.mjs.
##
## file: el GLB (assets/models/weapons/); length: largo real de un arma de ese tipo (m), a esa escala se pone.
## barrel: +1 si el cañón apunta a +X en el archivo, −1 si a −X. grip y handguard: [fracción del largo desde la
## culata, fracción del alto desde abajo] — dónde va la mano derecha y la izquierda (armas largas, con cinemática
## inversa). El guardamanos de Godot va más atrás que el de la web (0,5 en vez de 0,6): más adelante el brazo
## izquierdo no alcanzaba desde el hombro (medido: le faltaban 0,27 m). Sin grip, el origen del archivo ya es la empuñadura (Quaternius).
## Las cifras son de juego, no balística. ammo: el objeto de la mochila que gastan (LootConfig.ITEMS).
## damage (cae a la mitad a todo el alcance), range (m), rate (s entre tiros), reload (s), spread (rad),
## pellets (perdigones por tiro), noise (m a los que se oye), recoil (sube la mira, rad).
## eject: qué sale al recargar — "mag" (el cargador vacío cae al suelo; mag_at = [fracción del largo, del alto] de
## donde sale y mag_size su tamaño, m), "casings" (las vainas del tambor) o "shells" (los cartuchos de la escopeta).
## Cada tiro expulsa además un casquillo (las escopetas, el cartucho al bombear). Medidas de los cargadores ESTIMADAS.

const FIREARMS := {
	"pistola": {"name": "Pistola 9 mm", "eject": "mag", "mag_at": [0.22, 0.05], "mag_size": [0.03, 0.11, 0.022], "file": "styloo_pew.glb", "length": 0.2, "barrel": 1, "grip": [0.2, 0.3], "ammo": "balas9", "magazine": 15,
		"damage": 22.0, "range": 60.0, "rate": 0.22, "reload": 1.4, "spread": 0.012, "pellets": 1, "noise": 70.0, "recoil": 0.03},
	"revolver": {"name": "Revólver .38", "eject": "casings", "file": "Revolver_1.glb", "length": 0.24, "ammo": "balas38", "magazine": 6,
		"damage": 34.0, "range": 55.0, "rate": 0.45, "reload": 2.2, "spread": 0.01, "pellets": 1, "noise": 75.0, "recoil": 0.05},
	"escopeta": {"name": "Escopeta de bomba", "eject": "shells", "file": "styloo_shotgun.glb", "length": 1.05, "barrel": 1, "grip": [0.3, 0.35], "handguard": [0.52, 0.45], "ammo": "cartuchos", "magazine": 6, "long": true,
		"damage": 11.0, "range": 28.0, "rate": 0.85, "reload": 2.8, "spread": 0.07, "pellets": 9, "noise": 95.0, "recoil": 0.09},
	"recortada": {"name": "Escopeta recortada", "eject": "shells", "file": "Shotgun_SawedOff.glb", "length": 0.6, "handguard": [0.6, 0.45], "ammo": "cartuchos", "magazine": 2,
		"damage": 12.0, "range": 16.0, "rate": 0.35, "reload": 2.0, "spread": 0.11, "pellets": 9, "noise": 95.0, "recoil": 0.1},
	"fusil": {"name": "Fusil", "eject": "mag", "mag_at": [0.45, 0.02], "mag_size": [0.07, 0.2, 0.03], "file": "styloo_ak47.glb", "length": 0.9, "barrel": 1, "grip": [0.33, 0.3], "handguard": [0.5, 0.5], "ammo": "balas556", "magazine": 30, "long": true, "automatic": true,
		"damage": 20.0, "range": 110.0, "rate": 0.1, "reload": 2.4, "spread": 0.018, "pellets": 1, "noise": 110.0, "recoil": 0.025},
	"rifle": {"name": "Rifle de cacería", "eject": "mag", "mag_at": [0.42, 0.12], "mag_size": [0.07, 0.07, 0.03], "file": "styloo_awp.glb", "length": 1.15, "barrel": 1, "grip": [0.3, 0.35], "handguard": [0.48, 0.5], "ammo": "balas308", "magazine": 5, "long": true,
		"damage": 70.0, "range": 200.0, "rate": 1.1, "reload": 3.0, "spread": 0.004, "pellets": 1, "noise": 120.0, "recoil": 0.12},
}
const DIR := "res://assets/models/weapons/"
## Apuntando (clic derecho): la dispersión se multiplica por `aim`; sin apuntar, desde la cadera, por `hip`.
const PRECISION := {"aim": 0.5, "hip": 1.4}
## Cámara al apuntar: brazo más corto, por encima del hombro derecho, y menos campo de visión.
const AIM_CAMERA := {"distance": 1.7, "shoulder": 0.55, "fov": 50.0, "speed": 10.0}
## Golpe de un tiro: temple que rompe y empuje (más cuanto más daño; la escopeta tumba).
const HIT := {"poise": 25.0, "push_max": 6.0}
## Blanco de los tiros: cilindro vertical por combatiente (m).
const TARGET := {"radius": 0.35, "height": 1.8}
## Cómo se sostiene: la empuñadura va en la mano derecha y el arma apunta por la línea de tiro (apuntando, a la
## mira; en reposo, al frente y `low_ready` rad hacia abajo). No se cuelga del giro de la muñeca: el clip de pistola
## dobla la muñeca y el arma salía apuntando 27° hacia arriba (medido con tools/menu_shots -- disparos).
## Armas largas: la culata se apoya en el hombro derecho (un poco abajo y hacia adentro) y las dos manos llegan con
## cinemática inversa: la derecha a la empuñadura, la izquierda al guardamanos. ESTIMADO, ajustado en las capturas.
const HOLD := {"low_ready": 0.45, "follow": 18.0, "shoulder_drop": 0.06, "shoulder_in": 0.1}
## Seguro (tecla B): puesto, el gatillo hace clic y no dispara. Se saca el arma con el seguro como estaba.
const SAFETY := {"start_on": false}
## Casquillos y cargadores: cuántos a la vez en el suelo y cuánto duran (s). Son cuerpos rígidos que rebotan.
const SPENT := {"max": 40, "life": 25.0, "casing_size": [0.009, 0.022], "eject_speed": 2.6}
## Modo de pruebas de la web (pedido el 21-10, temporal): allá están encendidos. En Godot apagados: las armas hay
## que encontrarlas (casilleros de la policía, cajas de los saqueadores) y recargar gasta munición.
const TESTING := {"all_weapons": false, "infinite_ammo": false}
