class_name VehiclesConfig
## Catálogo de vehículos, espejo de web/src/config/vehicles.config.js (nombre, medidas, masa, velocidad, giro).
## Dos orígenes de modelo:
##   kenney — Kenney Car Kit (CC0, ver web/assets/models/CREDITS.md); medidas de carrocería ESTIMADAS a las que
##            se escala el modelo.
##   baked  — modelados a mano en la web y horneados a GLB (web/tools/bake-godot.mjs); ya vienen a escala real.
## engine (N) y brake son de la física de Godot (VehicleBody3D), calibrados a ojo: no hay dato.

const VEHICLES := {
	"willys": {"name": "Jeep Willys", "source": "baked", "length": 3.9, "width": 1.6, "mass": 1250.0, "max_speed": 120.0, "max_steer": 0.6},
	"taxi": {"name": "Taxi", "source": "baked", "length": 3.7, "width": 1.62, "mass": 900.0, "max_speed": 140.0, "max_steer": 0.55},
	"pickup": {"name": "Camioneta de platón", "source": "baked", "length": 5.3, "width": 1.86, "mass": 2000.0, "max_speed": 150.0, "max_steer": 0.52},
	"chiva": {"name": "Chiva", "source": "baked", "length": 8.5, "width": 2.6, "mass": 7000.0, "max_speed": 85.0, "max_steer": 0.5},
	"motocarro": {"name": "Motocarro", "source": "baked", "length": 2.6, "width": 1.3, "mass": 400.0, "max_speed": 70.0, "max_steer": 0.65},
	"moto": {"name": "Moto", "source": "baked", "length": 2.0, "width": 0.7, "mass": 120.0, "max_speed": 110.0, "max_steer": 0.7},
	"sedan": {"name": "Automóvil", "source": "kenney", "length": 4.3, "width": 1.7, "height": 1.3, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"suv": {"name": "Campero", "source": "kenney", "length": 4.4, "width": 1.8, "height": 1.55, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"van": {"name": "Van intermunicipal", "source": "kenney", "length": 5.0, "width": 1.9, "height": 1.85, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"truck": {"name": "Camioneta", "source": "kenney", "length": 5.2, "width": 1.8, "height": 1.6, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
	"delivery": {"name": "Furgón", "source": "kenney", "length": 6.5, "width": 2.2, "height": 2.8, "mass": 5000.0, "max_speed": 120.0, "max_steer": 0.55},
	"garbage-truck": {"name": "Recolector de basura", "source": "kenney", "length": 8.0, "width": 2.4, "height": 3.0, "mass": 9000.0, "max_speed": 120.0, "max_steer": 0.55},
	"ambulance": {"name": "Ambulancia", "source": "kenney", "length": 5.8, "width": 2.0, "height": 2.5, "mass": 1300.0, "max_speed": 120.0, "max_steer": 0.55},
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
