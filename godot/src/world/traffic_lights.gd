class_name TrafficLights
extends Node
## Ciclo de los 99 semáforos reales (port de web/src/systems/SignalSystem.js). Cada cruce controla dos fases:
## norte-sur (0) y oriente-poniente (1). Ciclo igual para todo el municipio (no hay dato de los tiempos reales),
## con desfase estable por cruce para que la ciudad no cambie de luz a la vez. ESTIMADO todo el ciclo.
## Publica el reloj como uniforme global `signal_time`: las lentes se encienden solas en GPU.

const GREEN := 9.0
const AMBER := 2.5
const CYCLE := (GREEN + AMBER) * 2.0
const RADIUS := 14.0   # a qué distancia de un cruce manda su semáforo
const BRAKE := 11.0    # metros antes del cruce a los que se empieza a frenar

var time := 0.0
var _by_tile: Dictionary = {} # Vector2i → Array[Vector2] cruces


func _ready() -> void:
	EventBus.signals_loaded.connect(func(key, list): _by_tile[key] = list.map(func(s): return s.cross))
	EventBus.tile_unloaded.connect(func(key): _by_tile.erase(key))


func _process(delta: float) -> void:
	time += delta
	RenderingServer.global_shader_parameter_set("signal_time", time)


static func offset_of(cross: Vector2) -> float:
	return float(absi(roundi(cross.x * 7.0 + cross.y * 13.0)) % 100) / 100.0 * CYCLE


## Fase en verde de un cruce, o −1 si está en amarillo (nadie entra).
func green_phase(cross: Vector2) -> int:
	var c := fmod(time + offset_of(cross), CYCLE)
	if fmod(c, GREEN + AMBER) > GREEN:
		return -1
	return 0 if c < GREEN + AMBER else 1


## Fase de quien circula con ese rumbo (convención de Godot: adelante = −Z rotado).
static func phase_of(forward: Vector3) -> int:
	return 0 if absf(forward.z) >= absf(forward.x) else 1


## Distancia al cruce que obliga a parar, o INF si se puede seguir. Solo mira hacia adelante.
func distance_to_red(pos: Vector3, forward: Vector3) -> float:
	var f := Vector2(forward.x, forward.z).normalized()
	var mine := phase_of(forward)
	var best := INF
	for list: Array in _by_tile.values():
		for c: Vector2 in list:
			var d := c - Vector2(pos.x, pos.z)
			var ahead := d.dot(f)
			if ahead < 0.0 or ahead > BRAKE:
				continue
			if absf(d.dot(Vector2(-f.y, f.x))) > RADIUS * 0.5:
				continue
			if green_phase(c) == mine:
				continue
			best = minf(best, ahead)
	return best
