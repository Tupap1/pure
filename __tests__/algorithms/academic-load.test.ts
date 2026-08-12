import { describe, it, expect } from 'vitest';
import { computeAcademicLoad, buildDailyLoad } from '@/lib/algorithms/academic-load';
import type {
  SubjectEntity,
  ScheduleEntity,
  UniversityEntity,
  DeliverableEntity,
  SyllabusTopicEntity,
} from '@/lib/db/dexie-schema';

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

describe('computeAcademicLoad — sinergia entre carreras y urgencia de entregas', () => {
  const REFERENCE = new Date(2026, 7, 12, 9, 0, 0); // 12 de agosto de 2026, hora local

  function deliverable(
    overrides: Partial<DeliverableEntity> & { id: string; subject_id: string }
  ): DeliverableEntity {
    return {
      title: 'Parcial',
      due_date: new Date(2026, 7, 15, 12, 0, 0).toISOString(),
      weight_percentage: 30,
      type: 'parcial',
      is_group: false,
      complexity: 'medio',
      status: 'pendiente',
      ...overrides,
    };
  }

  function topic(
    overrides: Partial<SyllabusTopicEntity> & { id: string; subject_id: string; title: string }
  ): SyllabusTopicEntity {
    return {
      mastery_status: 'no_iniciado',
      order_index: 0,
      ...overrides,
    };
  }

  const universities = [university({ id: 'udea', name: 'UdeA' })];

  it('suma el bonus de urgencia por las entregas pendientes de los próximos 7 días', () => {
    const subjects = [subject({ id: 'calculo', university_id: 'udea', credits: 3, difficulty: 3 })];
    const schedules = [
      schedule({ id: 's1', subject_id: 'calculo', start_time: '08:00', end_time: '11:00' }), // 3h clase
    ];
    // 3 créditos -> 9h normativas, menos 3h de clase = 6h independientes de base.
    const deliverables = [deliverable({ id: 'd1', subject_id: 'calculo', weight_percentage: 30 })];

    const load = computeAcademicLoad(subjects, schedules, universities, {
      deliverables,
      referenceDate: REFERENCE,
    });
    const item = load.perSubject[0];

    expect(item.upcomingDeliverablesWeight).toBe(30);
    expect(item.dme.breakdown.urgencyBonus).toBe(1.5); // 30% × 0.05
    expect(item.dme.normativeWeeklyHours).toBe(6); // la norma no se mueve por la urgencia
    expect(item.dme.recommendedWeeklyHours).toBe(8.1); // 6 × 1.1 + 1.5
  });

  it('ignora las entregas fuera de la ventana de 7 días y las que ya no están pendientes', () => {
    const subjects = [subject({ id: 'calculo', university_id: 'udea', credits: 3 })];
    const deliverables = [
      // Dentro de la ventana, pero ya entregada.
      deliverable({ id: 'd1', subject_id: 'calculo', status: 'entregado', weight_percentage: 40 }),
      // Pendiente, pero a 20 días vista.
      deliverable({
        id: 'd2',
        subject_id: 'calculo',
        due_date: new Date(2026, 8, 1, 12, 0, 0).toISOString(),
        weight_percentage: 25,
      }),
    ];

    const load = computeAcademicLoad(subjects, [], universities, {
      deliverables,
      referenceDate: REFERENCE,
    });

    expect(load.perSubject[0].upcomingDeliverablesWeight).toBe(0);
    expect(load.perSubject[0].dme.breakdown.urgencyBonus).toBe(0);
  });

  it('descuenta horas cuando dos carreras comparten temario', () => {
    const subjects = [
      subject({ id: 'mate-udea', university_id: 'udea', credits: 3, difficulty: 3 }),
      subject({ id: 'mate-udec', university_id: 'udea', credits: 3, difficulty: 3 }),
    ];
    const syllabusTopics = [
      topic({ id: 't1', subject_id: 'mate-udea', title: 'Álgebra Lineal y Matrices' }),
      topic({ id: 't2', subject_id: 'mate-udec', title: 'Álgebra Lineal y Matrices' }),
    ];

    const load = computeAcademicLoad(subjects, [], universities, {
      syllabusTopics,
      referenceDate: REFERENCE,
    });
    const item = load.perSubject[0];

    // El único tema de la materia coincide con el de la otra carrera.
    expect(item.percentageSharedTopics).toBe(1);
    expect(item.dme.breakdown.synergyFactor).toBe(0.7); // 1 - 0.3 × 1
    // Sin horario, las 9h normativas son todas independientes.
    expect(item.dme.normativeWeeklyHours).toBe(9);
    expect(item.dme.recommendedWeeklyHours).toBe(6.93); // 9 × 1.1 × 0.7
    expect(item.dme.recommendedWeeklyHours).toBeLessThan(item.dme.normativeWeeklyHours);
  });

  it('no aplica sinergia cuando los temarios no se parecen', () => {
    const subjects = [
      subject({ id: 'mate', university_id: 'udea', credits: 3 }),
      subject({ id: 'historia', university_id: 'udea', credits: 3 }),
    ];
    const syllabusTopics = [
      topic({ id: 't1', subject_id: 'mate', title: 'Derivadas parciales' }),
      topic({ id: 't2', subject_id: 'historia', title: 'Independencia de Colombia' }),
    ];

    const load = computeAcademicLoad(subjects, [], universities, {
      syllabusTopics,
      referenceDate: REFERENCE,
    });

    expect(load.perSubject[0].percentageSharedTopics).toBe(0);
    expect(load.perSubject[0].dme.breakdown.synergyFactor).toBe(1);
  });

  it('sin entregas ni temario, la recomendación solo depende de dificultad y nota', () => {
    const subjects = [subject({ id: 'calculo', university_id: 'udea', credits: 3, difficulty: 3 })];

    const load = computeAcademicLoad(subjects, [], universities, { referenceDate: REFERENCE });
    const item = load.perSubject[0];

    expect(item.percentageSharedTopics).toBe(0);
    expect(item.upcomingDeliverablesWeight).toBe(0);
    expect(item.dme.breakdown.synergyFactor).toBe(1);
    expect(item.dme.breakdown.urgencyBonus).toBe(0);
    expect(item.dme.recommendedWeeklyHours).toBe(9.9); // 9 × 1.1
  });
});
