import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { pureDB, SyllabusTopicEntity } from '@/lib/db/dexie-schema';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  GitMerge,
  CheckCircle2,
  Sparkles,
  FileText,
  Zap,
  BookOpen
} from 'lucide-react';
import { calculateSyllabusProgress, findSynergiesBetweenTopics } from '@/lib/domain/syllabus';

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

  const synergies = findSynergiesBetweenTopics(syllabusTopics as any, syllabusTopics as any);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-indigo-400" />
            Ejes Temáticos & Sinergias (Syllabus Engine)
          </h2>
          <p className="text-xs text-slate-400">
            Sincronización de temarios entre materias y detector de equivalencias temáticas.
          </p>
        </div>
        {activeSubject && (
          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={() => setIsIngestModalOpen(true)}>
              <FileText className="w-4 h-4" /> Ingestar Syllabus
            </Button>
          </div>
        )}
      </div>

      {subjects.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-800 bg-slate-950/40">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">No hay materias configuradas</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Registra primero tus asignaturas en la pestaña <strong>Configuración & CRUD</strong> para comenzar a cargar temarios y detectar sinergias.
          </p>
        </Card>
      ) : (
        <>
          {/* Real Synergy Banner (Only when synergies exist) */}
          {synergies.length > 0 ? (
            <Card className="p-5 border border-emerald-500/30 bg-emerald-950/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="synergy">Sinergia Temática Detectada</Badge>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        Similitud: {Math.round(synergies[0].similarityScore * 100)}%
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 mt-1">
                      Sinergia entre {synergies[0].topicA.title} y {synergies[0].topicB.title}
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Dominar este tema en una materia permite avanzar en el temario equivalente.
                    </p>
                  </div>
                </div>
                <Button
                  variant={synergySynced ? 'synergy' : 'aeroespacial'}
                  size="sm"
                  onClick={() => setSynergySynced(true)}
                  disabled={synergySynced}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {synergySynced ? 'Dominio Sincronizado' : 'Sincronizar Dominio'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-4 border border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
              <span>Sinergias Temáticas: Sin equivalencias duplicadas detectadas en este momento.</span>
              <span className="font-mono text-[11px] text-slate-500">{syllabusTopics.length} Temas Totales</span>
            </Card>
          )}

          {/* Subject Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
            {subjects.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubjectId(sub.id!)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeSubject?.id === sub.id
                    ? 'bg-sky-600 text-slate-50 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {sub.modality === 'presencial' ? '🏛️ ' : '💻 '} {sub.name}
              </button>
            ))}
          </div>

          {/* Syllabus Tree Section */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Syllabus: {activeSubject?.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {activeTopics.length} temas registrados • Progreso global: <strong className="text-emerald-400">{overallProgress}%</strong>
                </p>
              </div>
              <div className="w-32 bg-slate-900 border border-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${overallProgress}%` }}></div>
              </div>
            </div>

            <div className="space-y-2">
              {activeTopics.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-mono border border-dashed border-slate-800 rounded-lg">
                  No hay ejes temáticos registrados para esta asignatura. Ingesta el temario con el botón superior.
                </div>
              ) : (
                activeTopics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="font-medium text-slate-200">{topic.title}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={topic.mastery_status}>{topic.mastery_status}</Badge>

                      <select
                        value={topic.mastery_status}
                        onChange={(e) =>
                          handleUpdateMastery(topic.id!, e.target.value as SyllabusTopicEntity['mastery_status'])
                        }
                        className="p-1 rounded bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500"
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
        </>
      )}

      {/* AI Syllabus Ingestion Modal */}
      <Modal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        title={`Ingestar Syllabus para ${activeSubject?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Pega aquí el plan de estudios o temario en texto plano de la materia.
          </p>
          <textarea
            rows={6}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
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
