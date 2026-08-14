import React, { useState, useEffect } from 'react';
import { ClassSessionEntity, SubjectEntity, ScheduleEntity } from '@/lib/db/dexie-schema';
import { ClassSessionSchema, validateEntity } from '@/lib/validations/schemas';
import { Button } from './Button';
import { Video, Link as LinkIcon, FileText, Plus, X, Tag } from 'lucide-react';

interface ClassSessionFormProps {
  initialData?: ClassSessionEntity | null;
  subjects: SubjectEntity[];
  schedules?: ScheduleEntity[];
  onSave: (data: ClassSessionEntity) => Promise<void>;
  onCancel: () => void;
}

export const ClassSessionForm: React.FC<ClassSessionFormProps> = ({
  initialData,
  subjects,
  schedules = [],
  onSave,
  onCancel,
}) => {
  const [subjectId, setSubjectId] = useState(initialData?.subject_id || subjects[0]?.id || '');
  const [scheduleId, setScheduleId] = useState(initialData?.schedule_id || '');
  const [sessionDate, setSessionDate] = useState(
    initialData?.session_date
      ? new Date(initialData.session_date).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [title, setTitle] = useState(initialData?.title || '');
  const [summary, setSummary] = useState(initialData?.summary || '');
  const [notionLink, setNotionLink] = useState(initialData?.notion_link || '');
  const [recordingUrl, setRecordingUrl] = useState(initialData?.recording_url || '');
  const [topicsCovered, setTopicsCovered] = useState<string[]>(initialData?.topics_covered || []);
  const [topicInput, setTopicInput] = useState('');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!subjectId && subjects.length > 0) {
      setSubjectId(subjects[0].id || '');
    }
  }, [subjects, subjectId]);

  const filteredSchedules = schedules.filter((s) => s.subject_id === subjectId);

  const handleAddTopic = () => {
    const trimmed = topicInput.trim();
    if (trimmed && !topicsCovered.includes(trimmed)) {
      setTopicsCovered([...topicsCovered, trimmed]);
      setTopicInput('');
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setTopicsCovered(topicsCovered.filter((t) => t !== topic));
  };

  const handleKeyDownTopic = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTopic();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData: ClassSessionEntity = {
      id: initialData?.id,
      subject_id: subjectId,
      schedule_id: scheduleId || undefined,
      session_date: sessionDate ? new Date(sessionDate).toISOString() : new Date().toISOString(),
      title,
      summary: summary.trim() || null,
      notion_link: notionLink.trim() || null,
      recording_url: recordingUrl.trim() || null,
      topics_covered: topicsCovered,
      notes: notes.trim() || null,
      created_at: initialData?.created_at,
    };

    const validation = validateEntity(ClassSessionSchema, formData);
    if (!validation.success) {
      setErrors(validation.errors);
      setIsSubmitting(false);
      return;
    }

    setErrors({});
    try {
      await onSave(formData);
    } catch (err) {
      console.error('Error al guardar la sesión de clase:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Subject */}
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Asignatura <span className="text-rose-500">*</span>
          </label>
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setScheduleId('');
            }}
            className={inputClass}
          >
            <option value="">Selecciona una asignatura</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code || 'Sin código'})
              </option>
            ))}
          </select>
          {errors.subject_id && <p className="text-xs text-rose-500 font-medium mt-1">{errors.subject_id}</p>}
        </div>

        {/* Schedule Optional */}
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Horario Asociado (Opcional)
          </label>
          <select
            value={scheduleId}
            onChange={(e) => setScheduleId(e.target.value)}
            className={inputClass}
            disabled={!subjectId}
          >
            <option value="">Ninguno / General</option>
            {filteredSchedules.map((sc) => {
              const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
              return (
                <option key={sc.id} value={sc.id}>
                  {days[sc.day_of_week]} ({sc.start_time} - {sc.end_time})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Date & Title */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Fecha y Hora <span className="text-rose-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className={inputClass}
          />
          {errors.session_date && <p className="text-xs text-rose-500 font-medium mt-1">{errors.session_date}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Título de la Sesión / Tema Central <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Clase 04 - Ecuaciones Diferenciales Ordinarias"
            className={inputClass}
          />
          {errors.title && <p className="text-xs text-rose-500 font-medium mt-1">{errors.title}</p>}
        </div>
      </div>

      {/* Notion Link & Recording URL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
            <LinkIcon className="w-3.5 h-3.5 text-indigo-500" /> URL de Notion
          </label>
          <input
            type="url"
            value={notionLink}
            onChange={(e) => setNotionLink(e.target.value)}
            placeholder="https://notion.so/..."
            className={inputClass}
          />
          {errors.notion_link && <p className="text-xs text-rose-500 font-medium mt-1">{errors.notion_link}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
            <Video className="w-3.5 h-3.5 text-rose-500" /> URL de Grabación (YouTube, Loom, etc)
          </label>
          <input
            type="url"
            value={recordingUrl}
            onChange={(e) => setRecordingUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... o Loom URL"
            className={inputClass}
          />
          {errors.recording_url && <p className="text-xs text-rose-500 font-medium mt-1">{errors.recording_url}</p>}
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-cyan-500" /> Resumen de la Clase
        </label>
        <textarea
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Escribe un resumen sintético de lo aprendido en esta clase..."
          className={inputClass}
        />
      </div>

      {/* Topics Covered */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-purple-500" /> Temas Tratados
        </label>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={handleKeyDownTopic}
            placeholder="Agregar tema y presionar Enter..."
            className={inputClass}
          />
          <Button type="button" variant="ghost" size="sm" onClick={handleAddTopic} className="shrink-0">
            <Plus className="w-4 h-4" /> Añadir
          </Button>
        </div>
        {topicsCovered.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {topicsCovered.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-medium"
              >
                {topic}
                <button
                  type="button"
                  onClick={() => handleRemoveTopic(topic)}
                  className="hover:text-rose-500 transition-colors ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
          Notas Adicionales / Tareas Derivadas
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Recordatorios para el examen, lecturas pendientes..."
          className={inputClass}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="aeroespacial" className="w-full sm:w-auto" disabled={isSubmitting}>
          {initialData ? 'Guardar Cambios' : 'Registrar Sesión'}
        </Button>
      </div>
    </form>
  );
};
