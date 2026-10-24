class_name LootConfig
## Botín e inventario. Espejo de web/src/config/loot.config.js. FICCIÓN DECLARADA: lo que hay dentro de cada
## contenedor es inventado; dónde están los lugares no — son los puntos de interés reales de OpenStreetMap
## (data/world/map.json → pois, campo `k`). Cada tipo de lugar pone contenedores alrededor de su punto, fuera de
## los muros; lo que se saca queda saqueado (user://botin.cfg), así que un hospital vaciado sigue vacío.
##
## Diferencias con la web (de Godot):
##   · el botín está siempre activo (la web lo tiene solo en modo supervivencia, que Godot aún no tiene)
##   · las armas cuerpo a cuerpo son objetos (`melee`): el machete y las manos vienen de serie; peinilla, garrote,
##     azadón y rejo hay que encontrarlos o quitárselos a los Restos (DROPS), y entonces entran al arsenal (X, Z)

## Objetos. weight en kg; use = efecto (life, hunger, thirst, infection: estos tres los usará la supervivencia).
const ITEMS := {
	"venda": {"name": "Venda", "weight": 0.1, "use": {"life": 15}, "detail": "Para cortes y arañazos."},
	"botiquin": {"name": "Botiquín", "weight": 1.2, "use": {"life": 50}, "detail": "Gasas, yodo, esparadrapo."},
	"analgesico": {"name": "Analgésicos", "weight": 0.05, "use": {"life": 8}, "detail": "Acetaminofén."},
	"antibiotico": {"name": "Antibiótico", "weight": 0.05, "use": {"infection": -40}, "detail": "Contra la infección de una mordida."},
	"suero": {"name": "Suero oral", "weight": 0.5, "use": {"thirst": 35, "life": 5}, "detail": "Sales de rehidratación."},
	"agua": {"name": "Botella de agua", "weight": 0.6, "use": {"thirst": 40}, "detail": "600 ml."},
	"gaseosa": {"name": "Gaseosa", "weight": 0.4, "use": {"thirst": 25, "hunger": 5}},
	"enlatado": {"name": "Enlatado", "weight": 0.4, "use": {"hunger": 30}, "detail": "Atún o fríjoles."},
	"arroz": {"name": "Arroz (libra)", "weight": 0.5, "use": {"hunger": 20}},
	"panela": {"name": "Panela", "weight": 0.5, "use": {"hunger": 20, "thirst": -5}, "detail": "Del trapiche."},
	"cafe": {"name": "Café de Pitalito", "weight": 0.5, "use": {"hunger": 5}, "detail": "Origen: valle de Laboyos."},
	"fruta": {"name": "Fruta", "weight": 0.3, "use": {"hunger": 12, "thirst": 8}, "detail": "Granadilla, lulo, mora."},
	"pan": {"name": "Pan", "weight": 0.2, "use": {"hunger": 15}},
	"vela": {"name": "Velas", "weight": 0.2, "detail": "Luz de noche."},
	"linterna": {"name": "Linterna", "weight": 0.4, "detail": "Luz de noche."},
	"pilas": {"name": "Pilas", "weight": 0.1},
	"gasolina": {"name": "Galón de gasolina", "weight": 3.2, "detail": "Para el vehículo."},
	"chaleco": {"name": "Chaleco", "weight": 3.5, "detail": "Protección."},
	"tablas": {"name": "Tablas", "weight": 2.5, "detail": "Para tapiar."},
	"cuerda": {"name": "Cuerda", "weight": 0.8},
	"radio": {"name": "Radio portátil", "weight": 0.7, "detail": "Por si alguien sigue transmitiendo."},
	# armas de fuego (llegarán con FirearmSystem): por ahora se cargan, no se usan
	"pistola": {"name": "Pistola 9 mm", "weight": 0.8, "firearm": true},
	"revolver": {"name": "Revólver .38", "weight": 0.9, "firearm": true},
	"escopeta": {"name": "Escopeta de bomba", "weight": 3.4, "firearm": true},
	"recortada": {"name": "Escopeta recortada", "weight": 2.2, "firearm": true},
	"fusil": {"name": "Fusil", "weight": 3.6, "firearm": true},
	"rifle": {"name": "Rifle de cacería", "weight": 4.0, "firearm": true},
	"balas9": {"name": "Balas 9 mm", "weight": 0.012},
	"balas38": {"name": "Balas .38", "weight": 0.012},
	"cartuchos": {"name": "Cartuchos de escopeta", "weight": 0.04},
	"balas556": {"name": "Balas 5,56", "weight": 0.012},
	"balas308": {"name": "Balas .308", "weight": 0.025},
	# armas cuerpo a cuerpo (de Godot): tenerlas las pone en el arsenal; peso estimado de la herramienta real
	"peinilla": {"name": "Peinilla", "weight": 0.6, "melee": true, "detail": "Machete corto y recto. X: sacar · Z: cambiar."},
	"garrote": {"name": "Garrote de guadua", "weight": 1.4, "melee": true, "detail": "Golpea de plano y aturde."},
	"azadon": {"name": "Azadón", "weight": 2.3, "melee": true, "detail": "Pesado y lento. Lo que alcanza, lo tumba."},
	"rejo": {"name": "Rejo", "weight": 0.5, "melee": true, "detail": "La correa del arriero. Alcanza lejos."},
}
## Del arsenal, lo que se tiene sin buscarlo.
const STARTING_WEAPONS := ["manos", "machete"]

## Tablas: [objeto, peso de sorteo, cantidad mín, máx]. Cada contenedor saca entre rolls[0] y rolls[1].
const TABLES := {
	"medica": [["venda", 6, 1, 3], ["analgesico", 5, 1, 2], ["botiquin", 2, 1, 1], ["antibiotico", 3, 1, 1], ["suero", 3, 1, 2], ["agua", 2, 1, 1]],
	"policia": [["pistola", 1, 1, 1], ["revolver", 1, 1, 1], ["escopeta", 0.5, 1, 1], ["balas9", 4, 6, 15], ["balas38", 3, 4, 12], ["cartuchos", 3, 3, 8], ["chaleco", 2, 1, 1], ["linterna", 4, 1, 1], ["pilas", 4, 1, 3], ["radio", 2, 1, 1], ["venda", 3, 1, 2], ["agua", 3, 1, 1], ["enlatado", 2, 1, 1]],
	"iglesia": [["vela", 6, 1, 4], ["agua", 4, 1, 2], ["pan", 4, 1, 2], ["panela", 2, 1, 1], ["venda", 1, 1, 1]],
	"tienda": [["enlatado", 6, 1, 3], ["arroz", 4, 1, 2], ["agua", 5, 1, 3], ["gaseosa", 4, 1, 2], ["pilas", 2, 1, 2], ["panela", 2, 1, 1]],
	"mercado": [["fruta", 6, 1, 4], ["panela", 4, 1, 2], ["cafe", 4, 1, 1], ["arroz", 3, 1, 2], ["agua", 2, 1, 1], ["peinilla", 0.5, 1, 1], ["rejo", 0.5, 1, 1]],
	"gasolina": [["gasolina", 5, 1, 1], ["gaseosa", 4, 1, 2], ["agua", 3, 1, 1], ["linterna", 1, 1, 1], ["pilas", 2, 1, 2]],
	"saqueadores": [["fusil", 1, 1, 1], ["rifle", 0.6, 1, 1], ["recortada", 1, 1, 1], ["balas556", 4, 10, 30], ["balas308", 2, 3, 10], ["cartuchos", 3, 4, 10], ["enlatado", 2, 1, 3], ["agua", 2, 1, 2]],
	"bomberos": [["botiquin", 3, 1, 1], ["venda", 4, 1, 2], ["cuerda", 3, 1, 1], ["linterna", 3, 1, 1], ["tablas", 2, 1, 2], ["agua", 3, 1, 2], ["azadon", 0.6, 1, 1]],
}

## Contenedores: aspecto (caja de color, o camilla) y qué tabla usan. size en m [ancho, alto, fondo]; lift = a qué
## altura cuelga (botiquín de pared).
const CONTAINERS := {
	"botiquinPared": {"name": "Botiquín de pared", "table": "medica", "rolls": [1, 2], "shape": "caja", "size": [0.5, 0.6, 0.2], "color": "#e9e6df", "lift": 1.1},
	"camilla": {"name": "Camilla abandonada", "table": "medica", "rolls": [1, 3], "shape": "camilla", "size": [0.7, 0.85, 1.9], "color": "#c9ced3"},
	"casillero": {"name": "Casillero", "table": "policia", "rolls": [1, 3], "shape": "caja", "size": [0.5, 1.8, 0.5], "color": "#4f5a46"},
	"patrulla": {"name": "Caja de la patrulla", "table": "policia", "rolls": [2, 3], "shape": "caja", "size": [0.9, 0.5, 0.6], "color": "#2f3a2a"},
	"banca": {"name": "Bajo la banca", "table": "iglesia", "rolls": [1, 2], "shape": "caja", "size": [1.8, 0.45, 0.45], "color": "#7b4b2a"},
	"ofrendas": {"name": "Mesa de ofrendas", "table": "iglesia", "rolls": [1, 3], "shape": "caja", "size": [1.2, 0.9, 0.6], "color": "#8a6a3c"},
	"estante": {"name": "Estante", "table": "tienda", "rolls": [2, 3], "shape": "caja", "size": [1.4, 1.6, 0.45], "color": "#b9b4a6"},
	"nevera": {"name": "Nevera de bebidas", "table": "tienda", "rolls": [1, 2], "shape": "caja", "size": [0.7, 1.7, 0.6], "color": "#c8202a"},
	"puesto": {"name": "Puesto de mercado", "table": "mercado", "rolls": [2, 3], "shape": "caja", "size": [1.6, 0.9, 0.9], "color": "#5b7a3a"},
	"surtidor": {"name": "Tienda de la bomba", "table": "gasolina", "rolls": [1, 2], "shape": "caja", "size": [1.0, 1.2, 0.6], "color": "#d8a227"},
	"cajaArmas": {"name": "Caja de los saqueadores", "table": "saqueadores", "rolls": [2, 4], "shape": "caja", "size": [1.0, 0.5, 0.6], "color": "#3c4a2e"},
	"gabinete": {"name": "Gabinete de bomberos", "table": "bomberos", "rolls": [2, 3], "shape": "caja", "size": [0.8, 1.6, 0.4], "color": "#b3261e"},
}

## Qué ponen los lugares reales, por su tipo en OSM (`k`): cuántos contenedores y de qué clase.
const PLACES := {
	"hospital": {"count": 6, "containers": ["camilla", "botiquinPared", "camilla", "botiquinPared"]},
	"clinic": {"count": 3, "containers": ["camilla", "botiquinPared"]},
	"doctors": {"count": 2, "containers": ["botiquinPared"]},
	"police": {"count": 3, "containers": ["casillero", "patrulla"]},
	"place_of_worship": {"count": 3, "containers": ["banca", "ofrendas"]},
	"religious": {"count": 2, "containers": ["banca", "ofrendas"]},
	"monastery": {"count": 3, "containers": ["banca", "ofrendas"]},
	"supermarket": {"count": 3, "containers": ["estante", "nevera"]},
	"department_store": {"count": 2, "containers": ["estante"]},
	"variety_store": {"count": 2, "containers": ["estante", "nevera"]},
	"marketplace": {"count": 5, "containers": ["puesto"]},
	"fuel": {"count": 1, "containers": ["surtidor"]},
	"fire_station": {"count": 2, "containers": ["gabinete"]},
}

## Lo que llevan encima los Restos al caer (de Godot): su arma siempre, y a veces algo más. [objeto, probabilidad, n]
const DROPS := {
	"centinela": [["peinilla", 1.0, 1], ["venda", 0.35, 1], ["pan", 0.2, 1]],
	"machetero": [["venda", 0.5, 1], ["panela", 0.3, 1], ["agua", 0.3, 1]],
	"cabo": [["azadon", 1.0, 1], ["botiquin", 0.4, 1], ["enlatado", 0.4, 2]],
}

## visible_radius: los contenedores se arman a menos de esto; reach: distancia para registrar (F);
## max_load: kg que aguanta la mochila; drop_life: segundos que queda en el suelo lo que soltó un enemigo.
const LOOT := {"visible_radius": 120.0, "reach": 1.8, "max_load": 25.0, "drop_life": 180.0, "save": "user://botin.cfg"}
