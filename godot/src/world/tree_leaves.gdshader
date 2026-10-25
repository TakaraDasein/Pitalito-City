// Hojas de los árboles cercanos con modelo (NearTrees): textura recortada del kit de Quaternius, el mismo viento
// que el árbol procedural (tree.gdshader), tinte por árbol y luz a través de las hojas.
shader_type spatial;
render_mode cull_disabled, diffuse_burley;

uniform sampler2D leaf_tex : source_color, filter_linear_mipmap_anisotropic;
uniform float model_height = 7.0; // alto del modelo sin escalar: el viento usa la altura normalizada
global uniform float tree_wind;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	float ph = o.x * 0.37 + o.z * 0.29;
	float sway = pow(max(VERTEX.y / model_height - 0.35, 0.0), 1.5) * tree_wind * model_height;
	VERTEX.x += sin(TIME * 1.3 + ph) * 0.06 * sway + sin(TIME * 3.7 + ph * 2.0) * 0.015 * sway;
	VERTEX.z += cos(TIME * 1.1 + ph) * 0.05 * sway;
}

void fragment() {
	vec4 t = texture(leaf_tex, UV);
	ALBEDO = t.rgb * COLOR.rgb;
	ALPHA = t.a;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = 0.85;
	SPECULAR = 0.25;
	BACKLIGHT = ALBEDO * 0.35;
	if (!FRONT_FACING) {
		NORMAL = -NORMAL;
	}
}
