import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { pureDB, DeliverableEntity } from '@/lib/db/dexie-schema';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  CheckSquare,
  Plus,
  Users,
  User,
  CheckCircle2,
  Calculator,
  Trash2
} from 'lucide-react';
import { calculateRequiredGradeForRemaining } from '@/lib/domain/subject';

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

  const handleAddDeliverable = async () => {
    if (!title.trim() || !subjectId) return;

    await pureDB.deliverables.add({
      subject_id: subjectId,
      title,
      due_date: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
      weight_percentage: Number(weight),
      type: 'taller',
      is_group: isGroup,
      complexity,
      status: 'pendiente',
      created_at: new Date().toISOString(),
    });

    setTitle('');
    setIsAddModalOpen(false);
  };

  const handleDeleteDeliverable = async (id: string) => {
    await pureDB.deliverables.delete(id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-emerald-400" />
            Entregas, Evaluaciones & Exámenes Finales
          </h2>
          <p className="text-xs text-slate-400">
            Gestión en tiempo real con soporte para actividades grupales e individuales y calculadora de nota requerida.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="synergy" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4" /> Registrar Actividad
          </Button>
        </div>
      </div>

      {/* Required Grade Calculator Card */}
      {activeSubject && (
        <Card className="p-5 bg-gradient-to-r from-sky-950/30 via-slate-900/80 to-purple-950/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 font-heading">
                  Calculadora de Nota Mínima Requerida en Entregas Restantes
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Materia: <strong className="text-slate-100">{activeSubject.name}</strong> • Nota Meta:{' '}
                  <strong className="text-sky-300">{activeSubject.target_grade.toFixed(2)}</strong>.
                  {requiredGrade !== null ? (
                    <span>
                      {' '}
                      Necesitas promediar{' '}
                      <strong className="text-emerald-400 font-mono text-sm font-bold">
                        {requiredGrade.toFixed(2)}
                      </strong>{' '}
                      en el porcentaje restante para cumplir la meta.
                    </span>
                  ) : (
                    <span> Ya se evaluó el 100% de la materia.</span>
                  )}
                </p>
              </div>
            </div>
            <Badge variant="synergy">Cálculo Automático ✅</Badge>
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setFilterGroup('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            filterGroup === 'all'
              ? 'bg-slate-800 text-slate-100 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Todas las Entregas ({deliverables.length})
        </button>
        <button
          onClick={() => setFilterGroup('individual')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            filterGroup === 'individual'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" /> Individuales
        </button>
        <button
          onClick={() => setFilterGroup('group')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            filterGroup === 'group'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-slate-400 hover:text-slate-200'
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
            <Card key={deliv.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={sub?.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                  {sub?.name || 'Asignatura'}
                </Badge>
                <Badge variant={deliv.complexity === 'dificil' ? 'danger' : 'warning'}>
                  {deliv.complexity}
                </Badge>
              </div>
              <div>
                <h4 className={`text-base font-bold font-heading text-slate-100 ${isDone ? 'line-through text-slate-400' : ''}`}>
                  {deliv.title}
                </h4>
                {deliv.description && <p className="text-xs text-slate-400 mt-1">{deliv.description}</p>}
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono flex items-center gap-1">
                  {deliv.is_group ? <Users className="w-3.5 h-3.5 text-purple-400" /> : <User className="w-3.5 h-3.5 text-sky-400" />}
                  {deliv.is_group ? 'Grupal' : 'Individual'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-mono">Peso: {deliv.weight_percentage}%</span>
                  <button
                    onClick={() => handleDeleteDeliverable(deliv.id!)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal Add Deliverable */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Registrar Nueva Actividad / Evaluación"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Título de la Actividad</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Parcial 2 de Mecánica Orbital"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Asignatura</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Modalidad</label>
              <select
                value={isGroup ? 'group' : 'individual'}
                onChange={(e) => setIsGroup(e.target.value === 'group')}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="individual">👤 Individual</option>
                <option value="group">👥 Grupal</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Peso % en la Nota</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Fecha Límite</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="synergy" onClick={handleAddDeliverable}>
              Guardar en IndexedDB
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
