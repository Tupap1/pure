// Constantes del Módulo de Ejecución. Los rangos se usan tanto en los esquemas Zod
// (lib/validations/schemas.ts) como en los servicios (lib/execution/*), para no repetir los
// números mágicos de spec.md en dos lugares distintos.

/** FR-001: la pantalla de inicio siempre usa 10 minutos; el rango 5-25 es para el asistente de IA. */
export const TANDA_MINUTES_DEFAULT = 10;
export const TANDA_MINUTES_MIN = 5;
export const TANDA_MINUTES_MAX = 25;

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
