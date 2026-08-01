import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { pureDB, SyllabusTopicEntity } from '@/lib/db/dexie-schema';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  GitMerge,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  FileText,
  Zap,
  BookOpen
} from 'lucide-react';
import { calculateSyllabusProgress } from '@/lib/domain/syllabus';

export const SyllabusDashboard: React.FC = () => {
  const { isLoaded, subjects, syllabusTopics } = usePureData();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [synergySynced, setSynergySynced] = useState(false);

  if (!isLoaded) {
    return <div className="p-8 text-center text-slate-400 font-mono">Cargando temarios...</div>;
  }

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  const activeTopics = syllabusTopics.filter((t) => t.subject_id === (activeSubject?.id || ''));
  const overallProgress = calculateSyllabusProgress(activeTopics as any);

  const handleUpdateMastery = async (id: string, status: SyllabusTopicEntity['mastery_status']) => {
    await pureDB.syllabusTopics.update(id, { mastery_status: status });
  };

  const handleIngestSyllabus = async () => {
    if (!rawText.trim() || !activeSubject) return;

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const newTopics: SyllabusTopicEntity[] = lines.map((line, idx) => ({
      subject_id: activeSubject.id!,
      title: line.replace(/^[-*•]\s*/, ''),
      mastery_status: 'no_iniciado',
      order_index: idx + 1,
      created_at: new Date().toISOString(),
    }));

    await pureDB.syllabusTopics.bulkAdd(newTopics);
    setRawText('');
    setIsIngestModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-purple-400" />
            Ejes Temáticos & Sinergias (Syllabus Engine)
          </h2>
          <p className="text-xs text-slate-400">
            Sincronización en tiempo real con IndexedDB. Modifica el dominio de cada tema o ingesta temarios asistidos por IA.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => setIsIngestModalOpen(true)}>
            <FileText className="w-4 h-4" /> Ingestar Syllabus con IA
          </Button>
        </div>
      </div>

      {/* Cross-Degree Synergy Matcher Banner */}
      <Card className="p-5 bg-gradient-to-r from-emerald-950/20 via-slate-900/80 to-purple-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="synergy">92% Similitud Temática Detectada</Badge>
                <span className="text-xs font-mono text-emerald-400 font-bold">Ahorro: 1.5 Horas/semana</span>
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
            {synergySynced ? 'Dominio Sincronizado' : 'Sincronizar Dominio en 1-Clic'}
          </Button>
        </div>
      </Card>

      {/* Subject Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {subjects.map((sub) => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubjectId(sub.id!)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeSubject?.id === sub.id
                ? sub.modality === 'presencial'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-heading'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-heading'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {sub.modality === 'presencial' ? '🚀 ' : '💻 '} {sub.name}
          </button>
        ))}
      </div>

      {/* Syllabus Tree Section */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100 font-heading">
              Syllabus: {activeSubject?.name}
            </h3>
            <p className="text-xs text-slate-400">
              {activeTopics.length} temas registrados • Progreso global: <strong className="text-emerald-400">{overallProgress}%</strong>
            </p>
          </div>
          <div className="w-32 bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${overallProgress}%` }}></div>
          </div>
        </div>

        <div className="space-y-2">
          {activeTopics.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono">
              No hay ejes temáticos registrados para esta asignatura. Ingesta el temario con IA usando el botón superior.
            </div>
          ) : (
            activeTopics.map((topic) => (
              <div
                key={topic.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-200">{topic.title}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={topic.mastery_status}>{topic.mastery_status}</Badge>

                  <select
                    value={topic.mastery_status}
                    onChange={(e) =>
                      handleUpdateMastery(topic.id!, e.target.value as SyllabusTopicEntity['mastery_status'])
                    }
                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500"
                  >
                    <option value="no_iniciado">No Iniciado</option>
                    <option value="en_estudio">En Estudio</option>
                    <option value="repasado">Repasado</option>
                    <option value="dominado">Dominado ✅</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* AI Syllabus Ingestion Modal */}
      <Modal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        title={`Ingestar Syllabus para ${activeSubject?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Pega aquí el plan de estudios o PDF en texto plano de la materia. La app creará los temas en IndexedDB en tiempo real.
          </p>
          <textarea
            rows={6}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
            placeholder="Unidad 1: Integración Vectorial&#10;- Tema 1.1: Campos Escalares&#10;- Tema 1.2: Teorema de Gauss"
          ></textarea>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsIngestModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleIngestSyllabus}>
              <Sparkles className="w-4 h-4" /> Ingestar Temario
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
