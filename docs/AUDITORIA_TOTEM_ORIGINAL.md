# Publicación de Totem original

`packages/totem-original/web` es una copia byte por byte de `/home/davidwalker/Projects/totem-web`. El inventario de `manifest.json` registra la ruta, el tamaño y el SHA-256 de cada archivo fuente. En la importación del 9 de noviembre de 2026 contiene 15 archivos y su SHA-256 del inventario es `4b86ebf6b9b8b015992d1933028b7a4de5e9b747dfa9473ec049012d3df1466b`; el `index.html` conserva el hash `28cc06e054400067344c4e79aba6f34daf42d8e50bd83bc0a6a363a3d237d69d`.

## Arquitectura

- El backoffice está implementado en Next.js, React y TypeScript.
- Las plantillas son paquetes web independientes. `Totem original` no se reconstruye en JSX ni carga la aplicación React.
- El preview abre los archivos de la publicación en un iframe aislado. Para copias web se añade `web-editor/adapter.js` y los datos versionados de ajustes.
- El editor permite seleccionar elementos web, cambiar texto, tamaño, posición y medios, incluidos iconos SVG sustituidos por recursos de la biblioteca.
- Las publicaciones versionadas se descargan con `GET /api/visualisations/:id/export?version=n`. El ZIP es autónomo; los medios de Blob se incorporan como archivos locales.
- Android WebView carga el `index.html` fuente desde sus assets locales. No requiere React, Blob, sesión ni conectividad.
- Los diseños canvas históricos conservan su editor React y el exportador produce para ellos un `index.html` estático con CSS y JavaScript, sin dependencias React.

La visualización protegida mantiene el historial y el nuevo `db:setup` registra la nueva publicación a partir del proyecto fuente. Las copias son editables y no modifican el original. La sincronización remota de publicaciones a dispositivos no está implementada.

## Recursos compartidos

`resources/icons/` contiene derivados SVG y PNG transparentes en dos colores para la biblioteca del backoffice. La plantilla fuente sigue utilizando sus iconos SVG originales. `npm run totem:sync-blob` sube el proyecto web y los recursos derivados a los contenedores `totem-media-dev` y `totem-media`; `scripts/verify-totem-blob.mjs` verifica los bytes descargados y los SHA-256.

## Verificación realizada

- `npm run typecheck`: correcto.
- `npm run build`: correcto con permisos del entorno.
- `npm run build:totem-apk`: genera los assets Android desde el proyecto fuente.
- `npm run test:totem`: 5 pruebas pasadas. Compara SHA y bytes de los 15 archivos entre fuente y salida Android; ejecuta cinco demos, selector de foto SIFU, AI Vision, navegación por teclado y vídeo de talento en Chromium tanto con la referencia como con el bundle Android. También verifica que el adaptador aplique posición, tamaño y texto dinámico, y que pueda reemplazar SVG por medios seleccionados.
- No se ha compilado un APK firmado ni probado en el tótem físico; esta sesión no dispone de JDK/Android SDK y el equipo no está conectado.

El resultado JSON de Playwright se escribe en `test-results/totem-results.json` (artefacto ignorado por Git). La hoja de iconos está disponible en [TOTEM_ORIGINAL_ICONS.png](TOTEM_ORIGINAL_ICONS.png).
