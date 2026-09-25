// Configuración geográfica compartida entre el pipeline de datos (Node) y el cliente (navegador).
export const WORLD = {
  name: 'Pitalito, Huila',
  // [sur, oeste, norte, este] — casco urbano de Pitalito
  bbox: [1.826, -76.098, 1.872, -76.026],
  // Origen del mundo 3D: Parque Principal José Hilario López (OSM way 380471083)
  origin: { lat: 1.8519409, lon: -76.0468324 },
  // Tamaño de cada tile de streaming, en metros
  tileSize: 250,
  streamRadius: 3,
  // Relieve real (Copernicus GLO-30): región cubierta y resolución de la malla
  terrain: { radius: 12000, cell: 25 },
  // Imagen satelital real que cubre el suelo. Esri exige atribución visible.
  imagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagen: Esri, Maxar, Earthstar Geographics',
    nearZoom: 18,   // alrededor del jugador (~0,6 m/px)
    farZoom: 14,    // resto del valle (~9,5 m/px)
  },
  // Alturas: GHSL (altura media por celda de ~90 m) subestima en pueblos bajos. Calibrado con las fotos
  // de referencia del parque (edificios de 2–3 pisos donde GHSL da 3–4 m). 1 = usar GHSL tal cual.
  heightScale: 1.6,
  // false = solo edificios que existen en los datos (sin relleno inventado)
  proceduralFill: false,
  // Calzadas sobre la foto satelital: posición real (OSM); ancho estimado por tipo de vía.
  // Demarcación y andenes no están en los datos, por eso van apagados.
  roads: { opacity: 0.55, markings: false, sidewalks: false },
  // Postes de energía con cables: ubicación ESTIMADA (no está en los datos). false para quitarlos.
  powerLines: true,
};
