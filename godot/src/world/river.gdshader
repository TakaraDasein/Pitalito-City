// Río del Valle de Laboyos. Azul verdoso por decisión de arte: las fotos del Guarapas (Carrera 3) lo muestran pardo
// y turbio; esos colores eran deep #4d4229 / shallow #85785a, por si se quiere volver al real.
// Flujo: dos capas de ruido que avanzan a lo largo del cauce (UV.y en metros) a distinta velocidad, como normales.
// Profundidad: con la textura de profundidad se aclara y se vuelve espuma donde el agua toca la orilla o un objeto.
shader_type spatial;
render_mode cull_disabled, depth_draw_always;

uniform sampler2D ripple : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D depth_tex : hint_depth_texture, filter_linear;
uniform vec3 deep_color : source_color = vec3(0.07, 0.24, 0.32);
uniform vec3 shallow_color : source_color = vec3(0.20, 0.47, 0.52);
uniform float speed = 0.9;       // m/s del flujo visible (ESTIMADO)
uniform float turbidity = 1.6;   // cuánto se oscurece por metro de agua

void fragment() {
	vec2 flow = vec2(UV.x * 3.0, UV.y * 0.25);
	vec3 n1 = texture(ripple, flow + vec2(0.0, -TIME * speed * 0.25)).rgb;
	vec3 n2 = texture(ripple, flow * 1.7 + vec2(0.37, -TIME * speed * 0.4)).rgb;
	NORMAL_MAP = normalize(mix(n1, n2, 0.5));
	NORMAL_MAP_DEPTH = 0.6;
	// grosor del agua entre la superficie y lo que hay detrás (lecho, orilla, piernas)
	float scene = texture(depth_tex, SCREEN_UV).r;
	vec4 world = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, scene, 1.0);
	float behind = -world.z / world.w;
	float thick = max(behind - (-VERTEX.z), 0.0);
	float k = 1.0 - exp(-thick * turbidity);
	ALBEDO = mix(shallow_color, deep_color, k);
	float foam = 1.0 - smoothstep(0.0, 0.12, thick);
	foam += (1.0 - smoothstep(0.0, 0.03, min(UV.x, 1.0 - UV.x))) * 0.5;
	ALBEDO = mix(ALBEDO, vec3(0.82, 0.90, 0.92), clamp(foam, 0.0, 1.0) * 0.6);
	ALPHA = clamp(0.55 + k * 0.45, 0.0, 0.97);
	ROUGHNESS = 0.08;
	METALLIC = 0.05;
	SPECULAR = 0.6;
}
