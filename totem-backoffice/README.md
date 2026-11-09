# Totem Backoffice

Backoffice en Next.js, React y TypeScript. La API del servidor usa PostgreSQL; los medios siguen almacenándose en Azure Blob Storage. El navegador nunca se conecta directamente a la base de datos.

## Desarrollo local

Requisitos: Node.js 22.12 o posterior, npm y Docker con Docker Compose.

1. Copia `.env.example` a `.env.local`. Configura `AUTH_SESSION_SECRET`, `INITIAL_ADMIN_SETUP_KEY` y las variables existentes de Azure Blob Storage. Genera una contraseña aleatoria para `POSTGRES_PASSWORD` y úsala también en `DATABASE_URL`.
2. Desde la raíz del repositorio, inicia PostgreSQL:

```bash
docker compose --env-file totem-backoffice/.env.local up -d postgres
docker compose ps
```

3. Instala dependencias y crea el esquema inicial:

```bash
npm install
npm --workspace totem-backoffice run db:setup
```

4. Inicia Next.js y visita `http://localhost:3000/setup` para crear el primer administrador:

```bash
npm run dev
```

La clave temporal `INITIAL_ADMIN_SETUP_KEY` se define localmente; el usuario elige el correo, nombre y contraseña del primer administrador en `/setup`. Después de crear la cuenta, elimina la clave de `.env.local` y reinicia la aplicación.

PostgreSQL usa el volumen Docker `totem_postgres_data`, por lo que los datos persisten al detener y recrear el contenedor. Para detener el servicio sin borrar los datos:

```bash
docker compose --env-file totem-backoffice/.env.local stop postgres
```

El esquema es idempotente para una base local nueva y crea las tablas, vistas y registros base `Totem original` y `ERNI base`. El registro `schema_migrations` anota el esquema inicial; la evolución posterior del esquema requiere una migración revisada.

## Comprobaciones

Desde la raíz del repositorio:

```bash
npm run typecheck
npm run test
npm run build
```

## Futuro despliegue en Azure

La aplicación requiere una base PostgreSQL 17 o compatible. En Azure Database for PostgreSQL, aplica el esquema con un proceso de migración aprobado y configura `DATABASE_URL` con TLS, idealmente `sslmode=verify-full` y la CA correcta. Mantén los secretos de sesión y las variables de Azure Blob en la configuración de servidor. No reutilices una URL de Azure SQL: el código ya usa el protocolo y las consultas de PostgreSQL.

La guía SQL Server anterior está archivada como referencia histórica en `../docs/CONFIGURAR-AZURE-SQL.md`; no describe el backend actual.

## Configuración segura

- `DATABASE_URL`, `POSTGRES_PASSWORD`, `AUTH_SESSION_SECRET` e `INITIAL_ADMIN_SETUP_KEY` son secretos de servidor.
- No antepongas `NEXT_PUBLIC_` a secretos.
- `.env.local`, `.env.production`, respaldos SQL y claves de firma no deben subirse a Git.
- Los blobs existentes permanecen en Azure Blob Storage. Los metadatos locales de la biblioteca residen en PostgreSQL.

## Totem original y recursos reutilizables

El backoffice se ejecuta en React, pero cada plantilla web es un paquete HTML/CSS/JavaScript independiente. `Totem original` carga los archivos de `packages/totem-original/web`, copia byte por byte de `totem-web`. El preview y la exportación sirven ese paquete; las copias pueden añadir ajustes y medios locales mediante un adaptador JavaScript sin reconstruir la plantilla en React. `db:setup` instala el documento canónico y añade nuevas publicaciones sin reescribir el historial.

`npm run totem:sync-blob` desde la raíz sincroniza el proyecto web original y los recursos reutilizables con `totem-media-dev` y `totem-media`. Registra las imágenes, iconos PNG y vídeos en la biblioteca. Las publicaciones se pueden descargar como ZIP y el preview ejecuta el mismo paquete autónomo; la APK predeterminada carga localmente el `index.html` original. Consulta la [auditoría](../docs/AUDITORIA_TOTEM_ORIGINAL.md).

Las visualizaciones nuevas conservan la cabecera y el pie editables y empiezan con el centro vacío. Las copias completas mantienen el contenido y las interacciones de su origen. Consulta la [guía del lienzo central](../docs/EDITOR_CENTRAL_CANVAS.md) para los controles, la migración de `new` y las pruebas del editor.
