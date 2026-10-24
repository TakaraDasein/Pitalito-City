// Entrepisos y cielos rasos de los recorribles. El alfa del color de vértice dice qué es cada cara:
// 1 = piso (baldosa de damero, la del atrio de la web, teñida por el color), 0 = cielo raso (pañete liso claro).
shader_type spatial;
render_mode cull_back;

uniform sampler2D tiles : source_color, filter_linear_mipmap_anisotropic;

void fragment() {
	vec3 c = COLOR.rgb;
	if (COLOR.a > 0.5) {
		ALBEDO = texture(tiles, UV).rgb;
		ROUGHNESS = 0.55;
	} else {
		ALBEDO = c;
		ROUGHNESS = 0.95;
	}
}
