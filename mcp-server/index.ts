import 'dotenv/config';
import http, { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { validateMcpAuth } from './auth-middleware';
import { handleHealthCheck } from './health-handler';
import { OAuthStore, globalOAuthStore } from './oauth-store';
import {
  handleGetAcademicOverview,
  handleParseAndIngestSyllabus,
  handleFindCrossSubjectSynergies,
  handleIngestAcademicEnrollment,
  handleManageUniversities,
  handleManageProfessors,
  handleManageSubjects,
  handleManageSchedules,
  handleManageDeliverables,
  handleManageClassSessions,
  handleManageSyllabusTopics,
  handleGenerateStudyPlan,
  handleGetStudyMaterial,
  handleGeneratePracticeExam,
  handleRecordStudyProgress,
  handleGetSyllabusProgress,
  handleSyncFireflies,
  handleManageStudyBlocks,
  handleManageFlashcards,
  handleGetClassContext,
  handleManageProgram,
  handleManageTandas,
  handleGetToday,
  handleGetFocusSummary,
  handleManageRoutineSlots,
  handleManageDailyChecks,
  handleGetGradeProjection,
  handleManageWeeklyReport,
  handleGetComplianceReport,
  handleManageTasks,
  handlePlanWeek,
  handleManageFriction,
  handleManageObjectives,
  handleManageQuotes,
} from './tools-handler';
import { runExecutionTick } from '../lib/execution/tick';
import { createZeptoMailer } from '../lib/execution/mailer';

export const TOOLS_LIST = [
  {
    name: 'get_academic_overview',
    description: 'Retorna el resumen académico global, tiempo libre neto, promedios por carrera y alertas urgentes.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ingest_academic_enrollment',
    description: 'Procesa e ingesta la matrícula del estudiante. raw_text debe ser un string JSON con los arrays "universities", "professors", "subjects" y "schedules" (convención day_of_week: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=Domingo; periodicity: "semanal" | "sabado_a" | "sabado_b", donde sabado_a y sabado_b son quincenales alternas). Ejemplo mínimo: {"universities":[{"id":"u1","name":"UdeA"}],"professors":[{"id":"p1","university_id":"u1","name":"Dr. Curie"}],"subjects":[{"id":"s1","university_id":"u1","professor_id":"p1","name":"Cálculo"}],"schedules":[{"id":"sch1","subject_id":"s1","day_of_week":6,"start_time":"08:00","end_time":"10:00","classroom":"2-209","periodicity":"sabado_a"}]}',
    inputSchema: {
      type: 'object',
      properties: {
        raw_text: {
          type: 'string',
          description: 'String JSON con { universities, professors, subjects, schedules }. Convención day_of_week: 1=Lunes..7=Domingo. periodicity: "semanal" | "sabado_a" | "sabado_b" (sabado_a/sabado_b son quincenales alternas). Ejemplo: {"universities":[{"id":"u1","name":"UdeA"}],"subjects":[{"id":"s1","university_id":"u1","name":"Cálculo"}],"schedules":[{"id":"sch1","subject_id":"s1","day_of_week":6,"start_time":"08:00","end_time":"10:00","classroom":"2-209","periodicity":"sabado_a"}]}',
        },
      },
      required: ['raw_text'],
    },
  },
  {
    name: 'parse_and_ingest_syllabus',
    description: 'Recibe un texto/PDF de temario y lo convierte en árbol jerárquico de ejes temáticos para la asignatura.',
    inputSchema: {
      type: 'object',
      properties: {
        subject_id: { type: 'string', description: 'ID de la asignatura' },
        raw_text: { type: 'string', description: 'Texto plano del temario o plan de estudios' },
      },
      required: ['subject_id', 'raw_text'],
    },
  },
  {
    name: 'find_cross_subject_synergies',
    description: 'Escanea temarios de Ingeniería Aeroespacial e Ingeniería de Software y devuelve coincidencias temáticas para fusionar estudio.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'manage_universities',
    description: 'Operaciones CRUD sobre Universidades (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos de la universidad (id, name, modality, scale_min, scale_max, passing_grade, color, has_alternating_saturdays, first_sabado_a_date)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_professors',
    description: 'Operaciones CRUD sobre Profesores (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del profesor (id, university_id, name, email, office_hours, notes)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_subjects',
    description: 'Operaciones CRUD sobre Asignaturas / Materias (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos de la materia (id, university_id, professor_id, name, code, credits, difficulty, target_grade)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_schedules',
    description: 'Operaciones CRUD sobre Horarios y Aulas de clase (crear, leer, actualizar, eliminar). periodicity: "semanal" | "sabado_a" | "sabado_b" (sabado_a/sabado_b son quincenales alternas).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del horario (id, subject_id, day_of_week, start_time, end_time, classroom, periodicity: "semanal" | "sabado_a" | "sabado_b")' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_deliverables',
    description: 'Operaciones CRUD sobre Entregables / Parciales / Tareas (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del entregable (id, subject_id, title, due_date, weight_percentage, grade, type, status)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_class_sessions',
    description: 'Operaciones CRUD sobre Sesiones de Clase: grabaciones, resúmenes IA y transcripciones (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos de la sesión (id, subject_id, schedule_id, session_date, title, summary, transcript_text, ai_summary, recording_url, fireflies_transcript_id, topics_covered, session_source)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_syllabus_topics',
    description: 'Operaciones CRUD sobre Temarios y Ejes Temáticos (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del tema (id, subject_id, parent_id, title, description, mastery_status, order_index)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'generate_study_plan',
    description: 'Genera bloques de estudio concretos en el calendario basado en horas DME y entregas pendientes.',
    inputSchema: {
      type: 'object',
      properties: {
        available_hours_per_day: { type: 'number', description: 'Horas disponibles diarias para estudio (ej. 2.5)' },
        target_subject_ids: { type: 'array', items: { type: 'string' }, description: 'IDs de materias a priorizar (opcional)' },
        date_start: { type: 'string', description: 'Fecha inicio en ISO format (YYYY-MM-DD)' },
        date_end: { type: 'string', description: 'Fecha fin en ISO format (YYYY-MM-DD)' },
      },
      required: ['available_hours_per_day', 'date_start', 'date_end'],
    },
  },
  {
    name: 'get_study_material',
    description: 'Obtiene material de estudio para una materia/tema: contenido del temario, transcripciones de clases, flashcards pendientes y entregas relacionadas.',
    inputSchema: {
      type: 'object',
      properties: {
        subject_id: { type: 'string', description: 'ID de la materia (opcional)' },
        topic_id: { type: 'string', description: 'ID del tema (opcional)' },
        session_date: { type: 'string', description: 'Fecha de la sesión en ISO format (opcional)' },
      },
    },
  },
  {
    name: 'generate_practice_exam',
    description: 'Devuelve contexto estructurado de los temas para que el agente formule preguntas de práctica.',
    inputSchema: {
      type: 'object',
      properties: {
        subject_id: { type: 'string', description: 'ID de la materia' },
        topic_ids: { type: 'array', items: { type: 'string' }, description: 'IDs de temas a incluir' },
        question_count: { type: 'number', description: 'Número de preguntas deseadas (defecto 10)' },
        question_types: { type: 'array', items: { type: 'string' }, description: 'Tipos: open, mcq, cloze, true_false (defecto [open, mcq])' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Nivel de dificultad' },
      },
      required: ['subject_id', 'topic_ids', 'difficulty'],
    },
  },
  {
    name: 'record_study_progress',
    description: 'Registra el resultado de una revisión de flashcard usando FSRS.',
    inputSchema: {
      type: 'object',
      properties: {
        flashcard_id: { type: 'string', description: 'ID de la flashcard' },
        rating: { type: 'string', enum: ['again', 'hard', 'good', 'easy'], description: 'Rating FSRS' },
      },
      required: ['flashcard_id', 'rating'],
    },
  },
  {
    name: 'get_syllabus_progress',
    description: 'Obtiene progreso del temario por materia agrupado por unidades.',
    inputSchema: {
      type: 'object',
      properties: {
        subject_id: { type: 'string', description: 'ID de la materia (opcional; si omite, retorna todas)' },
      },
    },
  },
  {
    name: 'sync_fireflies',
    description: 'Sincroniza transcripciones de Fireflies.ai y crea sesiones de clase automáticamente.',
    inputSchema: {
      type: 'object',
      properties: {
        force: { type: 'boolean', description: 'Forzar resincronización (opcional, defecto false)' },
      },
    },
  },
  {
    name: 'manage_study_blocks',
    description: 'CRUD de bloques de estudio en el calendario.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del bloque (id, subject_id, date, start_time, end_time, type, is_completed, source)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_flashcards',
    description: 'CRUD de flashcards con opción de obtener las que vencen hoy.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete', 'due_today'] },
        data: { type: 'object', description: 'Datos de flashcard (id, subject_id, topic_id, question, answer, question_type, options, due, source)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_class_context',
    description: 'Devuelve el contexto completo de una clase (resumen, temas, transcripción y temario relacionado) para que un agente responda o genere material.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'ID de la sesión de clase (opcional si se proporciona subject_id)' },
        subject_id: { type: 'string', description: 'ID de la materia para obtener la sesión más reciente (opcional si se proporciona session_id)' },
        date: { type: 'string', description: 'Fecha en formato ISO (optional, futuro uso)' },
      },
    },
  },
  {
    name: 'manage_program',
    description:
      'Módulo de Ejecución: programa de semanas (arranque/consolidación/automatización) y hábitos diarios. ' +
      '"init" crea el programa una sola vez, con las semanas numeradas desde un lunes (rechaza otro día y un segundo init). ' +
      '"update_week" solo edita semanas cuyo inicio todavía no llegó (la semana en curso o pasada se rechaza). ' +
      '"upsert_habit"/"retire_habit" dan de alta o retiran un hábito diario, con days_of_week 1=lunes..7=domingo. ' +
      'El programa, sus semanas y los hábitos se cargan exclusivamente por esta herramienta: nunca se siembran por migración ni por la UI.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['init', 'read', 'update_week', 'upsert_habit', 'retire_habit'] },
        data: {
          type: 'object',
          description:
            'init: { starts_on (YYYY-MM-DD, lunes), weeks: [{ min_tandas_dia, phase }] }. ' +
            'update_week: { id, min_tandas_dia?, phase? }. ' +
            'upsert_habit: { id, label, started_on, days_of_week? (1=lunes..7=domingo), target_days? }. ' +
            'retire_habit: { id, retired_on }. read: sin data.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_tandas',
    description:
      'Módulo de Ejecución: tanda de estudio temporizador (10–180 minutos, 10 por defecto) o cronómetro sin fin, la unidad de ejecución de Pure. ' +
      '"start" la empieza con la hora del servidor (rechaza started_at/ended_at del cliente: sin tandas retroactivas) y falla con TANDA_EN_CURSO si ya hay una en curso. ' +
      '"finish" en temporizador solo funciona si ya se cumplió el tiempo planeado; en cronómetro requiere ≥60 segundos transcurridos (antes rechaza con CRONOMETRO_MUY_CORTO); antes de eso usa "interrupt" con interrupt_reason (1-140 caracteres, obligatorio). ' +
      '"current" devuelve los segundos restantes en temporizador (seconds_left) o los segundos transcurridos en cronómetro (elapsed_seconds). "read" lista tandas con su resumen por día, donde un cronómetro que cruza medianoche se reparte entre los días locales que abarca (incluye unidades y minutos). ' +
      '"update" solo reclasifica una tanda ya cerrada (materia, tema, entregable, tarea, objetivo, modo); nunca acepta tiempos. ' +
      '"log_late" (US-T2) es la primera de las dos excepciones del módulo (la otra es "correct") que aceptan instantes del cliente: acepta started_at/ended_at para registrar una sesión que se estudió sin darle iniciar, acotada a hoy (día local del servidor), hasta 6 horas atrás, 10-60 minutos, sin solaparse con otra tanda del día y máximo 3 por día; queda marcada late_logged=true y se cuenta aparte en el reporte semanal (registros_tardios). No está en la lista blanca de la web: solo se dispara por este agente. ' +
      '"correct" (US-F4) corrige o cierra un cronómetro olvidado y es la SEGUNDA excepción acotada del módulo (después de log_late) que acepta un instante del cliente (ended_at). Solo acorta: en una sesión cerrada el fin nuevo debe ser anterior al registrado y al menos 1 minuto posterior al inicio; en un cronómetro en curso lo cierra como completado con un fin entre inicio + 1 minuto y ahora; un temporizador en curso no se corrige (para cortarlo usa "interrupt"). Fuera de esas cotas responde CORRECCION_INVALIDA y no cambia nada. Exige una razón de 1-140 caracteres, conserva el fin y los minutos originales de antes de la primera corrección (original_ended_at, original_minutes), marca corrected=true con corrected_at del servidor y se cuenta en el reporte (correcciones: { total, minutos_recortados }). Está disponible en cualquier momento, también después del cierre del día. No está en la lista blanca de la web: solo se dispara por este agente.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'finish', 'interrupt', 'current', 'read', 'update', 'log_late', 'correct'] },
        data: {
          type: 'object',
          description:
            'start: { kind? (temporizador|cronometro, temporizador por defecto), planned_minutes? (10-180 solo temporizador, 10 por defecto), objective_id?, subject_id?, topic_id?, deliverable_id?, task_id?, routine_slot_id? }. ' +
            'finish: { id }. interrupt: { id, interrupt_reason (1-140) }. current: sin data. ' +
            'read: { from?, to? (YYYY-MM-DD), subject_id?, objective_id? }. ' +
            'update: { id, subject_id?, topic_id?, deliverable_id?, task_id?, objective_id?, mode?, interrupt_reason? }. ' +
            'log_late: { subject_id, started_at (ISO, hoy, hasta 6h atrás), ended_at (ISO, <= ahora, > started_at), topic_id?, task_id? } -> REGISTRO_TARDIO_INVALIDO | LIMITE_REGISTRO_TARDIO. ' +
            'correct: { id, ended_at (ISO), reason (1-140) } -> CORRECCION_INVALIDA.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_today',
    description:
      'Módulo de Ejecución: estado de la pantalla Hoy (US1-US3), de solo lectura. Devuelve la hora del servidor, la fecha y semana local, la tanda en curso (running_tanda con kind temporizador|cronometro, objective_id, y seconds_left en el temporizador o elapsed_seconds en el cronómetro), el disparador vigente si lo hay, los hábitos pendientes, si el día quedó cumplido y la evaluación desglosada del día (tandas_completadas, min_requerido, cumplio_tandas, cumplio_habitos, day_fulfilled). También foco_semana_minutos (minutos enfocados de lunes a hoy) y foco_12_semanas (días { date, minutos, nivel } de las últimas 12 semanas, el mismo nivel y los mismos minutos que get_focus_summary) y frase_del_dia ({ text, translation, source } o null si no hay frases activas: una frase latina por día, rotación determinista por fecha local sobre las frases activas de manage_quotes).',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'object', description: '{ at? } ISO, opcional: solo para pruebas o una consulta puntual en otro instante.' },
      },
    },
  },
  {
    name: 'get_focus_summary',
    description:
      'Módulo de Ejecución: resumen de tiempo enfocado (US-F3), de solo lectura. Suma los minutos de las sesiones completadas e interrumpidas (las en curso no suman; un cronómetro que cruza la medianoche se reparte entre los días locales que abarca). Devuelve rango { desde, hasta, semanas } (desde = lunes de hace weeks-1 semanas, hasta = hoy), dias[] { date, minutos, nivel 0-4 } con 0 explícito en días vacíos, semanas[] { lunes, minutos } de lunes a domingo, total_semana (lunes a hoy) y por_objetivo[] { tipo: objetivo|materia|sin_objetivo, id, nombre, minutos, meta, archivado } de la semana actual sin filtro (cada sesión en una sola fila; los objetivos activos con meta aparecen aunque sumen 0). El filtro por objective_id o subject_id afecta a dias, semanas y total_semana, no a por_objetivo; el de materia incluye las sesiones de objetivos ligados a esa materia. El mismo resultado que GET /api/execution/focus.',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description:
            '{ weeks? (entero 1-53, 52 por defecto), objective_id? | subject_id? (no ambos: DATOS_INVALIDOS), at? (ISO, solo para pruebas) }.',
        },
      },
    },
  },
  {
    name: 'manage_routine_slots',
    description:
      'Módulo de Ejecución: disparador "Si <señal>, entonces <acción>" (US2). ' +
      '"create"/"update" son estrictos: una clave de duración, número de tandas o método de estudio se rechaza (SOBRE_ESPECIFICACION), porque un disparador solo dice cuándo y qué. ' +
      'Un cue_kind="tras_clase" exige schedule_id y SIEMPRE hereda de ese horario days_of_week y la alternancia de sábados (nunca se declaran a mano). ' +
      '"read" marca huerfano:true un tras_clase cuyo horario ya no existe. ' +
      '"respond" (outcome hecho/no) es idempotente por día; en un disparador de hábito también fija el check de ese hábito hoy. ' +
      'El "hecho" real de un disparador de estudio ocurre iniciando la tanda (manage_tandas con action="start" y routine_slot_id en data), que liga la tanda al disparador y hereda su materia — no hay un "respond hecho" separado para ese caso. ' +
      '"rehearse" es idempotente por semana del programa (como máximo un ensayo). days_of_week usa 1=lunes..7=domingo.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'read', 'delete', 'respond', 'rehearse'] },
        data: {
          type: 'object',
          description:
            'create/update: { id? (update), days_of_week (1-7), cue_kind (hora/tras_clase/tras_habito/lugar), cue_text (5-80), action_text (5-90), anchor_time? (HH:MM, obligatorio salvo tras_clase), schedule_id? (obligatorio en tras_clase), subject_id?, habit_id? (obligatorio si kind=habito), kind? (estudio/habito/otro), periodicity? (semanal/sabado_a/sabado_b, solo con days_of_week=[6]), is_active? }. ' +
            'read: { id? }. delete: { id }. ' +
            'respond: { routine_slot_id, outcome (hecho/no) }. rehearse: { routine_slot_id, program_week_id? }.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_daily_checks',
    description:
      'Módulo de Ejecución: registro diario de hábitos y evaluación de "día cumplido" (US3), sin deuda acumulada entre días. ' +
      '"set" acepta hasta las 03:00 del día siguiente a la fecha registrada (después, DIA_CERRADO), rechaza fechas futuras (FECHA_FUTURA) y hábitos que no están activos ese día (HABITO_INACTIVO); es upsert idempotente por fecha y hábito. ' +
      '"read" devuelve, por día, sus checks y la evaluación (tandas completadas ≥ mínimo de la semana y todo hábito activo cumplido o na; null si el día cae fuera del programa).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['set', 'read'] },
        data: {
          type: 'object',
          description:
            'set: { habit_id, status (cumplido/fallado/na), date? (YYYY-MM-DD, hoy por defecto), value?, note? (≤200) }. ' +
            'read: { from?, to? (YYYY-MM-DD) }.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_grade_projection',
    description:
      'Módulo de Ejecución: proyección de nota por materia (US5), de solo lectura. Por materia, con la escala y la aprobatoria de su universidad: aporte acumulado, promedio evaluado, peso restante, la nota necesaria para aprobar y para la meta (redondeadas hacia arriba) y el techo alcanzable (redondeado hacia abajo). ' +
      'Marca "ciega" una materia sin evaluaciones registradas, "pesos_inconsistentes" si los pesos declarados no suman 100% (en ese caso no calcula necesaria ni techo), "entregado_sin_nota", "vencido_sin_registrar", "meta_inalcanzable" y "materia_perdida". ' +
      'Además eleva a alerta (para el reporte semanal y la agenda) las materias "ciega" y las "abandonada" (una evaluación pendiente en menos de 7 días y ninguna tanda en los últimos 7 días).',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'object', description: '{ subject_id? }: sin subject_id, calcula todas las materias.' },
      },
    },
  },
  {
    name: 'get_compliance_report',
    description:
      'Módulo de Ejecución: vista de salud del hábito para un rango de días o una semana del programa entera (US6), de solo lectura. Devuelve los días con su evaluación y desglose (tandas_completadas, min_requerido, cumplio_tandas, cumplio_habitos, day_fulfilled), days_fulfilled, aperturas_plan { libres_usadas, con_razon, total, razones } (solo aperturas de la vista de semana; las de planeación no cuentan), los hábitos como fracción (sin los que tienen 0 días activos en el rango), las tandas (completadas/interrumpidas y por materia: una sesión que cruza la medianoche cuenta en cada semana que toca, con solo los minutos de su tramo), los disparadores (hecho/no/sin_respuesta), las razones de interrupción, las ediciones tardías, registros_tardios { total, minutos } (sesiones registradas con log_late), correcciones { total, minutos_recortados } (sesiones corregidas con manage_tandas:correct, contadas por la semana local en que se hizo la corrección, no por la del inicio de la sesión), los días cumplidos acumulados desde el inicio del programa y el horizonte del hábito (66 por defecto).',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description:
            '{ from?, to? (YYYY-MM-DD) } o { program_week_id? }. Sin ninguno, cubre solo hoy.',
        },
      },
    },
  },
  {
    name: 'manage_weekly_report',
    description:
      'Módulo de Ejecución: destinatario del reporte semanal y su ciclo de vida (US6). "set_partner" registra al único destinatario vigente (exige consented_at: sin consentimiento no se guarda) y desactiva el anterior. "preview" muestra la forma del reporte con los datos de AHORA, sin congelar ni guardar nada. El congelamiento en sí (domingo 19:00) y el envío (tras 60 minutos de ventana de nota) los hace el tick, no una acción manual: "set_note" solo escribe la nota dentro de esa ventana, "send" fuerza el envío de un reporte ya congelado (con el mismo claim atómico del tick: como mucho un envío por reporte) y "read" devuelve el reporte guardado (status, intentos, último error). ' +
      '"run_tick" ejecuta un ciclo completo del tick (congelar semanas vencidas + intentar enviar las que ya cerraron su ventana de nota) con el mailer real: es el disparador externo que exige FR-039 (repetirlo nunca duplica un envío) y sirve para forzar el congelamiento sin esperar al reloj del servidor.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['set_partner', 'read_partner', 'preview', 'set_note', 'send', 'read', 'run_tick'] },
        data: {
          type: 'object',
          description:
            'set_partner: { name, email, consented_at (ISO) }. read_partner/run_tick: sin data. ' +
            'preview: { program_week_id? } (la semana en curso si se omite). ' +
            'set_note: { program_week_id, note (≤400) }. send: { program_week_id }. read: { program_week_id? }.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_tasks',
    description:
      'Módulo de Ejecución: tarea de 1 a 3 tandas, ligada a una materia (US8). ' +
      '"create"/"update" rechazan estimated_tandas > 3 con PARTIR_TAREA: la tarea hay que partirla, nunca aceptarla grande. ' +
      '"today" devuelve solo las tareas con scheduled_date = hoy y status="pendiente"; las de ayer sin hacer NO se arrastran (no hay deuda acumulada de tareas en este sistema).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete', 'today'] },
        data: {
          type: 'object',
          description:
            'create: { id?, title (3-120), subject_id, deliverable_id?, topic_id?, estimated_tandas (1-3), status? (pendiente/hecha/descartada), scheduled_date? (YYYY-MM-DD) }. ' +
            'read: { id?, subject_id?, status? }. update: { id, ...campos de create, todos opcionales }. delete: { id }. today: sin data.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'plan_week',
    description:
      'Módulo de Ejecución: planeación del domingo y la vista de semana (US8-US9-B1). ' +
      '"preview" arma el asistente del domingo: la semana pasada (cumplimiento), las entregas de los próximos 14 días con sus alertas, las intenciones y disparadores de la semana que viene con su ensayo, y el reparto sugerido de tandas por materia (de la norma de créditos, 48h/crédito/semestre, con la urgencia y la proyección de nota en columnas aparte) — excluye de ese reparto una materia con intención declarada menor a 6. ' +
      '"set_intentions" registra, por materia y semana, una intención de 0 a 10; menor a 6 exige razón (RAZON_REQUERIDA si falta) y esa materia deja de recibir reparto sugerido. ' +
      '"open_view" abre la vista de una semana: la indicada con program_week_id o, sin él, la que contiene hoy o la próxima que empiece (nunca salta a la siguiente por ser domingo); si la indicada no existe, NO_ENCONTRADO. Si la semana todavía no empieza, es una apertura de planeación (surface=planeacion): no pasa por la compuerta, no pide razón y no cuenta como apertura. Si ya empezó, aplica la compuerta (FR-037): libre 2 veces por semana y desde la 3.ª exige reason (RAZON_REQUERIDA si falta); esas aperturas se cuentan en el reporte semanal. Devuelve la rejilla de la semana: cada disparador con su resultado por día y las tandas por día, sin gráficas.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['preview', 'set_intentions', 'open_view'] },
        data: {
          type: 'object',
          description:
            'preview: { program_week_id? } (domingo→siguiente, si no en curso, si no siguiente disponible; sin nada → NO_ENCONTRADO). ' +
            'set_intentions: { program_week_id, items: [{ subject_id, strength (0-10), reason? }] }. ' +
            'open_view: { program_week_id?, reason? } (la semana indicada o resuelta; futura es apertura de planeación sin compuerta; en curso aplica compuerta normal).',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_friction',
    description: 'Registrar y gestionar medidas de fricción del teléfono. Pure solo registra; la ejecución la hace el SO. Máximo 2 habilitadas a la vez (si hay más de 2 → LIMITE_FRICCION). Calificación semanal de irritación (0-10); dos semanas consecutivas ≥7 retiran automáticamente la medida más recientemente habilitada sin avisos. Medidas: sin biometría, clave larga, escala de grises, redes fuera de la pantalla de inicio, app desinstalada.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['enable', 'disable', 'verify', 'rate', 'read'] },
        data: {
          type: 'object',
          description: 'enable/disable/verify: { measure_key } (sin_biometria, clave_larga, escala_grises, redes_fuera_home, app_desinstalada). rate: { score: 0-10, program_week_id? (defecto: semana en curso) }. read: sin data.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_objectives',
    description:
      'Módulo de Ejecución: objetivos propios (LeetCode, Inglés, Proyecto personal) a los que se ligan las sesiones de foco (manage_tandas con objective_id). Un objetivo tiene nombre (1-60 caracteres, único entre los activos sin distinguir mayúsculas ni espacios en los extremos), materia opcional y meta semanal opcional en minutos (entero de 1 a 10080). ' +
      'Una sesión de un objetivo SIN materia suma minutos de foco pero no cuenta para el mínimo diario (salvo que la sesión tenga materia, tema, tarea o entrega propios); un objetivo con materia sí cuenta. ' +
      '"create" falla con OBJETIVO_DUPLICADO si el nombre ya está en uso por un objetivo activo y con NO_ENCONTRADO si la materia no existe. "read" lista los activos ordenados por nombre (include_archived los incluye). ' +
      '"update" aplica las mismas validaciones que create y rechaza uno archivado con OBJETIVO_ARCHIVADO. "archive" es idempotente: no se borran, se archivan; sus sesiones viejas siguen sumando y ya no se puede empezar una sesión con él.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'archive'] },
        data: {
          type: 'object',
          description:
            'create: { name (1-60), subject_id?, weekly_target_minutes? (entero 1-10080) }. ' +
            'read: { include_archived? (false por defecto) } -> { objetivos[] } ordenados por nombre. ' +
            'update: { id, name?, subject_id? (string | null para quitarla), weekly_target_minutes? (entero 1-10080 | null para quitarla) }. ' +
            'archive: { id }.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_quotes',
    description:
      'Módulo de Ejecución: frases latinas de la línea del día en Hoy (US-F5). SOLO MCP: la web no puede crearlas ni modificarlas. Una frase tiene texto latino (1-300 caracteres), traducción opcional (hasta 300) y fuente opcional (hasta 120); get_today devuelve una por día (frase_del_dia) con rotación determinista por fecha local sobre las frases activas. ' +
      'Carga inicial: una sola vez, con "create_many" y el contenido de specs/004-foco-cronometro/frases.json (50 frases); responde { creadas, omitidas }. "create_many" (1 a 200 frases) es todo o nada: una frase inválida rechaza el lote entero con DATOS_INVALIDOS y no escribe ninguna; es idempotente, repetir la carga da { creadas: 0, omitidas: 50 }. ' +
      'La comparación ignora mayúsculas y espacios en los extremos del texto latino. "create" también es idempotente: si la frase ya existe devuelve la existente. "read" lista las activas ordenadas por id (include_inactive incluye las desactivadas). "update" cambia texto, traducción, fuente o active sin cambiar el id; "deactivate" saca la frase de la rotación (idempotente).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'create_many', 'read', 'update', 'deactivate'] },
        data: {
          type: 'object',
          description:
            'create: { text (1-300), translation? (hasta 300), source? (hasta 120) } -> la frase (la existente si ya estaba). ' +
            'create_many: { frases: [{ text, translation?, source? }] } (1 a 200, todo o nada) -> { creadas, omitidas }. ' +
            'read: { include_inactive? (false por defecto) } -> { frases[] } ordenadas por id. ' +
            'update: { id, text?, translation?, source?, active? } (cambiar text no cambia el id). ' +
            'deactivate: { id }.',
        },
      },
      required: ['action'],
    },
  },
];

export function createMcpServerInstance() {
  const mcpServer = new McpServer(
    {
      name: 'pure-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all tools using modern McpServer tool() API
  mcpServer.tool('get_academic_overview', 'Retorna el resumen académico global, tiempo libre neto y promedios por carrera.', {}, async () => {
    const res = await handleGetAcademicOverview();
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool(
    'ingest_academic_enrollment',
    'Procesa e ingesta la matrícula del estudiante. raw_text debe ser un string JSON con los arrays "universities", "professors", "subjects" y "schedules" (convención day_of_week: 1=Lunes..7=Domingo). Ejemplo mínimo: {"universities":[{"id":"u1","name":"UdeA"}],"professors":[{"id":"p1","university_id":"u1","name":"Dr. Curie"}],"subjects":[{"id":"s1","university_id":"u1","professor_id":"p1","name":"Cálculo"}],"schedules":[{"id":"sch1","subject_id":"s1","day_of_week":1,"start_time":"08:00","end_time":"10:00","classroom":"2-209"}]}',
    { raw_text: z.string().describe('String JSON con { universities, professors, subjects, schedules } (day_of_week 1=Lunes..7=Domingo)') },
    async ({ raw_text }) => {
      const res = await handleIngestAcademicEnrollment(raw_text);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool('parse_and_ingest_syllabus', 'Recibe un texto de temario y lo convierte en árbol de ejes temáticos.', { subject_id: z.string(), raw_text: z.string() }, async ({ subject_id, raw_text }) => {
    const res = await handleParseAndIngestSyllabus(subject_id, raw_text);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('find_cross_subject_synergies', 'Escanea temarios de Ingeniería Aeroespacial e Ingeniería de Software.', {}, async () => {
    const res = await handleFindCrossSubjectSynergies();
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_universities', 'Operaciones CRUD sobre Universidades.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageUniversities(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_professors', 'Operaciones CRUD sobre Profesores.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageProfessors(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_subjects', 'Operaciones CRUD sobre Asignaturas.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageSubjects(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_schedules', 'Operaciones CRUD sobre Horarios y Aulas de clase.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageSchedules(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_deliverables', 'Operaciones CRUD sobre Entregables / Parciales.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageDeliverables(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_class_sessions', 'Operaciones CRUD sobre Sesiones de Clase (grabaciones, resúmenes y transcripciones).', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageClassSessions(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_syllabus_topics', 'Operaciones CRUD sobre Ejes Temáticos.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageSyllabusTopics(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool(
    'generate_study_plan',
    'Genera bloques de estudio concretos en el calendario basado en horas DME y entregas pendientes.',
    {
      available_hours_per_day: z.number(),
      target_subject_ids: z.array(z.string()).optional(),
      date_start: z.string(),
      date_end: z.string(),
    },
    async ({ available_hours_per_day, target_subject_ids, date_start, date_end }) => {
      const res = await handleGenerateStudyPlan(available_hours_per_day, target_subject_ids, date_start, date_end);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'get_study_material',
    'Obtiene material de estudio para una materia/tema: temario, clases, flashcards y entregas.',
    {
      subject_id: z.string().optional(),
      topic_id: z.string().optional(),
      session_date: z.string().optional(),
    },
    async ({ subject_id, topic_id, session_date }) => {
      const res = await handleGetStudyMaterial(subject_id, topic_id, session_date);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'generate_practice_exam',
    'Devuelve contexto estructurado de los temas para que el agente formule preguntas de práctica.',
    {
      subject_id: z.string(),
      topic_ids: z.array(z.string()),
      question_count: z.number().optional(),
      question_types: z.array(z.string()).optional(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      session_id: z.string().optional(),
    },
    async ({ subject_id, topic_ids, question_count, question_types, difficulty, session_id }) => {
      const res = await handleGeneratePracticeExam(subject_id, topic_ids, question_count, question_types, difficulty, session_id);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'record_study_progress',
    'Registra el resultado de una revisión de flashcard usando FSRS.',
    {
      flashcard_id: z.string(),
      rating: z.enum(['again', 'hard', 'good', 'easy']),
    },
    async ({ flashcard_id, rating }) => {
      const res = await handleRecordStudyProgress(flashcard_id, rating);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'get_syllabus_progress',
    'Obtiene progreso del temario por materia agrupado por unidades.',
    {
      subject_id: z.string().optional(),
    },
    async ({ subject_id }) => {
      const res = await handleGetSyllabusProgress(subject_id);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'sync_fireflies',
    'Sincroniza transcripciones de Fireflies.ai y crea sesiones de clase automáticamente.',
    {
      force: z.boolean().optional(),
    },
    async ({ force }) => {
      const res = await handleSyncFireflies(force);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_study_blocks',
    'CRUD de bloques de estudio en el calendario.',
    {
      action: z.enum(['create', 'read', 'update', 'delete']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageStudyBlocks(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_flashcards',
    'CRUD de flashcards con opción de obtener las que vencen hoy.',
    {
      action: z.enum(['create', 'read', 'update', 'delete', 'due_today']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageFlashcards(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'get_class_context',
    'Devuelve el contexto completo de una clase (resumen, temas, transcripción y temario relacionado) para que un agente responda o genere material.',
    {
      session_id: z.string().optional(),
      subject_id: z.string().optional(),
      date: z.string().optional(),
    },
    async ({ session_id, subject_id, date }) => {
      const res = await handleGetClassContext({ session_id, subject_id, date });
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_program',
    'Módulo de Ejecución: programa de semanas y hábitos diarios. init/read/update_week/upsert_habit/retire_habit. Datos cargados solo por esta herramienta (nunca sembrados por migración ni por la UI); days_of_week de los hábitos usa 1=lunes..7=domingo.',
    {
      action: z.enum(['init', 'read', 'update_week', 'upsert_habit', 'retire_habit']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageProgram(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_tandas',
    'Módulo de Ejecución: tanda temporizador (10–180 minutos, 10 por defecto) o cronómetro sin fin. start/finish/interrupt/current/read/update/log_late/correct. La hora siempre la fija el servidor; sin tandas retroactivas. Temporizador exige tiempo planeado en finish; cronómetro requiere ≥60 segundos transcurridos. interrupt exige una razón de 1-140 caracteres. current devuelve seconds_left (temporizador) o elapsed_seconds (cronómetro). read trae resumen por día (unidades, minutos); cronómetro que cruza medianoche se reparte. log_late y correct son las dos excepciones acotadas que aceptan instantes del cliente; ninguna está disponible desde la web. log_late: started_at/ended_at (hoy, hasta 6h atrás, 10-60 min, máx. 3/día, marcada late_logged y contada aparte en el reporte). correct (US-F4, la segunda excepción, después de log_late): corrige o cierra un cronómetro olvidado con { id, ended_at ISO, reason 1-140 }; solo acorta (fin anterior al registrado, o entre inicio + 1 min y ahora si el cronómetro sigue en curso; un temporizador en curso no se corrige, usa interrupt), exige razón, conserva el fin y los minutos originales y se cuenta en el reporte (correcciones); fuera de cotas, CORRECCION_INVALIDA.',
    {
      action: z.enum(['start', 'finish', 'interrupt', 'current', 'read', 'update', 'log_late', 'correct']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageTandas(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'get_today',
    'Módulo de Ejecución: estado de Hoy (server_now, fecha y semana local, tanda en curso con kind temporizador|cronometro, objective_id, seconds_left o elapsed_seconds, disparador vigente, hábitos pendientes, día cumplido, evaluación desglosada con tandas_completadas/min_requerido/cumplio_tandas/cumplio_habitos/day_fulfilled, foco_semana_minutos, foco_12_semanas con los días { date, minutos, nivel } de las últimas 12 semanas y frase_del_dia { text, translation, source } | null). Solo lectura.',
    {
      data: z.any().optional(),
    },
    async ({ data }) => {
      const res = await handleGetToday(data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'get_focus_summary',
    'Módulo de Ejecución: resumen de tiempo enfocado (US-F3). data: { weeks? (1-53, 52 por defecto), objective_id? | subject_id? (no ambos: DATOS_INVALIDOS), at? }. Devuelve rango, dias[] { date, minutos, nivel 0-4 } con 0 explícito, semanas[] { lunes, minutos }, total_semana y por_objetivo[] de la semana actual. Suman las sesiones completadas e interrumpidas; las en curso no. Solo lectura; el mismo resultado que GET /api/execution/focus.',
    {
      data: z.any().optional(),
    },
    async ({ data }) => {
      const res = await handleGetFocusSummary(data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_routine_slots',
    'Módulo de Ejecución: disparador "Si <señal>, entonces <acción>" (US2). create/update/read/delete/respond/rehearse. Un tras_clase hereda día y alternancia de sábados de su horario; respond es idempotente por día y rehearse por semana del programa.',
    {
      action: z.enum(['create', 'update', 'read', 'delete', 'respond', 'rehearse']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageRoutineSlots(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_daily_checks',
    'Módulo de Ejecución: registro diario de hábitos y "día cumplido" (US3). set/read. set acepta hasta las 03:00 del día siguiente, rechaza fechas futuras y hábitos inactivos ese día; es upsert idempotente por fecha+hábito.',
    {
      action: z.enum(['set', 'read']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageDailyChecks(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'get_grade_projection',
    'Módulo de Ejecución: proyección de nota por materia (US5), de solo lectura. Necesaria para aprobar/meta y techo, con las alertas ciega/pesos_inconsistentes/entregado_sin_nota/vencido_sin_registrar/meta_inalcanzable/materia_perdida, y las alertas elevadas ciega/abandonada.',
    {
      data: z.any().optional(),
    },
    async ({ data }) => {
      const res = await handleGetGradeProjection(data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'get_compliance_report',
    'Módulo de Ejecución: vista de salud del hábito (US6), de solo lectura. Días con evaluación desglosada (tandas_completadas/min_requerido/cumplio_tandas/cumplio_habitos/day_fulfilled), days_fulfilled, aperturas_plan (solo semana, no planeación), hábitos por fracción (sin los de 0 días activos), tandas (por materia, con solo los minutos de los tramos dentro del rango), disparadores, razones de interrupción, ediciones tardías, registros_tardios { total, minutos }, correcciones { total, minutos_recortados } (contadas por la semana local de la corrección), días cumplidos acumulados y horizonte.',
    {
      data: z.any().optional(),
    },
    async ({ data }) => {
      const res = await handleGetComplianceReport(data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_weekly_report',
    'Módulo de Ejecución: destinatario del reporte semanal y su ciclo de vida (US6). set_partner/read_partner/preview/set_note/send/read/run_tick. El congelamiento (domingo 19:00) y el envío (tras la ventana de nota de 60 min) los hace el tick; run_tick lo dispara una vez con el mailer real y es idempotente (FR-039).',
    {
      action: z.enum(['set_partner', 'read_partner', 'preview', 'set_note', 'send', 'read', 'run_tick']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageWeeklyReport(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_tasks',
    'Módulo de Ejecución: tarea de 1 a 3 tandas ligada a una materia (US8). create/read/update/delete/today. Más de 3 tandas se rechaza con PARTIR_TAREA; today nunca arrastra las de ayer.',
    {
      action: z.enum(['create', 'read', 'update', 'delete', 'today']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageTasks(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'plan_week',
    'Módulo de Ejecución: planeación del domingo y vista de semana (US8-US9-B1). preview/set_intentions/open_view. El reparto sugerido sale de la norma de créditos (urgencia y proyección aparte) y excluye materias con intención < 6. open_view abre la vista de una semana (indicada o resuelta): si es futura, apertura de planeación sin compuerta; si es en curso, compuerta normal (2 aperturas libres, desde la 3.ª pide razón). Devuelve la rejilla de disparadores y tandas por día, sin gráficas.',
    {
      action: z.enum(['preview', 'set_intentions', 'open_view']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handlePlanWeek(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_friction',
    'Registrar y gestionar medidas de fricción del teléfono (US-B5). Pure solo registra; el sistema operativo ejecuta. Máximo 2 simultáneas. Calificación semanal (0-10); dos semanas consecutivas ≥7 retiran la más recientemente habilitada.',
    {
      action: z.enum(['enable', 'disable', 'verify', 'rate', 'read']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageFriction(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_objectives',
    'Módulo de Ejecución: objetivos propios (LeetCode, Inglés...) a los que se ligan las sesiones de foco (US-F2). create/read/update/archive. Nombre único entre activos (OBJETIVO_DUPLICADO), materia y meta semanal opcionales; no se borran, se archivan (archive es idempotente; un archivado no se edita ni admite sesiones nuevas: OBJETIVO_ARCHIVADO). Una sesión de un objetivo sin materia suma minutos de foco pero no cuenta para el mínimo diario.',
    {
      action: z.enum(['create', 'read', 'update', 'archive']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageObjectives(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcpServer.tool(
    'manage_quotes',
    'Módulo de Ejecución: frases latinas de la línea del día en Hoy (US-F5). Solo MCP. create/create_many/read/update/deactivate. Carga inicial una sola vez con create_many y el contenido de specs/004-foco-cronometro/frases.json: todo o nada e idempotente por texto latino (sin distinguir mayúsculas ni espacios en los extremos), responde { creadas, omitidas }. create devuelve la existente si ya estaba; read lista las activas (include_inactive las desactivadas); update no cambia el id; deactivate saca la frase de la rotación de frase_del_dia en get_today.',
    {
      action: z.enum(['create', 'create_many', 'read', 'update', 'deactivate']),
      data: z.any().optional(),
    },
    async ({ action, data }) => {
      const res = await handleManageQuotes(action, data);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  return mcpServer;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createRequestHandler(opts?: { secretKey?: string; oauthStore?: OAuthStore }): (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> {
  const secretKey = opts?.secretKey || process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN;
  const oauthStore = opts?.oauthStore || globalOAuthStore;
  const activeTransports = new Map<string, SSEServerTransport>();

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // 1. Set CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${process.env.MCP_PORT || 3001}`;
    const protocol = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
    const baseUrl = `${protocol}://${hostHeader}`;

    const url = new URL(req.url || '/', baseUrl);
    const normalizedPath = url.pathname.replace(/\/$/, '') || '/';

    // 2. TAREA 3: Order of Routing - ALL .well-known routes FIRST (matching with startsWith)
    if (normalizedPath.startsWith('/.well-known/oauth-protected-resource')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          resource: baseUrl,
          authorization_servers: [baseUrl],
          scopes_supported: ['mcp'],
          bearer_methods_supported: ['header'],
        })
      );
      return;
    }

    if (
      normalizedPath.startsWith('/.well-known/oauth-authorization-server') ||
      normalizedPath.startsWith('/.well-known/openid-configuration')
    ) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/oauth/authorize`,
          token_endpoint: `${baseUrl}/oauth/token`,
          registration_endpoint: `${baseUrl}/oauth/register`,
          scopes_supported: ['mcp'],
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
        })
      );
      return;
    }

    // 3. Health check GET /health & Root Info GET /
    if (normalizedPath.endsWith('/health')) {
      return handleHealthCheck(req, res);
    }

    if (normalizedPath === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          server: 'pure-mcp-server',
          version: '1.0.0',
          message: 'Servidor MCP de Pure Academic activo.',
          endpoints: {
            health: `${baseUrl}/health`,
            sse: `${baseUrl}/sse`,
            mcp: `${baseUrl}/mcp`,
          },
        })
      );
      return;
    }

    // 4. OAuth 2.0 PKCE Endpoints
    if (normalizedPath === '/oauth/register' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        let payload: any = {};
        try {
          if (body) payload = JSON.parse(body);
        } catch (e) {}

        try {
          const client = await oauthStore.registerClient(payload);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              client_id: client.clientId,
              client_name: client.clientName,
              redirect_uris: client.redirectUris,
              token_endpoint_auth_method: client.tokenEndpointAuthMethod,
            })
          );
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'invalid_request',
              error_description: err.message || 'Invalid registration request',
            })
          );
        }
      });
      return;
    }

    if (normalizedPath === '/oauth/authorize' && req.method === 'GET') {
      const redirectUri = url.searchParams.get('redirect_uri');
      const state = url.searchParams.get('state') || '';
      const clientId = url.searchParams.get('client_id') || '';
      const codeChallenge = url.searchParams.get('code_challenge') || '';
      const codeChallengeMethod = url.searchParams.get('code_challenge_method') || 'S256';

      if (!redirectUri || !(await oauthStore.isValidRedirectUri(redirectUri, clientId))) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing or invalid redirect_uri' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pure Academic - Consentimiento OAuth</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 100%; max-width: 400px; border: 1px solid #334155; }
            h2 { margin-top: 0; color: #38bdf8; text-align: center; }
            p { font-size: 0.95rem; color: #94a3b8; line-height: 1.5; }
            input[type="password"] { width: 100%; padding: 0.75rem; margin: 1rem 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box; }
            button { width: 100%; padding: 0.75rem; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
            button:hover { background: #0369a1; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Pure Academic MCP</h2>
            <p>Conectar con el cliente OAuth (${escapeHtml(clientId || 'Claude Web')}). Ingrese su clave de API (MCP_API_KEY) para autorizar:</p>
            <form method="POST" action="${baseUrl}/oauth/authorize">
              <input type="hidden" name="client_id" value="${escapeHtml(clientId)}" />
              <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}" />
              <input type="hidden" name="state" value="${escapeHtml(state)}" />
              <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}" />
              <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}" />
              <input type="password" name="password" placeholder="MCP API Key" required autofocus />
              <button type="submit">Autorizar Conexión</button>
            </form>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (normalizedPath === '/oauth/authorize' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const params = new URLSearchParams(body);
        const password = params.get('password') || '';
        const clientId = params.get('client_id') || '';
        const redirectUri = params.get('redirect_uri') || '';
        const state = params.get('state') || '';
        const codeChallenge = params.get('code_challenge') || '';
        const codeChallengeMethod = params.get('code_challenge_method') || 'S256';

        const effectiveSecret = secretKey || process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN || '';
        const passHash = crypto.createHash('sha256').update(password.trim()).digest();
        const secretHash = crypto.createHash('sha256').update(effectiveSecret.trim()).digest();
        const isValid = crypto.timingSafeEqual(passHash, secretHash);

        if (!isValid) {
          res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Error de Autenticación</title></head>
            <body style="background:#0f172a;color:#ef4444;font-family:sans-serif;text-align:center;padding-top:50px;">
              <h2>❌ Clave MCP_API_KEY Incorrecta</h2>
              <p><a href="javascript:history.back()" style="color:#38bdf8;">Intentar nuevamente</a></p>
            </body>
            </html>
          `);
          return;
        }

        if (!redirectUri || !(await oauthStore.isValidRedirectUri(redirectUri, clientId))) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Invalid redirect_uri' }));
          return;
        }

        const code = await oauthStore.createAuthCode({
          clientId,
          redirectUri,
          codeChallenge,
          codeChallengeMethod,
        });

        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);

        res.writeHead(302, { Location: redirectUrl.toString() });
        res.end();
      });
      return;
    }

    if (normalizedPath === '/oauth/token' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        let grantType = '';
        let code = '';
        let clientId = '';
        let redirectUri = '';
        let codeVerifier = '';

        if (req.headers['content-type']?.includes('application/json')) {
          try {
            const json = JSON.parse(body);
            grantType = json.grant_type || '';
            code = json.code || '';
            clientId = json.client_id || '';
            redirectUri = json.redirect_uri || '';
            codeVerifier = json.code_verifier || '';
          } catch (e) {}
        } else {
          const params = new URLSearchParams(body);
          grantType = params.get('grant_type') || '';
          code = params.get('code') || '';
          clientId = params.get('client_id') || '';
          redirectUri = params.get('redirect_uri') || '';
          codeVerifier = params.get('code_verifier') || '';
        }

        if (grantType !== 'authorization_code') {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' }));
          return;
        }

        const result = await oauthStore.verifyAndConsumeAuthCode({
          code,
          clientId,
          redirectUri,
          codeVerifier,
        });

        if (!result.valid) {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: result.error || 'invalid_grant', error_description: result.errorDescription }));
          return;
        }

        const accessToken = await oauthStore.createAccessToken(clientId);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(
          JSON.stringify({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 86400,
          })
        );
      });
      return;
    }

    try {
      // 5. Authentication check for protected routes (/mcp, /sse, /messages)
      if (!(await validateMcpAuth(req, secretKey, oauthStore))) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Unauthorized: Missing or invalid Bearer token / API Key' },
            id: null,
          })
        );
        return;
      }

      // 6. Streamable HTTP on /mcp (Stateless Mode)
      if (normalizedPath === '/mcp' || normalizedPath.endsWith('/mcp')) {
        // DELETE /mcp -> 405 with JSON-RPC error
        if (req.method === 'DELETE') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32601, message: 'Method not allowed in stateless mode' },
              id: null,
            })
          );
          return;
        }

        // GET /mcp without Accept: text/event-stream -> Informational JSON
        if (req.method === 'GET' && !req.headers.accept?.includes('text/event-stream')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'ok',
              server: 'pure-mcp-server',
              version: '1.0.0',
              message: 'Servidor MCP de Pure Academic activo.',
              endpoints: {
                health: `${baseUrl}/health`,
                sse: `${baseUrl}/sse`,
                mcp: `${baseUrl}/mcp`,
              },
            })
          );
          return;
        }

        // GET /mcp with Accept: text/event-stream -> Stream Transport
        if (req.method === 'GET' && req.headers.accept?.includes('text/event-stream')) {
          res.setHeader('X-Accel-Buffering', 'no');
          const pingInterval = setInterval(() => {
            if (!res.writableEnded) {
              res.write(': ping\n\n');
            }
          }, 25000);

          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          const mcpInstance = createMcpServerInstance();
          await mcpInstance.connect(transport);

          res.on('close', () => {
            clearInterval(pingInterval);
            transport.close().catch(() => {});
            mcpInstance.close().catch(() => {});
          });

          try {
            await transport.handleRequest(req, res);
          } catch (err: any) {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32603, message: err.message || 'Internal error' },
                  id: null,
                })
              );
            }
          }
          return;
        }

        // POST /mcp -> Streamable HTTP Stateless JSON-RPC
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            let parsedBody: any;
            try {
              parsedBody = body ? JSON.parse(body) : {};
            } catch (e: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32700, message: 'Parse error: Invalid JSON' },
                  id: null,
                })
              );
              return;
            }

            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
            const mcpInstance = createMcpServerInstance();
            await mcpInstance.connect(transport);

            res.on('close', () => {
              transport.close().catch(() => {});
              mcpInstance.close().catch(() => {});
            });

            try {
              await transport.handleRequest(req, res, parsedBody);
            } catch (err: any) {
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: err.message || 'Internal error' },
                    id: parsedBody?.id ?? null,
                  })
                );
              }
            }
          });
          return;
        }
      }

      // 7. Handle SSE connections (stateful compatibility)
      if (normalizedPath.endsWith('/sse')) {
        res.setHeader('X-Accel-Buffering', 'no');
        const pingInterval = setInterval(() => {
          if (!res.writableEnded) {
            res.write(': ping\n\n');
          }
        }, 25000);

        const searchParams = url.search ? url.search : '';
        const basePath = url.pathname.replace(/\/sse$/, '');
        const messagesPath = `${basePath}/messages${searchParams}`;

        const transport = new SSEServerTransport(messagesPath, res);
        const mcpServer = createMcpServerInstance();
        await mcpServer.connect(transport);

        const sid = transport.sessionId;
        activeTransports.set(sid, transport);

        res.on('close', () => {
          clearInterval(pingInterval);
        });

        const originalOnClose = transport.onclose;
        transport.onclose = () => {
          originalOnClose?.();
          activeTransports.delete(sid);
        };

        return;
      }

      // 8. Handle messages
      if (normalizedPath.endsWith('/messages')) {
        const sessionId = url.searchParams.get('sessionId') || (req.headers['mcp-session-id'] as string);
        if (!sessionId || typeof sessionId !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing sessionId parameter' }));
          return;
        }

        const transport = activeTransports.get(sessionId);
        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        await transport.handlePostMessage(req, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
    } catch (err) {
      console.error('Unhandled error in HTTP handler:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal Server Error' },
            id: null,
          })
        );
      }
    }
  };
}

async function main() {
  const port = Number(process.env.MCP_PORT || 3001);
  const rawKey = process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN;
  const secretKey = rawKey ? rawKey.trim() : undefined;

  if (!secretKey) {
    console.error('❌ Error fatal: MCP_API_KEY / MCP_AUTH_TOKEN no está configurado en el entorno.');
    process.exit(1);
  }

  const handler = createRequestHandler({ secretKey });
  const httpServer = http.createServer(handler);

  httpServer.listen(port, '0.0.0.0', () => {
    console.error(`====================================================`);
    console.error(`🚀 Servidor MCP de Pure listo en http://0.0.0.0:${port}`);
    console.error(`🔑 Autenticación API Key activada: ${secretKey.substring(0, 10)}...`);
    console.error(`🏥 Endpoint de Salud: http://0.0.0.0:${port}/health`);
    console.error(`====================================================`);
  });

  if (process.env.MCP_STDIO === 'true') {
    const stdioTransport = new StdioServerTransport();
    const instance = createMcpServerInstance();
    await instance.connect(stdioTransport);
    console.error('Servidor MCP de Pure conectado vía stdio');
  }

  startExecutionScheduler();
}

/**
 * US6/FR-039: el tick que congela y envía el reporte semanal (y, más adelante, US7) tiene que
 * correr aunque nadie abra la app. `EXECUTION_SCHEDULER=on` (docker-compose.yml: solo en
 * `pure-mcp`, nunca en `pure-web`, para no correrlo dos veces) lo activa; sin la variable, el
 * proceso no hace nada distinto de hoy. Guardia anti-solapamiento: si un tick todavía no termina
 * cuando toca el siguiente intervalo, ese intervalo se salta en vez de apilar llamadas.
 * `.unref()` para que este timer nunca sea, por sí solo, la razón de que el proceso siga vivo.
 */
function startExecutionScheduler(): void {
  if (process.env.EXECUTION_SCHEDULER !== 'on') return;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runExecutionTick(new Date(), { mailer: createZeptoMailer() });
      if (result.frozen || result.sent || result.failed) {
        console.error(
          `[execution-tick] frozen=${result.frozen} sent=${result.sent} failed=${result.failed} notified=${result.notified}`
        );
      }
    } catch (error: any) {
      console.error('[execution-tick] error inesperado:', error?.message || error);
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, 20_000).unref();
  console.error('[execution-tick] scheduler activo (EXECUTION_SCHEDULER=on), cada 20s');
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Error fatal en el Servidor MCP de Pure:', err);
    process.exit(1);
  });
}
