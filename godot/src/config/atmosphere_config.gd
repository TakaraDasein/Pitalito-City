class_name AtmosphereConfig
## Atmósfera del Valle de Laboyos a lo largo del día. Espejo de web/src/config/atmosphere.config.js (generado de ahí).
## ESTIMADO (estético, no medido): mañanas de neblina que se levanta del río Guarapas y el Guachicos y se disipa
## hacia media mañana; tarde dorada; hora azul. Los parámetros de cielo (turbidez, Rayleigh, Mie, g) son los de
## PhysicalSkyMaterial de Godot, uno a uno. Se apaga con ENABLED = false.

const ENABLED := true
## Hora de arranque y duración del día (minutos reales por día de juego). GAME.time de la web.
const START_HOUR := 9.5
const DAY_MINUTES := 24.0

## Niebla FogExp2 de la web (densidad 0,00011 con relieve real). Godot usa niebla exponencial simple: se iguala la
## transmitancia a 3 km, exp(−(d·D)²) = exp(−g·D) ⇒ g = d²·D. ESTIMADO, ajuste visual.
const FOG_DENSITY_WEB := 0.00011
const FOG_MATCH_DISTANCE := 3000.0
## Niebla pegada al suelo (heightFog de la web): densa en el fondo del valle, rala en las laderas.
## En Godot la niebla de altura EMPIEZA en fog_height y se espesa hacia abajo: se pone en el fondo del casco urbano
## (medido: −30 m bajo el Parque es lo más bajo a ±3 km; el 10 % más bajo está bajo −10 m). ESTIMADO.
const HEIGHT_FOG_START := -12.0

## Partículas de la hora (ATMOSPHERE.particulas de la web): ventana horaria y radio alrededor del jugador.
##   bruma: jirones de neblina a ras de suelo, siguen a la niebla de la mañana; motas: polvo y polen al sol.
const PARTICLES := {
	"bruma": {"from": 5.5, "to": 10.0, "radius": [6.0, 45.0]},
	"motas": {"from": 6.0, "to": 18.4, "radius": [3.0, 16.0]},
}

const KEYS := [
	{"h": 0.0, "density": 2.2, "fog": Color("#0b1020"), "turbidity": 2.0, "rayleigh": 1.0, "mie": 0.004, "g": 0.8, "sun": Color("#9fb4ff"), "warmth": 0.0, "exposure": 0.7},
	{"h": 4.8, "density": 3.5, "fog": Color("#141a2a"), "turbidity": 3.0, "rayleigh": 1.0, "mie": 0.006, "g": 0.8, "sun": Color("#9fb4ff"), "warmth": 0.0, "exposure": 0.7},
	{"h": 5.8, "density": 30.0, "fog": Color("#8a8f9e"), "turbidity": 8.0, "rayleigh": 3.0, "mie": 0.012, "g": 0.86, "sun": Color("#ff9a6a"), "warmth": 0.3, "exposure": 0.56},
	{"h": 6.6, "density": 45.0, "fog": Color("#d9cfc4"), "turbidity": 9.0, "rayleigh": 2.6, "mie": 0.014, "g": 0.9, "sun": Color("#ffc79a"), "warmth": 0.45, "exposure": 0.55},
	{"h": 8.0, "density": 32.0, "fog": Color("#dfe3e6"), "turbidity": 6.0, "rayleigh": 2.0, "mie": 0.01, "g": 0.88, "sun": Color("#fff0dc"), "warmth": 0.3, "exposure": 0.54},
	{"h": 9.2, "density": 12.0, "fog": Color("#d2dfe9"), "turbidity": 4.0, "rayleigh": 1.8, "mie": 0.006, "g": 0.86, "sun": Color("#fff6ea"), "warmth": 0.45, "exposure": 0.54},
	{"h": 10.0, "density": 1.4, "fog": Color("#c9dbe8"), "turbidity": 2.5, "rayleigh": 1.6, "mie": 0.004, "g": 0.85, "sun": Color("#ffffff"), "warmth": 0.5, "exposure": 0.54},
	{"h": 15.0, "density": 1.3, "fog": Color("#c6d8e6"), "turbidity": 3.0, "rayleigh": 1.7, "mie": 0.005, "g": 0.85, "sun": Color("#fff6e8"), "warmth": 0.55, "exposure": 0.54},
	{"h": 16.6, "density": 1.4, "fog": Color("#e6cfa6"), "turbidity": 6.0, "rayleigh": 2.2, "mie": 0.008, "g": 0.9, "sun": Color("#ffd08a"), "warmth": 0.85, "exposure": 0.6},
	{"h": 17.6, "density": 1.9, "fog": Color("#f0a066"), "turbidity": 10.0, "rayleigh": 3.2, "mie": 0.016, "g": 0.93, "sun": Color("#ff7a3a"), "warmth": 1.0, "exposure": 0.7},
	{"h": 18.2, "density": 2.1, "fog": Color("#b06a5a"), "turbidity": 12.0, "rayleigh": 3.6, "mie": 0.02, "g": 0.95, "sun": Color("#ff4a22"), "warmth": 0.9, "exposure": 0.78},
	{"h": 18.8, "density": 2.2, "fog": Color("#3a3a58"), "turbidity": 6.0, "rayleigh": 2.0, "mie": 0.008, "g": 0.85, "sun": Color("#8a90ff"), "warmth": 0.2, "exposure": 0.68},
	{"h": 20.0, "density": 2.2, "fog": Color("#0b1020"), "turbidity": 2.0, "rayleigh": 1.0, "mie": 0.004, "g": 0.8, "sun": Color("#9fb4ff"), "warmth": 0.0, "exposure": 0.7},
	{"h": 24.0, "density": 2.2, "fog": Color("#0b1020"), "turbidity": 2.0, "rayleigh": 1.0, "mie": 0.004, "g": 0.8, "sun": Color("#9fb4ff"), "warmth": 0.0, "exposure": 0.7},
]


## Fotograma interpolado para la hora (lineal; colores en espacio lineal como la web).
static func sample(hour: float) -> Dictionary:
	var i := 0
	while i < KEYS.size() - 2 and KEYS[i + 1].h <= hour:
		i += 1
	var a: Dictionary = KEYS[i]
	var b: Dictionary = KEYS[i + 1]
	var t := clampf((hour - a.h) / maxf(b.h - a.h, 0.001), 0.0, 1.0)
	var out := {}
	for k: String in a:
		if a[k] is Color:
			out[k] = a[k].srgb_to_linear().lerp(b[k].srgb_to_linear(), t).linear_to_srgb()
		else:
			out[k] = lerpf(a[k], b[k], t)
	return out
