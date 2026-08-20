import { z } from 'zod';

export const UniversitySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, { message: 'El nombre de la universidad debe tener al menos 2 caracteres' }),
  modality: z.enum(['presencial', 'virtual', 'hibrida'], { message: 'Modalidad inválida' }),
  scale_min: z.number().min(0, { message: 'La nota mínima no puede ser negativa' }),
  scale_max: z.number().positive({ message: 'La nota máxima debe ser positiva' }),
  passing_grade: z.number(),
  color: z.string().optional(),
  has_alternating_saturdays: z.boolean().optional(),
  first_sabado_a_date: z.string().optional(),
}).refine(data => data.scale_max > data.scale_min, {
  message: 'La nota máxima debe ser estrictamente mayor a la nota mínima',
  path: ['scale_max']
}).refine(data => data.passing_grade >= data.scale_min && data.passing_grade <= data.scale_max, {
  message: 'La nota aprobatoria debe estar dentro del rango min/max de la universidad',
  path: ['passing_grade']
});

export const ProfessorSchema = z.object({
  id: z.string().optional(),
  university_id: z.string().min(1, { message: 'Debe seleccionar una universidad' }),
  name: z.string().min(2, { message: 'El nombre del profesor debe tener al menos 2 caracteres' }),
  email: z.string().email({ message: 'Correo electrónico inválido' }).optional().or(z.literal('')),
  office_hours: z.string().optional(),
  notes: z.string().optional()
});

export const SubjectSchema = z.object({
  id: z.string().optional(),
  university_id: z.string().min(1, { message: 'Debe seleccionar una universidad' }),
  professor_id: z.string().optional(),
  name: z.string().min(2, { message: 'El nombre de la asignatura es requerido' }),
  code: z.string().min(1, { message: 'El código de la asignatura es requerido' }),
  credits: z.number().int().min(1, { message: 'Los créditos deben ser de al menos 1' }).max(30, { message: 'Créditos máximos excedidos (30)' }),
  difficulty: z.number().int().min(1, { message: 'Dificultad mínima 1' }).max(5, { message: 'Dificultad máxima 5' }),
  modality: z.enum(['presencial', 'virtual', 'hibrida']).optional(),
  target_grade: z.number().optional(),
  current_grade: z.number().optional(),
  max_absences: z.number().int().min(0, { message: 'Las inasistencias permitidas no pueden ser negativas' }).optional()
});

const formatTimeStr = (t: string) => {
  if (!t) return t;
  const parts = t.trim().split(':');
  if (parts.length === 2) {
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
  }
  return t;
};

export const ScheduleSchema = z.object({
  id: z.string().optional(),
  subject_id: z.string().min(1, { message: 'Debe seleccionar una asignatura' }),
  day_of_week: z.number().int().min(1).max(7),
  start_time: z.string().transform(formatTimeStr).pipe(
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Formato de hora inicio inválido (ej: 08:00)' })
  ),
  end_time: z.string().transform(formatTimeStr).pipe(
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Formato de hora fin inválido (ej: 10:00)' })
  ),
  classroom: z.string().optional(),
  periodicity: z.enum(['semanal', 'sabado_a', 'sabado_b']).optional().default('semanal')
}).refine(data => {
  const [startH, startM] = data.start_time.split(':').map(Number);
  const [endH, endM] = data.end_time.split(':').map(Number);
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;
  return endMins > startMins;
}, {
  message: 'La hora de fin debe ser posterior a la hora de inicio',
  path: ['end_time']
});

export const DeliverableSchema = z.object({
  id: z.string().optional(),
  subject_id: z.string().min(1, { message: 'Debe seleccionar una asignatura' }),
  topic_id: z.string().optional(),
  title: z.string().min(2, { message: 'El título de la entrega es requerido' }),
  description: z.string().optional(),
  due_date: z.string().optional(),
  weight_percentage: z.number().gt(0, { message: 'El peso debe ser mayor al 0%' }).lte(100, { message: 'El peso no puede superar el 100%' }),
  grade: z.number().optional(),
  type: z.enum(['Taller', 'Proyecto', 'Parcial', 'Quiz', 'Laboratorio', 'Examen Final', 'taller', 'proyecto', 'parcial', 'quiz', 'laboratorio', 'examen_final']),
  location_modality: z.enum(['presencial', 'virtual']).optional(),
  is_group: z.boolean().optional(),
  complexity: z.enum(['Fácil', 'Medio', 'Difícil', 'facil', 'medio', 'dificil']),
  status: z.enum(['pendiente', 'entregado', 'calificado']).optional()
});

export const SyllabusTopicSchema = z.object({
  id: z.string().optional(),
  subject_id: z.string().min(1, { message: 'Debe seleccionar una asignatura' }),
  parent_id: z.string().nullable().optional(),
  title: z.string().min(2, { message: 'El título del tema es requerido' }),
  description: z.string().optional(),
  mastery_status: z.enum(['no_iniciado', 'en_estudio', 'repasado', 'dominado']).optional(),
  order_index: z.number().int().min(0).optional()
});

export const ClassSessionSchema = z.object({
  id: z.string().optional(),
  subject_id: z.string().min(1, { message: 'Debe seleccionar una asignatura' }),
  schedule_id: z.string().optional().nullable(),
  session_date: z.string().min(1, { message: 'La fecha de la sesión es requerida' }),
  title: z.string().min(2, { message: 'El título de la sesión es requerido' }),
  summary: z.string().optional().nullable(),
  notion_link: z.string().url({ message: 'URL de Notion inválida' }).optional().or(z.literal('')).nullable(),
  recording_url: z.string().url({ message: 'URL de grabación inválida' }).optional().or(z.literal('')).nullable(),
  topics_covered: z.array(z.string()).optional().default([]),
  notes: z.string().optional().nullable(),
  fireflies_transcript_id: z.string().optional().nullable(),
  transcript_text: z.string().optional().nullable(),
  ai_summary: z.string().optional().nullable(),
  ai_action_items: z.array(z.string()).optional().default([]),
  ai_questions: z.array(z.string()).optional().default([]),
  duration_minutes: z.number().int().min(0).optional().nullable(),
  session_source: z.enum(['manual', 'fireflies']).optional().default('manual'),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const StudyBlockSchema = z.object({
  id: z.string().optional(),
  subject_id: z.string().min(1),
  topic_id: z.string().optional().nullable(),
  deliverable_id: z.string().optional().nullable(),
  date: z.string().min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  type: z.enum(['study', 'review', 'exam_prep', 'project']).optional().default('study'),
  is_completed: z.boolean().optional().default(false),
  actual_minutes: z.number().int().min(0).optional().nullable(),
  source: z.enum(['algorithm', 'ai_mcp', 'manual']).optional().default('manual'),
  plan_id: z.string().optional().nullable(),
  created_at: z.string().optional()
});

export const FlashcardSchema = z.object({
  id: z.string().optional(),
  subject_id: z.string().min(1),
  topic_id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  question_type: z.enum(['open', 'mcq', 'cloze', 'true_false']).optional().default('open'),
  options: z.array(z.string()).optional(),
  due: z.string().min(1),
  stability: z.number().default(0),
  difficulty: z.number().default(0),
  elapsed_days: z.number().int().default(0),
  scheduled_days: z.number().int().default(0),
  reps: z.number().int().default(0),
  lapses: z.number().int().default(0),
  state: z.number().int().min(0).max(3).default(0),
  last_review: z.string().optional().nullable(),
  source: z.enum(['ai_generated', 'manual', 'from_transcript']).optional().default('manual'),
  created_at: z.string().optional()
});

export const AttendanceRecordSchema = z.object({
  id: z.string().optional(),
  subject_id: z.string().min(1, { message: 'Debe seleccionar una asignatura' }),
  date: z.string().min(1, { message: 'La fecha es requerida' }),
  status: z.enum(['presente', 'ausente', 'tarde', 'justificada']),
  note: z.string().optional().nullable(),
  created_at: z.string().optional()
});

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

export function validateEntity<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach(issue => {
    const key = issue.path[issue.path.length - 1] as string || 'root';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  });

  return { success: false, errors };
}
