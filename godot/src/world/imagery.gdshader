// Suelo satelital (port de web/src/world/ImageryGround.js). Cerca de la cámara multiplica un grano de detalle
// a dos escalas para que a ras de calle la foto no se vea borrosa; se desvanece entre 20 y 110 m.
shader_type spatial;
render_mode cull_back, diffuse_burley;

uniform sampler2D imagery : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform sampler2D detail : filter_linear_mipmap, repeat_enable;
uniform bool has_imagery = false;
uniform bool use_detail = false;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 col = has_imagery ? texture(imagery, UV).rgb : vec3(0.54, 0.57, 0.47);
	if (use_detail) {
		float fade = 1.0 - smoothstep(20.0, 110.0, distance(world_pos, CAMERA_POSITION_WORLD));
		// El ruido de Godot ocupa 0..1 completo; el grano de la web varía ±11 % alrededor de 0,5
		float a = 0.5 + (texture(detail, world_pos.xz / 2.3).r - 0.5) * 0.22;
		float b = texture(detail, world_pos.xz / 13.0).r;
		col *= mix(1.0, (a * 2.0) * (0.75 + b * 0.5), fade * 0.8);
	}
	ALBEDO = col;
	ROUGHNESS = 0.95;
}
