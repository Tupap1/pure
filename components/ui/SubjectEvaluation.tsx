import React, { useState } from 'react';
import { SubjectEntity, DeliverableEntity } from '@/lib/db/dexie-schema';
import {
  calculateSubjectGradeProgress,
  generateDeliverablesFromPreset,
  PRESETS,
  formatDeliverableDate,
  EvaluationPreset,
} from '@/lib/domain/deliverable';
import { calculateWeightedGrade, calculateRequiredGradeForRemaining } from '@/lib/domain/subject';
import { saveDeliverable, deleteDeliverable } from '@/lib/db/repository';
import { Button } from './Button';
import { DeliverableFormModal } from './DeliverableFormModal';
import { Plus, Pencil, Trash2, LayoutTemplate } from 'lucide-react';

interface SubjectEvaluationProps {
  subject: SubjectEntity;
  deliverables: DeliverableEntity[];
}

const TYPE_LABELS: Record<DeliverableEntity['type'], string> = {
  taller: 'Taller',
  proyecto: 'Proyecto',
  parcial: 'Parcial',
  quiz: 'Quiz',
  laboratorio: 'Laboratorio',
  examen_final: 'Examen Final',
};

const STATUS_LABELS: Record<DeliverableEntity['status'], string> = {
  pendiente: 'Pendiente',
  entregado: 'Entregado',
  calificado: 'Calificado',
};

/**
 * Sección "Evaluación" del hub de asignatura: define el esquema ponderado de la materia
 * (reutilizando la entidad `deliverables`) y a partir de ahí calcula la nota.
 *
 * Es el hogar de tres piezas que antes estaban huérfanas (solo con tests): el medidor de
 * suma de pesos (`calculateSubjectGradeProgress`), las plantillas de evaluación (`PRESETS`
 * + `generateDeliverablesFromPreset`) y la nota calculada/requerida.
 */
export const SubjectEvaluation: React.FC<SubjectEvaluationProps> = ({ subject, deliverables }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<DeliverableEntity | null>(null);

  const subjectDeliverables = deliverables
    .filter((d) => d.subject_id === subject.id)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const progress = calculateSubjectGradeProgress(subjectDeliverables, subject.id!);
  const { currentGrade, evaluatedWeightPercentage } = calculateWeightedGrade(subjectDeliverables);
  const required = calculateRequiredGradeForRemaining(subjectDeliverables, subject.target_grade);

  const totalWeight = progress.totalConfiguredWeight;
  const isExact = totalWeight === 100;
  const isOver = totalWeight > 100;

  // verde =100% · ámbar <100% · rojo >100%
  const meterColor = isExact
    ? 'bg-emerald-500'
    : isOver
      ? 'bg-red-500'
      : 'bg-amber-500';
  const meterText = isExact
    ? 'text-emerald-600 dark:text-emerald-400'
    : isOver
      ? 'text-red-600 dark:text-red-400'
      : 'text-amber-600 dark:text-amber-500';
  const meterHelp = isExact
    ? 'El esquema suma 100%.'
    : isOver
      ? `Excede el 100% por ${(totalWeight - 100).toFixed(0)} puntos.`
      : `Faltan ${(100 - totalWeight).toFixed(0)} puntos para completar el 100%.`;

  const requiredDemanding = required != null && required > subject.target_grade;

  const applyPreset = async (preset: EvaluationPreset) => {
    const generated = generateDeliverablesFromPreset(preset, subject.id!);
    for (const item of generated) {
      await saveDeliverable(item as DeliverableEntity);
    }
  };

  const handleSave = async (data: DeliverableEntity) => {
    await saveDeliverable(data);
    setShowAdd(false);
    setEditing(null);
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    await deleteDeliverable(id);
  };

  const tileClass =
    'p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800';

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
            Esquema de evaluación
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Define el ponderado de la materia; la nota se calcula a partir de estos ítems.
          </p>
        </div>
        <Button variant="synergy" size="sm" onClick={() => setShowAdd(true)} className="shrink-0">
          <Plus className="w-3.5 h-3.5" /> Agregar ítem
        </Button>
      </div>

      {/* Medidor de suma de pesos */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-medium">Suma de pesos</span>
          <span className={`font-mono font-semibold ${meterText}`}>{totalWeight.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${meterColor}`}
            style={{ width: `${Math.min(totalWeight, 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{meterHelp}</p>
      </div>

      {/* Nota calculada / requerida */}
      <div className="grid grid-cols-2 gap-3">
        <div className={tileClass}>
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wide">
            Nota calculada
          </span>
          <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100">
            {currentGrade > 0 ? currentGrade.toFixed(2) : '—'}
          </span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {evaluatedWeightPercentage}% evaluado
          </span>
        </div>
        <div className={tileClass}>
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wide">
            Nota requerida
          </span>
          <span
            className={`font-mono font-bold text-base ${
              requiredDemanding ? 'text-amber-600 dark:text-amber-500' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {required == null ? 'Meta cubierta' : required.toFixed(2)}
          </span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            para meta {subject.target_grade.toFixed(1)} en {progress.pendingWeight}% restante
          </span>
        </div>
      </div>

      {/* Ítems o estado vacío */}
      {subjectDeliverables.length === 0 ? (
        <div className="p-5 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aún no hay ítems de evaluación. Empieza desde una plantilla o agrega el primero.
          </p>
          <div className="space-y-2">
            <span className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <LayoutTemplate className="w-3.5 h-3.5" /> Usar plantilla
            </span>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="ghost"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="w-full justify-start border border-slate-200 dark:border-slate-800"
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
            {subjectDeliverables.map((deliv) => (
              <div
                key={deliv.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {deliv.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {TYPE_LABELS[deliv.type] || deliv.type}
                    {deliv.due_date && <> · {formatDeliverableDate(deliv.due_date)}</>}
                    {' · '}
                    {deliv.status === 'calificado' && deliv.grade != null ? (
                      <span className="font-mono">Nota {deliv.grade.toFixed(2)}</span>
                    ) : (
                      STATUS_LABELS[deliv.status]
                    )}
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300 shrink-0">
                  {deliv.weight_percentage}%
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setEditing(deliv)}
                    aria-label={`Editar ${deliv.title}`}
                    title="Editar ítem"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(deliv.id)}
                    aria-label={`Eliminar ${deliv.title}`}
                    title="Eliminar ítem"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(showAdd || editing) && (
        <DeliverableFormModal
          initialData={editing}
          subjects={[subject]}
          defaultSubjectId={subject.id}
          onSave={handleSave}
          onCancel={() => {
            setShowAdd(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};
