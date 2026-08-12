import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { pureDB, DeliverableEntity } from '@/lib/db/dexie-schema';
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
  Calculator,
  Trash2,
  Edit3
} from 'lucide-react';
import { calculateRequiredGradeForRemaining } from '@/lib/domain/subject';
import { formatDeliverableDate } from '@/lib/domain/deliverable';
import { DeliverableSchema, validateEntity } from '@/lib/validations/schemas';

export const DeliverablesDashboard: React.FC = () => {
  const { isLoaded, subjects, deliverables } = usePureData();
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
            <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  const filteredDeliverables = deliverables.filter((item) => {
    if (filterGroup === 'group') return item.is_group;
    if (filterGroup === 'individual') return !item.is_group;
    return true;
  });

  const activeSubject = subjects[0];
  const requiredGrade = activeSubject
    ? calculateRequiredGradeForRemaining(deliverables as any, activeSubject.target_grade)
    : null;

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
      await pureDB.deliverables.update(editingDeliv.id, {
        ...validation.data as any,
        complexity,
        status,
        grade: grade !== undefined && grade !== null ? Number(grade) : undefined,
      });
      setEditingDeliv(null);
    } else {
      await pureDB.deliverables.add({
        ...validation.data as any,
        type: 'Parcial',
        complexity: complexity,
        status: status,
        grade: grade !== undefined && grade !== null ? Number(grade) : undefined,
        created_at: new Date().toISOString(),
      });
      setIsAddModalOpen(false);
    }
  };

  const handleDeleteDeliverable = async (id: string) => {
    await pureDB.deliverables.delete(id);
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500 transition-colors';

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
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

      {/* Required Grade Calculator Card */}
      {activeSubject && deliverables.length > 0 && (
        <Card className="p-4 border border-sky-300 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Calculadora de Nota Mínima Requerida
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Materia: <strong className="text-slate-900 dark:text-slate-100">{activeSubject.name}</strong> • Nota Meta:{' '}
                  <strong className="text-sky-600 dark:text-sky-300">{activeSubject.target_grade.toFixed(2)}</strong>.
                  {requiredGrade !== null ? (
                    <span>
                      {' '}
                      Necesitas promediar{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm font-bold">
                        {requiredGrade.toFixed(2)}
                      </strong>{' '}
                      en los porcentajes restantes.
                    </span>
                  ) : (
                    <span> Ya se evaluó el 100% de la materia.</span>
                  )}
                </p>
              </div>
            </div>
            <Badge variant="synergy">Cálculo Automático</Badge>
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
                  ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
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
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Grupales
            </button>
          </div>

          {/* Deliverable Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDeliverables.map((deliv) => {
              const sub = subjects.find((s) => s.id === deliv.subject_id);
              const isDone = deliv.status === 'calificado' || deliv.status === 'entregado';

              return (
                <Card key={deliv.id} className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={sub?.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                      {sub?.name || 'Asignatura'}
                    </Badge>
                    <Badge variant={deliv.complexity === 'dificil' ? 'danger' : 'warning'}>
                      {deliv.complexity}
                    </Badge>
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold text-slate-900 dark:text-slate-100 ${isDone ? 'line-through text-slate-400' : ''}`}>
                      {deliv.title}
                    </h4>
                    {deliv.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{deliv.description}</p>}
                    {deliv.due_date && (
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                        Límite: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatDeliverableDate(deliv.due_date)}</span>
                      </p>
                    )}
                    {deliv.grade !== undefined && deliv.grade !== null && (
                      <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                        Nota Obtenida: {deliv.grade.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-y-1 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                      {deliv.is_group ? <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> : <User className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                      {deliv.is_group ? 'Grupal' : 'Individual'}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px] mr-1">Peso: {deliv.weight_percentage}%</span>
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
