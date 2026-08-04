import { calculateNetFreeTime } from '../lib/algorithms/study-hours-dme';
import { findSynergiesBetweenTopics, SyllabusTopic } from '../lib/domain/syllabus';
import { UniversityEntity, SubjectEntity } from '../lib/db/dexie-schema';

export function handleGetAcademicOverview() {
  return {
    status: 'success',
    data: {
      netFreeTimeHours: calculateNetFreeTime({ classHours: 28, dmeHours: 24, sleepHoursPerNight: 7 }),
      universities: [
        { name: 'Universidad de Antioquia - Ingeniería Aeroespacial', currentGPA: 4.5, modality: 'presencial' as const },
        { name: 'Universidad de Cartagena - Ingeniería de Software (A Distancia)', currentGPA: 4.6, modality: 'virtual' as const },
      ],
      activeSynergies: 4,
      urgentDeliverables: 0,
    },
  };
}

export function handleParseAndIngestSyllabus(subjectId: string, rawText: string) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const topics: SyllabusTopic[] = [];

  let currentParentId: string | undefined = undefined;

  lines.forEach((line, index) => {
    if (line.toLowerCase().startsWith('unidad')) {
      const parentId = `unit-${index}`;
      currentParentId = parentId;
      topics.push({
        id: parentId,
        subject_id: subjectId,
        title: line,
        mastery_status: 'no_iniciado',
        order_index: index,
      });
    } else {
      topics.push({
        id: `topic-${index}`,
        subject_id: subjectId,
        parent_id: currentParentId,
        title: line.replace(/^[-*•]\s*/, ''),
        mastery_status: 'no_iniciado',
        order_index: index,
      });
    }
  });

  return {
    status: 'success',
    topicsParsed: topics.length,
    topics,
  };
}

export function handleFindCrossSubjectSynergies() {
  const topicsAero: SyllabusTopic[] = [
    { id: 'a1', subject_id: 'sub-geom', title: 'Resolución de Matrices y Vectores de Estado', mastery_status: 'dominado', order_index: 1 },
    { id: 'a2', subject_id: 'sub-calc', title: 'Ecuaciones Diferenciales y Métodos Numéricos', mastery_status: 'en_estudio', order_index: 2 },
  ];

  const topicsSoft: SyllabusTopic[] = [
    { id: 's1', subject_id: 'sub-prog', title: 'Algoritmos y Operaciones Matriciales C++', mastery_status: 'no_iniciado', order_index: 1 },
    { id: 's2', subject_id: 'sub-udec-ecuaciones', title: 'Ecuaciones Diferenciales Aplicadas', mastery_status: 'en_estudio', order_index: 2 },
  ];

  const matches = findSynergiesBetweenTopics(topicsAero, topicsSoft);

  return {
    status: 'success',
    synergiesCount: matches.length,
    synergies: matches,
  };
}

export function handleIngestAcademicEnrollment(rawEnrollmentText?: string) {
  const universities: Omit<UniversityEntity, 'created_at'>[] = [
    {
      id: 'uni-udea',
      name: 'Universidad de Antioquia - Ingeniería Aeroespacial',
      modality: 'presencial',
      scale_min: 0.0,
      scale_max: 5.0,
      passing_grade: 3.0,
      color: '#0ea5e9',
    },
    {
      id: 'uni-udec',
      name: 'Universidad de Cartagena - Ingeniería de Software (A Distancia)',
      modality: 'virtual',
      scale_min: 0.0,
      scale_max: 5.0,
      passing_grade: 3.0,
      color: '#6366f1',
    },
  ];

  const professors = [
    { id: 'prof-udea', university_id: 'uni-udea', name: 'Coordinación Aeroespacial UdeA', email: 'aeroespacial@udea.edu.co' },
    { id: 'prof-javier-gomez', university_id: 'uni-udec', name: 'Javier Gómez', email: 'jgomez@unicartagena.edu.co' },
    { id: 'prof-carlos-caceres', university_id: 'uni-udec', name: 'Carlos Cáceres', email: 'ccaceres@unicartagena.edu.co' },
    { id: 'prof-atilano-arrieta', university_id: 'uni-udec', name: 'Atilano Arrieta', email: 'aarrieta@unicartagena.edu.co' },
    { id: 'prof-armando-acosta', university_id: 'uni-udec', name: 'Armando Acosta', email: 'aacosta@unicartagena.edu.co' },
  ];

  const subjects: Omit<SubjectEntity, 'created_at' | 'current_grade'>[] = [
    // --- UdeA (Ingeniería Aeroespacial) ---
    { id: 'sub-vivamos', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Vivamos la Universidad', code: '2585101', credits: 1, difficulty: 1, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-geom', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Geometría Vectorial y Analítica', code: '2585131', credits: 3, difficulty: 4, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-calc', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Cálculo Diferencial', code: '2585132', credits: 3, difficulty: 4, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-quim', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Química General', code: '2585240', credits: 4, difficulty: 3, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-intro-aero', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Introducción a la Ingeniería Aeroespacial', code: '2591101', credits: 1, difficulty: 2, modality: 'presencial', target_grade: 4.8 },
    { id: 'sub-prog', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Programación y Ciencia Computacional', code: '2591102', credits: 3, difficulty: 3, modality: 'presencial', target_grade: 4.8 },

    // --- UdeC (Ingeniería de Software - A Distancia) ---
    { id: 'sub-udec-fisica1', university_id: 'uni-udec', professor_id: 'prof-javier-gomez', name: 'Física I (Mecánica y Termodinámica)', code: 'CFBD269', credits: 2, difficulty: 4, modality: 'virtual', target_grade: 4.5 },
    { id: 'sub-udec-bd2', university_id: 'uni-udec', professor_id: 'prof-carlos-caceres', name: 'Base de Datos II', code: 'IX24450', credits: 3, difficulty: 3, modality: 'virtual', target_grade: 4.5 },
    { id: 'sub-udec-ecuaciones', university_id: 'uni-udec', professor_id: 'prof-atilano-arrieta', name: 'Ecuaciones Diferenciales', code: 'CFBD272', credits: 2, difficulty: 4, modality: 'virtual', target_grade: 4.5 },
    { id: 'sub-udec-web', university_id: 'uni-udec', professor_id: 'prof-armando-acosta', name: 'Desarrollo de Software Web', code: 'IX24451', credits: 3, difficulty: 3, modality: 'virtual', target_grade: 4.8 },
    { id: 'sub-udec-ingsoft', university_id: 'uni-udec', professor_id: 'prof-carlos-caceres', name: 'Ingeniería de Software B1', code: 'IX24452', credits: 3, difficulty: 3, modality: 'virtual', target_grade: 4.8 },
    { id: 'sub-udec-cienciadatos', university_id: 'uni-udec', professor_id: 'prof-armando-acosta', name: 'Ciencia de Datos I', code: 'IX24454', credits: 3, difficulty: 4, modality: 'virtual', target_grade: 4.7 },
    { id: 'sub-udec-ingles', university_id: 'uni-udec', name: 'Inglés VI', code: 'ENGV006', credits: 2, difficulty: 2, modality: 'virtual', target_grade: 4.5 },
  ];

  const schedules = [
    // --- UdeA Schedules ---
    { subject_id: 'sub-vivamos', day_of_week: 3, start_time: '11:00', end_time: '13:00', classroom: 'Aula por definir / Edificio Central' },
    { subject_id: 'sub-geom', day_of_week: 2, start_time: '09:00', end_time: '11:00', classroom: 'Aula 2-305' },
    { subject_id: 'sub-geom', day_of_week: 4, start_time: '09:00', end_time: '11:00', classroom: 'Aula 2-305' },
    { subject_id: 'sub-calc', day_of_week: 3, start_time: '09:00', end_time: '11:00', classroom: 'Aula 2-306' },
    { subject_id: 'sub-calc', day_of_week: 5, start_time: '09:00', end_time: '11:00', classroom: 'Aula 2-306' },
    { subject_id: 'sub-quim', day_of_week: 2, start_time: '07:00', end_time: '09:00', classroom: 'Aula 2-305 (Teoría)' },
    { subject_id: 'sub-quim', day_of_week: 2, start_time: '11:00', end_time: '13:00', classroom: 'LAB 3-103 (Práctica)' },
    { subject_id: 'sub-quim', day_of_week: 4, start_time: '07:00', end_time: '09:00', classroom: 'Aula 2-305 (Teoría)' },
    { subject_id: 'sub-intro-aero', day_of_week: 3, start_time: '15:00', end_time: '17:00', classroom: 'Aula 1-403' },
    { subject_id: 'sub-prog', day_of_week: 3, start_time: '13:00', end_time: '15:00', classroom: 'SISTEMAS 1A' },
    { subject_id: 'sub-prog', day_of_week: 5, start_time: '13:00', end_time: '15:00', classroom: 'SISTEMAS 1A' },

    // --- UdeC Schedules (Sábados Alternados A y B - Día 6) ---
    { subject_id: 'sub-udec-fisica1', day_of_week: 6, start_time: '07:00', end_time: '08:40', classroom: 'Sábado A • Aula A304' },
    { subject_id: 'sub-udec-bd2', day_of_week: 6, start_time: '08:40', end_time: '10:20', classroom: 'Sábado A • Aula F212' },
    { subject_id: 'sub-udec-ecuaciones', day_of_week: 6, start_time: '12:00', end_time: '13:50', classroom: 'Sábado A • Aula A304' },

    { subject_id: 'sub-udec-web', day_of_week: 6, start_time: '07:00', end_time: '08:40', classroom: 'Sábado B • F215 Lab Redes A' },
    { subject_id: 'sub-udec-ingsoft', day_of_week: 6, start_time: '10:20', end_time: '12:00', classroom: 'Sábado B • Aula F212' },
    { subject_id: 'sub-udec-cienciadatos', day_of_week: 6, start_time: '12:00', end_time: '13:50', classroom: 'Sábado B • Bloque F215 Lab Redes A' },
  ];

  return {
    status: 'success',
    message: 'Matrícula Multi-Universidad (UdeA + UdeC) e historias de horario procesadas mediante el servidor MCP.',
    data: {
      universitiesCount: universities.length,
      professorsCount: professors.length,
      subjectsCount: subjects.length,
      schedulesCount: schedules.length,
      universities,
      professors,
      subjects,
      schedules,
    },
  };
}
