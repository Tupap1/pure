# Research — Módulo de Ejecución

Decisiones de la Fase 0. Salen del documento de diseño de origen, verificado contra el código y
las pruebas del repositorio el 2026-09-11. No quedan `NEEDS CLARIFICATION`.

## R-01 · Numeración de migraciones

- **Decisión**: las migraciones nuevas son `008`–`011`.
- **Razón**: ya existen `001`–`007`, y `scripts/migrate.ts` versiona por el prefijo numérico del
  archivo.
- **Alternativas consideradas**: la numeración `001`–`008` del documento de origen. Chocaría con
  la tabla `schema_migrations`.

## R-02 · Convención de días de la semana

- **Decisión**: `day_of_week` va de 1 = lunes a 7 = domingo en todo el módulo.
- **Razón**: `schedules` usa 1–7 (`db/schema.sql:48`, `lib/validations/schemas.ts:58`), y los
  disparadores "al salir de clase" heredan el día del horario.
- **Alternativas consideradas**: 0 = domingo, como decía el documento de origen. Contradice el
  esquema real.

## R-03 · Lógica en TypeScript, no en SQL

- **Decisión**: SQL plano. La zona horaria, los cierres, la integridad y los agregados se
  implementan en TypeScript (`lib/execution/`, `lib/domain/execution.ts`).
- **Razón**: el arnés de tests ejecuta las migraciones reales sobre pg-mem, y se verificó en
  memoria que pg-mem no soporta plpgsql ni `AT TIME ZONE`. Además, en Postgres real
  `date(timestamptz)` usa la zona del contenedor (UTC): una tanda a las 20:00 de Bogotá caería al
  día siguiente.
- **Alternativas consideradas**: triggers, vistas con `generate_series` y columnas generadas con
  `AT TIME ZONE`. O rompen la suite o fallan en silencio por la zona del contenedor.

## R-04 · Unicidad de la tanda en curso

- **Decisión**: una columna `running_lock TEXT UNIQUE`, con `'running'` mientras la tanda está en
  curso y `NULL` al cerrarse. Además, índices normales sobre `status`.
- **Razón**: se verificó que en pg-mem un índice único parcial sobre `status` hace que
  `WHERE status='<otro valor>'` no encuentre filas; un UPDATE de "claim" quedó sin efecto. La
  columna nula única sí funciona: admite varios NULL y rechaza un segundo `'running'`.
- **Alternativas consideradas**: el índice único parcial (bug de pg-mem), o validar solo en el
  servicio (no protege ante dos inicios simultáneos).

## R-05 · Datos del programa por MCP, no en migraciones

- **Decisión**: las migraciones solo crean estructura. Semanas, hábitos, disparadores y
  destinatario se cargan con `manage_program`, `manage_routine_slots` y `manage_weekly_report`.
- **Razón**: la regla de datos de `CLAUDE.md` y el Principio I. Además, fechas personales dentro
  de una migración harían el esquema no reutilizable.
- **Alternativas consideradas**: los `INSERT` de semilla que traía el documento de origen.

## R-06 · Trabajos programados

- **Decisión**: el cierre de tandas por tiempo y el bloqueo de las 03:00 se **derivan** del estado
  en cada operación, sin cron. El reporte y los avisos corren en `runExecutionTick(now)`, que es
  idempotente y se ejecuta dentro de `main()` del MCP cada 20 s cuando `EXECUTION_SCHEDULER=on`.
- **Razón**: no hay infraestructura de cron. El proceso MCP es persistente (`mcp-server/index.ts:985`)
  y ya tiene un precedente de `setInterval().unref()` (`mcp-server/oauth-store.ts:55`). Como el
  tick es idempotente, se puede disparar desde fuera cuando Pure migre.
- **Alternativas consideradas**: `pg_cron` (no está en `postgres:16-alpine`), cron del sistema
  (fuera del despliegue) y timers en memoria por tanda (se pierden al reiniciar).

## R-07 · Proyección de notas en TypeScript

- **Decisión**: una sola función `projectSubjectGrade` en `lib/domain/subject.ts`, reutilizada por
  la UI, el reporte y la herramienta MCP.
- **Razón**: `calculateWeightedGrade` y `calculateRequiredGradeForRemaining` ya existen y los usan
  cuatro componentes. Una vista SQL duplicaría la fórmula.
- **Alternativas consideradas**: la vista `v_proyeccion_nota` del documento de origen.

## R-08 · Clases en `schedules`, no en disparadores

- **Decisión**: los disparadores solo guardan planes propios. "Al salir de clase" referencia
  `schedule_id` y hereda día y paridad.
- **Razón**: las clases ya viven en `schedules`, con periodicidad sábado A/B.
- **Alternativas consideradas**: `routine_slots.kind='clase'` con `is_locked`, que duplicaría el
  horario.

## R-09 · Actividad de hábitos por fechas

- **Decisión**: un hábito está activo según `started_on`, `retired_on` y `days_of_week`. El mínimo
  de tandas sale de la semana del programa.
- **Razón**: `habits_activos[]` en cada semana repetía la información de `habit_instances`, y
  `tandas_minimas` no es un hábito que se marque sino una condición calculada.
- **Alternativas consideradas**: el arreglo de hábitos por semana del documento de origen.

## R-10 · Hora de referencia obligatoria

- **Decisión**: todo disparador lleva `anchor_time`, salvo `tras_clase`, que la deriva del fin de
  la clase.
- **Razón**: las señales "tras hábito" y "lugar" no se pueden detectar (no hay geolocalización), y
  sin una hora no se puede elegir cuál mostrar.
- **Alternativas consideradas**: detección por geolocalización o por eventos, que queda fuera de
  alcance.

## R-11 · Estado heredado `completado`

- **Decisión**: se tolera en lectura. En el dominio, `completado` equivale a `entregado`, y
  "calificado" significa que tiene nota y no está pendiente. La escritura no se toca.
- **Razón**: el enum real es `pendiente|entregado|calificado`, pero el MCP guarda lo que llega. En
  la base hay datos `completado`, y `__tests__/mcp/mcp-crud-tools.test.ts:221` fija ese
  comportamiento.
- **Alternativas consideradas**: normalizar al escribir, que rompería ese test y el contrato
  vigente.

## R-12 · Lo que queda fuera

- **Decisión**: sin tabla de fricción del teléfono y sin marcadores de "nuevo comienzo".
- **Razón**: la única medida de fricción inicial ya es el hábito `celular_afuera`, y ninguna regla
  consume los marcadores. El reinicio del lunes sale del cálculo de semana.
- **Alternativas consideradas**: `phone_friction_measures` con un trigger de irritación y
  `fresh_start_markers`.

## R-13 · Superficie MCP

- **Decisión**: 10 herramientas agrupadas con el patrón `manage_*` + `action` (ver
  [contracts/mcp-tools.md](./contracts/mcp-tools.md)).
- **Razón**: es el patrón del repositorio, y 14 herramientas sueltas dispersan la elección del
  agente.
- **Alternativas consideradas**: las 14 herramientas del documento de origen.

## R-14 · Persistencia autoritativa en el servidor

- **Decisión**: tablas solo en Postgres, sin Dexie ni `/api/sync`. La web lee y escribe por rutas
  API nuevas que llaman a los mismos handlers que el MCP.
- **Razón**: la integridad (FR-002, FR-004 y FR-007) exige el reloj del servidor. Hoy no existe un
  shell offline (no hay service worker), así que exigir conexión no quita nada que exista.
- **Alternativas consideradas**: el camino local-first con horas del cliente.

## R-15 · Estados de la tanda

- **Decisión**: `en_curso | completada | interrumpida`.
- **Razón**: con el cierre por tiempo no quedan tandas zombi, así que `abandonada` no tiene uso.
- **Alternativas consideradas**: los cuatro estados del documento de origen.

## R-16 · Redondeo de la nota necesaria

- **Decisión**: la nota necesaria se redondea hacia arriba, calculada como `(puntos*100)/peso`. El
  techo se redondea hacia abajo.
- **Razón**: `(266/80)*100` da 332.4999… en punto flotante y el cálculo actual devuelve 3.32
  cuando la cifra real es 3.325. Redondear la necesaria hacia arriba nunca promete menos de lo
  requerido.
- **Alternativas consideradas**: `Math.round(x*100)/100`, el comportamiento actual.

## R-17 · Canal del reporte

- **Decisión**: correo por SMTP desde el buzón de Zoho Mail de Andres, con `nodemailer` detrás de
  la interfaz `Mailer`.
- **Razón**: las respuestas del destinatario le llegan a Andres, sin cuentas nuevas. Si Pure migra
  a un runtime sin SMTP, solo cambia `mailer.ts` (por ejemplo, a una API HTTP de correo).
- **Alternativas consideradas**:
  - un proveedor transaccional (el remitente no sería su buzón);
  - la API de WhatsApp de Meta (verificación de negocio y plantillas aprobadas: días de trámite);
  - un bot de Telegram;
  - envío manual (lo reduce a monitoreo privado).

## R-18 · Pure en el iPhone

- **Decisión**: PWA instalada desde Safari, con Web Push (VAPID) y Cloudflare Access delante.
- **Razón**: no requiere App Store ni cuenta de desarrollador. iOS ≥ 16.4 entrega avisos nativos a
  las apps instaladas.
- **Alternativas consideradas**:
  - app nativa por TestFlight (USD 99/año y rebuild cada 90 días);
  - puentes ntfy o Pushover (el aviso no sería de Pure);
  - solo correo (sin aviso de fin de tanda).

## R-19 · Cierre de la tanda por tiempo

- **Decisión**: la tanda se completa sola al cumplirse su duración aunque la app esté cerrada. Solo
  cortarla antes requiere un acto explícito (interrumpir, con razón).
- **Razón**: exigir la app visible obligaría a tener el teléfono al lado, lo que contradice el
  hábito "celular afuera". El sistema no puede verificar que se estudió; lo que sí delata son las
  ediciones tardías.
- **Alternativas consideradas**: interrumpir al detectar que la página pasó a segundo plano. En
  iOS eso ocurre también al bloquear la pantalla.

## R-20 · Método de trabajo

- **Decisión**: Spec Kit v1.0.6 con scripts en Python y TDD obligatorio mediante la constitución y
  un override de `tasks-template`.
- **Razón**: es la elección de Andres. Los scripts en Python funcionan igual en Windows y en un
  servidor futuro. La plantilla de tareas del paquete marca los tests como opcionales.
- **Alternativas consideradas**: OpenSpec, el formato de Kiro y la convención suelta de
  `docs/requirements`.
