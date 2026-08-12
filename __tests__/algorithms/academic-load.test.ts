import { describe, it, expect } from 'vitest';
import { computeAcademicLoad, buildDailyLoad } from '@/lib/algorithms/academic-load';
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
    ...overrides,
  };
}

describe('computeAcademicLoad — Cálculo Normativo (Decreto 1075 / 168h sem)', () => {
  it('calcula horas de clase semanales sumando la duración de cada bloque de horario', () => {
    const universities = [university({ id: 'udea', name: 'UdeA' })];
    const subjects = [subject({ id: 'algoritmos', university_id: 'udea', credits: 4 })];
    const schedules = [
      schedule({ id: 'sch1', subject_id: 'algoritmos', day_of_week: 1, start_time: '08:00', end_time: '10:00' }), // 2h
      schedule({ id: 'sch2', subject_id: 'algoritmos', day_of_week: 3, start_time: '14:00', end_time: '17:00' }), // 3h
    ];

    const load = computeAcademicLoad(subjects, schedules, universities);

    expect(load.classHours).toBe(5);
    expect(load.totalCredits).toBe(4);
    expect(load.normativeIndependentHours).toBe(7);
    expect(load.totalAcademicHours).toBe(12);
    expect(load.isOverloaded).toBe(false);
  });

  it('detecta sobrecarga cuando las horas totales superan las 168h de la semana', () => {
    const universities = [university({ id: 'udea', name: 'UdeA' })];
    const subjects = Array.from({ length: 10 }, (_, i) =>
      subject({ id: `sub_${i}`, university_id: 'udea', credits: 4 })
    );

    const schedules: ScheduleEntity[] = [];
    for (let day = 1; day <= 6; day++) {
      schedules.push(
        schedule({
          id: `sch_${day}`,
          subject_id: `sub_${day - 1}`,
          day_of_week: day,
          start_time: '08:00',
          end_time: '18:00',
        })
      );
    }


    const load = computeAcademicLoad(subjects, schedules, universities);

    expect(load.totalCredits).toBe(40);
    expect(load.classHours).toBe(60);
    expect(load.normativeIndependentHours).toBe(60);
    expect(load.totalAcademicHours).toBe(120);
    expect(load.netFreeTime).toBe(-1);
    expect(load.isOverloaded).toBe(true);
  });

  it('no marca sobrecarga si el total de horas académicas más el sueño no superan 168h', () => {
    const universities = [university({ id: 'udea', name: 'UdeA' })];
    const subjects = [
      subject({ id: 'materia1', university_id: 'udea', credits: 4 }),
      subject({ id: 'materia2', university_id: 'udea', credits: 3 }),
    ];
    const schedules = [
      schedule({ id: 's1', subject_id: 'materia1', day_of_week: 1, start_time: '08:00', end_time: '12:00' }),
      schedule({ id: 's2', subject_id: 'materia2', day_of_week: 2, start_time: '10:00', end_time: '13:00' }),
    ];

    const load = computeAcademicLoad(subjects, schedules, universities);

    expect(load.totalCredits).toBe(7);
    expect(load.classHours).toBe(7);
    expect(load.normativeIndependentHours).toBe(14);
    expect(load.netFreeTime).toBe(98);
    expect(load.isOverloaded).toBe(false);
  });

  it('maneja correctamente una lista vacía de materias y horarios sin romper', () => {
    const load = computeAcademicLoad([], [], []);

    expect(load.classHours).toBe(0);
    expect(load.totalCredits).toBe(0);
    expect(load.normativeIndependentHours).toBe(0);
    expect(load.totalAcademicHours).toBe(0);
    expect(load.netFreeTime).toBe(119);
    expect(load.isOverloaded).toBe(false);
  });
});

describe('buildDailyLoad — Distribución diaria de carga horaria real', () => {
  it('asigna horas de clase reales por día y distribuye el trabajo independiente uniformemente en 7 días', () => {
    const universities = [university({ id: 'udea', name: 'UdeA' })];
    const subjects = [subject({ id: 'algoritmos', university_id: 'udea', credits: 4 })];
    const schedules = [
      schedule({ id: 'sch1', subject_id: 'algoritmos', day_of_week: 1, start_time: '08:00', end_time: '12:00' }),
      schedule({ id: 'sch2', subject_id: 'algoritmos', day_of_week: 3, start_time: '14:00', end_time: '16:00' }),
    ];

    const weeklyIndependentHours = 14;
    const daily = buildDailyLoad(schedules, subjects, universities, weeklyIndependentHours);

    expect(daily).toHaveLength(7);

    expect(daily[0].dayName).toBe('Lun');
    expect(daily[0].classHours).toBe(4);
    expect(daily[0].independentHours).toBe(2);
    expect(daily[0].sleepHours).toBe(7);
    expect(daily[0].freeHours).toBe(11);
    expect(daily[0].isOverloaded).toBe(false);

    expect(daily[1].dayName).toBe('Mar');
    expect(daily[1].classHours).toBe(0);
    expect(daily[1].independentHours).toBe(2);
    expect(daily[1].sleepHours).toBe(7);
    expect(daily[1].freeHours).toBe(15);

    expect(daily[2].classHours).toBe(2);
    expect(daily[2].independentHours).toBe(2);
    expect(daily[2].freeHours).toBe(13);
  });

  it('marca sobrecarga diaria cuando las horas demandadas superan las 24h del día', () => {
    const universities = [university({ id: 'udea', name: 'UdeA' })];
    const subjects = [subject({ id: 'intensa', university_id: 'udea', credits: 10 })];
    const schedules = [
      schedule({ id: 'sch1', subject_id: 'intensa', day_of_week: 1, start_time: '06:00', end_time: '22:00' }),
    ];

    const weeklyIndependentHours = 28;
    const daily = buildDailyLoad(schedules, subjects, universities, weeklyIndependentHours);

    expect(daily[0].classHours).toBe(16);
    expect(daily[0].independentHours).toBe(4);
    expect(daily[0].freeHours).toBe(-3);
    expect(daily[0].isOverloaded).toBe(true);
  });
});
