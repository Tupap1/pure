import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Building2,
  UserCheck,
  BookMarked,
  Plus,
  Mail,
  Clock,
  Edit2,
  GraduationCap
} from 'lucide-react';

export const ConfigDashboard: React.FC = () => {
  const [isAddUniOpen, setIsAddUniOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-sky-400" />
            Universidades, Profesores & Asignaturas (CRUD Directory)
          </h2>
          <p className="text-xs text-slate-400">
            Administra las instituciones, docentes, escalas de notas y parámetros de las materias de ambas carreras.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="aeroespacial" onClick={() => setIsAddUniOpen(true)}>
            <Plus className="w-4 h-4" /> Agregar Universidad
          </Button>
        </div>
      </div>

      {/* Universities CRUD Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* University 1 Card */}
        <Card glowColor="aeroespacial" className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/30">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 font-heading">
                  Universidad 1 — Ing. Aeroespacial
                </h3>
                <Badge variant="aeroespacial" className="mt-1">Modalidad Presencial</Badge>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/60 text-center text-xs font-mono">
            <div>
              <div className="text-slate-400">Escala Min</div>
              <div className="text-slate-100 font-bold mt-0.5">0.0</div>
            </div>
            <div>
              <div className="text-slate-400">Escala Max</div>
              <div className="text-slate-100 font-bold mt-0.5">5.0</div>
            </div>
            <div>
              <div className="text-slate-400">Aprobación</div>
              <div className="text-emerald-400 font-bold mt-0.5">3.0</div>
            </div>
          </div>
        </Card>

        {/* University 2 Card */}
        <Card glowColor="software" className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 font-heading">
                  Universidad 2 — Ing. de Software
                </h3>
                <Badge variant="software" className="mt-1">Modalidad Virtual A Distancia</Badge>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/60 text-center text-xs font-mono">
            <div>
              <div className="text-slate-400">Escala Min</div>
              <div className="text-slate-100 font-bold mt-0.5">0.0</div>
            </div>
            <div>
              <div className="text-slate-400">Escala Max</div>
              <div className="text-slate-100 font-bold mt-0.5">5.0</div>
            </div>
            <div>
              <div className="text-slate-400">Aprobación</div>
              <div className="text-emerald-400 font-bold mt-0.5">3.0</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Professors Directory Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-400" />
            Directorio de Profesores Asignados
          </h3>
          <Button variant="primary" size="sm">
            <Plus className="w-3.5 h-3.5" /> Registrar Profesor
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold font-heading">
                DR
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">Dr. Roberto Ramírez</h4>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3" /> rramirez@aero.edu • <Clock className="w-3 h-3 ml-1" /> Mar 14:00 (Tutoría)
                </p>
                <span className="text-[11px] text-sky-400 mt-1 block">
                  Materia: Cálculo Vectorial & Mecánica Orbital
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold font-heading">
                ING
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">Ing. Sofía Martínez</h4>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3" /> smartinez@software.edu • Virtual
                </p>
                <span className="text-[11px] text-purple-400 mt-1 block">
                  Materia: Algoritmos Numéricos & POO C++
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Add University Modal */}
      <Modal
        isOpen={isAddUniOpen}
        onClose={() => setIsAddUniOpen(false)}
        title="Configurar Nueva Universidad"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Nombre de la Institución</label>
            <input
              type="text"
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Universidad Nacional de Colombia"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Escala Min</label>
              <input
                type="number"
                defaultValue={0}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Escala Max</label>
              <input
                type="number"
                defaultValue={5}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Aprobación</label>
              <input
                type="number"
                defaultValue={3}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddUniOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={() => setIsAddUniOpen(false)}>
              Guardar Universidad
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
