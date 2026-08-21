'use client';

import React from 'react';
import { SubjectEntity, UniversityEntity, ProfessorEntity, ScheduleEntity } from '@/lib/db/dexie-schema';
import { Mail, Clock, MapPin, BookOpen, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubjectFichaProps {
  subject: SubjectEntity;
  university?: UniversityEntity;
  professor?: ProfessorEntity;
  schedules: ScheduleEntity[];
}

const DAY_NAMES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const PERIODICITY_LABELS: Record<string, string> = {
  semanal: 'Semanal',
  sabado_a: 'Sábado A',
  sabado_b: 'Sábado B',
};

const FichaRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    <span className={cn('text-xs text-slate-900 dark:text-slate-100 text-right', mono && 'font-mono font-medium')}>
      {value}
    </span>
  </div>
);

export const SubjectFicha: React.FC<SubjectFichaProps> = ({
  subject,
  university,
  professor,
  schedules,
}) => {
  const tileClass = 'p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800';

  return (
    <div className="space-y-4">
      {/* Profesor */}
      {professor && (
        <div className={tileClass}>
          <div className="flex items-start gap-2.5 mb-2">
            <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-heading font-semibold text-slate-900 dark:text-slate-100">
                {professor.name}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Profesor</p>
            </div>
          </div>
          <div className="space-y-1.5 text-xs pl-6">
            {professor.email && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Mail className="w-3 h-3 text-slate-400" />
                <a
                  href={`mailto:${professor.email}`}
                  className="hover:underline break-all"
                >
                  {professor.email}
                </a>
              </div>
            )}
            {professor.office_hours && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Clock className="w-3 h-3 text-slate-400" />
                {professor.office_hours}
              </div>
            )}
            {professor.notes && (
              <p className="text-slate-600 dark:text-slate-400 mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                {professor.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Horarios y aulas */}
      {schedules.length > 0 && (
        <div className={tileClass}>
          <div className="flex items-start gap-2.5 mb-2">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-heading font-semibold text-slate-900 dark:text-slate-100">
                Horario de clase
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {schedules.length} {schedules.length === 1 ? 'sesión' : 'sesiones'} por semana
              </p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            {schedules.map((sched, idx) => (
              <div
                key={sched.id || idx}
                className="p-2 rounded-md bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {DAY_NAMES[sched.day_of_week] || 'Día desconocido'}
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {sched.start_time} – {sched.end_time}
                  </span>
                </div>
                {sched.classroom && (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 mt-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px]">{sched.classroom}</span>
                  </div>
                )}
                {sched.periodicity && (
                  <span className="inline-block text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                    {PERIODICITY_LABELS[sched.periodicity] || sched.periodicity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Datos de la materia */}
      <div className={tileClass}>
        <div className="flex items-start gap-2.5 mb-2">
          <BookOpen className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-xs font-heading font-semibold text-slate-900 dark:text-slate-100">
              Datos de la materia
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {university?.name ?? 'Sin universidad'}
            </p>
          </div>
        </div>
        <div className="space-y-1.5 text-xs pl-6">
          {subject.code && <FichaRow label="Código" value={subject.code} mono />}
          <FichaRow label="Créditos" value={`${subject.credits}`} mono />
          <FichaRow label="Dificultad" value={`${subject.difficulty}/5`} mono />
          <FichaRow label="Modalidad" value={subject.modality} />
          {subject.max_absences !== undefined && subject.max_absences !== null && (
            <FichaRow label="Faltas permitidas" value={`${subject.max_absences}`} mono />
          )}
          {university && (
            <>
              <div className="pt-1.5 mt-1 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                <FichaRow label="Escala de calificación" value={`${university.scale_min} – ${university.scale_max}`} mono />
                <FichaRow label="Nota mínima de aprobación" value={`${university.passing_grade}`} mono />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
