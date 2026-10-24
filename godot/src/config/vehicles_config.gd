class_name VehiclesConfig
## Catálogo de vehículos, espejo de web/src/config/vehicles.config.js (nombre, medidas, masa, velocidad, giro).
## Dos orígenes de modelo:
##   kenney — Kenney Car Kit (CC0, ver web/assets/models/CREDITS.md); medidas de carrocería ESTIMADAS a las que
##            se escala el modelo.
##   baked  — modelados a mano en la web y horneados a GLB (web/tools/bake-godot.mjs); ya vienen a escala real.
## colors: pinturas del garaje (la primera es la de fábrica; vacío = color fijo, como el taxi amarillo). Las mismas
## de la web. Los horneados cambian el material de fábrica; los de Kenney mueven las UV de la carrocería a otra
## muestra de su paleta compartida (KENNEY_PALETTE, la de web/src/entities/vehicles/models/kenney.js).
## seat: dónde se sienta el conductor, en el espacio del modelo de la web (medido allá sobre cada modelo); los del
## Car Kit no tienen: el conductor no se ve (vidrios oscuros), como en la web.
## engine (N) y brake son de la física de Godot (VehicleBody3D), calibrados a ojo: no hay dato.

const VEHICLES := {
	"willys": {"name": "Jeep Willys", "source": "baked", "seat": [-0.34, 0.47, 0.12], "engine_hz": [38, 150], "colors": ["#b3261e", "#1d4e89", "#4b5d3a", "#eeeeea", "#e8b20c", "#d9661f", "#1f1f1f"], "length": 3.9, "width": 1.6, "mass": 1250.0, "max_speed": 120.0, "max_steer": 0.6},
	"taxi": {"name": "Taxi", "source": "baked", "seat": [-0.35, 0.11, 0.02], "engine_hz": [55, 220], "length": 3.7, "width": 1.62, "mass": 900.0, "max_speed": 140.0, "max_steer": 0.55},
	"pickup": {"name": "Camioneta de platón", "source": "baked", "seat": [-0.4, 0.37, -0.18], "engine_hz": [42, 170], "colors": ["#e9ecef", "#9aa0a6", "#1f1f1f", "#7d1f1f", "#1d3557", "#5a5a3c"], "length": 5.3, "width": 1.86, "mass": 2000.0, "max_speed": 150.0, "max_steer": 0.52},
	"chiva": {"name": "Chiva", "source": "baked", "seat": [-0.55, 0.75, -2.05], "engine_hz": [28, 95], "colors": ["#3fae49", "#1d4e89", "#d62828", "#f2c230"], "length": 8.5, "width": 2.6, "mass": 7000.0, "max_speed": 85.0, "max_steer": 0.5},
	"motocarro": {"name": "Motocarro", "source": "baked", "seat": [0, 0.21, -0.25], "engine_hz": [80, 240], "colors": ["#2e7d32", "#f2c230", "#1d4e89", "#c62828"], "length": 2.6, "width": 1.3, "mass": 400.0, "max_speed": 70.0, "max_steer": 0.65},
	"moto": {"name": "Moto", "source": "baked", "seat": [0, 0.4, -0.2], "engine_hz": [70, 260], "colors": ["#1d4e89", "#c62828", "#1f1f1f", "#e9ecef", "#2e7d32"], "length": 2.0, "width": 0.7, "mass": 120.0, "max_speed": 110.0, "max_steer": 0.7},
	"sedan": {"name": "Automóvil", "source": "kenney", "colors": ["#ffffff", "#a0a8c9", "#4f5260", "#cf534f", "#6794d9"], "length": 4.3, "width": 1.7, "height": 1.3, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"suv": {"name": "Campero", "source": "kenney", "colors": ["#ffffff", "#a0a8c9", "#4f5260", "#cf534f", "#6794d9", "#61cb8b"], "length": 4.4, "width": 1.8, "height": 1.55, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"van": {"name": "Van intermunicipal", "source": "kenney", "colors": ["#ffffff", "#a0a8c9", "#6794d9"], "length": 5.0, "width": 1.9, "height": 1.85, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"truck": {"name": "Camioneta", "source": "kenney", "colors": ["#ffffff", "#a0a8c9", "#4f5260", "#cf534f", "#6794d9", "#61cb8b"], "length": 5.2, "width": 1.8, "height": 1.6, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"delivery": {"name": "Furgón", "source": "kenney", "colors": ["#ffffff", "#61cb8b", "#6794d9", "#cf534f"], "length": 6.5, "width": 2.2, "height": 2.8, "mass": 5000.0, "max_speed": 120.0, "max_steer": 0.55},
	"garbage-truck": {"name": "Recolector de basura", "source": "kenney", "length": 8.0, "width": 2.4, "height": 3.0, "mass": 9000.0, "max_speed": 120.0, "max_steer": 0.55},
	"ambulance": {"name": "Ambulancia", "source": "kenney", "length": 5.8, "width": 2.0, "height": 2.5, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
}

## Pinturas del Car Kit → [fila, columna del par] en su atlas de 16 × 4 muestras.
const KENNEY_PALETTE := {
	"#ffffff": [2, 12], "#a0a8c9": [2, 10], "#4f5260": [2, 8], "#cf534f": [1, 12], "#6794d9": [1, 14],
	"#61cb8b": [1, 6], "#ffc044": [1, 8], "#ff7e44": [1, 10], "#b06041": [1, 0],
}

## Mezcla del tráfico IA (pesos): en Pitalito abundan motos y taxis. Igual que TRAFFIC_MIX de la web.
const TRAFFIC_MIX := {
	"moto": 6.0, "taxi": 4.0, "motocarro": 2.0, "pickup": 2.0, "willys": 2.0, "chiva": 1.0,
	"sedan": 3.0, "suv": 1.5, "van": 1.5, "truck": 1.0, "delivery": 1.0, "garbage-truck": 0.3, "ambulance": 0.2,
}
## Lentos en el tráfico (80 % de la velocidad de la vía); la moto va al 115 %.
const SLOW := ["chiva", "motocarro", "delivery", "garbage-truck"]

## Tráfico: cuántos, dónde aparecen y dónde se retiran (m). GAME.traffic de la web.
const TRAFFIC_MAX := 36
const TRAFFIC_SPAWN_RADIUS := 260.0
const TRAFFIC_DESPAWN_RADIUS := 380.0


static func spec(type: String) -> Dictionary:
	var s: Dictionary = VEHICLES[type].duplicate()
	s.type = type
	# tono del motor en ralentí y a fondo (Hz), el de la web; los del Car Kit, el genérico de la web
	if not s.has("engine_hz"):
		s.engine_hz = [45, 180]
	# Física de Godot: fuerza y freno proporcionales a la masa (mismo empuje relativo para todos)
	s.engine = s.mass * 2.1
	s.brake = maxf(30.0, s.mass * 0.035)
	return s


static func pick_traffic(rng: RandomNumberGenerator) -> String:
	var total := 0.0
	for w: float in TRAFFIC_MIX.values():
		total += w
	var r := rng.randf() * total
	for k: String in TRAFFIC_MIX:
		r -= TRAFFIC_MIX[k]
		if r <= 0.0:
			return k
	return "sedan"
