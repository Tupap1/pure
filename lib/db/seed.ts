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

export async function seedDemoData() {
  await clearAllData();

  // 1. Universidades
  const uniAeroId = 'uni-aeroespacial';
  const uniSoftId = 'uni-software';

  await pureDB.universities.bulkAdd([
    {
      id: uniAeroId,
      name: 'Universidad Nacional (Ingeniería Aeroespacial)',
      modality: 'presencial',
      scale_min: 0.0,
      scale_max: 5.0,
      passing_grade: 3.0,
      color: '#0ea5e9',
      created_at: new Date().toISOString(),
    },
    {
      id: uniSoftId,
      name: 'Universidad Distrital (Ingeniería de Software)',
      modality: 'virtual',
      scale_min: 0.0,
      scale_max: 5.0,
      passing_grade: 3.0,
      color: '#6366f1',
      created_at: new Date().toISOString(),
    },
  ]);

  // 2. Profesores
  const prof1Id = 'prof-roberto';
  const prof2Id = 'prof-sofia';

  await pureDB.professors.bulkAdd([
    {
      id: prof1Id,
      university_id: uniAeroId,
      name: 'Dr. Roberto Ramírez',
      email: 'rramirez@aero.edu',
      office_hours: 'Martes 14:00 - 16:00',
      notes: 'Énfasis en resolución analítica y rigor matemático en parciales presenciales.',
      created_at: new Date().toISOString(),
    },
    {
      id: prof2Id,
      university_id: uniSoftId,
      name: 'Ing. Sofía Martínez',
      email: 'smartinez@software.edu',
      office_hours: 'Jueves Virtual 17:00',
      notes: 'Evalúa mediante talleres de código C++ y pruebas de rendimiento.',
      created_at: new Date().toISOString(),
    },
  ]);

  // 3. Materias
  const subAero1Id = 'sub-aero-1';
  const subSoft1Id = 'sub-soft-1';

  await pureDB.subjects.bulkAdd([
    {
      id: subAero1Id,
      university_id: uniAeroId,
      professor_id: prof1Id,
      name: 'Mecánica Orbital & Cálculo Vectorial',
      code: 'AERO-301',
      credits: 4,
      difficulty: 4,
      modality: 'presencial',
      target_grade: 4.5,
      current_grade: 4.65,
      created_at: new Date().toISOString(),
    },
    {
      id: subSoft1Id,
      university_id: uniSoftId,
      professor_id: prof2Id,
      name: 'Algoritmos Numéricos & Estructuras de Datos',
      code: 'SOFT-204',
      credits: 3,
      difficulty: 3,
      modality: 'virtual',
      target_grade: 4.0,
      current_grade: 4.4,
      created_at: new Date().toISOString(),
    },
  ]);

  // 4. Horarios
  await pureDB.schedules.bulkAdd([
    {
      id: 'sched-1',
      subject_id: subAero1Id,
      day_of_week: 1, // Lunes
      start_time: '08:00',
      end_time: '10:00',
      classroom: 'Aula 302 - Edificio de Ingenierías',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sched-2',
      subject_id: subSoft1Id,
      day_of_week: 1, // Lunes (Traslape provocado para pruebas)
      start_time: '09:00',
      end_time: '11:00',
      classroom: 'Campus Virtual / Zoom',
      created_at: new Date().toISOString(),
    },
  ]);

  // 5. Syllabus
  await pureDB.syllabusTopics.bulkAdd([
    {
      id: 'top-1',
      subject_id: subAero1Id,
      title: 'Unidad 1: Matrices y Vectores de Estado Orbital',
      mastery_status: 'dominado',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'top-2',
      subject_id: subAero1Id,
      parent_id: 'top-1',
      title: 'Resolución de Matrices y Operaciones con Vectores',
      mastery_status: 'dominado',
      order_index: 2,
      created_at: new Date().toISOString(),
    },
    {
      id: 'top-3',
      subject_id: subSoft1Id,
      title: 'Unidad 1: Algoritmos Numéricos',
      mastery_status: 'en_estudio',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'top-4',
      subject_id: subSoft1Id,
      parent_id: 'top-3',
      title: 'Algoritmos Numéricos y Operaciones con Matrices',
      mastery_status: 'en_estudio',
      order_index: 2,
      created_at: new Date().toISOString(),
    },
  ]);

  // 6. Entregas
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);

  const in3days = new Date();
  in3days.setDate(in3days.getDate() + 3);
  in3days.setHours(23, 59, 0, 0);

  await pureDB.deliverables.bulkAdd([
    {
      id: 'deliv-1',
      subject_id: subAero1Id,
      topic_id: 'top-2',
      title: 'Proyecto Integrador: Avionica C++',
      description: 'Simulación de trayectoria de satélite y matrices de orientación.',
      due_date: tomorrow.toISOString(),
      weight_percentage: 30,
      type: 'proyecto',
      is_group: true,
      complexity: 'dificil',
      status: 'pendiente',
      created_at: new Date().toISOString(),
    },
    {
      id: 'deliv-2',
      subject_id: subSoft1Id,
      topic_id: 'top-4',
      title: 'Taller 2: Algoritmos Numéricos en Matrices',
      description: 'Implementación en C++ de algoritmos de resolución matricial.',
      due_date: in3days.toISOString(),
      weight_percentage: 15,
      type: 'taller',
      is_group: false,
      complexity: 'medio',
      status: 'pendiente',
      created_at: new Date().toISOString(),
    },
    {
      id: 'deliv-3',
      subject_id: subAero1Id,
      topic_id: 'top-1',
      title: 'Parcial 1: Estructuras Aeroespaciales',
      description: 'Examen presencial de álgebra matricial.',
      due_date: new Date().toISOString(),
      weight_percentage: 25,
      grade: 4.8,
      type: 'parcial',
      is_group: false,
      complexity: 'dificil',
      status: 'calificado',
      created_at: new Date().toISOString(),
    },
  ]);
}

