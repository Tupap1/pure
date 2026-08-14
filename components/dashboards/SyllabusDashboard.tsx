import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { SyllabusTopicEntity } from '@/lib/db/dexie-schema';
import { saveSyllabusTopic, deleteSyllabusTopic } from '@/lib/db/repository';
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
  BookOpen,
  Edit3,
  Trash2
} from 'lucide-react';
import { calculateSyllabusProgress, findSynergiesBetweenTopics } from '@/lib/domain/syllabus';
import { dedupeByIdentity, subjectIdentity } from '@/lib/domain/entity-identity';

const MASTERY_SELECT_STYLES: Record<SyllabusTopicEntity['mastery_status'], string> = {
  no_iniciado: 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 focus:ring-slate-400',
  en_estudio: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 focus:ring-amber-400',
  repasado: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 focus:ring-cyan-400',
  dominado: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 focus:ring-emerald-400',
};

export const SyllabusDashboard: React.FC = () => {
  const { isLoaded, subjects, syllabusTopics } = usePureData();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<SyllabusTopicEntity | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMastery, setEditMastery] = useState<SyllabusTopicEntity['mastery_status']>('no_iniciado');

  const [rawText, setRawText] = useState('');
  const [synergySynced, setSynergySynced] = useState(false);

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse pb-16" aria-label="Cargando temarios" role="status">
        <div className="h-14 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="h-10 w-2/3 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  // Una materia por identidad lógica. Si el caché local todavía arrastra versiones
  // obsoletas de una re-ingesta (mismo nombre, `id` distinto), gana la que tiene temario.
  const topicCountBySubject = syllabusTopics.reduce<Record<string, number>>((acc, t) => {
    acc[t.subject_id] = (acc[t.subject_id] || 0) + 1;
    return acc;
  }, {});
  const uniqueSubjects = dedupeByIdentity(
    subjects,
    subjectIdentity,
    (s) => topicCountBySubject[s.id || ''] || 0
  );

  const activeSubject = uniqueSubjects.find((s) => s.id === selectedSubjectId) || uniqueSubjects[0];
  const activeTopics = syllabusTopics.filter((t) => t.subject_id === (activeSubject?.id || ''));
  const overallProgress = calculateSyllabusProgress(activeTopics as any);

  const synergies = findSynergiesBetweenTopics(syllabusTopics as any, syllabusTopics as any);

  const ingestLineCount = rawText.split('\n').map((l) => l.trim()).filter(Boolean).length;

  const handleUpdateMastery = async (id: string, status: SyllabusTopicEntity['mastery_status']) => {
    const topic = syllabusTopics.find((t) => t.id === id);
    if (topic) {
      await saveSyllabusTopic({
        ...topic,
        mastery_status: status,
      });
    }
  };

  const openEditTopic = (topic: SyllabusTopicEntity) => {
    setEditingTopic(topic);
    setEditTitle(topic.title);
    setEditMastery(topic.mastery_status);
  };

  const handleSaveTopicEdit = async () => {
    if (!editingTopic || !editingTopic.id) return;
    await saveSyllabusTopic({
      ...editingTopic,
      title: editTitle,
      mastery_status: editMastery,
    });
    setEditingTopic(null);
  };

  const handleDeleteTopic = async (id: string) => {
    await deleteSyllabusTopic(id);
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

    for (const topic of newTopics) {
      await saveSyllabusTopic(topic);
    }
    setRawText('');
    setIsIngestModalOpen(false);
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500 transition-colors';

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            Ejes Temáticos & Sinergias (Syllabus Engine)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Edición de ejes temáticos y sincronización de equivalencias entre carreras.
          </p>
        </div>
        {activeSubject && (
          <Button
            variant="primary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setIsIngestModalOpen(true)}
          >
            <FileText className="w-4 h-4" /> Ingestar Syllabus
          </Button>
        )}
      </div>

      {uniqueSubjects.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-heading font-bold tracking-tight text-slate-800 dark:text-slate-200">No hay materias configuradas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Registra primero tus asignaturas en la pestaña <strong>Ajustes</strong> para comenzar a cargar temarios y detectar sinergias.
          </p>
        </Card>
      ) : (
        <>
          {/* Real Synergy Banner (Only when synergies exist) */}
          {synergies.length > 0 ? (
            <Card className="p-5 border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="synergy">Sinergia Temática Detectada</Badge>
                      <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                        Similitud: {Math.round(synergies[0].similarityScore * 100)}%
                      </span>
                    </div>
                    <h4 className="text-sm font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
                      Sinergia entre {synergies[0].topicA.title} y {synergies[0].topicB.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Dominar este tema en una materia permite avanzar en el temario equivalente.
                    </p>
                  </div>
                </div>
                <Button
                  variant={synergySynced ? 'synergy' : 'aeroespacial'}
                  size="sm"
                  className="w-full md:w-auto shrink-0"
                  onClick={() => setSynergySynced(true)}
                  disabled={synergySynced}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {synergySynced ? 'Dominio Sincronizado' : 'Sincronizar Dominio'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span>Sinergias Temáticas: Sin equivalencias duplicadas detectadas en este momento.</span>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">{syllabusTopics.length} Temas Totales</span>
            </Card>
          )}

          {/* Subject Filter Tabs */}
          <div
            className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto snap-x snap-mandatory scroll-px-1 -mx-1 px-1"
            role="tablist"
            aria-label="Seleccionar materia"
          >
            {uniqueSubjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSubjectId(s.id || '')}
                className={`snap-start px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  (s.id === activeSubject?.id) 
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Syllabus Tree Section */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="min-w-0">
                <h3 className="text-base font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  Syllabus: {activeSubject?.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeTopics.length} temas registrados • Progreso global: <strong className="text-emerald-600 dark:text-emerald-400">{overallProgress}%</strong>
                </p>
              </div>
              <div className="w-full sm:w-32 shrink-0 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${overallProgress}%` }}></div>
              </div>
            </div>

            <div className="space-y-2">
              {activeTopics.length === 0 ? (
                <div className="p-8 text-center text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-lg space-y-3">
                  <p className="text-slate-500 dark:text-slate-400">
                    No hay ejes temáticos registrados para esta asignatura.
                  </p>
                  <Button variant="aeroespacial" size="sm" onClick={() => setIsIngestModalOpen(true)}>
                    <FileText className="w-4 h-4" /> Ingestar Syllabus
                  </Button>
                </div>
              ) : (
                activeTopics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 leading-snug">{topic.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:shrink-0">
                      <select
                        value={topic.mastery_status}
                        onChange={(e) =>
                          handleUpdateMastery(topic.id!, e.target.value as SyllabusTopicEntity['mastery_status'])
                        }
                        aria-label={`Estado de dominio de ${topic.title}`}
                        className={`flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px] px-3 rounded-lg border text-[11px] font-mono font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-900 transition-colors ${MASTERY_SELECT_STYLES[topic.mastery_status]}`}
                      >
                        <option value="no_iniciado">No Iniciado</option>
                        <option value="en_estudio">En Estudio</option>
                        <option value="repasado">Repasado</option>
                        <option value="dominado">Dominado ✅</option>
                      </select>

                      <button
                        onClick={() => openEditTopic(topic)}
                        aria-label={`Editar ${topic.title}`}
                        title="Editar Tema"
                        className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-sky-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteTopic(topic.id!)}
                        aria-label={`Eliminar ${topic.title}`}
                        title="Eliminar Tema"
                        className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}

      {/* Edit Topic Modal */}
      <Modal
        isOpen={editingTopic !== null}
        onClose={() => setEditingTopic(null)}
        title="Editar Eje Temático"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Título del Tema</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Estado de Dominio</label>
            <select
              value={editMastery}
              onChange={(e) => setEditMastery(e.target.value as any)}
              className={inputClass}
            >
              <option value="no_iniciado">No Iniciado</option>
              <option value="en_estudio">En Estudio</option>
              <option value="repasado">Repasado</option>
              <option value="dominado">Dominado ✅</option>
            </select>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setEditingTopic(null)}>
              Cancelar
            </Button>
            <Button
              variant="aeroespacial"
              className="w-full sm:w-auto"
              onClick={handleSaveTopicEdit}
              disabled={!editTitle.trim()}
            >
              Guardar Cambios
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI Syllabus Ingestion Modal */}
      <Modal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        title={`Ingestar Syllabus para ${activeSubject?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Pega aquí el plan de estudios o temario en texto plano de la materia. Cada línea se registra como un tema.
          </p>
          <textarea
            rows={6}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
            placeholder="Unidad 1: Integración Vectorial&#10;- Tema 1.1: Campos Escalares&#10;- Tema 1.2: Teorema de Gauss"
          ></textarea>
          {ingestLineCount > 0 && (
            <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {ingestLineCount} {ingestLineCount === 1 ? 'tema detectado' : 'temas detectados'}
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setIsIngestModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="aeroespacial"
              className="w-full sm:w-auto"
              onClick={handleIngestSyllabus}
              disabled={ingestLineCount === 0}
            >
              <Sparkles className="w-4 h-4" /> Ingestar Temario
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
