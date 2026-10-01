# Créditos de modelos 3D

Modelos con esqueleto usados por el juego. **Sólo se versiona material CC0** (dominio público): la atribución
no es obligatoria, se deja por trazabilidad. Ver [docs/ASSETS_3D.md](../../docs/ASSETS_3D.md).

Regenerar con `npm run models:fetch`.

## Descargados

| Archivo | Uso en el juego | Autor | Licencia | Fuente |
|---|---|---|---|---|
| animations.glb | Los 45 clips de animación y el esqueleto de 65 huesos que comparten todos los personajes | Quaternius | CC0 1.0 | [Fuente](https://quaternius.com/packs/universalanimationlibrary.html) · [espejo](https://opengameart.org/content/universal-animation-library) |
| base/ (10 archivos) | Cuerpos base de la creación de personaje (complexiones y peinados), mismo esqueleto que las animaciones | Quaternius | CC0 1.0 | [Fuente](https://quaternius.itch.io/universal-base-characters) |
| animals/ (5 archivos) | Animales de finca, repartidos según el inventario pecuario real del municipio | Quaternius | CC0 1.0 | [Fuente](https://quaternius.itch.io/lowpoly-animated-animals) |
| outfits/ (20 archivos) | Ropa intercambiable del jugador y de las facciones, sobre el mismo esqueleto | Quaternius | CC0 1.0 | [Fuente](https://quaternius.itch.io/modular-character-outfits-fantasy) |
| enemies/skeleton.glb | Cuerpo de los enemigos de las facciones: comparte los 65 huesos, así hereda los 45 clips y la ropa | Generado por el proyecto sobre el armature de Quaternius | CC0 1.0 | Derivado de `base/Superhero_Male_FullBody.gltf` con `scripts/lib/make-skeleton.py` |

## Pendientes de descarga manual

Estos paquetes no ofrecen URL directa estable (se entregan por itch.io). Se bajan una vez a `data/raw/models/`
y se registran aquí al integrarlos.

| Paquete | Uso previsto | Autor | Licencia | Dónde |
|---|---|---|---|---|
| LowPoly Animated Animals / Monsters | Fauna de las zonas boscosas y enemigos (Fases 4 y 5) | Quaternius | CC0 1.0 | [https://quaternius.itch.io/](https://quaternius.itch.io/) |
