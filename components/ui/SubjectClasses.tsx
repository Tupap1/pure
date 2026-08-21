'use client';

import React, { useState } from 'react';
import { ClassSessionEntity, SubjectEntity } from '@/lib/db/dexie-schema';
import { ClassSessionDetail } from './ClassSessionDetail';
import { Badge } from './Badge';
import { EmptyState } from './EmptyState';
import { Play, FileText, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubjectClassesProps {
  sessions: ClassSessionEntity[];
  subjects: SubjectEntity[];
}

export const SubjectClasses: React.FC<SubjectClassesProps> = ({ sessions, subjects }) => {
  const [selectedSession, setSelectedSession] = useState<ClassSessionEntity | null>(null);

  // Sort by date descending (newest first)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return isoStr;
    }
  };

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Sin clases registradas"
        description="Aún no hay sesiones de clase para esta materia. Las nuevas clases aparecerán aquí."
      />
    );
  }

  return (
    <>
      <div className="space-y-2">
        {sortedSessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setSelectedSession(session)}
            className={cn(
              'w-full text-left p-3 rounded-lg border transition-colors',
              'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
              'hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <h5 className="text-xs font-medium text-slate-900 dark:text-slate-100 flex-1 line-clamp-2">
                {session.title}
              </h5>
              {(session.recording_url || session.notion_link || session.transcript_text || session.fireflies_transcript_id) && (
                <div className="flex items-center gap-1 shrink-0">
                  {session.recording_url && (
                    <Badge variant="outline" className="text-[10px] py-0.5">
                      <Play className="w-2.5 h-2.5 mr-0.5" /> Grabación
                    </Badge>
                  )}
                  {session.notion_link && (
                    <Badge variant="outline" className="text-[10px] py-0.5">
                      <FileText className="w-2.5 h-2.5 mr-0.5" /> Notion
                    </Badge>
                  )}
                  {(session.transcript_text || session.fireflies_transcript_id) && (
                    <Badge variant="outline" className="text-[10px] py-0.5">
                      Transcripción
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {formatDate(session.session_date)}
              </span>
              {session.duration_minutes && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {session.duration_minutes} min
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {selectedSession && (
        <ClassSessionDetail
          session={selectedSession}
          subjects={subjects}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </>
  );
};
