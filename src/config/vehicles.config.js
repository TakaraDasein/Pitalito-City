// Catálogo de vehículos. Para agregar uno nuevo: crear su modelo en src/entities/vehicles/models/,
// registrarlo en models/index.js y describirlo aquí. Unidades: m, s, km/h.
// `colors`: pinturas disponibles en el garaje (la primera es la de fábrica). Vacío = color fijo.
export const VEHICLES = {
  willys: {
    name: 'Jeep Willys', model: 'willys',
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
    description: 'Moto de trabajo 125 cc. La más rápida en arrancar.',
    maxSpeed: 110, reverseSpeed: 8,
    accel: 11, brake: 14, drag: 0.003, rolling: 0.3,
    wheelBase: 1.3, maxSteer: 0.7, grip: 9, driftGrip: 2.5,
    radius: 0.55, length: 2.0, width: 0.7, wheelRadius: 0.3, mass: 120,
    colors: ['#1d4e89', '#c62828', '#1f1f1f', '#e9ecef', '#2e7d32'],
    engine: { idle: 70, max: 260, type: 'square' },
  },
};

// Orden en el garaje
export const PLAYER_ROSTER = ['willys', 'taxi', 'pickup', 'chiva', 'motocarro', 'moto'];
// Mezcla del tráfico IA (pesos): en Pitalito abundan motos y taxis
export const TRAFFIC_MIX = { moto: 6, taxi: 4, motocarro: 2, pickup: 2, willys: 2, chiva: 1 };

// Barras del garaje (0–1), derivadas de los parámetros físicos reales de cada vehículo
export function vehicleStats(v) {
  return {
    velocidad: Math.min(1, v.maxSpeed / 150),
    aceleracion: Math.min(1, v.accel / 11),
    manejo: Math.min(1, (v.grip / 9) * 0.6 + (v.maxSteer / 0.7) * 0.4),
    peso: Math.min(1, Math.log10(v.mass) / Math.log10(7000)),
  };
}
