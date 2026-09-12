import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageTandas } from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects } from '../../mcp-server/tools-handler';

// US1 — Tanda de 10 minutos en un toque (FR-001..FR-008). manage_tandas es la herramienta MCP
// de la tanda: toda hora sale del reloj del servidor (nunca del cliente), como máximo una tanda
// en curso a la vez (running_lock UNIQUE), y finalizeElapsed corre al principio de cada acción
// para cerrar sola una tanda cuyo tiempo ya se cumplió, aunque nadie la haya tocado.

describe('[001] US1 — Tanda de 10 minutos en un toque', () => {
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

  it('US1-AS1 · empezar una tanda la deja en curso con la hora de inicio del sistema y el fin previsto 10 minutos después', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));

    const res = await handleManageTandas('start', {});
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;

    const { tanda, ends_at } = res.data as any;
    expect(tanda.status).toBe('en_curso');
    expect(tanda.running_lock).toBe('running');
    expect(tanda.planned_minutes).toBe(10);
    expect(new Date(tanda.started_at).toISOString()).toBe('2026-09-14T15:00:00.000Z');
    expect(ends_at).toBe('2026-09-14T15:10:00.000Z');
  });

  it('US1-AS2 · con una tanda en curso, empezar otra se rechaza (ya hay una tanda en curso)', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const first = await handleManageTandas('start', {});
    expect(first.status).toBe('success');

    vi.setSystemTime(new Date('2026-09-14T15:03:00.000Z')); // todavía no se cumplen los 10 min
    const second = await handleManageTandas('start', {});
    expect(second.status).toBe('error');
    if (second.status === 'error') expect(second.code).toBe('TANDA_EN_CURSO');
  });

  it('US1-AS3 · una tanda cuyo tiempo ya se cumplió queda completada (10 min) en cualquier operación posterior', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', {});
    expect(start.status).toBe('success');
    if (start.status !== 'success') return;
    const tandaId = (start.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-14T15:10:01.000Z')); // pasado el tiempo planeado
    const current = await handleManageTandas('current', {}); // "cualquier operación" del módulo
    expect(current.status).toBe('success');
    if (current.status === 'success') {
      expect((current.data as any).tanda).toBeNull(); // ya no hay tanda en curso: se cerró sola
    }

    const read = await handleManageTandas('read', {});
    expect(read.status).toBe('success');
    if (read.status === 'success') {
      const closed = (read.data as any).tandas.find((t: any) => t.id === tandaId);
      expect(closed.status).toBe('completada');
      expect(closed.actual_minutes).toBe(10);
      expect(closed.running_lock).toBeNull();
    }

    const second = await handleManageTandas('start', {}); // puedo empezar otra
    expect(second.status).toBe('success');
  });

  it('US1-AS4 · terminar una tanda a la que le queda tiempo se rechaza: solo se puede interrumpir', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', {});
    if (start.status !== 'success') return;
    const tandaId = (start.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-14T15:02:00.000Z')); // le quedan 8 minutos
    const res = await handleManageTandas('finish', { id: tandaId });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('TANDA_NO_TERMINADA');
  });

  it('US1-AS5 · interrumpir sin razón se rechaza; con una razón de una línea queda interrumpida con los minutos reales', async () => {
    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const start = await handleManageTandas('start', {});
    if (start.status !== 'success') return;
    const tandaId = (start.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-14T15:03:00.000Z')); // 3 minutos transcurridos
    const withoutReason = await handleManageTandas('interrupt', { id: tandaId, interrupt_reason: '' });
    expect(withoutReason.status).toBe('error');
    if (withoutReason.status === 'error') expect(withoutReason.code).toBe('RAZON_REQUERIDA');

    const withReason = await handleManageTandas('interrupt', { id: tandaId, interrupt_reason: 'me llamaron' });
    expect(withReason.status).toBe('success');
    if (withReason.status === 'success') {
      const tanda = withReason.data as any;
      expect(tanda.status).toBe('interrumpida');
      expect(tanda.actual_minutes).toBe(3);
      expect(tanda.interrupt_reason).toBe('me llamaron');
      expect(tanda.running_lock).toBeNull();
    }
  });

  it('US1-AS6 · cambiar la materia de una tanda cerrada después de las 03:00 se guarda y queda marcada como editada tras el cierre', async () => {
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' });
    await handleManageSubjects('create', { id: 'sub-calculo', university_id: 'uni-1', name: 'Cálculo' });

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z')); // 10:00 Bogotá, lunes 14
    const start = await handleManageTandas('start', {});
    if (start.status !== 'success') return;
    const tandaId = (start.data as any).tanda.id;

    vi.setSystemTime(new Date('2026-09-14T15:10:01.000Z')); // se cierra sola a los 10 min
    await handleManageTandas('current', {}); // dispara finalizeElapsed

    vi.setSystemTime(new Date('2026-09-15T09:00:00.000Z')); // 04:00 Bogotá del día siguiente (> 03:00)
    const res = await handleManageTandas('update', { id: tandaId, subject_id: 'sub-calculo' });
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      const tanda = res.data as any;
      expect(tanda.subject_id).toBe('sub-calculo');
      expect(tanda.edited_after_lock).toBe(true);
    }
  });

  it('US1-AS7 · una tanda empezada a las 23:55 hora de Bogotá cuenta para el día en que empezó', async () => {
    vi.setSystemTime(new Date('2026-09-15T04:55:00.000Z')); // 23:55 Bogotá del 14 de septiembre
    const res = await handleManageTandas('start', {});
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect((res.data as any).tanda.local_date).toBe('2026-09-14');
    }
  });

  it('start rechaza started_at en data (la hora siempre la fija el servidor) → DATOS_INVALIDOS', async () => {
    const res = await handleManageTandas('start', { started_at: '2020-01-01T00:00:00.000Z' } as any);
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('DATOS_INVALIDOS');
  });

  it('finish e interrupt sobre un id inexistente devuelven NO_ENCONTRADO', async () => {
    const finishRes = await handleManageTandas('finish', { id: 'no-existe' });
    expect(finishRes.status).toBe('error');
    if (finishRes.status === 'error') expect(finishRes.code).toBe('NO_ENCONTRADO');

    const interruptRes = await handleManageTandas('interrupt', { id: 'no-existe', interrupt_reason: 'motivo' });
    expect(interruptRes.status).toBe('error');
    if (interruptRes.status === 'error') expect(interruptRes.code).toBe('NO_ENCONTRADO');
  });
});
