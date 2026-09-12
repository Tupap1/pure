import { describe, it, expect } from 'vitest';
import { resolveCurrentTrigger } from '../../lib/domain/execution';

// US2 — Un solo disparador vigente (FR-009..FR-011). resolveCurrentTrigger es una función pura:
// recibe los disparadores candidatos ya cargados (nunca toca la base) y decide cuál, si alguno,
// es el vigente ahora mismo. Nunca puede devolver más de uno (FR-011).

const MONDAY = '2026-09-14'; // mismo lunes usado en execution-tandas.test.ts (10:00 Bogotá = 15:00Z)

function horaSlot(id: string, anchor_time: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    is_active: true,
    days_of_week: [1],
    cue_kind: 'hora' as const,
    cue_text: 'suena la alarma',
    action_text: `hago ${id}`,
    anchor_time,
    kind: 'estudio' as const,
    periodicity: 'semanal' as const,
    ...overrides,
  };
}

describe('[001] US2 — Un solo disparador vigente', () => {
  it('US2-AS1 · con varios disparadores para hoy, solo aparece el de hora de referencia más reciente ya pasada y sin responder', () => {
    const now = new Date(`${MONDAY}T17:00:00.000Z`); // 12:00 Bogotá
    const result = resolveCurrentTrigger({
      now,
      slots: [horaSlot('temprano', '07:00'), horaSlot('reciente', '11:30'), horaSlot('futuro', '18:00')],
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('reciente');
  });

  it('US2-AS2 · el siguiente disparador (que todavía no llega) no aparece', () => {
    const now = new Date(`${MONDAY}T15:00:00.000Z`); // 10:00 Bogotá
    const result = resolveCurrentTrigger({
      now,
      slots: [horaSlot('mas-tarde', '14:00')],
    });
    expect(result).toBeNull();
  });

  it('US2-AS3 · un disparador ya respondido hoy no vuelve a aparecer hoy', () => {
    const now = new Date(`${MONDAY}T15:00:00.000Z`); // 10:00 Bogotá
    const result = resolveCurrentTrigger({
      now,
      slots: [horaSlot('ya-respondido', '09:00')],
      respondedTodaySlotIds: ['ya-respondido'],
    });
    expect(result).toBeNull();
  });

  it('US2-AS4 · un disparador "al salir de clase" usa el fin de esa clase según el horario, con su día y alternancia de sábados', () => {
    const now = new Date(`${MONDAY}T15:05:00.000Z`); // 10:05 Bogotá, 5 min después del fin de la clase
    const result = resolveCurrentTrigger({
      now,
      slots: [
        {
          id: 'tras-quimica',
          is_active: true,
          days_of_week: [1],
          cue_kind: 'tras_clase' as const,
          cue_text: 'salgo de Química',
          action_text: 'repaso la clase',
          schedule_id: 'sch-quimica',
          kind: 'estudio' as const,
          periodicity: 'semanal' as const,
        },
      ],
      schedules: [{ id: 'sch-quimica', end_time: '10:00' }],
    });
    expect(result?.id).toBe('tras-quimica');
  });

  it('US2-AS5 · un disparador de sábado B no aparece en sábado A', () => {
    const sabadoA = new Date('2026-08-01T15:00:00.000Z'); // 10:00 Bogotá; con el ancla por defecto, este sábado es "A"
    const result = resolveCurrentTrigger({
      now: sabadoA,
      slots: [horaSlot('sabado-b', '09:00', { days_of_week: [6], periodicity: 'sabado_b' })],
    });
    expect(result).toBeNull();
  });

  it('US2-AS10 · un disparador sin respuesta con más de 4 horas de antigüedad no aparece', () => {
    const now = new Date(`${MONDAY}T20:01:00.000Z`); // 15:01 Bogotá: 5h01 desde las 10:00
    const result = resolveCurrentTrigger({
      now,
      slots: [horaSlot('viejo', '10:00')],
    });
    expect(result).toBeNull();
  });
});
