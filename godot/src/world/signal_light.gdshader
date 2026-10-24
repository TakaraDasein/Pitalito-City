// Lente de semáforo. INSTANCE_CUSTOM = (desfase s, fase 0|1, luz 0 rojo · 1 amarillo · 2 verde, —).
// Misma regla que TrafficLights.green_phase: así lo que se ve y lo que obedece el tráfico es lo mismo.
shader_type spatial;
render_mode unshaded, cull_back;

global uniform float signal_time;
uniform float green = 9.0;
uniform float amber = 2.5;

varying float lit;
varying float light_id;

void vertex() {
	float half_cycle = green + amber;
	float c = mod(signal_time + INSTANCE_CUSTOM.r, half_cycle * 2.0);
	float inside = mod(c, half_cycle);
	float active = c < half_cycle ? 0.0 : 1.0;
	bool mine = abs(active - INSTANCE_CUSTOM.g) < 0.5;
	float on = 0.0; // rojo
	if (mine) on = inside <= green ? 2.0 : 1.0;
	light_id = INSTANCE_CUSTOM.b;
	lit = abs(on - light_id) < 0.5 ? 1.0 : 0.0;
}

void fragment() {
	vec3 col = light_id < 0.5 ? vec3(1.0, 0.16, 0.1) : (light_id < 1.5 ? vec3(1.0, 0.69, 0.0) : vec3(0.1, 1.0, 0.35));
	// Disco: se recorta el cuadrado
	if (length(UV - 0.5) > 0.5) discard;
	ALBEDO = col * mix(0.06, 3.0, lit);
}
