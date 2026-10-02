import { describe, it, expect } from 'vitest';
import {
  sessionUnits,
  countsTowardMinimum,
  sessionShares,
  tallyDay,
  heatLevel,
  dayNumber,
  quoteOfDay,
  type FocusTandaInput,
  type FocusObjectiveInput,
  type FocusQuoteInput,
  type DayShare,
  type SplitByLocalDay,
} from '@/lib/domain/focus';
import { splitByLocalDay } from '@/lib/execution/time';

// 004 · Foco: reglas puras de unidades, "cuenta para el mínimo", tramos por día, nivel del mapa y
// frase del día (FR-F04, FR-F13, FR-F14, FR-F14a, FR-F17, FR-F26). Sin base de datos ni zona
// horaria: el reparto por medianoche se inyecta (`split`), así que aquí se prueba con falsos y el
// reparto real se prueba en __tests__/domain/execution-time.test.ts.

const DAY = '2026-10-05';

/** Sesión completada de 25 min sin ningún vínculo; cada test sobrescribe lo que le importa. */
function tanda(overrides: Partial<FocusTandaInput> = {}): FocusTandaInput {
  return {
    kind: 'temporizador',
    status: 'completada',
    local_date: DAY,
    started_at: '2026-10-05T15:00:00Z',
    ended_at: '2026-10-05T15:25:00Z',
    actual_minutes: 25,
    objective_id: null,
    subject_id: null,
    topic_id: null,
    task_id: null,
    deliverable_id: null,
    ...overrides,
  };
}

/** Falso de `splitByLocalDay` para sesiones que no cruzan medianoche: todo al día de la fecha UTC. */
const sameDaySplit: SplitByLocalDay = (startIso, endIso) => [
  { date: startIso.slice(0, 10), minutes: Math.floor((Date.parse(endIso) - Date.parse(startIso)) / 60_000) },
];

/** Falso que devuelve siempre el reparto dado y registra con qué instantes lo llamaron. */
function fakeSplit(shares: DayShare[]) {
  const calls: Array<[string, string]> = [];
  const split: SplitByLocalDay = (startIso, endIso) => {
    calls.push([startIso, endIso]);
    return shares;
  };
  return { split, calls };
}

const sinObjetivos = new Map<string, FocusObjectiveInput>();

describe('[004] lib/domain/focus.ts — unidades, mínimo y recuento del día', () => {
  describe('sessionUnits (FR-F04)', () => {
    it('US-F1-AS6 · unidades: cronómetro 45→4, 10→1, 9→0; temporizador 8→1', () => {
      expect(sessionUnits('cronometro', 45)).toBe(4);
      expect(sessionUnits('cronometro', 10)).toBe(1);
      expect(sessionUnits('cronometro', 9)).toBe(0);
      expect(sessionUnits('temporizador', 8)).toBe(1);
    });

    it('el temporizador conserva la regla de la 003: max(1, floor(m / 10))', () => {
      expect(sessionUnits('temporizador', 10)).toBe(1);
      expect(sessionUnits('temporizador', 25)).toBe(2);
      expect(sessionUnits('temporizador', 180)).toBe(18);
      expect(sessionUnits('temporizador', 0)).toBe(1);
    });

    it('el cronómetro vale 0 con 0 minutos y crece de 10 en 10', () => {
      expect(sessionUnits('cronometro', 0)).toBe(0);
      expect(sessionUnits('cronometro', 19)).toBe(1);
      expect(sessionUnits('cronometro', 20)).toBe(2);
      expect(sessionUnits('cronometro', 480)).toBe(48);
    });
  });

  describe('countsTowardMinimum (FR-F13)', () => {
    const objetivoSinMateria: FocusObjectiveInput = { subject_id: null };
    const objetivoConMateria: FocusObjectiveInput = { subject_id: 'subject-algoritmos' };

    it('una sesión sin objetivo ni vínculos cuenta', () => {
      expect(countsTowardMinimum(tanda(), null)).toBe(true);
    });

    it('un objetivo sin materia y la sesión sin vínculo propio no cuenta', () => {
      expect(countsTowardMinimum(tanda({ objective_id: 'objetivo-ingles' }), objetivoSinMateria)).toBe(false);
    });

    it('un objetivo con materia cuenta', () => {
      expect(countsTowardMinimum(tanda({ objective_id: 'objetivo-algoritmos' }), objetivoConMateria)).toBe(true);
    });

    it.each([
      ['subject_id', { subject_id: 'subject-calculo' }],
      ['topic_id', { topic_id: 'topic-limites' }],
      ['task_id', { task_id: 'task-taller' }],
      ['deliverable_id', { deliverable_id: 'deliverable-parcial' }],
    ] as const)('cualquier vínculo propio (%s) basta aunque el objetivo no tenga materia', (_campo, vinculo) => {
      expect(countsTowardMinimum(tanda({ objective_id: 'objetivo-ingles', ...vinculo }), objetivoSinMateria)).toBe(true);
    });

    it('un objetivo que ya no existe (referencia anulada) se trata como sin objetivo y cuenta', () => {
      expect(countsTowardMinimum(tanda({ objective_id: 'objetivo-borrado' }), null)).toBe(true);
    });
  });

  describe('sessionShares (FR-F14a)', () => {
    it('un cronómetro cerrado delega en el split con su inicio y su fin', () => {
      const tramos = [
        { date: '2026-10-05', minutes: 60 },
        { date: '2026-10-06', minutes: 90 },
      ];
      const { split, calls } = fakeSplit(tramos);
      const t = tanda({
        kind: 'cronometro',
        started_at: '2026-10-06T04:00:00Z',
        ended_at: '2026-10-06T06:30:00Z',
        actual_minutes: 150,
      });

      expect(sessionShares(t, split)).toEqual(tramos);
      expect(calls).toEqual([['2026-10-06T04:00:00Z', '2026-10-06T06:30:00Z']]);
    });

    it('un temporizador nunca se reparte: un solo tramo en su día de inicio, aunque cruce medianoche', () => {
      const { split, calls } = fakeSplit([{ date: 'no-debe-usarse', minutes: 999 }]);
      // 23:30 → 00:30 locales: 60 min enteros para el día en que empezó
      const t = tanda({
        kind: 'temporizador',
        local_date: '2026-10-05',
        started_at: '2026-10-06T04:30:00Z',
        ended_at: '2026-10-06T05:30:00Z',
        actual_minutes: 60,
      });

      expect(sessionShares(t, split)).toEqual([{ date: '2026-10-05', minutes: 60 }]);
      expect(calls).toEqual([]);
    });

    it('una sesión sin ended_at da un solo tramo con sus minutos actuales o 0', () => {
      const { split, calls } = fakeSplit([]);
      const enCurso = tanda({ kind: 'cronometro', status: 'en_curso', ended_at: null, actual_minutes: null });

      expect(sessionShares(enCurso, split)).toEqual([{ date: DAY, minutes: 0 }]);
      expect(sessionShares({ ...enCurso, actual_minutes: 12 }, split)).toEqual([{ date: DAY, minutes: 12 }]);
      expect(calls).toEqual([]);
    });
  });

  describe('tallyDay (FR-F14, FR-F13, FR-F04)', () => {
    it('US-F2-AS4 · objetivo sin materia y sin vínculo propio no cuenta: 60 min de foco, 0 unidades', () => {
      const t = tanda({
        kind: 'cronometro',
        objective_id: 'objetivo-ingles',
        started_at: '2026-10-05T15:00:00Z',
        ended_at: '2026-10-05T16:00:00Z',
        actual_minutes: 60,
      });
      const objetivos = new Map([['objetivo-ingles', { subject_id: null }]]);

      expect(tallyDay(DAY, [t], objetivos, sameDaySplit)).toEqual({
        completadas: 0,
        unidades: 0,
        interrumpidas: 0,
        minutos_foco: 60,
      });
    });

    it('US-F2-AS5 · objetivo con materia cuenta 3 unidades con 30 min', () => {
      const t = tanda({
        objective_id: 'objetivo-algoritmos',
        started_at: '2026-10-05T15:00:00Z',
        ended_at: '2026-10-05T15:30:00Z',
        actual_minutes: 30,
      });
      const objetivos = new Map([['objetivo-algoritmos', { subject_id: 'subject-algoritmos' }]]);

      expect(tallyDay(DAY, [t], objetivos, sameDaySplit)).toEqual({
        completadas: 1,
        unidades: 3,
        interrumpidas: 0,
        minutos_foco: 30,
      });
    });

    it('US-F2-AS6 · vínculo académico propio cuenta aunque el objetivo no tenga materia', () => {
      const t = tanda({
        kind: 'cronometro',
        objective_id: 'objetivo-ingles',
        subject_id: 'subject-ingles-tecnico',
        started_at: '2026-10-05T15:00:00Z',
        ended_at: '2026-10-05T15:40:00Z',
        actual_minutes: 40,
      });
      const objetivos = new Map([['objetivo-ingles', { subject_id: null }]]);

      expect(tallyDay(DAY, [t], objetivos, sameDaySplit)).toEqual({
        completadas: 1,
        unidades: 4,
        interrumpidas: 0,
        minutos_foco: 40,
      });
    });

    it('US-F2-AS7 · tanda sin ningún vínculo cuenta 1 unidad', () => {
      // regresión: una tanda de 10 minutos de la 001–003 vale lo mismo que antes
      const t = tanda({ ended_at: '2026-10-05T15:10:00Z', actual_minutes: 10 });

      expect(tallyDay(DAY, [t], sinObjetivos, sameDaySplit)).toEqual({
        completadas: 1,
        unidades: 1,
        interrumpidas: 0,
        minutos_foco: 10,
      });
    });

    it('US-F3-AS1 · tallyDay suma completadas + interrumpidas en minutos_foco (25 + 12 + 45 = 82)', () => {
      const tandas = [
        tanda({ ended_at: '2026-10-05T15:25:00Z', actual_minutes: 25 }),
        tanda({
          status: 'interrumpida',
          started_at: '2026-10-05T16:00:00Z',
          ended_at: '2026-10-05T16:12:00Z',
          actual_minutes: 12,
        }),
        tanda({
          kind: 'cronometro',
          started_at: '2026-10-05T17:00:00Z',
          ended_at: '2026-10-05T17:45:00Z',
          actual_minutes: 45,
        }),
      ];

      expect(tallyDay(DAY, tandas, sinObjetivos, sameDaySplit)).toEqual({
        completadas: 2,
        unidades: 2 + 4, // temporizador de 25 → 2; cronómetro de 45 → 4; la interrumpida no da unidades
        interrumpidas: 1,
        minutos_foco: 82,
      });
    });

    it('las sesiones en curso no suman: ni minutos, ni unidades, ni conteos', () => {
      const enCurso = tanda({ status: 'en_curso', ended_at: null, actual_minutes: null });

      expect(tallyDay(DAY, [enCurso], sinObjetivos, sameDaySplit)).toEqual({
        completadas: 0,
        unidades: 0,
        interrumpidas: 0,
        minutos_foco: 0,
      });
    });

    it('una interrumpida de un objetivo que no cuenta para el mínimo sí suma a interrumpidas y a minutos_foco', () => {
      const t = tanda({
        status: 'interrumpida',
        objective_id: 'objetivo-ingles',
        ended_at: '2026-10-05T15:15:00Z',
        actual_minutes: 15,
      });
      const objetivos = new Map([['objetivo-ingles', { subject_id: null }]]);

      expect(tallyDay(DAY, [t], objetivos, sameDaySplit)).toEqual({
        completadas: 0,
        unidades: 0,
        interrumpidas: 1,
        minutos_foco: 15,
      });
    });

    it('una interrumpida con 0 minutos cuenta como interrumpida', () => {
      const t = tanda({ status: 'interrumpida', ended_at: '2026-10-05T15:00:30Z', actual_minutes: 0 });

      expect(tallyDay(DAY, [t], sinObjetivos, sameDaySplit)).toEqual({
        completadas: 0,
        unidades: 0,
        interrumpidas: 1,
        minutos_foco: 0,
      });
    });

    it('un cronómetro repartido cuenta 1 completada en cada día que toca, con las unidades de su tramo (FR-F14a)', () => {
      // 23:00 → 01:30 locales: 60 min el 5-oct y 90 el 6-oct
      const { split } = fakeSplit([
        { date: '2026-10-05', minutes: 60 },
        { date: '2026-10-06', minutes: 90 },
      ]);
      const t = tanda({
        kind: 'cronometro',
        started_at: '2026-10-06T04:00:00Z',
        ended_at: '2026-10-06T06:30:00Z',
        actual_minutes: 150,
      });

      expect(tallyDay('2026-10-05', [t], sinObjetivos, split)).toEqual({
        completadas: 1,
        unidades: 6,
        interrumpidas: 0,
        minutos_foco: 60,
      });
      expect(tallyDay('2026-10-06', [t], sinObjetivos, split)).toEqual({
        completadas: 1,
        unidades: 9,
        interrumpidas: 0,
        minutos_foco: 90,
      });
      expect(tallyDay('2026-10-07', [t], sinObjetivos, split)).toEqual({
        completadas: 0,
        unidades: 0,
        interrumpidas: 0,
        minutos_foco: 0,
      });
    });

    it('compuesto con el splitByLocalDay real: cronómetro 23:00→01:30 local da 60 min / 6 unidades y 90 min / 9 unidades', () => {
      // La firma de `splitByLocalDay` encaja con la inyección de `tallyDay` (lo verifica tsc) y los
      // tramos reales alimentan el recuento de cada día (FR-F14a).
      const t = tanda({
        kind: 'cronometro',
        local_date: '2026-10-05',
        started_at: '2026-10-06T04:00:00Z',
        ended_at: '2026-10-06T06:30:00Z',
        actual_minutes: 150,
      });

      expect(tallyDay('2026-10-05', [t], sinObjetivos, splitByLocalDay)).toEqual({
        completadas: 1,
        unidades: 6,
        interrumpidas: 0,
        minutos_foco: 60,
      });
      expect(tallyDay('2026-10-06', [t], sinObjetivos, splitByLocalDay)).toEqual({
        completadas: 1,
        unidades: 9,
        interrumpidas: 0,
        minutos_foco: 90,
      });
    });

    it('un día sin sesiones da todo en cero', () => {
      expect(tallyDay(DAY, [], sinObjetivos, sameDaySplit)).toEqual({
        completadas: 0,
        unidades: 0,
        interrumpidas: 0,
        minutos_foco: 0,
      });
    });

    it('un objetivo anulado (id que ya no está en el mapa) se trata como sin objetivo y cuenta', () => {
      const t = tanda({ objective_id: 'objetivo-borrado', ended_at: '2026-10-05T15:30:00Z', actual_minutes: 30 });

      expect(tallyDay(DAY, [t], sinObjetivos, sameDaySplit)).toMatchObject({ completadas: 1, unidades: 3 });
    });
  });
});

describe('[004] lib/domain/focus.ts — mapa de calor y frase del día', () => {
  describe('heatLevel (FR-F17)', () => {
    it('US-F3-AS6 · heatLevel 0,1,30,31,90,91,180,181 → 0,1,1,2,2,3,3,4', () => {
      const niveles = [0, 1, 30, 31, 90, 91, 180, 181].map(heatLevel);
      expect(niveles).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
    });

    it('un día muy largo sigue en el nivel 4', () => {
      expect(heatLevel(1440)).toBe(4);
    });
  });

  describe('dayNumber (R5)', () => {
    it('cuenta días de calendario desde 1970-01-01, sin depender de la zona horaria del host', () => {
      expect(dayNumber('1970-01-01')).toBe(0);
      expect(dayNumber('1970-01-02')).toBe(1);
      expect(dayNumber('1969-12-31')).toBe(-1);
      expect(dayNumber('2000-01-01')).toBe(10957);
    });

    it('fechas consecutivas difieren en 1, también al cruzar mes, año y 29 de febrero', () => {
      expect(dayNumber('2026-10-01') - dayNumber('2026-09-30')).toBe(1);
      expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1);
      expect(dayNumber('2028-03-01') - dayNumber('2028-02-28')).toBe(2);
    });
  });

  describe('quoteOfDay (FR-F26, R5)', () => {
    const frase = (id: string, text: string, extra: Partial<FocusQuoteInput> = {}): FocusQuoteInput => ({
      id,
      text,
      translation: `traducción de ${text}`,
      source: `fuente de ${text}`,
      active: true,
      ...extra,
    });
    // Desordenadas a propósito: el orden estable es por id, no por posición en el arreglo.
    const cinco = [
      frase('frase-c', 'C'),
      frase('frase-a', 'A'),
      frase('frase-e', 'E'),
      frase('frase-b', 'B'),
      frase('frase-d', 'D'),
    ];

    /** Fechas consecutivas a partir de 'YYYY-MM-DD', con aritmética de calendario UTC. */
    const dias = (desde: string, n: number) =>
      Array.from({ length: n }, (_, i) => new Date(Date.parse(`${desde}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

    it('US-F5-AS3 · quoteOfDay: mismo día, misma frase; días consecutivos distintos; N días, cada una una vez; 0 activas → null', () => {
      // mismo día, misma frase (también con el arreglo en otro orden)
      const a = quoteOfDay('2026-10-05', cinco);
      expect(quoteOfDay('2026-10-05', cinco)).toEqual(a);
      expect(quoteOfDay('2026-10-05', [...cinco].reverse())).toEqual(a);

      // días consecutivos, frases distintas (incluido el cruce de mes y de año)
      for (const desde of ['2026-10-05', '2026-12-29']) {
        const seguidos = dias(desde, 8).map((d) => quoteOfDay(d, cinco)!.text);
        for (let i = 1; i < seguidos.length; i++) expect(seguidos[i]).not.toBe(seguidos[i - 1]);
      }

      // en N días consecutivos sale cada una de las N exactamente una vez
      const enNDias = dias('2026-10-05', cinco.length).map((d) => quoteOfDay(d, cinco)!.text);
      expect([...enNDias].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
      const enTresN = dias('2026-12-30', cinco.length * 3).map((d) => quoteOfDay(d, cinco)!.text);
      for (const texto of ['A', 'B', 'C', 'D', 'E']) expect(enTresN.filter((t) => t === texto)).toHaveLength(3);

      // sin frases activas: nulo, no un objeto vacío
      expect(quoteOfDay('2026-10-05', [])).toBeNull();
      expect(quoteOfDay('2026-10-05', cinco.map((f) => ({ ...f, active: false })))).toBeNull();
    });

    it('devuelve solo { text, translation, source }, sin id ni active', () => {
      const unica = [frase('frase-a', 'Memento mori', { translation: 'Recuerda que morirás', source: 'Tradición estoica' })];

      expect(quoteOfDay('2026-10-05', unica)).toEqual({
        text: 'Memento mori',
        translation: 'Recuerda que morirás',
        source: 'Tradición estoica',
      });
    });

    it('traducción o fuente ausentes salen como null', () => {
      const sinDetalle = [frase('frase-a', 'Carpe diem', { translation: undefined, source: null })];

      expect(quoteOfDay('2026-10-05', sinDetalle)).toEqual({ text: 'Carpe diem', translation: null, source: null });
    });

    it('las frases inactivas quedan fuera de la rotación y de N', () => {
      const conInactiva = [...cinco, frase('frase-z', 'Z', { active: false })];
      const enNDias = dias('2026-10-05', cinco.length).map((d) => quoteOfDay(d, conInactiva)!.text);

      expect([...enNDias].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('con una sola frase activa sale siempre esa', () => {
      const una = [frase('frase-a', 'A')];
      for (const d of dias('2026-10-05', 4)) expect(quoteOfDay(d, una)!.text).toBe('A');
    });

    it('el índice es dayNumber mod N sobre las activas ordenadas por id', () => {
      const ordenadas = ['A', 'B', 'C', 'D', 'E'];
      const d = '2026-10-05';
      expect(quoteOfDay(d, cinco)!.text).toBe(ordenadas[dayNumber(d) % cinco.length]);
    });
  });
});
