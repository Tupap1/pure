'use client';

import React from 'react';
import { SyllabusTopicEntity } from '@/lib/db/dexie-schema';
import { calculateSyllabusProgress } from '@/lib/domain/syllabus';
import { Badge } from './Badge';
import { EmptyState } from './EmptyState';
import { GitMerge, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubjectSyllabusProps {
  topics: SyllabusTopicEntity[];
}

const MASTERY_LABELS: Record<string, { label: string; color: string }> = {
  no_iniciado: { label: 'No iniciado', color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
  en_estudio: { label: 'En estudio', color: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' },
  repasado: { label: 'Repasado', color: 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400' },
  dominado: { label: 'Dominado', color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400' },
};

export const SubjectSyllabus: React.FC<SubjectSyllabusProps> = ({ topics }) => {
  if (topics.length === 0) {
    return (
      <EmptyState
        icon={GitMerge}
        title="Sin temario"
        description="Aún no hay temas registrados para esta materia. Ingesta el syllabus para comenzar."
      />
    );
  }

  // Calculate overall progress
  const progress = calculateSyllabusProgress(topics as any);

  // Group topics by parent_id: units are topics with falsy parent_id, children have truthy parent_id
  const units = topics.filter((t) => !t.parent_id);
  const childTopics = topics.filter((t) => t.parent_id);

  // Build hierarchical structure
  const unitMap = new Map<string, SyllabusTopicEntity[]>();
  for (const unit of units) {
    unitMap.set(unit.id!, []);
  }
  for (const topic of childTopics) {
    if (topic.parent_id && unitMap.has(topic.parent_id)) {
      unitMap.get(topic.parent_id)!.push(topic);
    }
  }

  // Sort units by order_index, and children by order_index
  const sortedUnits = [...units].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Progreso general</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 text-sm">
            {progress.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Units and topics */}
      <div className="space-y-3">
        {sortedUnits.map((unit) => {
          const children = unitMap.get(unit.id!) || [];
          const sortedChildren = [...children].sort((a, b) => a.order_index - b.order_index);

          return (
            <div key={unit.id} className="space-y-2">
              {/* Unit header */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-2.5">
                  <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-heading font-semibold text-slate-900 dark:text-slate-100">
                      {unit.title}
                    </h5>
                    {unit.description && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        {unit.description}
                      </p>
                    )}
                  </div>
                  {children.length > 0 && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                      {children.length} temas
                    </span>
                  )}
                </div>
              </div>

              {/* Child topics */}
              {sortedChildren.length > 0 && (
                <div className="ml-3 space-y-2 pl-3 border-l border-slate-200 dark:border-slate-800">
                  {sortedChildren.map((topic) => {
                    const masteryInfo = MASTERY_LABELS[topic.mastery_status];
                    return (
                      <div
                        key={topic.id}
                        className="p-2 rounded-md bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h6 className="text-xs font-medium text-slate-900 dark:text-slate-100 break-words">
                              {topic.title}
                            </h6>
                            {topic.description && (
                              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                                {topic.description}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] py-0.5 shrink-0', masteryInfo?.color)}
                          >
                            {masteryInfo?.label || topic.mastery_status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
