# Feature Specification: Ajustes del Módulo de Ejecución

**Feature Branch**: `002-ejecucion-ajustes`

**Created**: 2026-09-12

**Status**: Draft — pendiente de aprobación de Andres

**Input**: User description: "Módulo de Ejecución — correcciones. US-B1 planear la semana que todavía no empieza; US-B2 la tanda olvidada no puede bloquear el sistema; US-B3 ver cuántas veces abrí el plan; US-B4 un día solo se cumple si hice las tandas mínimas; US-B5 registrar la fricción del teléfono y sacarla cuando me irrita. La implementación va con SDD y TDD."

> **Trazabilidad**: cada escenario de aceptación lleva un ID `US-Bn-ASm`. La letra B separa esta
> feature de la 001, cuyos IDs son `USn-ASm`, para que el test de una nunca cuente como cobertura
> de la otra. Cada escenario no marcado `[manual]` DEBE tener una prueba automatizada con su ID en
> el nombre (Constitución, Principio II). Los `[manual]` se verifican con el quickstart de la
> feature.
>
> **Base**: esta feature ajusta el Módulo de Ejecución de `specs/001-modulo-ejecucion/`. Lo que
> esta spec no cambia sigue rigiéndose por la 001.
>
> **Verificación previa (2026-09-12)**: antes de escribir la spec se contrastaron las causas raíz de
> las historias con el código y con la base de pruebas.
> - El domingo, la planeación ya resolvía la semana que arranca al día siguiente: el domingo 13
>   resuelve la semana 1. El fallo que se vio fue el sábado 12, cuando ninguna semana contiene el
>   día.
> - Empezar una tanda ya cierra, en la misma acción, una tanda cuyo tiempo se cumplió, y el proceso
>   programado la cierra cada 20 segundos. Una tanda olvidada no bloquea.
> - El día cumplido ya exigía el mínimo de tandas y todos los hábitos activos (US3-AS1 y US3-AS2 de
>   la 001). Lo que faltaba era mostrar el desglose.

## Clarifications

### Session 2026-09-12

- Q: La tanda olvidada no bloquea (verificado). ¿Qué pasa con US-B2? → A: Queda como pruebas de
  regresión. No hay estado "abandonada" ni cierre de tandas a las 22:30: ese cierre cortaría
  tandas legítimas empezadas entre las 22:05 y las 22:30, y contradice US1-AS7 de la 001.
- Q: ¿Qué semana resuelve la planeación cuando no se indica una? → A: Si hoy es domingo, la que
  arranca mañana; si no, la que contiene hoy; si hoy no cae en ninguna, la próxima que empiece; y
  si no queda ninguna, no encontrada ("el programa ya terminó"). La regla literal "la semana que
  contiene hoy" haría que cada domingo, desde el 20, se planeara la semana que termina.
- Q: ¿Abrir la vista de una semana que todavía no empieza gasta sus aperturas libres? → A: No. Se
  registra como apertura de planeación, sin compuerta y sin contar en las aperturas del plan.

## User Scenarios & Testing *(mandatory)*

### User Story B1 - Planear la semana que todavía no empieza (Priority: P1)

El domingo planeo la semana que arranca mañana, y tengo que poder hacerlo también antes de que
empiece el programa. Si indico una semana, Pure planea esa. Mientras planeo puedo abrir la vista
de una semana que todavía no empieza sin gastar sus aperturas libres.

**Why this priority**: sin la planeación del domingo la semana arranca a ciegas, y el ritual es el
que el módulo existe para sostener. La verificación mostró que el domingo ya funcionaba; faltaban
el respaldo antes del programa, la semana explícita en la vista y no contar las aperturas de
planeación.

**Independent Test**: con un programa que empieza el lunes 14, mover el reloj al sábado 12, al
domingo 13, al martes 15, al domingo 20 y a después de la última semana, y comprobar qué semana
resuelven la planeación, el ensayo, la vista de la semana y la vista previa del reporte.

**Acceptance Scenarios**:

1. **US-B1-AS1** — **Given** hoy es domingo 13 de septiembre y la semana 1 arranca el lunes 14,
   **When** abro la planeación sin indicar semana, **Then** planea la semana 1.
2. **US-B1-AS2** — **Given** hoy es martes 15, dentro de la semana 1, **When** abro la planeación
   sin indicar semana, **Then** planea la semana 1 y no la 2.
3. **US-B1-AS3** — **Given** hoy es domingo 20, último día de la semana 1, y la semana 2 arranca el
   lunes 21, **When** abro la planeación sin indicar semana, **Then** planea la semana 2.
4. **US-B1-AS4** — **Given** hoy es sábado 12 y ninguna semana del programa contiene ese día,
   **When** abro la planeación o ensayo un disparador sin indicar semana, **Then** los dos usan la
   semana más próxima que empieza: la semana 1.
5. **US-B1-AS5** — **Given** ya terminó la última semana del programa, **When** abro la planeación
   sin indicar semana, **Then** se rechaza como no encontrada, con un mensaje que dice que el
   programa ya terminó.
6. **US-B1-AS6** — **Given** hoy es martes 15, **When** abro la planeación indicando la semana 3,
   **Then** planea la semana 3 sin aplicar la regla anterior; **and given** indico una semana que
   no existe, **Then** se rechaza como no encontrada.
7. **US-B1-AS7** — **Given** hoy es domingo 13, **When** registro mis intenciones indicando la
   semana 1, **Then** se guardan para la semana 1; **and given** indico una semana que no existe,
   **Then** se rechaza como no encontrada y no se guarda nada.
8. **US-B1-AS8** — **Given** hoy es domingo 13 y la semana 1 todavía no empieza, **When** abro dos
   veces la vista de la semana indicando la semana 1, **Then** la veo sin que me pida razón y esas
   aperturas quedan como planeación; **and when** el martes 15 abro dos veces la vista de la
   semana en curso, **Then** las dos siguen siendo libres.
9. **US-B1-AS9** — **Given** hoy es sábado 12, **When** abro la vista de la semana sin indicar
   cuál, **Then** abre la semana 1 como planeación; **and given** hoy es domingo 20, **Then** abre
   la semana 1, que está en curso, y no la 2.
10. **US-B1-AS10** — **Given** hoy es domingo 13, antes del programa, **When** pido la vista previa
    del reporte semanal sin indicar semana, **Then** se rechaza como no encontrada; **and given**
    hoy es martes 15, **Then** usa la semana 1.

---

### User Story B2 - La tanda olvidada no bloquea el sistema (Priority: P1)

Si dejo una tanda abierta y me voy, tengo que poder empezar otra en cuanto vuelva. Ningún cierre
por hora del día debe cortarme una tanda legítima.

**Why this priority**: una tanda bloqueada impediría estudiar. La verificación del 2026-09-12
mostró que no pasa, porque empezar una tanda cierra la vencida y crea la nueva en la misma acción.
Estos escenarios fijan ese comportamiento para que ningún cambio futuro lo rompa. Andres decidió
no agregar el estado "abandonada" ni el cierre de las 22:30.

**Independent Test**: empezar una tanda, mover el reloj 2 horas sin ninguna otra operación y
empezar otra; correr el proceso programado dos veces sobre una tanda vencida; empezar una tanda a
las 22:25 y comprobar que termina por tiempo.

**Acceptance Scenarios**:

1. **US-B2-AS1** — **Given** una tanda en curso que empezó hace 2 horas y que ninguna operación ha
   tocado desde entonces, **When** empiezo una tanda nueva, **Then** en esa misma acción la
   anterior queda completada con sus minutos planeados y la nueva queda en curso.
2. **US-B2-AS2** — **Given** una tanda en curso cuyo tiempo ya se cumplió, **When** el proceso
   programado corre dos veces seguidas, **Then** la primera corrida la deja completada y la
   segunda no cambia nada: ni la tanda ni la cantidad de avisos.
3. **US-B2-AS3** — **Given** empecé una tanda a las 22:25, **When** son las 22:31, **Then** sigue
   en curso; **and when** se cumple su tiempo, **Then** queda completada y cuenta para ese día.

---

### User Story B3 - Ver cuántas veces abrí el plan (Priority: P2)

Quiero ver cuántas veces abrí la vista de la semana, para saber si mis disparadores ya son
automáticos o si sigo consultando el horario todos los días.

**Why this priority**: la compuerta registra las aperturas y sus razones, pero ningún reporte las
mostraba completas. Una compuerta que nadie mide es solo un estorbo.

**Independent Test**: abrir la vista de la semana tres veces en una misma semana (la tercera con
razón), consultar el cumplimiento de esa semana y congelar su reporte.

**Acceptance Scenarios**:

1. **US-B3-AS1** — **Given** en la semana 1 abrí la vista tres veces, dos libres y la tercera con
   la razón "reviso antes del parcial", **When** consulto el cumplimiento de la semana 1, **Then**
   veo 2 aperturas libres, 1 con razón, 3 en total y la razón escrita.
2. **US-B3-AS2** — **Given** no abrí la vista en el rango consultado, **When** consulto el
   cumplimiento, **Then** los tres conteos son 0 y la lista de razones está vacía.
3. **US-B3-AS3** — **Given** una apertura el lunes 14 y otra el lunes 21, **When** consulto el
   cumplimiento del 14 al 20, **Then** solo cuenta la del lunes 14.
4. **US-B3-AS4** — **Given** aperturas de planeación de una semana que todavía no empezaba,
   **When** consulto el cumplimiento, **Then** no cuentan en ninguno de los conteos.
5. **US-B3-AS5** — **Given** una semana con 3 aperturas, 1 de ellas con razón, **When** se congela
   su reporte, **Then** el reporte guarda el total y las aperturas con razón, y el correo dice
   "Aperturas del plan: 3 (1 con razón)".

---

### User Story B4 - Un día solo se cumple si hice las tandas mínimas (Priority: P2)

Quiero ver, día por día, cuántas tandas hice frente al mínimo de la semana y si cumplí los
hábitos, para confiar en que el mínimo que sube de 1 a 3 el 21 de septiembre significa algo.

**Why this priority**: la regla ya exige tandas y hábitos, pero desde afuera solo se veía el
resultado final. Sin el desglose no hay forma de comprobarla.

**Independent Test**: con la semana 2 (mínimo 3), registrar combinaciones de tandas y hábitos, y
comprobar el desglose en la consulta de Hoy desde el asistente y en el reporte de cumplimiento.

**Acceptance Scenarios**:

1. **US-B4-AS1** — **Given** la semana 2 (mínimo 3), 2 tandas completadas y todos los hábitos
   activos cumplidos, **When** consulto el día desde el asistente y en el reporte de cumplimiento,
   **Then** veo 2 tandas completadas, mínimo 3, tandas no cumplidas, hábitos cumplidos y día no
   cumplido.
2. **US-B4-AS2** — **Given** 3 tandas completadas y un hábito activo marcado como no cumplido,
   **When** consulto el día, **Then** veo tandas cumplidas, hábitos no cumplidos y día no cumplido.
3. **US-B4-AS3** — **Given** 3 tandas completadas y un hábito activo sin registro ese día,
   **When** consulto el día, **Then** los hábitos cuentan como no cumplidos y el día no queda
   cumplido.
4. **US-B4-AS4** — **Given** un hábito que solo aplica lunes, jueves, viernes y sábado, **When**
   consulto un martes con el mínimo de tandas y los demás hábitos cumplidos, **Then** ese hábito
   no se exige y el día queda cumplido.
5. **US-B4-AS5** — **Given** un día fuera del programa, **When** consulto el día, **Then** no hay
   evaluación, en lugar de un día no cumplido.
6. **US-B4-AS6** — **Given** el día ya trae su desglose, **When** se arma la pantalla Hoy,
   **Then** no muestra el mínimo requerido ni las tandas que faltan.
7. **US-B4-AS7** — **Given** un hábito que empieza el 28 de septiembre, **When** consulto el
   cumplimiento de la semana del 14 al 20 o se congela su reporte, **Then** ese hábito no aparece
   entre las fracciones de hábitos.
8. **US-B4-AS8** `[manual]` — **Given** el programa cargado, **When** leo el programa desde el
   asistente, **Then** existe el hábito "Gym en la mañana", que empieza el 28 de septiembre, aplica
   lunes, jueves, viernes y sábado y tiene un horizonte de 66 días.

---

### User Story B5 - Registrar la fricción del teléfono y sacarla cuando me irrita (Priority: P3)

Registro qué medidas de fricción tengo puestas en el teléfono y cada semana califico cuánto me
irritan. Si la irritación se sostiene, Pure me quita la medida más nueva antes de que abandone
todas de golpe.

**Why this priority**: el ensayo clínico que respalda estas medidas encontró que la restricción
parcial aumenta el estrés reportado. Una medida abandonada por irritación vale 0, y dos
sostenibles valen más que cinco abandonadas. No bloquea el arranque del programa.

**Independent Test**: habilitar dos medidas, intentar una tercera, verificarlas, calificar dos
semanas seguidas con 7 u 8, correr el proceso programado dos veces y congelar el reporte.

**Acceptance Scenarios**:

1. **US-B5-AS1** — **Given** ninguna medida habilitada, **When** habilito "sin biometría" y
   "escala de grises", **Then** quedan 2 habilitadas; **and when** intento habilitar "clave
   larga", **Then** se rechaza por el límite, con un mensaje que explica que la restricción
   parcial aumenta el estrés y que una medida abandonada vale 0.
2. **US-B5-AS2** — **Given** intento habilitar "celular afuera" u otra medida fuera de la lista,
   **When** la guardo, **Then** se rechaza.
3. **US-B5-AS3** — **Given** una medida habilitada que no he verificado, **When** consulto las
   medidas, **Then** aparece como no confirmada; **and when** la verifico, **Then** aparece
   confirmada, con el momento de la verificación.
4. **US-B5-AS4** — **Given** una medida habilitada, **When** la deshabilito, **Then** deja de
   contar para el límite y queda retirada con motivo manual; **and when** la deshabilito otra vez,
   o habilito otra vez una medida que ya está habilitada, **Then** no cambia nada.
5. **US-B5-AS5** — **Given** la semana en curso, **When** califico la irritación con 8 y después
   con 6, **Then** queda una sola calificación de la semana, con 6; **and given** intento
   calificar con 11 o calificar una semana que todavía no empieza, **Then** se rechaza.
6. **US-B5-AS6** — **Given** "sin biometría" habilitada el 14, "escala de grises" habilitada el
   21 y calificaciones de 7 en la semana 2 y de 8 en la semana 3, **When** corre el proceso
   programado, **Then** "escala de grises" queda deshabilitada con motivo irritación, "sin
   biometría" sigue habilitada y no sale ningún aviso al teléfono; **and when** el proceso corre
   otra vez, **Then** no cambia nada.
7. **US-B5-AS7** — **Given** calificaciones de 8 en las semanas 1 y 3 y de 6 en la semana 2,
   **When** corre el proceso programado, **Then** no se retira ninguna medida.
8. **US-B5-AS8** — **Given** una medida retirada por irritación durante la semana 3, **When** se
   congela el reporte de la semana 3, **Then** el reporte menciona la medida retirada y el motivo.
9. **US-B5-AS9** — **Given** dos medidas habilitadas y la irritación de la semana en curso
   calificada con 5, **When** consulto la fricción, **Then** veo las 2 medidas, el conteo 2 y la
   irritación 5; **and given** no he calificado esta semana, **Then** la irritación aparece vacía.

---

### Edge Cases

- ¿Y si nunca se creó el programa? La planeación y la vista sin semana indicada se rechazan como
  no encontradas, diciendo que no hay programa.
- ¿El domingo de la última semana del programa? No hay semana que empiece mañana, así que la
  planeación usa la semana en curso (FR-B01, paso 2).
- ¿La vista de una semana ya terminada, indicada a propósito? Pasa por la compuerta de esa semana
  como cualquier apertura, y en el reporte de cumplimiento cuenta en el día en que se hizo.
- ¿Una tanda que cruza la medianoche? Sigue contando para el día en que empezó (US1-AS7 de la
  001). No hay cierre por hora del día (FR-B08).
- ¿Dos habilitaciones de medidas a la vez, cuando ya hay una habilitada? Solo entra una; la otra
  se rechaza por el límite (FR-B17).
- ¿Dos semanas seguidas con 7 o más y ninguna medida habilitada? No se retira nada y ese par queda
  atendido: una medida habilitada después no se retira por ese par.
- ¿Tres semanas seguidas con 7 o más? El par de la segunda y la tercera retira otra medida, si
  todavía queda alguna habilitada.
- ¿Dos medidas que empezaron el mismo día? Se retira la que se habilitó después.
- ¿Recalifico una semana después de un retiro? El retiro no se deshace.
- ¿Recalifico con 7 o más una semana cuyo par todavía no había provocado retiro? El proceso
  programado lo vuelve a evaluar y retira si corresponde.
- ¿Un reporte congelado antes de desplegar esta feature? Conserva su forma original, incluida su
  línea de aperturas.
- ¿Dos aperturas simultáneas de la vista de la semana (un doble toque, dos dispositivos, o la doble
  ejecución de efectos de React en desarrollo)? Cuentan como una sola apertura y ninguna de las dos
  falla. Lo encontró la verificación en el navegador del 2026-09-13: la segunda respondía 400.

## Requirements *(mandatory)*

### Functional Requirements

**Planeación y vista de la semana (US-B1)**

- **FR-B01**: Sin semana indicada, la planeación DEBE resolver la semana en este orden:
  1. si hoy es domingo y existe una semana que empieza mañana, esa;
  2. si no, la semana que contiene hoy;
  3. si hoy no cae en ninguna semana, la próxima que empiece;
  4. si no queda ninguna, DEBE rechazarse como no encontrada, con un mensaje que diga que el
     programa ya terminó, o que no hay programa si nunca se creó.
- **FR-B02**: El ensayo de disparadores sin semana indicada DEBE usar la misma resolución que la
  planeación (FR-B01).
- **FR-B03**: Cuando se indica una semana, la planeación, las intenciones, el ensayo y la vista de
  la semana DEBEN usar esa semana sin aplicar ninguna resolución. Una semana que no existe DEBE
  rechazarse como no encontrada, sin guardar nada.
- **FR-B04**: Sin semana indicada, la vista de la semana DEBE abrir la semana que contiene hoy; si
  hoy no cae en ninguna, la próxima que empiece; y si no queda ninguna, DEBE rechazarse como no
  encontrada. La vista NUNCA DEBE saltar a la semana siguiente por ser domingo.
- **FR-B05**: Abrir la vista de una semana que todavía no empieza DEBE registrarse como apertura
  de planeación. Esa apertura no pide razón, no pasa por la compuerta y no cuenta para las 2
  aperturas libres de esa semana ni para las aperturas del plan (FR-B09).
- **FR-B06**: La vista previa del reporte semanal NO DEBE cambiar: sin semana indicada usa solo la
  semana en curso, nunca una futura.

**Tandas (US-B2)**

- **FR-B07**: Empezar una tanda DEBE cerrar primero, en la misma acción, la tanda en curso cuyo
  tiempo ya se cumplió (completada, con sus minutos planeados) y después crear la nueva, sin
  importar cuánto tiempo pasó desde que empezó la anterior. Reafirma FR-004 y FR-005 de la 001.
- **FR-B08**: El sistema NO DEBE cerrar tandas por la hora del día ni marcarlas como abandonadas.
  Una tanda solo termina completada por tiempo o interrumpida con razón (decisión R-15 de la 001).

**Aperturas del plan (US-B3)**

- **FR-B09**: El reporte de cumplimiento de un rango DEBE incluir las aperturas de la vista de la
  semana cuyo día local cae en el rango: cuántas fueron libres, cuántas pasaron por la compuerta
  con razón, el total y las razones escritas en orden cronológico. Sin aperturas, los tres conteos
  DEBEN ser 0 y la lista de razones DEBE ir vacía. Las aperturas de planeación no cuentan.
- **FR-B10**: El reporte semanal congelado DEBE incluir el total de aperturas de su semana y
  cuántas fueron con razón, y el correo DEBE mostrarlos en una línea.
- **FR-B11**: Las aperturas NO DEBEN tener pantalla ni gráfica nueva.

**Día cumplido (US-B4)**

- **FR-B12**: La consulta de Hoy desde el asistente de IA y cada día del reporte de cumplimiento
  DEBEN exponer la evaluación desglosada: tandas completadas, mínimo requerido de la semana, si se
  cumplieron las tandas, si se cumplieron los hábitos y si el día quedó cumplido. Un día fuera del
  programa DEBE ir sin evaluación.
- **FR-B13**: La regla del día cumplido NO DEBE cambiar (FR-015 de la 001). Un hábito activo sin
  registro cuenta como no cumplido, y un hábito que no aplica ese día de la semana no se exige.
- **FR-B14**: La pantalla Hoy NO DEBE mostrar el mínimo requerido ni las tandas que faltan (FR-018
  de la 001 sigue vigente). El desglose es para el asistente de IA y los reportes.
- **FR-B15**: Un hábito sin días activos en el rango consultado NO DEBE aparecer en las fracciones
  de hábitos del reporte de cumplimiento ni del reporte semanal.

**Fricción del teléfono (US-B5)**

- **FR-B16**: El usuario DEBE poder registrar desde el asistente de IA cinco medidas de fricción:
  sin biometría, clave larga, escala de grises, redes fuera de la pantalla de inicio y app
  desinstalada. Cualquier otra DEBE rechazarse, incluida "celular afuera", que ya existe como
  hábito.
- **FR-B17**: Como máximo 2 medidas DEBEN estar habilitadas a la vez, incluso ante habilitaciones
  simultáneas. La tercera DEBE rechazarse con un mensaje que explique el límite: la restricción
  parcial aumenta el estrés reportado y una medida abandonada por irritación vale 0. Habilitar una
  medida ya habilitada, o deshabilitar una ya deshabilitada, NO DEBE cambiar nada.
- **FR-B18**: El usuario DEBE poder verificar que una medida habilitada sigue puesta en el
  teléfono. La consulta DEBE marcar como no confirmada toda medida habilitada que no se haya
  verificado desde que se habilitó. Verificar una medida no habilitada DEBE rechazarse.
- **FR-B19**: El usuario DEBE poder calificar de 0 a 10 cuánto le irritan las medidas, con una
  sola calificación por semana del programa: calificar otra vez la misma semana DEBE reemplazar la
  anterior. Calificar una semana que todavía no empieza DEBE rechazarse.
- **FR-B20**: Cuando dos semanas consecutivas del programa tengan calificación de 7 o más, el
  proceso programado DEBE deshabilitar la medida habilitada más recientemente, con motivo
  irritación. Cada par de semanas DEBE provocar como máximo un retiro aunque el proceso corra
  varias veces, y el retiro NO DEBE enviar avisos al teléfono.
- **FR-B21**: El reporte semanal DEBE mencionar las medidas retiradas por irritación durante su
  semana.
- **FR-B22**: La consulta de fricción DEBE devolver las medidas habilitadas, con su fecha de
  inicio y si están confirmadas, cuántas hay y la calificación de la semana en curso, o vacía si no
  hay calificación.
- **FR-B23**: Pure NO DEBE bloquear apps ni actuar sobre el teléfono. Solo registra; la ejecución
  la hace el sistema operativo del teléfono.

### Key Entities *(include if feature involves data)*

- **Medida de fricción**: una de las cinco medidas permitidas, con su estado (habilitada o no), la
  fecha de inicio de su última habilitación, el momento de su última verificación, la fecha de
  retiro y el motivo del retiro (manual o irritación).
- **Calificación de irritación**: puntaje de 0 a 10 de una semana del programa, con constancia de
  si el par que forma con la semana anterior ya provocó un retiro.
- **Apertura del plan** (existe desde la 001): ahora distingue las aperturas de la vista de la
  semana de las aperturas de planeación de una semana que todavía no empieza.
- **Evaluación del día** (derivada, no se guarda): tandas completadas, mínimo requerido, tandas
  cumplidas, hábitos cumplidos y día cumplido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-B01**: En los 10 domingos del programa, la planeación sin semana indicada resuelve la
  semana que arranca al día siguiente (10 de 10), y el sábado 12 resuelve la semana 1.
- **SC-B02**: 0 casos en que una tanda cuyo tiempo ya se cumplió impida empezar otra.
- **SC-B03**: Todo reporte semanal congelado después del despliegue muestra el total de aperturas
  de la vista de la semana, incluido cuando es 0.
- **SC-B04**: Para cualquier día del programa, el desglose basta para explicar con cifras por qué
  el día quedó cumplido o no, sin hacer otra consulta.
- **SC-B05**: Nunca hay más de 2 medidas de fricción habilitadas a la vez (0 casos), y cada par de
  semanas consecutivas con irritación de 7 o más retira exactamente 1 medida, si había alguna
  habilitada.
- **SC-B06**: El 100% de los escenarios no manuales de esta spec tiene una prueba automatizada
  nombrada con su ID, y ningún test cita un ID `US-Bn-ASm` que no exista.

## Assumptions

- Un solo usuario (Andres). La zona horaria es la de Bogotá.
- El programa ya está cargado desde el 2026-09-12: 10 semanas desde el lunes 14 de septiembre, con
  mínimo diario de 1 en la semana 1, 3 en la 2, 6 en la 3 y 8 de la 4 a la 10. Los hábitos son
  levantarse a las 6:00, celular fuera del cuarto y gym en la mañana, este último creado el
  2026-09-12 desde el asistente con los datos de US-B4.
- Las medidas de fricción, sus verificaciones y las calificaciones se registran desde el asistente
  de IA conectado, sin pantalla nueva (FR-040 de la 001).
- "Semana en curso" es la que contiene el día local de hoy. "Semanas consecutivas" son semanas del
  programa con números seguidos.
- El primer reporte semanal se congela el domingo 20 de septiembre a las 19:00. Lo que cambia su
  contenido (US-B3, US-B4 y US-B5) debería desplegarse antes; un reporte congelado antes del
  despliegue conserva su forma original.
- La pantalla Hoy, la vista de la semana y el asistente del domingo de la web siguen funcionando
  con la nueva resolución de semana sin cambios en la interfaz.
- Dependencias de la 001 que se reutilizan: semanas del programa, hábitos y sus registros, tandas y
  su cierre por tiempo, la vista de la semana con su compuerta, el reporte semanal congelado y el
  proceso programado.
- Fuera de alcance:
  - un estado "abandonada" para las tandas y cualquier cierre de tandas por hora del día;
  - bloquear apps o actuar sobre el teléfono;
  - pantallas o gráficas nuevas;
  - avisos nuevos en el teléfono (siguen solo los tres tipos de la 001);
  - calificar la irritación por medida (la calificación es una por semana).
- **Todo escenario no marcado `[manual]` lleva una prueba automatizada nombrada con su ID**
  (Constitución de PURE OS, Principio II: TDD obligatorio).
