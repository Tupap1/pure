import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { pureDB } from '@/lib/db/dexie-schema';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  CheckSquare,
  Plus,
  Users,
  User,
  Calculator,
  Trash2,
  Pencil
} from 'lucide-react';
import { calculateRequiredGradeForRemaining } from '@/lib/domain/subject';
import { DeliverableSchema, validateEntity } from '@/lib/validations/schemas';

export const DeliverablesDashboard: React.FC = () => {
  const { isLoaded, subjects, deliverables } = usePureData();
  const [filterGroup, setFilterGroup] = useState<'all' | 'individual' | 'group'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [weight, setWeight] = useState(20);
  const [isGroup, setIsGroup] = useState(false);
  const [complexity, setComplexity] = useState<'facil' | 'medio' | 'dificil'>('medio');
  const [dueDate, setDueDate] = useState('');

  // Editing ID
  const [editingDelivId, setEditingDelivId] = useState<string | null>(null);
  const [delivErrors, setDelivErrors] = useState<Record<string, string>>({});

  if (!isLoaded) {
    return <div className="p-8 text-center text-slate-400 font-mono">Cargando entregas...</div>;
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

  const handleOpenEditDeliverable = (deliv: any) => {
    setEditingDelivId(deliv.id);
    setTitle(deliv.title);
    setSubjectId(deliv.subject_id);
    setWeight(deliv.weight_percentage);
    setIsGroup(deliv.is_group || false);
    setComplexity(deliv.complexity as any);
    setDueDate(deliv.due_date ? deliv.due_date.substring(0, 10) : '');
    setIsAddModalOpen(true);
  };

  const handleAddDeliverable = async () => {
    const delivData = {
      subject_id: subjectId,
      title,
      due_date: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
      weight_percentage: Number(weight),
      type: 'Parcial',
      is_group: isGroup,
      complexity: complexity === 'dificil' ? 'Difícil' : complexity === 'facil' ? 'Fácil' : 'Medio',
      status: 'pendiente',
    };

    const validation = validateEntity(DeliverableSchema, delivData as any);
    if (!validation.success) {
      setDelivErrors(validation.errors);
      return;
    }

    setDelivErrors({});
    if (editingDelivId) {
      await pureDB.deliverables.update(editingDelivId, {
        ...validation.data as any,
        type: 'Parcial',
        complexity: complexity,
      });
    } else {
      await pureDB.deliverables.add({
        ...validation.data as any,
        type: 'Parcial',
        complexity: complexity,
        created_at: new Date().toISOString(),
      });
    }

    setTitle('');
    setEditingDelivId(null);
    setIsAddModalOpen(false);
  };

  const handleDeleteDeliverable = async (id: string) => {
    await pureDB.deliverables.delete(id);
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500 transition-colors';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Entregas, Evaluaciones & Exámenes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registro de actividades con calculadora de nota mínima requerida.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="synergy"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            disabled={subjects.length === 0}
          >
            <Plus className="w-4 h-4" /> Registrar Actividad
          </Button>
        </div>
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
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No hay entregas pendientes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {subjects.length === 0
              ? 'Registra primero tus materias para poder agendar evaluaciones y talleres.'
              : 'Registra tus talleres, parciales y proyectos para realizar seguimiento de tus notas.'}
          </p>
          <Button
            variant="synergy"
            size="sm"
            className="mt-4"
            onClick={() => setIsAddModalOpen(true)}
            disabled={subjects.length === 0}
          >
            <Plus className="w-4 h-4" /> Agregar Entrega
          </Button>
        </Card>
      ) : (
        <>
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              onClick={() => setFilterGroup('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterGroup === 'all'
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Todas ({deliverables.length})
            </button>
            <button
              onClick={() => setFilterGroup('individual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterGroup === 'individual'
                  ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Individuales
            </button>
            <button
              onClick={() => setFilterGroup('group')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
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
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                      {deliv.is_group ? <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> : <User className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                      {deliv.is_group ? 'Grupal' : 'Individual'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-700 dark:text-slate-300 font-mono">Peso: {deliv.weight_percentage}%</span>
                      <button
                        onClick={() => handleOpenEditDeliverable(deliv)}
                        title="Editar entrega"
                        className="text-slate-400 hover:text-emerald-500 transition-colors p-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDeliverable(deliv.id!)}
                        title="Eliminar entrega"
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Add Deliverable */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Registrar Nueva Actividad / Evaluación"
      >
        <div className="space-y-4">
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
                <option value="individual">👤 Individual</option>
                <option value="group">👥 Grupal</option>
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

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Fecha Límite</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="synergy" onClick={handleAddDeliverable}>
              Guardar Actividad
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
