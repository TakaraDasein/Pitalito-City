// Catálogo de vehículos. Para agregar uno nuevo: crear su modelo en src/entities/vehicles/models/,
// registrarlo en models/index.js y describirlo aquí. Unidades: m, s, km/h.
// `colors`: pinturas disponibles en el garaje (la primera es la de fábrica). Vacío = color fijo.
export const VEHICLES = {
  willys: {
    name: 'Jeep Willys', model: 'willys',
    // Dónde se sienta el conductor, en el espacio del vehículo. El personaje real se cuelga ahí (ver
    // PlayerSystem.#enter); los vehículos del tráfico siguen usando el muñeco de cajas, que es mucho más barato.
    seat: [-0.34, 0.47, 0.12],
    // Vano de la tina del CJ (los Willys de vereda andan sin puertas). Puerta del conductor, en el espacio del MODELO (src/entities/vehicles/models/): z y alto que abarca. `panel`:
    // hay hoja que se abre (bisagra adelante); sin panel es un vano abierto. La usa Godot (VehicleModel.add_doors).
    door: { z: [-0.5, 0.45], y: [0.62, 1.8], panel: false },
    description: 'El campero de las veredas del Huila. Aguanta todo, no corre tanto.',
    maxSpeed: 120, reverseSpeed: 25,
    accel: 9, brake: 16, drag: 0.0028, rolling: 0.35,
    wheelBase: 2.2, maxSteer: 0.6, grip: 7.5, driftGrip: 1.4,
    radius: 1.0, length: 3.9, width: 1.6, wheelRadius: 0.4, mass: 1250,
    colors: ['#b3261e', '#1d4e89', '#4b5d3a', '#eeeeea', '#e8b20c', '#d9661f', '#1f1f1f'],
    engine: { idle: 38, max: 150, type: 'sawtooth' },
  },
  taxi: {
    name: 'Taxi', model: 'taxi',
    // Dónde se sienta el conductor, en el espacio del vehículo. El personaje real se cuelga ahí (ver
    // PlayerSystem.#enter); los vehículos del tráfico siguen usando el muñeco de cajas, que es mucho más barato.
    seat: [-0.35, 0.11, 0.02],
    // Puerta del conductor, en el espacio del MODELO (src/entities/vehicles/models/): z y alto que abarca. `panel`:
    // hay hoja que se abre (bisagra adelante); sin panel es un vano abierto. La usa Godot (VehicleModel.add_doors).
    door: { z: [-0.72, 0.36], y: [0.36, 1.47], panel: true },
    description: 'Hatchback amarillo de servicio público. Ágil en las calles del centro.',
    maxSpeed: 140, reverseSpeed: 30,
    accel: 10.5, brake: 18, drag: 0.0022, rolling: 0.3,
    wheelBase: 2.4, maxSteer: 0.55, grip: 8.5, driftGrip: 1.6,
    radius: 0.95, length: 3.7, width: 1.62, wheelRadius: 0.31, mass: 900,
    colors: [],
    engine: { idle: 55, max: 220, type: 'square' },
  },
  pickup: {
    name: 'Camioneta de platón', model: 'pickup',
    // Dónde se sienta el conductor, en el espacio del vehículo. El personaje real se cuelga ahí (ver
    // PlayerSystem.#enter); los vehículos del tráfico siguen usando el muñeco de cajas, que es mucho más barato.
    seat: [-0.4, 0.37, -0.18],
    // Puerta del conductor, en el espacio del MODELO (src/entities/vehicles/models/): z y alto que abarca. `panel`:
    // hay hoja que se abre (bisagra adelante); sin panel es un vano abierto. La usa Godot (VehicleModel.add_doors).
    door: { z: [-0.9, 0.17], y: [0.5, 1.79], panel: true },
    description: 'Doble cabina 4x4 cargada de café. Pesada pero estable.',
    maxSpeed: 150, reverseSpeed: 28,
    accel: 8.8, brake: 17, drag: 0.0025, rolling: 0.32,
    wheelBase: 3.1, maxSteer: 0.52, grip: 8, driftGrip: 1.5,
    radius: 1.05, length: 5.3, width: 1.86, wheelRadius: 0.4, mass: 2000,
    colors: ['#e9ecef', '#9aa0a6', '#1f1f1f', '#7d1f1f', '#1d3557', '#5a5a3c'],
    engine: { idle: 42, max: 170, type: 'sawtooth' },
  },
  chiva: {
    name: 'Chiva', model: 'chiva',
    // Dónde se sienta el conductor, en el espacio del vehículo. El personaje real se cuelga ahí (ver
    // PlayerSystem.#enter); los vehículos del tráfico siguen usando el muñeco de cajas, que es mucho más barato.
    seat: [-0.55, 0.75, -2.05],
    // Estribo de la cabina (alto sobre el suelo, m): ESTIMADO, el modelo no lo trae. Godot sube por él.
    step: 0.38,
    description: 'Bus escalera de madera pintada. Lenta, enorme y llena de gente.',
    maxSpeed: 85, reverseSpeed: 18,
    accel: 5.5, brake: 10, drag: 0.004, rolling: 0.45,
    wheelBase: 5.55, maxSteer: 0.5, grip: 6.5, driftGrip: 2.2,
    radius: 1.35, length: 8.5, width: 2.6, wheelRadius: 0.55, mass: 7000,
    colors: ['#3fae49', '#1d4e89', '#d62828', '#f2c230'],
    engine: { idle: 28, max: 95, type: 'sawtooth' },
  },
  motocarro: {
    name: 'Motocarro', model: 'motocarro',
    // Dónde se sienta el conductor, en el espacio del vehículo. El personaje real se cuelga ahí (ver
    // PlayerSystem.#enter); los vehículos del tráfico siguen usando el muñeco de cajas, que es mucho más barato.
    seat: [0, 0.21, -0.25],
    description: 'Mototaxi de tres ruedas. Pequeño, lento y se cuela por todo.',
    maxSpeed: 70, reverseSpeed: 12,
    accel: 7, brake: 12, drag: 0.004, rolling: 0.35,
    wheelBase: 1.74, maxSteer: 0.65, grip: 6.5, driftGrip: 2,
    radius: 0.75, length: 2.6, width: 1.3, wheelRadius: 0.26, mass: 400,
    colors: ['#2e7d32', '#f2c230', '#1d4e89', '#c62828'],
    engine: { idle: 80, max: 240, type: 'square' },
  },
  moto: {
    name: 'Moto', model: 'moto',
    // Dónde se sienta el conductor, en el espacio del vehículo. El personaje real se cuelga ahí (ver
    // PlayerSystem.#enter); los vehículos del tráfico siguen usando el muñeco de cajas, que es mucho más barato.
    seat: [0, 0.4, -0.2],
    // A horcajadas: la animación de conducir es la de un carro, así que las manos y los pies se llevan al
    // manubrio y a los pedales con cinemática inversa (puntos en src/entities/vehicles/models/moto.js).
    postura: 'moto',
    description: 'Moto de trabajo 125 cc. La más rápida en arrancar.',
    maxSpeed: 110, reverseSpeed: 8,
    accel: 11, brake: 14, drag: 0.003, rolling: 0.3,
    wheelBase: 1.3, maxSteer: 0.7, grip: 9, driftGrip: 2.5,
    radius: 0.55, length: 2.0, width: 0.7, wheelRadius: 0.3, mass: 120,
    colors: ['#1d4e89', '#c62828', '#1f1f1f', '#e9ecef', '#2e7d32'],
    engine: { idle: 70, max: 260, type: 'square' },
  },
};

// Tráfico de la ciudad, modelado en código (src/entities/vehicles/models/urbanos.js; antes el Kenney Car Kit,
// genérico, cambiado el 24-10-2026 para poder afinarlo). Tipos de las calles del Huila sin marca ni logo. Todos con
// asiento y puerta del conductor: también se pueden manejar. Medidas ESTIMADAS para la clase.
const urbano = (name, model, { seat, door, dims, colors, fisica = {}, description }) => ({
  name, model, traffic: true, seat, door, description, ...dims, colors,
  maxSpeed: 120, reverseSpeed: 25, accel: 8, brake: 15, drag: 0.0026, rolling: 0.32,
  wheelBase: dims.length * 0.6, maxSteer: 0.55, grip: 8, driftGrip: 1.5,
  radius: dims.width * 0.6, wheelRadius: 0.32, mass: 1300,
  engine: { idle: 45, max: 180, type: 'sawtooth' }, ...fisica,
});
const PARTICULAR = ['#e9ecef', '#a0a8b0', '#4f5260', '#b3261e', '#1d4e89', '#1f1f1f'];
Object.assign(VEHICLES, {
  sedan: urbano('Automóvil', 'sedan', { seat: [-0.36, 0.15, 0.05], door: { z: [-0.75, 0.38], y: [0.36, 1.42], panel: true },
    dims: { length: 4.3, width: 1.7, height: 1.42 }, colors: PARTICULAR, description: 'Sedán compacto de cuatro puertas.' }),
  suv: urbano('Campero', 'campero', { seat: [-0.4, 0.41, -0.15], door: { z: [-0.85, 0.22], y: [0.54, 1.86], panel: true },
    dims: { length: 4.4, width: 1.8, height: 1.86 }, colors: ['#4b5d3a', ...PARTICULAR], fisica: { mass: 1900, wheelRadius: 0.38 },
    description: '4x4 cuadrado de monte, con defensa y parrilla.' }),
  van: urbano('Buseta intermunicipal', 'buseta', { seat: [-0.5, 0.6, -2.65], door: { z: [-2.9, -2.1], y: [0.52, 2.55], panel: true },
    dims: { length: 6.8, width: 2.1, height: 2.55 }, colors: ['#f4f4f4', '#f2c230', '#1d4e89'], fisica: { mass: 4200, maxSpeed: 100, wheelRadius: 0.42 },
    description: 'La de las rutas al resto del Huila.' }),
  truck: urbano('Camioneta doble cabina', 'doblecabina', { seat: [-0.4, 0.41, -0.2], door: { z: [-0.88, 0.18], y: [0.56, 1.84], panel: true },
    dims: { length: 5.2, width: 1.82, height: 1.84 }, colors: PARTICULAR, fisica: { mass: 2100, wheelRadius: 0.4 },
    description: 'Doble cabina con platón corto: la de trabajo de las fincas.' }),
  delivery: urbano('Camión de carga', 'furgon', { seat: [-0.5, 0.85, -2.35], door: { z: [-2.9, -1.9], y: [0.67, 2.35], panel: true },
    dims: { length: 6.5, width: 2.3, height: 3.1 }, colors: ['#e9ecef', '#1d4e89', '#b3261e'], fisica: { mass: 5000, maxSpeed: 95, wheelRadius: 0.46 },
    description: 'Cabina chata con furgón de aluminio.' }),
  'garbage-truck': urbano('Recolector de basura', 'recolector', { seat: [-0.55, 1.0, -3.05], door: { z: [-3.6, -2.5], y: [0.72, 2.6], panel: true },
    dims: { length: 8.0, width: 2.4, height: 2.75 }, colors: ['#2e7d32'], fisica: { mass: 9000, maxSpeed: 80, wheelRadius: 0.52 },
    description: 'Compactador del aseo municipal.' }),
  ambulance: urbano('Ambulancia', 'ambulancia', { seat: [-0.48, 0.5, -1.25], door: { z: [-1.85, -0.9], y: [0.5, 2.45], panel: true },
    dims: { length: 5.8, width: 2.0, height: 2.45 }, colors: [], fisica: { mass: 2800, wheelRadius: 0.38 },
    description: 'Van alta con franjas y barra de luces.' }),
});

// Orden en el garaje
export const PLAYER_ROSTER = ['willys', 'taxi', 'pickup', 'chiva', 'motocarro', 'moto'];
// Mezcla del tráfico IA (pesos): en Pitalito abundan motos y taxis
// Subir y bajar del vehículo: cuánto dura la transición del personaje hasta el asiento.
// En la moto: `subir` y `bajar` en segundos; `acercarse` es la fracción de la subida que camina hasta el costado.
export const MONTAJE = { duracion: 0.75, moto: { subir: 1.3, bajar: 0.9, acercarse: 0.3 } };

// Posturas de conducción que la animación del paquete no trae. Puntos en el espacio del vehículo (adelante = −Z).
// `manos` y `pies` van [izq., der.]: ahí se clavan con cinemática inversa; `codos` y `rodillas` dicen hacia dónde
// se doblan. `retoque` inclina huesos sobre la animación (radianes, giro local). El modelo de la moto se construye
// con estas mismas medidas, para que el manubrio y los pedales queden donde el personaje los busca.
export const POSTURAS = {
  moto: {
    sillin: 0.84,
    manos: [[-0.3, 1.07, -0.4], [0.3, 1.07, -0.4]],
    pies: [[-0.2, 0.32, 0.05], [0.2, 0.32, 0.05]],
    codos: [[-0.5, 0.9, 0.2], [0.5, 0.9, 0.2]],
    rodillas: [[-0.3, 0.75, -0.5], [0.3, 0.75, -0.5]],
    retoque: { spine_01: [0.55, 0, 0], spine_02: [0.25, 0, 0], neck_01: [-0.3, 0, 0], Head: [-0.25, 0, 0] },
  },
};

export const TRAFFIC_MIX = {
  moto: 6, taxi: 4, motocarro: 2, pickup: 2, willys: 2, chiva: 1,
  sedan: 3, suv: 1.5, van: 1.5, truck: 1, delivery: 1, 'garbage-truck': 0.3, ambulance: 0.2,
};

// Barras del garaje (0–1), derivadas de los parámetros físicos reales de cada vehículo
export function vehicleStats(v) {
  return {
    velocidad: Math.min(1, v.maxSpeed / 150),
    aceleracion: Math.min(1, v.accel / 11),
    manejo: Math.min(1, (v.grip / 9) * 0.6 + (v.maxSteer / 0.7) * 0.4),
    peso: Math.min(1, Math.log10(v.mass) / Math.log10(7000)),
  };
}
