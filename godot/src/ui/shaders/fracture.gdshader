shader_type canvas_item;
// Pantalla quebrada al recibir un golpe fuerte: grietas de vidrio que salen del punto del impacto (bordes de una
// teselación de Voronoi más densa cerca del centro, más unos rayos), y cada fragmento desplaza un poco lo que se
// ve detrás. `amount` 0..1 lo pone el HUD y se desvanece solo.
uniform sampler2D screen : hint_screen_texture, filter_linear;
uniform float amount = 0.0;
uniform vec2 center = vec2(0.5, 0.5);
uniform float seed = 0.0;
uniform vec4 crack_color : source_color = vec4(0.95, 0.93, 0.88, 1.0);

vec2 hash2(vec2 p) {
	p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
	return fract(sin(p + seed) * 43758.5453);
}

// distancia al borde de la celda más cercana y el id de la celda
vec3 voronoi(vec2 x) {
	vec2 n = floor(x);
	vec2 f = fract(x);
	vec2 mg;
	vec2 mr;
	float md = 8.0;
	for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
		vec2 g = vec2(float(i), float(j));
		vec2 o = hash2(n + g);
		vec2 r = g + o - f;
		float d = dot(r, r);
		if (d < md) { md = d; mr = r; mg = g; }
	}
	md = 8.0;
	for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
		vec2 g = mg + vec2(float(i), float(j));
		vec2 o = hash2(n + g);
		vec2 r = g + o - f;
		if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
	}
	return vec3(md, hash2(n + mg));
}

void fragment() {
	if (amount <= 0.001) { discard; }
	vec2 aspect = vec2(SCREEN_PIXEL_SIZE.y / SCREEN_PIXEL_SIZE.x, 1.0);
	vec2 d = (SCREEN_UV - center) * aspect;
	float r = length(d);
	// el vidrio se rompe más cerca del impacto: celdas más chicas y grietas más gruesas allí
	float radius = mix(0.25, 1.1, amount);
	float fall = 1.0 - smoothstep(0.0, radius, r);
	// coordenadas polares deformadas: fragmentos alargados que salen del centro, como un vidrio de verdad
	vec2 pol = vec2(atan(d.y, d.x) * 2.2, log(r + 0.02) * 2.6);
	vec3 v = voronoi(pol * 2.0);
	float edge = 1.0 - smoothstep(0.0, mix(0.012, 0.05, fall), v.x);
	// rayos principales
	float ray = pow(abs(sin(atan(d.y, d.x) * 5.0 + seed * 3.0)), 60.0) * fall;
	float crack = clamp(max(edge * fall, ray) * amount * 1.4, 0.0, 1.0);
	// cada fragmento corre lo de detrás en su propia dirección (refracción del vidrio quebrado)
	vec2 shift = (v.yz - 0.5) * 0.018 * amount * fall;
	vec3 col = texture(screen, SCREEN_UV + shift).rgb;
	// en la grieta: brillo claro con un borde oscuro, y el centro del impacto algo blanqueado
	col = mix(col, crack_color.rgb, crack * 0.85);
	col *= 1.0 - 0.25 * smoothstep(0.5, 1.0, edge) * fall * amount;
	col = mix(col, vec3(1.0), (1.0 - smoothstep(0.0, 0.04, r)) * amount * 0.35);
	// opaco en la grieta; fuera de ella solo lo justo para que se note la refracción (sin velo blanco)
	COLOR = vec4(col, clamp(max(crack, fall * amount * 0.35), 0.0, 1.0));
}
