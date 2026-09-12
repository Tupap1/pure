import React, { useState } from 'react';
import { SubjectEntity, DeliverableEntity, UniversityEntity } from '@/lib/db/dexie-schema';
import {
  calculateSubjectGradeProgress,
  generateDeliverablesFromPreset,
  PRESETS,
  formatDeliverableDate,
  EvaluationPreset,
} from '@/lib/domain/deliverable';
import {
  projectSubjectGrade,
  normalizeDeliverableStatus,
  NormalizedDeliverableStatus,
  GradeProjectionFlag,
} from '@/lib/domain/subject';
import { saveDeliverable, deleteDeliverable } from '@/lib/db/repository';
import { useExecutionTasks } from '@/lib/hooks/useExecutionTasks';
import { Button } from './Button';
import { DeliverableFormModal } from './DeliverableFormModal';
import { Plus, Pencil, Trash2, LayoutTemplate, Square, CheckSquare } from 'lucide-react';

interface SubjectEvaluationProps {
  subject: SubjectEntity;
  deliverables: DeliverableEntity[];
  /** T067: la escala y la aprobatoria de la tabla de proyección salen de aquí (igual que
   * lib/execution/grade-projection.ts); sin ella, se asume 5 y 3.0 (la norma más común). */
  university?: UniversityEntity;
}

const TYPE_LABELS: Record<DeliverableEntity['type'], string> = {
  taller: 'Taller',
  proyecto: 'Proyecto',
  parcial: 'Parcial',
  quiz: 'Quiz',
  laboratorio: 'Laboratorio',
  examen_final: 'Examen Final',
};

// Indexado por el estado NORMALIZADO (lib/domain/subject.ts:normalizeDeliverableStatus): la base
// puede traer el valor heredado `completado` (R-11), que sin normalizar no encontraba etiqueta.
const STATUS_LABELS: Record<NormalizedDeliverableStatus, string> = {
  pendiente: 'Pendiente',
  entregado: 'Entregado',
  calificado: 'Calificado',
};

const FLAG_LABELS: Record<GradeProjectionFlag, string> = {
  ciega: 'Sin evaluaciones registradas',
  pesos_inconsistentes: 'Los pesos no suman 100%',
  entregado_sin_nota: 'Hay una entrega sin nota todavía',
  vencido_sin_registrar: 'Hay una entrega vencida sin registrar',
  meta_inalcanzable: 'La meta ya no es alcanzable con lo que queda',
  materia_perdida: 'Materia perdida',
};

/**
 * Sección "Evaluación" del hub de asignatura: define el esquema ponderado de la materia
 * (reutilizando la entidad `deliverables`) y a partir de ahí calcula la nota.
 *
 * Es el hogar de tres piezas que antes estaban huérfanas (solo con tests): el medidor de
 * suma de pesos (`calculateSubjectGradeProgress`), las plantillas de evaluación (`PRESETS`
 * + `generateDeliverablesFromPreset`) y la nota calculada/requerida.
 */
export const SubjectEvaluation: React.FC<SubjectEvaluationProps> = ({ subject, deliverables, university }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<DeliverableEntity | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskTandas, setTaskTandas] = useState(1);
  const [taskError, setTaskError] = useState<string | null>(null);

  const { tasks, createTask, setTaskStatus, removeTask } = useExecutionTasks(subject.id);

  const subjectDeliverables = deliverables
    .filter((d) => d.subject_id === subject.id)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const progress = calculateSubjectGradeProgress(subjectDeliverables, subject.id!);

  // T067: la tabla de proyección consume projectSubjectGrade (US5) tal cual — no recalcula nada
  // por su cuenta. Mismos defaults que lib/execution/grade-projection.ts:computeGradeProjections
  // cuando falta la universidad o una meta personal.
  const scaleMax = university?.scale_max ?? 5;
  const passingGrade = university?.passing_grade ?? 3.0;
  const rawTarget = subject.target_grade;
  const targetGrade =
    typeof rawTarget === 'number' && Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : passingGrade;
  const { projection, flags } = projectSubjectGrade(subjectDeliverables as any, { scaleMax, passingGrade, targetGrade }, new Date());

  const handleCreateTask = async () => {
    const title = taskTitle.trim();
    if (title.length < 3) {
      setTaskError('El título necesita al menos 3 caracteres.');
      return;
    }
    const res = await createTask({ title, estimated_tandas: taskTandas });
    if ((res as any).status === 'error') {
      setTaskError(
        (res as any).code === 'PARTIR_TAREA'
          ? 'Esa tarea es muy grande para 1-3 tandas: pártela en tareas más chicas.'
          : (res as any).message || 'No se pudo crear la tarea.'
      );
      return;
    }
    setTaskError(null);
    setTaskTitle('');
    setTaskTandas(1);
    setShowTaskForm(false);
  };

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

      {/* Tabla de proyección (T067): promedio evaluado, aporte, peso restante, necesaria para
          aprobar y para la meta, y techo — todo tal cual lo calcula projectSubjectGrade (US5). */}
      {flags.includes('ciega') ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sin evaluaciones registradas todavía: agrega un ítem para ver la proyección de nota.
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-border text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium px-3 py-2">Promedio evaluado</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Aporte</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Peso restante</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Necesaria: aprobar</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Necesaria: meta</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Techo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {projection.currentAverage.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {projection.consolidated.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {projection.remainingWeight}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {projection.neededToPass == null ? '—' : projection.neededToPass.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {projection.neededForTarget == null ? '—' : projection.neededForTarget.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {projection.ceiling == null ? '—' : projection.ceiling.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {flags.length > 0 && (
            <p className="px-3 py-2 border-t border-surface-border text-[11px] text-amber-700 dark:text-amber-500">
              {flags.map((flag) => FLAG_LABELS[flag]).join(' · ')}
            </p>
          )}
        </div>
      )}

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
                      STATUS_LABELS[normalizeDeliverableStatus(deliv.status)]
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

      {/* Tareas (US8): unidades de 1-3 tandas de esta materia — manage_tasks, Postgres-solo. */}
      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">Tareas</h4>
          <Button variant="ghost" size="sm" onClick={() => setShowTaskForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Nueva tarea
          </Button>
        </div>

        {tasks.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Sin tareas todavía para esta materia.</p>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
            {tasks.map((task) => {
              const done = task.status === 'hecha';
              return (
                <div key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    onClick={() => setTaskStatus(task.id, done ? 'pendiente' : 'hecha')}
                    aria-label={done ? `Marcar "${task.title}" como pendiente` : `Marcar "${task.title}" como hecha`}
                    className="shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {done ? <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium truncate ${done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {task.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {task.estimated_tandas} {task.estimated_tandas === 1 ? 'tanda' : 'tandas'}
                      {task.scheduled_date ? ` · ${task.scheduled_date}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTask(task.id)}
                    aria-label={`Eliminar tarea ${task.title}`}
                    title="Eliminar tarea"
                    className="shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showTaskForm && (
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/50 dark:bg-slate-950/40">
            <div>
              <label htmlFor={`task-title-${subject.id}`} className="sr-only">
                Título de la tarea
              </label>
              <input
                id={`task-title-${subject.id}`}
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Título de la tarea (3-120 caracteres)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`task-tandas-${subject.id}`} className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                Tandas (1-3)
              </label>
              <select
                id={`task-tandas-${subject.id}`}
                value={taskTandas}
                onChange={(e) => setTaskTandas(Number(e.target.value))}
                className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
            {taskError && <p className="text-[11px] text-red-600 dark:text-red-400">{taskError}</p>}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="synergy" onClick={handleCreateTask}>
                Guardar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowTaskForm(false);
                  setTaskError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

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
