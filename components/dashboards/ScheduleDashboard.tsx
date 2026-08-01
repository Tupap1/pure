import React from 'react';
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

export const ScheduleDashboard: React.FC = () => {
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-sky-400" />
            Master Schedule & Matriz de Traslapes
          </h2>
          <p className="text-xs text-slate-400">
            Vista semanal unificada de clases presenciales (Aeroespacial) y virtuales (Software) con bloques de estudio DME.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="synergy">
            <Sparkles className="w-4 h-4" /> Recalcular Bloques DME
          </Button>
        </div>
      </div>

      {/* Conflict Warning Banner */}
      <Card glowColor="warning" className="p-4 border-l-4 border-l-rose-500 bg-rose-950/20 border-rose-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="danger">⚠️ ALERTA DE TRASLAPE MULTI-UNIVERSIDAD</Badge>
                <span className="text-xs font-mono text-rose-300">Solapamiento de 60 mins</span>
              </div>
              <h4 className="text-sm font-bold text-slate-100 mt-1">
                Lunes 09:00 - 10:00: <span className="text-sky-300">Cálculo Vectorial (Presencial)</span> vs <span className="text-purple-300">Estructuras de Datos (Virtual)</span>
              </h4>
            </div>
          </div>
          <Button variant="danger" size="sm">
            Resolver Empalme
          </Button>
        </div>
      </Card>

      {/* Legend & Filters */}
      <div className="flex flex-wrap items-center gap-4 p-3 rounded-2xl glass-panel text-xs text-slate-300">
        <span className="font-semibold text-slate-400 font-mono">Leyenda:</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-sky-500/40 border border-sky-400"></span>
          <span>Aeroespacial (Presencial)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-purple-500/40 border border-purple-400"></span>
          <span>Software (Virtual)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-400 border-dashed"></span>
          <span>Estudio DME (Generado por IA)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-rose-500/40 border border-rose-500"></span>
          <span>Traslape de Clases</span>
        </div>
      </div>

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
            {hours.map((hour, hIdx) => (
              <tr key={hour} className="hover:bg-slate-800/20">
                <td className="p-3 font-mono text-center text-slate-400 border-r border-slate-800 bg-slate-900/30">
                  {hour}
                </td>
                {days.map((day, dIdx) => {
                  // Mock slots for visual demo
                  const isConflict = dIdx === 0 && hIdx === 1; // Lunes 09:00
                  const isAeroClass = dIdx === 0 && hIdx === 0; // Lunes 08:00
                  const isSoftClass = dIdx === 1 && hIdx === 2; // Martes 10:00
                  const isDMESession = dIdx === 2 && hIdx === 4; // Miércoles 12:00

                  return (
                    <td key={dIdx} className="p-1.5 border-r border-slate-800/40 last:border-r-0 align-top h-16">
                      {isConflict && (
                        <div className="p-2 rounded-xl bg-rose-500/25 border border-rose-500 text-rose-200 space-y-1 animate-pulse">
                          <div className="font-bold flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-rose-400" /> CONFLICTO HORARIO
                          </div>
                          <div className="text-[10px]">Cálculo (Aero) vs Struct (Soft)</div>
                        </div>
                      )}

                      {isAeroClass && (
                        <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-200 space-y-1">
                          <div className="font-bold text-[11px]">Cálculo Vectorial</div>
                          <div className="text-[10px] text-sky-300 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" /> Aula 302 (Presencial)
                          </div>
                        </div>
                      )}

                      {isSoftClass && (
                        <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 space-y-1">
                          <div className="font-bold text-[11px]">POO & Algoritmos</div>
                          <div className="text-[10px] text-purple-300 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> Campus Virtual
                          </div>
                        </div>
                      )}

                      {isDMESession && (
                        <div className="p-2 rounded-xl bg-emerald-500/15 border border-dashed border-emerald-500/40 text-emerald-200 space-y-1">
                          <div className="font-bold text-[11px] text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Estudio DME (1h)
                          </div>
                          <div className="text-[10px] text-emerald-300">Matrices Sinergia</div>
                        </div>
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
