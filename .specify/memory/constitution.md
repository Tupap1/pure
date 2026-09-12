# Constitución de PURE OS

## Principios fundamentales

### I. Una sola vía de datos

- Cada regla de negocio sobre datos académicos DEBE tener una sola implementación, compartida
  por la web y el servidor MCP. Los handlers de las herramientas MCP y las rutas API de la web
  DEBEN delegar en las mismas funciones de `lib/` (repositorios y servicios) y NO DEBEN
  duplicarlas.
- Los datos que aportan agentes o fuentes externas DEBEN entrar por las herramientas MCP:
  matrícula, temarios, entregas, programa de ejecución, hábitos, disparadores y destinatario del
  reporte. NO DEBEN sembrarse en componentes de UI, helpers de base de datos ni migraciones; las
  migraciones solo crean estructura.
- La UI local-first de las entidades núcleo conserva su camino Dexie → cola de sync →
  `/api/sync`. Las entidades solo-Postgres se operan con los mismos handlers que exponen las
  herramientas MCP.

Razón: el agente (Claude Web) y la app operan los mismos datos. Dos implementaciones de una
regla terminan divergiendo en silencio.

### II. Test-First (NO NEGOCIABLE)

- TDD obligatorio. Los tests se escriben a partir de los escenarios de aceptación de
  `spec.md`, que Andres aprueba al aprobar la spec. Luego se ejecutan y DEBEN fallar por la
  razón esperada (RED verificado; un import roto no cuenta). Después va la implementación mínima
  (GREEN) y al final el refactor, con los tests en verde.
- En `tasks.md`, toda tarea de implementación DEBE tener antes su tarea de test. Ninguna
  historia se implementa sin sus tests en rojo.
- Cada escenario no manual DEBE tener un test automatizado nombrado por su ID (`USn-ASm`). Un
  test de trazabilidad DEBE verificar dos cosas: que ningún escenario de la spec quede sin test y
  que ningún test cite un escenario inexistente.
- La lógica de UI DEBE extraerse a funciones puras testeables en el entorno `node` de Vitest.
  El componente se verifica según el Principio IV.
- En la rama de la feature se admite un commit con tests en rojo como evidencia de TDD. `main`
  solo recibe código con `npm run test:all` en verde.

Razón: los escenarios aprobados son el contrato. Escribir la prueba primero impide que la
implementación defina su propia vara de medir.

### III. Paridad pruebas/producción

- Toda migración DEBE ejecutarse sin errores sobre pg-mem, porque el arnés de tests
  (`__tests__/helpers/test-db.ts`) corre las migraciones reales. En SQL quedan prohibidos:
  - funciones y triggers plpgsql;
  - `AT TIME ZONE`;
  - índices únicos parciales (pg-mem los aplica mal a predicados que no cubren).

  Las unicidades condicionales se modelan con una columna nula + `UNIQUE`.
- La zona horaria (`PURE_TZ`, por defecto `America/Bogota`), las reglas de negocio y los
  agregados DEBEN vivir en TypeScript.
- Todo instante registrado DEBE salir del reloj del servidor. Ninguna ruta ni herramienta
  acepta marcas de tiempo del cliente para hechos de ejecución.

Razón: si los tests corren sobre un motor que acepta algo distinto a producción, el verde no
prueba nada.

### IV. Verificación empírica

- Antes de declarar una tarea o historia terminada, además de `npm run test:all`, DEBE
  comprobarse el sistema en ejecución:
  - el `/health` del servidor MCP y llamadas reales a las herramientas tocadas;
  - la UI tocada en el navegador, en móvil (375 px) y en escritorio, sin errores de consola;
  - el `quickstart.md` de la feature.

Razón: los tests no cubren el transporte HTTP/MCP ni el render. `CLAUDE.md` exige verificar el
endpoint en ejecución.

### V. Sobriedad y datos verificables

- La UI DEBE seguir `DESIGN.md`: estética editorial tipo Notion, sin neón ni glow, iconos
  monocromos sin cajitas tintadas y tipografía monoespaciada solo para cifras.
- NO DEBE haber gamificación (puntos, insignias, rachas largas, confeti) ni elementos
  decorativos. Cada elemento en pantalla muestra un dato o dispara una acción (`PRODUCT.md`).
- Las métricas de carga académica DEBEN derivarse de la norma colombiana de créditos (Decreto
  1075 de 2015: 48 h por crédito por semestre) y mostrarse con su desglose. Los ajustes
  personales se muestran aparte, nunca fundidos con la cifra normativa.
- Los cálculos DEBEN presentarse como datos escaneables (tablas, cifras), no como prosa con
  números en negrita.

Razón: Pure es una herramienta que se opera a diario, no un documento que se lee. El ruido
visual compite con el estudio que la app debe servir.

### VI. Seguridad

- Los secretos DEBEN vivir solo en `.env` (ignorado por git) o en variables del entorno de
  despliegue. Nunca en código, migraciones, artefactos de Spec Kit ni documentación.
- Los cambios de autenticación DEBEN tratarse como sensibles: comparación en tiempo constante y
  protección contra replay.
- Nada DEBE publicarse en internet sin autenticación delante (por ejemplo, Cloudflare Access
  para la web). Los datos de terceros, como el correo del destinatario del reporte, NO DEBEN
  exponerse por rutas web.
- Toda ruta API DEBE envolver su lógica en try/catch y responder los errores sin filtrar
  detalles internos.

Razón: las rutas API de la web no tienen autenticación propia. La protección está en no
exponerlas y en no guardar secretos donde puedan viajar.

## Restricciones técnicas

- **Stack**: Next.js 14 (App Router), React 18 y TypeScript 5. PostgreSQL 16 es la fuente de
  verdad del servidor MCP; Dexie (IndexedDB) sirve la UI local-first; Zod valida; los tests usan
  Vitest + pg-mem (`environment: 'node'`).
- **Convenciones de datos**:
  - `id TEXT PRIMARY KEY`;
  - fechas de día como `TEXT 'YYYY-MM-DD'` y horas como `TEXT 'HH:MM'`;
  - `created_at TIMESTAMPTZ DEFAULT NOW()`;
  - upserts con `ON CONFLICT (id)`;
  - enums validados en Zod;
  - `day_of_week` 1 = lunes … 7 = domingo.
- **Entidades en ambos esquemas**: Dexie ↔ Postgres ↔ Zod DEBEN mantenerse alineados
  (`__tests__/build/schema-type-consistency.test.ts`).
- **Migraciones**: `db/migrations/NNN_nombre.sql`, con numeración secuencial. El contenedor
  `pure-mcp` no ejecuta migraciones por sí solo: tras desplegar se corre
  `docker compose exec pure-mcp npm run db:migrate`.
- **Portabilidad**: los trabajos programados son funciones idempotentes, invocables desde el
  propio proceso o desde un disparador externo. El estado vive solo en Postgres. Los canales de
  salida (correo, push) quedan detrás de interfaces pequeñas, para poder migrar Pure a hosting
  gratuito sin rediseñar.
- **Spec Kit en Windows**: los scripts se ejecutan con `PYTHONUTF8=1`, porque la consola cp1252
  no codifica los caracteres de las plantillas.

## Flujo de trabajo

- **Roles**: Claude planea y audita. Redacta y mantiene los artefactos de Spec Kit
  (constitución, spec, plan, tasks, checklists) y verifica el resultado. Otro agente implementa
  siguiendo `tasks.md`.
- **Ramas y artefactos**: una rama por feature con el formato `NNN-nombre` (por ejemplo,
  `001-modulo-ejecucion`); sus artefactos van en `specs/NNN-nombre/`.
- **Orden**: constitution → specify → clarify → plan → tasks → analyze → checklist → implement
  → converge. `implement` no arranca con checklists sin marcar.
- **Aprobación**: Andres aprueba `spec.md` antes de implementar, porque sus escenarios son los
  tests (Principio II).
- **Commits**: en español, con un cuerpo que explique el porqué. Sin trailer `Co-Authored-By`
  ni pie "Generated with Claude Code". En la rama se admite un commit RED (`test(NNN): …`)
  seguido de su GREEN (`feat(NNN): …`).

## Gobernanza

- Esta constitución prevalece sobre cualquier otra práctica o documento del repositorio. Ante
  un conflicto, se enmienda la constitución o se corrige el documento.
- **Enmiendas**: se registran en este archivo con versión semántica, fecha y motivo.
  - MAJOR: se elimina o redefine un principio.
  - MINOR: se agrega un principio o una sección, o se amplía materialmente la guía.
  - PATCH: aclaraciones y cambios de redacción.
- **Cumplimiento**: el "Constitution Check" de cada `plan.md`, `/speckit-analyze` y la auditoría
  final verifican cada principio. Toda desviación justificada se registra en "Complexity
  Tracking" del plan, junto con la alternativa descartada.
- La guía operativa del día a día está en `CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-11
