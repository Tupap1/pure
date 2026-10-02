# Feature Specification: Foco — temporizador, cronómetro, objetivos y mapa de calor

**Feature Branch**: `004-foco-cronometro`

**Created**: 2026-10-02

**Status**: Aprobada por Andres (2026-10-02)

**Input**: User description: "Quiero un contador de sesiones como el de ahora, pero que si trabajo
45 minutos concentrado en algo, por ejemplo un problema de LeetCode, Pure lo registre según los
objetivos que tengamos. Que pueda poner un temporizador o un cronómetro, que Pure registre cuánto
tiempo enfocado tengo por semana, y una vista tipo mapa de calor de GitHub."

> **Trazabilidad**: cada escenario lleva un ID `US-Fn-ASm`. La letra F (foco) separa esta feature
> de la 001 (`USn-ASm`), la 002 (`US-Bn-ASm`) y la 003 (`US-Tn-ASm`). Cada escenario no marcado
> `[manual]` DEBE tener una prueba automatizada con su ID en el nombre (Constitución, Principio II).
>
> **Base**: esta feature extiende las tandas del Módulo de Ejecución (`specs/001-modulo-ejecucion/`,
> `specs/002-ejecucion-ajustes/`, `specs/003-tandas-variables/`). Lo que esta spec no cambia sigue
> rigiéndose por ellas. Una "sesión" de esta spec es una tanda: no se crea una entidad paralela,
> para que el historial completo de tandas alimente el mapa de calor desde el primer día.
>
> **Lo que esta feature reemplaza de la 003**:
> - FR-T01 y FR-T02 (rango 10–60) → FR-F02 y FR-F03: temporizador 10–180, cronómetro sin plan.
> - FR-T09 ("sin campo libre") → FR-F05: los cuatro botones siguen y se agrega un campo libre.
> - FR-T04 (unidades) se acota al temporizador; el cronómetro usa FR-F04.
> - Los tests de **US-T1-AS3** (61 min rechazado) y **US-T1-AS11** (sin campo libre) se reescriben
>   para fijar la regla nueva. Su nombre conserva el ID de la 003 y agrega el de la 004 que los
>   reemplaza (US-F1-AS3 y US-F1-AS8), así ninguna de las dos specs queda sin cobertura.
> - `log_late` (FR-T10/FR-T11) **no cambia**: sigue en 10–60 min y exige materia.
>
> **Lo que esta feature reemplaza de la 001**:
> - FR-018 ("la pantalla de inicio NO DEBE mostrar minutos totales") se relaja **solo** para el
>   total de minutos enfocados de la semana y el mapa de 12 semanas (FR-F18), por pedido explícito
>   de Andres. Se mantiene todo lo demás: Hoy no muestra minutos que faltan, metas, avance contra
>   la meta ni proyecciones de nota, y el pie de Hoy (US3-AS8) sigue sin minutos. La tabla con
>   metas vive solo en Command Center.
> - FR-008 se respeta: el selector de objetivo es opcional ("Sin objetivo" por defecto), el modo
>   temporizador/cronómetro no es el "modo de trabajo" de la tanda, y empezar sigue siendo un toque.

## Clarifications

### Session 2026-10-02

- Q: ¿Contra qué se registra el tiempo enfocado? → A: Contra objetivos propios (lista nueva: p. ej.
  LeetCode, Inglés, Proyecto personal) y contra las materias, tareas y entregas que ya existen.
- Q: ¿Los objetivos tienen meta? → A: Meta semanal opcional en minutos por objetivo, mostrada como
  cifra ("3 h 10 m · 5 h"), sin barras, anillos ni rachas.
- Q: ¿El tiempo del cronómetro cuenta para el mínimo diario del programa? → A: Solo si la sesión
  está ligada a algo académico (materia, tema, tarea o entrega) o si su objetivo tiene materia. Una
  sesión ligada solo a un objetivo sin materia suma minutos y aparece en el mapa, pero no cumple el
  mínimo. Las tandas sin ningún vínculo siguen contando como hoy.
- Q: ¿Dónde se ve? → A: En Hoy (total de la semana + mapa compacto) y en Command Center (mapa de un
  año + tabla por objetivo), reemplazando el mapa de 28 días actual.
- Q: ¿Frase del día? → A: Sí, en Hoy. 50 frases latinas con traducción y fuente, escritas por
  Claude (`frases.json` en esta carpeta) y cargadas por MCP. Amparada por la constitución 1.1.0.
- Q: ¿Qué pasa si olvido parar el cronómetro? → A: No hay tope. Se corrige por MCP en cualquier
  momento, solo acortando y dejando constancia del valor original.
- Q: ¿Un cronómetro que cruza la medianoche (y quizá el cierre de las 03:00) a qué día cuenta? → A:
  Se reparte: los minutos de cada día local van a ese día, para el mapa y para el mínimo. Aplica
  solo al cronómetro; el temporizador (máximo 180 minutos, duración elegida de antemano) sigue
  perteneciendo entero a su día de inicio, como en la 003. Si el cronómetro se cierra después del
  cierre de su día de inicio, queda marcado como edición tardía, visible como hoy.

## User Scenarios & Testing *(mandatory)*

### User Story F1 - Temporizador libre y cronómetro (Priority: P1)

Cuando me siento a resolver un problema de LeetCode no sé si serán 20 o 70 minutos. Quiero poner un
temporizador con los minutos que yo elija, o un cronómetro que corra hasta que lo pare, y que la
sesión quede registrada con sus minutos reales.

**Why this priority**: es el núcleo de la feature. Sin una forma de registrar sesiones de duración
real no hay nada que sumar ni que pintar en el mapa.

**Independent Test**: empezar un cronómetro, dejarlo correr 45 minutos y pararlo; empezar un
temporizador de 45 minutos y dejar que se cierre solo; comprobar minutos, estado y unidades.

**Acceptance Scenarios**:

1. **US-F1-AS1** — **Given** ninguna sesión en curso, **When** empiezo un cronómetro, **Then**
   queda en curso como cronómetro, sin duración planeada ni fin previsto, con la hora de inicio
   del servidor.
2. **US-F1-AS2** — **Given** un cronómetro en curso desde hace 3 horas y ninguna operación
   intermedia, **When** corre cualquier operación del módulo o el tic periódico, **Then** el
   cronómetro sigue en curso y no se envía ningún aviso de fin.
3. **US-F1-AS3** — **Given** el modo temporizador, **When** pido 45 o 180 minutos, **Then** queda
   en curso con esa duración planeada; **and when** pido 9, 181 o un número no entero, **Then** se
   rechaza con `DATOS_INVALIDOS` y no se crea nada. (Reemplaza la cota superior de US-T1-AS3.)
4. **US-F1-AS4** — **Given** un cronómetro en curso desde hace 45 minutos y 40 segundos, **When** lo
   termino, **Then** queda completado con 45 minutos reales y la hora de fin del servidor.
5. **US-F1-AS5** — **Given** un cronómetro en curso desde hace menos de 1 minuto, **When** intento
   terminarlo, **Then** se rechaza con `CRONOMETRO_MUY_CORTO` y sigue en curso; **and when** lo
   interrumpo con una razón, **Then** queda interrumpido con 0 minutos.
6. **US-F1-AS6** — **Given** la regla de unidades, **When** se evalúan un cronómetro completado de
   45, uno de 10 y uno de 9 minutos, y un temporizador completado de 8 minutos, **Then** valen 4,
   1, 0 y 1 unidades respectivamente.
7. **US-F1-AS7** — **Given** una sesión en curso de cualquier tipo, **When** intento empezar otra de
   cualquier tipo, **Then** se rechaza con `TANDA_EN_CURSO` y no se crea nada.
8. **US-F1-AS8** — **Given** la pantalla Hoy sin sesión en curso, **When** se resuelven sus
   opciones, **Then** el modo temporizador ofrece 10, 25, 40 y 60 minutos con 10 como opción
   primaria, más un campo libre que solo acepta enteros de 10 a 180; **and** el modo cronómetro
   ofrece una sola acción, Empezar. (Reemplaza la parte "sin campo libre" de US-T1-AS11.)
9. **US-F1-AS9** — **Given** un cronómetro en curso, **When** Hoy arma su vista, **Then** muestra el
   tiempo transcurrido hacia arriba (`h:mm:ss`) contado desde la hora de inicio del servidor y
   corregido por el desfase de reloj; **and given** un temporizador, **Then** sigue mostrando la
   cuenta atrás.
10. **US-F1-AS10** — **Given** un mínimo diario de 3 y un cronómetro de 23:00 a 01:30 como único
    registro de esos días, **When** se evalúan los dos días, **Then** el primero suma 60 minutos y
    6 unidades y el segundo 90 minutos y 9 unidades; **and given** un cronómetro que corrió de las
    22:00 del lunes a las 02:00 del miércoles, **Then** se reparte en 120, 1440 y 120 minutos entre
    lunes, martes y miércoles; **and** un temporizador de 23:30 a 00:30 sigue contando entero (60
    minutos, 6 unidades) para su día de inicio. [regresión del temporizador]
11. **US-F1-AS11** — **Given** un cronómetro que empezó el lunes, **When** lo termino el martes
    después de las 03:00, **Then** queda marcado como edición tardía, igual que cualquier cambio
    hecho después del cierre del día.

---

### User Story F2 - Objetivos (Priority: P1)

Quiero una lista corta de objetivos míos, como LeetCode, Inglés o Proyecto personal, y elegir uno
al empezar una sesión, además de poder elegir una materia como hoy. Un objetivo puede ir ligado a
una materia y puede tener una meta de minutos por semana.

**Why this priority**: sin objetivos, el tiempo de LeetCode no tiene dónde quedar, y la regla del
mínimo diario no podría distinguir lo académico de lo personal.

**Independent Test**: crear "LeetCode" (sin materia, meta 300) y "Algoritmos" (ligado a una
materia de Software); registrar una sesión en cada uno y comprobar qué cuenta para el mínimo.

**Acceptance Scenarios**:

1. **US-F2-AS1** — **Given** ningún objetivo, **When** creo "LeetCode" sin materia y con meta de
   300 minutos semanales, **Then** queda activo y aparece al leer los objetivos.
2. **US-F2-AS2** — **Given** un objetivo activo "LeetCode", **When** creo otro llamado " leetcode "
   **Then** se rechaza con `OBJETIVO_DUPLICADO`; **and when** creo uno con una materia inexistente,
   **Then** `NO_ENCONTRADO`; **and when** la meta es 0, negativa o mayor que 10080, **Then**
   `DATOS_INVALIDOS`. En ningún caso se crea nada.
3. **US-F2-AS3** — **Given** un objetivo activo, **When** empiezo una sesión con él, **Then** la
   sesión queda ligada al objetivo; **and given** un objetivo archivado o inexistente, **Then** se
   rechaza con `OBJETIVO_ARCHIVADO` o `NO_ENCONTRADO` y no se crea nada.
4. **US-F2-AS4** — **Given** un mínimo diario de 3 y, como único registro del día, un cronómetro
   completado de 60 minutos ligado a "Inglés" (objetivo sin materia), **When** se evalúa el día,
   **Then** el día suma 60 minutos enfocados, 0 unidades, y el mínimo no se cumple.
5. **US-F2-AS5** — **Given** un mínimo diario de 3 y un objetivo "Algoritmos" ligado a una materia,
   **When** se evalúa un día con una sola sesión completada de 30 minutos en ese objetivo, **Then**
   cuenta 3 unidades y el mínimo se cumple.
6. **US-F2-AS6** — **Given** una sesión ligada a "Inglés" (sin materia) que además tiene una materia
   propia, **When** se evalúa el día, **Then** cuenta para el mínimo, porque tiene vínculo
   académico directo.
7. **US-F2-AS7** — **Given** una tanda de 10 minutos sin objetivo ni ningún otro vínculo, **When** se
   evalúa el día en Hoy, en el reporte de cumplimiento y en la lectura de tandas, **Then** cuenta
   1 unidad, igual que antes de esta feature. [regresión]
8. **US-F2-AS8** — **Given** un objetivo con sesiones históricas, **When** lo archivo, **Then** deja
   de ofrecerse para empezar sesiones, y sus sesiones siguen sumando en los totales y en el mapa;
   **and when** actualizo nombre, materia o meta de un objetivo activo, **Then** el cambio se
   guarda con las mismas validaciones que al crear.
9. **US-F2-AS9** — **Given** objetivos activos y materias, **When** Hoy arma el selector de
   objetivo, **Then** lista "Sin objetivo" (opción por defecto), luego los objetivos activos en
   orden alfabético y luego las materias; los archivados no aparecen.
10. **US-F2-AS10** — **Given** una sesión cerrada, **When** la reclasifico con otro objetivo,
    **Then** cambia su objetivo sin tocar sus tiempos, y queda marcada como edición tardía si fue
    después del cierre del día, como cualquier reclasificación.
11. **US-F2-AS11** — **Given** la web, **When** crea, lee, actualiza o archiva objetivos, **Then**
    lo hace con el mismo handler que el MCP y obtiene los mismos resultados y errores.

---

### User Story F3 - Tiempo enfocado por semana y mapa de calor (Priority: P2)

Quiero ver cuánto tiempo enfocado llevo esta semana, por objetivo y frente a mi meta, y un mapa de
calor por día como el de GitHub para ver mi constancia del último año.

**Why this priority**: es lo que convierte el registro en información. Depende de F1 y F2, pero
con el historial de tandas que ya existe tiene datos reales desde el primer día.

**Independent Test**: con sesiones sembradas en varios días y semanas, pedir el resumen y comprobar
cada cifra a mano; ver el mapa en Hoy y en Command Center.

**Acceptance Scenarios**:

1. **US-F3-AS1** — **Given** un día con un temporizador completado de 25 minutos, uno interrumpido
   a los 12 y un cronómetro completado de 45, **When** pido el resumen, **Then** ese día suma 82
   minutos enfocados: las interrumpidas cuentan como foco, aunque no den unidades.
2. **US-F3-AS2** — **Given** sesiones de lunes a domingo de esta semana y una del domingo anterior,
   **When** pido el resumen, **Then** el total de la semana suma solo las de lunes a domingo de esta
   semana, en la zona horaria local; **and** un temporizador que empezó el domingo a las 23:50
   cuenta entero para el domingo.
3. **US-F3-AS3** — **Given** que pido 52 semanas, **When** se arma el resumen, **Then** los días van
   del lunes de hace 51 semanas hasta hoy, sin huecos: los días sin sesiones traen 0, no se omiten.
4. **US-F3-AS4** — **Given** sesiones de esta semana con objetivo, solo con materia y sin ningún
   vínculo, **When** pido la tabla por objetivo, **Then** cada sesión cae en una sola fila (su
   objetivo; si no tiene, su materia; si no, "Sin objetivo"), la suma de las filas es el total de
   la semana, y cada objetivo con meta muestra sus minutos y su meta, aunque lleve 0 esta semana.
5. **US-F3-AS5** — **Given** un filtro por objetivo, **When** pido el resumen, **Then** solo suman
   las sesiones de ese objetivo; **and given** un filtro por materia, **Then** suman las sesiones con
   esa materia y las de objetivos ligados a esa materia.
6. **US-F3-AS6** — **Given** la escala del mapa, **When** se clasifican días de 0, 1, 30, 31, 90,
   91, 180 y 181 minutos, **Then** caen en los niveles 0, 1, 1, 2, 2, 3, 3 y 4.
7. **US-F3-AS7** — **Given** una sesión en curso, una corregida y una de un objetivo archivado,
   **When** pido el resumen, **Then** la sesión en curso no suma todavía, la corregida suma sus
   minutos corregidos y la del objetivo archivado suma normalmente.
8. **US-F3-AS8** — **Given** el resumen, **When** se arma la rejilla, **Then** cada columna es una
   semana de lunes a domingo y cada fila un día (L…D); Hoy pinta 12 semanas y Command Center 52; los
   días futuros de la semana en curso quedan vacíos, sin nivel.
9. **US-F3-AS9** — **Given** el mismo rango y filtro, **When** se pide el resumen por la web y por
   MCP, **Then** las dos respuestas son idénticas.
10. **US-F3-AS10** `[manual]` — **Given** Command Center a 375 px y en escritorio, **When** se abre,
    **Then** el mapa de un año reemplaza al de 28 días, se desplaza horizontalmente sin desbordar la
    página, usa la escala sobria de `DESIGN.md` con leyenda en cifras, no muestra rachas, y no hay
    errores de consola.
11. **US-F3-AS11** — **Given** un cronómetro del domingo 23:00 al lunes 01:00, **When** pido el
    resumen, **Then** el domingo suma 60 minutos a la semana que termina y el lunes suma 60 a la
    semana que empieza; **and** un resumen que empieza el lunes incluye esos 60 minutos aunque la
    sesión haya empezado el domingo.

---

### User Story F4 - Corregir un cronómetro olvidado (Priority: P2)

Si dejo el cronómetro corriendo y me voy, quiero pedirle al asistente que lo corrija a la hora en
que de verdad paré, en cualquier momento, sin que eso sirva para inflar mis datos.

**Why this priority**: el cronómetro no tiene tope por decisión explícita. La corrección es la red
de seguridad que hace aceptable esa decisión.

**Independent Test**: dejar un cronómetro corriendo 8 horas, corregirlo a 70 minutos por MCP y
comprobar minutos, unidades, marca de corrección y reporte; intentar alargar una sesión.

**Acceptance Scenarios**:

1. **US-F4-AS1** — **Given** un cronómetro en curso desde las 14:00 y son las 22:00, **When** lo
   corrijo con fin 15:10 y razón "olvidé pararlo", **Then** queda completado con 70 minutos, marcado
   como corregido, con fin original 22:00 y 480 minutos originales, y ya no hay sesión en curso.
2. **US-F4-AS2** — **Given** una sesión cerrada de 14:00 a 18:00 (240 minutos), **When** la corrijo
   con fin 15:00, **Then** queda en 60 minutos, conserva fin original 18:00 y 240 minutos
   originales, y mantiene su estado.
3. **US-F4-AS3** — **Given** una sesión cerrada o un cronómetro en curso, **When** pido un fin
   posterior al fin registrado (o posterior a ahora, si está en curso), o anterior a su inicio más
   1 minuto, **Then** se rechaza con `CORRECCION_INVALIDA` y nada cambia: una corrección nunca
   alarga.
4. **US-F4-AS4** — **Given** una sesión ya corregida, **When** la corrijo otra vez acortándola más,
   **Then** se acepta y conserva como original el valor de antes de la primera corrección.
5. **US-F4-AS5** — **Given** una sesión de hace dos semanas, cuyo día cerró a las 03:00 hace mucho,
   **When** la corrijo, **Then** se acepta: la corrección está disponible siempre.
6. **US-F4-AS6** — **Given** una corrección sin razón o con razón de más de 140 caracteres, **When**
   la envío, **Then** se rechaza con `DATOS_INVALIDOS`; **and given** un temporizador en curso,
   **Then** se rechaza con `CORRECCION_INVALIDA`, porque para cortarlo existe interrumpir.
7. **US-F4-AS7** — **Given** un mínimo diario de 3 y un cronómetro de 480 minutos como único
   registro del día, **When** lo corrijo a 20 minutos, **Then** el día pasa a 2 unidades y el
   mínimo deja de cumplirse.
8. **US-F4-AS8** — **Given** una semana en la que se hicieron dos correcciones que recortaron 410 y
   30 minutos,
   **When** pido el reporte de cumplimiento y el payload del reporte semanal, **Then** los dos traen
   `correcciones = { total: 2, minutos_recortados: 440 }`; **and given** una semana sin ninguna,
   **Then** traen `{ total: 0, minutos_recortados: 0 }`, nunca nulo ni ausente.
9. **US-F4-AS9** — **Given** la web, **When** intenta corregir una sesión, **Then** la lista blanca
   lo rechaza: la corrección solo existe por MCP. [regresión del patrón de `log_late`]

---

### User Story F5 - Frase del día (Priority: P3)

Al abrir Hoy quiero ver una frase en latín con su traducción, como "Fortes fortuna adiuvat — La
suerte sonríe a los valientes", distinta cada día.

**Why this priority**: es un acompañamiento, no una medida. Va al final porque nada depende de
ella, y existe solo por la excepción acotada de la constitución 1.1.0.

**Independent Test**: cargar las 50 frases de `frases.json` por MCP, consultar Hoy dos veces el
mismo día y en días distintos.

**Acceptance Scenarios**:

1. **US-F5-AS1** — **Given** ninguna frase, **When** cargo las 50 de `frases.json` en una sola
   operación, **Then** quedan 50 activas; **and when** repito la misma carga, **Then** no se crea
   ninguna nueva y la respuesta informa 0 creadas y 50 omitidas (la comparación ignora mayúsculas y
   espacios en los extremos del texto latino).
2. **US-F5-AS2** — **Given** una carga en la que una frase no tiene texto, o su texto o traducción
   pasa de 300 caracteres, o su fuente pasa de 120, **When** la envío, **Then** se rechaza entera
   con `DATOS_INVALIDOS` y no se escribe ninguna frase.
3. **US-F5-AS3** — **Given** N ≥ 2 frases activas, **When** consulto Hoy dos veces el mismo día
   local, **Then** recibo la misma frase; **and** dos días consecutivos reciben frases distintas;
   **and** en N días consecutivos sale cada frase exactamente una vez.
4. **US-F5-AS4** — **Given** ninguna frase activa, **When** consulto Hoy, **Then** la frase del día
   viene vacía (nula) y la pantalla no muestra nada en su lugar: ni hueco ni texto de relleno.
5. **US-F5-AS5** — **Given** una frase desactivada, **When** corre la rotación, **Then** esa frase no
   vuelve a salir.
6. **US-F5-AS6** — **Given** la web, **When** intenta crear o modificar frases, **Then** la lista
   blanca lo rechaza: las frases solo entran por MCP y Hoy solo las lee.
7. **US-F5-AS7** — **Given** una frase con traducción y fuente, **When** Hoy arma la línea, **Then**
   muestra el latín y debajo "traducción · fuente"; **and given** una frase sin traducción, **Then**
   muestra el latín y la fuente.

---

### Edge Cases

- **Cronómetro que cruza la medianoche o el cierre de las 03:00**: sus minutos se reparten entre
  los días locales que abarca, cortando en cada medianoche local, para el mapa y para el mínimo
  (FR-F14a). Si se cierra después del cierre de su día de inicio, queda marcado como edición
  tardía. Un cronómetro olvidado durante varios días se reparte en todos ellos hasta que se
  corrija.
- **Temporizador que cruza la medianoche**: no se reparte. Pertenece entero a su día de inicio,
  como en la 003.
- **Cronómetro corriendo cuando se congela el reporte semanal** (domingo 19:00): igual que una
  tanda que hoy cruza esa hora, el reporte congelado no lo incluye; el resumen de foco, que se
  calcula al leer, sí lo incluye cuando se cierre.
- **Objetivo ligado a una materia que luego se borra**: el objetivo queda sin materia (la referencia
  se anula) y sus sesiones futuras dejan de contar para el mínimo; las ya registradas se evalúan con
  la regla vigente al leer, porque el cumplimiento se calcula al vuelo.
- **Sesión con objetivo y con materia distinta a la del objetivo**: en la tabla por objetivo cae en
  la fila del objetivo; en el filtro por materia aparece bajo las dos materias.
- **Corrección de una sesión que ya está en el reporte congelado**: el reporte congelado no se
  reescribe; la corrección aparece en el reporte de la semana en que se hizo y en el resumen de
  foco, que siempre se calcula al leer.
- **Interrumpir un cronómetro**: sigue exigiendo razón, como cualquier tanda; sus minutos suman al
  foco y dan 0 unidades.

## Requirements *(mandatory)*

### Functional Requirements

**Sesiones (temporizador y cronómetro)**

- **FR-F01**: Una sesión DEBE ser de uno de dos tipos: temporizador (con duración planeada) o
  cronómetro (sin duración planeada ni fin previsto). Las tandas existentes son temporizadores.
- **FR-F02**: Empezar un temporizador DEBE aceptar una duración entera de 10 a 180 minutos, con 10
  por defecto. Fuera de rango: `DATOS_INVALIDOS` sin escribir nada.
- **FR-F03**: La base de datos DEBE garantizar la regla de FR-F01/FR-F02 con una restricción que
  corra en el arnés de pruebas (Principio III), en reemplazo de la de la 003.
- **FR-F04**: Una sesión completada DEBE valer `max(1, floor(minutos / 10))` unidades si es
  temporizador y `floor(minutos / 10)` si es cronómetro. En un cronómetro repartido entre días, la
  regla se aplica a los minutos de cada día por separado (FR-F14a). La regla vive en una única
  función pura.
- **FR-F05**: Hoy DEBE ofrecer el modo temporizador (10, 25, 40 y 60 en un toque, 10 como primaria,
  más un campo libre de 10 a 180) y el modo cronómetro (una acción, Empezar).
- **FR-F06**: Un cronómetro NO DEBE cerrarse por tiempo ni disparar el aviso de fin. Solo se cierra
  al terminarlo, al interrumpirlo o al corregirlo.
- **FR-F07**: Terminar un cronómetro DEBE registrar la hora del servidor y los minutos enteros
  transcurridos; si no ha pasado al menos 1 minuto, DEBE rechazarse con `CRONOMETRO_MUY_CORTO`.
- **FR-F08**: Como máximo DEBE haber una sesión en curso, sin importar su tipo (`TANDA_EN_CURSO`).
- **FR-F09**: Hoy DEBE mostrar el tiempo transcurrido de un cronómetro en curso (`h:mm:ss`) y la
  cuenta atrás de un temporizador, ambos desde la hora del servidor y corregidos por el desfase.

**Objetivos**

- **FR-F10**: Un objetivo DEBE tener nombre (1–60 caracteres, único entre los activos sin importar
  mayúsculas ni espacios en los extremos), materia opcional, meta semanal opcional (entero de 1 a
  10080 minutos) y un estado activo o archivado. No se borran: se archivan.
- **FR-F11**: Los objetivos DEBEN poder crearse, leerse, actualizarse y archivarse por MCP y por la
  web, con un único handler compartido.
- **FR-F12**: Una sesión DEBE poder ligarse a un objetivo activo al empezar, y reclasificarse a otro
  objetivo después, sin tocar sus tiempos.
- **FR-F13**: Una sesión DEBE contar para el mínimo diario salvo que tenga objetivo, ese objetivo no
  tenga materia y la sesión no tenga materia, tema, tarea ni entrega propios. Esta regla vive en una
  única función pura que usan Hoy, el reporte de cumplimiento, la lectura de tandas y el tic.

**Tiempo enfocado y mapa de calor**

- **FR-F14**: Los minutos enfocados de un día DEBEN ser la suma de los minutos reales de sus
  sesiones completadas e interrumpidas, por día local de inicio (salvo el reparto del cronómetro,
  FR-F14a). Las sesiones en curso no suman.
- **FR-F14a**: Un cronómetro que abarca más de un día local DEBE repartir sus minutos entre esos
  días, cortando en cada medianoche local (`PURE_TZ`), tanto para los minutos enfocados como para
  las unidades del mínimo. El temporizador no se reparte. El reparto se calcula al leer: la sesión
  sigue guardada una sola vez, con su día de inicio. Un cronómetro que se cierra después del cierre
  de su día de inicio DEBE quedar marcado como edición tardía.
- **FR-F15**: El resumen de foco DEBE exponer, para un rango de N semanas (52 por defecto) y un
  filtro opcional por objetivo o materia: los minutos de cada día (0 explícito en días vacíos), el
  total de cada semana de lunes a domingo, el total de la semana actual y la tabla por objetivo de
  la semana actual con minutos y meta.
- **FR-F16**: En la tabla por objetivo cada sesión DEBE caer en una sola fila (objetivo, si no
  materia, si no "Sin objetivo"), y la suma de filas DEBE igualar el total de la semana.
- **FR-F17**: El mapa DEBE clasificar cada día en 5 niveles fijos: 0, 1–30, 31–90, 91–180 y más de
  180 minutos, con una leyenda que diga esas cifras.
- **FR-F18**: Hoy DEBE mostrar el total de la semana y un mapa de 12 semanas, sin metas, minutos
  faltantes ni avance contra la meta (FR-018 de la 001 sigue vigente para todo lo demás); Command
  Center DEBE mostrar un mapa de 52 semanas con filtro por objetivo y la tabla por objetivo, en
  lugar del mapa de 28 días actual. Ninguno DEBE mostrar rachas.
- **FR-F19**: El resumen DEBE poder pedirse por la web y por MCP con el mismo resultado.

**Corrección**

- **FR-F20**: Una corrección DEBE poder hacerse solo por MCP, en cualquier momento, incluso después
  del cierre del día. Exige razón (1–140 caracteres).
- **FR-F21**: Sobre una sesión cerrada, la corrección DEBE solo acortar: el fin nuevo cae entre el
  inicio más 1 minuto y el fin registrado. Sobre un cronómetro en curso, lo cierra como completado
  con un fin entre el inicio más 1 minuto y la hora del servidor. Un temporizador en curso no se
  corrige. Fuera de esas cotas: `CORRECCION_INVALIDA` sin cambios.
- **FR-F22**: La corrección DEBE marcar la sesión como corregida, guardar la hora del servidor en
  que se hizo, recalcular sus minutos y conservar el fin y los minutos originales de antes de la
  primera corrección.
- **FR-F23**: El reporte de cumplimiento y el payload del reporte semanal DEBEN exponer
  `correcciones: { total, minutos_recortados }`, contadas por la semana local en que se hizo la
  corrección, con ceros explícitos cuando no hubo ninguna.
- **FR-F24**: La corrección es la segunda entrada del módulo que acepta un instante del cliente,
  después de `log_late`. Es una excepción documentada al Principio III: solo puede reducir datos,
  conserva el original y queda visible. No crea sesiones ni alarga ninguna.

**Frase del día**

- **FR-F25**: Las frases (texto latino 1–300, traducción opcional hasta 300, fuente opcional hasta
  120, activa o no) DEBEN entrar solo por MCP: una a una o en carga múltiple, que es todo o nada e
  idempotente por texto latino. La web no puede crearlas ni modificarlas.
- **FR-F26**: La frase del día DEBE elegirse por rotación determinista sobre las frases activas en
  orden estable, según la fecha local: el mismo día da la misma frase y en N días seguidos sale cada
  una de las N exactamente una vez.
- **FR-F27**: Hoy DEBE mostrar la frase como texto plano (latín, y debajo traducción · fuente), sin
  icono, animación ni color de acento, y no mostrar nada si no hay frases activas (constitución
  1.1.0, Principio V).

### Key Entities

- **Sesión (tanda)**: gana un tipo (temporizador o cronómetro), un objetivo opcional y los datos de
  corrección (marca, momento de la corrección, fin original, minutos originales, razón). La duración planeada solo existe en
  el temporizador.
- **Objetivo**: algo hacia lo que va el tiempo enfocado y que no tiene por qué ser una materia
  (LeetCode, Inglés). Tiene nombre, materia opcional, meta semanal opcional y estado.
- **Frase**: texto latino, traducción y fuente, activa o no. Solo la carga el MCP.
- **Resumen de foco**: concepto derivado, no almacenado: minutos por día, por semana y por objetivo
  en un rango.
- **Unidad**: derivada, no almacenada. Ahora depende del tipo de sesión (FR-F04) y de si la sesión
  cuenta para el mínimo (FR-F13).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-F01**: Una sesión de 45 minutos en LeetCode se registra desde Hoy con dos toques (empezar y
  terminar el cronómetro) y queda con 45 minutos ligada al objetivo.
- **SC-F02**: El total de la semana que muestra Hoy coincide al minuto con la suma de las sesiones
  cerradas de lunes a domingo.
- **SC-F03**: El mapa de un año aparece en menos de 1 segundo con un año de sesiones registradas.
- **SC-F04**: Un cronómetro olvidado se corrige con una sola instrucción al asistente, y el valor
  original sigue consultable.
- **SC-F05**: Ninguna tanda existente cambia sus unidades por esta feature: los días ya cumplidos
  siguen cumplidos.
- **SC-F06**: `npm run test:all` en verde, con un test por escenario no manual de esta spec.

## Assumptions

- Todas las tandas existentes pasan a ser temporizadores sin objetivo, así que entran al mapa desde
  el primer día con su regla de unidades actual.
- El campo libre del temporizador acepta solo minutos enteros. No hay segundos ni horas.
- La tabla por objetivo muestra la semana actual. Las semanas anteriores se ven en el mapa, no en
  la tabla.
- "Esta semana" va de lunes a domingo en la zona `PURE_TZ`, igual que el reporte semanal.
- Las 50 frases las escribió Claude a pedido de Andres. Andres puede editar `frases.json` antes de
  la carga; la carga no se hace en migraciones (Principio I).
- El mapa de 28 días actual y su lógica se retiran si no queda ningún otro uso.

### Fuera de alcance

- Pausar una sesión: se termina y se empieza otra.
- Un recordatorio push para un cronómetro que lleva mucho tiempo corriendo.
- Usar las horas DME de cada materia como meta automática.
- Frases desde una API externa.
- Registro tardío ligado a un objetivo sin materia (`log_late` no cambia).
