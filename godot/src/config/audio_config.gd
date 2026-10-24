class_name AudioConfig
## Sonido: niveles y carácter de la mezcla, espejo de web/src/config/audio.config.js. Todo es sintetizado
## (AudioSystem): no hay archivos de audio ni licencias de efectos.

const MIX_RATE := 22050.0
## Ganancia de la mezcla del mundo: los niveles de la web salen a través del maestro de WebAudio; en Godot el mismo
## nivel quedaba en −55 dB de pico (medido); con ×5, −4 dB (saturaba). ×2 deja el pico cerca de −12 dB.
const WORLD_GAIN := 2.0
## Reverberación de valle abierto y paso bajo general (quita el filo de lo sintetizado).
const REVERB := {"room": 0.75, "damping": 0.55, "wet": 0.22}
const WARMTH := 7200.0
## Ambiente: viento apenas audible, pájaros de día, insectos al anochecer, lluvia según el clima.
const AMBIENCE := {"wind": 0.012, "birds": 0.04, "insects": 0.02, "rain": 0.05}
## Motor: seno + triángulo filtrado; nivel en ralentí y extra con el acelerador.
const ENGINE := {"level": 0.035, "throttle": 0.04, "filter": [260.0, 700.0]}
## Música (web/src/audio/Musica.js): campanitas en bucle con silencios; volumen relativo al general, pulsos por minuto.
const MUSIC := {"volume": 0.55, "tempo": 76.0}
## Pasos: golpe sordo de ruido filtrado por pisada (ESTIMADO, de oído). Tierra más grave que el asfalto.
const STEPS := {"level": 0.05, "dirt_hz": 520.0, "paved_hz": 1100.0}
## Interfaz: clic corto al enfocar y al aceptar.
const UI := {"focus": 0.025, "accept": 0.05}
