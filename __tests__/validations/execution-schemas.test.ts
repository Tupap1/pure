import { describe, it, expect } from 'vitest';
import {
  ExecutionProgramInitSchema,
  RoutineSlotSchema,
  TandaStartSchema,
  TandaInterruptSchema,
  ExecutionTaskSchema,
  WeeklyReportNoteSchema,
  IntentionItemSchema,
  DailyCheckSetSchema,
  zodErrorToExecutionResult,
} from '@/lib/validations/schemas';

function baseSlot(overrides: Record<string, unknown> = {}) {
  return {
    days_of_week: [1],
    cue_kind: 'hora',
    cue_text: 'salgo del gimnasio',
    action_text: 'reviso los apuntes de hoy',
    anchor_time: '18:00',
    kind: 'estudio',
    ...overrides,
  };
}

// Foundational: valida las reglas de forma de la sección "Módulo de Ejecución" de
// lib/validations/schemas.ts. Las reglas que dependen de estado en base de datos (por ejemplo
// TANDA_EN_CURSO o HABITO_INACTIVO) se prueban a nivel de servicio/MCP en las historias
// siguientes, no aquí.

describe('[001] Validación Zod — Módulo de Ejecución (Foundational)', () => {
  describe('Disparador (routine_slots) — FR-009', () => {
    it('una clave extra (duración, tandas o método) se traduce a SOBRE_ESPECIFICACION', () => {
      for (const extraKey of ['default_tandas', 'duration', 'how']) {
        const result = RoutineSlotSchema.safeParse(baseSlot({ [extraKey]: 10 }));
        expect(result.success).toBe(false);
        if (!result.success) {
          const response = zodErrorToExecutionResult(result.error, { unrecognizedKeysCode: 'SOBRE_ESPECIFICACION' });
          expect(response.code).toBe('SOBRE_ESPECIFICACION');
        }
      }
    });

    it('cue_text acepta de 5 a 80 caracteres', () => {
      expect(RoutineSlotSchema.safeParse(baseSlot({ cue_text: 'abcd' })).success).toBe(false);
      expect(RoutineSlotSchema.safeParse(baseSlot({ cue_text: 'a'.repeat(81) })).success).toBe(false);
      expect(RoutineSlotSchema.safeParse(baseSlot({ cue_text: 'a'.repeat(5) })).success).toBe(true);
      expect(RoutineSlotSchema.safeParse(baseSlot({ cue_text: 'a'.repeat(80) })).success).toBe(true);
    });

    it('action_text acepta de 5 a 90 caracteres', () => {
      expect(RoutineSlotSchema.safeParse(baseSlot({ action_text: 'abcd' })).success).toBe(false);
      expect(RoutineSlotSchema.safeParse(baseSlot({ action_text: 'a'.repeat(91) })).success).toBe(false);
      expect(RoutineSlotSchema.safeParse(baseSlot({ action_text: 'a'.repeat(5) })).success).toBe(true);
      expect(RoutineSlotSchema.safeParse(baseSlot({ action_text: 'a'.repeat(90) })).success).toBe(true);
    });

    it('anchor_time es obligatorio salvo en tras_clase', () => {
      const sinAncla = baseSlot();
      delete (sinAncla as any).anchor_time;
      expect(RoutineSlotSchema.safeParse(sinAncla).success).toBe(false);

      const trasClase = baseSlot({ cue_kind: 'tras_clase', schedule_id: 'sch-1' });
      delete (trasClase as any).anchor_time;
      expect(RoutineSlotSchema.safeParse(trasClase).success).toBe(true);
    });

    it("kind='habito' exige habit_id", () => {
      expect(RoutineSlotSchema.safeParse(baseSlot({ kind: 'habito' })).success).toBe(false);
      expect(
        RoutineSlotSchema.safeParse(baseSlot({ kind: 'habito', habit_id: 'levantada_0600' })).success
      ).toBe(true);
    });

    it('periodicity distinta de semanal solo aplica con days_of_week=[6]', () => {
      expect(RoutineSlotSchema.safeParse(baseSlot({ periodicity: 'sabado_a' })).success).toBe(false);
      expect(
        RoutineSlotSchema.safeParse(baseSlot({ periodicity: 'sabado_a', days_of_week: [6] })).success
      ).toBe(true);
    });
  });

  describe('Programa (program_weeks) — FR-017', () => {
    it('starts_on debe ser lunes; si no lo es, el error se traduce a NO_ES_LUNES', () => {
      const noLunes = ExecutionProgramInitSchema.safeParse({
        starts_on: '2026-09-15', // martes
        weeks: [{ min_tandas_dia: 1 }],
      });
      expect(noLunes.success).toBe(false);
      if (!noLunes.success) {
        expect(zodErrorToExecutionResult(noLunes.error).code).toBe('NO_ES_LUNES');
      }

      const siLunes = ExecutionProgramInitSchema.safeParse({
        starts_on: '2026-09-14', // lunes
        weeks: [{ min_tandas_dia: 1 }],
      });
      expect(siLunes.success).toBe(true);
    });
  });

  describe('Tanda (tandas)', () => {
    it('planned_minutes acepta de 5 a 25 minutos', () => {
      expect(TandaStartSchema.safeParse({ planned_minutes: 4 }).success).toBe(false);
      expect(TandaStartSchema.safeParse({ planned_minutes: 26 }).success).toBe(false);
      expect(TandaStartSchema.safeParse({ planned_minutes: 5 }).success).toBe(true);
      expect(TandaStartSchema.safeParse({ planned_minutes: 25 }).success).toBe(true);
      expect(TandaStartSchema.safeParse({}).success).toBe(true); // opcional: 10 por defecto en el servicio
    });

    it('interrupt_reason acepta de 1 a 140 caracteres', () => {
      expect(TandaInterruptSchema.safeParse({ id: 't1', interrupt_reason: '' }).success).toBe(false);
      expect(TandaInterruptSchema.safeParse({ id: 't1', interrupt_reason: 'a'.repeat(141) }).success).toBe(false);
      expect(TandaInterruptSchema.safeParse({ id: 't1', interrupt_reason: 'me llamaron' }).success).toBe(true);
      expect(TandaInterruptSchema.safeParse({ id: 't1', interrupt_reason: 'a'.repeat(140) }).success).toBe(true);
    });
  });

  describe('Tarea (tasks)', () => {
    it('estimated_tandas acepta de 1 a 3', () => {
      const base = { title: 'Resolver taller 3', subject_id: 'sub-1' };
      expect(ExecutionTaskSchema.safeParse({ ...base, estimated_tandas: 0 }).success).toBe(false);
      expect(ExecutionTaskSchema.safeParse({ ...base, estimated_tandas: 4 }).success).toBe(false);
      expect(ExecutionTaskSchema.safeParse({ ...base, estimated_tandas: 1 }).success).toBe(true);
      expect(ExecutionTaskSchema.safeParse({ ...base, estimated_tandas: 3 }).success).toBe(true);
    });
  });

  describe('Nota del reporte semanal (weekly_reports)', () => {
    it('user_note acepta hasta 400 caracteres', () => {
      expect(
        WeeklyReportNoteSchema.safeParse({ program_week_id: 'pw-01', note: 'a'.repeat(401) }).success
      ).toBe(false);
      expect(
        WeeklyReportNoteSchema.safeParse({ program_week_id: 'pw-01', note: 'a'.repeat(400) }).success
      ).toBe(true);
    });
  });

  describe('Intención (intentions)', () => {
    it('strength acepta de 0 a 10', () => {
      const base = { subject_id: 'sub-1' };
      expect(IntentionItemSchema.safeParse({ ...base, strength: -1 }).success).toBe(false);
      expect(IntentionItemSchema.safeParse({ ...base, strength: 11 }).success).toBe(false);
      expect(IntentionItemSchema.safeParse({ ...base, strength: 0 }).success).toBe(true);
      expect(IntentionItemSchema.safeParse({ ...base, strength: 10 }).success).toBe(true);
    });
  });

  describe('Registro de hábito (daily_checks)', () => {
    it('note acepta hasta 200 caracteres', () => {
      const base = { habit_id: 'levantada_0600', status: 'cumplido' as const };
      expect(DailyCheckSetSchema.safeParse({ ...base, note: 'a'.repeat(201) }).success).toBe(false);
      expect(DailyCheckSetSchema.safeParse({ ...base, note: 'a'.repeat(200) }).success).toBe(true);
    });
  });
});
