import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  CheckSquare,
  Plus,
  Users,
  User,
  AlertTriangle,
  CheckCircle2,
  Calculator
} from 'lucide-react';

export const DeliverablesDashboard: React.FC = () => {
  const [filterGroup, setFilterGroup] = useState<'all' | 'individual' | 'group'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-emerald-400" />
            Entregas, Evaluaciones & Exámenes Finales
          </h2>
          <p className="text-xs text-slate-400">
            Rastrea talleres, parciales, proyectos grupales e individuales y calcula la nota requerida restante.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="synergy" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4" /> Registrar Actividad
          </Button>
        </div>
      </div>

      {/* Required Grade Calculator Card */}
      <Card glowColor="aeroespacial" className="p-5 bg-gradient-to-r from-sky-950/30 via-slate-900/80 to-purple-950/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 font-heading">
                Calculadora de Nota Mínima Requerida en Entregas Restantes
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                Actualmente tienes evaluado el <strong className="text-slate-100">50% del semestre</strong> en Mecánica Orbital. Para alcanzar tu nota meta de <strong className="text-sky-300">4.50</strong>, necesitas promediar <strong className="text-emerald-400 font-mono text-sm">4.20</strong> en las entregas restantes.
              </p>
            </div>
          </div>
          <Badge variant="synergy">Margen Seguro ✅</Badge>
        </div>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterGroup('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterGroup === 'all'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas las Entregas
          </button>
          <button
            onClick={() => setFilterGroup('individual')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterGroup === 'individual'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            👤 Individuales
          </button>
          <button
            onClick={() => setFilterGroup('group')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterGroup === 'group'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            👥 Grupales
          </button>
        </div>
      </div>

      {/* Deliverable Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Deliverable Card 1 */}
        <Card className="space-y-3 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <Badge variant="aeroespacial">Aeroespacial</Badge>
            <Badge variant="danger">Alta Complejidad</Badge>
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-100 font-heading">
              Proyecto Integrador: Avionica C++
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Desarrollo de simulación de actitud de satélite en C++.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-400" /> Grupal
            </span>
            <span className="text-rose-400 font-semibold font-mono">Mañana 23:59 (30%)</span>
          </div>
        </Card>

        {/* Deliverable Card 2 */}
        <Card className="space-y-3 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <Badge variant="software">Software</Badge>
            <Badge variant="warning">Complejidad Media</Badge>
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-100 font-heading">
              Taller 2: Algoritmos Numéricos & Matrices
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Implementación de algoritmos de resolución de sistemas lineales.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-sky-400" /> Individual
            </span>
            <span className="text-amber-400 font-semibold font-mono">Jueves (15%)</span>
          </div>
        </Card>

        {/* Deliverable Card 3 */}
        <Card className="space-y-3 border-l-4 border-l-emerald-500 opacity-80">
          <div className="flex items-center justify-between">
            <Badge variant="aeroespacial">Aeroespacial</Badge>
            <Badge variant="dominado">Calificado (4.8)</Badge>
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-100 font-heading line-through">
              Parcial 1: Estructuras Aeroespaciales
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Examen presencial de análisis de esfuerzos y deformaciones.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Entregado & Calificado
            </span>
            <span className="text-slate-400 font-mono">Peso: 25%</span>
          </div>
        </Card>
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
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Parcial 2 de Dinámica Orbital"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Modalidad</label>
              <select className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500">
                <option value="individual">👤 Individual</option>
                <option value="group">👥 Grupal</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Peso % en la Nota</label>
              <input
                type="number"
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                placeholder="Ej: 25"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="synergy" onClick={() => setIsAddModalOpen(false)}>
              Guardar Actividad
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
