# Feature Specification: Módulo de Ejecución

**Feature Branch**: `001-modulo-ejecucion`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Módulo de Ejecución. Hoy Pure sabe qué hay que estudiar pero no sabe si se estudió; el módulo cierra ese loop tomando como unidad la tanda de 10 minutos. Alcance: tandas de un toque con tiempos del servidor; un solo disparador si-entonces vigente; hábitos diarios y 'día cumplido' sin deuda; Pure instalable en el iPhone y detrás de login; proyección de nota por materia con techo y flags; reporte semanal congelado que se envía por correo a una persona con consentimiento; avisos push mínimos; planeación del domingo con tareas de 1 a 3 tandas; vista semanal con compuerta. Tests obligatorios según la constitución, Principio II."

> Convención de trazabilidad: cada escenario de aceptación lleva un ID `USn-ASm`. Cada escenario
> no marcado `[manual]` DEBE tener una prueba automatizada con ese ID en su nombre (Constitución,
> Principio II). Los `[manual]` se verifican con el quickstart de la feature.

## Clarifications

### Session 2026-09-11

- Q: ¿Por qué canal sale el reporte semanal? → A: Por correo, enviado con ZeptoMail desde el
  dominio propio `btw-one.com`; las respuestas del destinatario llegan al buzón de Andres.
- Q: ¿Cómo se usa Pure en el iPhone y cómo llegan los avisos? → A: Como app instalada desde el
  navegador en la pantalla de inicio, con avisos del sistema. No pasa por ninguna tienda de
  aplicaciones.
- Q: ¿Qué se ve al abrir Pure y qué pasa con la barra inferior móvil, que ya tiene 6 destinos?
  → A: Hoy es la pantalla de inicio y el primer destino. En móvil, Configuración sale de la barra
  inferior y se abre desde el encabezado; en escritorio sigue en la barra lateral.
- Q: ¿Puede el diseño depender de que Pure corra en un equipo de la casa? → A: No. Pure migrará a
  servicios gratuitos, así que los procesos programados y los canales de salida deben poder
  moverse sin rediseño.
- Q: ¿Quién es el destinatario inicial del reporte y hay consentimiento? → A: El propio Andres,
  con consentimiento dado el 2026-09-11. Más adelante puede cambiarse por otra persona.
- Q: ¿Con qué método se especifica y se construye la feature? → A: Spec-Driven Development con
  Spec Kit y TDD obligatorio: cada escenario no manual tiene su prueba, escrita antes que el
  código.
- Q: ¿Qué define el veredicto semanal? → A: "Cumplida" con 6 o 7 días cumplidos, "fallida" con 3
  o menos y "parcial" en los demás casos. Así quedó en el plan aprobado; los umbrales los puede
  ajustar Andres.
- Q: ¿Qué materias entran en la sección "En riesgo" del reporte? → A: Las perdidas, las que
  necesitan 3.5 o más en lo que falta para aprobar (con la cifra y la próxima evaluación), las
  abandonadas y, en una sola línea, las ciegas. Así quedó en el plan aprobado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tanda de 10 minutos en un toque (Priority: P1)

Abro Pure y con un solo toque empiezo 10 minutos de estudio. El tiempo corre aunque bloquee el
teléfono o lo deje en otra parte. No se puede pausar, y si corto antes tengo que decir por qué.
La tanda cuenta para el día en que la empecé.

**Why this priority**: la tanda es la unidad de ejecución; sin ella nada del módulo existe. La
prueba de diseño es poder empezar a estudiar con un toque desde que se abre la app.

**Independent Test**: comprobar que al abrir Pure la primera pantalla es Hoy. Empezar una tanda,
recargar la app, bloquear el teléfono y comprobar que la tanda se completa sola a los 10 minutos.
Después, intentar una segunda tanda simultánea y una interrupción sin razón.

**Acceptance Scenarios**:

1. **US1-AS1** — **Given** no hay ninguna tanda en curso, **When** empiezo una tanda, **Then**
   queda en curso con la hora de inicio que fija el sistema (no la del dispositivo) y su fin
   previsto 10 minutos después.
2. **US1-AS2** — **Given** ya hay una tanda en curso, **When** intento empezar otra, **Then** el
   sistema la rechaza indicando que ya hay una tanda en curso.
3. **US1-AS3** — **Given** hay una tanda en curso cuyo tiempo ya se cumplió mientras el teléfono
   estaba bloqueado, **When** ocurre cualquier operación del módulo, **Then** la tanda queda
   completada con 10 minutos y puedo empezar otra.
4. **US1-AS4** — **Given** una tanda en curso a la que le queda tiempo, **When** intento
   terminarla, **Then** el sistema lo rechaza: solo puedo interrumpirla.
5. **US1-AS5** — **Given** una tanda en curso, **When** la interrumpo sin escribir una razón,
   **Then** se rechaza; **and when** la interrumpo con una razón de una línea, **Then** queda
   interrumpida con los minutos que realmente transcurrieron.
6. **US1-AS6** — **Given** una tanda cerrada el día anterior, **When** le cambio la materia
   después de las 03:00 de hoy, **Then** el cambio se guarda y la tanda queda marcada como editada
   tras el cierre.
7. **US1-AS7** — **Given** empiezo una tanda a las 23:55 hora de Bogotá, **When** se evalúan los
   días, **Then** la tanda cuenta para el día en que empezó, aunque termine después de medianoche.
8. **US1-AS8** — **Given** reabro Pure con una tanda en curso y el reloj del teléfono desfasado,
   **When** se muestra el conteo, **Then** el tiempo restante se calcula con la hora del sistema y
   no con la del teléfono.
9. **US1-AS9** — **Given** abro Pure, **When** carga, **Then** la primera pantalla es Hoy; **and
   given** estoy en un teléfono, **Then** la barra inferior no incluye Configuración y la abro
   desde el encabezado.

---

### User Story 2 - Un solo disparador vigente (Priority: P1)

Mis planes están escritos como "Si pasa X, entonces hago Y". Pure me muestra solo el que toca
ahora, nunca la lista del día ni el siguiente, y registra si lo cumplí.

**Why this priority**: releer el plan completo reduce su efecto. Un único disparador vigente
convierte el plan en acción, y es lo primero que ve el usuario al abrir la app.

**Independent Test**: crear tres disparadores para hoy con horas distintas, comprobar a distintas
horas cuál se muestra, responderlos y comprobar que desaparecen.

**Acceptance Scenarios**:

1. **US2-AS1** — **Given** tengo varios disparadores para hoy, **When** abro la pantalla de
   inicio, **Then** solo aparece uno: el de hora de referencia más reciente ya pasada y sin
   respuesta.
2. **US2-AS2** — **Given** el siguiente disparador todavía no llega, **When** abro la pantalla de
   inicio, **Then** ese disparador no aparece.
3. **US2-AS3** — **Given** ya respondí un disparador hoy, **When** vuelvo a la pantalla de inicio,
   **Then** ese disparador no vuelve a aparecer hoy.
4. **US2-AS4** — **Given** un disparador "al salir de la clase de Química", **When** termina esa
   clase según el horario, **Then** el disparador aparece, y usa el día y la alternancia de
   sábados de esa clase.
5. **US2-AS5** — **Given** un disparador de sábado B, **When** es sábado A, **Then** no aparece.
6. **US2-AS6** — **Given** intento crear un disparador que incluye duración, número de tandas o
   método de estudio, **When** lo guardo, **Then** se rechaza explicando que un disparador solo
   dice cuándo y qué.
7. **US2-AS7** — **Given** un disparador de estudio vigente, **When** toco "Empezar tanda",
   **Then** el disparador queda como hecho y la tanda queda ligada al disparador y a su materia.
8. **US2-AS8** — **Given** un disparador de hábito vigente, **When** respondo "No", **Then** ese
   hábito queda como no cumplido hoy.
9. **US2-AS9** — **Given** ya ensayé un disparador esta semana, **When** lo ensayo otra vez,
   **Then** no se registra un segundo ensayo.
10. **US2-AS10** — **Given** un disparador sin respuesta cuya hora pasó hace más de 4 horas,
    **When** abro la pantalla de inicio, **Then** no aparece.

---

### User Story 3 - Hábitos del día y día cumplido (Priority: P1)

Marco si me levanté a tiempo y si dejé el celular fuera del cuarto. Pure decide si el día quedó
cumplido según esos hábitos y el mínimo de tandas de la semana, sin arrastrar deudas de días
anteriores.

**Why this priority**: levantarse a tiempo es el ancla de todo el sistema. El "día cumplido" es
la medida que alimenta el reporte semanal.

**Independent Test**: con la semana 1 del programa (mínimo 1 tanda) y dos hábitos activos,
registrar combinaciones y comprobar el resultado de cada día, el cierre de las 03:00 y la edición
de semanas.

**Acceptance Scenarios**:

1. **US3-AS1** — **Given** todos los hábitos activos marcados como cumplidos y al menos el mínimo
   de tandas completadas, **When** se evalúa el día, **Then** el día queda cumplido.
2. **US3-AS2** — **Given** un hábito activo sin registro, **When** se evalúa el día, **Then** el
   día no queda cumplido.
3. **US3-AS3** — **Given** un hábito marcado como "no aplica", **When** se evalúa el día,
   **Then** ese hábito no impide que el día quede cumplido.
4. **US3-AS4** — **Given** ayer no hice ninguna tanda, **When** empieza hoy, **Then** el mínimo
   de hoy es el de la semana, sin sumar lo que faltó ayer.
5. **US3-AS5** — **Given** ya pasaron las 03:00 de hoy, **When** intento registrar un hábito de
   ayer, **Then** se rechaza porque el día ya cerró.
6. **US3-AS6** — **Given** un hábito que empieza el 28 de septiembre, **When** se evalúa el 20 de
   septiembre, **Then** ese hábito no se exige.
7. **US3-AS7** — **Given** la semana en curso del programa, **When** intento cambiar su mínimo
   diario, **Then** se rechaza; **and when** cambio el mínimo de una semana que aún no empieza,
   **Then** se acepta.
8. **US3-AS8** — **Given** hábitos de hoy sin responder, **When** veo la pantalla de inicio,
   **Then** aparecen como filas Sí/No que desaparecen al responder, y en ningún caso veo "te
   faltan", minutos totales ni proyecciones de nota.

---

### User Story 4 - Pure en el iPhone, detrás de login (Priority: P1)

Instalo Pure desde el navegador del iPhone en la pantalla de inicio y lo abro como una app. Nadie
más puede entrar.

**Why this priority**: las tandas se empiezan desde el teléfono. Sin acceso móvil seguro, el
módulo no se puede usar el lunes 14.

**Independent Test**: instalar Pure desde el navegador del iPhone y abrirlo desde el ícono; desde
otro navegador sin sesión, intentar entrar.

**Acceptance Scenarios**:

1. **US4-AS1** `[manual]` — **Given** abro Pure en el navegador del iPhone, **When** lo agrego a
   la pantalla de inicio y lo abro desde el ícono, **Then** se abre a pantalla completa con el
   nombre y el ícono de Pure.
2. **US4-AS2** `[manual]` — **Given** alguien sin sesión, **When** intenta abrir Pure desde
   internet, **Then** se le pide autenticarse y no ve ningún dato.
3. **US4-AS3** — **Given** la configuración de instalación de la app, **When** se inspecciona,
   **Then** declara apertura a pantalla completa, íconos de 192 y 512 px y los colores del
   sistema de diseño.

---

### User Story 5 - Proyección de nota por materia (Priority: P2)

Por materia veo cuánto necesito sacar en lo que falta para aprobar y para mi meta, y mi techo
real. Si los datos no alcanzan para calcular, Pure me avisa en vez de mostrar números falsos.

**Why this priority**: es el dato que dice dónde conviene poner las tandas, y alimenta el reporte
del domingo.

**Independent Test**: cargar las evaluaciones de Química (1.7 en el 20% y el resto pendiente) y
comprobar las cifras; cargar pesos que no suman 100% y comprobar que no se calculan.

**Acceptance Scenarios**:

1. **US5-AS1** — **Given** Química con 1.7 en una evaluación del 20%, el 80% pendiente,
   aprobatoria 3.0 y meta 4.5, **When** se proyecta la nota, **Then** la necesaria para aprobar es
   3.33, la necesaria para la meta es 5.20 (marcada inalcanzable), el techo es 4.34 y el aporte
   acumulado es 0.34.
2. **US5-AS2** — **Given** una materia cuyos pesos suman 105%, **When** se proyecta, **Then** se
   marca "pesos inconsistentes" y no se calculan la necesaria ni el techo.
3. **US5-AS3** — **Given** una evaluación marcada "completado" sin nota, **When** se proyecta,
   **Then** se marca "entregado sin nota".
4. **US5-AS4** — **Given** una evaluación pendiente cuya fecha ya pasó, **When** se proyecta,
   **Then** se marca "vencido sin registrar".
5. **US5-AS5** — **Given** una materia cuyo techo es menor que la aprobatoria, **When** se
   proyecta, **Then** se marca "materia perdida".
6. **US5-AS6** — **Given** una materia sin evaluaciones registradas, **When** se generan alertas,
   **Then** se marca como "ciega"; **and given** una materia con una evaluación en menos de 7 días
   y ninguna tanda en los últimos 7 días, **Then** se marca como "abandonada".
7. **US5-AS7** — **Given** una evaluación "entregada" con nota, **When** se calcula la nota
   actual en cualquier vista, **Then** esa evaluación cuenta como calificada.

---

### User Story 6 - Reporte semanal congelado por correo (Priority: P2)

Cada domingo a las 19:00 Pure congela los números de mi semana. Tengo una hora para escribir una
nota, y a las 20:00 el reporte sale por correo a mi destinatario, pase lo que pase.

**Why this priority**: según el documento de evidencia, rendir cuentas ante otra persona es la
palanca de mayor efecto. Tiene que funcionar para el domingo 20 de septiembre.

**Independent Test**: con los datos de una semana simulada, llegar al domingo 19:00, escribir la
nota, llegar a las 20:00 y comprobar que sale un único correo con los números congelados.

**Acceptance Scenarios**:

1. **US6-AS1** — **Given** son las 19:00 del domingo, **When** corre el proceso programado,
   **Then** el reporte de la semana se congela con los datos hasta ese instante.
2. **US6-AS2** — **Given** un reporte congelado, **When** registro tandas después, **Then** los
   números del reporte no cambian.
3. **US6-AS3** — **Given** un reporte congelado y la ventana de nota abierta, **When** escribo mi
   nota, **Then** se guarda; **and when** lo intento después del cierre de la ventana, **Then** se
   rechaza.
4. **US6-AS4** — **Given** son las 20:00 y la ventana de nota cerró, **When** el proceso
   programado corre una o varias veces, **Then** el reporte se envía exactamente una vez.
5. **US6-AS5** — **Given** no escribí nota, **When** se envía el reporte, **Then** dice "Andrés
   no dio explicación."
6. **US6-AS6** — **Given** el envío falla, **When** pasan los reintentos, **Then** hay como
   máximo 3 intentos espaciados, el reporte queda como fallido y el de la semana siguiente lo
   menciona.
7. **US6-AS7** — **Given** dos semanas seguidas con veredicto "fallida", **When** se envía el
   segundo reporte, **Then** incluye la línea "Segunda semana fallida. Si puedes, llámalo."
8. **US6-AS8** — **Given** el sistema estuvo apagado el domingo a las 19:00, **When** vuelve a
   funcionar, **Then** congela con el corte original del domingo, abre una ventana de nota de 60
   minutos y el reporte avisa del retraso.
9. **US6-AS9** — **Given** no hay un destinatario con consentimiento, **When** toca enviar,
   **Then** el reporte queda fallido por falta de destinatario; **and given** intento registrar un
   destinatario sin fecha de consentimiento, **Then** se rechaza.
10. **US6-AS10** — **Given** una semana con datos, **When** se congela el reporte, **Then**
    contiene los días cumplidos sobre 7, los días cumplidos acumulados frente al horizonte, cada
    hábito como fracción, el veredicto, la sección "En riesgo" y el número de ediciones tardías.
11. **US6-AS11** — **Given** el domingo entre el congelamiento y el envío, **When** abro Pure,
    **Then** veo el reporte congelado y la caja para mi nota, y en ningún lugar de la interfaz web
    aparece el correo del destinatario.

---

### User Story 7 - Avisos en el teléfono (Priority: P3)

Recibo un aviso cuando termina mi tanda, para poder dejar el celular lejos mientras estudio, y
cuando se congela el reporte. Nunca recibo recordatorios del plan.

**Why this priority**: sin aviso, dejar el teléfono lejos durante la tanda obliga a vigilar el
reloj. No bloquea el arranque, porque la tanda se completa sola igual.

**Independent Test**: activar los avisos en la app instalada, empezar una tanda, bloquear el
teléfono y recibir el aviso a los 10 minutos.

**Acceptance Scenarios**:

1. **US7-AS1** — **Given** la app instalada, **When** activo los avisos con un gesto y pido una
   prueba, **Then** mi dispositivo queda registrado y el aviso de prueba llega.
2. **US7-AS2** — **Given** una tanda en curso con el teléfono bloqueado, **When** se cumplen los
   10 minutos, **Then** llega un único aviso "Terminó la tanda" a lo sumo 20 segundos después.
3. **US7-AS3** — **Given** se congela el reporte, **When** ocurre, **Then** llega un aviso con la
   hora límite de la nota; **and given** falla el envío del reporte, **Then** llega un aviso del
   fallo.
4. **US7-AS4** — **Given** un dispositivo cuya suscripción expiró, **When** se intenta avisarle,
   **Then** la suscripción se elimina.
5. **US7-AS5** — **Given** cualquier día con disparadores configurados, **When** transcurre el
   día, **Then** no se envía ningún recordatorio del plan (solo los tres tipos de aviso
   permitidos).

---

### User Story 8 - Planeación del domingo y tareas (Priority: P4)

El domingo reviso la semana que pasó, las entregas de los próximos 14 días y mi intención con cada
materia. Preparo los disparadores de la semana, los ensayo una vez y parto el trabajo en tareas de
1 a 3 tandas.

**Why this priority**: mejora la calidad del plan semanal, pero no bloquea el arranque del lunes;
los primeros disparadores se cargan a mano.

**Independent Test**: recorrer la planeación con datos reales y comprobar las intenciones, los
disparadores sugeridos y las tareas.

**Acceptance Scenarios**:

1. **US8-AS1** — **Given** registro una intención menor a 6 para una materia, **When** se
   sugieren disparadores, **Then** esa materia no recibe ninguno y el sistema me pregunta por qué.
2. **US8-AS2** — **Given** creo una tarea estimada en más de 3 tandas, **When** la guardo,
   **Then** se rechaza pidiendo partirla.
3. **US8-AS3** — **Given** tareas de ayer sin hacer, **When** empieza hoy, **Then** no aparecen
   arrastradas como pendientes de hoy.
4. **US8-AS4** — **Given** mis materias con sus créditos, **When** veo el reparto sugerido de
   tandas, **Then** sale de las horas de trabajo independiente de la norma de créditos, con la
   urgencia y la proyección en columnas aparte.
5. **US8-AS5** — **Given** es domingo, **When** abro la planeación, **Then** veo la semana pasada,
   las entregas de los próximos 14 días con sus alertas, las intenciones, los disparadores de la
   semana y el ensayo de cada uno.

---

### User Story 9 - Semana con compuerta y alertas en la agenda (Priority: P4)

Puedo ver mi semana dos veces por semana sin dar explicaciones; desde la tercera, explico por
qué. La agenda me alerta de materias abandonadas o sin evaluaciones.

**Why this priority**: consultar el plan a diario reduce el automatismo. La compuerta vuelve la
consulta deliberada y medible, y no hace falta para arrancar.

**Independent Test**: abrir la vista de la semana tres veces en una misma semana y comprobar que
la tercera pide razón y queda contada; revisar las alertas en la agenda.

**Acceptance Scenarios**:

1. **US9-AS1** — **Given** ya abrí la vista de la semana dos veces esta semana, **When** la abro
   una tercera vez, **Then** se me pide una razón, que queda registrada y se cuenta en el reporte.
2. **US9-AS2** — **Given** una semana con disparadores y tandas, **When** abro la vista de la
   semana, **Then** veo cada disparador con su resultado y las tandas por día, sin gráficas.
3. **US9-AS3** — **Given** materias abandonadas o sin evaluaciones, **When** abro la agenda,
   **Then** veo esas alertas.

---

### Edge Cases

- ¿Qué pasa con una tanda que cruza la medianoche? Cuenta para el día en que empezó (US1-AS7).
- ¿Y si el reloj del teléfono está desfasado? El conteo usa la hora del sistema (US1-AS8).
- ¿Y si no hay conexión con Pure? La pantalla lo indica y permite reintentar. Sin conexión no se
  puede empezar una tanda, porque la hora la fija el sistema.
- ¿Y si dos dispositivos empiezan una tanda al mismo tiempo? Solo una puede quedar en curso.
- ¿Y si se borra la clase de un disparador "al salir de clase"? El disparador queda huérfano: no
  se muestra y se marca para revisión.
- ¿Sábados alternos? Los disparadores de sábado siguen la alternancia A/B de la universidad.
- ¿Días fuera del programa? Las tandas funcionan igual, pero el día no se evalúa.
- ¿Tandas del domingo después de las 19:00? No entran en el reporte ya congelado.
- ¿Sistema apagado a la hora del reporte? Se pone al día al volver, con el corte original
  (US6-AS8).
- ¿Falla el servicio de correo? Hasta 3 reintentos y luego queda fallido visible (US6-AS6).
- ¿Se cambia el destinatario a mitad de semana? Se usa el vigente en el momento del
  congelamiento.
- ¿El iPhone no tiene Pure instalado? No hay avisos, y Pure indica cómo instalarlo.
- ¿Se negó el permiso de avisos? Pure indica cómo activarlo en los ajustes del teléfono.
- ¿La suscripción de avisos expiró? Se elimina y deja de intentarse (US7-AS4).

## Requirements *(mandatory)*

### Functional Requirements

**Tandas**

- **FR-001**: El sistema DEBE permitir empezar una tanda de estudio de 10 minutos con un solo
  toque desde la pantalla de inicio, sin exigir elegir materia antes. La pantalla de inicio
  siempre usa 10 minutos; solo desde el asistente de IA puede fijarse otra duración, entre 5 y 25
  minutos.
- **FR-002**: El sistema DEBE registrar el inicio y el fin de cada tanda con la hora oficial del
  sistema. NO DEBE aceptar horas aportadas por el dispositivo ni permitir registrar tandas en
  retrospectiva.
- **FR-003**: El sistema NO DEBE permitir pausar una tanda. Cortarla antes de tiempo solo DEBE
  ser posible interrumpiéndola con una razón de una línea (máximo 140 caracteres).
- **FR-004**: El sistema DEBE garantizar que exista como máximo una tanda en curso, incluso ante
  dos inicios simultáneos desde dispositivos distintos.
- **FR-005**: El sistema DEBE cerrar como completada una tanda cuyo tiempo se cumplió, aunque la
  app esté cerrada o el teléfono bloqueado, sin que nadie la termine manualmente.
- **FR-006**: Cada tanda DEBE pertenecer al día local en que empezó (zona horaria configurable,
  por defecto Bogotá), aunque termine después de medianoche.
- **FR-007**: Los datos de un día DEBEN cerrarse a las 03:00 del día siguiente. Editar una tanda
  después de ese cierre DEBE permitirse, pero la tanda queda marcada como edición tardía.
- **FR-008**: Materia, tema, tarea y modo de trabajo de una tanda DEBEN ser opcionales. La
  materia DEBE poder asignarse al terminar, y el modo de trabajo NUNCA DEBE preguntarse.

**Disparadores**

- **FR-009**: Un disparador DEBE expresarse como "Si <señal>, entonces <acción>", con una señal de
  5 a 80 caracteres y una acción de 5 a 90. NO DEBE admitir duración, número de tandas ni método
  de estudio.
- **FR-010**: El sistema DEBE soportar señales de hora, al salir de una clase del horario, tras
  un hábito y de lugar. Toda señal DEBE tener una hora de referencia para ordenarse. Las señales
  de clase DEBEN tomar esa hora del fin de la clase y heredar su día y su alternancia de sábados.
- **FR-011**: La pantalla de inicio DEBE mostrar como máximo un disparador: el de hora de
  referencia más reciente ya pasada, sin respuesta y con menos de 4 horas de antigüedad. NUNCA
  DEBE mostrar el siguiente ni la lista del día.
- **FR-012**: La respuesta a un disparador (hecho / no) DEBE registrarse por día. En un
  disparador de estudio, "hecho" DEBE iniciar una tanda ligada a él y a su materia. En uno de
  hábito, la respuesta DEBE fijar el registro de ese hábito para el día.
- **FR-013**: Cada disparador DEBE poder ensayarse como máximo una vez por semana del programa.

**Hábitos y día cumplido**

- **FR-014**: Un hábito DEBE considerarse activo solo entre su fecha de inicio y su fecha de
  retiro, y solo en los días de la semana configurados.
- **FR-015**: Un día DEBE contar como cumplido si las tandas completadas alcanzan el mínimo de su
  semana y todos los hábitos activos están marcados como cumplidos o "no aplica". Un hábito sin
  registro DEBE contar como no cumplido.
- **FR-016**: El mínimo diario NO DEBE acumular deuda de días anteriores ni ajustarse
  automáticamente.
- **FR-017**: El programa DEBE organizarse en semanas que empiezan en lunes, cada una con su fase
  y su mínimo diario. Solo DEBEN poder modificarse las semanas que aún no han empezado.
- **FR-018**: La pantalla de inicio NO DEBE mostrar minutos totales, tandas faltantes ni
  proyecciones de nota. Solo DEBE mostrar las tandas hechas hoy (a partir de la primera) y si el
  día quedó cumplido.

**Reporte semanal**

- **FR-019**: Cada domingo a las 19:00 (hora local), el sistema DEBE congelar el reporte de la
  semana con los datos hasta ese instante. Los números congelados NO DEBEN cambiar después.
- **FR-020**: El usuario DEBE poder agregar una nota de hasta 400 caracteres, solo durante los 60
  minutos siguientes al congelamiento. Ningún otro dato del reporte DEBE ser editable.
- **FR-021**: Al cerrar la ventana de nota, el sistema DEBE enviar el reporte por correo una
  sola vez a un único destinatario que haya dado su consentimiento, con o sin nota. Sin nota, el
  reporte DEBE decir "<nombre> no dio explicación."
- **FR-022**: El reporte DEBE incluir:
  - los días cumplidos sobre 7;
  - los días cumplidos acumulados desde el inicio frente al horizonte del hábito (66 días por
    defecto);
  - cada hábito como fracción;
  - el veredicto: "cumplida" con 6 o 7 días cumplidos, "fallida" con 3 o menos, "parcial" en los
    demás casos;
  - la sección "En riesgo": materias perdidas, materias que necesitan 3.5 o más en lo que falta
    para aprobar (con la cifra y la próxima evaluación), materias abandonadas y una sola línea con
    las materias ciegas;
  - la nota literal del usuario;
  - el número de ediciones tardías;
  - si el reporte anterior no pudo enviarse;
  - una línea adicional tras dos semanas fallidas seguidas.
- **FR-023**: Si el envío falla, el sistema DEBE reintentarlo como máximo 3 veces, espaciadas en
  el tiempo. Después DEBE marcarlo como fallido, de forma visible para el usuario, y mencionarlo
  en el reporte siguiente.
- **FR-024**: Si el sistema estuvo apagado a la hora del congelamiento o del envío, al volver
  DEBE congelar con el corte original, abrir la ventana de nota y avisar del retraso en el
  reporte.
- **FR-025**: La dirección de correo del destinatario NUNCA DEBE mostrarse en la interfaz web.

**Proyección de nota**

- **FR-026**: Para cada materia, el sistema DEBE calcular, con la escala y la nota aprobatoria de
  su universidad:
  - el aporte acumulado y el promedio evaluado;
  - el peso restante;
  - la nota necesaria para aprobar y para la meta, redondeadas hacia arriba;
  - el techo alcanzable, redondeado hacia abajo.
- **FR-027**: El sistema DEBE marcar los siguientes casos:
  - materia **ciega**: no tiene evaluaciones registradas;
  - pesos que no suman 100% (en ese caso no calcula cifras);
  - evaluación entregada sin nota;
  - evaluación pendiente vencida;
  - meta inalcanzable;
  - materia perdida.
- **FR-028**: El sistema DEBE elevar a alerta dos de esos casos, para el reporte y para la agenda:
  - materia **abandonada**: tiene una evaluación en menos de 7 días y ninguna tanda en los
    últimos 7 días;
  - materia **ciega**: la misma condición marcada en FR-027, sin nombre alterno.
- **FR-029**: Una evaluación DEBE considerarse calificada cuando tiene nota y no está pendiente.
  El estado heredado "completado" DEBE tratarse como "entregado".

**Acceso móvil y avisos**

- **FR-030**: Pure DEBE poder instalarse en la pantalla de inicio del iPhone desde el navegador,
  sin pasar por ninguna tienda de aplicaciones, y abrirse a pantalla completa con su nombre y su
  ícono.
- **FR-031**: Ninguna parte de Pure DEBE ser accesible desde internet sin autenticación previa.
- **FR-032**: El sistema DEBE enviar avisos solo de tres tipos. NUNCA DEBE enviar recordatorios
  del plan.
  - fin de tanda: una vez, a lo sumo 20 segundos después de cumplirse;
  - reporte congelado, con la hora límite de la nota;
  - fallo de envío del reporte.
- **FR-033**: El permiso de avisos DEBE pedirse solo como respuesta a un gesto del usuario. Las
  suscripciones inválidas o expiradas DEBEN eliminarse.

**Planeación y semana**

- **FR-034**: El usuario DEBE poder registrar una intención de 0 a 10 por materia y semana. Con
  una intención menor a 6, la materia NO DEBE recibir disparadores sugeridos y el sistema DEBE
  preguntar por qué.
- **FR-035**: Una tarea DEBE estimarse entre 1 y 3 tandas; si requiere más, el sistema DEBE pedir
  partirla. Las tareas no hechas NO DEBEN arrastrarse al día siguiente.
- **FR-036**: El reparto sugerido de tandas entre materias DEBE derivarse de las horas de trabajo
  independiente que exige la norma colombiana de créditos (48 h por crédito por semestre). La
  urgencia y la proyección DEBEN mostrarse como columnas aparte.
- **FR-037**: La vista de la semana DEBE poder abrirse libremente 2 veces por semana. Desde la
  tercera, DEBE pedir una razón, que se registra y se cuenta en el reporte.

**Operación**

- **FR-038**: Todas las capacidades del módulo DEBEN poder operarse desde el asistente de IA
  conectado a Pure, con las mismas reglas que la interfaz web.
- **FR-039**: Los procesos programados (cierre de tandas, congelamiento, envío y avisos) DEBEN
  poder repetirse sin efectos duplicados, y dispararse tanto desde el propio sistema como desde un
  programador externo.
- **FR-040**: El programa, los hábitos, los disparadores y el destinatario del reporte DEBEN
  cargarse exclusivamente a través del asistente de IA conectado, sin datos incrustados en el
  sistema.

**Navegación**

- **FR-041**: Hoy DEBE ser la primera pantalla al abrir Pure y el primer destino de la
  navegación. En móvil, Configuración NO DEBE ocupar la barra inferior y DEBE abrirse desde el
  encabezado. En escritorio, la barra lateral conserva todos los destinos.

### Key Entities *(include if feature involves data)*

- **Semana del programa**: tramo de lunes a domingo con número, fase (arranque, consolidación,
  automatización) y mínimo diario de tandas.
- **Hábito**: conducta diaria con nombre, fecha de inicio, fecha de retiro opcional, días de la
  semana en que aplica y horizonte en días (66 por defecto).
- **Registro de hábito**: estado de un hábito en un día (cumplido, no cumplido, no aplica), con
  valor y nota opcionales.
- **Disparador**: plan "si-entonces" con tipo de señal, textos de señal y acción, hora de
  referencia, días de la semana, alternancia de sábados y, según el caso, la clase, la materia o
  el hábito que le corresponden.
- **Respuesta a disparador**: si un disparador se cumplió o no en un día determinado.
- **Ensayo**: constancia de que un disparador se ensayó en una semana del programa.
- **Tarea**: unidad de trabajo de 1 a 3 tandas, ligada a una materia y opcionalmente a una
  evaluación o a un tema, con fecha programada y estado.
- **Tanda**: bloque de 10 minutos con inicio y fin fijados por el sistema, día local, estado (en
  curso, completada, interrumpida), razón de interrupción, marca de edición tardía y vínculos
  opcionales a materia, tema, evaluación, tarea o disparador.
- **Destinatario del reporte**: persona con nombre, correo y fecha de consentimiento; solo uno
  vigente a la vez.
- **Reporte semanal**: números congelados de una semana, veredicto, nota del usuario, momento del
  congelamiento, límite de la nota, estado de envío e intentos.
- **Suscripción de avisos**: dispositivo registrado para recibir avisos.
- **Intención**: fuerza (0 a 10) y razón para una materia en una semana del programa.
- **Apertura del plan**: cada vez que se consulta la vista de la semana, con su razón si pasó por
  la compuerta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde que se abre la app en el iPhone hasta que la tanda está corriendo: 1 toque y
  menos de 3 segundos.
- **SC-002**: Ninguna tanda registrada tiene horas aportadas por el dispositivo ni fechas
  retroactivas (0 casos).
- **SC-003**: Cada semana del programa, el reporte se envía exactamente una vez: el domingo entre
  las 20:00 y las 20:15, o al volver el sistema si estuvo apagado.
- **SC-004**: El aviso de fin de tanda llega a lo sumo 20 segundos después de cumplirse los 10
  minutos, en al menos el 95% de las tandas con el teléfono bloqueado.
- **SC-005**: La proyección de Química reproduce exactamente 3.33 (aprobar), 5.20 (meta) y 4.34
  (techo).
- **SC-006**: Al final de la semana 3, los datos registrados permiten comparar la tasa de
  interrupción por razón y por materia.
- **SC-007**: El 100% de los escenarios de aceptación no manuales tienen una prueba automatizada
  nombrada con su ID.

## Assumptions

- Un solo usuario (Andres). La zona horaria por defecto es la de Bogotá y es configurable.
- La escala de notas y la nota aprobatoria son las de cada universidad (típicamente 0 a 5, con
  aprobatoria 3.0).
- "Evaluación" y "entrega" designan la misma entidad existente de Pure: un ítem con peso en la
  nota y fecha límite.
- "Destinatario" es la persona que recibe el reporte; en el código y en los contratos aparece como
  *partner* (`accountability_partners`).
- Pure permanece encendido mientras no se migre a un hosting externo. Si estuvo apagado, al
  volver se pone al día (FR-024).
- El correo sale desde el buzón de Andres, así que las respuestas del destinatario le llegan a él.
- El destinatario inicial del reporte es el propio Andres, con consentimiento dado el
  2026-09-11. Puede cambiarse por otra persona sin cambios en el sistema. El documento de
  evidencia advierte que el efecto grande depende de que el reporte lo lea otra persona.
- El iPhone tiene iOS 16.4 o superior, requisito para instalar la app y recibir avisos.
- Delante de la web hay un servicio de autenticación del dominio (FR-031).
- El programa arranca el lunes 14 de septiembre de 2026. El programa, los hábitos, los
  disparadores y el destinatario se cargan desde el asistente de IA (FR-040).
- **Todo escenario de aceptación no marcado `[manual]` lleva una prueba automatizada nombrada con
  su ID** (Constitución de PURE OS, Principio II: TDD obligatorio).
- Dependencias existentes que se reutilizan: el horario de clases con su alternancia de sábados,
  las evaluaciones de cada materia, las escalas de cada universidad y el conector del asistente
  de IA.
- Fuera de alcance:
  - pantalla de racha, puntos, insignias o gráficas nuevas;
  - recordatorios del plan;
  - un programador de repaso propio (las flashcards existentes no cuentan para el mínimo diario);
  - duración o método en los disparadores;
  - deuda acumulada;
  - bloqueador de apps;
  - varios destinatarios;
  - aprobación manual del reporte;
  - registro de tandas pasadas;
  - un reparto fijo 70/20/10.
