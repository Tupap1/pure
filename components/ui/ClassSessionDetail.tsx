'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { ClassSessionEntity, SubjectEntity } from '@/lib/db/dexie-schema';
import { parseTranscript, searchTranscript } from '@/lib/domain/class-session';
import { saveClassSession } from '@/lib/db/repository';
import {
  Calendar,
  Clock,
  MessageSquare,
  Loader2,
} from 'lucide-react';

interface ClassSessionDetailProps {
  session: ClassSessionEntity;
  subjects: SubjectEntity[];
  onClose: () => void;
}

export const ClassSessionDetail: React.FC<ClassSessionDetailProps> = ({
  session,
  subjects,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'resumen' | 'transcripcion' | 'preguntas'>('resumen');
  const [transcriptText, setTranscriptText] = useState<string | null>(session.transcript_text || null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const subject = subjects.find((s) => s.id === session.subject_id);

  // Fetch transcript from API if not already loaded
  useEffect(() => {
    if (activeTab === 'transcripcion' && !transcriptText && !isLoadingTranscript) {
      setIsLoadingTranscript(true);
      fetch(`/api/class-sessions/${session.id}/transcript`)
        .then((res) => res.json())
        .then((data) => {
          const fetchedTranscript = data.transcript_text || null;
          setTranscriptText(fetchedTranscript);
          // Cache it in the session for future loads
          if (fetchedTranscript) {
            saveClassSession({ ...session, transcript_text: fetchedTranscript }).catch(() => {
              // Silently fail if save doesn't work (e.g., offline)
            });
          }
        })
        .catch(() => {
          // Silently fail
        })
        .finally(() => {
          setIsLoadingTranscript(false);
        });
    }
  }, [activeTab, session, transcriptText, isLoadingTranscript]);

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

  const sourceBadgeVariant = session.session_source === 'fireflies' ? 'synergy' : 'outline';

  return (
    <Modal isOpen={true} onClose={onClose} title={session.title}>
      <div className="space-y-4 font-sans text-xs">
        {/* Header Info */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading">
                {session.title}
              </h3>
              {subject && (
                <span className="text-slate-500 text-[11px]">
                  {subject.name}
                </span>
              )}
            </div>
            <Badge variant={sourceBadgeVariant}>
              {session.session_source === 'fireflies' ? 'Fireflies' : 'Manual'}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 flex-wrap text-[11px]">
            <span className="flex items-center gap-1 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatDate(session.session_date)}
            </span>
            {session.duration_minutes && (
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {session.duration_minutes} min
              </span>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1 bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              activeTab === 'resumen'
                ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('transcripcion')}
            className={`flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              activeTab === 'transcripcion'
                ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Transcripción
          </button>
          <button
            onClick={() => setActiveTab('preguntas')}
            className={`flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              activeTab === 'preguntas'
                ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Preguntas
          </button>
        </div>

        {/* Tab: Resumen */}
        {activeTab === 'resumen' && (
          <div className="space-y-3">
            {/* Summary Text */}
            {(session.ai_summary || session.summary) && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {session.ai_summary || session.summary}
                </p>
              </div>
            )}

            {/* Topics Covered */}
            {session.topics_covered && session.topics_covered.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Temas Cubiertos
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {session.topics_covered.map((topic) => (
                    <Badge key={topic} variant="outline" className="text-[10px]">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {session.ai_action_items && session.ai_action_items.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Acciones Pendientes
                </h4>
                <ul className="space-y-1">
                  {session.ai_action_items.map((item, idx) => (
                    <li key={idx} className="text-slate-700 dark:text-slate-300 text-[11px] pl-4 relative">
                      <span className="absolute left-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab: Transcripción */}
        {activeTab === 'transcripcion' && (
          <div className="space-y-2 flex flex-col">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Buscar en la transcripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
            />

            {/* Transcript Content */}
            {isLoadingTranscript ? (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[11px]">Cargando transcripción…</span>
              </div>
            ) : transcriptText ? (
              <div className="max-h-[50vh] overflow-y-auto p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                {(() => {
                  const lines = parseTranscript(transcriptText);
                  const filtered = searchTranscript(lines, searchQuery);
                  return filtered.length > 0 ? (
                    filtered.map((line, idx) => (
                      <div key={idx} className="text-[11px]">
                        {line.speaker ? (
                          <div>
                            <span className="font-medium text-slate-600 dark:text-slate-400">
                              {line.speaker}:
                            </span>{' '}
                            <span className="text-slate-700 dark:text-slate-300">
                              {line.text}
                            </span>
                          </div>
                        ) : (
                          <div className="text-slate-700 dark:text-slate-300">
                            {line.text}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-500 py-6">
                      No se encontraron resultados
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center text-slate-500 dark:text-slate-400 py-6 text-[11px]">
                No hay transcripción disponible
              </div>
            )}
          </div>
        )}

        {/* Tab: Preguntas */}
        {activeTab === 'preguntas' && (
          <div className="space-y-2">
            {session.ai_questions && session.ai_questions.length > 0 ? (
              <ul className="space-y-2">
                {session.ai_questions.map((question, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px]"
                  >
                    {question}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center text-slate-500 dark:text-slate-400 py-6 text-[11px]">
                No hay preguntas detectadas
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
