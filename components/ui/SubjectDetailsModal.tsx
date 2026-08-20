import React, { useState } from 'react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { SubjectEntity, ProfessorEntity, UniversityEntity, ClassSessionEntity, ScheduleEntity } from '@/lib/db/dexie-schema';
import {
  BookOpen,
  User,
  Building2,
  Calendar,
  Link as LinkIcon,
  Video,
  Plus,
  CheckCircle2,
  Tag,
  Clock,
  MapPin,
  Pencil
} from 'lucide-react';

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const PERIODICITY_LABELS: Record<string, string> = {
  semanal: 'Todas las semanas',
  sabado_a: 'Quincenal — Sábado A',
  sabado_b: 'Quincenal — Sábado B',
};

interface SubjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: SubjectEntity | null;
  professor?: ProfessorEntity | null;
  university?: UniversityEntity | null;
  classSessions?: ClassSessionEntity[];
  onAddSession?: (subjectId: string) => void;
  /** Cuando el modal se abre desde un bloque del calendario, la clase concreta que se tocó. */
  schedule?: ScheduleEntity | null;
  /** Solo se ofrece editar si quien abre el modal sabe editar horarios. */
  onEditSchedule?: (schedule: ScheduleEntity) => void;
}

export const SubjectDetailsModal: React.FC<SubjectDetailsModalProps> = ({
  isOpen,
  onClose,
  subject,
  professor,
  university,
  classSessions = [],
  onAddSession,
  schedule = null,
  onEditSchedule,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'sessions'>('sessions');

  if (!subject) return null;

  // Filter sessions for this subject and take the latest 3
  const subjectSessions = classSessions
    .filter((s) => s.subject_id === subject.id)
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  const recent3Sessions = subjectSessions.slice(0, 3);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalles de ${subject.name}`}>
      <div className="space-y-4 font-sans text-xs">
        {/* Header Info */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading">
                {subject.name}
              </h3>
              {subject.code && <span className="font-mono text-slate-500">Cód: {subject.code}</span>}
            </div>
            <Badge variant={subject.modality === 'presencial' ? 'aeroespacial' : 'software'}>
              {subject.modality}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 flex-wrap">
            {university && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-cyan-500" />
                {university.name}
              </span>
            )}
            {professor && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-purple-500" />
                {professor.name}
                {professor.email && (
                  <a
                    href={`mailto:${professor.email}`}
                    className="font-mono text-[11px] text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline"
                  >
                    {professor.email}
                  </a>
                )}
              </span>
            )}
            <span className="font-mono">{subject.credits} Créditos</span>
          </div>
        </div>

        {/* Clase concreta que se tocó en el calendario */}
        {schedule && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3">
            <div>
              <span className="text-slate-500 block text-[10px]">Día</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                {WEEKDAY_NAMES[schedule.day_of_week - 1] || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Horario</span>
              <span className="flex items-center gap-1 font-mono text-slate-800 dark:text-slate-200">
                <Clock className="w-3 h-3 text-cyan-500 shrink-0" />
                {schedule.start_time} - {schedule.end_time}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Aula</span>
              <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                <MapPin className="w-3 h-3 text-purple-500 shrink-0" />
                {schedule.classroom || 'Sin asignar'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Periodicidad</span>
              <span className="text-slate-800 dark:text-slate-200">
                {PERIODICITY_LABELS[schedule.periodicity || 'semanal']}
              </span>
            </div>
          </div>
        )}

        {/* Tab Selection Buttons */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 font-medium border-b-2 transition-all ${
              activeTab === 'sessions'
                ? 'border-sky-500 text-slate-500 dark:text-slate-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Últimas Sesiones ({subjectSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 font-medium border-b-2 transition-all ${
              activeTab === 'info'
                ? 'border-sky-500 text-slate-500 dark:text-slate-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Información & Telemetría
          </button>
        </div>

        {/* Tab 1: Last 3 Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Últimas 3 Clases Registradas</span>
              {onAddSession && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onAddSession(subject.id!);
                  }}
                  className="text-slate-500 dark:text-slate-400"
                >
                  <Plus className="w-3.5 h-3.5" /> Registrar Clase
                </Button>
              )}
            </div>

            {recent3Sessions.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl space-y-2">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-slate-500">No hay sesiones ni clases registradas para esta materia.</p>
                {onAddSession && (
                  <Button
                    variant="aeroespacial"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onAddSession(subject.id!);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Registrar Primera Clase
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {recent3Sessions.map((session) => {
                  const hasSummary = Boolean(session.summary && session.summary.trim());
                  const hasNotion = Boolean(session.notion_link && session.notion_link.trim());
                  const hasRecording = Boolean(session.recording_url && session.recording_url.trim());

                  return (
                    <div
                      key={session.id}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                            <Calendar className="w-3 h-3 text-sky-500 shrink-0" />
                            {formatDate(session.session_date)}
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5">
                            {session.title}
                          </h4>
                        </div>

                        {/* Summary & Notion Indicators */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasSummary ? (
                            <Badge variant="synergy" className="flex items-center gap-1 text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Resumen
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Sin Resumen
                            </Badge>
                          )}

                          {hasNotion ? (
                            <a
                              href={session.notion_link!}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-slate-500 dark:text-slate-400 border border-indigo-500/30 hover:underline"
                            >
                              <LinkIcon className="w-2.5 h-2.5" /> Notion
                            </a>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Sin Notion
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Summary Excerpt if present */}
                      {hasSummary && (
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] line-clamp-2 italic bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800/60">
                          &ldquo;{session.summary}&rdquo;
                        </p>
                      )}

                      {/* Recording button & topics */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                        {session.topics_covered && session.topics_covered.length > 0 ? (
                          <div className="flex items-center gap-1 truncate text-slate-500">
                            <Tag className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">{session.topics_covered.join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sin temas etiquetados</span>
                        )}

                        {hasRecording && (
                          <a
                            href={session.recording_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium hover:underline shrink-0"
                          >
                            <Video className="w-3.5 h-3.5" /> Ver Grabación
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: General Info & Telemetry */}
        {activeTab === 'info' && (
          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Nota Meta</span>
                <span className="font-mono font-bold text-sm text-slate-500 dark:text-slate-400">
                  {subject.target_grade}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Nota Actual</span>
                <span className="font-mono font-bold text-sm text-slate-500 dark:text-slate-400">
                  {subject.current_grade || 0.0}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Dificultad</span>
                <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                  {subject.difficulty} / 5
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Faltas Permitidas</span>
                <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                  {subject.max_absences ?? 4}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {schedule && onEditSchedule && (
            <Button
              variant="aeroespacial"
              onClick={() => {
                onClose();
                onEditSchedule(schedule);
              }}
            >
              <Pencil className="w-3.5 h-3.5" /> Editar horario
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
