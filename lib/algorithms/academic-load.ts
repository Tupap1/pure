import type {
  SubjectEntity,
  ScheduleEntity,
  UniversityEntity,
  DeliverableEntity,
  SyllabusTopicEntity,
} from '../db/dexie-schema';
import { findSynergiesBetweenTopics, type SyllabusTopic } from '../domain/syllabus';
import {
  calculateCreditLoad,
  calculateDME,
  calculateNetFreeTime,
  calculateTotalClassHours,
  DEFAULT_SEMESTER_WEEKS,
  TOTAL_WEEKLY_HOURS,
  type ClassScheduleHoursInput,
  type CreditLoadBreakdown,
  type DMEResult,
} from './study-hours-dme';

/** Horas de sueño asumidas por noche. 7h × 7 días = 49h semanales. */
export const SLEEP_HOURS_PER_NIGHT = 7;

/** Días hacia adelante que cuentan como "entrega inminente" para el bonus de urgencia. */
export const URGENCY_WINDOW_DAYS = 7;

export interface SubjectAcademicLoad {
  subject: SubjectEntity;
  university?: UniversityEntity;
  /** Reparto normativo de la materia entre acompañamiento directo y trabajo independiente. */
  creditLoad: CreditLoadBreakdown;
  /** Exigencia normativa y recomendación ajustada, con el desglose de factores. */
  dme: DMEResult;
  /** Fracción (0 a 1) de los temas de la materia que comparten contenido con otra carrera. */
  percentageSharedTopics: number;
  /** Suma de los pesos % de las entregas pendientes de la materia en los próximos 7 días. */
  upcomingDeliverablesWeight: number;
}

export interface AcademicLoadSummary {
  perSubject: SubjectAcademicLoad[];
  totalCredits: number;
  /** Horas semanales de acompañamiento directo, medidas del horario real. */
  classHours: number;
  /** Trabajo independiente que exige la norma, sumado sobre todas las materias. */
  normativeIndependentHours: number;
  /** El mismo trabajo independiente ajustado por dificultad, brecha de nota y urgencia. */
  recommendedIndependentHours: number;
  /** Lo que la norma exige en total: créditos × 3 h/sem. Equivale a clase + independiente. */
  totalAcademicHours: number;
  sleepHours: number;
  /** 168h menos la carga normativa y el sueño. Negativo cuando la semana no alcanza. */
  netFreeTime: number;
  /** El mismo balance usando la recomendación ajustada en vez de la norma pura. */
  netFreeTimeAdjusted: number;
  isOverloaded: boolean;
  /** Materias sin horario registrado: su carga se atribuye entera a trabajo independiente. */
  subjectsWithoutSchedule: number;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Adjunta a cada horario la política de sábados alternos de su universidad.
 *
 * `getSlotPeriodicity` respeta `has_alternating_saturdays === false` para forzar periodicidad
 * semanal, pero ese campo vive en la universidad y no en el horario. Sin este puente, una
 * universidad que desactivó los sábados alternos seguiría recibiendo la ponderación 0.5.
 */
function toHoursInput(
  schedule: ScheduleEntity,
  university?: UniversityEntity
): ClassScheduleHoursInput {
  return {
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    periodicity: schedule.periodicity,
    classroom: schedule.classroom,
    has_alternating_saturdays: university?.has_alternating_saturdays,
  };
}

/**
 * Fracción de los temas de cada materia que se solapan con los de otra carrera.
 *
 * Alimenta el factor de sinergia del DME: lo que ya se estudia para una materia no hay que
 * volver a estudiarlo entero para la otra. `findSynergiesBetweenTopics` ya descarta las
 * coincidencias dentro de la misma materia, así que basta una pasada sobre todos los temas.
 */
function computeSharedTopicRatios(syllabusTopics: SyllabusTopicEntity[]): Map<string, number> {
  const ratios = new Map<string, number>();
  if (syllabusTopics.length === 0) return ratios;

  const totalBySubject = new Map<string, number>();
  for (const topic of syllabusTopics) {
    totalBySubject.set(topic.subject_id, (totalBySubject.get(topic.subject_id) || 0) + 1);
  }

  const matchedBySubject = new Map<string, Set<string>>();
  const addMatch = (subjectId: string, topicId?: string) => {
    if (!topicId) return;
    const bucket = matchedBySubject.get(subjectId);
    if (bucket) bucket.add(topicId);
    else matchedBySubject.set(subjectId, new Set([topicId]));
  };

  const topics = syllabusTopics as unknown as SyllabusTopic[];
  for (const match of findSynergiesBetweenTopics(topics, topics)) {
    addMatch(match.topicA.subject_id, match.topicA.id);
    addMatch(match.topicB.subject_id, match.topicB.id);
  }

  for (const [subjectId, total] of totalBySubject) {
    const matched = matchedBySubject.get(subjectId)?.size || 0;
    ratios.set(subjectId, total > 0 ? Math.min(1, matched / total) : 0);
  }

  return ratios;
}

/**
 * Peso evaluativo pendiente de cada materia dentro de la ventana de urgencia.
 *
 * Solo cuentan las entregas todavía pendientes: una ya entregada no genera presión de estudio
 * por más que su fecha límite siga en el futuro.
 */
function computeUpcomingWeights(
  deliverables: DeliverableEntity[],
  referenceDate: Date
): Map<string, number> {
  const weights = new Map<string, number>();
  const from = referenceDate.getTime();
  const to = from + URGENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const deliverable of deliverables) {
    if (deliverable.status !== 'pendiente' || !deliverable.due_date) continue;

    const due = new Date(deliverable.due_date).getTime();
    if (Number.isNaN(due) || due < from || due > to) continue;

    const current = weights.get(deliverable.subject_id) || 0;
    weights.set(deliverable.subject_id, current + (deliverable.weight_percentage || 0));
  }

  return weights;
}

export interface AcademicLoadOptions {
  /** Entregas pendientes, para el bonus de urgencia del DME. */
  deliverables?: DeliverableEntity[];
  /** Temario, para el descuento por sinergia entre carreras. */
  syllabusTopics?: SyllabusTopicEntity[];
  semesterWeeks?: number;
  /** Fecha desde la que se mide la ventana de urgencia. Inyectable para pruebas. */
  referenceDate?: Date;
}

/**
 * Calcula la carga académica completa a partir de los datos reales del estudiante.
 *
 * Es la única fuente de estas cifras: el encabezado, el dashboard y la tabla de materias la
 * consumen a través de `useAcademicLoad`, de modo que no puedan discrepar entre sí.
 */
export function computeAcademicLoad(
  subjects: SubjectEntity[],
  schedules: ScheduleEntity[],
  universities: UniversityEntity[] = [],
  options: AcademicLoadOptions = {}
): AcademicLoadSummary {
  const {
    deliverables = [],
    syllabusTopics = [],
    semesterWeeks = DEFAULT_SEMESTER_WEEKS,
    referenceDate = new Date(),
  } = options;

  const universityById = new Map(universities.map((u) => [u.id, u]));
  const sharedTopicRatios = computeSharedTopicRatios(syllabusTopics);
  const upcomingWeights = computeUpcomingWeights(deliverables, referenceDate);

  const schedulesBySubject = new Map<string, ScheduleEntity[]>();
  for (const schedule of schedules) {
    const bucket = schedulesBySubject.get(schedule.subject_id);
    if (bucket) {
      bucket.push(schedule);
    } else {
      schedulesBySubject.set(schedule.subject_id, [schedule]);
    }
  }

  const perSubject: SubjectAcademicLoad[] = subjects.map((subject) => {
    const university = universityById.get(subject.university_id);
    const subjectSchedules = (schedulesBySubject.get(subject.id || '') || []).map((s) =>
      toHoursInput(s, university)
    );

    const creditLoad = calculateCreditLoad(subject, subjectSchedules, semesterWeeks);
    const percentageSharedTopics = sharedTopicRatios.get(subject.id || '') || 0;
    const upcomingDeliverablesWeight = upcomingWeights.get(subject.id || '') || 0;

    const dme = calculateDME(subject as any, {
      baseIndependentHours: creditLoad.weeklyIndependentHours,
      percentageSharedTopics,
      upcomingDeliverablesWeight7Days: upcomingDeliverablesWeight,
    });

    return { subject, university, creditLoad, dme, percentageSharedTopics, upcomingDeliverablesWeight };
  });

  // Las horas de clase se suman sobre TODOS los horarios, incluidos los que apuntan a una
  // materia que ya no existe: siguen ocupando tiempo real en la semana del estudiante.
  const classHours = roundTo(
    calculateTotalClassHours(
      schedules.map((s) => {
        const subject = subjects.find((sub) => sub.id === s.subject_id);
        return toHoursInput(s, subject ? universityById.get(subject.university_id) : undefined);
      })
    ),
    2
  );

  const normativeIndependentHours = roundTo(
    perSubject.reduce((sum, item) => sum + item.creditLoad.weeklyIndependentHours, 0),
    2
  );
  const recommendedIndependentHours = roundTo(
    perSubject.reduce((sum, item) => sum + item.dme.recommendedWeeklyHours, 0),
    2
  );
  const totalCredits = perSubject.reduce((sum, item) => sum + item.creditLoad.credits, 0);
  const sleepHours = SLEEP_HOURS_PER_NIGHT * 7;

  const netFreeTime = calculateNetFreeTime({
    classHours,
    dmeHours: normativeIndependentHours,
    sleepHoursPerNight: SLEEP_HOURS_PER_NIGHT,
  });
  const netFreeTimeAdjusted = calculateNetFreeTime({
    classHours,
    dmeHours: recommendedIndependentHours,
    sleepHoursPerNight: SLEEP_HOURS_PER_NIGHT,
  });

  return {
    perSubject,
    totalCredits,
    classHours,
    normativeIndependentHours,
    recommendedIndependentHours,
    totalAcademicHours: roundTo(classHours + normativeIndependentHours, 2),
    sleepHours,
    netFreeTime,
    netFreeTimeAdjusted,
    isOverloaded: netFreeTime < 0,
    subjectsWithoutSchedule: perSubject.filter((item) => item.creditLoad.hasNoSchedule).length,
  };
}

export interface DailyLoad {
  /** 1 = Lunes … 7 = Domingo, igual que `ScheduleEntity.day_of_week`. */
  dayOfWeek: number;
  dayName: string;
  fullDay: string;
  /** Horas de clase de ese día, tomadas del horario real. */
  classHours: number;
  /** Parte del trabajo independiente semanal que toca ese día. Es una meta, no un registro. */
  independentHours: number;
  sleepHours: number;
  /** Lo que queda de las 24h del día. Negativo si la carga no cabe. */
  freeHours: number;
  isOverloaded: boolean;
}

const DAY_NAMES: Array<{ short: string; full: string }> = [
  { short: 'Lun', full: 'Lunes' },
  { short: 'Mar', full: 'Martes' },
  { short: 'Mié', full: 'Miércoles' },
  { short: 'Jue', full: 'Jueves' },
  { short: 'Vie', full: 'Viernes' },
  { short: 'Sáb', full: 'Sábado' },
  { short: 'Dom', full: 'Domingo' },
];

export const HOURS_PER_DAY = 24;

/**
 * Reparte la semana en días para el comparativo de carga diaria.
 *
 * Las horas de clase son reales: salen del horario, día por día. El trabajo independiente no
 * está agendado en ninguna parte, así que se reparte por igual entre los siete días y se
 * presenta como meta distribuida, nunca como horas efectivamente estudiadas.
 */
export function buildDailyLoad(
  schedules: ScheduleEntity[],
  subjects: SubjectEntity[],
  universities: UniversityEntity[],
  weeklyIndependentHours: number
): DailyLoad[] {
  const universityById = new Map(universities.map((u) => [u.id, u]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const independentPerDay = roundTo(Math.max(0, weeklyIndependentHours) / 7, 2);

  return DAY_NAMES.map((names, index) => {
    const dayOfWeek = index + 1;
    const daySchedules = schedules
      .filter((s) => s.day_of_week === dayOfWeek)
      .map((s) => {
        const subject = subjectById.get(s.subject_id);
        return toHoursInput(s, subject ? universityById.get(subject.university_id) : undefined);
      });

    const classHours = roundTo(calculateTotalClassHours(daySchedules), 2);
    const sleepHours = SLEEP_HOURS_PER_NIGHT;
    const freeHours = roundTo(HOURS_PER_DAY - classHours - independentPerDay - sleepHours, 2);

    return {
      dayOfWeek,
      dayName: names.short,
      fullDay: names.full,
      classHours,
      independentHours: independentPerDay,
      sleepHours,
      freeHours,
      isOverloaded: freeHours < 0,
    };
  });
}

export { TOTAL_WEEKLY_HOURS };
