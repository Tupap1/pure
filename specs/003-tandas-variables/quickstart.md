# Quickstart — Tandas de duración variable y registro tardío (003)

Guía para validar la feature de punta a punta (Constitución, Principio IV). La forma de cada
respuesta está en [contracts/mcp-tools.md](./contracts/mcp-tools.md) y las reglas en
[data-model.md](./data-model.md).

## Requisitos

- Rama `003-tandas-variables` con `npm run test:all` en verde.
- En local: el servidor MCP levantado con `npm run mcp:start:http` y `curl http://localhost:3001/health`
  respondiendo.
- En producción:
  - desplegar con `docker compose up -d --build pure-web pure-mcp`;
  - aplicar las migraciones `013` y `014` con `docker compose exec pure-mcp npm run db:migrate`
    (el contenedor `pure-mcp` no corre migraciones por sí solo; este paso es obligatorio).

## Matriz de pruebas

| Archivo de test | Cubre | Historia |
|---|---|---|
| `__tests__/domain/today-view.test.ts` | US-T3-AS1, AS2, AS3 (funciones puras para pantalla) | US-T3 |
| `__tests__/mcp/execution-tandas-start-log.test.ts` | US-T3-AS4 (log del servidor) | US-T3 |
| `__tests__/mcp/execution-tandas-variables.test.ts` | US-T1-AS1, AS2, AS3, AS5, AS6, AS7, AS8 (rango, unidades, base) | US-T1 |
| `__tests__/domain/execution-day.test.ts` | US-T1-AS4 (fórmula de unidades) | US-T1 |
| `__tests__/mcp/execution-push.test.ts` | US-T1-AS9 (aviso de fin de tanda con duración real) | US-T1 |
| `__tests__/domain/today-view.test.ts` | US-T1-AS10, AS11 (pie del día y botones de duración) | US-T1 |
| `__tests__/mcp/execution-tandas-registro-tardio.test.ts` | US-T2-AS1..AS7, AS9 (validación y límites) | US-T2 |
| `__tests__/mcp/all-tools.test.ts` y `mcp-crud-tools.test.ts` | Consistencia de 31 herramientas | Cierre |
| `__tests__/build/spec-traceability.test.ts` | Entrada 003 con 24 escenarios | Cierre |

## Validación en producción, por historia

Las llamadas van por el conector MCP (Claude Web o una sesión de Claude Code). Solo escriben datos
las que lo indican.

### US-T3 (Inicios visibles)

1. **Forzar un error de red** en `useToday.ts` para simular `fetch` rechazado.
   - Resultado esperado: pantalla muestra "No se pudo empezar la tanda. Revisa la conexión…".
2. **Llamar a `start` con parámetro que rechaza el servidor** (por ejemplo, `planned_minutes: 5` si
   la validación anterior no la capturó). Pantalla deberá capturar el error y mostrarlo.
3. **Empezar una tanda exitosa** desde Hoy.
   - Resultado esperado: aparece "Empezó a las HH:MM" junto a la cuenta regresiva.
4. En el log del servidor MCP (`docker compose logs pure-mcp`), un `start` rechazado debe dejar
   línea: `[execution] start rechazado: CODIGO mensaje`.

### US-T1 (Tandas de 60 minutos)

1. **Empezar una tanda de 60 minutos** desde la pantalla Hoy.
   - Resultado esperado: cuatro botones (10 / 25 / 40 / 60), el de 10 es el primario.
   - Tocando 60: la tanda arranca, se ve "Empezó a las…" y el cronómetro.
2. **Verificar el pie del día**:
   - Resultado esperado: si hay una tanda de 60 completada y el mínimo es 3, dice "6 de 3 tandas"
     (6 unidades, 3 requeridas).
   - Si no hay semana del programa: dice "1 tanda hoy".
3. **Verificar el aviso de fin de tanda**:
   - Resultado esperado: cuando se cumplan los 60 minutos, el push dice "Terminó tu tanda de 60 minutos"
     (no "10 minutos").
4. Llamada MCP: `manage_tandas read { "from": "hoy", "to": "hoy" }`
   - Resultado esperado: resumen del día trae `unidades: 6` si la tanda de 60 se completó.
5. Llamada MCP: `get_today {}`
   - Resultado esperado: `evaluacion_dia.unidades_completadas: 6` si hay tanda de 60.

### US-T2 (Registro tardío acotado)

1. **Registrar una sesión de 40 minutos de hace 2 horas**.
   - Resultado esperado: `manage_tandas log_late { "subject_id": "...", "started_at": "...", "ended_at": "..." }`
     → tanda creada con `status: "completada"`, `late_logged: true`, `actual_minutes: 40`.
2. **Intentar una sesión de ayer o de hace 7 horas**.
   - Resultado esperado: `REGISTRO_TARDIO_INVALIDO`.
3. **Intentar una sesión de 9 minutos o 61 minutos**.
   - Resultado esperado: `REGISTRO_TARDIO_INVALIDO`.
4. **Registrar tres sesiones tardías en el mismo día**.
   - Resultado esperado: las tres se crean.
5. **Intentar una cuarta**.
   - Resultado esperado: `LIMITE_REGISTRO_TARDIO`.
6. **Verificar el reporte de cumplimiento**.
   - Resultado esperado: `get_compliance_report { ... }` → `registros_tardios: { total: 3, minutos: total_de_las_3 }`.
7. **Intentar desde la web** (POST `/api/execution` con `manage_tandas` y acción `log_late`).
   - Resultado esperado: rechazado con 403 (no está en `ALLOWED_ACTIONS`).

## Checkmarks finales

- [ ] `npm run test:all` en verde con 24 escenarios cubiertos.
- [ ] `/health` del MCP responde y muestra `database.connected: true`.
- [ ] Tanda de 60 minutos arranca, muestra hora de inicio y cronómetro.
- [ ] Pie del día dice "N de M tandas" donde N es unidades y M es mínimo.
- [ ] `log_late` cuarto del día rechazado con `LIMITE_REGISTRO_TARDIO`.
- [ ] En producción: `docker compose exec pure-mcp npm run db:migrate` aplicó 013 y 014.
- [ ] En producción: `manage_tandas read` trae campo `unidades`.
- [ ] PWA a 375 px sin errores de consola.

