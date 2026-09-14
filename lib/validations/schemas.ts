import { z } from 'zod';
import { mondayOf } from '../execution/time';
import {
  TANDA_MINUTES_MIN,
  TANDA_MINUTES_MAX,
  CUE_TEXT_MIN,
  CUE_TEXT_MAX,
  ACTION_TEXT_MIN,
  ACTION_TEXT_MAX,
  INTERRUPT_REASON_MIN,
  INTERRUPT_REASON_MAX,
  USER_NOTE_MAX,
} from '../execution/constants';

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
  // El `type` se normaliza a minúscula canónica antes de validarse: acepta entrada
  // case-insensitive (y "Examen Final" con espacio) y la reduce a
  // taller|proyecto|parcial|quiz|laboratorio|examen_final. Así el planificador de
  // estudio —que lee el `type` en minúscula (lib/algorithms/study-planner.ts)— vuelve a
  // clasificar toda entrega creada por UI, que antes quedaba capitalizada y se ignoraba.
  type: z.string()
    .transform((t) => t.trim().toLowerCase().replace(/\s+/g, '_'))
    .pipe(
      z.enum(['taller', 'proyecto', 'parcial', 'quiz', 'laboratorio', 'examen_final'], {
        message: 'Tipo de entrega inválido (taller, proyecto, parcial, quiz, laboratorio, examen_final)',
      })
    ),
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

// =============================================================================
// Módulo de Ejecución
// =============================================================================
//
// Esquemas Zod estrictos (`.strict()`) para las entidades solo-Postgres del módulo (data-model.md).
// Las reglas que exigen consultar la base de datos (TANDA_EN_CURSO, HABITO_INACTIVO, DIA_CERRADO,
// SEMANA_EN_CURSO, etc.) NO viven aquí: se resuelven en los servicios de lib/execution/*, que sí
// tienen acceso al repositorio. Aquí solo se valida la FORMA del dato y las reglas que se pueden
// decidir sin mirar la base (rangos, campos condicionales, y si `starts_on` cae en lunes).

/** Códigos de error de negocio del módulo (contracts/mcp-tools.md). */
export type ExecutionErrorCode =
  | 'DATOS_INVALIDOS'
  | 'SOBRE_ESPECIFICACION'
  | 'NO_ENCONTRADO'
  | 'TANDA_EN_CURSO'
  | 'TANDA_NO_TERMINADA'
  | 'RAZON_REQUERIDA'
  | 'DIA_CERRADO'
  | 'FECHA_FUTURA'
  | 'HABITO_INACTIVO'
  | 'NO_ES_LUNES'
  | 'PROGRAMA_EXISTENTE'
  | 'SEMANA_EN_CURSO'
  | 'CONSENTIMIENTO_REQUERIDO'
  | 'SIN_PARTNER'
  | 'REPORTE_NO_CONGELADO'
  | 'VENTANA_CERRADA'
  | 'YA_ENVIADO'
  | 'PARTIR_TAREA'
  | 'LIMITE_FRICCION';

export interface ExecutionErrorResult {
  status: 'error';
  code: ExecutionErrorCode;
  message: string;
}

/**
 * Contrato de respuesta compartido por todos los servicios y handlers del módulo
 * (contracts/mcp-tools.md). Vive aquí, junto a `ExecutionErrorCode`, para que tanto
 * lib/execution/handlers.ts como los servicios que consume (program.ts, tandas.ts, ...) lo
 * importen sin depender uno del otro.
 */
export interface ExecutionSuccess<T = unknown> {
  status: 'success';
  message?: string;
  data?: T;
}

export type ExecutionResult<T = unknown> = ExecutionSuccess<T> | ExecutionErrorResult;

/**
 * Traduce un ZodError a `{ status: 'error', code, message }`. Un `superRefine` puede fijar el
 * código exacto agregando `params: { code: '...' }` a su `issue` (así es como `starts_on` no
 * lunes se convierte en `NO_ES_LUNES`); si ningún issue trae un código explícito y hay claves no
 * reconocidas (`.strict()`), se usa `opts.unrecognizedKeysCode` (por defecto `DATOS_INVALIDOS`;
 * el disparador pasa `SOBRE_ESPECIFICACION`, porque ahí una clave extra es sobre-especificación,
 * no un error de forma cualquiera). Cualquier otro caso cae en `DATOS_INVALIDOS` genérico.
 */
export function zodErrorToExecutionResult(
  error: z.ZodError,
  opts?: { unrecognizedKeysCode?: ExecutionErrorCode }
): ExecutionErrorResult {
  for (const issue of error.issues) {
    const customCode = (issue as { params?: { code?: ExecutionErrorCode } }).params?.code;
    if (customCode) {
      return { status: 'error', code: customCode, message: issue.message };
    }
  }

  const hasUnrecognizedKeys = error.issues.some((issue) => issue.code === 'unrecognized_keys');
  if (hasUnrecognizedKeys) {
    return {
      status: 'error',
      code: opts?.unrecognizedKeysCode ?? 'DATOS_INVALIDOS',
      message: error.issues.map((issue) => issue.message).join('; '),
    };
  }

  return {
    status: 'error',
    code: 'DATOS_INVALIDOS',
    message: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`.replace(/^: /, '')).join('; '),
  };
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// --- Programa (program_weeks, fundacional) ---

export const ExecutionWeekInputSchema = z
  .object({
    min_tandas_dia: z.number().int().min(0).max(12),
    phase: z.enum(['arranque', 'consolidacion', 'automatizacion']).optional().default('arranque'),
  })
  .strict();

export const ExecutionProgramInitSchema = z
  .object({
    starts_on: z.string().regex(DATE_KEY_RE, { message: 'starts_on debe ser una fecha YYYY-MM-DD' }),
    weeks: z.array(ExecutionWeekInputSchema).min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.starts_on !== mondayOf(data.starts_on)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['starts_on'],
        message: 'starts_on debe ser un lunes',
        params: { code: 'NO_ES_LUNES' satisfies ExecutionErrorCode },
      });
    }
  });

export const ExecutionProgramUpdateWeekSchema = z
  .object({
    id: z.string().min(1),
    min_tandas_dia: z.number().int().min(0).max(12).optional(),
    phase: z.enum(['arranque', 'consolidacion', 'automatizacion']).optional(),
  })
  .strict();

// --- Hábito (habits, daily_checks) ---

export const HabitUpsertSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    started_on: z.string().regex(DATE_KEY_RE),
    days_of_week: z.array(z.number().int().min(1).max(7)).min(1).optional().nullable(),
    target_days: z.number().int().min(18).max(254).optional(),
  })
  .strict();

export const HabitRetireSchema = z
  .object({
    id: z.string().min(1),
    retired_on: z.string().regex(DATE_KEY_RE),
  })
  .strict();

export const DailyCheckSetSchema = z
  .object({
    habit_id: z.string().min(1),
    status: z.enum(['cumplido', 'fallado', 'na']),
    date: z.string().regex(DATE_KEY_RE).optional(),
    value: z.number().optional(),
    note: z.string().max(200).optional(),
  })
  .strict();

export const DailyChecksReadSchema = z
  .object({
    from: z.string().regex(DATE_KEY_RE).optional(),
    to: z.string().regex(DATE_KEY_RE).optional(),
  })
  .strict();

// --- Disparador (routine_slots, slot_outcomes, plan_rehearsals) ---

export const RoutineSlotSchema = z
  .object({
    id: z.string().min(1).optional(),
    days_of_week: z.array(z.number().int().min(1).max(7)).min(1),
    cue_kind: z.enum(['hora', 'tras_clase', 'tras_habito', 'lugar']),
    cue_text: z.string().min(CUE_TEXT_MIN).max(CUE_TEXT_MAX),
    action_text: z.string().min(ACTION_TEXT_MIN).max(ACTION_TEXT_MAX),
    anchor_time: z.string().regex(TIME_HHMM_RE).optional(),
    schedule_id: z.string().optional(),
    subject_id: z.string().optional(),
    habit_id: z.string().optional(),
    kind: z.enum(['estudio', 'habito', 'otro']).optional().default('estudio'),
    periodicity: z.enum(['semanal', 'sabado_a', 'sabado_b']).optional().default('semanal'),
    is_active: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.cue_kind !== 'tras_clase' && !data.anchor_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['anchor_time'],
        message: 'anchor_time es obligatorio salvo en disparadores tras_clase',
      });
    }
    if (data.cue_kind === 'tras_clase' && !data.schedule_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schedule_id'],
        message: 'un disparador tras_clase exige schedule_id (hereda día y alternancia del horario)',
      });
    }
    if (data.kind === 'habito' && !data.habit_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['habit_id'],
        message: "kind='habito' exige habit_id",
      });
    }
    if (data.periodicity !== 'semanal') {
      const esSoloSabado = data.days_of_week.length === 1 && data.days_of_week[0] === 6;
      if (!esSoloSabado) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periodicity'],
          message: 'una periodicity distinta de semanal solo aplica con days_of_week=[6]',
        });
      }
    }
  });

export const RoutineSlotReadSchema = z
  .object({
    id: z.string().min(1).optional(),
  })
  .strict();

export const RoutineSlotDeleteSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export const RoutineSlotRespondSchema = z
  .object({
    routine_slot_id: z.string().min(1),
    outcome: z.enum(['hecho', 'no']),
  })
  .strict();

export const RoutineSlotRehearseSchema = z
  .object({
    routine_slot_id: z.string().min(1),
    program_week_id: z.string().min(1).optional(),
  })
  .strict();

// --- Tanda (tandas) ---
// Ninguna acción admite `started_at` ni `ended_at`: los fija siempre el reloj del servidor
// (FR-002). Al ser esquemas `.strict()`, cualquiera de esas dos claves cae en `unrecognized_keys`
// y, por defecto, se traduce a DATOS_INVALIDOS.

export const TandaStartSchema = z
  .object({
    subject_id: z.string().optional(),
    topic_id: z.string().optional(),
    deliverable_id: z.string().optional(),
    task_id: z.string().optional(),
    routine_slot_id: z.string().optional(),
    planned_minutes: z.number().int().min(TANDA_MINUTES_MIN).max(TANDA_MINUTES_MAX).optional(),
  })
  .strict();

export const TandaFinishSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

// interrupt_reason vacío o solo espacios → RAZON_REQUERIDA (US1-AS5), no el DATOS_INVALIDOS
// genérico que daría el .min() de abajo por sí solo: el superRefine se evalúa igual aunque el
// .min() ya haya marcado su propio issue (Zod acumula ambos), y zodErrorToExecutionResult
// recorre todos los issues hasta encontrar uno con `params.code`, así que este gana.
export const TandaInterruptSchema = z
  .object({
    id: z.string().min(1),
    interrupt_reason: z.string().min(INTERRUPT_REASON_MIN).max(INTERRUPT_REASON_MAX),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.interrupt_reason || !data.interrupt_reason.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['interrupt_reason'],
        message: 'interrupt_reason es obligatorio para interrumpir una tanda (una razón de una línea).',
        params: { code: 'RAZON_REQUERIDA' satisfies ExecutionErrorCode },
      });
    }
  });

export const TandaReadSchema = z
  .object({
    from: z.string().regex(DATE_KEY_RE).optional(),
    to: z.string().regex(DATE_KEY_RE).optional(),
    subject_id: z.string().optional(),
  })
  .strict();

// Update solo toca campos de clasificación: nunca tiempos (`started_at`/`ended_at`/`local_date`).
export const TandaUpdateSchema = z
  .object({
    id: z.string().min(1),
    subject_id: z.string().optional(),
    topic_id: z.string().optional(),
    deliverable_id: z.string().optional(),
    task_id: z.string().optional(),
    mode: z.string().optional(),
    interrupt_reason: z.string().min(INTERRUPT_REASON_MIN).max(INTERRUPT_REASON_MAX).optional(),
  })
  .strict();

// --- Destinatario del reporte (accountability_partners) ---

export const AccountabilityPartnerSetSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    consented_at: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.consented_at || !data.consented_at.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consented_at'],
        message: 'consented_at es obligatorio para registrar un destinatario',
        params: { code: 'CONSENTIMIENTO_REQUERIDO' satisfies ExecutionErrorCode },
      });
    }
  });

// --- Reporte semanal (weekly_reports, US6) ---

export const WeeklyReportNoteSchema = z
  .object({
    program_week_id: z.string().min(1),
    note: z.string().max(USER_NOTE_MAX),
  })
  .strict();

export const WeeklyReportPreviewSchema = z
  .object({
    program_week_id: z.string().optional(),
  })
  .strict();

export const WeeklyReportSendSchema = z
  .object({
    program_week_id: z.string().min(1),
  })
  .strict();

export const WeeklyReportReadSchema = z
  .object({
    program_week_id: z.string().optional(),
  })
  .strict();

export const ComplianceReportReadSchema = z
  .object({
    from: z.string().regex(DATE_KEY_RE).optional(),
    to: z.string().regex(DATE_KEY_RE).optional(),
    program_week_id: z.string().optional(),
  })
  .strict();

// --- Suscripción de avisos (push_subscriptions, US7) ---
// Forma de `PushSubscription.toJSON()` del navegador. `id` nunca viaja en el body: lo calcula el
// servidor como sha256(endpoint) (data-model.md), así que un mismo dispositivo siempre upsertea
// la misma fila en vez de duplicarla.

export const PushSubscriptionSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .refine((value) => value.startsWith('https://'), { message: 'endpoint debe ser una URL https' }),
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const PushUnsubscribeSchema = z
  .object({
    endpoint: z.string().min(1),
  })
  .strict();

// --- Tarea (tasks, US8) ---
// FR-035: 1 a 3 tandas; 4 o más se rechaza con PARTIR_TAREA (no el DATOS_INVALIDOS genérico de
// un .max() a secas), por eso el superRefine de abajo además del rango declarado en el campo —
// mismo patrón que TandaInterruptSchema con RAZON_REQUERIDA.

function flagPartirTarea(estimatedTandas: number | undefined, ctx: z.RefinementCtx) {
  if (estimatedTandas != null && estimatedTandas > 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estimated_tandas'],
      message: 'Una tarea admite de 1 a 3 tandas. Si necesita más, hay que partirla.',
      params: { code: 'PARTIR_TAREA' satisfies ExecutionErrorCode },
    });
  }
}

export const ExecutionTaskSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(3).max(120),
    subject_id: z.string().min(1),
    deliverable_id: z.string().optional(),
    topic_id: z.string().optional(),
    estimated_tandas: z.number().int().min(1).max(3),
    status: z.enum(['pendiente', 'hecha', 'descartada']).optional(),
    scheduled_date: z.string().regex(DATE_KEY_RE).optional(),
  })
  .strict()
  .superRefine((data, ctx) => flagPartirTarea(data.estimated_tandas, ctx));

export const ExecutionTaskUpdateSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(3).max(120).optional(),
    subject_id: z.string().min(1).optional(),
    deliverable_id: z.string().optional(),
    topic_id: z.string().optional(),
    estimated_tandas: z.number().int().min(1).max(3).optional(),
    status: z.enum(['pendiente', 'hecha', 'descartada']).optional(),
    scheduled_date: z.string().regex(DATE_KEY_RE).optional(),
  })
  .strict()
  .superRefine((data, ctx) => flagPartirTarea(data.estimated_tandas, ctx));

export const ExecutionTaskReadSchema = z
  .object({
    id: z.string().optional(),
    subject_id: z.string().optional(),
    status: z.enum(['pendiente', 'hecha', 'descartada']).optional(),
  })
  .strict();

export const ExecutionTaskDeleteSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

// --- Proyección de nota (get_grade_projection, US5) ---

export const GradeProjectionReadSchema = z
  .object({
    subject_id: z.string().optional(),
  })
  .strict();

// --- Intención (intentions) ---

export const IntentionItemSchema = z
  .object({
    subject_id: z.string().min(1),
    strength: z.number().int().min(0).max(10),
    reason: z.string().optional(),
  })
  .strict();

export const IntentionsSetSchema = z
  .object({
    program_week_id: z.string().min(1),
    items: z.array(IntentionItemSchema).min(1),
  })
  .strict();

// --- Planeación de la semana (plan_week, US8-US9) ---

export const PlanWeekPreviewSchema = z
  .object({
    program_week_id: z.string().optional(),
  })
  .strict();

// FR-037 + US-B1: libre las primeras 2 veces por semana; desde la 3.ª, reason vacío/ausente -> RAZON_REQUERIDA.
// La cuenta de "es esta la 3.ª apertura" depende de plan_views (estado en base), así que aquí solo
// se valida la forma; lib/execution/planning.ts decide cuándo aplica el RAZON_REQUERIDA real.
// US-B1: program_week_id opcional para abrir una semana futura como planeación sin compuerta.
export const PlanWeekOpenViewSchema = z
  .object({
    program_week_id: z.string().min(1).optional(),
    reason: z.string().optional(),
  })
  .strict();

// --- Fricción del teléfono (manage_friction, US-B5) ---

export const FRICTION_MEASURE_KEYS = [
  'sin_biometria',
  'clave_larga',
  'escala_grises',
  'redes_fuera_home',
  'app_desinstalada',
] as const;

export const FrictionMeasureSchema = z
  .object({
    measure_key: z.enum(FRICTION_MEASURE_KEYS),
  })
  .strict();

export const FrictionRateSchema = z
  .object({
    score: z.number().int().min(0).max(10),
    program_week_id: z.string().min(1).optional(),
  })
  .strict();
