// Suelo satelital (port de web/src/world/ImageryGround.js). Cerca de la cámara multiplica un grano de detalle
// a dos escalas para que a ras de calle la foto no se vea borrosa; se desvanece entre 20 y 110 m.
shader_type spatial;
render_mode cull_back, diffuse_burley;

uniform sampler2D imagery : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform sampler2D detail : filter_linear_mipmap, repeat_enable;
uniform bool has_imagery = false;
uniform bool use_detail = false;
// De cerca: textura PBR según lo que muestra la foto (ESTIMADO por el color del píxel: verde → pasto, gris →
// pavimento, el resto → tierra). La foto da el color; la textura, el grano y el relieve (normal).
uniform sampler2D grass_color : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D ground_color : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D ground_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D asphalt_color : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D asphalt_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
// 0 seco … 1 aguacero (SkySystem.wet vía MaterialLibrary.set_wet)
global uniform float ground_wet;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 col = has_imagery ? texture(imagery, UV).rgb : vec3(0.54, 0.57, 0.47);
	float near = 0.0;
	if (use_detail) {
		float dist = distance(world_pos, CAMERA_POSITION_WORLD);
		float fade = 1.0 - smoothstep(20.0, 110.0, dist);
		// variación grande (manchas de 13 m) del grano de la web, hasta 110 m
		float b = texture(detail, world_pos.xz / 13.0).r;
		col *= mix(1.0, 0.75 + b * 0.5, fade * 0.8);
		near = 1.0 - smoothstep(15.0, 60.0, dist);
		if (near > 0.0) {
			// qué es el píxel: verdor (verde sobre rojo y azul) y saturación
			float green = col.g - max(col.r, col.b);
			float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
			float w_grass = smoothstep(0.0, 0.05, green);
			float w_paved = (1.0 - w_grass) * (1.0 - smoothstep(0.04, 0.12, sat));
			float w_dirt = max(1.0 - w_grass - w_paved, 0.0);
			vec2 uv = world_pos.xz;
			// textura relativa a su propio promedio (el mip más chico): aporta grano, no cambia el color de la foto
			vec3 g = texture(grass_color, uv / 2.5).rgb / max(textureLod(grass_color, vec2(0.5), 12.0).rgb, vec3(0.05));
			vec3 d = texture(ground_color, uv / 3.0).rgb / max(textureLod(ground_color, vec2(0.5), 12.0).rgb, vec3(0.05));
			vec3 a = texture(asphalt_color, uv / 4.0).rgb / max(textureLod(asphalt_color, vec2(0.5), 12.0).rgb, vec3(0.05));
			vec3 grain = g * w_grass + d * w_dirt + a * w_paved;
			col *= mix(vec3(1.0), clamp(grain, vec3(0.4), vec3(1.8)), near * 0.85);
			NORMAL_MAP = texture(grass_normal, uv / 2.5).rgb * w_grass + texture(ground_normal, uv / 3.0).rgb * w_dirt
				+ texture(asphalt_normal, uv / 4.0).rgb * w_paved;
			NORMAL_MAP_DEPTH = near;
		}
	}
	// Mojado: más oscuro y liso; los charcos (ESTIMADO: manchas de ruido grueso, sin dato de dónde se encharca)
	// quedan casi como espejo y los toma el SSR del preset Alta.
	float rough = 0.95;
	if (ground_wet > 0.01) {
		float b2 = texture(detail, world_pos.xz / 9.0).r;
		float puddle = smoothstep(0.38, 0.30, b2) * smoothstep(0.35, 0.9, ground_wet);
		col *= 1.0 - ground_wet * 0.28 - puddle * 0.15;
		rough = mix(mix(0.95, 0.55, ground_wet), 0.04, puddle);
	}
	ALBEDO = col;
	ROUGHNESS = rough;
}
