# Totem original: paquete web de referencia

`web/` es una copia byte por byte del proyecto `/home/davidwalker/Projects/totem-web`. Incluye el `index.html`, JavaScript, CSS, SVG, fuentes, imágenes, vídeos y Three.js originales. El editor React solamente aloja y modifica copias mediante `web-editor/adapter.js`; nunca reconstruye la plantilla.

`manifest.json` registra SHA-256 de todos los archivos del proyecto web y de los recursos reutilizables. `resources/icons/` conserva derivados PNG transparentes además de los SVG para la biblioteca del backoffice.

Desde la raíz del repositorio:

- `npm run totem:import` vuelve a importar el proyecto de referencia y genera el inventario de hashes.
- `npm run build:totem-apk` copia los archivos originales a `dist/android`; Android carga ese `index.html` desde WebViewAssetLoader.
- `npm run totem:sync-blob` publica los recursos del paquete en ambos contenedores Blob configurados.
