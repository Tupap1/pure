import { pureDB } from './dexie-schema';

export async function clearAllData() {
  await pureDB.transaction(
    'rw',
    [
      pureDB.universities,
      pureDB.professors,
      pureDB.subjects,
      pureDB.schedules,
      pureDB.syllabusTopics,
      pureDB.deliverables,
      pureDB.studySessions,
    ],
    async () => {
      await pureDB.universities.clear();
      await pureDB.professors.clear();
      await pureDB.subjects.clear();
      await pureDB.schedules.clear();
      await pureDB.syllabusTopics.clear();
      await pureDB.deliverables.clear();
      await pureDB.studySessions.clear();
    }
  );
}

export async function seedRealSemesterData() {
  await clearAllData();

  // 1. Universidad
  const uniId = 'uni-udea';
  await pureDB.universities.add({
    id: uniId,
    name: 'Universidad de Antioquia - Ingeniería Aeroespacial',
    modality: 'presencial',
    scale_min: 0.0,
    scale_max: 5.0,
    passing_grade: 3.0,
    color: '#0ea5e9',
    created_at: new Date().toISOString(),
  });

  // 2. Profesor Base
  const profId = 'prof-udea-base';
  await pureDB.professors.add({
    id: profId,
    university_id: uniId,
    name: 'Coordinación Nivel I - Aeroespacial',
    email: 'aeroespacial@udea.edu.co',
    created_at: new Date().toISOString(),
  });

  // 3. Materias Matriculadas Nivel I
  const sub1 = 'sub-vivamos';
  const sub2 = 'sub-geom';
  const sub3 = 'sub-calc';
  const sub4 = 'sub-quim';
  const sub5 = 'sub-intro-aero';
  const sub6 = 'sub-prog';

  await pureDB.subjects.bulkAdd([
    {
      id: sub1,
      university_id: uniId,
      professor_id: profId,
      name: 'Vivamos la Universidad',
      code: '2585101',
      credits: 1,
      difficulty: 1,
      modality: 'presencial',
      target_grade: 4.5,
      current_grade: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: sub2,
      university_id: uniId,
      professor_id: profId,
      name: 'Geometría Vectorial y Analítica',
      code: '2585131',
      credits: 3,
      difficulty: 4,
      modality: 'presencial',
      target_grade: 4.5,
      current_grade: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: sub3,
      university_id: uniId,
      professor_id: profId,
      name: 'Cálculo Diferencial',
      code: '2585132',
      credits: 3,
      difficulty: 4,
      modality: 'presencial',
      target_grade: 4.5,
      current_grade: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: sub4,
      university_id: uniId,
      professor_id: profId,
      name: 'Química General',
      code: '2585240',
      credits: 4,
      difficulty: 3,
      modality: 'presencial',
      target_grade: 4.5,
      current_grade: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: sub5,
      university_id: uniId,
      professor_id: profId,
      name: 'Introducción a la Ingeniería Aeroespacial',
      code: '2591101',
      credits: 1,
      difficulty: 2,
      modality: 'presencial',
      target_grade: 4.8,
      current_grade: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: sub6,
      university_id: uniId,
      professor_id: profId,
      name: 'Programación y Ciencia Computacional',
      code: '2591102',
      credits: 3,
      difficulty: 3,
      modality: 'presencial',
      target_grade: 4.8,
      current_grade: 0,
      created_at: new Date().toISOString(),
    },
  ]);

  // 4. Horarios Semanales (1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes)
  await pureDB.schedules.bulkAdd([
    // Vivamos la Universidad (Miércoles 11-13)
    {
      id: 'sch-1',
      subject_id: sub1,
      day_of_week: 3,
      start_time: '11:00',
      end_time: '13:00',
      classroom: 'Aula por definir / Edificio Central',
      created_at: new Date().toISOString(),
    },

    // Geometría Vectorial (Martes y Jueves 9-11)
    {
      id: 'sch-2',
      subject_id: sub2,
      day_of_week: 2,
      start_time: '09:00',
      end_time: '11:00',
      classroom: 'Aula 2-305',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-3',
      subject_id: sub2,
      day_of_week: 4,
      start_time: '09:00',
      end_time: '11:00',
      classroom: 'Aula 2-305',
      created_at: new Date().toISOString(),
    },

    // Cálculo Diferencial (Miércoles y Viernes 9-11)
    {
      id: 'sch-4',
      subject_id: sub3,
      day_of_week: 3,
      start_time: '09:00',
      end_time: '11:00',
      classroom: 'Aula 2-306',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-5',
      subject_id: sub3,
      day_of_week: 5,
      start_time: '09:00',
      end_time: '11:00',
      classroom: 'Aula 2-306',
      created_at: new Date().toISOString(),
    },

    // Química General (Martes 7-9 / Martes 11-13 / Jueves 7-9)
    {
      id: 'sch-6',
      subject_id: sub4,
      day_of_week: 2,
      start_time: '07:00',
      end_time: '09:00',
      classroom: 'Aula 2-305 (Teoría)',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-7',
      subject_id: sub4,
      day_of_week: 2,
      start_time: '11:00',
      end_time: '13:00',
      classroom: 'LAB 3-103 (Práctica)',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-8',
      subject_id: sub4,
      day_of_week: 4,
      start_time: '07:00',
      end_time: '09:00',
      classroom: 'Aula 2-305 (Teoría)',
      created_at: new Date().toISOString(),
    },

    // Introducción a la Ing. Aeroespacial (Miércoles 15-17)
    {
      id: 'sch-9',
      subject_id: sub5,
      day_of_week: 3,
      start_time: '15:00',
      end_time: '17:00',
      classroom: 'Aula 1-403',
      created_at: new Date().toISOString(),
    },

    // Programación y Ciencia Computacional (Miércoles y Viernes 13-15)
    {
      id: 'sch-10',
      subject_id: sub6,
      day_of_week: 3,
      start_time: '13:00',
      end_time: '15:00',
      classroom: 'SISTEMAS 1A',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-11',
      subject_id: sub6,
      day_of_week: 5,
      start_time: '13:00',
      end_time: '15:00',
      classroom: 'SISTEMAS 1A',
      created_at: new Date().toISOString(),
    },
  ]);
}

export async function seedDemoData() {
  await seedRealSemesterData();
}
