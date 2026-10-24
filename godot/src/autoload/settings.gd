extends Node
## Opciones del jugador y calidad gráfica (equivale a web/src/core/Settings.js). Se guardan en user://ajustes.cfg.
## Calidad "auto": al primer arranque se estima por el equipo (tipo de GPU y núcleos) y después se afina con los fps
## reales de los primeros segundos de juego (Settings.measure). Elegir una calidad a mano apaga lo automático.

signal changed

const PATH := "user://ajustes.cfg"
const LEVELS := ["baja", "media", "alta"]

## Qué cambia cada nivel. render_scale: resolución 3D; shadows: tamaño del mapa de sombras y distancia; stream:
## radio de tiles; detail: radio de edificios armados; furniture: alcance de muebles; lights: luces interiores.
const PRESETS := {
	"baja": {"render_scale": 0.67, "shadow_size": 1024, "shadow_dist": 80.0, "ssao": false, "glow": false, "msaa": 0,
		"stream": 2, "detail": 0, "furniture": 40.0, "lights": 4, "tile_vis": 650.0},
	"media": {"render_scale": 0.85, "shadow_size": 2048, "shadow_dist": 150.0, "ssao": false, "glow": true, "msaa": 0,
		"stream": 3, "detail": 1, "furniture": 60.0, "lights": 8, "tile_vis": 900.0},
	"alta": {"render_scale": 1.0, "shadow_size": 4096, "shadow_dist": 250.0, "ssao": true, "glow": true, "msaa": 2,
		"stream": 3, "detail": 1, "furniture": 70.0, "lights": 12, "tile_vis": 1100.0},
}

var quality := "media"
var auto_quality := true
var sensitivity := 1.0
var invert_y := false
var fullscreen := false
## Clima: 0 automático (aguaceros ocasionales), 1 despejado, 2 lluvia (SkySystem.Weather).
var weather := 0
## Por qué se eligió la calidad (para mostrarlo en opciones): "equipo", "fps" o "manual".
var quality_reason := "equipo"
var gpu_name := ""
## false en las pruebas: no tocan los ajustes guardados del jugador.
var persist := true


func _ready() -> void:
	gpu_name = RenderingServer.get_video_adapter_name()
	var cfg := ConfigFile.new()
	if cfg.load(PATH) == OK:
		auto_quality = cfg.get_value("grafica", "auto", true)
		quality = cfg.get_value("grafica", "calidad", "media")
		sensitivity = cfg.get_value("controles", "sensibilidad", 1.0)
		invert_y = cfg.get_value("controles", "invertir_y", false)
		fullscreen = cfg.get_value("pantalla", "completa", false)
		weather = cfg.get_value("mundo", "clima", 0)
		quality_reason = "manual" if not auto_quality else cfg.get_value("grafica", "motivo", "equipo")
	if auto_quality and quality_reason == "equipo":
		quality = detect()
	apply_display()


## Calidad inicial según el equipo, antes de medir nada (no hay benchmark al arranque: se afina jugando).
func detect() -> String:
	var name := RenderingServer.get_video_adapter_name().to_lower()
	var kind := RenderingServer.get_video_adapter_type()
	var cores := OS.get_processor_count()
	# render por software: lo mínimo
	if name.contains("llvmpipe") or name.contains("swiftshader") or name.contains("software") or kind == RenderingDevice.DEVICE_TYPE_CPU:
		return "baja"
	if kind == RenderingDevice.DEVICE_TYPE_DISCRETE_GPU:
		return "alta" if cores >= 6 else "media"
	# integrada (Intel, AMD APU, celulares) o desconocida
	return "media" if cores >= 8 else "baja"


func preset() -> Dictionary:
	return PRESETS[quality]


func set_quality(q: String, reason := "manual") -> void:
	quality = q
	quality_reason = reason
	if reason == "manual":
		auto_quality = false
	save()
	changed.emit()


func set_auto() -> void:
	auto_quality = true
	quality = detect()
	quality_reason = "equipo"
	save()
	changed.emit()


## Afinado automático con los fps medidos en juego: baja un nivel si no llega a 40, sube si pasa de 110.
## Devuelve el nivel nuevo o "" si no cambió.
func measure(avg_fps: float) -> String:
	if not auto_quality:
		return ""
	var i := LEVELS.find(quality)
	var j := i
	if avg_fps < 40.0 and i > 0:
		j = i - 1
	elif avg_fps > 110.0 and i < LEVELS.size() - 1:
		j = i + 1
	if j == i:
		return ""
	set_quality(LEVELS[j], "fps")
	return quality


func apply_display() -> void:
	var mode := DisplayServer.WINDOW_MODE_FULLSCREEN if fullscreen else DisplayServer.WINDOW_MODE_WINDOWED
	if DisplayServer.get_name() != "headless" and DisplayServer.window_get_mode() != mode:
		DisplayServer.window_set_mode(mode)


## Aplica la calidad a la escena: resolución 3D, MSAA, sombras del sol y efectos del entorno.
func apply_to(viewport: Viewport, env: Environment, sun: DirectionalLight3D) -> void:
	var p := preset()
	viewport.scaling_3d_scale = p.render_scale
	viewport.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2 if p.render_scale < 1.0 else Viewport.SCALING_3D_MODE_BILINEAR
	viewport.msaa_3d = Viewport.MSAA_2X if p.msaa == 2 else Viewport.MSAA_DISABLED
	RenderingServer.directional_shadow_atlas_set_size(p.shadow_size, true)
	sun.directional_shadow_max_distance = p.shadow_dist
	env.ssao_enabled = p.ssao
	env.glow_enabled = p.glow


func save() -> void:
	if not persist:
		return
	var cfg := ConfigFile.new()
	cfg.set_value("grafica", "auto", auto_quality)
	cfg.set_value("grafica", "calidad", quality)
	cfg.set_value("grafica", "motivo", quality_reason)
	cfg.set_value("controles", "sensibilidad", sensitivity)
	cfg.set_value("controles", "invertir_y", invert_y)
	cfg.set_value("pantalla", "completa", fullscreen)
	cfg.set_value("mundo", "clima", weather)
	cfg.save(PATH)
