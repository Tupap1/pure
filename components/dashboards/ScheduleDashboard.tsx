import React from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  Sparkles,
  Clock,
  MapPin
} from 'lucide-react';
import { detectScheduleConflicts } from '@/lib/algorithms/conflict-detector';

export const ScheduleDashboard: React.FC = () => {
  const { isLoaded, subjects, schedules, universities } = usePureData();

  if (!isLoaded) {
    return <div className="p-8 text-center text-slate-400 font-mono">Cargando horario...</div>;
  }

  const mappedSlots = schedules.map((s) => {
    const sub = subjects.find((sb) => sb.id === s.subject_id);
    const uni = universities.find((u) => u.id === sub?.university_id);
    return {
      id: s.id!,
      subjectName: sub?.name || 'Materia',
      universityName: uni?.name || 'Universidad',
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    };
  });

  const conflicts = detectScheduleConflicts(mappedSlots);
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-sky-400" />
            Master Schedule & Matriz de Traslapes
          </h2>
          <p className="text-xs text-slate-400">
            Vista semanal unificada en tiempo real desde IndexedDB con detector de empalmes entre ambas universidades.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="synergy">
            <Sparkles className="w-4 h-4" /> Optimizar Horario con IA
          </Button>
        </div>
      </div>

      {/* Conflict Warning Banner */}
      {conflicts.length > 0 && (
        <Card className="p-4 border border-rose-500/40 bg-rose-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="danger">⚠️ ALERTA DE TRASLAPE MULTI-UNIVERSIDAD</Badge>
                  <span className="text-xs font-mono text-rose-300">
                    Solapamiento de {conflicts[0].overlapMinutes} mins
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100 mt-1">
                  Empalme entre <span className="text-sky-300">{conflicts[0].slotA.subjectName}</span> y <span className="text-purple-300">{conflicts[0].slotB.subjectName}</span>
                </h4>
              </div>
            </div>
            <Button variant="danger" size="sm">
              Resolver Empalme
            </Button>
          </div>
        </Card>
      )}

      {/* Weekly Grid */}
      <div className="glass-panel rounded-2xl overflow-x-auto border border-slate-800">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 font-heading text-xs text-slate-300">
              <th className="p-3 font-mono text-center w-20 border-r border-slate-800">Hora</th>
              {days.map((day) => (
                <th key={day} className="p-3 text-center border-r border-slate-800/60 last:border-r-0">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {hours.map((hour) => (
              <tr key={hour} className="hover:bg-slate-800/20">
                <td className="p-3 font-mono text-center text-slate-400 border-r border-slate-800 bg-slate-900/30">
                  {hour}
                </td>
                {days.map((day, dIdx) => {
                  const dayNum = dIdx + 1; // 1 = Lunes
                  const matchingSchedules = schedules.filter(
                    (s) => s.day_of_week === dayNum && s.start_time <= hour && s.end_time > hour
                  );

                  const hasConflict = matchingSchedules.length > 1;

                  return (
                    <td key={dIdx} className="p-1.5 border-r border-slate-800/40 last:border-r-0 align-top h-16">
                      {hasConflict ? (
                        <div className="p-2 rounded-xl bg-rose-500/25 border border-rose-500 text-rose-200 space-y-1 animate-pulse">
                          <div className="font-bold text-[11px] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" /> CONFLICTO
                          </div>
                          <div className="text-[10px] truncate">{matchingSchedules[0]?.classroom || 'Empalme'}</div>
                        </div>
                      ) : (
                        matchingSchedules.map((sched) => {
                          const sub = subjects.find((sb) => sb.id === sched.subject_id);
                          const isAero = sub?.modality === 'presencial';
                          return (
                            <div
                              key={sched.id}
                              className={`p-2 rounded-xl text-xs space-y-1 ${
                                isAero
                                  ? 'bg-sky-500/20 border border-sky-500/40 text-sky-200'
                                  : 'bg-purple-500/20 border border-purple-500/40 text-purple-200'
                              }`}
                            >
                              <div className="font-bold text-[11px] truncate">{sub?.name || 'Clase'}</div>
                              <div className="text-[10px] text-slate-300 flex items-center gap-1">
                                {isAero ? <MapPin className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                                <span className="truncate">{sched.classroom || (isAero ? 'Presencial' : 'Virtual')}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
