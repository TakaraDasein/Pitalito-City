class_name VehiclesConfig
## Catálogo de vehículos, espejo de web/src/config/vehicles.config.js (nombre, medidas, masa, velocidad, giro).
## Todos modelados en código en la web y horneados a GLB (web/tools/bake-godot.mjs); ya vienen a escala real.
## El tráfico (automóvil, campero, buseta, doble cabina, camión, recolector, ambulancia) está en
## web/src/entities/vehicles/models/urbanos.js: antes era el Kenney Car Kit, genérico (cambiado el 24-10-2026).
## colors: pinturas del garaje (la primera es la de fábrica; vacío = color fijo, como el taxi amarillo). Las mismas
## de la web: se cambia el material del color de fábrica.
## door: puerta del conductor en el espacio del modelo de la web (z, alto; panel = hoja con bisagra, si no vano).
## seat: dónde se sienta el conductor, en el espacio del modelo de la web (medido allá sobre cada modelo).
## step: alto del estribo de la cabina (m, ESTIMADO: el modelo no lo trae); si está, se sube en dos tiempos.
## engine (N) y brake son de la física de Godot (VehicleBody3D), calibrados a ojo: no hay dato.

const VEHICLES := {
	"willys": {"name": "Jeep Willys", "source": "baked", "seat": [-0.34, 0.47, 0.12], "door": {"z": [-0.5, 0.45], "y": [0.62, 1.8], "panel": false}, "engine_hz": [38, 150], "colors": ["#b3261e", "#1d4e89", "#4b5d3a", "#eeeeea", "#e8b20c", "#d9661f", "#1f1f1f"], "length": 3.9, "width": 1.6, "mass": 1250.0, "max_speed": 120.0, "max_steer": 0.6},
	"taxi": {"name": "Taxi", "source": "baked", "seat": [-0.35, 0.11, 0.02], "door": {"z": [-0.72, 0.36], "y": [0.36, 1.47], "panel": true}, "engine_hz": [55, 220], "length": 3.7, "width": 1.62, "mass": 900.0, "max_speed": 140.0, "max_steer": 0.55},
	"pickup": {"name": "Camioneta de platón", "source": "baked", "seat": [-0.4, 0.37, -0.18], "door": {"z": [-0.9, 0.17], "y": [0.5, 1.79], "panel": true}, "engine_hz": [42, 170], "colors": ["#e9ecef", "#9aa0a6", "#1f1f1f", "#7d1f1f", "#1d3557", "#5a5a3c"], "length": 5.3, "width": 1.86, "mass": 2000.0, "max_speed": 150.0, "max_steer": 0.52},
	"chiva": {"name": "Chiva", "source": "baked", "seat": [-0.55, 0.75, -2.05], "step": 0.38, "engine_hz": [28, 95], "colors": ["#3fae49", "#1d4e89", "#d62828", "#f2c230"], "length": 8.5, "width": 2.6, "mass": 7000.0, "max_speed": 85.0, "max_steer": 0.5},
	"motocarro": {"name": "Motocarro", "source": "baked", "seat": [0, 0.21, -0.25], "engine_hz": [80, 240], "colors": ["#2e7d32", "#f2c230", "#1d4e89", "#c62828"], "length": 2.6, "width": 1.3, "mass": 400.0, "max_speed": 70.0, "max_steer": 0.65},
	"moto": {"name": "Moto", "source": "baked", "seat": [0, 0.4, -0.2], "engine_hz": [70, 260], "colors": ["#1d4e89", "#c62828", "#1f1f1f", "#e9ecef", "#2e7d32"], "length": 2.0, "width": 0.7, "mass": 120.0, "max_speed": 110.0, "max_steer": 0.7},
	# tráfico modelado en código en la web (urbanos.js; antes el Kenney Car Kit): también se manejan
	"sedan": {"name": "Automóvil", "source": "baked", "seat": [-0.36, 0.15, 0.05], "door": {"z": [-0.75, 0.38], "y": [0.36, 1.42], "panel": true}, "colors": ["#e9ecef", "#a0a8b0", "#4f5260", "#b3261e", "#1d4e89", "#1f1f1f"], "length": 4.3, "width": 1.7, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"suv": {"name": "Campero", "source": "baked", "seat": [-0.4, 0.41, -0.15], "door": {"z": [-0.85, 0.22], "y": [0.54, 1.86], "panel": true}, "colors": ["#4b5d3a", "#e9ecef", "#a0a8b0", "#4f5260", "#b3261e", "#1d4e89", "#1f1f1f"], "length": 4.4, "width": 1.8, "mass": 1900.0, "max_speed": 120.0, "max_steer": 0.55},
	"van": {"name": "Buseta intermunicipal", "source": "baked", "seat": [-0.5, 0.6, -2.65], "door": {"z": [-2.9, -2.1], "y": [0.52, 2.55], "panel": true}, "colors": ["#f4f4f4", "#f2c230", "#1d4e89"], "length": 6.8, "width": 2.1, "mass": 4200.0, "max_speed": 100.0, "max_steer": 0.5},
	"truck": {"name": "Camioneta doble cabina", "source": "baked", "seat": [-0.4, 0.41, -0.2], "door": {"z": [-0.88, 0.18], "y": [0.56, 1.84], "panel": true}, "colors": ["#e9ecef", "#a0a8b0", "#4f5260", "#b3261e", "#1d4e89", "#1f1f1f"], "length": 5.2, "width": 1.82, "mass": 2100.0, "max_speed": 120.0, "max_steer": 0.55},
	"delivery": {"name": "Camión de carga", "source": "baked", "seat": [-0.5, 0.85, -2.35], "door": {"z": [-2.9, -1.9], "y": [0.67, 2.35], "panel": true}, "colors": ["#e9ecef", "#1d4e89", "#b3261e"], "length": 6.5, "width": 2.3, "mass": 5000.0, "max_speed": 95.0, "max_steer": 0.5},
	"garbage-truck": {"name": "Recolector de basura", "source": "baked", "seat": [-0.55, 1.0, -3.05], "door": {"z": [-3.6, -2.5], "y": [0.72, 2.6], "panel": true}, "colors": ["#2e7d32"], "length": 8.0, "width": 2.4, "mass": 9000.0, "max_speed": 80.0, "max_steer": 0.45},
	"ambulance": {"name": "Ambulancia", "source": "baked", "seat": [-0.48, 0.5, -1.25], "door": {"z": [-1.85, -0.9], "y": [0.5, 2.45], "panel": true}, "length": 5.8, "width": 2.0, "mass": 2800.0, "max_speed": 120.0, "max_steer": 0.55},
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
	# tono del motor en ralentí y a fondo (Hz), el de la web; sin dato, el genérico de la web
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
