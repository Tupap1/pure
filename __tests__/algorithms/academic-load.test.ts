import { describe, it, expect } from 'vitest';
import { computeAcademicLoad } from '@/lib/algorithms/academic-load';
import type { SubjectEntity, ScheduleEntity, UniversityEntity } from '@/lib/db/dexie-schema';

function university(overrides: Partial<UniversityEntity> & { id: string; name: string }): UniversityEntity {
  return {
    modality: 'presencial',
    scale_min: 0,
    scale_max: 5,
    passing_grade: 3,
    color: '#38bdf8',
    ...overrides,
  };
}

function subject(overrides: Partial<SubjectEntity> & { id: string; university_id: string }): SubjectEntity {
  return {
    name: 'Materia',
    credits: 3,
    difficulty: 3,
    modality: 'presencial',
    target_grade: 4.0,
    current_grade: 0,
    ...overrides,
  };
}

function schedule(overrides: Partial<ScheduleEntity> & { id: string; subject_id: string }): ScheduleEntity {
  return {
    day_of_week: 1,
    start_time: '08:00',
    end_time: '10:00',
    periodicity: 'semanal',
    ...overrides,
  };
}

describe('Carga académica agregada desde los datos reales del estudiante', () => {
  it('reparte la carga normativa de cada carrera según su acompañamiento real', () => {
    const universities = [
      university({ id: 'udea', name: 'UdeA', modality: 'presencial' }),
      university({ id: 'udec', name: 'UdeC', modality: 'virtual' }),
    ];
    const subjects = [
      subject({ id: 'calculo', university_id: 'udea', credits: 4 }),
      subject({ id: 'bases', university_id: 'udec', credits: 3 }),
    ];
    const schedules = [
      // Presencial: 4h semanales de clase.
      schedule({ id: 's1', subject_id: 'calculo', start_time: '08:00', end_time: '10:00' }),
      schedule({ id: 's2', subject_id: 'calculo', start_time: '10:00', end_time: '12:00' }),
      // A distancia: 1.5h de tutoría.
      schedule({ id: 's3', subject_id: 'bases', start_time: '18:00', end_time: '19:30' }),
    ];

    const load = computeAcademicLoad(subjects, schedules, universities);

    expect(load.classHours).toBe(5.5); // 4 + 1.5
    expect(load.normativeIndependentHours).toBe(15.5); // 8 (presencial) + 7.5 (distancia)

    // El total siempre reconstruye la exigencia legal: 7 créditos × 3 h/sem.
    expect(load.totalCredits).toBe(7);
    expect(load.totalAcademicHours).toBe(21);

    // 168 - (5.5 clase + 15.5 independiente + 49 sueño)
    expect(load.netFreeTime).toBe(98);
    expect(load.isOverloaded).toBe(false);

    const distancia = load.perSubject.find((item) => item.subject.id === 'bases');
    expect(distancia?.creditLoad.weeklyIndependentHours).toBe(7.5);
    const presencial = load.perSubject.find((item) => item.subject.id === 'calculo');
    expect(presencial?.creditLoad.weeklyIndependentHours).toBe(8);
  });

  it('respeta la política de sábados alternos de la universidad al ponderar las horas de clase', () => {
    // La universidad desactivó los sábados alternos, así que la clase se dicta TODAS las semanas
    // y no debe recibir la ponderación 0.5, pese a que el horario diga 'sabado_a'.
    const universities = [university({ id: 'udec', name: 'UdeC', has_alternating_saturdays: false })];
    const subjects = [subject({ id: 'redes', university_id: 'udec', credits: 3 })];
    const schedules = [
      schedule({
        id: 's1',
        subject_id: 'redes',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_a',
      }),
    ];

    const load = computeAcademicLoad(subjects, schedules, universities);

    expect(load.classHours).toBe(4); // 4h completas, no 2h
    expect(load.normativeIndependentHours).toBe(5); // 9 total - 4 de clase
  });

  it('aplica la ponderación 0.5 cuando la universidad sí alterna sábados', () => {
    const universities = [university({ id: 'udec', name: 'UdeC', has_alternating_saturdays: true })];
    const subjects = [subject({ id: 'redes', university_id: 'udec', credits: 3 })];
    const schedules = [
      schedule({
        id: 's1',
        subject_id: 'redes',
        day_of_week: 6,
        start_time: '08:00',
        end_time: '12:00',
        periodicity: 'sabado_a',
      }),
    ];

    const load = computeAcademicLoad(subjects, schedules, universities);

    expect(load.classHours).toBe(2); // 4h quincenales -> 2h/semana
    expect(load.normativeIndependentHours).toBe(7);
  });

  it('reporta déficit cuando la carga normativa no cabe en la semana', () => {
    // 14 materias de 3 créditos = 42 créditos = 126 h/sem de trabajo académico.
    const universities = [university({ id: 'udea', name: 'UdeA' })];
    const subjects = Array.from({ length: 14 }, (_, i) =>
      subject({ id: `m${i}`, university_id: 'udea', credits: 3 })
    );

    const load = computeAcademicLoad(subjects, [], universities);

    expect(load.totalAcademicHours).toBe(126);
    // 168 - (0 clase + 126 independiente + 49 sueño) = -7
    expect(load.netFreeTime).toBe(-7);
    expect(load.isOverloaded).toBe(true);

    // Ninguna materia tiene horario: toda su carga es trabajo independiente.
    expect(load.subjectsWithoutSchedule).toBe(14);
  });

  it('no rompe cuando no hay materias registradas', () => {
    const load = computeAcademicLoad([], [], []);

    expect(load.totalCredits).toBe(0);
    expect(load.classHours).toBe(0);
    expect(load.totalAcademicHours).toBe(0);
    expect(load.netFreeTime).toBe(119); // 168 - 49 de sueño
    expect(load.isOverloaded).toBe(false);
  });
});
