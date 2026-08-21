import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { useAcademicLoad } from '@/lib/hooks/useAcademicLoad';
import { calculateWeightedGrade } from '@/lib/domain/subject';
import { GradeProgressBar } from '@/components/ui/GradeProgressBar';
import { Badge } from '@/components/ui/Badge';
import { SubjectEvaluation } from '@/components/ui/SubjectEvaluation';
import { AttendancePanel } from '@/components/ui/AttendancePanel';
import { SubjectFicha } from '@/components/ui/SubjectFicha';
import { SubjectClasses } from '@/components/ui/SubjectClasses';
import { SubjectSyllabus } from '@/components/ui/SubjectSyllabus';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

interface SubjectHubProps {
  subjectId: string;
}

type HubSection = 'resumen' | 'ficha' | 'evaluacion' | 'clases' | 'temario' | 'asistencia';

const SECTIONS: { id: HubSection; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'ficha', label: 'Ficha' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'clases', label: 'Clases' },
  { id: 'temario', label: 'Temario' },
  { id: 'asistencia', label: 'Asistencia' },
];

/** Fila de desglose reutilizada en el Resumen (DME). No es la extracción de NormativeBreakdown. */
const BreakdownRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className={cn('text-slate-500 dark:text-slate-400', strong && 'font-semibold text-slate-700 dark:text-slate-300')}>
      {label}
    </span>
    <span className={cn('font-mono shrink-0', strong ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')}>
      {value}
    </span>
  </div>
);


/**
 * Hub de una asignatura: superficie de detalle a la que se llega por drill-in. Reúne en un
 * solo lugar todo lo relativo a una materia, con una sub-navegación de seis secciones.
 *
 * Secciones:
 * - Resumen: desglose de carga de estudio y progreso hacia la meta
 * - Ficha: datos del profesor, horario, datos de la materia y escala de calificación
 * - Evaluación: esquema ponderado de evaluación y notas
 * - Clases: listado de sesiones de clase con enlaces a grabaciones y transcripciones
 * - Temario: syllabus agrupado por unidades con estados de dominio
 * - Asistencia: registro de asistencias
 */
export const SubjectHub: React.FC<SubjectHubProps> = ({ subjectId }) => {
  const { subjects, universities, professors, schedules, deliverables, attendanceRecords, classSessions, syllabusTopics } = usePureData();
  const { perSubject } = useAcademicLoad();
  const [section, setSection] = useState<HubSection>('resumen');

  const subject = subjects.find((s) => s.id === subjectId);

  if (!subject) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No encontramos esta asignatura"
        description="Puede que se haya eliminado o que aún esté sincronizando. Vuelve al índice de asignaturas."
      />
    );
  }

  const university = universities.find((u) => u.id === subject.university_id);
  const professor = professors.find((p) => p.id === subject.professor_id);
  const load = perSubject.find((p) => p.subject.id === subjectId);

  const subjectDeliverables = deliverables.filter((d) => d.subject_id === subject.id);
  const { currentGrade } = calculateWeightedGrade(subjectDeliverables);
  const subjectSchedules = schedules.filter((s) => s.subject_id === subject.id);

  const dme = load?.dme;
  const creditLoad = load?.creditLoad;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Encabezado de identidad */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: university?.color || '#9b9b9b' }}
            aria-hidden
          />
          <h2 className="text-xl font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {subject.name}
          </h2>
          <Badge variant={subject.modality === 'presencial' ? 'aeroespacial' : 'software'}>
            {subject.modality}
          </Badge>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {university?.name ?? 'Sin universidad'}
          {professor?.name && <> · {professor.name}</>}
          {subject.code && <span className="font-mono"> · Cód {subject.code}</span>}
          {' · '}
          <span className="font-mono">{subject.credits}</span> créditos
        </div>
      </div>

      {/* Dos cifras hero: nota calculada vs meta y DME semanal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">
              Nota actual
            </span>
            <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
              {currentGrade > 0 ? currentGrade.toFixed(2) : '—'}
            </span>
          </div>
          <GradeProgressBar
            currentGrade={currentGrade}
            targetGrade={subject.target_grade}
            scaleMin={university?.scale_min ?? 0}
            scaleMax={university?.scale_max ?? 5}
          />
        </div>

        <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">
              Dosis mínima eficaz
            </span>
            <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
              {dme ? dme.recommendedWeeklyHours.toFixed(1) : '—'}
              <span className="text-xs font-normal text-slate-400"> h/sem</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {creditLoad
              ? `Norma: ${creditLoad.weeklyIndependentHours.toFixed(1)} h/sem de trabajo independiente`
              : 'Sin datos de carga para esta materia'}
          </p>
        </div>
      </div>

      {/* Sub-navegación — estado activo en gris sutil, sin barra de acento */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-surface-border scrollbar-none">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                active
                  ? 'bg-surface-subtle text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Contenido de la sección activa */}
      <div>
        {section === 'resumen' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-2">
              <h4 className="text-xs font-heading font-semibold text-slate-900 dark:text-slate-100">
                Progreso hacia la meta
              </h4>
              <GradeProgressBar
                currentGrade={currentGrade}
                targetGrade={subject.target_grade}
                scaleMin={university?.scale_min ?? 0}
                scaleMax={university?.scale_max ?? 5}
              />
            </div>

            <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-2 text-xs">
              <h4 className="text-xs font-heading font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Carga de estudio semanal
              </h4>
              {creditLoad && dme ? (
                <>
                  <BreakdownRow
                    label={`${creditLoad.credits} créditos × 48 h por semestre`}
                    value={`${creditLoad.semesterHours} h`}
                  />
                  <BreakdownRow
                    label={creditLoad.hasNoSchedule ? 'Clase (sin horario registrado)' : 'Acompañamiento directo (clase)'}
                    value={`${creditLoad.weeklyClassHours.toFixed(1)} h/sem`}
                  />
                  <BreakdownRow
                    label="Trabajo independiente (norma)"
                    value={`${creditLoad.weeklyIndependentHours.toFixed(1)} h/sem`}
                    strong
                  />
                  <div className="pt-1.5 mt-1 border-t border-surface-border space-y-2">
                    <BreakdownRow label={`Dificultad ${subject.difficulty} de 5`} value={`× ${dme.breakdown.difficultyMultiplier.toFixed(2)}`} />
                    <BreakdownRow label="Margen de nota" value={`× ${dme.breakdown.marginFactor.toFixed(2)}`} />
                    <BreakdownRow label="Sinergia entre carreras" value={`× ${dme.breakdown.synergyFactor.toFixed(2)}`} />
                    <BreakdownRow label="Urgencia de entregas (7 días)" value={`+ ${dme.breakdown.urgencyBonus.toFixed(2)} h`} />
                    <BreakdownRow label="Sugerido para ti (DME)" value={`${dme.recommendedWeeklyHours.toFixed(1)} h/sem`} strong />
                  </div>
                </>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">Sin datos de carga para esta materia.</p>
              )}
            </div>
          </div>
        )}

        {section === 'ficha' && (
          <SubjectFicha
            subject={subject}
            university={university}
            professor={professor}
            schedules={subjectSchedules}
          />
        )}

        {section === 'evaluacion' && (
          <SubjectEvaluation subject={subject} deliverables={deliverables} />
        )}

        {section === 'clases' && (
          <SubjectClasses
            sessions={classSessions.filter((cs) => cs.subject_id === subject.id)}
            subjects={subjects}
          />
        )}

        {section === 'temario' && (
          <SubjectSyllabus
            topics={syllabusTopics.filter((st) => st.subject_id === subject.id)}
          />
        )}

        {section === 'asistencia' && (
          <AttendancePanel
            subjects={[subject]}
            schedules={subjectSchedules}
            universities={universities}
            attendanceRecords={attendanceRecords}
          />
        )}
      </div>
    </div>
  );
};
