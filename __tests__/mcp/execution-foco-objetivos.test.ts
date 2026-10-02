import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageObjectives,
  handleManageTandas,
  handleManageProgram,
  handleGetToday,
  handleGetComplianceReport,
} from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects } from '../../mcp-server/tools-handler';
import { POST } from '@/app/api/execution/route';

// US-F2 (004) -- Objetivos. Un objetivo es una etiqueta propia (LeetCode, Inglés, Algoritmos) con
// materia y meta semanal opcionales; las sesiones se ligan a él y la regla única `countsTowardMinimum`
// (lib/domain/focus.ts) decide si cuentan para el mínimo diario: una sesión de un objetivo SIN
// materia suma minutos de foco pero no unidades. Bogotá es UTC-5: las 10:00 locales del lunes
// 14-sep son 2026-09-14T15:00:00Z. El día se cierra a las 03:00 locales (08:00Z) del siguiente.

const MON_10H = '2026-09-14T15:00:00.000Z'; // lunes 14 10:00 local

async function setupProgram(minTandasDia = 3) {
  return handleManageProgram('init', {
    starts_on: '2026-09-14', // lunes
    weeks: [{ min_tandas_dia: minTandasDia, phase: 'arranque' }],
  });
}

function dataOf(res: any): any {
  expect(res.status).toBe('success');
  return res.status === 'success' ? res.data : undefined;
}

function expectError(res: any, code: string) {
  expect(res.status).toBe('error');
  if (res.status === 'error') expect(res.code).toBe(code);
}

async function createObjective(data: Record<string, unknown>): Promise<any> {
  return dataOf(await handleManageObjectives('create', data));
}

async function readObjectives(data: Record<string, unknown> = {}): Promise<any[]> {
  return dataOf(await handleManageObjectives('read', data)).objetivos;
}

async function readAllTandas(data: Record<string, unknown> = {}): Promise<any[]> {
  return dataOf(await handleManageTandas('read', data)).tandas;
}

/** Cronómetro de `minutes` minutos desde `startIso`, ligado a `objectiveId` si viene. */
async function runCronometro(startIso: string, minutes: number, objectiveId?: string): Promise<any> {
  vi.setSystemTime(new Date(startIso));
  const start = dataOf(
    await handleManageTandas('start', { kind: 'cronometro', ...(objectiveId ? { objective_id: objectiveId } : {}) })
  );
  vi.setSystemTime(new Date(new Date(startIso).getTime() + minutes * 60_000));
  return dataOf(await handleManageTandas('finish', { id: start.tanda.id }));
}

/** Temporizador de `minutes` minutos desde `startIso`, terminado a tiempo. */
async function runTemporizador(startIso: string, minutes: number, objectiveId?: string): Promise<any> {
  vi.setSystemTime(new Date(startIso));
  const start = dataOf(
    await handleManageTandas('start', { planned_minutes: minutes, ...(objectiveId ? { objective_id: objectiveId } : {}) })
  );
  vi.setSystemTime(new Date(new Date(startIso).getTime() + minutes * 60_000));
  return dataOf(await handleManageTandas('finish', { id: start.tanda.id }));
}

describe('[004] US-F2 — Objetivos', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
    // objetivos.subject_id y tandas.subject_id tienen FK a subjects: se necesitan materias reales.
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeC', scale_max: 5, passing_grade: 3.0 });
    await handleManageSubjects('create', { id: 'sub-algoritmos', university_id: 'uni-1', name: 'Algoritmos' });
    await handleManageSubjects('create', { id: 'sub-calculo', university_id: 'uni-1', name: 'Cálculo' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('US-F2-AS1 · crear "LeetCode" sin materia y con meta de 300 minutos lo deja activo y aparece al leer', async () => {
    expect(await readObjectives()).toEqual([]);

    const created = await createObjective({ name: 'LeetCode', weekly_target_minutes: 300 });
    expect(created.id).toMatch(/^objetivo-/);
    expect(created.name).toBe('LeetCode');
    expect(created.subject_id).toBeNull();
    expect(created.weekly_target_minutes).toBe(300);
    expect(created.archived).toBe(false);
    expect(created.archived_at).toBeNull();
    expect(created.active_name_key).toBe('leetcode');

    const objetivos = await readObjectives();
    expect(objetivos).toHaveLength(1);
    expect(objetivos[0]).toMatchObject({ id: created.id, name: 'LeetCode', weekly_target_minutes: 300, archived: false });

    // `read` sin `data` (como lo llamaría el MCP sin argumentos) equivale a `{}`.
    const noData = dataOf(await handleManageObjectives('read'));
    expect(noData.objetivos).toHaveLength(1);
  });

  it('US-F2-AS1 · un objetivo con materia existente la guarda y read los devuelve ordenados por nombre', async () => {
    await createObjective({ name: 'Proyecto personal' });
    const algoritmos = await createObjective({ name: 'Algoritmos', subject_id: 'sub-algoritmos' });
    await createObjective({ name: 'Inglés' });

    expect(algoritmos.subject_id).toBe('sub-algoritmos');
    expect(algoritmos.weekly_target_minutes).toBeNull();
    expect((await readObjectives()).map((o) => o.name)).toEqual(['Algoritmos', 'Inglés', 'Proyecto personal']);
  });

  it('US-F2-AS2 · " leetcode " duplicado, materia inexistente y metas 0, -5 o 10081 se rechazan sin crear nada', async () => {
    await createObjective({ name: 'LeetCode', weekly_target_minutes: 300 });

    expectError(await handleManageObjectives('create', { name: ' leetcode ' }), 'OBJETIVO_DUPLICADO');
    expectError(await handleManageObjectives('create', { name: 'LEETCODE' }), 'OBJETIVO_DUPLICADO');
    expectError(await handleManageObjectives('create', { name: 'Otro', subject_id: 'sub-no-existe' }), 'NO_ENCONTRADO');
    for (const meta of [0, -5, 10081]) {
      expectError(await handleManageObjectives('create', { name: 'Otro', weekly_target_minutes: meta }), 'DATOS_INVALIDOS');
    }
    // Forma inválida: meta no entera, nombre vacío o solo espacios, nombre de 61 caracteres, clave extra.
    expectError(await handleManageObjectives('create', { name: 'Otro', weekly_target_minutes: 30.5 }), 'DATOS_INVALIDOS');
    expectError(await handleManageObjectives('create', { name: '   ' }), 'DATOS_INVALIDOS');
    expectError(await handleManageObjectives('create', { name: 'x'.repeat(61) }), 'DATOS_INVALIDOS');
    expectError(await handleManageObjectives('create', { name: 'Otro', archived: true }), 'DATOS_INVALIDOS');

    // Ninguna fila nueva, ni siquiera archivada.
    expect(await readObjectives({ include_archived: true })).toHaveLength(1);
    const rows = await harness.pool.query('SELECT id FROM objetivos');
    expect(rows.rows).toHaveLength(1);
  });

  it('US-F2-AS2 · los límites válidos (nombre de 60 caracteres, meta 1 y meta 10080) se aceptan', async () => {
    await createObjective({ name: 'x'.repeat(60), weekly_target_minutes: 1 });
    await createObjective({ name: 'Maratón', weekly_target_minutes: 10080 });
    expect(await readObjectives()).toHaveLength(2);
  });

  it('US-F2-AS3 · start con un objetivo activo liga la sesión; con uno archivado o inexistente se rechaza sin crear filas', async () => {
    const leetcode = await createObjective({ name: 'LeetCode' });

    vi.setSystemTime(new Date(MON_10H));
    const started = dataOf(await handleManageTandas('start', { kind: 'cronometro', objective_id: leetcode.id }));
    expect(started.tanda.objective_id).toBe(leetcode.id);
    expect(started.tanda.status).toBe('en_curso');

    // La sesión en curso queda ligada y es visible en `current` y en Hoy.
    const current = dataOf(await handleManageTandas('current', {}));
    expect(current.tanda.objective_id).toBe(leetcode.id);
    const today = dataOf(await handleGetToday());
    expect(today.running_tanda.objective_id).toBe(leetcode.id);

    vi.setSystemTime(new Date('2026-09-14T15:02:00.000Z'));
    dataOf(await handleManageTandas('interrupt', { id: started.tanda.id, interrupt_reason: 'prueba' }));
    expect(await readAllTandas()).toHaveLength(1);

    // Archivado: OBJETIVO_ARCHIVADO, y no se crea ninguna fila.
    dataOf(await handleManageObjectives('archive', { id: leetcode.id }));
    expectError(await handleManageTandas('start', { objective_id: leetcode.id }), 'OBJETIVO_ARCHIVADO');
    expect(await readAllTandas()).toHaveLength(1);

    // Inexistente: NO_ENCONTRADO, y tampoco se crea nada.
    expectError(await handleManageTandas('start', { objective_id: 'objetivo-no-existe' }), 'NO_ENCONTRADO');
    expect(await readAllTandas()).toHaveLength(1);

    // El rechazo no deja una sesión en curso que bloquee la siguiente.
    const next = dataOf(await handleManageTandas('start', {}));
    expect(next.tanda.objective_id).toBeNull();
  });

  it('US-F2-AS4 · con el mínimo en 3, un cronómetro de 60 en "Inglés" (sin materia) da 0 unidades y el mínimo sin cumplir', async () => {
    await setupProgram(3);
    const ingles = await createObjective({ name: 'Inglés' });

    const closed = await runCronometro(MON_10H, 60, ingles.id);
    expect(closed.actual_minutes).toBe(60);
    expect(closed.objective_id).toBe(ingles.id);

    vi.setSystemTime(new Date('2026-09-14T16:05:00.000Z'));
    const today = dataOf(await handleGetToday());
    expect(today.unidades_hoy).toBe(0);
    expect(today.tandas_today).toBe(0);
    expect(today.evaluacion_dia).toMatchObject({
      tandas_completadas: 0,
      unidades_completadas: 0,
      min_requerido: 3,
      cumplio_tandas: false,
    });
    expect(today.day_fulfilled).toBe(false);

    // El reporte de cumplimiento coincide con Hoy (misma regla).
    const report = dataOf(await handleGetComplianceReport({ from: '2026-09-14', to: '2026-09-14' }));
    const dia = report.dias.find((d: any) => d.date === '2026-09-14');
    expect(dia.evaluacion_dia).toMatchObject({ tandas_completadas: 0, unidades_completadas: 0, cumplio_tandas: false });

    // La lectura de tandas suma los 60 minutos enfocados pero ninguna unidad.
    const read = dataOf(await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-14' }));
    expect(read.por_dia).toEqual([
      { date: '2026-09-14', completadas: 0, unidades: 0, interrumpidas: 0, minutos: 60 },
    ]);
  });

  it('US-F2-AS5 · con el mínimo en 3, un temporizador de 30 en "Algoritmos" (con materia) da 3 unidades y cumple el mínimo', async () => {
    await setupProgram(3);
    const algoritmos = await createObjective({ name: 'Algoritmos', subject_id: 'sub-algoritmos' });

    const closed = await runTemporizador(MON_10H, 30, algoritmos.id);
    expect(closed.status).toBe('completada');
    expect(closed.actual_minutes).toBe(30);

    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'));
    const today = dataOf(await handleGetToday());
    expect(today.unidades_hoy).toBe(3);
    expect(today.tandas_today).toBe(1);
    expect(today.evaluacion_dia).toMatchObject({
      tandas_completadas: 1,
      unidades_completadas: 3,
      min_requerido: 3,
      cumplio_tandas: true,
    });

    const report = dataOf(await handleGetComplianceReport({ from: '2026-09-14', to: '2026-09-14' }));
    const dia = report.dias.find((d: any) => d.date === '2026-09-14');
    expect(dia.evaluacion_dia).toMatchObject({ tandas_completadas: 1, unidades_completadas: 3, cumplio_tandas: true });

    const read = dataOf(await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-14' }));
    expect(read.por_dia).toEqual([
      { date: '2026-09-14', completadas: 1, unidades: 3, interrumpidas: 0, minutos: 30 },
    ]);
  });

  it('US-F2-AS8 · archive saca el objetivo de read por defecto; con include_archived aparece, con la hora del servidor, y es idempotente', async () => {
    const leetcode = await createObjective({ name: 'LeetCode', weekly_target_minutes: 300 });
    await createObjective({ name: 'Inglés' });

    vi.setSystemTime(new Date('2026-09-14T20:00:00.000Z'));
    const archived = dataOf(await handleManageObjectives('archive', { id: leetcode.id }));
    expect(archived.archived).toBe(true);
    expect(archived.active_name_key).toBeNull();
    expect(new Date(archived.archived_at).toISOString()).toBe('2026-09-14T20:00:00.000Z');

    expect((await readObjectives()).map((o) => o.name)).toEqual(['Inglés']);
    const all = await readObjectives({ include_archived: true });
    expect(all.map((o) => o.name)).toEqual(['Inglés', 'LeetCode']);
    expect(all.find((o) => o.id === leetcode.id)).toMatchObject({ archived: true, active_name_key: null });

    // Archivar otra vez no es un error y no mueve `archived_at`.
    vi.setSystemTime(new Date('2026-09-15T20:00:00.000Z'));
    const again = dataOf(await handleManageObjectives('archive', { id: leetcode.id }));
    expect(again.archived).toBe(true);
    expect(new Date(again.archived_at).toISOString()).toBe('2026-09-14T20:00:00.000Z');

    // Inexistente: NO_ENCONTRADO.
    expectError(await handleManageObjectives('archive', { id: 'objetivo-no-existe' }), 'NO_ENCONTRADO');
    expectError(await handleManageObjectives('archive', {}), 'DATOS_INVALIDOS');
  });

  it('US-F2-AS8 · archivar libera el nombre y start con el objetivo archivado se rechaza con OBJETIVO_ARCHIVADO', async () => {
    const leetcode = await createObjective({ name: 'LeetCode' });
    dataOf(await handleManageObjectives('archive', { id: leetcode.id }));

    vi.setSystemTime(new Date(MON_10H));
    expectError(await handleManageTandas('start', { objective_id: leetcode.id }), 'OBJETIVO_ARCHIVADO');
    expect(await readAllTandas()).toHaveLength(0);

    // El nombre queda libre para un objetivo nuevo, distinto del archivado.
    const nuevo = await createObjective({ name: 'leetcode' });
    expect(nuevo.id).not.toBe(leetcode.id);
    expect(nuevo.active_name_key).toBe('leetcode');
  });

  it('US-F2-AS8 · las tandas viejas de un objetivo archivado siguen sumando en readTandas().por_dia.minutos', async () => {
    const ingles = await createObjective({ name: 'Inglés' });
    await runCronometro(MON_10H, 60, ingles.id);

    const before = dataOf(await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-14' }));
    expect(before.por_dia).toEqual([expect.objectContaining({ date: '2026-09-14', minutos: 60 })]);

    dataOf(await handleManageObjectives('archive', { id: ingles.id }));

    const after = dataOf(await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-14' }));
    expect(after.tandas).toHaveLength(1);
    expect(after.tandas[0].objective_id).toBe(ingles.id);
    expect(after.por_dia).toEqual([expect.objectContaining({ date: '2026-09-14', minutos: 60 })]);
  });

  it('US-F2-AS8 · update de nombre, materia y meta valida igual que create y no deja cambios parciales al fallar', async () => {
    const leetcode = await createObjective({ name: 'LeetCode', weekly_target_minutes: 300 });
    const ingles = await createObjective({ name: 'Inglés', subject_id: 'sub-calculo', weekly_target_minutes: 120 });

    // Mismas validaciones que create.
    expectError(await handleManageObjectives('update', { id: ingles.id, name: ' leetcode ' }), 'OBJETIVO_DUPLICADO');
    expectError(await handleManageObjectives('update', { id: ingles.id, subject_id: 'sub-no-existe' }), 'NO_ENCONTRADO');
    for (const meta of [0, -5, 10081]) {
      expectError(await handleManageObjectives('update', { id: ingles.id, weekly_target_minutes: meta }), 'DATOS_INVALIDOS');
    }
    expectError(await handleManageObjectives('update', { id: ingles.id, name: '  ' }), 'DATOS_INVALIDOS');
    expectError(await handleManageObjectives('update', { id: 'objetivo-no-existe', name: 'X' }), 'NO_ENCONTRADO');
    expectError(await handleManageObjectives('update', { name: 'X' }), 'DATOS_INVALIDOS');
    expect((await readObjectives()).find((o) => o.id === ingles.id)).toMatchObject({
      name: 'Inglés',
      subject_id: 'sub-calculo',
      weekly_target_minutes: 120,
      active_name_key: 'inglés',
    });

    // Cambio válido de nombre, materia y meta.
    const updated = dataOf(
      await handleManageObjectives('update', {
        id: ingles.id,
        name: '  Inglés B2 ',
        subject_id: 'sub-algoritmos',
        weekly_target_minutes: 180,
      })
    );
    expect(updated).toMatchObject({
      name: 'Inglés B2',
      subject_id: 'sub-algoritmos',
      weekly_target_minutes: 180,
      archived: false,
      active_name_key: 'inglés b2',
    });

    // `null` quita la materia y la meta; lo no enviado no se toca.
    const cleared = dataOf(
      await handleManageObjectives('update', { id: ingles.id, subject_id: null, weekly_target_minutes: null })
    );
    expect(cleared).toMatchObject({ name: 'Inglés B2', subject_id: null, weekly_target_minutes: null });

    // Cambiar solo las mayúsculas del propio nombre no es un duplicado de sí mismo.
    const recased = dataOf(await handleManageObjectives('update', { id: leetcode.id, name: 'LEETCODE' }));
    expect(recased.name).toBe('LEETCODE');
    expect(recased.weekly_target_minutes).toBe(300);

    // El nombre anterior queda libre: se puede crear otro objetivo con "Inglés".
    expect((await createObjective({ name: 'Inglés' })).active_name_key).toBe('inglés');
  });

  it('US-F2-AS8 · invariante: archived es verdadero si y solo si active_name_key es nulo', async () => {
    const a = await createObjective({ name: 'LeetCode' });
    const b = await createObjective({ name: 'Inglés' });
    const c = await createObjective({ name: 'Algoritmos', subject_id: 'sub-algoritmos' });
    dataOf(await handleManageObjectives('update', { id: b.id, name: 'Inglés B2' }));
    dataOf(await handleManageObjectives('archive', { id: a.id }));
    dataOf(await handleManageObjectives('archive', { id: a.id }));
    dataOf(await handleManageObjectives('update', { id: c.id, weekly_target_minutes: 90 }));
    await createObjective({ name: 'LeetCode' });
    // Intentos fallidos que no deben alterar el invariante.
    await handleManageObjectives('update', { id: a.id, name: 'Otra cosa' });
    await handleManageObjectives('update', { id: c.id, name: 'inglés b2' });

    const rows = (await harness.pool.query('SELECT id, name, archived, active_name_key FROM objetivos')).rows;
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.archived).toBe(row.active_name_key === null);
      if (!row.archived) expect(row.active_name_key).toBe(row.name.trim().toLowerCase());
    }
    expect(rows.filter((r: any) => r.archived)).toHaveLength(1);
  });

  it('US-F2-AS8 · update sobre un objetivo archivado se rechaza con OBJETIVO_ARCHIVADO y no cambia nada', async () => {
    const leetcode = await createObjective({ name: 'LeetCode', weekly_target_minutes: 300 });
    dataOf(await handleManageObjectives('archive', { id: leetcode.id }));

    expectError(await handleManageObjectives('update', { id: leetcode.id, name: 'LC' }), 'OBJETIVO_ARCHIVADO');
    expectError(await handleManageObjectives('update', { id: leetcode.id, weekly_target_minutes: 60 }), 'OBJETIVO_ARCHIVADO');

    const [row] = await readObjectives({ include_archived: true });
    expect(row).toMatchObject({ name: 'LeetCode', weekly_target_minutes: 300, archived: true, active_name_key: null });
  });

  it('US-F2-AS8 · manage_tandas:read { objective_id } filtra por objetivo y recalcula por_dia con esas tandas', async () => {
    const leetcode = await createObjective({ name: 'LeetCode' });
    const algoritmos = await createObjective({ name: 'Algoritmos', subject_id: 'sub-algoritmos' });

    const enLeetcode = await runCronometro('2026-09-14T13:00:00.000Z', 45, leetcode.id);
    const enAlgoritmos = await runTemporizador('2026-09-14T15:00:00.000Z', 30, algoritmos.id);
    const sinObjetivo = await runTemporizador('2026-09-14T17:00:00.000Z', 10);

    vi.setSystemTime(new Date('2026-09-14T20:00:00.000Z'));
    const all = dataOf(await handleManageTandas('read', {}));
    expect(all.tandas.map((t: any) => t.id)).toEqual([enLeetcode.id, enAlgoritmos.id, sinObjetivo.id]);

    const soloLeetcode = dataOf(await handleManageTandas('read', { objective_id: leetcode.id }));
    expect(soloLeetcode.tandas.map((t: any) => t.id)).toEqual([enLeetcode.id]);
    expect(soloLeetcode.por_dia).toEqual([{ date: '2026-09-14', completadas: 0, unidades: 0, interrumpidas: 0, minutos: 45 }]);

    const soloAlgoritmos = dataOf(await handleManageTandas('read', { objective_id: algoritmos.id }));
    expect(soloAlgoritmos.tandas.map((t: any) => t.id)).toEqual([enAlgoritmos.id]);
    expect(soloAlgoritmos.por_dia).toEqual([{ date: '2026-09-14', completadas: 1, unidades: 3, interrumpidas: 0, minutos: 30 }]);

    const ninguna = dataOf(await handleManageTandas('read', { objective_id: 'objetivo-no-existe' }));
    expect(ninguna.tandas).toEqual([]);
    expect(ninguna.por_dia).toEqual([]);
  });

  it('US-F2-AS8 · get_today.tandas_today no cuenta una sesión de un objetivo sin materia (I1), pero sí una tanda sin vínculo', async () => {
    await setupProgram(3);
    const ingles = await createObjective({ name: 'Inglés' });

    await runTemporizador('2026-09-14T13:00:00.000Z', 30, ingles.id); // sin materia: no cuenta
    await runTemporizador('2026-09-14T15:00:00.000Z', 10); // sin ningún vínculo: cuenta, 1 unidad (regresión)
    // Con materia propia en la sesión, el objetivo sin materia ya no la excluye (US-F2-AS6).
    vi.setSystemTime(new Date('2026-09-14T17:00:00.000Z'));
    const withSubject = dataOf(
      await handleManageTandas('start', { objective_id: ingles.id, subject_id: 'sub-calculo', planned_minutes: 20 })
    );
    vi.setSystemTime(new Date('2026-09-14T17:20:00.000Z'));
    dataOf(await handleManageTandas('finish', { id: withSubject.tanda.id }));

    vi.setSystemTime(new Date('2026-09-14T20:00:00.000Z'));
    const today = dataOf(await handleGetToday());
    expect(today.tandas_today).toBe(2); // la de 10 min sin vínculo y la de 20 con materia propia
    expect(today.unidades_hoy).toBe(3); // 1 + 2
    expect(today.evaluacion_dia).toMatchObject({ tandas_completadas: 2, unidades_completadas: 3, cumplio_tandas: true });

    // Los minutos de la de 30 en "Inglés" sí son foco: 30 + 10 + 20.
    const read = dataOf(await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-14' }));
    expect(read.por_dia).toEqual([{ date: '2026-09-14', completadas: 2, unidades: 3, interrumpidas: 0, minutos: 60 }]);
  });

  it('US-F2-AS8 · borrar la materia de un objetivo deja subject_id = NULL y sus sesiones dejan de contar para el mínimo', async () => {
    await setupProgram(3);
    const algoritmos = await createObjective({ name: 'Algoritmos', subject_id: 'sub-algoritmos' });
    await runTemporizador(MON_10H, 30, algoritmos.id);

    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'));
    const before = dataOf(await handleGetToday());
    expect(before.unidades_hoy).toBe(3);
    expect(before.tandas_today).toBe(1);

    const deleted = await handleManageSubjects('delete', { id: 'sub-algoritmos' });
    expect(deleted?.status).toBe('success');

    const [row] = await readObjectives();
    expect(row.id).toBe(algoritmos.id);
    expect(row.subject_id).toBeNull();

    const after = dataOf(await handleGetToday());
    expect(after.unidades_hoy).toBe(0);
    expect(after.tandas_today).toBe(0);
    expect(after.evaluacion_dia).toMatchObject({ unidades_completadas: 0, cumplio_tandas: false });
    // Los 30 minutos siguen siendo foco.
    const read = dataOf(await handleManageTandas('read', { from: '2026-09-14', to: '2026-09-14' }));
    expect(read.por_dia).toEqual([expect.objectContaining({ date: '2026-09-14', minutos: 30, unidades: 0 })]);
  });

  it('US-F2-AS10 · manage_tandas:update { objective_id } reclasifica sin tocar los tiempos y no marca edición tardía el mismo día', async () => {
    const leetcode = await createObjective({ name: 'LeetCode' });
    const closed = await runTemporizador(MON_10H, 30);
    expect(closed.objective_id).toBeNull();
    expect(closed.edited_after_lock).toBe(false);

    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z')); // lunes 11:00 local, antes del cierre de las 03:00
    const updated = dataOf(await handleManageTandas('update', { id: closed.id, objective_id: leetcode.id }));

    expect(updated.objective_id).toBe(leetcode.id);
    expect(updated.edited_after_lock).toBe(false);
    for (const key of ['started_at', 'ended_at', 'actual_minutes', 'planned_minutes', 'local_date', 'kind', 'status']) {
      expect(updated[key]).toEqual(closed[key]);
    }
  });

  it('US-F2-AS10 · reclasificar después del cierre del día marca edited_after_lock; un objetivo archivado o inexistente se trata distinto', async () => {
    const leetcode = await createObjective({ name: 'LeetCode' });
    const inactivo = await createObjective({ name: 'Antiguo' });
    const closed = await runTemporizador(MON_10H, 30, leetcode.id);

    // Reclasificar hacia un objetivo archivado es legítimo (sesiones viejas); hacia uno inexistente no.
    dataOf(await handleManageObjectives('archive', { id: inactivo.id }));
    vi.setSystemTime(new Date('2026-09-15T09:00:00.000Z')); // martes 04:00 local, después del cierre (03:00)
    expectError(await handleManageTandas('update', { id: closed.id, objective_id: 'objetivo-no-existe' }), 'NO_ENCONTRADO');
    const [untouched] = await readAllTandas();
    expect(untouched.objective_id).toBe(leetcode.id);
    expect(untouched.edited_after_lock).toBe(false);

    const updated = dataOf(await handleManageTandas('update', { id: closed.id, objective_id: inactivo.id }));
    expect(updated.objective_id).toBe(inactivo.id);
    expect(updated.edited_after_lock).toBe(true);
    for (const key of ['started_at', 'ended_at', 'actual_minutes', 'planned_minutes', 'local_date']) {
      expect(updated[key]).toEqual(closed[key]);
    }
  });

  describe('US-F2-AS11 — la web usa el mismo handler que el MCP', () => {
    async function post(body: unknown): Promise<{ status: number; json: any }> {
      const response = await POST(new Request('http://localhost/api/execution', { method: 'POST', body: JSON.stringify(body) }));
      return { status: response.status, json: await response.json() };
    }

    it('create, read, update y archive por POST /api/execution dan los mismos resultados y errores que el handler', async () => {
      const created = await post({
        tool: 'manage_objectives',
        action: 'create',
        data: { name: 'LeetCode', subject_id: 'sub-algoritmos', weekly_target_minutes: 300 },
      });
      expect(created.status).toBe(200);
      expect(created.json.status).toBe('success');
      expect(created.json.data).toMatchObject({
        name: 'LeetCode',
        subject_id: 'sub-algoritmos',
        weekly_target_minutes: 300,
        archived: false,
      });
      const id = created.json.data.id;

      // read: el mismo resultado que el handler.
      const read = await post({ tool: 'manage_objectives', action: 'read', data: {} });
      expect(read.status).toBe(200);
      expect(read.json).toEqual(JSON.parse(JSON.stringify(await handleManageObjectives('read', {}))));
      expect(read.json.data.objetivos).toHaveLength(1);

      // Errores: mismo code y mismo mensaje que el handler, con HTTP 400.
      const duplicate = await post({ tool: 'manage_objectives', action: 'create', data: { name: ' leetcode ' } });
      expect(duplicate.status).toBe(400);
      expect(duplicate.json).toEqual(await handleManageObjectives('create', { name: ' leetcode ' }));
      expect(duplicate.json.code).toBe('OBJETIVO_DUPLICADO');

      const badTarget = await post({ tool: 'manage_objectives', action: 'update', data: { id, weekly_target_minutes: 0 } });
      expect(badTarget.status).toBe(400);
      expect(badTarget.json).toEqual(await handleManageObjectives('update', { id, weekly_target_minutes: 0 }));
      expect(badTarget.json.code).toBe('DATOS_INVALIDOS');

      const missingSubject = await post({ tool: 'manage_objectives', action: 'update', data: { id, subject_id: 'sub-no-existe' } });
      expect(missingSubject.status).toBe(400);
      expect(missingSubject.json.code).toBe('NO_ENCONTRADO');

      // update válido.
      const updated = await post({ tool: 'manage_objectives', action: 'update', data: { id, name: 'LeetCode diario', weekly_target_minutes: null } });
      expect(updated.status).toBe(200);
      expect(updated.json.data).toMatchObject({ id, name: 'LeetCode diario', weekly_target_minutes: null, subject_id: 'sub-algoritmos' });

      // archive (idempotente) y lo que sigue.
      const archived = await post({ tool: 'manage_objectives', action: 'archive', data: { id } });
      expect(archived.status).toBe(200);
      expect(archived.json.data.archived).toBe(true);
      const archivedAgain = await post({ tool: 'manage_objectives', action: 'archive', data: { id } });
      expect(archivedAgain.status).toBe(200);

      const readAfter = await post({ tool: 'manage_objectives', action: 'read', data: {} });
      expect(readAfter.json.data.objetivos).toEqual([]);
      const readAll = await post({ tool: 'manage_objectives', action: 'read', data: { include_archived: true } });
      expect(readAll.json.data.objetivos).toHaveLength(1);

      const updateArchived = await post({ tool: 'manage_objectives', action: 'update', data: { id, name: 'Otro' } });
      expect(updateArchived.status).toBe(400);
      expect(updateArchived.json).toEqual(await handleManageObjectives('update', { id, name: 'Otro' }));
      expect(updateArchived.json.code).toBe('OBJETIVO_ARCHIVADO');
    });

    it('una acción de manage_objectives fuera de la lista blanca se rechaza con 400 DATOS_INVALIDOS', async () => {
      const res = await post({ tool: 'manage_objectives', action: 'delete', data: { id: 'objetivo-x' } });
      expect(res.status).toBe(400);
      expect(res.json.code).toBe('DATOS_INVALIDOS');
    });

    it('manage_tandas:start desde la web acepta objective_id con las mismas reglas (activo liga, archivado se rechaza)', async () => {
      const objective = (await post({ tool: 'manage_objectives', action: 'create', data: { name: 'Inglés' } })).json.data;

      const started = await post({ tool: 'manage_tandas', action: 'start', data: { kind: 'cronometro', objective_id: objective.id } });
      expect(started.status).toBe(200);
      expect(started.json.data.tanda.objective_id).toBe(objective.id);
      await post({ tool: 'manage_tandas', action: 'interrupt', data: { id: started.json.data.tanda.id, interrupt_reason: 'prueba' } });

      await post({ tool: 'manage_objectives', action: 'archive', data: { id: objective.id } });
      const rejected = await post({ tool: 'manage_tandas', action: 'start', data: { objective_id: objective.id } });
      expect(rejected.status).toBe(400);
      expect(rejected.json.code).toBe('OBJETIVO_ARCHIVADO');
    });
  });
});
