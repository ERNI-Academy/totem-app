# Editor con cabecera, contenido y pie

Las acciones **New visualisation** y **Create from template** crean una visualización con la cabecera y el pie originales y un centro vacío de 1080 × 1080, entre las coordenadas Y=690 y Y=1770. Cada visualización conserva sus propios cambios. Duplicar conserva el modo y el contenido del documento de origen.

La barra lateral permite añadir texto, imagen, vídeo, card o botón mediante clic o arrastrándolo al centro. Las capas permiten seleccionar elementos superpuestos, bloquearlos y acceder al vídeo del header, logos, textos y al icono del pie. Las posiciones del contenido se guardan respecto al centro; las pantallas completas usan 1080 × 1920.

## Datos y publicación

`webTemplate.contentMode` distingue `original` de `canvas`; su ausencia mantiene el comportamiento original. `screens[].elements` contiene el lienzo y los overrides y medios de la plantilla contienen las modificaciones de cabecera y pie. La creación y el guardado comparten validación, incluidos los límites del lienzo. Los datos inválidos devuelven HTTP 400.

El visor utiliza el proyecto HTML/CSS/JavaScript original y un adaptador sin React que representa el contenido central y sus interacciones. El backoffice React gestiona las herramientas y las propiedades. El preview actualiza el borrador en memoria sin exigir guardado. Publicar guarda primero, y la publicación incorpora una copia de la versión del adaptador y los recursos locales para la exportación offline. Totem original mantiene sus archivos originales y su publicación predeterminada.

## Migración aplicada

`node --env-file=totem-backoffice/.env.local scripts/migrate-new-canvas.mjs` convierte solo el borrador llamado `new`, conservando los cambios de cabecera y pie. Antes crea `new (antes del cambio)` (o un nombre con sufijo si ya existe) con todo el borrador anterior y sus referencias de medios. La operación usa una transacción y no modifica publicaciones. Si el borrador ya usa `canvas`, no hace cambios.

## Verificación

- `npm run typecheck`
- `npm run build`
- `npm run test:totem`: igualdad de archivos originales, interacciones, medios y adaptador.
- Con PostgreSQL y el backoffice en `http://localhost:3000`: `npm run test:editor`.

Las pruebas del editor crean una cuenta, sesión y visualizaciones temporales y las eliminan al terminar. Comprueban arrastre real entre la barra y el iframe, redimensionado, capas, medios, saltos de línea, aislamiento, guardado, publicación y el ZIP servido sin acceso al backoffice. `TOTEM_TEST_URL` permite cambiar el origen del servidor de pruebas.
