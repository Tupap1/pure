import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { useNavigation } from '@/lib/hooks/useNavigation';
import { DeliverableEntity } from '@/lib/db/dexie-schema';
import { saveDeliverable, deleteDeliverable } from '@/lib/db/repository';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DeliverableFormModal } from '@/components/ui/DeliverableFormModal';
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

export const DeliverablesDashboard: React.FC = () => {
  const { isLoaded, subjects, deliverables, universities } = usePureData();
  const { openSubject } = useNavigation();
  const [filterGroup, setFilterGroup] = useState<'all' | 'individual' | 'group'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDeliv, setEditingDeliv] = useState<DeliverableEntity | null>(null);

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
    setEditingDeliv(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (deliv: DeliverableEntity) => {
    setIsAddModalOpen(false);
    setEditingDeliv(deliv);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingDeliv(null);
  };

  const handleSaveDeliverable = async (data: DeliverableEntity) => {
    await saveDeliverable(data);
    closeModal();
  };

  const handleDeleteDeliverable = async (id: string) => {
    await deleteDeliverable(id);
  };

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
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {sub && sub.id ? (
                      <button
                        onClick={() => openSubject(sub.id!)}
                        className="hover:underline transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-slate-950 rounded px-0.5"
                        aria-label={`Abrir detalles de ${sub.name}`}
                      >
                        {sub.name}
                      </button>
                    ) : (
                      <span>{sub?.name || 'Asignatura'}</span>
                    )}
                    {' '} • <span className="capitalize">{deliv.complexity}</span>
                  </div>
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
            Agenda
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vencimientos de todas las materias, ordenados por cercanía.
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
                        {subject.id ? (
                          <button
                            onClick={() => openSubject(subject.id!)}
                            className="font-medium text-slate-800 dark:text-slate-200 hover:underline transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-slate-950 rounded px-1"
                            aria-label={`Abrir detalles de ${subject.name}`}
                          >
                            {subject.name}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-800 dark:text-slate-200">{subject.name}</span>
                        )}
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

      {/* Modal Add / Edit Deliverable — formulario extraído y reutilizable */}
      {(isAddModalOpen || editingDeliv !== null) && (
        <DeliverableFormModal
          initialData={editingDeliv}
          subjects={subjects}
          onSave={handleSaveDeliverable}
          onCancel={closeModal}
        />
      )}
    </div>
  );
};
