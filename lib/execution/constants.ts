// Constantes del Módulo de Ejecución. Los rangos se usan tanto en los esquemas Zod
// (lib/validations/schemas.ts) como en los servicios (lib/execution/*), para no repetir los
// números mágicos de spec.md en dos lugares distintos.

/** FR-T01 / FR-F02: la pantalla de inicio usa 10 minutos; el temporizador acepta de 10 a 180.
 * El tope pasó de 60 a 180 en la 004 (FR-F02); `log_late` tiene sus propias cotas (LATE_LOG_*).
 * TANDA_DURATION_OPTIONS se usa en la UI (10, 25, 40, 60 minutos, cada uno iniciando la tanda). */
export const TANDA_MINUTES_DEFAULT = 10;
export const TANDA_MINUTES_MIN = 10;
export const TANDA_MINUTES_MAX = 180;
export const TANDA_UNIT_MINUTES = 10;
export const TANDA_DURATION_OPTIONS = [10, 25, 40, 60] as const;

/** FR-T11/US-T2 (003): cotas propias de `log_late`, separadas de TANDA_MINUTES_* para que subir
 * el tope del temporizador en la 004 no las afecte. Sin cambios en la 004. */
export const LATE_LOG_MIN_MINUTES = 10;
export const LATE_LOG_MAX_MINUTES = 60;

/** US-F1: tiempo mínimo que debe transcurrir en el cronómetro para poder cerrarlo (1 min). */
export const CRONOMETRO_MIN_FINISH_SECONDS = 60;

/** US-F4: razón obligatoria de una corrección de cronómetro. */
export const CORRECTION_REASON_MIN = 1;
export const CORRECTION_REASON_MAX = 140;

/** US-F2: nombre del objetivo. */
export const OBJECTIVE_NAME_MAX = 60;

/** US-F2: meta semanal de minutos de foco. */
export const WEEKLY_TARGET_MAX_MINUTES = 10080;

/** US-F5: límites de un latín y su traducción/fuente. */
export const QUOTE_TEXT_MAX = 300;
export const QUOTE_TRANSLATION_MAX = 300;
export const QUOTE_SOURCE_MAX = 120;

/** US-F5: tamaño máximo de un lote de frases. */
export const QUOTE_BATCH_MAX = 200;

/** US-F3: rango de semanas para el resumen de foco. */
export const FOCUS_WEEKS_DEFAULT = 52;
export const FOCUS_WEEKS_MAX = 53;

/** US-F3: semanas mostradas en Hoy. */
export const TODAY_HEATMAP_WEEKS = 12;

/** US-F3: límites de minutos para cada nivel del mapa de calor. */
export const HEAT_LEVEL_BOUNDS = [30, 90, 180] as const;

/** FR-T11/US-T2: `log_late` solo acepta sesiones que empezaron dentro de esta ventana hacia
 * atrás (horas), contada desde el reloj del servidor. Es la única entrada del módulo que acepta
 * instantes del cliente -- excepción deliberada y acotada al Principio III (plan.md). */
export const LATE_LOG_MAX_HOURS_BACK = 6;

/** FR-T12/US-T2: como máximo esta cantidad de registros tardíos por día local -- el límite existe
 * para que `log_late` no reemplace el hábito de darle iniciar. */
export const LATE_LOG_MAX_PER_DAY = 3;

/** FR-011: un disparador sin responder deja de mostrarse pasadas 4 horas de su ancla. */
export const TRIGGER_WINDOW_MINUTES = 240;

/** FR-007: los datos de un día cierran a las 03:00 del día siguiente (hora local). */
export const DAY_LOCK_TIME = '03:00';

/** FR-019: el reporte semanal se congela el domingo a esta hora local. */
export const REPORT_FREEZE_TIME = '19:00';

/** FR-020: minutos de ventana para escribir la nota, contados desde el congelamiento. */
export const REPORT_NOTE_MINUTES = 60;

/** FR-009: rangos de los textos de un disparador "Si <señal>, entonces <acción>". */
export const CUE_TEXT_MIN = 5;
export const CUE_TEXT_MAX = 80;
export const ACTION_TEXT_MIN = 5;
export const ACTION_TEXT_MAX = 90;

/** FR-003: razón obligatoria de una línea al interrumpir una tanda. */
export const INTERRUPT_REASON_MIN = 1;
export const INTERRUPT_REASON_MAX = 140;

/** FR-020: nota del usuario en el reporte semanal. */
export const USER_NOTE_MAX = 400;

/** FR-023: como máximo 3 intentos de envío del reporte, espaciados en el tiempo. */
export const REPORT_MAX_ATTEMPTS = 3;

/**
 * FR-022: veredicto semanal según los días cumplidos sobre 7.
 * >= VERDICT_CUMPLIDA_MIN_DAYS -> 'cumplida'; <= VERDICT_FALLIDA_MAX_DAYS -> 'fallida';
 * el resto -> 'parcial'. La función que aplica esta regla (`computeVerdict`) vive en
 * lib/domain/execution.ts (US6), junto al resto de la lógica pura del reporte.
 */
export const VERDICT_CUMPLIDA_MIN_DAYS = 6;
export const VERDICT_FALLIDA_MAX_DAYS = 3;

/** FR-022: umbral de la sección "En riesgo" para "necesita 3.5 o más en lo que falta para
 * aprobar". Es un número fijo del plan aprobado, no derivado de ninguna escala. */
export const RISK_NEEDED_TO_PASS_THRESHOLD = 3.5;

/**
 * US6-AS8: cuánto tiene que exceder `now` al corte del domingo 19:00 para que un congelamiento
 * se marque `late` (Pure estuvo apagado), en vez de la demora normal de hasta ~20s entre ticks.
 * Decisión de implementación (no numerada en la spec): mayor que el intervalo del tick (20s) y
 * lo bastante chica para no confundir un reinicio real con una demora operativa.
 */
export const FREEZE_LATE_THRESHOLD_MINUTES = 5;

/** US6: como máximo 3 intentos de envío (ya en REPORT_MAX_ATTEMPTS) espaciados 10 minutos. */
export const REPORT_RETRY_BACKOFF_MINUTES = 10;

/** US6: un reporte que lleva más de 15 minutos en 'enviando' vuelve a 'congelado' (intento
 * colgado: el proceso que lo reclamó murió antes de terminar el envío). */
export const REPORT_STUCK_SENDING_MINUTES = 15;

/** US-B5: límite máximo de medidas de fricción habilitadas simultáneamente (FR-B17). */
export const FRICTION_MAX_ENABLED = 2;

/** US-B5: slots de la base para habilitar medidas de fricción ('a' y 'b') (FR-B17). */
export const FRICTION_SLOTS = ['a', 'b'] as const;

/** US-B5: umbral de irritación para aplicar retiros automáticos (dos semanas consecutivas >= 7) (FR-B20). */
export const FRICTION_IRRITATION_THRESHOLD = 7;

/** US-B5: mensaje de error cuando se intenta habilitar una tercera medida (FR-B17). */
export const FRICTION_LIMIT_MESSAGE =
  'Ya hay 2 medidas de fricción habilitadas. El límite existe porque la restricción parcial aumenta el estrés reportado y una medida abandonada por irritación vale 0: dos sostenibles valen más que cinco abandonadas. Deshabilita una antes de agregar otra.';
