// Árboles (port del material 'tree-wind' de web/src/world/builders/VegetationBuilder.js).
// Viento: la copa se mueve según la altura normalizada del vértice, con una fase por árbol (su posición); solo el
// follaje (alfa del color de vértice = 1). Tinte por árbol: color de instancia del MultiMesh (ya multiplicado en COLOR).
// Luz a través de las hojas: un poco de transmisión, para que a contraluz la copa no sea una mancha negra.
shader_type spatial;
render_mode cull_disabled, diffuse_burley;

// fuerza del viento (SkySystem: más con lluvia)
global uniform float tree_wind;
// NearTrees: centro (xz) y radio (w) donde se ve el árbol con modelo; aquí adentro el procedural se esconde.
global uniform vec4 tree_near;
// 1 en frondosos y samanes (tienen modelo cercano), 0 en palmas
instance uniform float has_near = 0.0;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	if (has_near > 0.5 && distance(o.xz, tree_near.xz) < tree_near.w) {
		VERTEX = vec3(0.0); // triángulos degenerados: no se dibujan
	}
	float ph = o.x * 0.37 + o.z * 0.29;
	float sway = pow(max(VERTEX.y - 0.35, 0.0), 1.5) * tree_wind * COLOR.a;
	VERTEX.x += sin(TIME * 1.3 + ph) * 0.06 * sway + sin(TIME * 3.7 + ph * 2.0) * 0.015 * sway;
	VERTEX.z += cos(TIME * 1.1 + ph) * 0.05 * sway;
}

void fragment() {
	// el color de vértice viene en sRGB (como vertex_color_is_srgb del material estándar)
	vec3 c = COLOR.rgb;
	vec3 lin = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
	ALBEDO = lin;
	ROUGHNESS = 0.9;
	SPECULAR = 0.25;
	BACKLIGHT = lin * 0.35 * COLOR.a;
	if (!FRONT_FACING) {
		NORMAL = -NORMAL;
	}
}
