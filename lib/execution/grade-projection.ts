// Proyección de nota por materia (US5), compartida entre get_grade_projection (MCP) y la
// sección "En riesgo" del reporte semanal (lib/execution/report.ts, US6). Un solo cálculo
// (Principio I): ninguno de los dos vuelve a hacer el fetch + projectSubjectGrade + computeAlerts
// por su lado.

import { fetchSubjectsFromDb, fetchUniversitiesFromDb, fetchDeliverablesFromDb } from '../db/repository-pg';
import { projectSubjectGrade, GradeProjection, GradeProjectionFlag } from '../domain/subject';
import { computeAlerts, GradeAlert, AlertSubjectInput } from '../domain/execution';
import { localParts, addDays } from './time';
import { readTandas } from './tandas';

export interface SubjectProjectionEntry {
  subject_id: string;
  name: string;
  projection: GradeProjection;
  flags: GradeProjectionFlag[];
  /** Próxima evaluación pendiente (título y fecha), o null. Uso interno: alimenta la alerta
   * "abandonada" y la sección "En riesgo" del reporte; get_grade_projection no la expone porque
   * su contrato documentado no la incluye (contracts/mcp-tools.md). */
  nextPending: { title: string; due_date: string } | null;
}

export interface GradeProjectionsResult {
  materias: SubjectProjectionEntry[];
  alertas: GradeAlert[];
}

interface SubjectRow {
  id: string;
  name: string;
  university_id?: string | null;
  target_grade?: number | null;
}
interface UniversityRow {
  id: string;
  scale_max: number;
  passing_grade: number;
}
interface DeliverableRow {
  subject_id: string;
  title: string;
  weight_percentage: number;
  grade?: number | null;
  status: string;
  due_date?: string | null;
}

/**
 * Calcula la proyección y las alertas de una materia (o de todas, sin `subjectId`). La escala y
 * la aprobatoria salen de `universities` (T047); sin una meta personal registrada
 * (`subjects.target_grade`), la meta cae en la aprobatoria — FR-026 exige calcular "la necesaria
 * para aprobar y para la meta" siempre, y un `target_grade` ausente llega como 0/NaN desde
 * fetchSubjectsFromDb (Number(null) = 0), lo que produciría una meta sin sentido si no se
 * resguarda aquí.
 */
export async function computeGradeProjections(now: Date, subjectId?: string): Promise<GradeProjectionsResult> {
  const [subjectsRaw, universitiesRaw, deliverablesRaw] = await Promise.all([
    fetchSubjectsFromDb(),
    fetchUniversitiesFromDb(),
    fetchDeliverablesFromDb(),
  ]);

  let subjects = (Array.isArray(subjectsRaw) ? subjectsRaw : []) as SubjectRow[];
  if (subjectId) subjects = subjects.filter((s) => s.id === subjectId);
  const universities = (Array.isArray(universitiesRaw) ? universitiesRaw : []) as UniversityRow[];
  const deliverables = (Array.isArray(deliverablesRaw) ? deliverablesRaw : []) as DeliverableRow[];

  const todayKey = localParts(now).dateKey;
  const weekAgoKey = addDays(todayKey, -6);

  const materias: SubjectProjectionEntry[] = [];
  const alertInputs: AlertSubjectInput[] = [];

  for (const subject of subjects) {
    const university = subject.university_id ? universities.find((u) => u.id === subject.university_id) : undefined;
    const scaleMax = university?.scale_max ?? 5;
    const passingGrade = university?.passing_grade ?? 3.0;
    const rawTarget = subject.target_grade;
    const targetGrade =
      typeof rawTarget === 'number' && Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : passingGrade;

    const subjectDeliverables = deliverables.filter((d) => d.subject_id === subject.id);
    const { projection, flags } = projectSubjectGrade(subjectDeliverables, { scaleMax, passingGrade, targetGrade }, now);

    const pendingSorted = subjectDeliverables
      .filter((d) => d.status === 'pendiente' && d.due_date)
      .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime());
    const nextPending = pendingSorted[0]
      ? { title: pendingSorted[0].title, due_date: pendingSorted[0].due_date as string }
      : null;

    const tandasRes = await readTandas({ subject_id: subject.id, from: weekAgoKey, to: todayKey }, now);
    const tandasLast7Days = tandasRes.status === 'success' ? tandasRes.data!.tandas.length : 0;

    materias.push({ subject_id: subject.id, name: subject.name, projection, flags, nextPending });
    alertInputs.push({
      subject_id: subject.id,
      name: subject.name,
      flags,
      nextPendingDueDate: nextPending?.due_date ?? null,
      tandasLast7Days,
    });
  }

  const alertas = computeAlerts(alertInputs, now);
  return { materias, alertas };
}
