# Configurar Azure SQL y Blob Storage para Totem

Guía para crear la base de datos y el almacenamiento de medios **manualmente** en el portal, crear las tablas y vistas, y conectar el backoffice. SQL guarda usuarios, diseños y metadatos; las imágenes y vídeos van en Azure Blob Storage. La contraseña SQL de Vercel debe pertenecer a un usuario de la base `totem-db`, no al administrador del servidor.

## 1. Crear la base de datos gratuita

1. Abre [Azure Portal](https://portal.azure.com) e inicia sesión con tu cuenta corporativa.
2. En el selector superior elige la suscripción **ERNI ESP Services Dev**.
3. Abre **Resource groups** y selecciona el grupo existente **totem-rg**.
4. Pulsa **Create** y busca **SQL Database**.
5. En **Basics**:
   - Subscription: `ERNI ESP Services Dev`.
   - Resource group: `totem-rg`.
   - Database name: `totem-db`.
   - Server: pulsa **Create new** y asigna un nombre globalmente único, por ejemplo `totem-erni-<sufijo>`.
   - En autenticación del servidor, configura Microsoft Entra admin según la política de ERNI. Guarda el nombre DNS del servidor.
6. En **Compute + storage**, elige **Configure database** y después **Free offer / Apply**.
7. Comprueba en el resumen que figure oferta gratuita, 32 GB, y el comportamiento **Continue using database for additional charges**. Esa es la opción seleccionada para que la base no quede pausada al agotar la cuota. Azure indica que este comportamiento no se puede cambiar luego a auto-pause en esa base.
8. Mantén la región aprobada por ERNI y la redundancia local. No actives geo-replicación.
9. Revisa que el grupo sea `totem-rg` y pulsa **Review + create** → **Create**.
10. En el servidor SQL, abre **Networking** y permite temporalmente la IP pública actual para usar Query Editor desde tu ordenador. Evita abrir el firewall a todas las IPs. La conexión de Vercel puede requerir otro acceso de red; revisa con ERNI si la política permite acceso público al SQL desde funciones cloud.

> Si la política corporativa no permite SQL authentication o acceso público desde Vercel, detente y consulta a ERNI antes de crear credenciales. La contraseña de servidor y la contraseña de aplicación son distintas.

## 2. Ejecutar la consulta de esquema

1. Abre la base **totem-db** en Azure Portal.
2. Selecciona **Query editor (preview)** en el menú lateral.
3. Inicia sesión con Microsoft Entra, o con el administrador SQL configurado si la política permite SQL authentication.
4. Abre [create-schema.sql](../database/sql/create-schema.sql), copia todo el contenido y pégalo en Query editor.
5. Pulsa **Run**. El script crea tablas, índices y vistas; se puede volver a ejecutar sin duplicar esos objetos ni los dos registros de sistema.
6. En **Messages** confirma que terminó sin errores. En el explorador SQL comprueba `dbo.Users`, `dbo.Visualisations`, `dbo.Templates`, `dbo.VisualisationDrafts` y las vistas `dbo.vw_*`.

La base inicial no contiene ninguna cuenta. Después de conectar el backoffice, visitarás `/setup` para crear el primer admin usando `INITIAL_ADMIN_SETUP_KEY`. No uses contraseñas predeterminadas ni compartas la clave de setup.

## 3. Crear una identidad SQL limitada para la aplicación

No pongas el administrador SQL en Vercel. Desde Query Editor, conectado con un administrador, ejecuta lo siguiente y reemplaza ambos marcadores por valores nuevos. La contraseña de ejemplo no es real: **cámbiala antes de ejecutar**.

```sql
CREATE USER [totem_app] WITH PASSWORD = 'REPLACE-WITH-A-LONG-UNIQUE-PASSWORD';
ALTER ROLE db_datareader ADD MEMBER [totem_app];
ALTER ROLE db_datawriter ADD MEMBER [totem_app];
GRANT EXECUTE TO [totem_app];
```

Este usuario puede leer y editar contenido. No puede crear tablas, cambiar esquema ni administrar la base. Las futuras migraciones se ejecutan manualmente desde Query Editor con tu usuario administrador después de revisar el SQL.

Si Query Editor informa que SQL authentication no está permitida, no habilites un modo bloqueado por política. Pide a ERNI confirmar la opción autorizada para que Vercel se conecte a Azure SQL; el backoffice no funcionará hasta tener un método de conexión aprobado.

## 4. Crear Blob Storage para la biblioteca de medios

Usaremos una cuenta de almacenamiento separada en el mismo grupo `totem-rg`. La biblioteca será compartida por las cuentas del backoffice del mismo entorno; desarrollo y producción mantendrán contenedores distintos.

1. En Azure Portal, abre `totem-rg` → **Create** → **Storage account**.
2. En **Basics**, usa la suscripción `ERNI ESP Services Dev`, el grupo `totem-rg`, un nombre global único en minúsculas (por ejemplo `totemmedia<identificador>`), la misma región que SQL y **Standard / General-purpose v2**.
3. En **Redundancy**, elige **Locally-redundant storage (LRS)** para el inicio. En **Advanced**, deja **Hierarchical namespace** desactivado.
4. En **Security**, deja **Secure transfer required** activado y desactiva el acceso anónimo a blobs. No habilites acceso público.
5. En **Networking**, conserva la política aprobada por ERNI. Si se limita a redes seleccionadas, confirma que tanto tu entorno local como Vercel puedan llegar al servicio antes de restringirlo.
6. Revisa el resumen y crea la cuenta.
7. En la cuenta, ve a **Data storage → Containers → + Container**. Crea los contenedores:
   - `totem-media-dev` para desarrollo local.
   - `totem-media` para producción.
   - Deja **Anonymous access level: Private (no anonymous access)** en ambos.

Los archivos se subirán al contenedor correspondiente. La tabla `dbo.Assets` ya guarda sus metadatos y `StorageKey`; el contenido binario no se guarda en SQL. Azure recomienda mantener los contenedores privados salvo que se necesite acceso anónimo. [Crear cuenta de Storage](https://learn.microsoft.com/en-us/azure/storage/common/storage-account-create) · [Crear contenedores](https://learn.microsoft.com/en-us/azure/storage/blobs/blob-containers-portal) · [Acceso anónimo](https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-configure)

La biblioteca también separa los metadatos con `dbo.Assets.Environment`: `APP_ENV=local` y `preview` usan `development`; `APP_ENV=production` usa `production`. Así, aunque ambos despliegues apunten a la misma base SQL, cada uno lista, sirve y elimina solo sus propios medios. La migración asigna los registros existentes a `development`, que corresponde a las imágenes subidas desde el entorno local.

### CORS para carga desde el navegador

La aplicación dará permisos SAS breves para un blob individual y el navegador enviará el archivo directamente a Azure. En la cuenta de Storage abre **Resource sharing (CORS) → Blob service** y configura:

| Campo | Valor |
|---|---|
| Allowed origins | `http://localhost:3000` y el dominio exacto de producción de Vercel |
| Allowed methods | `GET`, `HEAD`, `PUT`, `OPTIONS` |
| Allowed headers | `*` |
| Exposed headers | `ETag`, `x-ms-request-id`, `x-ms-version`, `x-ms-blob-type` |
| Max age | `3600` segundos |

Añade dominios Preview solo si se usarán con una base y contenedor de pruebas. CORS no sustituye la autenticación: el contenedor sigue privado y el SAS debe ser temporal y limitado al archivo. [Referencia CORS de Azure Storage](https://learn.microsoft.com/en-us/rest/api/storageservices/cross-origin-resource-sharing--cors--support-for-the-azure-storage-services)

### Connection string para el servidor

1. En la cuenta de Storage abre **Security + networking → Access keys** y copia la **Connection string** de `key1`.
2. Guárdala como `AZURE_STORAGE_CONNECTION_STRING` en `totem-backoffice/.env.local` para desarrollo y como variable **Secret** del entorno **Production** en Vercel.
3. El contenedor se configura con `AZURE_STORAGE_CONTAINER=totem-media-dev` en local y `AZURE_STORAGE_CONTAINER=totem-media` en Vercel.
4. No uses el prefijo `NEXT_PUBLIC_`, no pegues el valor en el navegador, no lo compartas ni lo subas a GitHub. La API lo usará solo en el servidor para emitir permisos SAS cortos y verificar archivos.

La connection string contiene una clave de cuenta con acceso amplio a Storage. Protégela como una contraseña de producción y rótala si se expone. El backoffice emite SAS de carga de 15 minutos limitados a un blob y SAS de lectura de 10 minutos. La primera versión de la biblioteca acepta JPEG, PNG y WebP de hasta 20 MB; los medios quedan compartidos en el contenedor de su entorno. Los usuarios pueden borrar una imagen si no está referenciada por ningún borrador ni versión publicada. No publiques la connection string ni los SAS.

## 5. Obtener la cadena de conexión de SQL

1. En la base, abre **Connection strings** y elige **ADO.NET**.
2. Copia el valor y sustituye el usuario y contraseña del administrador por `totem_app` y su contraseña propia.
3. Verifica host `<servidor>.database.windows.net`, base `totem-db`, puerto `1433`, `Encrypt=True` y `TrustServerCertificate=False`.
4. No publiques la cadena, no la pongas en el código ni la envíes en una captura.

Formato que entiende `mssql`:

```text
Server=tcp:<servidor>.database.windows.net,1433;Initial Catalog=totem-db;Persist Security Info=False;User ID=totem_app;Password=<contraseña>;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

## 6. Entorno local

1. En `totem-backoffice`, copia `.env.example` a `.env.local`.
2. Completa `DATABASE_URL` con la cadena ADO.NET anterior.
3. Genera valores aleatorios distintos para `AUTH_SESSION_SECRET` y `INITIAL_ADMIN_SETUP_KEY`. PowerShell puede generarlos sin instalar nada:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

4. Arranca la aplicación con `npm run dev`.
5. Abre `http://localhost:3000/setup`, introduce la clave inicial y crea tu admin. Setup se cierra automáticamente una vez creada la primera cuenta.

`.env.local` está excluido de Git. No añadas `DATABASE_URL` a un archivo `NEXT_PUBLIC_*`: esos valores llegan al navegador.

Cuando se conecte la biblioteca de medios, añade también estas variables al mismo `.env.local`:

```env
AZURE_STORAGE_CONNECTION_STRING="<connection-string-de-la-cuenta-de-storage>"
AZURE_STORAGE_CONTAINER=totem-media-dev
```

## 7. Producción manual en Vercel

1. Sube el repositorio a GitHub y crea/importa el proyecto desde el dashboard de Vercel. El proyecto raíz será `totem-backoffice`.
2. En **Project → Settings → Environment Variables**, crea lo siguiente para **Production** (y Preview solo si tienes una base de pruebas aparte):

| Variable | Valor | Tipo |
|---|---|---|
| `APP_ENV` | `production` | Config |
| `DATABASE_URL` | Cadena de `totem_app` a `totem-db` | Secret |
| `AUTH_SESSION_SECRET` | Valor aleatorio nuevo, distinto al local | Secret |
| `INITIAL_ADMIN_SETUP_KEY` | Clave aleatoria nueva y temporal | Secret |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string de la cuenta Blob dedicada a Totem | Secret |
| `AZURE_STORAGE_CONTAINER` | `totem-media` | Config |

3. No añadas estas variables al prefijo `NEXT_PUBLIC_`.
4. Pulsa **Redeploy** o despliega el commit desde Vercel. Los handlers `/api` ejecutan en el servidor; la cadena no forma parte de JavaScript público.
5. Abre la URL de producción `/setup`, crea el admin y, a continuación, elimina `INITIAL_ADMIN_SETUP_KEY` de Vercel y vuelve a desplegar. Una vez inicializado, el endpoint setup también rechaza cualquier creación adicional.
6. Prueba inicio de sesión, listado y guardado en producción.

### Aplicar la separación de medios en una base ya creada

1. Abre `database/sql/create-schema.sql` desde el repositorio.
2. En Azure Portal abre la base `totemdb` → **Query editor**, inicia sesión con Microsoft Entra y pega el script completo.
3. Ejecuta el script. Es idempotente: crea lo que falte y añade `Environment` a `dbo.Assets`; no borra archivos ni metadatos existentes. Los registros previos se marcan como `development`.
4. Confirma el resultado con:

```sql
SELECT Environment, COUNT(*) AS AssetCount
FROM dbo.Assets
GROUP BY Environment;
```

5. Despliega el código actualizado. Local debe tener `APP_ENV=local` y `AZURE_STORAGE_CONTAINER=totem-media-dev`; Vercel Production, `APP_ENV=production` y `AZURE_STORAGE_CONTAINER=totem-media`.

Si ya habías cargado medios de producción antes de esta migración, vuelve a subirlos desde producción después del despliegue para que queden registrados con `Environment='production'`.

Para Preview utiliza **otra base de pruebas** y secretos diferentes. No conectes Preview ni desarrollo al mismo SQL que contiene producción.

## 8. Dos entornos

| Entorno | Base | Secretos | URL |
|---|---|---|---|
| Local | `totem-db-dev` y contenedor `totem-media-dev` | `.env.local` | `localhost:3000` |
| Producción | `totem-db` y contenedor `totem-media` | Vercel Production Secrets | dominio Vercel |

Para una primera prueba con un solo SQL, trabaja localmente solo con registros de prueba, haz backup antes de probar cambios de esquema y no uses el usuario admin de Azure como `DATABASE_URL`. Lo recomendable es crear una segunda base llamada `totem-db-dev` dentro del mismo servidor (con su propio modo de cobro/cuota) para que las pruebas no alteren datos de producción.

## 9. Solución de problemas

- **Error de firewall / client IP:** añade tu IP pública actual al firewall del servidor SQL para Query Editor y local. No abras `0.0.0.0–255.255.255.255`; revisa la política de Vercel con ERNI antes de permitir conexiones cloud.
- **Login failed:** confirma que `totem_app` se creó dentro de `totem-db`, no solo en el servidor, y que la contraseña coincide.
- **Timeout:** comprueba servidor, puerto 1433, firewall, `Encrypt=True` y acceso saliente aprobado.
- **Error al iniciar setup:** revisa `INITIAL_ADMIN_SETUP_KEY` en el entorno que corresponde y los logs server-side. No lo incluyas en consultas HTTP ni en el navegador.
- **Se agotó la cuota:** la opción elegida permite cargos adicionales. Revisa el consumo mensual desde Azure Cost Management.
- **Blob devuelve 403:** confirma que el contenedor es privado, que el SAS no expiró, que incluye los permisos del archivo y que el origen exacto figura en CORS.
- **Blob no conecta desde Vercel:** revisa las reglas de red de la cuenta y la política corporativa; no habilites acceso anónimo para resolverlo.

## Recursos oficiales

- [Crear Azure SQL Database gratuita](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-tier)
- [Conectar y usar Query Editor](https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-microsoft-entra-connect-to-azure-sql)
- [Variables de entorno y secretos en Vercel](https://vercel.com/docs/environment-variables)
