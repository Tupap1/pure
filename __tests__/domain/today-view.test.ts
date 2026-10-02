import { describe, it, expect } from 'vitest';
import {
  clockOffset,
  secondsLeft,
  formatCountdown,
  resolveConnectionState,
  buildTodayFooterView,
  describeStartFailure,
  formatLocalTime,
  tandaDurationOptions,
  parseFreeMinutes,
  elapsedSeconds,
  formatElapsed,
  describeFinishFailure,
  objectiveSelectorOptions,
  startTargetFromSelection,
  OBJECTIVE_NONE_VALUE,
} from '../../lib/execution/today-view';

describe('[001] US1 — Tanda de 10 minutos en un toque', () => {
  it('US1-AS8 · el tiempo restante se calcula con la hora del sistema, no con la del teléfono desfasado', () => {
    // server_now real al momento de la consulta: 15:00:00Z. El reloj del cliente está 5 minutos
    // ADELANTADO cuando se captura el offset (server_now - Date.now()).
    const serverNowAtFetch = '2026-09-14T15:00:00.000Z';
    const clientNowAtFetch = new Date('2026-09-14T15:05:00.000Z').getTime();
    const offsetMs = clockOffset(serverNowAtFetch, clientNowAtFetch);
    expect(offsetMs).toBe(-5 * 60 * 1000);

    // La tanda termina a las 15:10:00Z (10 minutos después del server_now real capturado).
    const endsAt = '2026-09-14T15:10:00.000Z';

    // Pasa 1 minuto real. El reloj del cliente (todavía desfasado +5min) ahora marca 15:06:00Z.
    // Con el offset corregido, el "ahora" real es 15:01:00Z y deberían quedar 9 minutos (540s),
    // no los 4 minutos que daría una lectura cruda de Date.now() sin corregir.
    const clientNowAtTick = new Date('2026-09-14T15:06:00.000Z').getTime();
    expect(secondsLeft(endsAt, offsetMs, clientNowAtTick)).toBe(9 * 60);
  });

  it('formatCountdown devuelve mm:ss', () => {
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(59)).toBe('00:59');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00'); // nunca un contador negativo
  });

  it('sin datos del servidor, el modelo expone el estado "sin conexión" (caso borde de spec.md)', () => {
    expect(resolveConnectionState(null)).toBe('offline');
    expect(resolveConnectionState(undefined)).toBe('offline');
    expect(resolveConnectionState({ server_now: '2026-09-14T15:00:00.000Z' })).toBe('online');
  });
});

describe('[001] US3 — Hábitos del día y día cumplido', () => {
  it('US3-AS8 · los hábitos de hoy sin responder aparecen como filas Sí/No, sin minutos totales ni proyecciones de nota', () => {
    const withPending = buildTodayFooterView({
      pending_checks: [{ habit_id: 'levantada', label: 'Levantarme a las 6:00' }],
      tandas_today: 0,
      day_fulfilled: null,
    });
    expect(withPending.checks).toEqual([{ habit_id: 'levantada', label: 'Levantarme a las 6:00' }]);
    expect(withPending.tandasLine).toBeNull(); // sin tandas hoy: FR-018 no muestra "0 tandas"
    expect(withPending.dayFulfilledLine).toBeNull();

    const dayDone = buildTodayFooterView({ pending_checks: [], tandas_today: 3, day_fulfilled: true });
    expect(dayDone.checks).toEqual([]);
    expect(dayDone.tandasLine).toBe('3 tandas hoy');
    expect(dayDone.dayFulfilledLine).toBe('Día cumplido');

    // FR-018/FR-008: el modelo nunca expone minutos totales, mínimo faltante, proyecciones de
    // nota ni un selector de modo de trabajo — solo trae estas tres claves.
    expect(Object.keys(dayDone).sort()).toEqual(['checks', 'dayFulfilledLine', 'tandasLine']);
  });
});

describe('[003] US-T3 — Inicio fallido visible e inicio con hora confirmada', () => {
  it('US-T3-AS1 · si el servidor rechaza un start, describeStartFailure devuelve el mensaje del servidor', () => {
    const errorResult = { status: 'error', code: 'DATOS_INVALIDOS', message: 'Duración inválida' };
    expect(describeStartFailure(errorResult)).toBe('Duración inválida');

    const errorWithoutMessage = { status: 'error', code: 'ERROR_DESCONOCIDO' };
    expect(describeStartFailure(errorWithoutMessage)).toBe(
      'No se pudo empezar la tanda. Revisa la conexión e inténtalo otra vez.'
    );
  });

  it('US-T3-AS2 · si el fetch lanza (sin red), describeStartFailure devuelve aviso de conexión', () => {
    const noConnectionResult = { status: 'error', code: 'SIN_CONEXION', message: 'Sin conexión con Pure.' };
    expect(describeStartFailure(noConnectionResult)).toBe(
      'No se pudo empezar la tanda. Revisa la conexión e inténtalo otra vez.'
    );

    // Sin respuesta del servidor
    expect(describeStartFailure(null)).toBe('No se pudo empezar la tanda. Revisa la conexión e inténtalo otra vez.');
    expect(describeStartFailure(undefined)).toBe('No se pudo empezar la tanda. Revisa la conexión e inténtalo otra vez.');
  });

  it('US-T3-AS3 · formatLocalTime devuelve HH:MM en zona local', () => {
    // En zona 'es-CO' (Colombia)
    const iso1 = '2026-09-21T14:30:00.000Z';
    const formatted1 = formatLocalTime(iso1);
    // Esperamos HH:MM en formato 24h, basado en la zona local del test
    expect(formatted1).toMatch(/^\d{2}:\d{2}$/);

    const iso2 = '2026-09-21T00:05:30.000Z';
    const formatted2 = formatLocalTime(iso2);
    expect(formatted2).toMatch(/^\d{2}:\d{2}$/);
  });

  it('US-T3-AS1 · cuando status es success, describeStartFailure devuelve null', () => {
    const successResult = { status: 'success' };
    expect(describeStartFailure(successResult)).toBeNull();
  });
});

describe('[003] US-T1 — Tandas de duración variable', () => {
  it('US-T1-AS10 · el pie muestra "unidades de mínimo tandas" cuando hay programa, "tandas hoy" sin programa, y null con cero', () => {
    // Con programa: una tanda de 60 minutos (6 unidades) y mínimo 3
    const withProgram = buildTodayFooterView({
      pending_checks: [],
      tandas_today: 1,
      day_fulfilled: null,
      unidades_hoy: 6,
      min_requerido: 3,
    });
    expect(withProgram.tandasLine).toBe('6 de 3 tandas');
    expect(Object.keys(withProgram).sort()).toEqual(['checks', 'dayFulfilledLine', 'tandasLine']);

    // Sin programa: mínimo ausente, vuelve al formato antiguo
    const withoutProgram = buildTodayFooterView({
      pending_checks: [],
      tandas_today: 3,
      day_fulfilled: null,
      unidades_hoy: 3,
      min_requerido: null,
    });
    expect(withoutProgram.tandasLine).toBe('3 tandas hoy');

    // Sin programa: mínimo nulo, formato antiguo
    const noMinRequired = buildTodayFooterView({
      pending_checks: [],
      tandas_today: 2,
      day_fulfilled: null,
      unidades_hoy: 2,
    });
    expect(noMinRequired.tandasLine).toBe('2 tandas hoy');

    // Cero unidades: null (FR-018)
    const noTandas = buildTodayFooterView({
      pending_checks: [],
      tandas_today: 0,
      day_fulfilled: null,
      unidades_hoy: 0,
      min_requerido: 3,
    });
    expect(noTandas.tandasLine).toBeNull();
  });

  it('US-T1-AS11 · US-F1-AS8 · tandaDurationOptions devuelve [10, 25, 40, 60] con 10 como primaria, y ahora existe el campo libre', () => {
    const options = tandaDurationOptions();

    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ minutes: 10, isDefault: true });
    expect(options[1]).toEqual({ minutes: 25, isDefault: false });
    expect(options[2]).toEqual({ minutes: 40, isDefault: false });
    expect(options[3]).toEqual({ minutes: 60, isDefault: false });

    // US-F1-AS8: los presets no cambian; lo nuevo es el campo libre (parseFreeMinutes).
    expect(parseFreeMinutes('45')).toEqual({ ok: true, minutes: 45 });
  });

  it('US-T1-AS10 · el pie conserva el comportamiento con solo tandas_today (regresión)', () => {
    const legacyInput = buildTodayFooterView({
      pending_checks: [{ habit_id: 'test', label: 'Test' }],
      tandas_today: 2,
      day_fulfilled: null,
    });
    expect(legacyInput.tandasLine).toBe('2 tandas hoy');
    expect(legacyInput.checks).toEqual([{ habit_id: 'test', label: 'Test' }]);
    expect(Object.keys(legacyInput).sort()).toEqual(['checks', 'dayFulfilledLine', 'tandasLine']);
  });
});

describe('[004] US-F1 — Temporizador y cronómetro en Hoy', () => {
  it('US-F1-AS8 · el campo libre solo acepta enteros de 10 a 180; fuera de eso devuelve un error en español', () => {
    // Válidos, incluidos los dos bordes del rango 10–180 (FR-F05).
    expect(parseFreeMinutes('45')).toEqual({ ok: true, minutes: 45 });
    expect(parseFreeMinutes('10')).toEqual({ ok: true, minutes: 10 });
    expect(parseFreeMinutes('180')).toEqual({ ok: true, minutes: 180 });
    expect(parseFreeMinutes(' 90 ')).toEqual({ ok: true, minutes: 90 }); // espacios alrededor no estorban

    // Inválidos: por debajo, por encima, no entero y vacío. Todos con un mensaje legible para Andres.
    for (const raw of ['9', '181', '12.5', '', '   ', 'abc', '-20', '1e2']) {
      const result = parseFreeMinutes(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/[a-záéíóúñ]/i);
        expect(result.error.length).toBeGreaterThan(10);
      }
    }

    // El mensaje del rango nombra los límites de la regla: 10 y 180.
    const tooShort = parseFreeMinutes('9');
    const tooLong = parseFreeMinutes('181');
    expect(tooShort.ok === false && tooShort.error).toContain('10');
    expect(tooShort.ok === false && tooShort.error).toContain('180');
    expect(tooLong.ok === false && tooLong.error).toContain('180');
  });

  it('US-F1-AS9 · el tiempo transcurrido del cronómetro se cuenta desde la hora de inicio del servidor, corregido por el desfase del reloj', () => {
    // Mismo escenario que US1-AS8: el reloj del cliente va 5 minutos ADELANTADO.
    const serverNowAtFetch = '2026-09-14T15:00:00.000Z';
    const clientNowAtFetch = new Date('2026-09-14T15:05:00.000Z').getTime();
    const offsetMs = clockOffset(serverNowAtFetch, clientNowAtFetch);

    // El servidor registró el inicio a las 14:58:00Z: al hacer el fetch ya llevaba 120 s.
    const startedAt = '2026-09-14T14:58:00.000Z';
    expect(elapsedSeconds(startedAt, offsetMs, clientNowAtFetch)).toBe(120);

    // Pasa 1 minuto real: el reloj del cliente marca 15:06:00Z (sigue desfasado +5 min). Con el
    // offset corregido el "ahora" real es 15:01:00Z, o sea 3 minutos (180 s) desde el inicio —
    // no los 8 minutos que daría una lectura cruda de Date.now().
    const clientNowAtTick = new Date('2026-09-14T15:06:00.000Z').getTime();
    expect(elapsedSeconds(startedAt, offsetMs, clientNowAtTick)).toBe(180);

    // Segundos enteros transcurridos (no se redondea hacia arriba) y nunca negativo, aunque el
    // cliente quede un instante por detrás del servidor.
    const justAfterStart = new Date('2026-09-14T14:58:30.900Z').getTime();
    expect(elapsedSeconds(startedAt, 0, justAfterStart)).toBe(30);
    const beforeStart = new Date('2026-09-14T14:57:59.000Z').getTime();
    expect(elapsedSeconds(startedAt, 0, beforeStart)).toBe(0);
  });

  it('US-F1-AS9 · formatElapsed devuelve h:mm:ss hacia arriba (sin cero a la izquierda en las horas)', () => {
    expect(formatElapsed(3725)).toBe('1:02:05');
    expect(formatElapsed(59)).toBe('0:00:59');
    expect(formatElapsed(0)).toBe('0:00:00');
    expect(formatElapsed(600)).toBe('0:10:00');
    expect(formatElapsed(36000)).toBe('10:00:00');
    expect(formatElapsed(-5)).toBe('0:00:00'); // nunca un contador negativo
  });

  it('US-F1-AS9 · el temporizador sigue usando la cuenta atrás: secondsLeft y formatCountdown, y sin fin (cronómetro) secondsLeft es null', () => {
    const serverNowAtFetch = '2026-09-14T15:00:00.000Z';
    const clientNowAtFetch = new Date('2026-09-14T15:05:00.000Z').getTime();
    const offsetMs = clockOffset(serverNowAtFetch, clientNowAtFetch);
    const endsAt = '2026-09-14T15:10:00.000Z';
    const clientNowAtTick = new Date('2026-09-14T15:06:00.000Z').getTime();

    const left = secondsLeft(endsAt, offsetMs, clientNowAtTick);
    expect(left).toBe(540);
    expect(formatCountdown(left as number)).toBe('09:00');

    // Un cronómetro no tiene `ends_at`: no hay cuenta atrás que mostrar.
    expect(secondsLeft(null, offsetMs, clientNowAtTick)).toBeNull();
  });

  it('US-F1-AS5 · si el servidor rechaza terminar un cronómetro de menos de 1 minuto, Hoy muestra el mensaje del servidor; sin red, un aviso de conexión', () => {
    const tooShort = {
      status: 'error',
      code: 'CRONOMETRO_MUY_CORTO',
      message: 'El cronómetro lleva menos de 1 minuto: déjalo correr o interrúmpelo con una razón.',
    };
    expect(describeFinishFailure(tooShort)).toBe(tooShort.message);

    expect(describeFinishFailure({ status: 'success' })).toBeNull();

    const offline = 'No se pudo terminar la sesión. Revisa la conexión e inténtalo otra vez.';
    expect(describeFinishFailure({ status: 'error', code: 'SIN_CONEXION', message: 'Sin conexión con Pure.' })).toBe(offline);
    expect(describeFinishFailure(null)).toBe(offline);
    expect(describeFinishFailure({ status: 'error', code: 'ERROR_DESCONOCIDO' })).toBe(offline);
  });
});

describe('[004] US-F2 — Selector de objetivo en Hoy', () => {
  const objetivos = [
    { id: 'obj-z', name: 'Zoología de campo', subject_id: null, weekly_target_minutes: null, archived: false },
    { id: 'obj-old', name: 'Álgebra vieja', subject_id: 'sub-1', weekly_target_minutes: 120, archived: true },
    { id: 'obj-ingles', name: 'inglés técnico', subject_id: null, weekly_target_minutes: 90, archived: false },
    { id: 'obj-calculo', name: 'Cálculo', subject_id: 'sub-2', weekly_target_minutes: null, archived: false },
    { id: 'obj-nube', name: 'Ñandú y nubes', subject_id: null, weekly_target_minutes: null, archived: false },
  ];
  const materias = [
    { id: 'sub-2', name: 'Física II' },
    { id: 'sub-1', name: 'Álgebra lineal' },
    { id: 'sub-3', name: 'Programación' },
  ];

  it('US-F2-AS9 · lista "Sin objetivo" primero (valor por defecto), luego los objetivos activos en orden alfabético y luego las materias', () => {
    const options = objectiveSelectorOptions(objetivos, materias);

    // Primero "Sin objetivo": es el valor por defecto, no apunta a ningún id.
    expect(options[0]).toEqual({ value: OBJECTIVE_NONE_VALUE, label: 'Sin objetivo', kind: 'none', id: null });

    // Luego los objetivos activos, alfabéticos en español sin distinguir mayúsculas ni tildes
    // ("Cálculo" < "inglés técnico" < "Ñandú y nubes" < "Zoología de campo").
    const objectiveLabels = options.filter((o) => o.kind === 'objetivo').map((o) => o.label);
    expect(objectiveLabels).toEqual(['Cálculo', 'inglés técnico', 'Ñandú y nubes', 'Zoología de campo']);

    // Después las materias, también alfabéticas.
    const subjectLabels = options.filter((o) => o.kind === 'materia').map((o) => o.label);
    expect(subjectLabels).toEqual(['Álgebra lineal', 'Física II', 'Programación']);

    // El orden global es: none, todos los objetivos, todas las materias.
    expect(options.map((o) => o.kind)).toEqual([
      'none',
      'objetivo', 'objetivo', 'objetivo', 'objetivo',
      'materia', 'materia', 'materia',
    ]);
  });

  it('US-F2-AS9 · los objetivos archivados no aparecen en el selector', () => {
    const options = objectiveSelectorOptions(objetivos, materias);
    expect(options.some((o) => o.id === 'obj-old')).toBe(false);
    expect(options.some((o) => o.label === 'Álgebra vieja')).toBe(false);

    // Aunque todos estén archivados, solo quedan "Sin objetivo" y las materias.
    const allArchived = objetivos.map((o) => ({ ...o, archived: true }));
    const onlySubjects = objectiveSelectorOptions(allArchived, materias);
    expect(onlySubjects.map((o) => o.kind)).toEqual(['none', 'materia', 'materia', 'materia']);
  });

  it('US-F2-AS9 · sin objetivos ni materias solo existe "Sin objetivo"; sin objetivos (p. ej. sin conexión) siguen las materias', () => {
    expect(objectiveSelectorOptions([], [])).toEqual([
      { value: OBJECTIVE_NONE_VALUE, label: 'Sin objetivo', kind: 'none', id: null },
    ]);

    const soloMaterias = objectiveSelectorOptions([], materias);
    expect(soloMaterias.map((o) => o.label)).toEqual(['Sin objetivo', 'Álgebra lineal', 'Física II', 'Programación']);
  });

  it('US-F2-AS9 · una materia sin id no se ofrece (no habría a qué ligar la sesión) y las entradas no se mutan', () => {
    const entradaMaterias = [{ name: 'Sin id' }, { id: 'sub-9', name: 'Con id' }];
    const options = objectiveSelectorOptions([], entradaMaterias);
    expect(options.map((o) => o.label)).toEqual(['Sin objetivo', 'Con id']);

    const copiaObjetivos = objetivos.map((o) => ({ ...o }));
    const copiaMaterias = materias.map((m) => ({ ...m }));
    objectiveSelectorOptions(copiaObjetivos, copiaMaterias);
    expect(copiaObjetivos).toEqual(objetivos);
    expect(copiaMaterias).toEqual(materias);
  });

  it('US-F2-AS9 · un objetivo y una materia con el mismo id tienen valores distintos, para que el selector sepa a cuál se refiere', () => {
    const options = objectiveSelectorOptions(
      [{ id: 'x1', name: 'Cálculo', subject_id: null, weekly_target_minutes: null, archived: false }],
      [{ id: 'x1', name: 'Cálculo' }]
    );
    const values = options.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('US-F2-AS9 · el valor elegido viaja como objective_id, como subject_id o no viaja (Sin objetivo)', () => {
    const options = objectiveSelectorOptions(objetivos, materias);
    const objetivo = options.find((o) => o.kind === 'objetivo' && o.id === 'obj-calculo');
    const materia = options.find((o) => o.kind === 'materia' && o.id === 'sub-3');
    expect(objetivo).toBeDefined();
    expect(materia).toBeDefined();

    expect(startTargetFromSelection(objetivo!.value, options)).toEqual({ objective_id: 'obj-calculo' });
    expect(startTargetFromSelection(materia!.value, options)).toEqual({ subject_id: 'sub-3' });
    // Empezar sigue siendo un toque: por defecto no se manda ni objetivo ni materia.
    expect(startTargetFromSelection(OBJECTIVE_NONE_VALUE, options)).toEqual({});
    // Un valor que ya no está en la lista (p. ej. el objetivo se archivó mientras tanto) se trata como "Sin objetivo".
    expect(startTargetFromSelection('objetivo:desaparecido', options)).toEqual({});
  });
});
