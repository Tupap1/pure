import { describe, it, expect } from 'vitest';
import type { StudySessionEntity } from '@/lib/db/dexie-schema';

function computeHeatmapFromSessions(
  studySessions: StudySessionEntity[],
  referenceDate: Date = new Date('2026-08-11T12:00:00Z')
) {
  const result = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const sessionsOnDate = studySessions.filter((s) => {
      const sessionDate = s.scheduled_start?.slice(0, 10);
      return sessionDate === dateStr && s.is_completed;
    });

    let hours = 0;
    sessionsOnDate.forEach((s) => {
      const start = new Date(s.scheduled_start).getTime();
      const end = new Date(s.scheduled_end).getTime();
      if (end > start) {
        hours += (end - start) / (1000 * 60 * 60);
      }
    });

    hours = Math.round(hours * 10) / 10;
    const intensity = (hours === 0 ? 0 : hours <= 2 ? 1 : hours <= 4 ? 2 : hours <= 6 ? 3 : 4) as 0 | 1 | 2 | 3 | 4;
    result.push({ date: dateStr, hours, intensity });
  }
  return result;
}

describe('Cálculo del Heatmap de Estudio basado en Sesiones Reales (StudySessions)', () => {
  it('calcula correctamente las horas de sesiones completadas e ignora sesiones no completadas', () => {
    const refDate = new Date('2026-08-11T12:00:00Z'); // 2026-08-11
    const sessions: StudySessionEntity[] = [
      {
        id: 'sess-1',
        subject_id: 'sub-algebra',
        scheduled_start: '2026-08-11T10:00:00.000Z',
        scheduled_end: '2026-08-11T12:30:00.000Z', // 2.5 horas
        is_completed: true,
        source: 'manual',
        created_at: new Date().toISOString(),
      },
      {
        id: 'sess-2',
        subject_id: 'sub-calculo',
        scheduled_start: '2026-08-11T14:00:00.000Z',
        scheduled_end: '2026-08-11T16:00:00.000Z', // 2.0 horas (no completada)
        is_completed: false,
        source: 'manual',
        created_at: new Date().toISOString(),
      },
      {
        id: 'sess-3',
        subject_id: 'sub-programacion',
        scheduled_start: '2026-08-10T08:00:00.000Z',
        scheduled_end: '2026-08-10T13:00:00.000Z', // 5.0 horas
        is_completed: true,
        source: 'manual',
        created_at: new Date().toISOString(),
      },
    ];


    const days = computeHeatmapFromSessions(sessions, refDate);

    expect(days).toHaveLength(28);

    // Hoy (2026-08-11): 2.5h (solo la completada) -> intensity 2
    const today = days.find((d) => d.date === '2026-08-11');
    expect(today?.hours).toBe(2.5);
    expect(today?.intensity).toBe(2);

    // Ayer (2026-08-10): 5.0h -> intensity 3
    const yesterday = days.find((d) => d.date === '2026-08-10');
    expect(yesterday?.hours).toBe(5.0);
    expect(yesterday?.intensity).toBe(3);

    // Días sin sesiones
    const olderDay = days.find((d) => d.date === '2026-08-01');
    expect(olderDay?.hours).toBe(0);
    expect(olderDay?.intensity).toBe(0);
  });

  it('devuelve 0h para todos los días cuando no hay sesiones registradas', () => {
    const days = computeHeatmapFromSessions([], new Date('2026-08-11T12:00:00Z'));
    expect(days.every((d) => d.hours === 0 && d.intensity === 0)).toBe(true);
  });
});
