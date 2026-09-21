# Investigación previa — 003 (tandas de duración variable y registro tardío)

**Fecha**: 2026-09-21 · **Rama**: `003-tandas-variables`

Este documento recoge la evidencia empírica que se levantó **antes** de escribir la spec. US-T3 no
es una historia de implementación: es la investigación cuyo resultado decide qué arregla US-T1 y
qué se arregla aparte. Todo lo de abajo se comprobó contra producción (`mcp.btw-one.com`) y contra
el código de la rama, no por deducción.

## US-T3 · Qué pasó con la tanda de 1 hora del 21-sep

### Evidencia

1. **No existe ninguna fila en la ventana del incidente.** `manage_tandas.read` sobre producción,
   rango 2026-09-19..2026-09-22, devuelve para el 21-sep: `05:10:29Z`, `05:51:29Z` (las "12:10 y
   12:51 am" del reporte — Bogotá es UTC−5) y una tanda iniciada a las `22:25:00Z` (17:25 local),
   posterior al incidente. **Entre 22:00Z y 22:25Z no hay fila alguna**: ni completada, ni
   interrumpida, ni en curso, ni huérfana. La tanda no se guardó a medias: nunca se escribió.

2. **El servidor no se cayó ni perdió nada.** `GET /health` al momento de la investigación:
   `uptimeSeconds: 520782` (≈ 6 días de proceso continuo) y `database.connected: true`. No hubo
   reinicio en la ventana, así que no es una escritura perdida por caída.

3. **Producción rechaza 60 minutos.** Prueba directa contra el servidor desplegado:

   ```
   manage_tandas.start { "planned_minutes": 60 }
   -> { "status": "error", "code": "DATOS_INVALIDOS",
        "message": "planned_minutes: Too big: expected number to be <=25" }
   ```

   La validación Zod corre en `handleManageTandas` **antes** de `startTanda`, así que una petición
   de 60 minutos no llega a tocar la base: no deja fila, ni rastro, ni bloqueo.

4. **La pantalla Hoy no puede pedir 60 minutos.** `handleStart()`
   (`components/dashboards/TodayDashboard.tsx:93`) llama a `start()` sin `planned_minutes`, y
   `useToday.start` solo admite `{ subject_id?, routine_slot_id? }`. Un toque en "Empezar tanda"
   siempre pide 10. No hay selector de duración en ninguna parte de la app.

5. **Todas las tandas de producción tienen `planned_minutes = 10`** (6 filas entre el 12 y el 21 de
   septiembre). Dato relevante para la migración de US-T1: ninguna fila existente violaría un
   `CHECK (planned_minutes BETWEEN 10 AND 60)`.

### Diagnóstico

La tanda de 1 hora nunca se creó, y no pudo crearse: **ningún cliente podía pedir 60 minutos el
21-sep**. Por la pantalla Hoy, porque no existe la opción; por MCP, porque el rango vigente es
5–25 y la validación rechaza el resto. El sistema hizo exactamente lo que estaba escrito; lo que
falló fue que el rechazo no se vio por ningún lado.

De las dos ramas que plantea US-T3, la primera es la que aplica ("la UI permitió elegir 60 min pero
el rango lo rechazó") con un matiz importante: la UI ni siquiera permitió elegirlo, así que la
petición de 60 minutos salió de un cliente MCP (el asistente), no de un toque en la app. La segunda
rama ("`start` nunca se llamó") también queda cubierta: el resultado visible para quien mira el
teléfono es idéntico —no pasa nada— y hoy no hay forma de distinguirlas.

### Por qué el fallo fue silencioso

- `handleStart` hace `await start(...)` dentro de un `try/finally` que **descarta la respuesta**
  (`components/dashboards/TodayDashboard.tsx:93-100`). Un `{ status: 'error' }` del servidor se
  pierde ahí mismo; si el `fetch` lanza (sin red), la promesa queda rechazada sin manejar y lo
  único que se ve es que el botón se vuelve a habilitar.
- `callAction` (`lib/hooks/useToday.ts:57`) sí devuelve el JSON, así que el arreglo es de la
  pantalla, no del transporte.
- La confirmación de que la tanda arrancó es hoy **implícita**: aparece el cronómetro. No se
  muestra la hora de inicio que devolvió el servidor, así que "no pasó nada" y "pasó y no me di
  cuenta" se ven igual.

### Sobre "revisar los logs del servidor"

Tres precisiones que conviene dejar escritas:

- **Los toques de la PWA no pasan por `pure-mcp`.** `app/api/execution/route.ts` importa
  `lib/execution/handlers.ts` directamente (Constitución, Principio I), así que el log de un
  `start` desde el teléfono está en el contenedor **web**, no en el del MCP.
- **Desde esta máquina no hay acceso a esos logs**: el demonio de Docker no corre aquí (los
  servicios viven en el servidor casero), así que `docker compose logs` solo se puede correr en el
  host. No hace falta: la base ya respondió la pregunta que los logs iban a responder.
- **Aunque hubiera acceso, no habría línea que leer.** Un rechazo de validación sale como 400 y
  `handleManageTandas` solo hace `console.error` en el `catch` de un error inesperado; los 400 no
  se registran. Por eso US-T3 agrega una línea de log para todo `start` rechazado: sin ella, el
  próximo incidente igual de silencioso tampoco dejará rastro.

## Premisas de la solicitud que no coinciden con el código (y qué se hace en su lugar)

Tres criterios del encargo describen cosas que no existen en el repositorio. Se dejan anotadas
aquí para que la implementación no salga a buscarlas:

1. **No hay `CHECK` de `planned_minutes` en la base.** `db/migrations/008_execution_core.sql:59`
   declara `planned_minutes INT NOT NULL DEFAULT 10`, sin restricción. El rango 5–25 vive en
   `lib/execution/constants.ts` (`TANDA_MINUTES_MIN`/`MAX`) y lo aplica `TandaStartSchema`
   (`lib/validations/schemas.ts:466`). La feature hace las dos cosas: mueve el rango a 10–60 **y**
   agrega por fin el `CHECK` en una migración, que es lo que el criterio pedía en espíritu.
2. **No existe la vista `v_tandas_dia`.** El agregado por día es aritmética en TypeScript
   (Constitución, Principio III): `readTandas().por_dia` y `evaluateDay`/`describeDay` en
   `lib/domain/execution.ts`. Ahí es donde se pasa de contar filas a contar unidades.
3. **No existe el cierre de "tanda huérfana" de US-B2.** La 002 lo descartó explícitamente ("no
   hay estado abandonada ni cierre de tandas a las 22:30"). Lo que hay es `finalizeElapsed`, que
   cierra la tanda en curso exactamente en `started_at + planned_minutes`, relativo a la duración
   planeada. Es decir: el umbral ya es relativo y una tanda de 60 minutos se cierra sola a los 60,
   sin ventana de huérfana. No hay nada que cambiar; se agrega una prueba de regresión que lo fija
   para 60 minutos, y no se introduce el margen de +60 min porque implicaría un estado que la 002
   rechazó.

## Puntos de implementación que la evidencia deja marcados

- `tandaEndBody` (`lib/execution/tick.ts:59`) escribe literalmente "10 minutos" en el aviso de fin
  de tanda. Con duración variable hay que sacar el número de `actual_minutes`.
- `tandas_today` (`lib/execution/today.ts`) y `buildTodayFooterView`
  (`lib/execution/today-view.ts:65`) cuentan filas completadas. El pie pasa a hablar de unidades.
- `saveTandaToDb` (`lib/db/execution-pg.ts:439`) enumera columnas a mano en el `INSERT ... ON
  CONFLICT`: agregar `late_logged` exige tocar la lista, los `$n` y el `DO UPDATE SET`.
- El registro tardío (US-T2) es la **única** excepción a "ningún instante viene del cliente"
  (Constitución, Principio III). La spec la acota y la hace visible; la implementación no debe
  generalizarla a `start`.
