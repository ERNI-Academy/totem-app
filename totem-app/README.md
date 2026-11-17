# Totem Android

Aplicación Android vertical con **Totem original publicado como visualización predeterminada**, disponible sin conexión. La APK empaqueta el proyecto web original completo de `packages/totem-original/web`: el mismo `index.html`, CSS, JavaScript, SVG, fuentes, imágenes, vídeos y Three.js.

La entrada de WebView es el `index.html` original servido desde los assets locales por `WebViewAssetLoader`. No carga React, el backoffice, Azure ni PostgreSQL. `publication.json` registra los hashes del proyecto y la publicación predeterminada.

## Preview en Chromium

Desde la raíz del repositorio, con `totem-backoffice/.env.local` configurado para PostgreSQL y Azure Blob:

```bash
npm run preview:totem
```

Abre `http://127.0.0.1:4317/apk/launcher.html` en Chromium. Es el mismo catálogo offline que se empaqueta para Android. Haz tres clics rápidos sobre el logo ERNI superior izquierdo para abrir el selector. El simulador conserva la visualización elegida en el almacenamiento local del navegador; borrar los datos del sitio reinicia Totem original.

El catálogo incorpora Totem original y la versión publicada más reciente de cada visualización no protegida. Los borradores se omiten. La nueva publicación se recoge al volver a generar el paquete. Si el catálogo cambia, el selector vuelve a Totem original.

## Compilar

1. Requisitos: Node.js 22.12+, JDK 17, Android SDK Platform 36 y Build Tools 35.0.0. Platform 36 es necesario por las dependencias AndroidX actuales; el `targetSdk` sigue siendo 35. Este equipo tiene JDK y SDK instalados en `~/.local/share`; desde la raíz, carga sus variables con `source scripts/android-env.sh`.
2. Asegúrate de que `totem-backoffice/.env.local` tenga `DATABASE_URL`, `AZURE_STORAGE_CONNECTION_STRING` y `AZURE_STORAGE_CONTAINER` con acceso al entorno cuyo catálogo quieres empaquetar.
3. Desde la raíz ejecuta `npm run build:totem-apk` para incluir Totem original y las últimas publicaciones.
4. Desde esta carpeta genera la APK de depuración con `./gradlew assembleDebug`. Gradle vuelve a recopilar el catálogo antes de compilar.
5. APK resultante: `app/build/outputs/apk/debug/app-debug.apk`. Para instalar con un dispositivo conectado y `adb` configurado: `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

Para repetir la compilación tras cambios:

```bash
cd /home/davidwalker/Projects/totem-app
source scripts/android-env.sh
npm run preview:totem
```

Abre en Chromium la URL que imprime el servidor y prueba tres clics rápidos en el logo. Cuando esté listo para instalar:

```bash
cd totem-app
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`adb install` requiere un tótem o dispositivo Android conectado y autorizado. Para compilar sin instalar, basta con los dos primeros comandos de ese bloque.

La APK de depuración queda en `app/build/outputs/apk/debug/`. `versionName` y `versionCode` se editan en `version.properties`. La firma y archivo de releases se describen en [release/README.md](release/README.md).

La APK no necesita red ni credenciales en el tótem: las publicaciones se descargan durante la compilación local y se empaquetan como assets. Los borradores y las publicaciones posteriores no aparecen en un APK ya instalado hasta regenerarlo y reinstalarlo.

Consulta la [auditoría de funcionalidades](../docs/AUDITORIA_TOTEM_ORIGINAL.md) y las [instrucciones del módulo compartido](../packages/totem-original/README.md).
