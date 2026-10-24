class_name BuildingsConfig
## Edificios cercanos armados con el Building Kit y el Furniture Kit de Kenney (CC0, web/assets/models/CREDITS.md).
## DATO: huella, altura (h), número de pisos (f), color del techo (rc) y, cuando OSM lo trae, el negocio que funciona
## ahí (nombre y tipo). ESTIMADO (no está en los datos; se apaga con ENABLED = false): el estilo de la fachada, qué
## vanos lleva, dónde está la puerta, qué edificios se recorren, cómo se reparten los cuartos y qué muebles hay.
## Todo es determinista: el mismo edificio sale siempre igual.

const ENABLED := true
## Tiles alrededor del foco con edificios armados (radio en tiles de 250 m). Más allá, la caja con atlas.
const DETAIL_RADIUS := 1
## Distancia a la que se dejan de dibujar muebles, revestimientos y puertas interiores (m).
const FURNITURE_RANGE := 70.0
## Luces interiores: un pool que se reasigna a los pisos recorribles más cercanos al foco (no una por casa).
const INTERIOR_LIGHTS := 12
const INTERIOR_LIGHT_RADIUS := 30.0
## Distancia para abrir o cerrar una puerta con F (m).
const DOOR_REACH := 2.6

const PIECES_DIR := "res://assets/models/buildings"
const FURNITURE_DIR := "res://assets/models/furniture"
## Módulo del kit: paredes de 2 m de ancho y 2,4 m de alto; las anchas, de 4 m.
const MODULE := 2.0
const KIT_FLOOR := 2.4
## Vanos del kit, MEDIDOS sobre las mallas (tools/measure_openings.tscn): [ancho, alto desde, alto hasta] en metros
## del kit (piezas de 2 m; 4 m las anchas). Las "detailed" comparten el marco de su pieza simple.
const OPENINGS := {
	"wall-window-square": [0.88, 0.72, 1.88], "wall-window-round": [0.88, 0.82, 1.88],
	"wall-window-wide-square": [2.88, 1.20, 1.88], "wall-window-wide-round": [2.88, 0.82, 1.88],
	"wall-doorway-square": [0.88, 0.0, 2.08], "wall-doorway-round": [0.88, 0.0, 2.08],
	"wall-doorway-wide-square": [2.88, 0.0, 2.08], "wall-doorway-wide-round": [2.88, 0.0, 2.08],
}

## Principios constructivos (práctica colombiana; las normas de vivienda piden ≥ 2,2–2,4 m libres):
## altura de piso a piso mínima y del primer piso comercial, grosor de losa, escalera (contrahuella máxima, huella,
## ancho), espacio libre sobre la cabeza en la escalera y alto de baranda.
const FLOOR_MIN := 2.75
const GROUND_COMMERCIAL := 3.3
const SLAB := 0.18
const RISER_MAX := 0.175
const TREAD := 0.28
const STAIR_WIDTH := 1.0
const LANDING := 1.1
const HEADROOM := 2.1
const RAIL_HEIGHT := 0.95


static func opening(piece: String) -> Array:
	return OPENINGS.get(piece.replace("-detailed", ""), [0.0, 0.0, 0.0])


## Estilos de fachada (ESTIMADO, inspirados en las fotos de web/assets/references): el centro de Pitalito mezcla
## casa colonial de arcos, local comercial con persiana, edificio moderno de ventana cuadrada y casa popular.
const STYLES := {
	"colonial": {"weight": 3.0, "window": ["wall-window-round", "wall-window-round-detailed"],
		"door": "wall-doorway-round", "wide": "wall-doorway-wide-round", "leaf": "door-rotate-round-a", "columns": true, "colors": "light"},
	"comercial": {"weight": 4.0, "window": ["wall-window-square", "wall-window-square-detailed", "wall-window-wide-square"],
		"door": "wall-doorway-square", "wide": "wall-doorway-wide-square", "leaf": "door-rotate-square-a", "shutters": true, "colors": "any"},
	"moderno": {"weight": 2.0, "window": ["wall-window-square-detailed", "wall-window-wide-square-detailed"],
		"door": "wall-doorway-square", "wide": "wall-doorway-wide-square", "leaf": "door-rotate-square-c", "colors": "any"},
	"popular": {"weight": 3.0, "window": ["wall-window-square", "wall-window-round"],
		"door": "wall-doorway-square", "wide": "wall-doorway-wide-square", "leaf": "door-rotate-square-b", "colors": "any"},
}

## Colores de la pintura interior (ESTIMADO): blancos y pasteles de casa colombiana.
const INTERIOR_COLORS := ["#f3efe6", "#f6f1e4", "#eef3ea", "#f4e9dc", "#e9eef4", "#f5ece6"]

## Qué edificios se recorren (ESTIMADO): uno de cada ENTERABLE_EVERY de huella rectangular y área donde caben
## cuartos (m²). Los que tienen un negocio real de OSM adentro se recorren siempre (si la huella lo permite).
const ENTERABLE_EVERY := 3
const ENTERABLE_AREA := Vector2(35.0, 420.0)
## Distancia máxima del punto de OSM a la huella para considerar que el negocio está en ese edificio (m).
const POI_REACH := 6.0
## Tipo de OSM → tipo de local (cuarto de la planta baja). Los que no están aquí no cambian el interior.
const POI_ROOMS := {
	"supermarket": "mercado", "variety_store": "mercado", "department_store": "mercado", "mall": "mercado",
	"marketplace": "mercado", "commercial": "mercado",
	"bank": "banco", "post_office": "banco",
	"hotel": "hotel", "love_hotel": "hotel",
	"cafe": "cafeteria", "fast_food": "cafeteria",
	"clothes": "almacen", "mobile_phone": "almacen", "motorcycle": "motos", "car": "carros", "car_repair": "taller",
	"doctors": "consultorio", "clinic": "consultorio",
}

## Cuartos de negocio: su lista de muebles se repite según el área (un local de 80 m² no queda con cinco muebles).
## En los cuartos de una casa no: una cama por alcoba.
const COMMERCIAL := ["tienda", "mercado", "almacen", "cafeteria", "banco", "motos", "carros", "taller"]

## Muebles por tipo de cuarto: [pieza, dónde]. Una pieza que empieza con "@" es un vehículo del catálogo
## (VehiclesConfig) en exhibición: la moto horneada de la web en un concesionario de motos, por ejemplo. "pared": contra la pared lejana, mirando adentro; "centro": en fila
## en el medio del cuarto; "encima": sobre el mueble anterior (computador en el escritorio, cafetera en el mostrador).
const ROOMS := {
	"tienda": [["bookcaseOpen", "pared"], ["bookcaseOpen", "pared"], ["kitchenBar", "pared"], ["kitchenBarEnd", "pared"],
		["kitchenFridgeSmall", "pared"], ["cardboardBoxClosed", "centro"], ["cardboardBoxOpen", "centro"], ["stoolBar", "centro"]],
	"mercado": [["bookcaseOpen", "pared"], ["bookcaseOpen", "pared"], ["bookcaseOpen", "pared"], ["kitchenFridgeLarge", "pared"],
		["kitchenFridgeLarge", "pared"], ["bookcaseOpenLow", "centro"], ["bookcaseOpenLow", "centro"], ["cardboardBoxClosed", "centro"]],
	"banco": [["desk", "pared"], ["computerScreen", "encima"], ["chairDesk", "centro"], ["desk", "pared"], ["computerScreen", "encima"],
		["bookcaseClosed", "pared"], ["loungeChair", "centro"], ["pottedPlant", "pared"]],
	"hotel": [["kitchenBar", "pared"], ["kitchenBarEnd", "pared"], ["loungeSofa", "pared"], ["tableCoffee", "centro"],
		["pottedPlant", "pared"], ["lampSquareFloor", "pared"]],
	"cafeteria": [["kitchenBar", "pared"], ["kitchenCoffeeMachine", "encima"], ["kitchenBar", "pared"], ["kitchenFridge", "pared"],
		["tableRound", "centro"], ["chair", "centro"], ["tableRound", "centro"], ["chair", "centro"]],
	"almacen": [["coatRackStanding", "pared"], ["coatRackStanding", "pared"], ["bookcaseClosedWide", "pared"], ["kitchenBar", "pared"],
		["rugRectangle", "centro"], ["coatRack", "centro"]],
	"motos": [["kitchenBar", "pared"], ["kitchenBarEnd", "pared"], ["desk", "pared"], ["computerScreen", "encima"],
		["@moto", "centro"], ["@moto", "centro"], ["@moto", "centro"], ["pottedPlant", "pared"], ["chairDesk", "centro"]],
	"carros": [["desk", "pared"], ["computerScreen", "encima"], ["loungeSofa", "pared"], ["pottedPlant", "pared"],
		["@sedan", "centro"], ["@suv", "centro"]],
	"taller": [["kitchenCabinet", "pared"], ["kitchenCabinetDrawer", "pared"], ["bookcaseOpen", "pared"],
		["cardboardBoxClosed", "pared"], ["@sedan", "centro"], ["cardboardBoxOpen", "centro"]],
	"consultorio": [["desk", "pared"], ["computerScreen", "encima"], ["bedSingle", "pared"], ["bookcaseClosed", "pared"],
		["chairDesk", "centro"], ["chair", "centro"]],
	"sala": [["loungeSofa", "pared"], ["cabinetTelevision", "pared"], ["televisionModern", "encima"], ["pottedPlant", "pared"],
		["lampRoundFloor", "pared"], ["tableCoffee", "centro"], ["rugRectangle", "centro"]],
	"cocina": [["kitchenFridge", "pared"], ["kitchenStove", "pared"], ["kitchenSink", "pared"], ["kitchenCabinet", "pared"],
		["table", "centro"], ["chairCushion", "centro"], ["chairCushion", "centro"]],
	"alcoba": [["bedDouble", "pared"], ["sideTable", "pared"], ["lampRoundTable", "encima"], ["bookcaseClosed", "pared"],
		["rugRound", "centro"]],
	"bano": [["toilet", "pared"], ["bathroomSink", "pared"], ["shower", "pared"], ["bathroomMirror", "pared"]],
}
## Cuartos de arriba (por piso) según el local de abajo.
const UPPER_ROOMS := {
	"hotel": ["alcoba", "alcoba"], "default": ["alcoba", "bano"],
}
