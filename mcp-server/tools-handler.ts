import { calculateNetFreeTime } from '../lib/algorithms/study-hours-dme';
import { findSynergiesBetweenTopics, SyllabusTopic } from '../lib/domain/syllabus';

export function handleGetAcademicOverview() {
  return {
    status: 'success',
    data: {
      netFreeTimeHours: calculateNetFreeTime({ classHours: 20, dmeHours: 12.5, sleepHoursPerNight: 7 }),
      universities: [
        { name: 'Universidad 1 (Aeroespacial)', currentGPA: 4.65, modality: 'presencial' },
        { name: 'Universidad 2 (Software)', currentGPA: 4.40, modality: 'virtual' },
      ],
      activeSynergies: 3,
      urgentDeliverables: 3,
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
    { id: 'a1', subject_id: 'aero-1', title: 'Resolución de Matrices y Métodos Numéricos', mastery_status: 'dominado', order_index: 1 },
  ];

  const topicsSoft: SyllabusTopic[] = [
    { id: 's1', subject_id: 'soft-1', title: 'Algoritmos Numéricos con Matrices', mastery_status: 'no_iniciado', order_index: 1 },
  ];

  const matches = findSynergiesBetweenTopics(topicsAero, topicsSoft);

  return {
    status: 'success',
    synergiesCount: matches.length,
    synergies: matches,
  };
}
