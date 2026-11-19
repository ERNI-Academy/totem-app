# Tótem Android

La APK arranca con **Totem original** y recuerda la última visualización elegida. Pulsa tres veces en 700 ms sobre el logo ERNI superior izquierdo para abrir la galería. Si el logo se ha ocultado, pulsa en la misma zona de la cabecera.

Cada apertura consulta el catálogo publicado en Vercel. Las tarjetas muestran la portada y el nombre. El icono ↻ indica una actualización. Al seleccionar una versión nueva, el tótem descarga el ZIP desde Azure Blob, verifica su tamaño y SHA-256, lo extrae en su almacenamiento privado y prueba su pantalla inicial. Solo entonces activa la versión y retira la anterior. Sin red, el menú ofrece las versiones guardadas y un botón para reintentar.

## Probar en Chromium

Desde la raíz, inicia el backoffice local con `npm run dev` y, en otra terminal, ejecuta `npm run preview:totem`. Abre [el simulador en Chromium](http://127.0.0.1:4317/apk/launcher.html). Usa el puerto 3000 para el backoffice, o indica su origen con `TOTEM_BACKOFFICE_URL`. El simulador guarda los paquetes en `packages/totem-original/dist/simulator-cache`. El navegador recuerda la selección en su perfil. Para simular un corte, detén el backoffice y deja el simulador en marcha.

## Publicaciones

La ruta pública `GET /api/totem/catalog` consulta PostgreSQL en cada petición y devuelve enlaces temporales de lectura a los ZIP y miniaturas en el contenedor privado del entorno. Al publicar, el backoffice captura la pantalla inicial a 1080 × 1920 y guarda una miniatura WebP de 270 × 480. El borrador sigue siendo privado. Ejecuta `npm run catalog:prepare` después de preparar una base anterior o de importar una nueva versión protegida de Totem original. Es idempotente. En local se necesita Chromium de Playwright (`npx playwright install chromium`) o la ruta a Chromium en `TOTEM_CHROMIUM`.

La APK consulta [el catálogo de producción](https://totem-app-livid.vercel.app/api/totem/catalog). La compilación solo utiliza los archivos del repositorio. Los datos de acceso a PostgreSQL y Blob pertenecen al servidor.

## Generar la APK

Desde la raíz, con Node 22.12+, JDK 17 y Android SDK Platform 36:

```bash
source scripts/android-env.sh
cd totem-app
./gradlew assembleDebug
```

El archivo de prueba queda en `app/build/outputs/apk/debug/app-debug.apk`. Para instalarlo, cópialo al pendrive y ábrelo desde el gestor de archivos del tótem. Android necesita la misma firma que la instalación anterior para actualizarla conservando sus datos. Para distribuir una release firmada, usa la clave de distribución del proyecto. [Versiones y firma](release/README.md).

Tras instalar esta versión, publicar contenido solo requiere el backoffice. Antes de distribuir, abre la galería desde el tótem con acceso a Internet y selecciona una publicación para validar la conexión completa con Vercel y Blob.
