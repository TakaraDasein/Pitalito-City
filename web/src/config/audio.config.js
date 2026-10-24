// Sonido: niveles y carácter de la mezcla. Todo es sintetizado (ver src/systems/AudioSystem.js), así que aquí no
// hay archivos: sólo cuánto suena cada cosa y cómo.

export const AUDIO = {
  // Mezcla general: un poco de reverberación a todo da la sensación de valle abierto; el compresor redondea los
  // picos (disparos, choques) para que nada salte de golpe.
  reverb: { segundos: 3.2, caida: 2.6, envio: 0.22 },
  calidez: 7200,                  // paso bajo general (Hz): quita el filo a todo lo sintetizado

  // Música (src/audio/Musica.js): un tintineo de campanitas en bucle suave, con silencios entre notas.
  musica: {
    volumen: 0.55,                // relativo al volumen general (Opciones → Música)
    tempo: 76,                    // pulsos por minuto; cada nota cae en corchea (el ánimo lo frena de noche)
  },

  // Pasos (por ahora solo en Godot, AudioSystem.gd): golpe de ruido filtrado por pisada. ESTIMADO, de oído.
  pasos: { nivel: 0.05, tierraHz: 520, pavimentoHz: 1100 },
  // Golpes y tajo (por ahora solo en Godot): ruido filtrado, y tono de lámina en el metal. ESTIMADO, de oído.
  golpes: {
    metal: { hz: 3500, dur: 0.32, nivel: 0.07, tono: 2350 },
    hueso: { hz: 2200, dur: 0.08, nivel: 0.09, tono: 0 },
    carne: { hz: 320, dur: 0.14, nivel: 0.12, tono: 0 },
  },
  tajo: { hz: 900, dur: 0.2, nivel: 0.035 },

  // Ambiente: un viento apenas audible (más alto se oía como siseo); pájaros de día; insectos al anochecer.
  ambiente: { viento: 0.012, pajaros: 0.04, insectos: 0.02 },

  // Motor: más redondo que antes (seno + triángulo, filtrado bajo) y callado al bajarse del vehículo.
  motor: { nivel: 0.035, acelerador: 0.04, filtro: [260, 700] },
};
