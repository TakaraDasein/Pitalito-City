class_name CharacterConfig
## Catálogo de apariencia, espejo de APPEARANCE y ORIGENES de web/src/config/characters.config.js. Solo entra lo
## que trae el paquete gratuito de Quaternius (CC0); los nombres son los de los oficios de Pitalito.

const BASE := "res://assets/models/characters/"

## Cuánto se mete la piel bajo la ropa (m): los cuerpos del paquete son más corpulentos que su ropa. La web usa
## 0,017 en todo el cuerpo; aquí solo bajo la ropa (ver COVERS), y con menos asomaban pecho y muslos (capturas).
const SKIN_SHRINK := 0.03
## Qué huesos tapa cada tipo de pieza (prefijos de nombre): solo esos vértices se meten bajo la ropa.
const COVERS := {
	"Body": ["pelvis", "spine_", "clavicle_"], "Arms": ["upperarm_", "lowerarm_"],
	"Legs": ["pelvis", "thigh_", "calf_"], "Feet": ["foot_", "ball_"],
}
## Altura del ala del sombrero sobre el hueso de la cabeza (m). La web usa 0,14 sobre su hueso; aquí el origen
## del hueso "Head" queda más alto y con eso flotaba (ajustado mirando las capturas).
const HAT_LIFT := 0.155

const BODIES := {
	"a": {"name": "Complexión A", "file": "base/Superhero_Male_FullBody.gltf", "clothes": "Male"},
	"b": {"name": "Complexión B", "file": "base/Superhero_Female_FullBody.gltf", "clothes": "Female"},
}
const HAIR := {
	"ninguno": {"name": "Sin pelo", "file": ""},
	"partido": {"name": "Partido", "file": "base/Hair_SimpleParted.gltf"},
	"corto": {"name": "Al rape", "file": "base/Hair_Buzzed.gltf"},
	"corto-b": {"name": "Corto", "file": "base/Hair_BuzzedFemale.gltf"},
	"largo": {"name": "Largo", "file": "base/Hair_Long.gltf"},
	"monos": {"name": "Recogido", "file": "base/Hair_Buns.gltf"},
}
const BEARD := {
	"ninguna": {"name": "Sin barba", "file": ""},
	"barba": {"name": "Barba", "file": "base/Hair_Beard.gltf"},
}
## Ropa por piezas; {S} = Male/Female según la complexión.
const OUTFITS := {
	"campo": {"name": "Ropa de trabajo", "detail": "La del cafetal: camisa de manga larga, pantalón y botas",
		"parts": ["{S}_Peasant_Body", "{S}_Peasant_Arms", "{S}_Peasant_Legs", "{S}_Peasant_Feet"]},
	"camino": {"name": "Ropa de camino", "detail": "Más cerrada, para el monte y la noche",
		"parts": ["{S}_Ranger_Body", "{S}_Ranger_Arms", "{S}_Ranger_Legs", "{S}_Ranger_Feet"]},
	"mixta": {"name": "Camisa y botas de monte", "detail": "Camisa del cafetal con el pantalón y las botas del camino",
		"parts": ["{S}_Peasant_Body", "{S}_Peasant_Arms", "{S}_Ranger_Legs", "{S}_Ranger_Feet"]},
	"chaqueta": {"name": "Chaqueta de camino", "detail": "Chaqueta cerrada sobre el pantalón de trabajo",
		"parts": ["{S}_Ranger_Body", "{S}_Ranger_Arms", "{S}_Peasant_Legs", "{S}_Peasant_Feet"]},
	"ninguna": {"name": "Sin ropa", "detail": "Solo el cuerpo", "parts": []},
}
const HOOD := "{S}_Ranger_Head_Hood"
const PAULDRONS := "{S}_Ranger_Acc_Pauldrons"
## El paquete no nombra igual las piezas de los dos cuerpos (el masculino trae Feet_Boots y una sola hombrera).
const RENAMED := {"Male_Ranger_Feet": "Male_Ranger_Feet_Boots", "Male_Ranger_Acc_Pauldrons": "Male_Ranger_Acc_Pauldron"}

const SKIN := {
	"1": ["Claro", "#e8c39e"], "2": ["Medio", "#c68a5e"], "3": ["Trigueño", "#a0714f"], "4": ["Oscuro", "#6f4630"],
	"5": ["Canela", "#b47b52"], "6": ["Moreno", "#87573a"], "7": ["Muy oscuro", "#4e3022"],
}
const HAIR_COLOR := {
	"negro": ["Negro", "#1b1410"], "castano": ["Castaño", "#4a2f1d"], "claro": ["Claro", "#a87a45"],
	"cano": ["Cano", "#b9b2a6"], "rojizo": ["Rojizo", "#6e3420"], "rubio": ["Rubio", "#c49a5e"], "gris": ["Gris", "#6a645d"],
}

## Oficios de Pitalito como origen (de la economía real del municipio, ver web/docs/HISTORIA.md): fijan ropa y
## sombrero iniciales. La partida (arma y mochila) llega con el combate y la supervivencia.
const ORIGINS := {
	"caficultor": {"name": "Caficultor", "detail": "22.064 hectáreas de cultivos permanentes. Machete y buena resistencia.",
		"look": {"ropa": "campo", "sombrero": true}},
	"arriero": {"name": "Arriero", "detail": "Los caminos de herradura del sur. Aguanta más carga y camina más rápido.",
		"look": {"ropa": "camino", "sombrero": true}},
	"chivero": {"name": "Chivero", "detail": "Conduce la chiva por la vereda. Conoce todas las vías.",
		"look": {"ropa": "campo", "sombrero": false}},
	"guaquero": {"name": "Guaquero", "detail": "Busca lo que el valle enterró. Ve las piezas de historia desde más lejos.",
		"look": {"ropa": "camino", "sombrero": false}},
}

const DEFAULT_LOOK := {
	"origen": "caficultor", "cuerpo": "a", "piel": "3", "pelo": "partido", "pelocolor": "negro", "barba": "ninguna",
	"ropa": "campo", "capucha": false, "hombreras": false, "sombrero": true,
}


static func part_file(part: String, sex: String) -> String:
	var name := part.replace("{S}", sex)
	name = RENAMED.get(name, name)
	return BASE + "outfits/%s.gltf" % name
