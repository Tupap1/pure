# Implementation Plan: Módulo de Ejecución

**Branch**: `001-modulo-ejecucion` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-modulo-ejecucion/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

El módulo registra lo que realmente se estudia, tomando como unidad la tanda de 10 minutos, y lo
convierte en tres cosas:

- un único disparador si-entonces visible en la pantalla Hoy;
- una evaluación diaria de hábitos sin deuda;
- un reporte semanal congelado que sale por correo.

Enfoque técnico (detalle en [research.md](./research.md)):

- **Datos**: tablas nuevas solo en Postgres, sin Dexie ni `/api/sync`. Todos los tiempos salen
  del reloj del servidor.
- **Lógica compartida**: las reglas viven en funciones TypeScript puras (`lib/domain/execution.ts`)
  y en servicios (`lib/execution/*`). Los consumen igual las herramientas MCP y las rutas API
  nuevas de la web.
- **Trabajos programados**: un `tick` idempotente dentro del proceso MCP congela y envía el
  reporte y manda los avisos. La cancelación y el bloqueo de tandas se derivan del estado, sin
  cron.
- **Móvil**: la web es una PWA instalable en el iPhone, detrás de Cloudflare Access, con Web Push
  solo para tres tipos de aviso.

## Technical Context

**Language/Version**: TypeScript 5.5 sobre Node 22 (Docker). Next.js 14.2 (App Router) + React 18
para la web; servidor MCP con `@modelcontextprotocol/sdk` 1.30.

**Primary Dependencies**: `pg`, `zod` 4, `@modelcontextprotocol/sdk`, `lucide-react` (existentes).
Nueva: `web-push`, para Web Push con VAPID. El correo sale por la API HTTP de ZeptoMail con
`fetch`, sin dependencia nueva. Los dos canales quedan detrás de las interfaces `Mailer` y
`Pusher`.

**Storage**: PostgreSQL 16 con migraciones `008`–`011`, todas solo-Postgres. En los tests se usa
pg-mem 3 vía `__tests__/helpers/test-db.ts`, que ejecuta las migraciones reales.

**Testing**: Vitest 2 con `environment: 'node'`.
- MCP y servicios contra pg-mem con `createTestDb()`.
- El tiempo se controla con `vi.setSystemTime`, que también mueve el `now()` del arnés.
- Correo y push se prueban con fakes de `Mailer` y `Pusher`.
- La lógica de UI va en funciones puras (modelos de vista).
- Test de trazabilidad spec ↔ tests (Principio II).

**Target Platform**:
- Docker Compose (`pure-web`, `pure-mcp`, `pure-db`) en el servidor de casa, expuesto por
  Cloudflare Tunnel.
- La web queda detrás de Cloudflare Access.
- Dispositivos: iPhone con iOS ≥ 16.4 como PWA instalada, más navegadores de escritorio.

**Project Type**: aplicación web (Next.js) + servidor MCP (Node), ambos en el mismo repositorio,
con `lib/` compartido.

**Performance Goals**:
- SC-001: de abrir la app a tener una tanda corriendo, menos de 3 s.
- SC-004: aviso de fin de tanda en ≤ 20 s. Por eso el tick corre cada 20 s.
- `get_today` responde en menos de 300 ms con el volumen de un usuario.

**Constraints**:
- SQL compatible con pg-mem: sin plpgsql, sin `AT TIME ZONE`, sin índices parciales.
- Zona horaria `PURE_TZ` (por defecto `America/Bogota`), resuelta en TypeScript.
- Ninguna ruta acepta tiempos del cliente.
- Las tandas requieren conexión. Hoy no existe un shell offline, y el service worker nuevo no
  cachea.
- Sin gamificación ni gráficas nuevas.
- Diseño portable: el tick se puede disparar desde fuera y el estado vive solo en Postgres.

**Scale/Scope**:
- 1 usuario, ~13 materias.
- ≤ 12 tandas/día y ≤ 84/semana.
- Programa de 10 semanas.
- 9 historias, 41 FR, 61 escenarios (59 automatizados y 2 manuales).
- 10 herramientas MCP nuevas (20 → 30).

**Observability**:
- Logs con prefijo `[execution-tick]` para congelar, enviar, reintentar y fallar.
- `weekly_reports.last_error` y `attempts` quedan visibles vía `manage_weekly_report read`.
- `get_compliance_report` sirve como vista de salud del hábito.

**Accessibility**:
- Objetivos táctiles de ≥ 44 px.
- El timer se anuncia con `aria-live="polite"` una vez por minuto, no por segundo.
- Contraste según `DESIGN.md`; el color nunca es la única señal (siempre va con texto).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Una sola vía de datos | Handlers únicos en `lib/execution/handlers.ts`: `mcp-server/tools-handler.ts` los re-exporta y `app/api/execution/*` los llama. Programa, hábitos, disparadores y destinatario entran por `manage_program`, `manage_routine_slots` y `manage_weekly_report`. Las migraciones solo crean estructura | PASS |
| II. Test-First | Override de tareas con TEST antes de IMPL. Matriz archivo ↔ escenario en [quickstart.md](./quickstart.md#matriz-de-pruebas). Placeholders `it.todo` + `spec-traceability.test.ts` en Foundational. Commits RED/GREEN por historia | PASS |
| III. Paridad pruebas/producción | SQL verificado en pg-mem (ver [research.md](./research.md) R-03, R-04). `running_lock TEXT UNIQUE` en lugar de índice parcial. TZ en `lib/execution/time.ts`. `started_at` siempre `new Date()` del servidor | PASS |
| IV. Verificación empírica | [quickstart.md](./quickstart.md): `/health`, llamadas MCP, UI a 375 px y escritorio, instalación en el iPhone, correo real y push real | PASS |
| V. Sobriedad y datos verificables | Hoy muestra un disparador, sin minutos, faltantes ni proyecciones (FR-018). `DESIGN.md`. Reparto normativo de 48 h/crédito con urgencia aparte (FR-036). Proyección como tabla escaneable (US8) | PASS |
| VI. Seguridad | Access antes de publicar el hostname (paso manual previo a US4). Lista blanca de acciones en la web. Correo del destinatario nunca en la web (FR-025). `ZEPTOMAIL_TOKEN` y `VAPID_*` solo en `.env`. try/catch en todas las rutas | PASS (depende del paso manual de Access) |

**Re-check post-diseño (tras data-model y contracts):** PASS. El diseño no introdujo plpgsql,
índices parciales, tiempos de cliente ni datos sembrados. Las decisiones con complejidad añadida
están justificadas en *Complexity Tracking*.

## Project Structure

### Documentation (this feature)

```text
specs/001-modulo-ejecucion/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones verificadas
├── data-model.md        # Fase 1: entidades, SQL 008–011, estados
├── quickstart.md        # Fase 1: validación de punta a punta + matriz de pruebas
├── contracts/
│   ├── mcp-tools.md     # 10 herramientas MCP: acciones, entradas, salidas y errores
│   ├── web-api.md       # Rutas /api/execution/* y /api/push/*
│   └── notifications.md # Avisos push y correo del reporte
├── checklists/
│   └── requirements.md  # Calidad de la spec (16/16)
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
db/migrations/
├── 008_execution_core.sql         # programa, hábitos, checks, disparadores, outcomes, ensayos, tareas, tandas
├── 009_weekly_reports.sql         # destinatario y reportes (US6)
├── 010_push.sql                   # suscripciones + marcas de aviso (US7)
└── 011_execution_planning.sql     # intenciones y aperturas del plan (US8–US9)

lib/
├── domain/
│   ├── execution.ts               # PURO: resolveCurrentTrigger, isHabitActive, evaluateDay,
│   │                              #   computeVerdict, computeAlerts
│   └── subject.ts                 # + normalizeDeliverableStatus, isGradedDeliverable, projectSubjectGrade
├── execution/
│   ├── constants.ts · time.ts     # constantes y zona horaria (PURE_TZ)
│   ├── handlers.ts                # handlers únicos que consumen MCP y web
│   ├── program.ts · tandas.ts · routine.ts · checks.ts · today.ts
│   ├── today-view.ts              # modelo de vista de Hoy (puro, testeable)
│   ├── compliance.ts · report.ts · tick.ts · mailer.ts   # US6
│   ├── push.ts                    # US7
│   └── planning.ts                # US8–US9
├── db/execution-pg.ts             # repositorio Postgres (pgPool)
├── validations/schemas.ts         # + sección "Módulo de Ejecución" (Zod estricto)
├── hooks/useToday.ts · usePushNotifications.ts
└── navigation.ts                  # 'hoy', HOME_TAB, flag mobile (FR-041)

mcp-server/
├── index.ts                       # TOOLS_LIST + mcpServer.tool(...) + scheduler en main()
└── tools-handler.ts               # re-export de lib/execution/handlers

app/
├── page.tsx · layout.tsx          # case 'hoy' / default; manifest y themeColor
├── manifest.ts · apple-icon.png   # US4
└── api/
    ├── execution/route.ts · execution/today/route.ts · execution/report/route.ts
    └── push/public-key/route.ts · push/subscribe/route.ts · push/test/route.ts

components/
├── dashboards/TodayDashboard.tsx  # US1–US3, más el bloque del domingo (US6)
├── dashboards/SundayPlanning.tsx · dashboards/WeekView.tsx   # US8–US9
├── dashboards/ConfigDashboard.tsx # sección Notificaciones (US7)
├── dashboards/DeliverablesDashboard.tsx   # alertas abandonada/ciega (US9)
├── layout/BottomNav.tsx · layout/Header.tsx   # FR-041
└── ui/SubjectEvaluation.tsx       # tabla de proyección (US8)

public/sw.js                       # push + notificationclick, sin caché (US7)
public/icons/icon-*.png            # íconos PWA 192/512/maskable, generados por scripts/generate-icons.js (US4)

__tests__/                         # según la matriz de quickstart.md
├── build/   domain/   db/   validations/   mcp/   api/
└── helpers/test-db.ts             # reset() con las tablas nuevas (hijas primero)
```

**Structure Decision**: se usa la estructura existente del repositorio (web Next.js + servidor
MCP con `lib/` compartido). No se crean proyectos nuevos. Las piezas nuevas siguen las
convenciones actuales:

- `lib/domain` para lógica pura;
- `lib/db` para repositorios sobre `pgPool`;
- `db/migrations` numeradas;
- `__tests__/` espejando el árbol de fuentes.

## Reglas de servicio por historia

- **US1 · Tandas** (`lib/execution/tandas.ts`)
  - `finalizeElapsed(now)` corre al inicio de toda operación. Cierra por tiempo con `actual =
    planned`, `ended_at = started_at + planned` y `running_lock = NULL`.
  - `start` hace `finalizeElapsed` y luego inserta con `running_lock = 'running'`. La violación
    de UNIQUE se traduce a `TANDA_EN_CURSO`. Fija `local_date` y `locked_at = 03:00 local del día
    siguiente`. Si viene de un disparador, registra el outcome `hecho` y hereda la materia.
  - `finish` exige transcurrido ≥ planeado − 30 s.
  - `interrupt` exige una razón (1–140) y guarda `actual = floor(transcurrido)`. Si la tanda ya
    terminó por tiempo, la devuelve sin cambios.
  - `update` solo actúa sobre tandas cerradas y solo en campos permitidos. Si `now > locked_at`,
    marca `edited_after_lock`.
- **US1 · Hoy** (`today.ts`, `today-view.ts`, `useToday`)
  - `getToday` devuelve `{ server_now, date, week, running_tanda, trigger, pending_checks,
    tandas_today, day_fulfilled }`.
  - El modelo de vista calcula `seconds_left` con el offset `server_now − Date.now()`.
  - `useToday` refresca al volver a primer plano (`visibilitychange`) y cada 30 s.
  - UI:
    - una línea de datos (`Lunes 14 sep · Semana 1 de 10`);
    - timer `mm:ss` en IBM Plex Mono;
    - botones según el tipo de disparador;
    - "Empezar tanda" siempre a un toque;
    - interrumpir abre un input de razón;
    - filas de checks sin responder;
    - pie "N tandas hoy · Día cumplido";
    - chips de materia al terminar;
    - error "No hay conexión con Pure" + [Reintentar].
- **FR-041 · Navegación**
  - `'hoy'` es el primer `DashboardTab` y `HOME_TAB` (vista inicial y fallback de `goBack`).
  - `mobile: false` en `config` y `BottomNav` filtra por ese flag. El estado activo va en gris
    sutil, no en cian.
  - Engranaje `md:hidden` en `Header`.
  - `app/page.tsx` agrega `case 'hoy'` y `default`.
- **US2 · Disparadores** (`lib/domain/execution.ts`, `routine.ts`)
  - Candidatos: activos, del día de la semana local y con paridad válida. La paridad se evalúa con
    `occursOnSabadoVariant` y `getSabadoTypeForDate` (ambos de `lib/algorithms/conflict-detector.ts`),
    usando el ancla de la universidad de la materia; si no hay, la primera universidad con
    alternancia; si no, `DEFAULT_SABADO_A_ANCHOR`.
  - Ancla: el `end_time` del horario para `tras_clase`; `anchor_time` en el resto.
  - Elegible si `ancla ≤ ahora ≤ ancla + 240 min` y no tiene outcome hoy. Gana el ancla más
    reciente.
  - Zod estricto: claves extra → `SOBRE_ESPECIFICACION`.
  - `tras_clase` copia el día y la periodicidad del horario.
  - `respond` sobre un slot de hábito fija el check.
  - `rehearse` es idempotente por semana.
- **US3 · Hábitos**
  - `isHabitActive` usa `started_on`, `retired_on` y `days_of_week`.
  - `evaluateDay` exige tandas ≥ mínimo y que cada hábito activo esté `cumplido` o `na`. Da
    `null` fuera del programa.
  - `setDailyCheck` es válido hasta las 03:00 del día siguiente.
  - `update_week` solo aplica a semanas futuras.
- **US4 · PWA**
  - `app/manifest.ts`: `standalone`, `#191919`, íconos 192/512 + maskable generados con
    `ImageResponse`.
  - En `layout.tsx` se quita `manifest:` y `themeColor` pasa a `#191919`.
- **US5 · Proyección**
  - "Calificado" = estado normalizado ≠ `pendiente` y `grade` numérico. Se aplica en
    `calculateWeightedGrade` y `calculateSubjectGradeProgress`; los tests actuales siguen verdes.
  - Nota necesaria = `ceil2((meta·100 − Σ nota·peso) / restante)`, calculada sobre `(pts*100)/peso`.
  - `techo = floor2(aporte + escala_max · restante/100)`.
  - Nunca se lee `subjects.current_grade`.
- **US6 · Reporte** — `runExecutionTick(now, { mailer, pusher })`:
  1. `finalizeElapsed`.
  2. Congela las semanas cuyo domingo 19:00 local ya pasó y no tienen reporte. Corte = ese
     instante; `note_deadline = max(corte, now) + 60 min`; `late` si aplica.
  3. Envía los reportes `congelado` con el plazo vencido mediante un claim atómico `UPDATE …
     WHERE status='congelado' RETURNING *`, con backoff de 10 min y como máximo 3 intentos; sin
     destinatario → `SIN_PARTNER`. Un reporte que lleva más de 15 min en `enviando` vuelve a
     `congelado`.

  En `main()`, si `EXECUTION_SCHEDULER=on`: un tick al arrancar y luego cada 20 s con
  `setInterval(...).unref()` y guardia anti-solapamiento.
- **US7 · Push**
  - `public/sw.js` maneja `push` (siempre `showNotification`) y `notificationclick`.
  - El tick hace push cuando `end_notified_at` o `freeze_notified_at` son nulos.
  - Un 404/410 borra la suscripción.
  - Configuración → Notificaciones muestra estos estados: no soportado / instalar en inicio /
    denegado / activar / activo + prueba.
- **US8–US9**:
  - Tabla de proyección en `SubjectEvaluation.tsx`.
  - Tareas en el hub.
  - Asistente del domingo en 4 pasos, con el reparto de `computeAcademicLoad`.
  - Vista semana con compuerta `plan_week open_view`.
  - Alertas en `DeliverablesDashboard.tsx`.

## Complexity Tracking

> No hay violaciones de la constitución. Estas decisiones añaden complejidad frente a la
> alternativa más simple y quedan justificadas aquí.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Columna `running_lock TEXT UNIQUE` junto a `status` | Garantizar en la base que haya como máximo una tanda en curso (FR-004) | El índice único parcial `ON tandas(status) WHERE status='en_curso'` rompe en pg-mem cualquier consulta `WHERE status='<otro>'` (verificado); los tests divergirían de producción |
| `tick` dentro del proceso MCP (`setInterval` en `main()`) | El reporte debe congelarse y enviarse aunque nadie abra la app (FR-019–FR-024), y el aviso de fin de tanda debe llegar en ≤ 20 s | No hay infraestructura de cron en el repo. `pg_cron` no viene en `postgres:16-alpine` y no corre en pg-mem. Un cron del sistema quedaría fuera del despliegue en Docker. El tick es idempotente y se puede disparar desde fuera cuando Pure migre |
| Rutas API nuevas (`/api/execution/*`) en lugar de ampliar `/api/sync` | Las tablas del módulo son solo-Postgres y necesitan el reloj del servidor en cada escritura | `/api/sync` replica escrituras local-first con horas del cliente (Dexie → cola → servidor), lo que contradice FR-002 y el Principio III |
