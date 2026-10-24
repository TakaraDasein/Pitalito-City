class_name MaterialLibrary
## Todos los materiales del mundo salen de aquí, uno por clave y compartidos (equivale a MaterialLibrary.js).
## Texturas CC0 de web/public/textures (ambientCG / Poly Haven, ver web/docs/DATOS.md) y las procedurales de la web
## horneadas a PNG (textures/procedural, ver web/tools/bake-textures.mjs).

static var _cache: Dictionary = {}

const TEXTURES := "res://assets/textures"
## Las calzadas se ven sobre la foto satelital: semitransparentes, como WORLD.roads.opacity en la web.
const ROAD_OPACITY := 0.55
## Materiales que se mojan con la lluvia y que encienden ventanas de noche.
const WET := ["asphalt", "roof_sheet", "roof_flat", "facade_ground"]
const NIGHT := ["facade_upper", "facade_ground"]


static func get_material(key: String) -> Material:
	if not _cache.has(key):
		_cache[key] = _make(key)
	return _cache[key]


static func _tex(path: String) -> Texture2D:
	var full := "%s/%s" % [TEXTURES, path]
	return load(full) if ResourceLoader.exists(full) else null


static func _pbr(folder: String, uv_scale: float, tint := Color.WHITE) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = tint
	m.albedo_texture = _tex(folder + "/color.jpg")
	m.normal_enabled = true
	m.normal_texture = _tex(folder + "/normal.jpg")
	m.roughness_texture = _tex(folder + "/roughness.jpg")
	m.uv1_scale = Vector3(uv_scale, uv_scale, uv_scale)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return m


static func _vertex_colored(m: StandardMaterial3D) -> StandardMaterial3D:
	m.vertex_color_use_as_albedo = true
	m.vertex_color_is_srgb = true
	return m


## Transparente que se dibuja una sola vez por píxel (stencil): los cruces no se oscurecen al superponerse.
## Es el `onceStencil` de la web, con el stencil nativo de Godot 4.5+.
static func _once(m: StandardMaterial3D, opacity: float) -> StandardMaterial3D:
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color.a = opacity
	m.stencil_mode = BaseMaterial3D.STENCIL_MODE_CUSTOM
	m.stencil_flags = BaseMaterial3D.STENCIL_FLAG_READ | BaseMaterial3D.STENCIL_FLAG_WRITE
	m.stencil_compare = BaseMaterial3D.STENCIL_COMPARE_NOT_EQUAL
	m.stencil_reference = 1
	return m


static func _make(key: String) -> Material:
	match key:
		"terrain":
			# UV del relieve = metros / 8; a 0,5 la textura cubre 16 m y no titila de lejos
			var m := _pbr("grass", 0.5, Color(0.85, 0.9, 0.8))
			m.normal_scale = 0.4
			return m
		"facade_upper", "facade_ground":
			var m := _vertex_colored(StandardMaterial3D.new())
			var name := "facadeUpper" if key == "facade_upper" else "facadeGround"
			m.albedo_texture = _tex("procedural/%s_map.png" % name)
			m.emission_enabled = true
			m.emission_texture = _tex("procedural/%s_emissiveMap.png" % name)
			m.emission_energy_multiplier = 0.0 # se enciende de noche (set_night)
			m.roughness = 0.88
			if key == "facade_upper":
				m.normal_enabled = true
				m.normal_texture = _tex("plaster/normal.jpg")
				m.normal_scale = 0.3
			m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
			return m
		"wall_plain":
			var m := _vertex_colored(_pbr("plaster", 1.0))
			m.roughness = 0.9
			m.cull_mode = BaseMaterial3D.CULL_DISABLED
			return m
		"roof_flat":
			var m := _vertex_colored(StandardMaterial3D.new())
			m.albedo_texture = _tex("procedural/concreteNoise.png")
			m.roughness = 0.95
			return m
		"roof_sheet":
			var m := _vertex_colored(StandardMaterial3D.new())
			m.albedo_texture = _tex("procedural/corrugated_map.png")
			m.normal_enabled = true
			m.normal_texture = _tex("procedural/corrugated_normalMap.png")
			m.roughness = 0.5
			m.metallic = 0.35
			m.cull_mode = BaseMaterial3D.CULL_DISABLED
			return m
		"asphalt":
			var m := _pbr("asphalt", 1.0 / 12.0, Color("#8c8c8c"))
			m.normal_scale = 0.6
			return _once(m, ROAD_OPACITY)
		"dirt":
			return _once(_pbr("ground", 1.0 / 12.0, Color("#c9b48a")), ROAD_OPACITY)
		"brick":
			# Adoquín alrededor del parque: casi opaco (es real y la foto satelital lo ve borroso)
			var m := StandardMaterial3D.new()
			m.albedo_texture = _tex("procedural/brickPaving.png")
			m.uv1_scale = Vector3(0.25, 0.25, 0.25)
			m.roughness = 0.85
			return _once(m, 0.93)
		"slab":
			# Entrepisos de los recorribles: baldosa arriba, cielo raso liso abajo (ver slab.gdshader)
			var m := ShaderMaterial.new()
			m.shader = preload("res://src/world/slab.gdshader")
			m.set_shader_parameter("tiles", _tex("procedural/atrioTiles.png"))
			return m
		"lining":
			# Pintura interior de los recorribles: pañete con el color de la casa
			var m := _vertex_colored(_pbr("plaster", 0.5))
			m.normal_scale = 0.3
			m.roughness = 0.92
			return m
		"water":
			var m := ShaderMaterial.new()
			m.shader = preload("res://src/world/river.gdshader")
			var noise := FastNoiseLite.new()
			noise.frequency = 0.08
			var tex := NoiseTexture2D.new()
			tex.noise = noise
			tex.seamless = true
			tex.as_normal_map = true
			tex.bump_strength = 6.0
			m.set_shader_parameter("ripple", tex)
			return m
		"bridge":
			var m := _vertex_colored(StandardMaterial3D.new())
			m.albedo_texture = _tex("procedural/concreteNoise.png")
			m.uv1_triplanar = true
			m.uv1_world_triplanar = true
			m.uv1_scale = Vector3(0.5, 0.5, 0.5)
			m.roughness = 0.8
			return m
		"glass_in":
			# Vidrio de ventana desde adentro: deja ver la calle, con un reflejo leve
			var m := StandardMaterial3D.new()
			m.albedo_color = Color("#a9c3cf", 0.22)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.roughness = 0.05
			m.metallic = 0.4
			return m
		"tree", "signal_pole":
			var m := _vertex_colored(StandardMaterial3D.new())
			m.roughness = 0.9 if key == "tree" else 0.5
			m.metallic = 0.0 if key == "tree" else 0.3
			return m
		"signal_lens":
			var m := ShaderMaterial.new()
			m.shader = preload("res://src/world/signal_light.gdshader")
			return m
	push_warning("Material desconocido: " + key)
	return StandardMaterial3D.new()


## 0 = día, 1 = noche: enciende las ventanas de las fachadas.
static func set_night(f: float) -> void:
	(get_material("facade_upper") as StandardMaterial3D).emission_energy_multiplier = f * 0.6
	(get_material("facade_ground") as StandardMaterial3D).emission_energy_multiplier = f * 0.7


## Lluvia: superficies mojadas más oscuras y brillantes.
static func set_wet(w: float) -> void:
	for key: String in WET:
		var m := get_material(key) as StandardMaterial3D
		if not m.has_meta("dry"):
			m.set_meta("dry", m.roughness)
		m.roughness = lerpf(m.get_meta("dry"), 0.18, w)
	(get_material("asphalt") as StandardMaterial3D).albedo_color = Color(Color("#8c8c8c") * (1.0 - w * 0.45), ROAD_OPACITY)
