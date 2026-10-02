# Feature Specification: Tandas de duración variable y registro tardío

**Feature Branch**: `003-tandas-variables`

**Created**: 2026-09-21

**Status**: Draft — pendiente de aprobación de Andres

**Input**: User description: "Módulo de Ejecución — ajustes a tandas. US-T1 tandas de duración
variable hasta 60 min; US-T2 registro tardío acotado y visible; US-T3 investigar la tanda de 1
hora que no quedó guardada. Orden: US-T3, US-T1, US-T2."

> **Trazabilidad**: cada escenario lleva un ID `US-Tn-ASm`. La letra T separa esta feature de la
> 001 (`USn-ASm`) y de la 002 (`US-Bn-ASm`), para que el test de una nunca cuente como cobertura de
> otra. Cada escenario no marcado `[manual]` DEBE tener una prueba automatizada con su ID en el
> nombre (Constitución, Principio II).
>
> **Base**: esta feature ajusta el Módulo de Ejecución de `specs/001-modulo-ejecucion/` y
> `specs/002-ejecucion-ajustes/`. Lo que esta spec no cambia sigue rigiéndose por ellas.
>
> **Investigación previa (2026-09-21)**: US-T3 se resolvió antes de escribir la spec, contra
> producción. El resultado completo está en `research.md`. En resumen: la tanda de 1 hora nunca se
> creó porque ningún cliente podía pedir 60 minutos (la pantalla Hoy no ofrece la opción y el rango
> vigente es 5–25, verificado contra `mcp.btw-one.com`), y el rechazo fue invisible porque la
> pantalla descarta la respuesta de `start` y un 400 no deja línea de log. El servidor no se
> reinició (6 días de uptime) y la base no perdió nada: no hay fila en esa ventana.

## Clarifications

### Session 2026-09-21

- Q: ¿Qué se cambia si no existe el `CHECK` de `planned_minutes` que el encargo da por hecho? → A:
  Se mueve el rango real (5–25, en `constants.ts` + Zod) a 10–60 **y** se agrega por fin el `CHECK`
  en una migración. Ninguna fila de producción lo violaría: las 6 tandas existentes tienen 10.
- Q: ¿Y la vista `v_tandas_dia`? → A: No existe. El agregado por día es aritmética en TypeScript
  (Principio III): `readTandas().por_dia` y `evaluateDay`/`describeDay`. Ahí se cuenta en unidades.
- Q: ¿El umbral de tanda huérfana `started_at + planned_minutes + 60 min`? → A: No se agrega. La
  002 descartó el estado "abandonada" y el cierre por hora del día. `finalizeElapsed` ya cierra en
  `started_at + planned_minutes`, que es relativo a la duración: una tanda de 60 minutos se cierra
  sola a los 60. Queda una prueba de regresión que lo fija, sin margen adicional.
- Q: ¿El registro tardío se puede disparar desde la PWA? → A: No en esta feature. `log_late` es una
  acción MCP (el asistente), no entra en la lista blanca de `app/api/execution/route.ts`. La
  fricción es intencional: el camino normal es darle iniciar.
- Q: ¿Cómo se ofrecen las duraciones sin romper "en un toque"? → A: Cuatro botones (10 / 25 / 40 /
  60) que arrancan la tanda al tocarlos, con el 10 como acción primaria. Un toque sigue bastando;
  no hay selector previo ni campo libre.

## User Scenarios & Testing *(mandatory)*

### User Story T3 - Que un inicio fallido no pase inadvertido (Priority: P1)

El 21-sep creí haber empezado una tanda de 1 hora y no quedó nada. Quiero que, cuando el servidor
rechace un inicio o no haya red, la pantalla me lo diga, y que cuando sí arranque me lo confirme
con la hora que devolvió el servidor.

**Why this priority**: es la causa de que el incidente pasara inadvertido, y sin esto cualquier
otro arreglo se puede volver a caer en silencio. Va primero porque no depende de los otros dos.

**Independent Test**: forzar un `start` que el servidor rechaza y otro sin red, y comprobar que la
pantalla muestra el error en ambos casos; empezar una tanda y comprobar que se ve la hora de inicio.

**Acceptance Scenarios**:

1. **US-T3-AS1** — **Given** un `start` que el servidor responde con estado de error, **When** la
   pantalla Hoy procesa la respuesta, **Then** muestra el mensaje del servidor y no deja la
   pantalla como si nada hubiera pasado.
2. **US-T3-AS2** — **Given** un `start` que falla por red (el `fetch` lanza), **When** la pantalla
   lo procesa, **Then** muestra un aviso de que no se pudo empezar la tanda, sin promesa rechazada
   sin manejar.
3. **US-T3-AS3** — **Given** una tanda en curso, **When** la pantalla la muestra, **Then** incluye
   la hora de inicio que devolvió el servidor, además de la cuenta regresiva.
4. **US-T3-AS4** — **Given** un `start` rechazado (validación o regla de negocio), **When** el
   handler devuelve el error, **Then** queda una línea en el log del servidor con el código y el
   motivo, para que el próximo fallo silencioso sí deje rastro.

---

### User Story T1 - Tandas de duración variable, hasta 60 minutos (Priority: P1)

Quiero iniciar una tanda de más de 10 minutos cuando puedo concentrarme más tiempo, para que una
sesión larga quede registrada completa y cuente para el mínimo del día.

**Why this priority**: la tanda de 10 minutos se diseñó como piso cuando mi techo de concentración
era de 10 minutos. Ya no lo es, y hoy una hora de estudio no se puede registrar.

**Independent Test**: empezar tandas de 10, 25, 40 y 60 minutos; comprobar que la de 60 se cierra
sola a los 60 y que un día con una sola tanda de 60 cumple un mínimo de 3.

**Acceptance Scenarios**:

1. **US-T1-AS1** — **Given** el rango nuevo, **When** empiezo una tanda con 60 minutos, **Then**
   queda en curso con `planned_minutes = 60` y fin previsto 60 minutos después del inicio.
2. **US-T1-AS2** — **Given** que no indico duración, **When** empiezo una tanda, **Then** dura 10
   minutos: el valor por defecto no cambia.
3. **US-T1-AS3** — **Given** el rango nuevo, **When** pido 9 minutos o 61 minutos, **Then** se
   rechaza con `DATOS_INVALIDOS` y no se crea ninguna tanda.
4. **US-T1-AS4** — **Given** la regla de unidades, **When** se evalúa una tanda completada de 60,
   de 25, de 10 y de 8 minutos, **Then** valen 6, 2, 1 y 1 unidades respectivamente
   (`floor(actual_minutes / 10)`, mínimo 1).
5. **US-T1-AS5** — **Given** un mínimo diario de 3 y un día con una sola tanda completada de 60
   minutos, **When** se evalúa el día, **Then** el mínimo queda cumplido y la evaluación muestra
   `tandas_completadas = 1` y `unidades_completadas = 6`.
6. **US-T1-AS6** — **Given** un día con una tanda de 25 y otra de 10 minutos, **When** pido el
   reporte de cumplimiento, **Then** expone para ese día `tandas_completadas = 2` y
   `unidades_completadas = 3`, y compara el mínimo contra las unidades.
7. **US-T1-AS7** — **Given** varias tandas en un día, **When** leo las tandas del rango, **Then**
   el resumen por día trae `unidades` además de `completadas`, `interrumpidas` y `minutos`.
8. **US-T1-AS8** — **Given** una tanda de 60 minutos y ninguna operación intermedia, **When** pasan
   59 minutos, **Then** sigue en curso; **and when** pasan 60, **Then** cualquier operación
   posterior la encuentra completada con 60 minutos, sin margen adicional. [regresión]
9. **US-T1-AS9** — **Given** una tanda de 40 minutos que se cierra por tiempo, **When** se envía el
   aviso de fin de tanda, **Then** el texto dice 40 minutos, no 10.
10. **US-T1-AS10** — **Given** un día con una tanda de 60 minutos y un mínimo de 3, **When** se
    arma el pie de la pantalla Hoy, **Then** dice "6 de 3 tandas"; **and given** que no hay semana
    del programa, **Then** dice "1 tanda hoy".
11. **US-T1-AS11** — **Given** la pantalla Hoy sin tanda en curso, **When** se resuelven las
    opciones de duración, **Then** son exactamente 10, 25, 40 y 60, con 10 como opción primaria y
    sin campo libre.

---

### User Story T2 - Registro tardío acotado y visible (Priority: P2)

Quiero registrar una sesión que olvidé iniciar en la app, para no perder el registro, sin que eso
abra la puerta a inventar tandas.

**Why this priority**: la regla "sin tandas retroactivas" existe para que el reporte no se pueda
maquillar. El caso real que falla no es inventar sesiones: es olvidar darle iniciar. La solución no
es quitar la regla; es acotar la excepción y hacerla visible, igual que `edited_after_lock`.

**Independent Test**: registrar una sesión de hace dos horas y verla contar para el día marcada
como tardía; intentar una de ayer, una de hace 7 horas, una que se solapa y una cuarta del día.

**Acceptance Scenarios**:

1. **US-T2-AS1** — **Given** son las 18:00 y estudié de 15:00 a 16:00 sin darle iniciar, **When**
   registro la sesión tardíamente, **Then** queda completada con 60 minutos reales, `late_logged`
   en verdadero y la fecha local de hoy.
2. **US-T2-AS2** — **Given** una sesión que empezó ayer o hace más de 6 horas, **When** intento
   registrarla, **Then** se rechaza con `REGISTRO_TARDIO_INVALIDO` y no se crea nada.
3. **US-T2-AS3** — **Given** una sesión que termina en el futuro o que termina antes de empezar,
   **When** intento registrarla, **Then** se rechaza con `REGISTRO_TARDIO_INVALIDO`.
4. **US-T2-AS4** — **Given** una sesión de 9 minutos o de 61 minutos, **When** intento registrarla,
   **Then** se rechaza con `REGISTRO_TARDIO_INVALIDO`.
5. **US-T2-AS5** — **Given** una tanda ya registrada de 15:00 a 15:10, **When** intento registrar
   una sesión que se solapa con ella, **Then** se rechaza con `REGISTRO_TARDIO_INVALIDO`; **and
   given** una tanda en curso, **Then** su tramo desde el inicio hasta ahora también cuenta como
   ocupado.
6. **US-T2-AS6** — **Given** tres registros tardíos hoy, **When** intento el cuarto, **Then** se
   rechaza con `LIMITE_REGISTRO_TARDIO`; los tres primeros sí se crean.
7. **US-T2-AS7** — **Given** un mínimo diario de 3 y una sesión tardía de 40 minutos como único
   registro del día, **When** se evalúa el día, **Then** cuenta 4 unidades y el mínimo queda
   cumplido, igual que si la tanda hubiera corrido en la app.
8. **US-T2-AS8** — **Given** un día con dos registros tardíos de 30 y 20 minutos, **When** pido el
   reporte de cumplimiento y el payload del reporte semanal, **Then** los dos traen
   `registros_tardios = { total: 2, minutos: 50 }`; **and given** una semana sin ninguno, **Then**
   traen `{ total: 0, minutos: 0 }`, nunca nulo ni ausente.
9. **US-T2-AS9** — **Given** el flujo normal, **When** intento pasarle `started_at` o `ended_at` a
   `start`, **Then** se sigue rechazando; **and when** la web intenta disparar `log_late`, **Then**
   la lista blanca lo rechaza porque el registro tardío solo existe por MCP. [regresión]

---

### Edge Cases

- Una tanda tardía no puede quedar `en_curso` ni tomar `running_lock`: nace cerrada. Por eso un
  registro tardío no interfiere con una tanda que esté corriendo, salvo por el solapamiento.
- El límite de 3 registros tardíos se cuenta por día local, contra las tandas ya guardadas con
  `late_logged`, no contra un contador aparte.
- Una tanda de 60 minutos empezada a las 22:25 termina a las 23:25 y conserva el `local_date` de su
  inicio, como todas.
- `floor(actual_minutes / 10)` con mínimo 1 se aplica solo a tandas completadas: las interrumpidas
  siguen sin aportar nada al día (001, US3).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-T01**: `manage_tandas.start` DEBE aceptar `planned_minutes` entre 10 y 60, con 10 por
  defecto. Fuera del rango, `DATOS_INVALIDOS` sin escribir nada.
- **FR-T02**: La tabla `tandas` DEBE tener `CHECK (planned_minutes BETWEEN 10 AND 60)`, agregado en
  una migración que corra en pg-mem (Principio III).
- **FR-T03**: `finish` sigue calculando `actual_minutes` con el reloj del servidor y sigue exigiendo
  que el tiempo planeado se haya cumplido (margen de 30 s). Sin cambios.
- **FR-T04**: Una tanda completada DEBE valer `max(1, floor(actual_minutes / 10))` unidades. La
  regla vive en una función pura del dominio, no repetida en cada servicio.
- **FR-T05**: El mínimo del día (`min_tandas_dia`) se compara contra **unidades**, no contra filas.
- **FR-T06**: `get_today.evaluacion_dia`, `get_compliance_report` y el resumen por día de
  `manage_tandas.read` DEBEN exponer ambas cifras: `tandas_completadas` (filas) y
  `unidades_completadas` (lo que se compara contra el mínimo).
- **FR-T07**: El cierre por tiempo cumplido DEBE seguir siendo `started_at + planned_minutes`, sin
  margen fijo ni estado de tanda huérfana.
- **FR-T08**: El aviso de fin de tanda DEBE decir los minutos reales de esa tanda.
- **FR-T09**: La pantalla Hoy DEBE ofrecer 10, 25, 40 y 60 minutos, cada uno iniciando la tanda al
  tocarlo, con 10 como acción primaria y sin campo libre.
- **FR-T10**: `manage_tandas.log_late` DEBE aceptar `{ subject_id, started_at, ended_at, topic_id?,
  task_id? }` y crear una tanda `completada` con `late_logged = true`.
- **FR-T11**: `log_late` DEBE rechazar con `REGISTRO_TARDIO_INVALIDO` cuando: `started_at` o
  `ended_at` caen en un día local distinto al del reloj del servidor; `started_at` está más de 6
  horas atrás; `ended_at` es posterior a la hora del servidor o no es posterior a `started_at`; la
  duración queda fuera de 10–60 minutos; o el tramo se solapa con otra tanda del mismo día (una
  tanda en curso ocupa desde su inicio hasta ahora).
- **FR-T12**: `log_late` DEBE rechazar con `LIMITE_REGISTRO_TARDIO` a partir del cuarto registro
  tardío del mismo día local.
- **FR-T13**: Una tanda tardía cuenta para el mínimo del día con la misma regla de unidades.
- **FR-T14**: `get_compliance_report` y el payload del reporte semanal DEBEN exponer
  `registros_tardios: { total, minutos }`, con ceros explícitos cuando no hubo ninguno.
- **FR-T15**: `start` y el resto del flujo normal NO DEBEN aceptar horas del cliente, y no se agrega
  ningún otro camino —MCP o web— para crear tandas con fecha pasada. `log_late` no entra en la lista
  blanca de `app/api/execution/route.ts`.
- **FR-T16**: Un `start` rechazado DEBE quedar registrado en el log del servidor con su código.
- **FR-T17**: La pantalla Hoy DEBE mostrar el error cuando un inicio falla —lo rechace el servidor
  o falle la red— y DEBE mostrar la hora de inicio devuelta por el servidor mientras la tanda corre.

### Key Entities

- **tanda**: gana `late_logged BOOLEAN NOT NULL DEFAULT FALSE` y el `CHECK` de `planned_minutes`.
  `planned_minutes` pasa a ser 10–60; `actual_minutes` no cambia de significado.
- **unidad**: concepto derivado, no almacenado: `max(1, floor(actual_minutes / 10))` de una tanda
  completada. Es la moneda con la que se mide el mínimo diario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-T01**: Una sesión de 60 minutos seguidos se registra completa desde la pantalla Hoy, en un
  toque, y queda como una sola tanda de 60 minutos.
- **SC-T02**: Un día con una sola tanda de 60 minutos cumple un mínimo diario de 3.
- **SC-T03**: Ningún inicio fallido queda invisible: hay mensaje en pantalla y línea en el log.
- **SC-T04**: Como máximo 3 sesiones por día pueden entrar por registro tardío, y todas quedan
  marcadas y contadas aparte en el reporte.
- **SC-T05**: `npm run test:all` en verde, con un test por escenario no manual de esta spec.

## Assumptions

- El rango 10–60 reemplaza al 5–25: las tandas de 5 minutos dejan de ser posibles. Ninguna existe
  en producción (las 6 tandas registradas son de 10 minutos), así que la migración no necesita
  normalizar datos.
- "Unidades" es un nombre interno de la API. En pantalla el pie dice "N de M tandas", porque una
  unidad es exactamente la tanda de 10 minutos de siempre.
- El registro tardío no se expone en la web en esta feature. Si Andres lo quiere en el teléfono, es
  una historia aparte que tendrá que decidir cómo evitar que el camino fácil sea el tardío.
- La ventana de 6 horas y el límite de 3 se cuentan con el reloj del servidor y la zona `PURE_TZ`,
  como todo lo demás del módulo.
