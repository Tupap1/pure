import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { DeliverableEntity } from '@/lib/db/dexie-schema';
import { saveDeliverable, deleteDeliverable } from '@/lib/db/repository';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormErrors } from '@/components/ui/FormErrors';
import {
  CheckSquare,
  Plus,
  Users,
  User,
  Trash2,
  Edit3
} from 'lucide-react';
import { calculateRequiredGradeForRemaining } from '@/lib/domain/subject';
import { formatDeliverableDate } from '@/lib/domain/deliverable';
import { DeliverableSchema, validateEntity } from '@/lib/validations/schemas';

export const DeliverablesDashboard: React.FC = () => {
  const { isLoaded, subjects, deliverables, universities } = usePureData();
  const [filterGroup, setFilterGroup] = useState<'all' | 'individual' | 'group'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDeliv, setEditingDeliv] = useState<DeliverableEntity | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [weight, setWeight] = useState(20);
  const [isGroup, setIsGroup] = useState(false);
  const [complexity, setComplexity] = useState<'facil' | 'medio' | 'dificil'>('medio');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'pendiente' | 'entregado' | 'calificado'>('pendiente');
  const [grade, setGrade] = useState<number | undefined>(undefined);

  const [delivErrors, setDelivErrors] = useState<Record<string, string>>({});

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse pb-16" role="status" aria-label="Cargando entregas">
        <div className="h-14 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  const filteredDeliverables = deliverables
    .filter((item) => {
      if (filterGroup === 'group') return item.is_group;
      if (filterGroup === 'individual') return !item.is_group;
      return true;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  // Nota requerida POR materia: cada una usa solo sus propias entregas y su meta.
  // Antes se calculaba con todas las entregas contra la meta de una sola materia (bug).
  const gradeRows = subjects
    .map((subject) => {
      const subjectDelivs = deliverables.filter((d) => d.subject_id === subject.id);
      if (subjectDelivs.length === 0) return null;
      const uni = universities.find((u) => u.id === subject.university_id);
      const scaleMax = uni?.scale_max ?? 5;
      const required = calculateRequiredGradeForRemaining(subjectDelivs as any, subject.target_grade);
      const evaluatedWeight = subjectDelivs
        .filter((d) => d.status === 'calificado' && d.grade != null)
        .reduce((sum, d) => sum + d.weight_percentage, 0);
      return { subject, required, scaleMax, remainingWeight: Math.max(0, 100 - evaluatedWeight) };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const openAddModal = () => {
    setTitle('');
    setSubjectId(subjects[0]?.id || '');
    setWeight(20);
    setIsGroup(false);
    setComplexity('medio');
    setDueDate('');
    setStatus('pendiente');
    setGrade(undefined);
    setDelivErrors({});
    setIsAddModalOpen(true);
  };

  const openEditModal = (deliv: DeliverableEntity) => {
    setEditingDeliv(deliv);
    setTitle(deliv.title);
    setSubjectId(deliv.subject_id);
    setWeight(deliv.weight_percentage);
    setIsGroup(deliv.is_group);
    setComplexity(deliv.complexity);
    setDueDate(deliv.due_date ? deliv.due_date.replace('Z', '').slice(0, 16) : '');
    setStatus(deliv.status);
    setGrade(deliv.grade);
    setDelivErrors({});
  };

  const handleSaveDeliverable = async () => {
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
      type: 'Parcial',
      is_group: isGroup,
      complexity: complexity === 'dificil' ? 'Difícil' : complexity === 'facil' ? 'Fácil' : 'Medio',
      status: status,
      grade: grade !== undefined && grade !== null ? Number(grade) : undefined,
    };

    const validation = validateEntity(DeliverableSchema, delivData as any);
    if (!validation.success) {
      setDelivErrors(validation.errors);
      return;
    }

    setDelivErrors({});

    if (editingDeliv && editingDeliv.id) {
      await saveDeliverable({
        ...editingDeliv,
        ...(validation.data as any),
        complexity,
        status,
        grade: grade !== undefined && grade !== null ? Number(grade) : undefined,
        id: editingDeliv.id,
      });
      setEditingDeliv(null);
    } else {
      await saveDeliverable({
        ...(validation.data as any),
        type: 'Parcial',
        complexity: complexity,
        status: status,
        grade: grade !== undefined && grade !== null ? Number(grade) : undefined,
      });
      setIsAddModalOpen(false);
    }
  };

  const handleDeleteDeliverable = async (id: string) => {
    await deleteDeliverable(id);
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors';

  // Helper: Check if deliverable is overdue
  const isOverdue = (dueDate: string, status: string): boolean => {
    if (status !== 'pendiente') return false;
    return new Date(dueDate).getTime() < new Date().getTime();
  };

  // Helper: Group deliverables by time proximity
  const groupDeliverablesByTime = (delivs: typeof deliverables) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const twoWeeksFromNow = new Date(weekFromNow);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 7);

    const groups: {
      vencidas: DeliverableEntity[];
      estaSemana: DeliverableEntity[];
      proximaSemana: DeliverableEntity[];
      masAdelante: DeliverableEntity[];
    } = {
      vencidas: [],
      estaSemana: [],
      proximaSemana: [],
      masAdelante: [],
    };

    delivs.forEach((deliv) => {
      const dueDate = new Date(deliv.due_date);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

      if (isOverdue(deliv.due_date, deliv.status)) {
        groups.vencidas.push(deliv);
      } else if (dueDateOnly <= weekFromNow) {
        groups.estaSemana.push(deliv);
      } else if (dueDateOnly <= twoWeeksFromNow) {
        groups.proximaSemana.push(deliv);
      } else {
        groups.masAdelante.push(deliv);
      }
    });

    return groups;
  };

  // Helper: Render a time-grouped section
  const renderTimeGroup = (groupTitle: string, groupDelivs: typeof deliverables, titleColor: string) => {
    if (groupDelivs.length === 0) return null;

    return (
      <div key={groupTitle} className="space-y-3">
        <h3 className={`text-xs font-medium ${titleColor} uppercase tracking-wide`}>
          {groupTitle}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupDelivs.map((deliv) => {
            const sub = subjects.find((s) => s.id === deliv.subject_id);
            const isDone = deliv.status === 'calificado' || deliv.status === 'entregado';
            const overdue = isOverdue(deliv.due_date, deliv.status);

            return (
              <Card
                key={deliv.id}
                className={`space-y-4 p-5 ${overdue ? 'border-red-400/60 dark:border-red-500/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {sub?.name || 'Asignatura'} • <span className="capitalize">{deliv.complexity}</span>
                  </span>
                </div>
                <div>
                  <h4 className={`text-base font-bold text-slate-900 dark:text-slate-100 ${isDone ? 'line-through text-slate-400' : ''}`}>
                    {deliv.title}
                  </h4>
                  {deliv.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{deliv.description}</p>}
                  {deliv.due_date && (
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                      Límite: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatDeliverableDate(deliv.due_date)}</span>
                      {overdue && <Badge className="bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[10px]">Vencida</Badge>}
                    </p>
                  )}
                  {deliv.grade !== undefined && deliv.grade !== null && (
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold mt-1">
                      Nota Obtenida: {deliv.grade.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="pt-3 border-t border-slate-200/25 dark:border-slate-800/15 flex flex-wrap items-center justify-between gap-y-1 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                    {deliv.is_group ? <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> : <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                    {deliv.is_group ? 'Grupal' : 'Individual'}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px] mr-1">Peso: {deliv.weight_percentage}%</span>
                    <button
                      onClick={() => openEditModal(deliv)}
                      aria-label={`Editar ${deliv.title}`}
                      title="Editar Actividad"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDeliverable(deliv.id!)}
                      aria-label={`Eliminar ${deliv.title}`}
                      title="Eliminar Actividad"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
            Entregas, evaluaciones y exámenes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registro y edición de actividades con calculadora de nota mínima requerida.
          </p>
        </div>
        <Button
          variant="synergy"
          size="sm"
          className="w-full sm:w-auto"
          onClick={openAddModal}
          disabled={subjects.length === 0}
        >
          <Plus className="w-4 h-4" /> Registrar Actividad
        </Button>
      </div>

      {/* Nota requerida por materia — dato, no prosa */}
      {gradeRows.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
              Nota requerida por materia
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Promedio mínimo necesario en lo que falta para alcanzar tu meta.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-y border-surface-border text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium px-4 py-2">Materia</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Meta</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Falta</th>
                  <th className="text-right font-medium px-4 py-2 tabular-nums">Requerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {gradeRows.map(({ subject, required, scaleMax, remainingWeight }) => {
                  const impossible = required != null && required > scaleMax;
                  const demanding = required != null && !impossible && required > subject.target_grade;
                  const reqClass = impossible
                    ? 'text-red-600 dark:text-red-400'
                    : demanding
                      ? 'text-amber-600 dark:text-amber-500'
                      : 'text-slate-900 dark:text-slate-100';
                  return (
                    <tr key={subject.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{subject.name}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {subject.target_grade.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {remainingWeight}%
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold ${reqClass}`}>
                        {required == null ? (
                          <span className="text-slate-400 font-normal">Completa</span>
                        ) : impossible ? (
                          <span title="Supera la escala máxima">{required.toFixed(2)} ✕</span>
                        ) : (
                          required.toFixed(2)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {deliverables.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <CheckSquare className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-heading font-bold tracking-tight text-slate-800 dark:text-slate-200">No hay entregas pendientes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {subjects.length === 0
              ? 'Registra primero tus materias para poder agendar evaluaciones y talleres.'
              : 'Registra tus talleres, parciales y proyectos para realizar seguimiento de tus notas.'}
          </p>
          <Button
            variant="synergy"
            size="sm"
            className="mt-4"
            onClick={openAddModal}
            disabled={subjects.length === 0}
          >
            <Plus className="w-4 h-4" /> Agregar Entrega
          </Button>
        </Card>
      ) : (
        <>
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto" role="tablist" aria-label="Filtrar entregas">
            <button
              role="tab"
              aria-selected={filterGroup === 'all'}
              onClick={() => setFilterGroup('all')}
              className={`shrink-0 px-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors ${
                filterGroup === 'all'
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Todas ({deliverables.length})
            </button>
            <button
              role="tab"
              aria-selected={filterGroup === 'individual'}
              onClick={() => setFilterGroup('individual')}
              className={`shrink-0 px-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterGroup === 'individual'
                  ? 'bg-sky-100 dark:bg-sky-950/80 text-aeroespacial border border-sky-300 dark:border-sky-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Individuales
            </button>
            <button
              role="tab"
              aria-selected={filterGroup === 'group'}
              onClick={() => setFilterGroup('group')}
              className={`shrink-0 px-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterGroup === 'group'
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-software border border-indigo-300 dark:border-indigo-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Grupales
            </button>
          </div>

          {/* Deliverable Cards Grid - Grouped by Time */}
          {(() => {
            const groups = groupDeliverablesByTime(filteredDeliverables);
            return (
              <div className="space-y-8">
                {renderTimeGroup('Vencidas', groups.vencidas, 'text-red-600 dark:text-red-400')}
                {renderTimeGroup('Esta semana', groups.estaSemana, 'text-slate-500 dark:text-slate-400')}
                {renderTimeGroup('Próxima semana', groups.proximaSemana, 'text-slate-500 dark:text-slate-400')}
                {renderTimeGroup('Más adelante', groups.masAdelante, 'text-slate-500 dark:text-slate-400')}
              </div>
            );
          })()}
        </>
      )}

      {/* Modal Add / Edit Deliverable */}
      <Modal
        isOpen={isAddModalOpen || editingDeliv !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingDeliv(null);
        }}
        title={editingDeliv ? `Editar Actividad: ${editingDeliv.title}` : 'Registrar Nueva Actividad / Evaluación'}
      >
        <div className="space-y-4">
          <FormErrors errors={delivErrors} />
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Título de la Actividad</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Ej: Parcial 2 de Mecánica Orbital"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Asignatura</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona una asignatura</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Modalidad</label>
              <select
                value={isGroup ? 'group' : 'individual'}
                onChange={(e) => setIsGroup(e.target.value === 'group')}
                className={inputClass}
              >
                <option value="individual">Individual</option>
                <option value="group">Grupal</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Peso % en la Nota</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Complejidad</label>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as any)}
                className={inputClass}
              >
                <option value="facil">Fácil</option>
                <option value="medio">Medio</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className={inputClass}
              >
                <option value="pendiente">Pendiente</option>
                <option value="entregado">Entregado</option>
                <option value="calificado">Calificado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Fecha Límite</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nota Calificada (Opcional)</label>
              <input
                type="number"
                step="0.1"
                value={grade !== undefined && grade !== null ? grade : ''}
                onChange={(e) => setGrade(e.target.value !== '' ? Number(e.target.value) : undefined)}
                className={inputClass}
                placeholder="Ej: 4.8"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => { setIsAddModalOpen(false); setEditingDeliv(null); }}>
              Cancelar
            </Button>
            <Button
              variant="synergy"
              className="w-full sm:w-auto"
              onClick={handleSaveDeliverable}
              disabled={!title.trim() || !subjectId}
            >
              {editingDeliv ? 'Guardar Cambios' : 'Guardar Actividad'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
