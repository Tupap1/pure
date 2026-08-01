import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  GitMerge,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  FileText,
  Zap,
  BookOpen
} from 'lucide-react';

export const SyllabusDashboard: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<'aero' | 'software'>('aero');
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [synergySynced, setSynergySynced] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-purple-400" />
            Ejes Temáticos & Sinergias (Syllabus Engine)
          </h2>
          <p className="text-xs text-slate-400">
            Gestiona los temarios de cada carrera y sincroniza automáticamente contenidos duplicados entre ambas ingenierías.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => setIsIngestModalOpen(true)}>
            <FileText className="w-4 h-4" /> Ingestar Syllabus con IA
          </Button>
        </div>
      </div>

      {/* Cross-Degree Synergy Matcher Banner */}
      <Card glowColor="synergy" className="p-5 border-l-4 border-l-emerald-400 bg-gradient-to-r from-emerald-950/20 via-slate-900/80 to-purple-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="synergy">92% Similitud Temática Detectada</Badge>
                <span className="text-xs font-mono text-emerald-400">Ahorro: 1.5 Horas/semana</span>
              </div>
              <h4 className="text-base font-bold text-slate-100 mt-1">
                Sinergia: <span className="text-sky-300">Resolución de Matrices (Aeroespacial)</span> ↔ <span className="text-purple-300">Algoritmos Numéricos (Software)</span>
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                Al estudiar el eje temático de matrices para la clase presencial de Aeroespacial, puedes dar por cubierto el 80% del taller virtual de Software.
              </p>
            </div>
          </div>
          <Button
            variant={synergySynced ? 'synergy' : 'aeroespacial'}
            onClick={() => setSynergySynced(true)}
            disabled={synergySynced}
          >
            <CheckCircle2 className="w-4 h-4" />
            {synergySynced ? 'Dominio Sincronizado en Ambas' : 'Sincronizar Dominio en 1-Clic'}
          </Button>
        </div>
      </Card>

      {/* Subject Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setSelectedSubject('aero')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            selectedSubject === 'aero'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 glow-aeroespacial'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          🚀 Ing. Aeroespacial: Cálculo & Mecánica
        </button>
        <button
          onClick={() => setSelectedSubject('software')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            selectedSubject === 'software'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 glow-software'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          💻 Ing. Software: Algoritmos & POO
        </button>
      </div>

      {/* Syllabus Interactive Tree View */}
      <div className="space-y-4">
        {/* Unit 1 */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <ChevronDown className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-base font-bold text-slate-100 font-heading">
                  Unidad 1: Álgebra Lineal & Operaciones Matriciales
                </h3>
                <p className="text-xs text-slate-400">4 Temas • 100% Dominado</p>
              </div>
            </div>
            <Badge variant="dominado">Dominado</Badge>
          </div>

          {/* Leaf Topics */}
          <div className="pl-8 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700">
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-200">Tema 1.1: Multiplicación de Matrices y Determinantes</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="synergy">Sinergia Activa</Badge>
                <Badge variant="dominado">Dominado</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700">
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-200">Tema 1.2: Inversa de Matrices y Eliminación Gaussiana</span>
              </div>
              <Badge variant="dominado">Dominado</Badge>
            </div>
          </div>
        </Card>

        {/* Unit 2 */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <ChevronRight className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-slate-100 font-heading">
                  Unidad 2: Ecuaciones Diferenciales Ordinarias (EDO)
                </h3>
                <p className="text-xs text-slate-400">3 Temas • 33% En Estudio</p>
              </div>
            </div>
            <Badge variant="en_estudio">En Estudio</Badge>
          </div>
        </Card>
      </div>

      {/* AI Syllabus Ingestion Modal */}
      <Modal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        title="Ingestar Plan de Estudios con IA (MCP Agent)"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Pega aquí el plan de estudios o PDF en texto plano de la materia. El servidor MCP lo convertirá automáticamente en el árbol de ejes temáticos.
          </p>
          <textarea
            rows={6}
            className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
            placeholder="Ejemplo: Unidad 1: Métodos de Integración. Tema 1.1: Integración por Partes. Tema 1.2: Sustitución Trigonométrica..."
          ></textarea>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsIngestModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={() => setIsIngestModalOpen(false)}>
              <Sparkles className="w-4 h-4" /> Parsear e Ingestar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
