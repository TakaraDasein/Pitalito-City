# Iteraciones

> Registro visual del juego. **Cada iteración deja aquí su carpeta**: qué se hizo, cómo se veía y qué medía.
> Es la memoria del proyecto: permite comparar dos versiones sin volver a compilar la anterior.

## Cómo se registra una iteración

Al cerrar una etapa (antes del commit):

```bash
npm run dev                                   # en otra terminal
npm run shot -- iterN '[{"wait":9000},{"shot":"parque"}, ...]'
node tools/iteracion.mjs NN-nombre-vX.Y.Z     # copia, comprime y crea el README
```

Si `tools/iteracion.mjs` aún no existe, se hace a mano:

1. `mkdir iteraciones/NN-nombre-vX.Y.Z`
2. Copiar las capturas y comprimirlas a JPG (`magick f.png -quality 84 -strip f.jpg`) — el PNG pesa 6× más.
3. Escribir el `README.md` de la carpeta con la plantilla de abajo.

## Plantilla del README de cada iteración

```markdown
# NN · <nombre> (vX.Y.Z — AAAA-MM-DD)
## Qué cambió
## Medidas   (draw calls, triángulos, fps, peso de descarga)
## Capturas  (tabla imagen → qué muestra)
## Qué quedó pendiente
```

## Índice

| # | Iteración | Fecha | Hito |
|---|---|---|---|
| 00 | [Línea base v0.3.0](00-base-v0.3.0/) | 2026-09-30 | Mundo real + conducción + a pie + bloques. Personaje de cajas, sin esqueleto, sin combate. |
| 01 | [Esqueleto y animaciones v0.4.0](01-esqueleto-v0.4.0/) | 2026-09-30 | Fase 1: malla con esqueleto, 45 clips, LOD de animación, sombrero enganchado al hueso. |
| 02 | [Creación de personaje v0.5.0](02-creacion-personaje-v0.5.0/) | 2026-09-30 | Fase 2: cuerpo, piel, pelo y ropa reales; pantalla de creación con seis oficios de Pitalito; pipeline de 423 MB a 12,4 MB. |
| 03 | [Combate y arsenal v0.6.0](03-combate-v0.6.0/) | 2026-09-30 | Fase 3: resistencia, esquiva rodando, guardia, fijar blanco y seis herramientas de la región como armas. |
| 04 | [Facciones v0.7.0](04-facciones-v0.7.0/) | 2026-09-30 | Fase 5 (adelantada): esqueletos con uniforme generados sobre el propio rig, árbol de comportamiento y zonas de control. |
| 05 | [Fauna v0.8.0](05-fauna-v0.8.0/) | 2026-09-30 | Fase 4: ganado por el inventario pecuario real, seis especies modeladas a mano, manadas y hábitat deducido del tile. |
| 06 | [Partículas, luz y sonido v0.9.0](06-particulas-luz-v0.9.0/) | 2026-09-30 | Fase 6: partículas simuladas en GPU (7 draw calls fijos), dirección de atmósfera por tensión, sonido de combate sintetizado. |
| 07 | [La historia de Pitalito v1.0.0](07-historia-v1.0.0/) | 2026-09-30 | Fase 7: **el fin del juego**. Once cronistas, once hitos con fuente, los seis nombres del pueblo y la línea de tiempo. |
| 08 | [Rendimiento v1.0.0](08-rendimiento-v1.0.0/) | 2026-10-01 | Fase 8: director de presupuesto por fotograma. Qué cuesta cada cosa, medido. Fps en GPU real: pendiente. |
