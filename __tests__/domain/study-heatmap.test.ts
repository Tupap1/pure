import { describe, it, expect } from 'vitest';
import { computeStudyHeatmap, HEATMAP_DAYS } from '@/lib/domain/study-heatmap';
import type { StudySessionEntity } from '@/lib/db/dexie-schema';

/**
 * Construye el instante UTC que corresponde a una hora de pared LOCAL. Así las pruebas dan el
 * mismo resultado en cualquier zona horaria en la que se ejecute la suite.
 */
function localIso(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute, 0).toISOString();
}

function session(overrides: Partial<StudySessionEntity> & { id: string }): StudySessionEntity {
  return {
    subject_id: 'sub-1',
    scheduled_start: localIso(2026, 8, 11, 10),
    scheduled_end: localIso(2026, 8, 11, 12),
    is_completed: true,
    source: 'manual',
    ...overrides,
  };
}

const REFERENCE = new Date(2026, 7, 11, 12, 0, 0); // 11 de agosto de 2026, hora local

describe('Heatmap de estudio a partir de sesiones reales', () => {
  it('suma solo las horas de las sesiones completadas e ignora las pendientes', () => {
    const sessions: StudySessionEntity[] = [
      session({
        id: 'sess-1',
        scheduled_start: localIso(2026, 8, 11, 10),
        scheduled_end: localIso(2026, 8, 11, 12, 30), // 2.5h completadas
      }),
      session({
        id: 'sess-2',
        scheduled_start: localIso(2026, 8, 11, 14),
        scheduled_end: localIso(2026, 8, 11, 16), // 2h, pero NO completada
        is_completed: false,
      }),
      session({
        id: 'sess-3',
        scheduled_start: localIso(2026, 8, 10, 8),
        scheduled_end: localIso(2026, 8, 10, 13), // 5h el día anterior
      }),
    ];

    const days = computeStudyHeatmap(sessions, REFERENCE);

    expect(days).toHaveLength(HEATMAP_DAYS);

    const today = days.find((d) => d.date === '2026-08-11');
    expect(today?.hours).toBe(2.5); // la sesión pendiente no suma
    expect(today?.intensity).toBe(2);

    const yesterday = days.find((d) => d.date === '2026-08-10');
    expect(yesterday?.hours).toBe(5);
    expect(yesterday?.intensity).toBe(3);

    const sinSesiones = days.find((d) => d.date === '2026-08-01');
    expect(sinSesiones?.hours).toBe(0);
    expect(sinSesiones?.intensity).toBe(0);
  });

  it('acumula varias sesiones del mismo día', () => {
    const sessions = [
      session({ id: 'a', scheduled_start: localIso(2026, 8, 9, 8), scheduled_end: localIso(2026, 8, 9, 10) }),
      session({ id: 'b', scheduled_start: localIso(2026, 8, 9, 15), scheduled_end: localIso(2026, 8, 9, 16, 30) }),
    ];

    const days = computeStudyHeatmap(sessions, REFERENCE);
    const day = days.find((d) => d.date === '2026-08-09');

    expect(day?.hours).toBe(3.5); // 2h + 1.5h
    expect(day?.intensity).toBe(2);
  });

  it('atribuye una sesión nocturna al día local en que ocurrió, no al día UTC siguiente', () => {
    // Regresión: la versión anterior comparaba una fecha local contra scheduled_start.slice(0,10),
    // que es UTC. En Colombia (UTC-5) una sesión de las 22:00 cae en el día UTC siguiente y se
    // contabilizaba mal. Con horas de pared locales la atribución debe ser exacta.
    const sessions = [
      session({
        id: 'nocturna',
        scheduled_start: localIso(2026, 8, 10, 22),
        scheduled_end: localIso(2026, 8, 10, 23, 30), // 1.5h
      }),
    ];

    const days = computeStudyHeatmap(sessions, REFERENCE);

    expect(days.find((d) => d.date === '2026-08-10')?.hours).toBe(1.5);
    expect(days.find((d) => d.date === '2026-08-11')?.hours).toBe(0);
  });

  it('descarta sesiones con duración nula o invertida', () => {
    const sessions = [
      session({ id: 'nula', scheduled_start: localIso(2026, 8, 9, 8), scheduled_end: localIso(2026, 8, 9, 8) }),
      session({ id: 'invertida', scheduled_start: localIso(2026, 8, 9, 12), scheduled_end: localIso(2026, 8, 9, 10) }),
    ];

    const days = computeStudyHeatmap(sessions, REFERENCE);
    expect(days.find((d) => d.date === '2026-08-09')?.hours).toBe(0);
  });

  it('devuelve la ventana completa en cero cuando no hay sesiones registradas', () => {
    const days = computeStudyHeatmap([], REFERENCE);

    expect(days).toHaveLength(HEATMAP_DAYS);
    expect(days.every((d) => d.hours === 0 && d.intensity === 0)).toBe(true);
  });
});
