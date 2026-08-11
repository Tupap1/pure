import { DeliverableEntity } from '../db/dexie-schema';

export type Deliverable = DeliverableEntity;

export interface DeliverableFilterOptions {
  is_group?: boolean;
  status?: string;
  type?: string;
}

export function filterDeliverables(deliverables: DeliverableEntity[], options: DeliverableFilterOptions): DeliverableEntity[] {
  return deliverables.filter((item) => {
    if (options.is_group !== undefined && item.is_group !== options.is_group) return false;
    if (options.status !== undefined && item.status !== options.status) return false;
    if (options.type !== undefined && item.type !== options.type) return false;
    return true;
  });
}

export function sortDeliverablesByUrgency(deliverables: DeliverableEntity[]): DeliverableEntity[] {
  return deliverables
    .filter((d) => d.status === 'pendiente')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

/**
 * Formats a deliverable's due_date (date-only) without applying local timezone offsets.
 * Parses the YYYY-MM-DD components directly so that midnight UTC dates like
 * "2026-08-27T00:00:00.000Z" render as August 27th across all timezones.
 */
export function formatDeliverableDate(
  dueDateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
  locale: string = 'es-ES'
): string {
  if (!dueDateStr) return '';

  const datePart = dueDateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) {
    return dueDateStr;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return dueDateStr;
  }

  // Construct UTC Date object at noon to avoid DST edge-cases
  const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0));

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: 'UTC',
  }).format(utcDate);
}

export interface SubjectGradeProgress {
  subject_id: string;
  totalConfiguredWeight: number;
  evaluatedWeight: number;
  pendingWeight: number;
  currentWeightedGrade: number;
  isComplete100Percent: boolean;
}

/**
 * Calculates subject grade progress, total configured weight, and current weighted grade.
 */
export function calculateSubjectGradeProgress(
  deliverables: DeliverableEntity[],
  subjectId: string
): SubjectGradeProgress {
  const subDeliverables = deliverables.filter((d) => d.subject_id === subjectId);

  const totalConfiguredWeight = subDeliverables.reduce((acc, d) => acc + (Number(d.weight_percentage) || 0), 0);

  const gradedDeliverables = subDeliverables.filter(
    (d) => d.status === 'calificado' && d.grade !== undefined && d.grade !== null
  );

  const evaluatedWeight = gradedDeliverables.reduce((acc, d) => acc + (Number(d.weight_percentage) || 0), 0);

  const weightedSum = gradedDeliverables.reduce(
    (acc, d) => acc + (Number(d.grade) * Number(d.weight_percentage)),
    0
  );

  const currentWeightedGrade = evaluatedWeight > 0 ? weightedSum / evaluatedWeight : 0;
  const pendingWeight = Math.max(0, 100 - evaluatedWeight);

  return {
    subject_id: subjectId,
    totalConfiguredWeight,
    evaluatedWeight,
    pendingWeight,
    currentWeightedGrade: Number(currentWeightedGrade.toFixed(2)),
    isComplete100Percent: totalConfiguredWeight === 100,
  };
}

export interface EvaluationPreset {
  name: string;
  items: Array<{ title: string; weight: number; type: 'parcial' | 'quiz' | 'taller' | 'proyecto' | 'laboratorio' }>;
}

export const PRESETS: EvaluationPreset[] = [
  {
    name: '4 Parciales (20%) + 1 Actividad (20%)',
    items: [
      { title: 'Parcial 1', weight: 20, type: 'parcial' },
      { title: 'Parcial 2', weight: 20, type: 'parcial' },
      { title: 'Parcial 3', weight: 20, type: 'parcial' },
      { title: 'Parcial 4', weight: 20, type: 'parcial' },
      { title: 'Actividad / Taller Final', weight: 20, type: 'taller' },
    ],
  },
  {
    name: '3 Quizzes (5%) + 2 Parciales (35%) + 1 Proyecto (15%)',
    items: [
      { title: 'Quiz 1', weight: 5, type: 'quiz' },
      { title: 'Quiz 2', weight: 5, type: 'quiz' },
      { title: 'Quiz 3', weight: 5, type: 'quiz' },
      { title: 'Parcial 1', weight: 35, type: 'parcial' },
      { title: 'Parcial 2', weight: 35, type: 'parcial' },
      { title: 'Proyecto Integrador', weight: 15, type: 'proyecto' },
    ],
  },
];

/**
 * Generates deliverable entities from an evaluation preset for a given subject.
 */
export function generateDeliverablesFromPreset(preset: EvaluationPreset, subjectId: string): Omit<DeliverableEntity, 'id'>[] {
  return preset.items.map((item, idx) => ({
    subject_id: subjectId,
    title: item.title,
    weight_percentage: item.weight,
    type: item.type,
    due_date: new Date(Date.now() + (idx + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_group: false,
    complexity: 'medio',
    status: 'pendiente',
    created_at: new Date().toISOString(),
  }));
}
