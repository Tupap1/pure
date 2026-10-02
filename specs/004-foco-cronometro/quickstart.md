# Quickstart — Foco: temporizador, cronómetro, objetivos y mapa de calor (004)

Guía para validar la feature de punta a punta (Constitución, Principio IV). La forma de cada
respuesta está en [contracts/mcp-tools.md](./contracts/mcp-tools.md) y
[contracts/web-api.md](./contracts/web-api.md). Las reglas están en [data-model.md](./data-model.md).

## Requisitos

- Rama `004-foco-cronometro` con `npm run test:all` en verde.
- En local:
  - Postgres con `DATABASE_URL`;
  - `npm run db:migrate` aplica la `015` y la `016`;
  - `npm run mcp:start:http` y `curl http://localhost:3001/health` responde;
  - `npm run dev` para la web, abierta desde el panel del navegador.
- En producción:
  - `docker compose up -d --build pure-web pure-mcp`;
  - `docker compose exec pure-mcp npm run db:migrate`. Es obligatorio, porque `pure-mcp` no migra
    solo.

## Matriz de pruebas

| Archivo de test | Cubre |
|---|---|
| `__tests__/db/execution-schema-foco.test.ts` | Migraciones 015/016: columnas, CHECK seguro frente a NULL, UNIQUE de `active_name_key`, CHECK de corrección |
| `__tests__/domain/focus.test.ts` | US-F1-AS6, US-F2-AS4..AS7 (`countsTowardMinimum`/`tallyDay`), US-F3-AS6, US-F5-AS3 (`quoteOfDay`) |
| `__tests__/domain/execution-time.test.ts` | US-F1-AS10 (`splitByLocalDay`, piso acumulado) |
| `__tests__/domain/focus-heatmap.test.ts` | US-F3-AS8 (rejilla, días futuros vacíos) |
| `__tests__/domain/today-view.test.ts` | US-F1-AS8, US-F1-AS9, US-F2-AS9, US-F5-AS7, US-T1-AS11 reescrito |
| `__tests__/mcp/execution-foco-sesiones.test.ts` | US-F1-AS1..AS5, AS7, AS10, AS11 |
| `__tests__/mcp/execution-foco-objetivos.test.ts` | US-F2-AS1..AS3, AS8, AS10, AS11 |
| `__tests__/mcp/execution-foco-resumen.test.ts` | US-F3-AS1..AS5, AS7, AS9, AS11 |
| `__tests__/mcp/execution-foco-correccion.test.ts` | US-F4-AS1..AS9 |
| `__tests__/mcp/execution-foco-frases.test.ts` | US-F5-AS1, AS2, AS4..AS6 |
| `__tests__/mcp/execution-tandas-variables.test.ts` | US-T1-AS3 reescrito (61 ahora válido; 181 rechazado) |
| `__tests__/mcp/all-tools.test.ts` | Catálogo con `manage_objectives`, `get_focus_summary` y `manage_quotes` |
| `__tests__/build/spec-traceability.test.ts` | Entrada 004: 48 escenarios no manuales |

## Validación local por historia

Las llamadas MCP van por el conector (Claude Code o Claude Web), o con `curl` contra
`POST http://localhost:3001/mcp` con el bearer de `.env`. El valor del token nunca se pega en la
conversación ni en un archivo.

### US-F2 (objetivos) — primero, porque F1 los usa

1. `manage_objectives:create { name: "LeetCode", weekly_target_minutes: 300 }` → objetivo activo.
2. Repetir con `name: " leetcode "` → `OBJETIVO_DUPLICADO`.
3. `manage_objectives:create { name: "Algoritmos", subject_id: <una materia de Software> }`.

### US-F1 (sesiones)

1. `manage_tandas:start { kind: "cronometro", objective_id: <LeetCode> }` → `ends_at: null`.
2. `manage_tandas:current` → `seconds_left: null` y `elapsed_seconds` que crece.
3. A los 30 s, `finish` → `CRONOMETRO_MUY_CORTO`. Pasado 1 minuto, `finish` → `completada` con 1
   minuto.
4. `get_today` → `unidades_hoy` no sube (LeetCode no tiene materia) y `foco_semana_minutos` sí.
5. En la web (375 px y escritorio):
   - el temporizador ofrece 10/25/40/60 + campo libre (probar 45 y 181);
   - el cronómetro cuenta hacia arriba en `h:mm:ss`;
   - el selector lista "Sin objetivo", los objetivos y luego las materias;
   - no hay errores de consola.

### US-F3 (resumen y mapa)

1. `get_focus_summary {}` → 364 o más días con 0 explícito, `total_semana` igual al de `get_today`.
2. `GET /api/execution/focus` → la misma respuesta (US-F3-AS9).
3. Hoy muestra el total de la semana y el mapa de 12 semanas, **sin** meta ni "te faltan".
4. Command Center muestra el mapa de 52 semanas en lugar del de 28 días:
   - el filtro por objetivo funciona;
   - la tabla muestra "LeetCode · 1 min · 5 h";
   - a 375 px el mapa se desplaza horizontalmente sin desbordar la página (US-F3-AS10, manual).

### US-F4 (corrección)

1. `start { kind: "cronometro" }` y esperar 3 minutos.
2. `manage_tandas:correct { id, ended_at: <inicio + 1 min>, reason: "prueba" }` → `completada`, 1
   minuto, `corrected: true`, `original_minutes: 3`.
3. Repetir con un `ended_at` posterior → `CORRECCION_INVALIDA`.
4. `POST /api/execution { tool: "manage_tandas", action: "correct" }` → 400, rechazada por la lista
   blanca.
5. `get_compliance_report` de esta semana → `correcciones: { total: 1, minutos_recortados: 2 }`.

### US-F5 (frase del día)

1. `manage_quotes:create_many` con el contenido de [frases.json](./frases.json) →
   `{ creadas: 50, omitidas: 0 }`.
2. Repetir → `{ creadas: 0, omitidas: 50 }`.
3. `get_today` dos veces → la misma `frase_del_dia`.
4. Hoy muestra el latín en cursiva y debajo "traducción · fuente", sin icono ni color.
5. `POST /api/execution { tool: "manage_quotes", action: "create" }` → 400.

## Después de validar

- Borrar las sesiones y los objetivos de prueba que se crearon en local. En producción, la única
  carga real es la de las 50 frases y los objetivos que Andres quiera tener.
- Comprobar que el mapa de Command Center muestra el historial de tandas previo a la feature: las
  tandas viejas son temporizadores sin objetivo.
