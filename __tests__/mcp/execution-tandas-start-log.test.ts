import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageTandas } from '../../lib/execution/handlers';

// US-T3, Escenario AS4: un `start` rechazado (validación o regla de negocio) deja una línea de log.
// Incidente del 21-sep: un rechazo no quedó rastro ninguno porque handleManageTandas solo
// hacía console.error en el catch de error inesperado, no en los rechazos esperados.

describe('[US-T3-AS4] Logging de rechazos en start de tandas', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('US-T3-AS4 · un start rechazado por validación (DATOS_INVALIDOS) deja una línea en el log', async () => {
    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 999 está fuera de cualquier rango válido de minutos
    const res = await handleManageTandas('start', { planned_minutes: 999 });

    expect(res.status).toBe('error');
    if (res.status === 'error') {
      expect(res.code).toBe('DATOS_INVALIDOS');
    }

    // Debe haber dejado una línea de log con el código de error
    expect(warnSpy).toHaveBeenCalled();
    // console.warn se llama como: console.warn('[execution] start rechazado:', code, message)
    // Verificamos que los argumentos contengan el código de error
    const allArgs = warnSpy.mock.calls[0];
    expect(allArgs.join(' ')).toContain('DATOS_INVALIDOS');

    warnSpy.mockRestore();
  });

  it('US-T3-AS4 · un start rechazado por regla de negocio (TANDA_EN_CURSO) deja una línea en el log', async () => {
    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));

    // Empezar una tanda válida
    const first = await handleManageTandas('start', {});
    expect(first.status).toBe('success');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Intentar empezar otra mientras la primera sigue en curso
    vi.setSystemTime(new Date('2026-09-21T15:03:00.000Z')); // todavía no se cumplen los 10 min
    const second = await handleManageTandas('start', {});

    expect(second.status).toBe('error');
    if (second.status === 'error') {
      expect(second.code).toBe('TANDA_EN_CURSO');
    }

    // Debe haber dejado una línea de log con el código de error
    expect(warnSpy).toHaveBeenCalled();
    // console.warn se llama como: console.warn('[execution] start rechazado:', code, message)
    // Verificamos que los argumentos contengan el código de error
    const allArgs = warnSpy.mock.calls[0];
    expect(allArgs.join(' ')).toContain('TANDA_EN_CURSO');

    warnSpy.mockRestore();
  });

  it('US-T3-AS4 · un start exitoso no escribe en el log', async () => {
    vi.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await handleManageTandas('start', {});

    expect(res.status).toBe('success');

    // No debe haber log cuando es exitoso
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
