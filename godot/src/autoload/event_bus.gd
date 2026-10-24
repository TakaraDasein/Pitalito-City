extends Node
## Señales globales entre sistemas que no se conocen entre sí (equivale a web/src/core/EventBus.js).
## Regla: solo señales que cruzan sistemas; lo local se conecta directo entre nodos.

## El foco del streaming cambió de dueño (jugador a pie ↔ vehículo).
signal focus_changed(node: Node3D)
## Un tile del mundo terminó de construirse o se retiró.
signal tile_loaded(key: Vector2i)
signal tile_unloaded(key: Vector2i)
## Semáforos de un tile recién cargado (SignalBuilder.spots): los consume TrafficLights.
signal signals_loaded(key: Vector2i, spots: Array)
## El jugador subió o bajó de un vehículo.
signal vehicle_entered(vehicle: Node3D)
signal vehicle_exited(vehicle: Node3D)
