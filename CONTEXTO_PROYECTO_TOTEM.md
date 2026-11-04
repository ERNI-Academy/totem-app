# Contexto del proyecto Totem: app Android y backoffice

> Documento de traspaso para continuar la conversación y definición de arquitectura en otra instalación de Codex. Recoge el objetivo, los requisitos expresados por la persona usuaria, el contexto técnico observado y las decisiones que siguen abiertas. No es una orden para implementar el sistema.

## Actualización de arquitectura (2026-11-03)

La persona usuaria autorizó implementar. El backoffice React y sus funciones API TypeScript se alojarán juntos en Next.js/Vercel; Vercel se desplegará manualmente cuando el usuario suba el código a GitHub. Azure SQL se crea manualmente por el usuario; los pasos están en `docs/CONFIGURAR-AZURE-SQL.md` y su esquema en `database/sql/create-schema.sql`. Deben existir entornos locales y de producción separados. No hacer Azure deploy, Terraform ni CI/CD de despliegue automático a Azure. La conexión SQL solo se configura como `DATABASE_URL` server-side y se mantiene fuera del bundle público. `totem-web` es el motor/referencia, no se migra a React. La guía técnica anterior, donde se planteaba Terraform, Functions o Azure hosting, ha quedado obsoleta por estas decisiones posteriores.

## 1. Estado de la conversación y forma de continuar

- La persona usuaria está en fase de descubrimiento y definición de ideas/arquitectura. Ha indicado expresamente: **«de momento no quiero implementar, tan solo estamos definiendo ideas y arquitectura»**.
- No crear todavía la app, el backoffice, infraestructura, servicios Azure ni código de producción. Tampoco asumir que un plan final ya fue aprobado.
- La conversación debe continuar recopilando requisitos y contestando dudas de arquitectura. Hay más requisitos que la persona quiere ir definiendo progresivamente.
- Se pidió este Markdown para usarlo como contexto en otro Codex en otro ordenador.
- Idioma de conversación: español. Tono claro, colaborativo y no excesivamente técnico.
- No considerar las propuestas previas del asistente como decisiones confirmadas, salvo cuando el usuario las aceptó explícitamente o las expresó como requisitos. En particular, las propuestas de backend/servicios concretos y sincronización requieren validación posterior.

## 2. Objetivo de alto nivel

Crear en el futuro un producto compuesto por:

1. Una APK instalable para un tótem Android, con compatibilidad importante con **Android 11**.
2. Un backoffice web, preferiblemente construido con **React.js**. La preferencia por React se aplica **solo al backoffice**, no a la web/app `totem-web`.
3. Un sistema de plantillas y contenidos publicados, gestionable sin conocimientos de programación, que permita modificar el contenido visual del tótem sin reinstalar la APK.
4. Un sistema de sincronización entre Azure/backoffice y el tótem.

Se dispone de una cuenta corporativa Azure. No hay acceso o permiso para utilizar OAuth corporativo; el usuario propone cuentas propias con correo/contraseña y roles.

## 3. Contexto del repositorio y de la web existente

Workspace observado: `/home/davidwalker/Projects/totem`

- Existe `totem-web/` y `totem-app/` (la carpeta `totem-app` existe, pero no se examinó su contenido en esta conversación).
- `totem-web/` es una web estática autocontenida; no se encontró una app React existente. La implementación principal está en `totem-web/index.html`.
- `totem-web/README.md` la describe como una web offline para un tótem vertical Dahua de 65 pulgadas con Android 11, diseñada para 1080×1920 y ajustada a pantallas verticales.
- Archivos observados: `index.html`, fuentes Source Sans Pro locales, vídeos e imágenes dentro de `media/`, y `vendor/three.min.js` para una demo 3D.
- La web usa HTML/CSS/JavaScript sin framework. No reescribirla en React por defecto.
- La página tiene contenido de ERNI / Swiss Tech Center. Header con logos, hero con vídeo y títulos, cuadrícula de demos, sección “Our talent” y banda inferior azul “Our AI Vision / From AI idea to value in production”.
- La web está dimensionada a un escenario de 1080×1920. En `index.html`, `#stage` tiene tamaño 1080×1920 y se escala para encajar en la ventana.
- Comportamientos existentes documentados/observados: navegación táctil entre tiles y vistas modales de demostración, navegación anterior/siguiente y gestos horizontales para cambiar demos, botón de vuelta a la página, reproducción de vídeo, animaciones y vuelta al home tras 90 segundos sin interacción (salvo reproducción activa). Hay escenas interactivas y una experiencia con contenido de visión de IA.
- La transición de apertura de los modales existentes se implementa como desplazamiento vertical (`transform: translateY(100%)` a `translateY(0)`) con transición CSS de 0,38 s y curva `cubic-bezier(.2,.8,.2,1)`. El requisito expresado es que el cambio entre pantallas de las nuevas experiencias reproduzca **exactamente la transición que ya tiene `totem-web`**; debe verificarse al implementar cuál transición concreta corresponde al flujo card→detalle y replicarla, no inventar otra.
- README actual dice que se puede usar Fully Kiosk Browser y servir los archivos estáticos localmente o en un servidor. Esto es contexto de la implementación web actual, no una decisión de arquitectura para la futura APK.

## 4. Aclaración clave de la experiencia visual

La persona aclaró el sentido de “copia exacta”:

- Debe sentirse igual que abrir `totem-web` desde un navegador: imágenes con proporciones correctas, enlaces, vídeos, animaciones, interacciones y todo lo que se muestra en la web.
- El ancho/alto objetivo es el que ya viene definido por la web; el escenario planteado es el formato vertical de 1080×1920 del tótem.
- No se busca por ahora rediseñar para varios tamaños o relaciones de aspecto.

La persona también preguntó si la app iba a ser solo un marco para cargar la web. Se aclaró como recomendación que la APK podría contener localmente la web/visor, en lugar de depender de cargar la página base desde internet. Esto fue una propuesta del asistente, no un acuerdo definitivo de tecnología. Hay que revalidar las opciones de empaquetado nativo/WebView, actualización del shell y distribución.

## 5. Modelo de contenido: base del tótem y visualizaciones

### 5.1 Idea inicial

Primero se habló de una zona dinámica entre el header/banner “Swiss Tech Center” y el footer azul. La idea era actualizar esa zona a través del backoffice.

### 5.2 Aclaración mediante imagen

La persona adjuntó una captura de la web con un contorno rojo y explicó con precisión:

- La app tiene una **pantalla base**, que es la web actual de `totem-web`.
- Dentro de esa base existe una zona central (la marcada en rojo) que actuará como zona dinámica para agregar contenido.
- La base comprende header y hero en la parte superior, la banda azul inferior “Our AI Vision” como footer y el área central delineada en rojo.
- El backoffice debe permitir crear una visualización cuya vista inicial se incruste dentro de esa zona roja. El editor debe usar por defecto medidas/formato que encajen en dicha área.
- Si dentro de la vista incrustada se toca una card/enlace que abre otra pantalla, esa pantalla de detalle debe ocupar la pantalla completa, igual que las vistas actuales de `totem-web`.
- Por tanto, cada experiencia debe poder contener una pantalla inicial embebida en la zona central y una o más vistas de detalle full-screen.
- El retorno desde detalle debe permitir volver a la pantalla de origen/anterior mediante un botón en una esquina o control equivalente.
- Las nuevas pantallas enlazadas siguen formando parte de la experiencia/visualización, no son páginas web externas independientes.
- La transición entre pantalla embebida y pantalla de detalle debe ser exactamente igual a la que ya tiene `totem-web` para las transiciones correspondientes.

### 5.3 Visión ampliada: edición de toda la base

Posteriormente, la persona preguntó si se podría editar TODO el contenido del tótem desde el backoffice, incluidos header y footer, para no reinstalar la APK al cambiar esos elementos. La idea propuesta por la persona:

- Tener una plantilla base en backoffice que reproduzca el tótem actual.
- La plantilla mantiene inicialmente header, hero y footer existentes.
- La zona roja se deja en blanco para crear la nueva experiencia dinámica.
- En el futuro se podrían modificar header/footer y el resto del contenido sin reinstalar la app.

Se respondió que esto es viable en principio: separar el visor/lógica de la app del contenido visual publicado. Las modificaciones de contenido compatibles con el visor se actualizarían desde backoffice/Azure; cambios en capacidades de la app sí podrían requerir nueva APK. Se advirtió que preservar animaciones y comportamientos complejos requiere componentes/plantillas soportados por el editor y no implica libertad de ejecutar cualquier código arbitrario. Esto es recomendación técnica, no decisión técnica cerrada.

## 6. Plantilla y protección mediante anclado

La persona quiere:

- En el editor, poder **anclar/desanclar** componentes. Un componente anclado no debería poder editarse, moverse ni eliminarse.
- El desbloqueo debe requerir una acción explícita, por ejemplo pulsar un icono de candado.
- El repositorio de visualizaciones debe contener por defecto la visualización actual de `totem-web` y esta visualización base no se puede borrar.
- El backoffice debe incluir una plantilla basada en la visualización actual.
- En esa plantilla, header, hero, footer y demás contenido existente que no es la zona de creación deberían estar anclados por defecto; la zona roja se deja vacía/editable para crear la vista inicial y las pantallas full-screen asociadas.
- La persona podrá crear contenido nuevo reutilizando la plantilla; se debe precisar si el desbloqueo solo es para personalizar la copia y cómo se protege la versión canónica.

## 7. Backoffice: usuarios, roles y acceso

Requisitos expresados:

- Acceso por internet.
- Sin OAuth corporativo por falta de permiso.
- Cuentas individuales con correo y contraseña (la persona eligió esta opción en una consulta de arquitectura).
- Lista de usuarios permitidos.
- Roles `admin` y `user`.
- Admin necesita una zona “Add user” donde pueda agregar usuarios, borrar, editar sus datos y cambiar su rol.
- Debe aclararse qué acciones concretas puede hacer un `user` respecto a diseños, publicación, duplicado y eliminación. No se definió aún.
- Recuperación de contraseña, invitaciones, verificación de correo, políticas de contraseña, auditoría y mecanismo de alta del primer admin siguen pendientes.
- Una recomendación previa fue validar roles y permisos en backend, no solo ocultar acciones en frontend. No está seleccionado un proveedor de identidad concreto.

## 8. Editor visual del backoffice

La persona espera que lo use gente no técnica en ordenadores **no táctiles**. El backoffice se opera con ratón/teclado; **solo el tótem es táctil**. Una vista previa se puede recorrer usando clics de ratón, simulando la experiencia del tótem, pero no se debe describir el backoffice como una interfaz táctil.

Requisitos expresados:

- React.js como preferencia para construir el backoffice.
- Editor visual intuitivo para montar secciones sin programación.
- Permitir crear colores, cambiar fuentes, ajustar formatos.
- Permitir definir color de fondo o utilizar una imagen de fondo.
- Añadir texto, imágenes, vídeos y enlaces.
- Redimensionar y recolocar bloques; el editor debe soportar composición no cerrada aunque se propongan bloques guiados.
- Imágenes: respetar proporción y permitir crop/recorte.
- Vídeos: conservar proporción al cambiar su tamaño.
- Composición por capas: colocar elementos unos sobre otros, por ejemplo texto encima de una imagen.
- Cambiar el orden de las capas (qué está delante/detrás).
- Arrastrar elementos con el ratón para posicionarlos en el lienzo.
- Los elementos anclados están protegidos frente a edición, movimiento y borrado hasta desanclarlos explícitamente.
- La vista inicial usa canvas/formato de la zona roja; los detalles usan formato de pantalla completa.
- La persona pidió que la creación de navegación entre pantallas sea simple y replique lo que ya funciona en `totem-web`.
- Los enlaces entre pantallas han de poder definirse visualmente: una card/botón puede enlazar a una pantalla de detalle concreta, que tendrá un control de volver.
- La vista previa debe poder probar la navegación completa con clics del ratón, incluyendo cards, navegación a detalle, botón de volver y transiciones.
- Debe preservar/transmitir el aspecto del tótem a 1080×1920 y dimensiones de la zona dinámica.
- Por determinar: si además de drag-and-drop se ofrecen controles numéricos finos; reglas de alineación, guías, snapping, deshacer/rehacer, autosave, drafts, límites de medios, compatibilidad de fuentes, etc. No asumir que ya se han solicitado.

## 9. Navegación y transiciones entre pantallas

Requisitos directos:

- Las visualizaciones pueden incluir una pantalla inicial con varias cards/iconos/texto.
- Al pulsar una card se cambia a la pantalla que contiene información sobre esa card.
- Debe ser fácil establecer ese enlace dentro del backoffice.
- Se pueden conectar múltiples pantallas; se vuelve mediante botón de regreso configurable en una esquina u otra ubicación.
- El detalle se abre a pantalla completa, como ocurre ahora en `totem-web`.
- La transición visual debe ser **exactamente la misma que existe en `totem-web`**, no una transición aproximada ni elegida por el implementador. Explorar código actual al implementar para identificar el comportamiento exacto y reusarlo.
- La previsualización de backoffice es manejada por ratón, no táctil. La experiencia final en el tótem sí es táctil.
- No se definieron los tipos de navegación permitidos (pila anterior, destino específico, volver a inicio, next/previous, loops), ni el comportamiento de enlaces externos.

## 10. Repositorio de visualizaciones del tótem

La persona propone un menú oculto para acceder al catálogo en el dispositivo:

- Un gesto de **cinco pulsaciones** en una zona todavía por decidir abre el repositorio sobre la zona dinámica.
- Mostrar las visualizaciones publicadas disponibles en formato de iconos/tarjetas con:
  - nombre definido al crear la visualización;
  - miniatura/preview de su apariencia;
  - estado resaltado para la visualización actualmente activa.
- Tocar otra visualización la marca como selección pendiente.
- **Apply** aplica la visualización seleccionada, cierra el catálogo y muestra la nueva visualización.
- **Exit** cierra el catálogo y conserva la visualización que estaba activa, incluso si se había tocado otra que quedó solo como selección pendiente.
- El repositorio detectará visualizaciones nuevas y antiguas publicadas desde backoffice.
- Usuarios del backoffice pueden modificar, publicar y (con permisos todavía por determinar) borrar visualizaciones.
- Si se borra en backoffice la visualización que está activa en un tótem:
  - deja de aparecer en el catálogo del servidor/repo;
  - el tótem conserva su copia local y sigue mostrando la visualización activa;
  - continuará visible hasta que alguien elija otra y pulse Apply.
- La visualización base actual `totem-web` aparecerá por defecto en el repositorio y no se podrá borrar.
- No se definió si la base protegida es seleccionable/aplicable como cualquier visualización o si tiene reglas distintas.
- No se definió expiración/retención de assets locales, gestión de espacio, IDs de tótem, sincronización de catálogo, ni qué significa “detectar” una publicación temporalmente.

## 11. Duplicar visualizaciones

Requisito:

- Backoffice debe tener acción **Duplicate** para reutilizar elementos de visualizaciones existentes.
- Los nombres no deben duplicarse.
- No se decidió si el sistema genera automáticamente un nombre único sugerido (p. ej. “Nombre (copia)”, con sufijo incremental) o si obliga al usuario a elegir uno antes de guardar. La respuesta anterior del asistente sugirió un nombre automático editable, pero el usuario aún no lo ha confirmado.
- Falta determinar si la duplicación incluye todos los medios/pantallas/capas y conserva las conexiones, y cómo se comporta respecto a elementos anclados.

## 12. Publicación y sincronización

Requisitos/ideas:

- Crear/modificar una visualización y pulsar **Publish** la almacena/publica en el repositorio.
- El dispositivo debe detectar visualizaciones publicadas y poder descargarlas.
- El usuario inicialmente dijo que se podría conectar a un servicio o hacer polling periódicamente.
- La idea luego se concretó en catálogo del tótem con selección manual mediante Apply; publicar una nueva visualización no quedó definido como cambio automático de la visualización activa. La descripción de usuario implica catálogo actualizado y cambio activo explícito en el tótem.
- El dispositivo debería usar medios/visualizaciones descargados y, si se decide, conservarlos offline. Esta estrategia fue recomendada por el asistente, pero la persona aún no definió requisitos exactos de offline.
- Propuesta previa de Azure: Blob Storage para vídeos/imágenes y API/base de datos para contenido/publicación. La persona indicó preferencia general por Azure, pero no ha aprobado servicios exactos.
- Quedan por especificar intervalo de polling, versión/publicación atómica, fallos/reintentos, publicación en borrador, rollback, conectividad, actualizaciones del contenido base, múltiples tótems y activación en dispositivos.

## 13. Arquitectura discutida y qué no debe darse por decidido

Se han propuesto, pero **no seleccionado formalmente**:

- APK Android con WebView local para alojar la web/visor.
- Capacitor para empaquetado.
- Azure Blob Storage + API + base de datos.
- React para el backoffice (esto sí es preferencia expresa, no para la app existente).
- Cuentas correo/contraseña con verificación y recuperación.
- Polling frente a push o modo exclusivamente online.
- Conservación offline de la última versión descargada.
- La idea de “web local en APK” recibió explicación favorable, pero la persona preguntó si la app iba a ser un marco web; aún hace falta confirmar su preferencia final y exponer tradeoffs.

La conversación sí estableció conceptualmente que el contenido visual puede cambiar desde backoffice sin reinstalar APK, siempre que la app ya incluya capacidades suficientes para representarlo. Cambios de lógica/capacidades nuevas en el visor probablemente requieren actualizar APK; se explicó esto como limitación práctica.

## 14. Temas pendientes prioritarios para las siguientes conversaciones

1. **Revisar/confirmar arquitectura de renderizado:** web existente en WebView dentro de APK vs alternativa nativa; preservar HTML/JS y experiencias; qué contenido va empaquetado y qué se descarga.
2. **Definir plantillas visuales:** qué componentes/zonas son universales/editables, cómo se modelan módulos complejos que ya existen, qué significa la visualización base protegida y cómo se duplica para personalización.
3. **Contenido editado frente a funciones existentes:** distinguir cambios de contenido (sin reinstalación) de cambios de lógica (posible actualización APK), particularmente animaciones, escenas 3D, gestos y controles multimedia.
4. **Permisos `user` vs `admin`:** quién puede crear, duplicar, modificar, publicar, borrar, administrar usuarios; si hay propiedad/autoría y si publicar requiere revisión.
5. **Identidad y seguridad:** alta inicial de admin, correo de recuperación/verificación, proveedores Azure adecuados, política de acceso público, protección de la API.
6. **Sincronización:** periodicidad/trigger, actualización del catálogo, cache offline, espacio y retención, versionado/rollback y actualización del shell base.
7. **El gesto oculto:** dónde van las cinco pulsaciones, si hay debounce/ventana de tiempo y accesibilidad de la acción.
8. **Nombres y duplicado:** política única de nombres y comportamiento completo de duplicación.
9. **Editor:** funciones concretas de capas, alineación, unidades/dimensiones, crop, fuentes web, undo/redo, preview y validaciones.
10. **Distribución APK y dispositivo:** modelo exacto de tótem, requisitos del kiosk/arranque, firma, instalación/actualización de APK y versión mínima Android objetivo/SDK, verificando información actual cuando llegue la fase de decisión técnica.
11. **Proceso de contenido base:** migración de la página actual a la plantilla; disponibilidad/derechos sobre logos, vídeos, fuentes y activos multimedia.

## 15. Principios para el siguiente Codex

- Continuar en español.
- Respetar que el trabajo es de definición; no editar código ni crear infraestructura hasta que la persona solicite explícitamente implementar.
- Cuando se aconseje una arquitectura, distinguir claramente: requisito expresado, recomendación e incógnita pendiente.
- No volver a proponer migrar `totem-web` a React; React es para el backoffice.
- No describir el backoffice como táctil: es para ordenador con ratón/teclado. El tótem es táctil.
- Mantener como referencia visual el 1080×1920 de `totem-web`.
- Recordar el modelo confirmado: base completa (header/hero/footer) administrable desde backoffice como contenido publicado; visualización canónica de `totem-web` no borrable; plantilla base con zona roja vacía/editable y resto anclado; primer nivel incrustado en el área roja; pantallas enlazadas de detalle a pantalla completa con la transición exacta de la web existente.
- Seguir incorporando nuevos requisitos antes de redactar una especificación final. No cerrar decisiones solo para hacer el documento más concreto.

