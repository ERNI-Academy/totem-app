# Totem: implementación local y Vercel

> **Estado:** Ejecución autorizada. No desplegar ni modificar recursos de Azure automáticamente.

## Arquitectura vigente

- Next.js + React + TypeScript: backoffice y API server-side dentro del mismo proyecto, desplegado manualmente en Vercel.
- Azure SQL se crea manualmente siguiendo `docs/CONFIGURAR-AZURE-SQL.md` y ejecutando `database/sql/create-schema.sql` en Query Editor.
- SQL se configura con oferta gratuita (32 GB) y continuación con cargos al agotar cuota, según decisión del usuario.
- Sin Azure Functions, Static Web Apps, Terraform ni despliegue Azure desde GitHub.
- Android se mantiene en `totem-app`; `totem-web` permanece como referencia original.
- Dos entornos: local (`.env.local`, no versionado) y producción (variables del proyecto Vercel).
- `DATABASE_URL` sólo se usa en rutas server-side. Nunca tendrá prefijo `NEXT_PUBLIC_` ni se importará en componentes cliente.

## Estado implementado

- Backoffice Next.js/React/TypeScript, vista ERNI inicial, login y configuración del primer admin.
- Rutas API para sesiones, altas/activación de usuarios, CRUD de visualizaciones, borradores, publicación SQL y consulta/creación desde plantillas.
- Editor inicial con lienzo, capas, bloqueo, mover/redimensionar elementos, estilos básicos, enlaces entre pantallas, guardar/publicar y previsualización.
- Biblioteca compartida de imágenes con Azure Blob Storage privado, SAS breve para transferencias, verificación de MIME/tamaño/hash y metadatos en SQL.
- Esquema SQL idempotente con tablas, índices, vistas, visualización original y plantilla ERNI inicial.
- Guía manual de Azure SQL, Query Editor, usuario de aplicación, connection string, local y Vercel.
- `.env.example` y `.env.production.example` separan los valores de ejemplo; `.gitignore` excluye secretos y binarios.
- APK Android inicial en Kotlin/WebView que incluye `totem-web` desde los assets del APK para mostrar el sitio sin conexión.

## Pendiente antes de considerar terminado

- Gestión de vídeos, eliminación segura de medios referenciados y limpieza de cargas huérfanas.
- API y pantallas de administración/sincronización de dispositivos, enlace de tótems y selector Apply/Exit.
- Recuperación de contraseña, caducidad por inactividad y conflictos/autoguardado completos.
- Fidelity completa del editor respecto a `totem-web`, navegación/demos existentes y pruebas visuales en Dahua.
- Compilar y firmar APK en Android Studio; no hay keystore en el repositorio.
- Prueba integrada contra una base de desarrollo creada por el usuario.

## Verificación realizada

- `npm ci` instala desde el lockfile y el último `npm run typecheck`, `npm run test` y `npm run build` terminan correctamente.
- La prueba SQL valida la presencia de tablas/vistas/seeds esenciales y que no exista una contraseña admin por defecto.
- No se desplegó Azure, no se subió código a GitHub ni se publicó en Vercel.
