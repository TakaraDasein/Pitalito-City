// Clases de vía de OSM → ancho de calzada (m), andén, prioridad de dibujo y velocidad del tráfico (km/h).
export const ROAD_CLASSES = {
  trunk:          { width: 12, sidewalk: 2.5, rank: 7, speed: 60, map: '#f2b04a', label: 'Troncal' },
  trunk_link:     { width: 8,  sidewalk: 0,   rank: 7, speed: 40, map: '#f2b04a' },
  primary:        { width: 11, sidewalk: 2.5, rank: 6, speed: 50, map: '#f5d36b', label: 'Vía principal' },
  primary_link:   { width: 8,  sidewalk: 0,   rank: 6, speed: 40, map: '#f5d36b' },
  secondary:      { width: 10, sidewalk: 2.2, rank: 5, speed: 45, map: '#f7e7a0' },
  secondary_link: { width: 7,  sidewalk: 0,   rank: 5, speed: 35, map: '#f7e7a0' },
  tertiary:       { width: 9,  sidewalk: 2,   rank: 4, speed: 40, map: '#ffffff' },
  residential:    { width: 7.5,sidewalk: 1.8, rank: 3, speed: 30, map: '#ffffff' },
  unclassified:   { width: 7,  sidewalk: 1.2, rank: 3, speed: 30, map: '#ffffff' },
  living_street:  { width: 6,  sidewalk: 1.5, rank: 2, speed: 20, map: '#ffffff' },
  service:        { width: 4.5,sidewalk: 0,   rank: 2, speed: 20, map: '#e8e8e8' },
  track:          { width: 4,  sidewalk: 0,   rank: 1, speed: 20, map: '#c9b48a', surface: 'dirt' },
  pedestrian:     { width: 6,  sidewalk: 0,   rank: 1, speed: 0,  map: '#f0d8cc', surface: 'brick' },
  footway:        { width: 2.5,sidewalk: 0,   rank: 0, speed: 0,  map: '#f0d8cc', surface: 'brick' },
  path:           { width: 2,  sidewalk: 0,   rank: 0, speed: 0,  map: '#d9c9a8', surface: 'dirt' },
  steps:          { width: 2.5,sidewalk: 0,   rank: 0, speed: 0,  map: '#f0d8cc', surface: 'brick' },
};

export const DEFAULT_ROAD = ROAD_CLASSES.residential;
export const roadClass = (c) => ROAD_CLASSES[c] || DEFAULT_ROAD;
// Vías por donde circula el tráfico IA
export const isDrivable = (c) => roadClass(c).speed > 0;
