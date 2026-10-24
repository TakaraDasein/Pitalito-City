class_name BridgesConfig
## Puentes. DATO: dónde una vía de OSM cruza un río (Puente El Libertador y Avenida Pastrana sobre el Guarapas, y
## los demás cruces), el ancho de la vía por su clase y el del río. ESTIMADO: altura del tablero, largo de las
## rampas, barandas (amarillas y negras como en la foto del usuario desde la Carrera 3, oct 2013) y la pasarela
## peatonal, que no está en OSM: la ubica el usuario por la foto, aquí aguas arriba del Puente El Libertador.

const ENABLED := true
const CLEARANCE := 1.2        # tablero sobre la superficie del agua (m)
const DECK_T := 0.45          # grosor del tablero
const ABUTMENT := 4.0         # el tablero sigue esta distancia sobre tierra a cada lado del cauce (m)
const RAMP := 9.0             # rampa de cada lado, del tablero a la calle (m)
const SIDEWALK := 1.2         # andén del puente a cada lado de la calzada (m)
const RAIL_H := 0.85          # baranda vehicular (perfil de defensa) a esta altura

## Pasarela peatonal (ESTIMADO): junto a qué puente, a cuántos metros por el río y hacia dónde (+1 aguas abajo,
## −1 aguas arriba, en el sentido en que OSM dibuja el cauce). Ancho y altura sobre el agua.
const FOOTBRIDGES := [
	{"near": "Puente El Libertador", "along": 55.0, "dir": -1.0, "width": 1.8, "clearance": 1.6},
]
