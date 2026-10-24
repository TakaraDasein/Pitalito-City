class_name ParticlesConfig
## Partículas de ambiente, espejo de web/src/config/particles.config.js (las familias que usa AmbienceSystem).
## Todas en la GPU (GPUParticles3D): una familia = un emisor = un draw call. Se apaga con ENABLED = false.
## Campos como en la web: max (a la vez), life (s), size [inicio, fin] (m), color [inicio, fin], alpha [inicio, fin],
## gravity (m/s², negativo cae), drag (frenado), glow (aditiva), speed y spread (de la emisión), blink (parpadeo),
## spin (giro, rad/s), fade (aparece y desaparece suave).

const ENABLED := true
## Tope por calidad (PARTICLES.escalaPorCalidad de la web; Godot no tiene "ultra").
const QUALITY_SCALE := {"baja": 0.25, "media": 0.6, "alta": 1.0}
## Monte: radio en que se cuentan árboles, y cuántos bastan para luciérnagas y hojas (BOSQUE.radio de la web, y
## el umbral de AmbienceSystem.js).
const FOREST_RADIUS := 40.0
const FOREST_MIN := 2

const FAMILIES := {
	"polvo": {"max": 220, "life": 1.1, "size": [0.12, 0.55], "gravity": -1.2, "drag": 1.6,
		"color": [Color("#b9a98c"), Color("#cfc3ab")], "alpha": [0.38, 0.0], "speed": 0.9, "spread": 0.5},
	"luciernagas": {"max": 160, "life": 6.0, "size": [0.045, 0.045], "gravity": 0.05, "drag": 0.2,
		"color": [Color("#d9ff7a"), Color("#8fd43a")], "alpha": [1.0, 1.0], "glow": true, "blink": true, "speed": 0.25, "spread": 1.0},
	"hojas": {"max": 180, "life": 5.5, "size": [0.1, 0.1], "gravity": -0.35, "drag": 0.25,
		"color": [Color("#7fae5b"), Color("#9c8a4a")], "alpha": [0.9, 0.0], "spin": 3.0, "speed": 0.7, "spread": 1.4},
	"bruma": {"max": 140, "life": 14.0, "size": [5.0, 11.0], "gravity": 0.02, "drag": 0.05,
		"color": [Color("#e6e8ea"), Color("#eef0f1")], "alpha": [0.09, 0.0], "fade": true, "speed": 0.5, "spread": 1.0},
	"motas": {"max": 260, "life": 7.0, "size": [0.025, 0.025], "gravity": -0.01, "drag": 0.15,
		"color": [Color("#fff1cf"), Color("#ffd99a")], "alpha": [0.55, 0.0], "glow": true, "fade": true, "speed": 0.18, "spread": 1.0},
}

## Golpes (EMISIONES de la web): lo que suelta un impacto según contra qué entra. n partículas por golpe.
const BURSTS := {
	"metal": {"max": 18, "n": 18, "life": 0.45, "size": [0.055, 0.012], "gravity": -9.0, "drag": 2.2,
		"color": [Color("#fff3c4"), Color("#ff7a1a")], "alpha": [1.0, 0.0], "glow": true, "speed": 3.4, "spread": 0.9},
	"hueso": {"max": 14, "n": 14, "life": 0.9, "size": [0.07, 0.3], "gravity": -2.5, "drag": 2.0,
		"color": [Color("#e8e2d0"), Color("#b9b2a0")], "alpha": [0.75, 0.0], "speed": 2.4, "spread": 1.0},
	"carne": {"max": 16, "n": 16, "life": 0.7, "size": [0.05, 0.03], "gravity": -9.5, "drag": 1.4,
		"color": [Color("#7a0d0d"), Color("#3d0505")], "alpha": [0.95, 0.6], "speed": 2.6, "spread": 1.1},
}
## Copias de cada golpe a la vez (golpes seguidos no se cortan unos a otros).
const BURST_POOL := 4
## Tensión de la imagen (PostFX.setTension de la web): sube con enemigos a menos de `radius` m y con el monte cerrado.
const TENSION := {"radius": 30.0, "enemy": 0.8, "forest": 0.35, "saturation": 0.28, "contrast": 0.12}

## Ritmo de emisión (partículas por segundo a pleno) para las familias que en la web se emiten de a pocas:
## bruma 1 cada 0,18 s, motas 2 cada 0,12 s, luciérnagas 2 y hojas 1 cada 0,25 s; polvo: 3 por paso (~2 pasos/s).
const RATE := {"polvo": 6.0, "luciernagas": 8.0, "hojas": 4.0, "bruma": 5.5, "motas": 16.0}
