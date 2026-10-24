// Piezas del Building Kit de Kenney. La pared de fábrica es un degradado gris azulado (74,77,91 → 190,199,239 en
// la paleta, medido sobre las UV de las mallas) que hace el sombreado del módulo. Ese tono se reemplaza por el
// color de fachada de cada edificio (por instancia, INSTANCE_CUSTOM) conservando la luminosidad: el sombreado del
// kit se mantiene. Marcos casi blancos, vidrios, madera y metal no tienen ese tono y quedan como vienen.
shader_type spatial;
render_mode cull_back;

uniform sampler2D palette : source_color, filter_linear_mipmap;
const float REF_LUM = 0.62; // luminosidad media de la pared de fábrica (entre 143,149,179 y 172,180,216)

varying vec4 tint;

void vertex() {
	tint = INSTANCE_CUSTOM;
}

void fragment() {
	vec3 lin = texture(palette, UV).rgb;
	vec3 s = pow(lin, vec3(1.0 / 2.2));
	float blue = s.b - s.r;
	if (tint.a > 0.5 && blue > 0.06 && blue < 0.26 && s.g < 0.95) {
		float l = dot(s, vec3(0.3, 0.59, 0.11));
		lin = pow(clamp(tint.rgb * (l / REF_LUM), 0.0, 1.0), vec3(2.2));
	}
	ALBEDO = lin;
	ROUGHNESS = 0.85;
}
