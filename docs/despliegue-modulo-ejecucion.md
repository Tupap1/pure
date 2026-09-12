# Despliegue del Módulo de Ejecución en el servidor

Encargo para el agente que trabaja en el servidor donde vive PURE OS. Está escrito para que se
pueda ejecutar sin haber visto la conversación en la que se construyó la feature.

## Qué se está desplegando

La rama `001-modulo-ejecucion` agrega el Módulo de Ejecución: la tanda de 10 minutos, un solo
disparador vigente por momento, hábitos con "día cumplido", proyección de nota por materia, el
reporte semanal congelado que sale por correo, los avisos push y la planeación del domingo.

Son 66 commits, 4 migraciones nuevas (`008`–`011`), 10 herramientas MCP nuevas (el catálogo pasa de
20 a 30) y 415 tests. Todo se construyó con TDD: cada historia tiene un commit en rojo antes de su
implementación.

En la máquina de desarrollo el stack ya se levantó y se verificó de punta a punta. Este documento
recoge los tropiezos reales de ese despliegue para que no se repitan aquí.

## 0. Requisito previo

La rama tiene que estar en GitHub. Si `git fetch origin 001-modulo-ejecucion` no la encuentra,
Andres todavía no la ha subido y no se puede continuar.

```bash
git fetch origin
git checkout 001-modulo-ejecucion
git pull
```

## 1. Variables de entorno

Agregar al `.env` del servidor. **`.env` está en `.gitignore` y así debe seguir.**

```bash
PURE_TZ=America/Bogota
EXECUTION_SCHEDULER=on
REPORT_OWNER_NAME=Andrés
PUBLIC_WEB_URL=https://pure.btw-one.com

# ZeptoMail (API HTTP, no SMTP)
ZEPTOMAIL_TOKEN=          # <-- lo pega Andres desde el panel de ZeptoMail
ZEPTOMAIL_URL=https://api.zeptomail.com/v1.1/email
REPORT_FROM=pedidos@btw-one.com
REPORT_FROM_NAME=Pure
REPORT_REPLY_TO=andresdavidcantillo@gmail.com

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:andresdavidcantillo@gmail.com
```

Sobre cada una:

- **`ZEPTOMAIL_TOKEN`**: es el "Send Mail token" del Mail Agent, **sin** el prefijo
  `Zoho-enczapikey ` (el código lo antepone). Sin él, el reporte queda en estado `fallido` con su
  mensaje de error, pero el tick no se cae.
- **`REPORT_FROM`** tiene que ser una dirección del dominio verificado en ZeptoMail. Si
  `pure@btw-one.com` está habilitada en el panel, es mejor que `pedidos@btw-one.com`, que es la
  dirección de otra línea de negocio.
- **`REPORT_REPLY_TO`** es obligatoria: el usuario de ZeptoMail es una llave de API y no un buzón,
  así que sin ella las respuestas al reporte se pierden.
- **`VAPID_*`**: si el servidor no las tiene, generarlas con
  `node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"` y pegarlas.
  Sin ellas el push queda desactivado con un `warn`, sin romper nada.
- **`EXECUTION_SCHEDULER=on`** solo aplica al servicio `pure-mcp`, que es el que corre el tick cada
  20 segundos. `docker-compose.yml` ya lo pone por defecto.

## 2. Despliegue

```bash
docker compose up -d --build pure-web pure-mcp
docker compose exec pure-mcp npm run db:migrate
```

El segundo comando no es opcional: **el contenedor `pure-mcp` no corre migraciones al arrancar**,
solo lo hace la imagen web. Si se olvida, las tablas nuevas no existen y el almacén de OAuth
degrada a memoria en silencio.

## 3. Tres trampas que ya costaron tiempo

**`npm ci` y el lock file.** El `package-lock.json` de la rama ya viene regenerado desde un
contenedor `node:22-alpine`, porque el que había estaba generado en Windows y a `npm ci` le
faltaban dependencias opcionales de Linux (`@emnapi/core`, `@emnapi/runtime`). **No regenerar el
lock desde Windows.** Si `npm ci` vuelve a fallar por desincronización, regenerarlo así:

```bash
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm install --package-lock-only
```

**El usuario y la contraseña de Postgres.** El síntoma es que `GET /health` del MCP responde
`"status": "degraded"` con `"connected": false`. `docker-compose.yml` arma el `DATABASE_URL` del
contenedor a partir de `POSTGRES_USER` y `POSTGRES_PASSWORD`, así que si esas dos no coinciden con
el rol real de la base, el MCP no conecta aunque el `DATABASE_URL` del `.env` sí funcione desde el
host. Verificar que coincidan antes de dar el despliegue por bueno.

**`pg_hba` miente en las pruebas locales.** La imagen de Postgres trae
`host all all 127.0.0.1/32 trust`, así que un `psql -h 127.0.0.1` **dentro** del contenedor entra
con cualquier contraseña, incluso una falsa. No sirve para validar credenciales. La prueba honesta
es conectarse desde otro contenedor de la red o desde el host.

## 4. Cloudflare, en este orden

1. **Primero** crear la aplicación de Cloudflare Access para `pure.btw-one.com`, con política de
   correo de Andres y sesión de 30 días.
2. **Después** crear el hostname del túnel apuntando a `pure-web:3000`.

El orden importa y no es una formalidad: las rutas nuevas bajo `/api/execution` **no tienen
autenticación propia**. Access es la única barrera. Si el hostname sale al aire antes que Access,
cualquiera con la URL puede empezar tandas, responder hábitos y leer el reporte.

`mcp.btw-one.com` queda **fuera** de Access, porque usa su propio OAuth para el conector de Claude
Web.

## 5. Sembrar los datos

Solo si la base del servidor no los tiene ya. El repositorio incluye
`scripts/seed-execution.mjs`, que crea el programa de 10 semanas desde el lunes 14 de septiembre de
2026, los hábitos `levantada_0600` y `celular_afuera`, y registra a Andres como destinatario del
reporte:

```bash
node scripts/seed-execution.mjs
```

Los datos entran **solo por herramientas MCP**, nunca por SQL directo: es una regla del proyecto
(`CLAUDE.md` y el Principio I de `.specify/memory/constitution.md`).

Falta sembrar los tres disparadores de la primera semana, que dependen de las materias y horarios
reales y por eso no están en el script.

## 6. Verificación

```bash
curl http://localhost:3001/health
```

Esperado: `"status": "ok"` y `"connected": true`. Si dice `degraded`, volver al punto 3.

Después, con el bearer `MCP_API_KEY`, comprobar que `tools/list` devuelve **30** herramientas e
incluye `manage_tandas`, `manage_daily_checks`, `manage_program`, `manage_routine_slots`,
`get_today`, `get_compliance_report`, `get_grade_projection`, `manage_weekly_report`,
`manage_tasks` y `plan_week`.

En el navegador, contra la URL pública y ya con Access delante:

- Hoy es la primera pantalla y "Empezar tanda" arranca la tanda de un toque.
- Recargar la página no reinicia el conteo: el tiempo sale del reloj del servidor.
- Interrumpir sin escribir una razón se rechaza.
- La barra inferior en móvil **no** tiene Configuración; la abre el engranaje del encabezado.

Para el correo, una vez esté el token: `manage_weekly_report` con la acción `run_tick` fuerza un
ciclo completo. Es idempotente, así que repetirla no reenvía. Revisar además el panel de ZeptoMail:
el envío tiene que aparecer entregado, no rebotado.

## 7. Advertencias

- **Los datos académicos viven en el navegador.** En la máquina de desarrollo, Postgres tenía cero
  universidades, materias, horarios y entregas: la aplicación es local-first y esos datos están en
  el IndexedDB del navegador de Andres, que los sube por `/api/sync`. El reporte semanal y la
  proyección de nota **leen de Postgres**, así que hasta que esa sincronización ocurra, la sección
  "En riesgo" del reporte saldrá vacía. Conviene que Andres abra Pure desde su navegador de siempre
  antes del primer domingo.
- **No commitear el `.env`** ni ningún token. Si algún secreto entra a un commit, hay que rotarlo.
- **No tocar `db/schema.sql`**: es una foto del esquema, no el origen. Los cambios van en
  `db/migrations/`.
- Hay un bug de `next/og` que rompe la generación de íconos **solo en Windows** (`path.join` mete
  barras invertidas en una URL `file://`). En Linux no aplica, así que `app/icons/[size]/route.tsx`
  funciona bien en el servidor.
- Antes de dar cualquier cambio por terminado: `npm run test:all`, que ahora incluye el lint además
  del typecheck y los tests. La build de producción falla con errores de lint, así que saltárselo
  rompe el despliegue.
