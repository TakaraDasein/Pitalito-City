class_name SkySystem
extends Node
## Ciclo día/noche y clima (port de web/src/world/Environment.js y web/src/systems/WeatherSystem.js).
## Adaptación a Godot: cielo PhysicalSkyMaterial con los parámetros de AtmosphereConfig, niebla de altura nativa
## (fog_height), exposición del tonemap, y lluvia en GPU (GPUParticles3D) que choca con techos y calles gracias a
## un GPUParticlesCollisionHeightField3D que sigue a la cámara. Clima automático con aguaceros ocasionales, como
## en el Valle de Laboyos (ESTIMADO: no hay dato de frecuencia).

enum Weather { AUTO, CLEAR, RAIN }

@export var environment: WorldEnvironment
@export var sun: DirectionalLight3D

var hour := AtmosphereConfig.START_HOUR
var time_scale := 24.0 / (AtmosphereConfig.DAY_MINUTES * 60.0) # horas de juego por segundo real
var night := 0.0
var wet := 0.0
## Multiplicador de la niebla bajo el monte cerrado (lo pone AmbienceSystem, como env.fogExtra de la web).
var fog_extra := 1.0
var mode := Weather.AUTO
var camera: Camera3D

var _rain_target := 0.0
var _rain_timer := 90.0
var _sky: PhysicalSkyMaterial
var _rain: GPUParticles3D
var _rain_collider: GPUParticlesCollisionHeightField3D
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	_rain_timer = 90.0 + _rng.randf() * 120.0
	var env := environment.environment
	_sky = PhysicalSkyMaterial.new()
	_sky.ground_color = Color("#3a3d34")
	env.sky.sky_material = _sky
	env.fog_height = AtmosphereConfig.HEIGHT_FOG_START
	_build_rain()
	update_now()


func _build_rain() -> void:
	_rain = GPUParticles3D.new()
	_rain.name = "Lluvia"
	_rain.amount = 7000
	_rain.lifetime = 1.6
	_rain.visibility_aabb = AABB(Vector3(-40, -45, -40), Vector3(80, 70, 80))
	_rain.local_coords = false
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(35, 1, 35)
	pm.direction = Vector3(0.07, -1, 0)
	pm.spread = 2.0
	pm.initial_velocity_min = 26.0
	pm.initial_velocity_max = 30.0
	pm.gravity = Vector3(0, -9.8, 0)
	pm.collision_mode = ParticleProcessMaterial.COLLISION_HIDE_ON_CONTACT
	pm.particle_flag_align_y = true
	_rain.process_material = pm
	var drop := QuadMesh.new()
	drop.size = Vector2(0.025, 0.7)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color("#b8c6d4", 0.5)
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.billboard_keep_scale = true
	drop.material = mat
	_rain.draw_pass_1 = drop
	_rain.emitting = false
	add_child(_rain)
	# Mapa de alturas de lo que hay alrededor: las gotas mueren al tocar techos, calles y relieve
	_rain_collider = GPUParticlesCollisionHeightField3D.new()
	_rain_collider.size = Vector3(80, 80, 80)
	_rain_collider.resolution = GPUParticlesCollisionHeightField3D.RESOLUTION_256
	_rain_collider.update_mode = GPUParticlesCollisionHeightField3D.UPDATE_MODE_WHEN_MOVED
	_rain_collider.follow_camera_enabled = true
	add_child(_rain_collider)


func set_weather(m: Weather) -> void:
	mode = m
	if m == Weather.RAIN:
		_rain_target = 1.0
	elif m == Weather.CLEAR:
		_rain_target = 0.0


func set_hour(h: float) -> void:
	hour = fposmod(h, 24.0)
	update_now()


func _process(delta: float) -> void:
	hour = fmod(hour + delta * time_scale, 24.0)
	if mode == Weather.AUTO:
		_rain_timer -= delta
		if _rain_timer <= 0.0:
			_rain_target = 0.0 if _rain_target > 0.5 else 1.0
			_rain_timer = (60.0 + _rng.randf() * 90.0) if _rain_target > 0.5 else (150.0 + _rng.randf() * 240.0)
	wet += (_rain_target - wet) * minf(1.0, delta * 0.25)
	update_now()


func update_now() -> void:
	# Sol: sale a las 6 por el oriente (+X), cénit al mediodía, se pone a las 18. Pitalito está a 1,85° N: el
	# sol pasa casi por encima todo el año (leve inclinación al sur, ESTIMADO 10°).
	var theta := PI * (hour - 6.0) / 12.0
	var elev := sin(theta)
	night = 1.0 - smoothstep(-0.08, 0.12, elev)
	var day := elev > -0.05
	var dir := Vector3(cos(theta), sin(theta), 0.18).normalized() if day else Vector3(-cos(theta), -sin(theta), 0.18).normalized()
	sun.look_at_from_position(Vector3.ZERO, -dir, Vector3.FORWARD if absf(dir.y) > 0.99 else Vector3.UP)
	var env := environment.environment
	var a := AtmosphereConfig.sample(hour)
	sun.light_energy = (0.4 + 1.4 * smoothstep(-0.05, 0.3, elev)) if day else 0.18 # de noche, luz de luna
	sun.light_color = a.sun
	sun.light_energy *= 1.0 - wet * 0.45
	_sky.turbidity = a.turbidity
	_sky.rayleigh_coefficient = a.rayleigh
	_sky.mie_coefficient = a.mie
	_sky.mie_eccentricity = a.g
	# De noche el cielo no se apaga del todo: la web mantiene su luz hemisférica en ≥ 1,1 (las calles se leen)
	_sky.energy_multiplier = lerpf(1.0, 0.3, night) * (1.0 - wet * 0.4)
	var d := AtmosphereConfig.FOG_DENSITY_WEB
	env.fog_density = d * d * AtmosphereConfig.FOG_MATCH_DISTANCE * a.density * (1.0 + wet * 2.2) * fog_extra
	env.fog_light_color = a.fog.lerp(Color("#141820") if night > 0.5 else Color("#9aa4ad"), wet * 0.7)
	# Niebla de altura: con la densidad del fotograma (hasta 45 al alba) tapa el fondo del valle sin borrar al jugador
	env.fog_height_density = 0.0003 * a.density
	env.tonemap_exposure = a.exposure / 0.54
	env.ambient_light_energy = lerpf(1.0, 0.8, night) * (1.0 - wet * 0.25)
	MaterialLibrary.set_night(night)
	MaterialLibrary.set_wet(wet)
	_rain.emitting = wet > 0.05
	((_rain.draw_pass_1 as QuadMesh).material as StandardMaterial3D).albedo_color.a = wet * 0.55
	if camera:
		_rain.global_position = camera.global_position + Vector3.UP * 20.0


## Hora legible para el HUD.
func clock() -> String:
	return "%02d:%02d" % [int(hour), int(fmod(hour, 1.0) * 60.0)]
