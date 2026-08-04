import React, { useState } from 'react';
import { SubjectEntity, ProfessorEntity, UniversityEntity } from '@/lib/db/dexie-schema';
import { calculateDME } from '@/lib/algorithms/study-hours-dme';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  BookOpen,
  User,
  MapPin,
  Clock,
  Award,
  ShieldAlert,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Building2,
  Target
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
      <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
        <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-1" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-heading">Sin asignaturas registradas</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Carga tus materias en la pestaña <span className="font-mono text-cyan-600 dark:text-cyan-400">Configuración</span> para activar la telemetría académica.
        </p>
      </div>
    );
  }

  // Filter subjects by university if selected
  const filteredSubjects = selectedUniId === 'all'
    ? subjects
    : subjects.filter((s) => s.university_id === selectedUniId);

  const toggleExpand = (id: string) => {
    setExpandedSubjectId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full space-y-3">
      {/* University Filter Pills for Quick Touch Filtering */}
      {universities.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
          <button
            onClick={() => setSelectedUniId('all')}
            className={`px-3 py-1 rounded-lg border font-bold transition-all shrink-0 ${
              selectedUniId === 'all'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                : 'bg-slate-100 dark:bg-[#0d1322] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
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
                className={`px-3 py-1 rounded-lg border font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-500 shadow-sm glow-software'
                    : 'bg-slate-100 dark:bg-[#0d1322] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>{uni.name}</span>
                <span className="opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOBILE-FIRST TOUCH-FRIENDLY ADAPTIVE CARDS (Visible on < 768px screens)   */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-2.5">
        {filteredSubjects.map((sub) => {
          const dme = calculateDME(sub as any);
          const prof = professors.find((p) => p.id === sub.professor_id);
          const uni = universities.find((u) => u.id === sub.university_id);
          const hasGrade = sub.current_grade !== undefined && sub.current_grade > 0;
          const isAboveTarget = (sub.current_grade || 0) >= sub.target_grade;
          const isPassing = (sub.current_grade || 0) >= 3.0;
          const isExpanded = expandedSubjectId === sub.id;

          const currentPct = Math.min(100, Math.max(0, ((sub.current_grade || 0) / 5.0) * 100));
          const targetPct = Math.min(100, Math.max(0, (sub.target_grade / 5.0) * 100));

          return (
            <Card
              key={sub.id}
              className="p-3.5 space-y-2.5 border-slate-200 dark:border-slate-800/90 hover:border-cyan-500/40 transition-all bg-white dark:bg-[#0d1322]"
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
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {sub.code && <span>Cod: {sub.code}</span>}
                    {uni && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{uni.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Telemetry Status Badge */}
                <div className="shrink-0">
                  {!hasGrade ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      Diagnóstico
                    </span>
                  ) : isAboveTarget ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Excelente
                    </span>
                  ) : isPassing ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                      En Rango
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Atención
                    </span>
                  )}
                </div>
              </div>

              {/* Score Progress Bar vs Target Marker */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Nota: <strong className="text-slate-900 dark:text-slate-100">{hasGrade ? sub.current_grade.toFixed(2) : '0.00'}</strong>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Meta: <strong className="text-slate-800 dark:text-slate-200">{sub.target_grade.toFixed(2)}</strong>
                  </span>
                </div>

                <div className="relative h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-10 opacity-80"
                    style={{ left: `${targetPct}%` }}
                  />
                  <div
                    className={`h-full transition-all duration-300 ${
                      isAboveTarget ? 'bg-emerald-500' : hasGrade ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-700'
                    }`}
                    style={{ width: `${Math.max(3, currentPct)}%` }}
                  />
                </div>
              </div>

              {/* Accordion Expand Trigger */}
              <div className="pt-1 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/60 text-[10px] font-mono">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span>{sub.credits} Créditos</span>
                  <span>•</span>
                  <span className="text-purple-600 dark:text-purple-400 font-bold">DME: {dme.recommendedWeeklyHours.toFixed(1)}h/sem</span>
                </div>
                <button
                  onClick={() => toggleExpand(sub.id!)}
                  className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
                >
                  <span>{isExpanded ? 'Ocultar' : 'Detalles'}</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Accordion Details Content */}
              {isExpanded && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Docente: {prof?.name || 'No asignado'}</span>
                  </div>
                  {prof?.email && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-5.5 truncate">
                      ✉️ {prof.email}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 pt-0.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Dificultad: {sub.difficulty} / 5</span>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP MATRIX TABLE (Visible on >= 768px screens)                         */}
      {/* ========================================================================= */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800/90 rounded-xl bg-white dark:bg-[#0d1322] shadow-sm">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-3 pl-4">Asignatura & Código</th>
              <th className="p-3">Docente</th>
              <th className="p-3 text-center">Carga & DME</th>
              <th className="p-3">Progreso vs Meta</th>
              <th className="p-3 text-right pr-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
            {filteredSubjects.map((sub) => {
              const dme = calculateDME(sub as any);
              const prof = professors.find((p) => p.id === sub.professor_id);
              const hasGrade = sub.current_grade !== undefined && sub.current_grade > 0;
              const isAboveTarget = (sub.current_grade || 0) >= sub.target_grade;
              const isPassing = (sub.current_grade || 0) >= 3.0;
              const currentPct = Math.min(100, Math.max(0, ((sub.current_grade || 0) / 5.0) * 100));
              const targetPct = Math.min(100, Math.max(0, (sub.target_grade / 5.0) * 100));

              return (
                <tr
                  key={sub.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors group"
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
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          Cod: {sub.code}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Professor */}
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 truncate max-w-[160px]" title={prof?.name || 'Por asignar'}>
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{prof?.name || 'Por asignar'}</span>
                    </div>
                  </td>

                  {/* Credits & DME Study Hours */}
                  <td className="p-3 text-center font-mono">
                    <div className="text-slate-800 dark:text-slate-200 font-bold text-xs">
                      {sub.credits} crd
                    </div>
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      {dme.recommendedWeeklyHours.toFixed(1)}h/sem DME
                    </div>
                  </td>

                  {/* Current Grade vs Target Bar */}
                  <td className="p-3 min-w-[180px]">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {hasGrade ? sub.current_grade?.toFixed(2) : '0.00'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Meta: <strong className="text-slate-700 dark:text-slate-300">{sub.target_grade.toFixed(2)}</strong>
                        </span>
                      </div>

                      <div className="relative h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-10 opacity-80"
                          style={{ left: `${targetPct}%` }}
                        />
                        <div
                          className={`h-full transition-all duration-300 ${
                            isAboveTarget
                              ? 'bg-emerald-500'
                              : hasGrade
                              ? 'bg-cyan-500'
                              : 'bg-slate-400 dark:bg-slate-700'
                          }`}
                          style={{ width: `${Math.max(3, currentPct)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Telemetry Status Badge */}
                  <td className="p-3 text-right pr-4 font-mono">
                    {!hasGrade ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        En Diagnóstico
                      </span>
                    ) : isAboveTarget ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Excelente
                      </span>
                    ) : isPassing ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                        En Rango
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        <ShieldAlert className="w-3 h-3" /> Atención
                      </span>
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
