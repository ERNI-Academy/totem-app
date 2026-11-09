# Totem Android

Aplicación Android vertical con **Totem original publicado como visualización predeterminada**, disponible sin conexión. La APK empaqueta el proyecto web original completo de `packages/totem-original/web`: el mismo `index.html`, CSS, JavaScript, SVG, fuentes, imágenes, vídeos y Three.js.

La entrada de WebView es el `index.html` original servido desde los assets locales por `WebViewAssetLoader`. No carga React, el backoffice, Azure ni PostgreSQL. `publication.json` registra los hashes del proyecto y la publicación predeterminada.

## Compilar

1. Desde la raíz del repositorio, instala dependencias con `npm install` (Node.js 22.12 o posterior).
2. Puedes generar y revisar el contenido offline con `npm run build:totem-apk` y `npm run test:totem`.
3. Abre esta carpeta (`totem-app`) en Android Studio con JDK 17 y Android SDK 35.
4. Gradle ejecuta `npm run build:totem-apk` durante `preBuild` y empaqueta `packages/totem-original/dist/android`.
5. Ejecuta `app` en Android 11 o posterior, o usa **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

La APK de depuración queda en `app/build/outputs/apk/debug/`. `versionName` y `versionCode` se editan en `version.properties`. La firma y archivo de releases se describen en [release/README.md](release/README.md).

La selección y sincronización remota de otras visualizaciones todavía requieren integrar el cliente del dispositivo con la API; esto no impide la publicación predeterminada offline de Totem original.

Consulta la [auditoría de funcionalidades](../docs/AUDITORIA_TOTEM_ORIGINAL.md) y las [instrucciones del módulo compartido](../packages/totem-original/README.md).
