shader_type canvas_item;
// Parry: un tajo verde que cruza la pantalla como una cicatriz larga, en la dirección del golpe desviado (del
// enemigo hacia el jugador). Núcleo claro y fino, halo verde ancho, el borde de la cicatriz algo dentado, y lo
// que se ve detrás se corre a cada lado del corte (la pantalla "se abre" un instante). `amount` lo apaga el HUD.
uniform sampler2D screen : hint_screen_texture, filter_linear;
uniform float amount = 0.0;
uniform vec2 center = vec2(0.5, 0.5);   // por dónde pasa el corte (pantalla 0..1)
uniform vec2 dir = vec2(1.0, 0.0);      // hacia dónde va (unitario, en pantalla)
uniform float seed = 0.0;
uniform vec4 core_color : source_color = vec4(0.88, 1.0, 0.82, 1.0);
uniform vec4 glow_color : source_color = vec4(0.36, 0.86, 0.32, 1.0);

float noise(float x) {
	return fract(sin(x * 12.9898 + seed) * 43758.5453);
}

void fragment() {
	if (amount <= 0.001) { discard; }
	vec2 aspect = vec2(SCREEN_PIXEL_SIZE.y / SCREEN_PIXEL_SIZE.x, 1.0);
	vec2 p = (SCREEN_UV - center) * aspect;
	vec2 d = normalize(dir * aspect);
	vec2 n = vec2(-d.y, d.x);
	float along = dot(p, d);
	float across = dot(p, n);
	// largo: casi toda la pantalla, más fino en las puntas; se "dibuja" desde el lado del enemigo al principio
	float len = 0.95;
	float t = clamp(along / len + 0.5, 0.0, 1.0);
	float drawn = smoothstep(0.0, 0.25, amount) ;
	float reach = mix(0.0, 1.0, clamp((1.0 - amount) * 4.0 + 0.4, 0.0, 1.0));
	float taper = sin(t * 3.14159) * step(t, reach) * step(abs(along), len * 0.5);
	// borde dentado de la cicatriz
	float jag = (noise(floor(along * 140.0)) - 0.5) * 0.004 * amount;
	float x = abs(across + jag);
	float width = 0.013 * taper * (0.6 + amount);
	float core = 1.0 - smoothstep(0.0, width, x);
	float glow = exp(-x / max(0.075 * taper * amount, 0.0005)) * taper;
	// la imagen se separa a cada lado del corte
	vec2 shift = n * sign(across) * 0.012 * amount * taper * exp(-x * 25.0) / aspect;
	vec3 col = texture(screen, SCREEN_UV + shift).rgb;
	col = mix(col, col * 0.7 + glow_color.rgb * 0.6, clamp(glow * amount * 0.9, 0.0, 1.0));
	col = mix(col, core_color.rgb, clamp(core * amount * 1.3, 0.0, 1.0));
	// un tinte verde leve en toda la pantalla, el destello del choque
	col = mix(col, glow_color.rgb, 0.08 * amount * amount);
	COLOR = vec4(col, clamp(max(max(core, glow * 0.8) * amount, 0.12 * amount * amount + length(shift) * 80.0), 0.0, 1.0));
	drawn = drawn;
}
