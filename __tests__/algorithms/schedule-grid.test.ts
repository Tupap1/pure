import { describe, it, expect } from 'vitest';
import { buildScheduleColumns, belongsToColumn, shouldSplitSaturday } from '@/lib/algorithms/schedule-grid';
import { detectScheduleConflicts } from '@/lib/algorithms/conflict-detector';

const sabA = { id: 'sch-ecuaciones-dif', day_of_week: 6, start_time: '12:00', end_time: '13:50', periodicity: 'sabado_a' };
const sabB = { id: 'sch-ciencia-datos', day_of_week: 6, start_time: '12:00', end_time: '13:50', periodicity: 'sabado_b' };

describe('Matriz semanal: columnas de Sábado A / Sábado B', () => {
  it('desdobla el sábado en dos columnas cuando hay clases quincenales', () => {
    const cols = buildScheduleColumns([sabA, sabB], true);
    expect(cols).toHaveLength(8);
    expect(cols.map((c) => c.label)).toContain('Sábado A');
    expect(cols.map((c) => c.label)).toContain('Sábado B');
    expect(cols.map((c) => c.label)).not.toContain('Sábado');
  });

  it('mantiene una sola columna de sábado si no hay clases quincenales', () => {
    const semanal = { day_of_week: 6, periodicity: 'semanal' };
    expect(buildScheduleColumns([semanal], true)).toHaveLength(7);
    expect(shouldSplitSaturday([semanal], true)).toBe(false);
  });

  it('mantiene una sola columna si la institución no usa sábados alternos', () => {
    expect(buildScheduleColumns([sabA, sabB], false)).toHaveLength(7);
    expect(shouldSplitSaturday([sabA, sabB], false)).toBe(false);
  });

  it('coloca cada tutoría quincenal solo en su columna', () => {
    const cols = buildScheduleColumns([sabA, sabB], true);
    const colA = cols.find((c) => c.sabado === 'sabado_a')!;
    const colB = cols.find((c) => c.sabado === 'sabado_b')!;

    expect(belongsToColumn(sabA, colA)).toBe(true);
    expect(belongsToColumn(sabA, colB)).toBe(false);
    expect(belongsToColumn(sabB, colB)).toBe(true);
    expect(belongsToColumn(sabB, colA)).toBe(false);
  });

  it('muestra una clase semanal de sábado en ambas columnas', () => {
    const semanal = { day_of_week: 6, start_time: '12:00', end_time: '13:50', periodicity: 'semanal' };
    const cols = buildScheduleColumns([sabA, semanal], true);
    const colA = cols.find((c) => c.sabado === 'sabado_a')!;
    const colB = cols.find((c) => c.sabado === 'sabado_b')!;

    expect(belongsToColumn(semanal, colA)).toBe(true);
    expect(belongsToColumn(semanal, colB)).toBe(true);
  });

  it('trata un horario sin periodicity como semanal', () => {
    const sinCampo = { day_of_week: 6, start_time: '12:00', end_time: '13:50' };
    const cols = buildScheduleColumns([sabA, sabB], true);
    expect(belongsToColumn(sinCampo, cols.find((c) => c.sabado === 'sabado_a')!)).toBe(true);
    expect(belongsToColumn(sinCampo, cols.find((c) => c.sabado === 'sabado_b')!)).toBe(true);
  });

  it('no deja a dos quincenales alternas en la misma celda (regresión del EMPALME falso)', () => {
    // Antes la matriz hacía `schedules.filter(mismo día y hora).length > 1` y marcaba EMPALME.
    const cols = buildScheduleColumns([sabA, sabB], true);

    for (const col of cols.filter((c) => c.sabado)) {
      const enCelda = [sabA, sabB].filter(
        (s) => belongsToColumn(s, col) && s.start_time <= '12:00' && s.end_time > '12:00'
      );
      expect(enCelda).toHaveLength(1);
    }
  });

  it('sí detecta empalme real entre una semanal y una quincenal a la misma hora', () => {
    const semanal = { day_of_week: 6, start_time: '12:00', end_time: '13:50', periodicity: 'semanal' };
    const cols = buildScheduleColumns([sabA, semanal], true);
    const colA = cols.find((c) => c.sabado === 'sabado_a')!;

    const enCelda = [sabA, semanal].filter(
      (s) => belongsToColumn(s, colA) && s.start_time <= '12:00' && s.end_time > '12:00'
    );
    expect(enCelda).toHaveLength(2);
  });

  it('coincide con el veredicto de detectScheduleConflicts para el mismo par', () => {
    const slots = [sabA, sabB].map((s) => ({
      ...s,
      subjectName: s.id,
      universityName: 'UdeC',
      has_alternating_saturdays: true,
    }));
    expect(detectScheduleConflicts(slots as any)).toHaveLength(0);
  });
});
