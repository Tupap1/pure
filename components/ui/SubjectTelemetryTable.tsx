import React, { useState } from 'react';
import { SubjectEntity, ProfessorEntity, UniversityEntity } from '@/lib/db/dexie-schema';
import { calculateDME } from '@/lib/algorithms/study-hours-dme';
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

export const SubjectTelemetryTable: React.FC<SubjectTelemetryTableProps> = ({
  subjects,
  professors = [],
  universities = []
}) => {
  const [selectedUniId, setSelectedUniId] = useState<string>('all');
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

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
          const dme = calculateDME(sub as any);
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
                  <span className="text-purple-600 dark:text-purple-400 font-bold font-mono">DME: {dme.recommendedWeeklyHours.toFixed(1)}h/sem</span>
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
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 pt-0.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Dificultad: <strong className="font-mono">{sub.difficulty} / 5</strong></span>
                  </div>
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
              <th className="p-3 text-center">Carga & DME</th>
              <th className="p-3">Progreso vs Meta</th>
              <th className="p-3 text-right pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border text-xs">
            {filteredSubjects.map((sub) => {
              const dme = calculateDME(sub as any);
              const prof = professors.find((p) => p.id === sub.professor_id);
              const uni = universities.find((u) => u.id === sub.university_id);
              const hasGrade = sub.current_grade !== undefined && sub.current_grade > 0;
              const isAboveTarget = (sub.current_grade || 0) >= sub.target_grade;
              const isPassing = (sub.current_grade || 0) >= (uni?.passing_grade || 3.0);

              return (
                <tr
                  key={sub.id}
                  className="hover:bg-surface-subtle/50 transition-colors"
                >
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
                    <div className="text-xs text-purple-600 dark:text-purple-400 font-mono font-medium">
                      {dme.recommendedWeeklyHours.toFixed(1)}h/sem DME
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
