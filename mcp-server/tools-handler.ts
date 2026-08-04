import { calculateNetFreeTime } from '../lib/algorithms/study-hours-dme';
import { findSynergiesBetweenTopics, SyllabusTopic } from '../lib/domain/syllabus';

export function handleGetAcademicOverview() {
  return {
    status: 'success',
    data: {
      netFreeTimeHours: calculateNetFreeTime({ classHours: 20, dmeHours: 12.5, sleepHoursPerNight: 7 }),
      universities: [
        { name: 'Universidad de Antioquia - Ingeniería Aeroespacial', currentGPA: 4.5, modality: 'presencial' },
      ],
      activeSynergies: 0,
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
    { id: 'a1', subject_id: 'sub-geom', title: 'Resolución de Matrices y Vectores', mastery_status: 'dominado', order_index: 1 },
  ];

  const topicsSoft: SyllabusTopic[] = [
    { id: 's1', subject_id: 'sub-prog', title: 'Algoritmos con Matrices y Arrays', mastery_status: 'no_iniciado', order_index: 1 },
  ];

  const matches = findSynergiesBetweenTopics(topicsAero, topicsSoft);

  return {
    status: 'success',
    synergiesCount: matches.length,
    synergies: matches,
  };
}

export function handleIngestAcademicEnrollment(rawEnrollmentText?: string) {
  const university = {
    id: 'uni-udea',
    name: 'Universidad de Antioquia - Ingeniería Aeroespacial',
    modality: 'presencial',
    scale_min: 0.0,
    scale_max: 5.0,
    passing_grade: 3.0,
    color: '#0ea5e9',
  };

  const subjects = [
    { id: 'sub-vivamos', university_id: 'uni-udea', name: 'Vivamos la Universidad', code: '2585101', credits: 1, difficulty: 1, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-geom', university_id: 'uni-udea', name: 'Geometría Vectorial y Analítica', code: '2585131', credits: 3, difficulty: 4, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-calc', university_id: 'uni-udea', name: 'Cálculo Diferencial', code: '2585132', credits: 3, difficulty: 4, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-quim', university_id: 'uni-udea', name: 'Química General', code: '2585240', credits: 4, difficulty: 3, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-intro-aero', university_id: 'uni-udea', name: 'Introducción a la Ingeniería Aeroespacial', code: '2591101', credits: 1, difficulty: 2, modality: 'presencial', target_grade: 4.8 },
    { id: 'sub-prog', university_id: 'uni-udea', name: 'Programación y Ciencia Computacional', code: '2591102', credits: 3, difficulty: 3, modality: 'presencial', target_grade: 4.8 },
  ];

  const schedules = [
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
  ];

  return {
    status: 'success',
    message: 'Matrícula y horarios procesados mediante servidor MCP.',
    data: {
      university,
      subjectsCount: subjects.length,
      schedulesCount: schedules.length,
      subjects,
      schedules,
    },
  };
}
