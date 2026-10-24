shader_type canvas_item;
// Pantalla quebrada al recibir un golpe fuerte: grietas de vidrio que salen del punto del impacto (bordes de una
// teselación de Voronoi más densa cerca del centro, más unos rayos), y cada fragmento desplaza un poco lo que se
// ve detrás. Las grietas van en tonos rojos y del impacto salpican gotas de sangre que escurren un poco hacia
// abajo. `amount` 0..1 lo pone el HUD y se desvanece solo.
uniform sampler2D screen : hint_screen_texture, filter_linear;
uniform float amount = 0.0;
uniform vec2 center = vec2(0.5, 0.5);
uniform float seed = 0.0;
uniform vec4 crack_color : source_color = vec4(0.86, 0.16, 0.12, 1.0);
uniform vec4 crack_dark : source_color = vec4(0.32, 0.02, 0.02, 1.0);
uniform vec4 blood_color : source_color = vec4(0.55, 0.03, 0.03, 1.0);

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
	// en la grieta: rojo vivo con el borde oscuro (sangre en el vidrio), y el centro del impacto más oscuro
	col = mix(col, mix(crack_dark.rgb, crack_color.rgb, edge), crack * 0.9);
	col = mix(col, col * vec3(1.0, 0.55, 0.5), fall * amount * 0.35);
	col = mix(col, crack_dark.rgb, (1.0 - smoothstep(0.0, 0.05, r)) * amount * 0.6);
	// gotas: manchas redondas alrededor del impacto (más grandes cerca), cada una con su chorro hacia abajo
	float drops = 0.0;
	for (int i = 0; i < 14; i++) {
		vec2 h = hash2(vec2(float(i), seed));
		float a = h.x * 6.2832;
		float dist = mix(0.03, 0.38, h.y * h.y) * mix(0.6, 1.0, amount);
		vec2 c = vec2(cos(a), sin(a)) * dist;
		float rad = mix(0.022, 0.006, h.y) * (0.7 + 0.5 * fract(h.x * 7.3));
		vec2 q = d - c;
		float drop = 1.0 - smoothstep(rad * 0.75, rad, length(q));
		// chorro: escurre hacia abajo de la pantalla (+y) más cuanto más pasa el golpe
		float run = (1.0 - amount) * 0.12 * fract(h.y * 13.1);
		float trail = (1.0 - smoothstep(rad * 0.25, rad * 0.45, abs(q.x))) * step(0.0, q.y) * (1.0 - smoothstep(0.0, run + 0.001, q.y));
		drops = max(drops, max(drop, trail * 0.9));
	}
	drops *= smoothstep(0.0, 0.2, amount);
	col = mix(col, blood_color.rgb * (0.8 + 0.2 * fall), drops * 0.92);
	// opaco en la grieta; fuera de ella solo lo justo para que se note la refracción (sin velo blanco)
	COLOR = vec4(col, clamp(max(max(crack, drops * 0.92), fall * amount * 0.35), 0.0, 1.0));
}
