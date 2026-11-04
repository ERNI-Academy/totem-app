# Totem Android

Contenedor Android vertical que carga `totem-web` desde los assets incluidos en el APK. La primera versión mantiene la experiencia existente disponible sin conexión; la sincronización y selección remota todavía requieren integración con la API.

## Abrir y compilar

1. Instala Android Studio, JDK 17 y Android SDK 35.
2. Abre esta carpeta (`totem-app`) como proyecto en Android Studio y espera a que Gradle descargue sus dependencias.
3. Ejecuta la configuración `app` en un dispositivo Android 11 o posterior.
4. Para crear un APK de depuración usa **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Gradle lo deja en `app/build/outputs/apk/debug/`.

`versionName` y `versionCode` se editan en `version.properties`. Las APK generadas no se versionan en Git; consulta [release/README.md](release/README.md) para archivarlas.

El proyecto todavía no incluye una clave de firma ni debe distribuirse como release. La clave se configurará localmente antes de generar la primera APK firmada.
