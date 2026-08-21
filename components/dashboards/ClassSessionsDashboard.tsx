import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { ClassSessionEntity } from '@/lib/db/dexie-schema';
import { saveClassSession, deleteClassSession } from '@/lib/db/repository';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ClassSessionForm } from '@/components/ui/ClassSessionForm';
import { ClassSessionDetail } from '@/components/ui/ClassSessionDetail';
import { AttendancePanel } from '@/components/ui/AttendancePanel';
import {
  Video,
  FileText,
  Link as LinkIcon,
  Plus,
  Search,
  BookOpen,
  Calendar,
  Tag,
  Trash2,
  Edit3,
  ExternalLink
} from 'lucide-react';

export const ClassSessionsDashboard: React.FC = () => {
  const { isLoaded, subjects, schedules, classSessions, attendanceRecords, universities } = usePureData();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSessionEntity | null>(null);
  const [detailSession, setDetailSession] = useState<ClassSessionEntity | null>(null);

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse pb-16" role="status" aria-label="Cargando sesiones de clase">
        <div className="h-14 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  const handleOpenAdd = () => {
    setEditingSession(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (session: ClassSessionEntity) => {
    setEditingSession(session);
    setIsFormModalOpen(true);
  };

  const handleSaveSession = async (data: ClassSessionEntity) => {
    await saveClassSession(data);
    setIsFormModalOpen(false);
    setEditingSession(null);
  };

  const handleDeleteSession = async (id: string) => {
    const confirmed = window.confirm('¿Estás seguro de que deseas eliminar esta sesión de clase?');
    if (confirmed) {
      await deleteClassSession(id);
    }
  };

  // Filter & Search
  const filteredSessions = classSessions
    .filter((s) => {
      if (selectedSubjectId !== 'all' && s.subject_id !== selectedSubjectId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesSummary = s.summary?.toLowerCase().includes(q) || false;
        const matchesTopics = s.topics_covered?.some((t) => t.toLowerCase().includes(q)) || false;
        return matchesTitle || matchesSummary || matchesTopics;
      }
      return true;
    })
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors';

  return (
    <div className="space-y-6 animate-fade-in pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Video className="w-5 h-5 text-rose-500 shrink-0" />
            Grabaciones & Resúmenes de Clases
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adjunta enlaces a Notion, URLs de video grabado (YouTube/Loom) y resúmenes de tus clases.
          </p>
        </div>
        <Button variant="aeroespacial" onClick={handleOpenAdd} className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Registrar Nueva Sesión
        </Button>
      </div>

      {/* Asistencia por materia */}
      <AttendancePanel
        subjects={subjects}
        schedules={schedules}
        universities={universities}
        attendanceRecords={attendanceRecords}
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por tema, título o contenido..."
            className={`${inputClass} pl-9`}
          />
        </div>

        {/* Subject Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedSubjectId('all')}
            className={`px-3 py-2 rounded-lg border font-medium transition-all shrink-0 ${
              selectedSubjectId === 'all'
                ? 'bg-slate-900 dark:bg-white/10 text-white border-transparent font-semibold shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            Todas ({classSessions.length})
          </button>
          {subjects.map((sub) => {
            const count = classSessions.filter((s) => s.subject_id === sub.id).length;
            const isSelected = selectedSubjectId === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubjectId(sub.id!)}
                className={`px-3 py-2 rounded-lg border font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{sub.name}</span>
                <span className="opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Sessions */}
      {filteredSessions.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <Video className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-heading font-bold tracking-tight text-slate-800 dark:text-slate-200">
            No hay sesiones registradas
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto mb-4">
            Comienza a registrar las clases dictadas, adjunta tus notas de Notion o los links a la grabación en vivo.
          </p>
          <Button variant="aeroespacial" onClick={handleOpenAdd} className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Registrar Primera Sesión
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSessions.map((session) => {
            const sub = subjects.find((sb) => sb.id === session.subject_id);

            return (
              <Card
                key={session.id}
                onClick={() => setDetailSession(session)}
                className="p-5 space-y-4 border border-slate-200/40 dark:border-slate-800/30 hover:border-slate-200/60 dark:hover:border-slate-700/50 transition-all bg-white dark:bg-slate-950 shadow-sm cursor-pointer"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="aeroespacial">{sub?.name || 'Asignatura'}</Badge>
                      <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-sky-500" />
                        {formatDate(session.session_date)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading leading-snug">
                      {session.title}
                    </h3>
                  </div>

                  {/* Edit / Delete actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(session);
                      }}
                      title="Editar Sesión"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id!);
                      }}
                      title="Eliminar Sesión"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Summary content */}
                {session.summary && (
                  <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/30 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      <FileText className="w-3 h-3 text-cyan-500" /> Resumen
                    </div>
                    {session.summary}
                  </div>
                )}

                {/* Links Row (Notion & Recording) */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {session.notion_link && (
                    <a
                      href={session.notion_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-software border border-indigo-200 dark:border-indigo-800 text-xs font-medium hover:underline transition-colors"
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Ver en Notion</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}

                  {session.recording_url && (
                    <a
                      href={session.recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-medium hover:underline transition-colors"
                    >
                      <Video className="w-3.5 h-3.5 text-rose-500" />
                      <span>Ver Grabación</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                </div>

                {/* Topics Covered */}
                {session.topics_covered && session.topics_covered.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-slate-200/25 dark:border-slate-800/15">
                    <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                    {session.topics_covered.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-1 rounded text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-white/[0.08] text-[10px] font-medium bg-black/[0.03] dark:bg-white/[0.05]"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSession(null);
        }}
        title={editingSession ? 'Editar Sesión de Clase' : 'Registrar Nueva Sesión de Clase'}
      >
        <ClassSessionForm
          initialData={editingSession}
          subjects={subjects}
          schedules={schedules}
          onSave={handleSaveSession}
          onCancel={() => {
            setIsFormModalOpen(false);
            setEditingSession(null);
          }}
        />
      </Modal>

      {/* Detail Modal */}
      {detailSession && (
        <ClassSessionDetail
          session={detailSession}
          subjects={subjects}
          onClose={() => setDetailSession(null)}
        />
      )}
    </div>
  );
};
