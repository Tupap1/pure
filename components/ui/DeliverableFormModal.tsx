import React, { useEffect, useState } from 'react';
import { DeliverableEntity, SubjectEntity } from '@/lib/db/dexie-schema';
import { DeliverableSchema, validateEntity } from '@/lib/validations/schemas';
import { Modal } from './Modal';
import { Button } from './Button';
import { FormErrors } from './FormErrors';

interface DeliverableFormModalProps {
  /** Entrega a editar; ausente/null para alta. */
  initialData?: DeliverableEntity | null;
  subjects: SubjectEntity[];
  /** Materia preseleccionada en el alta (p. ej. cuando el modal se abre desde una materia). */
  defaultSubjectId?: string;
  onSave: (data: DeliverableEntity) => Promise<void>;
  onCancel: () => void;
}

/**
 * Opciones del selector de tipo. Los `value` son la forma canónica en minúscula que
 * persiste el modelo y que lee el planificador de estudio; el `label` es la etiqueta legible.
 */
const DELIVERABLE_TYPE_OPTIONS: { value: DeliverableEntity['type']; label: string }[] = [
  { value: 'taller', label: 'Taller' },
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'examen_final', label: 'Examen Final' },
];

/**
 * Formulario de alta/edición de una entrega, extraído de `DeliverablesDashboard` para poder
 * reutilizarlo desde la sección Evaluación del hub de asignatura (imita el patrón de
 * `ClassSessionForm`). Renderiza su propio `Modal`; el padre controla cuándo montarlo y
 * persiste en `onSave`.
 */
export const DeliverableFormModal: React.FC<DeliverableFormModalProps> = ({
  initialData,
  subjects,
  defaultSubjectId,
  onSave,
  onCancel,
}) => {
  const isEdit = Boolean(initialData?.id);

  const [title, setTitle] = useState(initialData?.title || '');
  const [subjectId, setSubjectId] = useState(
    initialData?.subject_id || defaultSubjectId || subjects[0]?.id || ''
  );
  const [type, setType] = useState<DeliverableEntity['type']>(initialData?.type || 'parcial');
  const [weight, setWeight] = useState<number>(initialData?.weight_percentage ?? 20);
  const [isGroup, setIsGroup] = useState<boolean>(initialData?.is_group ?? false);
  const [complexity, setComplexity] = useState<'facil' | 'medio' | 'dificil'>(
    (initialData?.complexity as 'facil' | 'medio' | 'dificil') || 'medio'
  );
  const [dueDate, setDueDate] = useState(
    initialData?.due_date ? initialData.due_date.replace('Z', '').slice(0, 16) : ''
  );
  const [status, setStatus] = useState<'pendiente' | 'entregado' | 'calificado'>(
    initialData?.status || 'pendiente'
  );
  const [grade, setGrade] = useState<number | undefined>(initialData?.grade);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!subjectId && subjects.length > 0) {
      setSubjectId(defaultSubjectId || subjects[0].id || '');
    }
  }, [subjects, subjectId, defaultSubjectId]);

  const handleSave = async () => {
    let formattedDueDate = new Date().toISOString();
    if (dueDate) {
      if (dueDate.length === 10) {
        formattedDueDate = `${dueDate}T00:00:00.000Z`;
      } else if (dueDate.includes('T')) {
        formattedDueDate = dueDate.endsWith('Z') ? dueDate : `${dueDate}:00.000Z`;
      } else {
        formattedDueDate = new Date(dueDate).toISOString();
      }
    }

    const delivData = {
      subject_id: subjectId,
      title,
      due_date: formattedDueDate,
      weight_percentage: Number(weight),
      type,
      is_group: isGroup,
      complexity,
      status,
      grade: grade !== undefined && grade !== null ? Number(grade) : undefined,
    };

    const validation = validateEntity(DeliverableSchema, delivData as any);
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      // Partimos de initialData para conservar campos que el formulario no edita
      // (topic_id, description, location_modality) y encima aplicamos los validados.
      await onSave({
        ...(initialData || {}),
        ...(validation.data as any),
        id: initialData?.id,
        created_at: initialData?.created_at,
      } as DeliverableEntity);
    } catch (err) {
      console.error('Error al guardar la entrega:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors';
  const labelClass = 'text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1';

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={isEdit ? `Editar Actividad: ${initialData?.title}` : 'Registrar Nueva Actividad / Evaluación'}
    >
      <div className="space-y-4">
        <FormErrors errors={errors} />

        <div>
          <label className={labelClass}>Título de la Actividad</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Ej: Parcial 2 de Mecánica Orbital"
          />
        </div>

        <div>
          <label className={labelClass}>Asignatura</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}>
            <option value="">Selecciona una asignatura</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeliverableEntity['type'])}
              className={inputClass}
            >
              {DELIVERABLE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Modalidad</label>
            <select
              value={isGroup ? 'group' : 'individual'}
              onChange={(e) => setIsGroup(e.target.value === 'group')}
              className={inputClass}
            >
              <option value="individual">Individual</option>
              <option value="group">Grupal</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Peso % en la Nota</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Complejidad</label>
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as 'facil' | 'medio' | 'dificil')}
              className={inputClass}
            >
              <option value="facil">Fácil</option>
              <option value="medio">Medio</option>
              <option value="dificil">Difícil</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'pendiente' | 'entregado' | 'calificado')}
              className={inputClass}
            >
              <option value="pendiente">Pendiente</option>
              <option value="entregado">Entregado</option>
              <option value="calificado">Calificado</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Fecha Límite</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Nota Calificada (Opcional)</label>
          <input
            type="number"
            step="0.1"
            value={grade !== undefined && grade !== null ? grade : ''}
            onChange={(e) => setGrade(e.target.value !== '' ? Number(e.target.value) : undefined)}
            className={inputClass}
            placeholder="Ej: 4.8"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
          <Button variant="ghost" className="w-full sm:w-auto" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="synergy"
            className="w-full sm:w-auto"
            onClick={handleSave}
            disabled={isSubmitting || !title.trim() || !subjectId}
          >
            {isEdit ? 'Guardar Cambios' : 'Guardar Actividad'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
