import React from 'react';
import { SubjectEntity, ProfessorEntity } from '@/lib/db/dexie-schema';
import { calculateDME } from '@/lib/algorithms/study-hours-dme';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, User, MapPin, Clock, Award, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface SubjectTelemetryTableProps {
  subjects: SubjectEntity[];
  professors?: ProfessorEntity[];
}

export const SubjectTelemetryTable: React.FC<SubjectTelemetryTableProps> = ({ subjects, professors = [] }) => {
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

  return (
    <div className="w-full space-y-3">
      {/* High Density Table Container */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800/90 rounded-xl bg-white dark:bg-[#0d1322] shadow-sm">
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
            {subjects.map((sub) => {
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

                      {/* Bar with Target Marker */}
                      <div className="relative h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        {/* Target Vertical Indicator */}
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
