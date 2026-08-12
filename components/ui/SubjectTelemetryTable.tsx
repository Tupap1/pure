import React, { useState } from 'react';
import { SubjectEntity, ProfessorEntity, UniversityEntity } from '@/lib/db/dexie-schema';
import { useAcademicLoad } from '@/lib/hooks/useAcademicLoad';
import type { SubjectAcademicLoad } from '@/lib/algorithms/academic-load';
import { Badge } from './Badge';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { GradeProgressBar } from './GradeProgressBar';
import {
  BookOpen,
  User,
  Clock,
  ShieldAlert,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Building2,
  Mail
} from 'lucide-react';

interface SubjectTelemetryTableProps {
  subjects: SubjectEntity[];
  professors?: ProfessorEntity[];
  universities?: UniversityEntity[];
}

const BreakdownRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className={`text-slate-500 dark:text-slate-400 ${strong ? 'font-semibold text-slate-700 dark:text-slate-300' : ''}`}>
      {label}
    </span>
    <span className={`font-mono shrink-0 ${strong ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
      {value}
    </span>
  </div>
);

/**
 * Desglose de cómo se llega a las horas de una materia.
 *
 * Presenta dos cifras deliberadamente separadas: lo que exige la norma y la recomendación
 * ajustada a la situación del estudiante, con los factores que las separan. Fundirlas en un
 * solo número haría pasar una sugerencia del sistema por una exigencia legal.
 */
const NormativeBreakdown: React.FC<{ load: SubjectAcademicLoad }> = ({ load }) => {
  const { creditLoad, dme, percentageSharedTopics, upcomingDeliverablesWeight } = load;
  const { breakdown } = dme;
  const adjusted = dme.recommendedWeeklyHours !== dme.normativeWeeklyHours;

  return (
    <div className="space-y-2 text-xs">
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
          Según el Decreto 1075 de 2015
        </div>
        <BreakdownRow
          label={`${creditLoad.credits} créditos × 48 h por semestre`}
          value={`${creditLoad.semesterHours} h`}
        />
        <BreakdownRow label="Repartido en 16 semanas" value={`${creditLoad.weeklyTotalHours.toFixed(1)} h/sem`} />
        <BreakdownRow
          label={creditLoad.hasNoSchedule ? 'Clase (sin horario registrado)' : 'Menos tu clase real'}
          value={`− ${creditLoad.weeklyClassHours.toFixed(1)} h/sem`}
        />
        <BreakdownRow label="Trabajo independiente" value={`${creditLoad.weeklyIndependentHours.toFixed(1)} h/sem`} strong />
        {creditLoad.accompanimentRatio !== null && (
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            Relación acompañamiento : independiente de 1 a{' '}
            <span className="font-mono">{creditLoad.accompanimentRatio.toFixed(1)}</span>
          </div>
        )}
        {creditLoad.exceedsNorm && (
          <div className="text-[10px] text-amber-600 dark:text-amber-400">
            Las horas de clase ya superan el total que exige la norma para estos créditos.
          </div>
        )}
      </div>

      <div className="space-y-1 pt-1.5 border-t border-surface-border">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
          Ajustado a tu situación
        </div>
        <BreakdownRow
          label={`Dificultad ${load.subject.difficulty} de 5`}
          value={`× ${breakdown.difficultyMultiplier.toFixed(2)}`}
        />
        <BreakdownRow
          label={
            load.subject.current_grade
              ? `Margen de nota (${load.subject.current_grade.toFixed(2)} frente a ${load.subject.target_grade.toFixed(2)})`
              : 'Margen de nota (aún sin notas)'
          }
          value={`× ${breakdown.marginFactor.toFixed(2)}`}
        />
        <BreakdownRow
          label={
            percentageSharedTopics > 0
              ? `Sinergia entre carreras (${Math.round(percentageSharedTopics * 100)}% de temas compartidos)`
              : 'Sinergia entre carreras (sin temas compartidos)'
          }
          value={`× ${breakdown.synergyFactor.toFixed(2)}`}
        />
        <BreakdownRow
          label={
            upcomingDeliverablesWeight > 0
              ? `Entregas en 7 días (${upcomingDeliverablesWeight}% evaluativo)`
              : 'Entregas en 7 días (ninguna)'
          }
          value={`+ ${breakdown.urgencyBonus.toFixed(2)} h`}
        />
        <BreakdownRow label="Sugerido para ti" value={`${dme.recommendedWeeklyHours.toFixed(1)} h/sem`} strong />
        {!adjusted && (
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            Sin ajustes activos: coincide con lo que exige la norma.
          </div>
        )}
      </div>
    </div>
  );
};

export const SubjectTelemetryTable: React.FC<SubjectTelemetryTableProps> = ({
  subjects,
  professors = [],
  universities = []
}) => {
  const [selectedUniId, setSelectedUniId] = useState<string>('all');
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  // Misma fuente que el encabezado y el Command Center, para que las horas no discrepen.
  const { perSubject } = useAcademicLoad();
  const loadBySubject = new Map(perSubject.map((item) => [item.subject.id, item]));

  if (!subjects || subjects.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Sin asignaturas registradas"
        description="Carga tus materias en la pestaña Ajustes para activar la telemetría académica."
      />
    );
  }

  const filteredSubjects = selectedUniId === 'all'
    ? subjects
    : subjects.filter((s) => s.university_id === selectedUniId);

  const toggleExpand = (id: string) => {
    setExpandedSubjectId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full space-y-3 font-sans">
      {/* University Filter Pills */}
      {universities.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedUniId('all')}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-all shrink-0 ${
              selectedUniId === 'all'
                ? 'bg-cyan-600 text-white border-cyan-500 font-bold shadow-sm'
                : 'bg-surface text-slate-600 dark:text-slate-400 border-surface-border hover:border-surface-hover'
            }`}
          >
            Todas ({subjects.length})
          </button>
          {universities.map((uni) => {
            const count = subjects.filter((s) => s.university_id === uni.id).length;
            const isSelected = selectedUniId === uni.id;
            return (
              <button
                key={uni.id}
                onClick={() => setSelectedUniId(uni.id!)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-sm'
                    : 'bg-surface text-slate-600 dark:text-slate-400 border-surface-border hover:border-surface-hover'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{uni.name}</span>
                <span className="opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* MOBILE ADAPTIVE CARDS (< 768px) */}
      <div className="block md:hidden space-y-2.5">
        {filteredSubjects.map((sub) => {
          const load = loadBySubject.get(sub.id);
          const prof = professors.find((p) => p.id === sub.professor_id);
          const uni = universities.find((u) => u.id === sub.university_id);
          const hasGrade = sub.current_grade !== undefined && sub.current_grade > 0;
          const isAboveTarget = (sub.current_grade || 0) >= sub.target_grade;
          const isPassing = (sub.current_grade || 0) >= (uni?.passing_grade || 3.0);
          const isExpanded = expandedSubjectId === sub.id;

          return (
            <Card
              key={sub.id}
              className="p-3.5 space-y-2.5 border-surface-border hover:border-surface-hover transition-all bg-surface"
            >
              {/* Card Header Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs font-heading truncate">
                      {sub.name}
                    </h4>
                    <Badge variant={sub.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                      {sub.modality}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {sub.code && <span className="font-mono">Cod: {sub.code}</span>}
                    {uni && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-600 dark:text-cyan-400 font-medium">{uni.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Telemetry Status Badge */}
                <div className="shrink-0">
                  {!hasGrade ? (
                    <Badge variant="outline">Diagnóstico</Badge>
                  ) : isAboveTarget ? (
                    <Badge variant="synergy" className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Excelente
                    </Badge>
                  ) : isPassing ? (
                    <Badge variant="aeroespacial">En Rango</Badge>
                  ) : (
                    <Badge variant="danger" className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Atención
                    </Badge>
                  )}
                </div>
              </div>

              {/* Grade Progress Bar Primitive */}
              <GradeProgressBar
                currentGrade={sub.current_grade || 0}
                targetGrade={sub.target_grade}
                scaleMin={uni?.scale_min ?? 0}
                scaleMax={uni?.scale_max ?? 5}
              />

              {/* Accordion Expand Trigger */}
              <div className="pt-1 flex items-center justify-between border-t border-surface-border text-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{sub.credits} Créditos</span>
                  <span>•</span>
                  <span className="text-purple-600 dark:text-purple-400">
                    Independiente:{' '}
                    <strong className="font-mono">{(load?.creditLoad.weeklyIndependentHours ?? 0).toFixed(1)} h/sem</strong>
                  </span>
                </div>
                <button
                  onClick={() => toggleExpand(sub.id!)}
                  aria-expanded={isExpanded}
                  className="px-2 flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium hover:underline"
                >
                  <span>{isExpanded ? 'Ocultar' : 'Detalles'}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Accordion Details Content */}
              {isExpanded && (
                <div className="p-2.5 rounded-lg bg-surface-subtle border border-surface-border space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Docente: {prof?.name || 'No asignado'}</span>
                  </div>
                  {prof?.email && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{prof.email}</span>
                    </div>
                  )}
                  {load && (
                    <div className="pt-1.5 border-t border-surface-border">
                      <NormativeBreakdown load={load} />
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* DESKTOP MATRIX TABLE (>= 768px) */}
      <div className="hidden md:block overflow-x-auto border border-surface-border rounded-xl bg-surface shadow-sm">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-surface-border bg-surface-subtle text-xs font-sans text-slate-500 dark:text-slate-400 font-semibold">
              <th className="p-3 pl-4">Asignatura & Código</th>
              <th className="p-3">Docente</th>
              <th className="p-3 text-center">Créditos & carga</th>
              <th className="p-3">Progreso vs Meta</th>
              <th className="p-3 text-right pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border text-xs">
            {filteredSubjects.map((sub) => {
              const load = loadBySubject.get(sub.id);
              const prof = professors.find((p) => p.id === sub.professor_id);
              const uni = universities.find((u) => u.id === sub.university_id);
              const hasGrade = sub.current_grade !== undefined && sub.current_grade > 0;
              const isAboveTarget = (sub.current_grade || 0) >= sub.target_grade;
              const isPassing = (sub.current_grade || 0) >= (uni?.passing_grade || 3.0);
              const isExpanded = expandedSubjectId === sub.id;

              return (
                <React.Fragment key={sub.id}>
                <tr className="hover:bg-surface-subtle/50 transition-colors">
                  {/* Subject Name & Code & Badge */}
                  <td className="p-3 pl-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-heading text-xs truncate max-w-[220px]" title={sub.name}>
                          {sub.name}
                        </span>
                        <Badge variant={sub.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                          {sub.modality}
                        </Badge>
                      </div>
                      {sub.code && (
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          Cod: {sub.code}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Professor */}
                  <td className="p-3 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 truncate max-w-[160px]" title={prof?.name || 'Por asignar'}>
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{prof?.name || 'Por asignar'}</span>
                    </div>
                  </td>

                  {/* Credits & DME Study Hours */}
                  <td className="p-3 text-center">
                    <div className="text-slate-800 dark:text-slate-200 font-bold font-mono text-xs">
                      {sub.credits} crd
                    </div>
                    <div
                      className="text-xs text-purple-600 dark:text-purple-400 font-medium"
                      title="Trabajo independiente que exige el Decreto 1075: créditos × 3 h/sem menos tus horas de clase"
                    >
                      <span className="font-mono">
                        {(load?.creditLoad.weeklyIndependentHours ?? 0).toFixed(1)} h/sem
                      </span>{' '}
                      indep.
                    </div>
                  </td>

                  {/* Current Grade vs Target Bar */}
                  <td className="p-3 min-w-[180px]">
                    <GradeProgressBar
                      currentGrade={sub.current_grade || 0}
                      targetGrade={sub.target_grade}
                      scaleMin={uni?.scale_min ?? 0}
                      scaleMax={uni?.scale_max ?? 5}
                    />
                  </td>

                  {/* Telemetry Status Badge */}
                  <td className="p-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-2">
                      {!hasGrade ? (
                        <Badge variant="outline">En Diagnóstico</Badge>
                      ) : isAboveTarget ? (
                        <Badge variant="synergy" className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Excelente
                        </Badge>
                      ) : isPassing ? (
                        <Badge variant="aeroespacial">En Rango</Badge>
                      ) : (
                        <Badge variant="danger" className="inline-flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Atención
                        </Badge>
                      )}
                      <button
                        onClick={() => toggleExpand(sub.id!)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} el desglose de horas de ${sub.name}`}
                        className="p-1 rounded text-cyan-600 dark:text-cyan-400 hover:bg-surface-subtle transition-colors shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>

                {isExpanded && load && (
                  <tr className="bg-surface-subtle/60">
                    <td colSpan={5} className="p-3 pl-4">
                      <div className="max-w-xl">
                        <NormativeBreakdown load={load} />
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
