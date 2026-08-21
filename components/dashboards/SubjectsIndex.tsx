import React from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { useNavigation } from '@/lib/hooks/useNavigation';
import { calculateWeightedGrade } from '@/lib/domain/subject';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { GradeProgressBar } from '@/components/ui/GradeProgressBar';
import { BookOpen, ChevronRight } from 'lucide-react';

/**
 * Índice de materias: la superficie de aterrizaje del drill-in. Presenta cada materia como
 * una fila escaneable (universidad, créditos, nota calculada frente a meta) que abre su hub.
 *
 * La nota se calcula desde las entregas calificadas (`calculateWeightedGrade`), la misma
 * fuente que usa la sección Evaluación y el encabezado del hub, para que las tres coincidan.
 */
export const SubjectsIndex: React.FC = () => {
  const { subjects, universities, deliverables } = usePureData();
  const { openSubject } = useNavigation();

  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Sin asignaturas registradas"
        description="Carga tus materias en la pestaña Configuración para abrir su hub de detalle."
      />
    );
  }

  const sorted = [...subjects].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Toca una materia para abrir su hub: evaluación, clases, temario y asistencia en un solo
        lugar.
      </p>

      <div className="rounded-xl border border-surface-border bg-surface divide-y divide-surface-border overflow-hidden">
        {sorted.map((sub) => {
          const uni = universities.find((u) => u.id === sub.university_id);
          const subjectDeliverables = deliverables.filter((d) => d.subject_id === sub.id);
          const { currentGrade } = calculateWeightedGrade(subjectDeliverables);

          return (
            <button
              key={sub.id}
              onClick={() => openSubject(sub.id!)}
              className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-surface-subtle transition-colors"
            >
              {/* Punto de color de la universidad (codificación de carrera) */}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: uni?.color || '#9b9b9b' }}
                aria-hidden
              />

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {sub.name}
                  </span>
                  <Badge variant={sub.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                    {sub.modality}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {uni?.name ?? 'Sin universidad'}
                  {sub.code && <span className="font-mono"> · Cód {sub.code}</span>}
                  {' · '}
                  <span className="font-mono">{sub.credits}</span> créditos
                </div>
              </div>

              {/* Nota vs meta: barra en pantallas anchas, cifra compacta en móvil */}
              <div className="hidden sm:block w-44 shrink-0">
                <GradeProgressBar
                  currentGrade={currentGrade}
                  targetGrade={sub.target_grade}
                  scaleMin={uni?.scale_min ?? 0}
                  scaleMax={uni?.scale_max ?? 5}
                />
              </div>
              <div className="sm:hidden shrink-0 text-right">
                <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {currentGrade > 0 ? currentGrade.toFixed(2) : '—'}
                </span>
                <span className="font-mono text-[11px] text-slate-400 block">
                  meta {sub.target_grade.toFixed(1)}
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
