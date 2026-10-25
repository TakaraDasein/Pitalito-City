class_name WorldConfig
## Configuración del mundo. Espejo de web/src/config/world.config.js y roads.config.js: si cambia allá, cambia acá.
## Lo estimado (no viene de datos) se marca ESTIMADO y se puede apagar.

const DATA_DIR := "res://data/world"

## Radio de streaming en tiles de 250 m alrededor del foco (jugador o vehículo).
const STREAM_RADIUS := 3
## Tiles que se instancian por frame como máximo: el trabajo pesado va en hilos, esto acota el pico en el principal.
const TILES_PER_FRAME := 1

## Relieve: tamaño de bloque en celdas (40 × 25 m = 1 km) y distancias de los dos niveles de detalle.
const TERRAIN_CHUNK_CELLS := 40
const TERRAIN_COARSE_STEP := 4
const TERRAIN_NEAR_RANGE := 2500.0
const TERRAIN_FAR_RANGE := 26000.0
## Bloques de relieve con colisión alrededor del foco (radio en bloques).
const TERRAIN_COLLISION_RADIUS := 1

## Árboles con modelo alrededor del foco (NearTrees; solo Godot, la web no lo tiene): radio (m) y cuánto se mueve
## el foco antes de rearmarlos. Más lejos, el árbol procedural.
const NEAR_TREE_RADIUS := 90.0
const NEAR_TREE_STEP := 12.0

## Altura de las calzadas sobre el relieve (m).
const ROAD_LIFT := 0.12
## Distancia a la que dejan de dibujarse edificios y árboles de un tile (m).
const TILE_VISIBILITY := 1100.0

## Clases de vía de OSM → ancho de calzada (m), superficie y velocidad del tráfico (km/h). El ancho es ESTIMADO por clase (OSM no lo trae).
const ROAD_CLASSES := {
	"trunk": {"width": 12.0, "rank": 7, "speed": 60.0}, "trunk_link": {"width": 8.0, "rank": 7, "speed": 40.0},
	"primary": {"width": 11.0, "rank": 6, "speed": 50.0}, "primary_link": {"width": 8.0, "rank": 6, "speed": 40.0},
	"secondary": {"width": 10.0, "rank": 5, "speed": 45.0}, "secondary_link": {"width": 7.0, "rank": 5, "speed": 35.0},
	"tertiary": {"width": 9.0, "rank": 4, "speed": 40.0}, "residential": {"width": 7.5, "rank": 3, "speed": 30.0},
	"unclassified": {"width": 7.0, "rank": 3, "speed": 30.0}, "living_street": {"width": 6.0, "rank": 2, "speed": 20.0},
	"service": {"width": 4.5, "rank": 2, "speed": 20.0},
	"track": {"width": 4.0, "rank": 1, "speed": 20.0, "surface": "dirt"},
	"pedestrian": {"width": 6.0, "rank": 1, "speed": 0.0, "surface": "brick"},
	"footway": {"width": 2.5, "rank": 0, "speed": 0.0, "surface": "brick"},
	"path": {"width": 2.0, "rank": 0, "speed": 0.0, "surface": "dirt"},
	"steps": {"width": 2.5, "rank": 0, "speed": 0.0, "surface": "brick"},
}

## Paleta de fachadas tomada de las fotos de referencia (web/assets/references). Igual que palette.config.js.
const FACADE_COLORS := [
	"#f4f1ea", "#f4f1ea", "#f4f1ea", "#efe8da", "#ece3cf", "#f6f3ee", "#e9e4dc",
	"#f2dfa7", "#e9c46a", "#f4a261", "#e07a5f", "#a8dadc", "#8ecae6", "#b8e0a8",
	"#f7cad0", "#cdb4db", "#d8c3a5", "#c9d6df", "#ffd6a5", "#9bc1bc",
]
const ROOF_COLORS := ["#8c8c88", "#9a9a95", "#7d7f80", "#a4553b", "#b0613f", "#6f7275", "#8a7866"]


static func road_class(c: String) -> Dictionary:
	return ROAD_CLASSES.get(c, ROAD_CLASSES["residential"])
