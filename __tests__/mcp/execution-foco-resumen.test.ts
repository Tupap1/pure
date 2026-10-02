import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleGetFocusSummary,
  handleGetToday,
  handleManageObjectives,
  handleManageTandas,
} from '../../lib/execution/handlers';
import { saveTandaToDb } from '../../lib/db/execution-pg';
import { handleManageUniversities, handleManageSubjects } from '../../mcp-server/tools-handler';
import { GET, dynamic } from '@/app/api/execution/focus/route';

// US-F3 (004) -- Tiempo enfocado por semana y mapa de calor. `get_focus_summary` suma los minutos
// de las sesiones completadas e interrumpidas (nunca las en curso) por día local, con el reparto
// por medianoche del cronómetro (FR-F14a), y arma días, semanas de lunes a domingo, total de la
// semana actual y la tabla por objetivo. Bogotá es UTC-5: las 10:00 locales del miércoles 16-sep
// son 2026-09-16T15:00:00Z. La semana de referencia va del lunes 14 al domingo 20 de septiembre.

const DAY_MS = 86_400_000;
const WED_16_10H = '2026-09-16T15:00:00.000Z'; // miércoles 16 10:00 local

function dataOf(res: any): any {
  expect(res.status).toBe('success');
  return res.status === 'success' ? res.data : undefined;
}

function expectError(res: any, code: string) {
  expect(res.status).toBe('error');
  if (res.status === 'error') expect(res.code).toBe(code);
}

/** Fecha local (UTC-5) 'YYYY-MM-DD' de un instante, calculada a mano para no depender del código bajo prueba. */
function localDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' + n días de calendario. */
function plusDays(dateKey: string, n: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

let seedCounter = 0;

interface SeedInput {
  /** Instante de inicio (ISO, Z). */
  start: string;
  /** Minutos reales de una sesión cerrada. */
  minutes?: number;
  kind?: 'temporizador' | 'cronometro';
  status?: 'completada' | 'interrumpida' | 'en_curso';
  objective_id?: string;
  subject_id?: string;
  planned_minutes?: number;
  corrected?: boolean;
}

/** Siembra una sesión directo en la base (historia de varias semanas sin pasar por el reloj). */
async function seed(input: SeedInput): Promise<void> {
  const kind = input.kind ?? 'temporizador';
  const status = input.status ?? 'completada';
  const running = status === 'en_curso';
  const minutes = input.minutes ?? 0;
  const localDate = localDateOf(input.start);
  await saveTandaToDb({
    id: `tanda-seed-${++seedCounter}`,
    kind,
    status,
    subject_id: input.subject_id,
    objective_id: input.objective_id,
    local_date: localDate,
    started_at: input.start,
    ended_at: running ? null : new Date(new Date(input.start).getTime() + minutes * 60_000).toISOString(),
    actual_minutes: running ? null : minutes,
    planned_minutes: kind === 'cronometro' ? undefined : (input.planned_minutes ?? Math.min(180, Math.max(10, minutes))),
    running_lock: running ? 'running' : null,
    interrupt_reason: status === 'interrumpida' ? 'se acabó el rato' : null,
    // El día cierra a las 03:00 locales (08:00Z) del siguiente.
    locked_at: `${plusDays(localDate, 1)}T08:00:00.000Z`,
    ...(input.corrected
      ? {
          corrected: true,
          corrected_at: '2026-09-18T15:00:00.000Z',
          original_ended_at: new Date(new Date(input.start).getTime() + (minutes + 50) * 60_000).toISOString(),
          original_minutes: minutes + 50,
          correction_reason: 'olvidé pararlo',
        }
      : {}),
  });
}

async function summary(data: Record<string, unknown> = {}): Promise<any> {
  return dataOf(await handleGetFocusSummary(data));
}

function minutesOfDay(res: any, date: string): number {
  const day = res.dias.find((d: any) => d.date === date);
  expect(day, `día ${date} presente en dias`).toBeDefined();
  return day.minutos;
}

describe('[004] US-F3 — Tiempo enfocado y mapa de calor', () => {
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

  it('US-F3-AS1 · un temporizador de 25, uno interrumpido a los 12 y un cronómetro de 45 suman 82 ese día', async () => {
    vi.setSystemTime(new Date('2026-09-14T14:00:00.000Z')); // lunes 14 09:00 local
    const t1 = dataOf(await handleManageTandas('start', { planned_minutes: 25 }));
    vi.setSystemTime(new Date('2026-09-14T14:25:00.000Z'));
    dataOf(await handleManageTandas('finish', { id: t1.tanda.id }));

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
    const t2 = dataOf(await handleManageTandas('start', { planned_minutes: 25 }));
    vi.setSystemTime(new Date('2026-09-14T15:12:00.000Z'));
    dataOf(await handleManageTandas('interrupt', { id: t2.tanda.id, interrupt_reason: 'me llamaron' }));

    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'));
    const t3 = dataOf(await handleManageTandas('start', { kind: 'cronometro' }));
    vi.setSystemTime(new Date('2026-09-14T16:45:00.000Z'));
    dataOf(await handleManageTandas('finish', { id: t3.tanda.id }));
    vi.useRealTimers();

    const res = await summary({ weeks: 1, at: '2026-09-14T22:00:00.000Z' });
    expect(res.rango).toEqual({ desde: '2026-09-14', hasta: '2026-09-14', semanas: 1 });
    // Las interrumpidas cuentan como foco aunque no den unidades: 25 + 12 + 45.
    expect(res.dias).toEqual([{ date: '2026-09-14', minutos: 82, nivel: 2 }]);
    expect(res.semanas).toEqual([{ lunes: '2026-09-14', minutos: 82 }]);
    expect(res.total_semana).toBe(82);
  });

  it('US-F3-AS2 · el total de la semana suma solo de lunes a domingo y excluye el domingo anterior', async () => {
    await seed({ start: '2026-09-13T20:00:00.000Z', minutes: 40 }); // domingo 13 (semana anterior)
    await seed({ start: '2026-09-14T14:00:00.000Z', minutes: 30 }); // lunes 14
    await seed({ start: '2026-09-16T14:00:00.000Z', minutes: 20 }); // miércoles 16
    await seed({ start: '2026-09-20T20:00:00.000Z', minutes: 10 }); // domingo 20 15:00 local

    const res = await summary({ weeks: 2, at: '2026-09-20T23:00:00.000Z' }); // domingo 20 18:00 local
    expect(res.total_semana).toBe(60);
    expect(res.rango).toEqual({ desde: '2026-09-07', hasta: '2026-09-20', semanas: 2 });
    expect(res.semanas).toEqual([
      { lunes: '2026-09-07', minutos: 40 },
      { lunes: '2026-09-14', minutos: 60 },
    ]);
    expect(minutesOfDay(res, '2026-09-13')).toBe(40);
    expect(minutesOfDay(res, '2026-09-20')).toBe(10);
  });

  it('US-F3-AS2 · un temporizador que empezó el domingo a las 23:50 cuenta entero para el domingo', async () => {
    // 23:50 local del domingo 20 = 2026-09-21T04:50Z; termina pasada la medianoche, pero no se reparte.
    await seed({ start: '2026-09-21T04:50:00.000Z', minutes: 25 });

    const res = await summary({ weeks: 2, at: '2026-09-21T15:00:00.000Z' }); // lunes 21 10:00 local
    expect(minutesOfDay(res, '2026-09-20')).toBe(25);
    expect(minutesOfDay(res, '2026-09-21')).toBe(0);
    expect(res.semanas).toEqual([
      { lunes: '2026-09-14', minutos: 25 },
      { lunes: '2026-09-21', minutos: 0 },
    ]);
    expect(res.total_semana).toBe(0);
  });

  it('US-F3-AS3 · 52 semanas dan días del lunes de hace 51 semanas a hoy, sin huecos y con 0 explícitos', async () => {
    const mondayOfFirstWeek = new Date(Date.UTC(2026, 8, 14) - 51 * 7 * DAY_MS).toISOString().slice(0, 10);
    await seed({ start: `${plusDays(mondayOfFirstWeek, -1)}T20:00:00.000Z`, minutes: 99 }); // día anterior al rango
    await seed({ start: `${mondayOfFirstWeek}T20:00:00.000Z`, minutes: 45 }); // primer día del rango
    await seed({ start: '2026-09-16T14:00:00.000Z', minutes: 25 }); // hoy

    const res = await summary({ at: WED_16_10H }); // sin `weeks`: 52 por defecto
    expect(res.rango).toEqual({ desde: mondayOfFirstWeek, hasta: '2026-09-16', semanas: 52 });

    // 51 semanas completas + lunes, martes y miércoles de la actual.
    expect(res.dias).toHaveLength(51 * 7 + 3);
    expect(res.dias[0].date).toBe(mondayOfFirstWeek);
    expect(res.dias[res.dias.length - 1].date).toBe('2026-09-16');
    res.dias.forEach((d: any, i: number) => {
      expect(d.date).toBe(plusDays(mondayOfFirstWeek, i)); // sin huecos ni repetidos
    });
    expect(res.dias.filter((d: any) => d.minutos === 0)).toHaveLength(51 * 7 + 3 - 2); // 0 explícito
    expect(res.dias.filter((d: any) => d.minutos === 0).every((d: any) => d.nivel === 0)).toBe(true);
    expect(minutesOfDay(res, mondayOfFirstWeek)).toBe(45);
    expect(minutesOfDay(res, '2026-09-16')).toBe(25);

    expect(res.semanas).toHaveLength(52);
    expect(res.semanas[0]).toEqual({ lunes: mondayOfFirstWeek, minutos: 45 });
    expect(res.semanas[51]).toEqual({ lunes: '2026-09-14', minutos: 25 });
    res.semanas.forEach((w: any, i: number) => {
      expect(w.lunes).toBe(plusDays(mondayOfFirstWeek, i * 7));
    });
    expect(res.total_semana).toBe(25);
  });

  it('US-F3-AS3 · weeks fuera de 1..53 o no entero se rechaza con DATOS_INVALIDOS; 53 se acepta', async () => {
    for (const weeks of [0, 54, -1, 2.5]) {
      expectError(await handleGetFocusSummary({ weeks, at: WED_16_10H }), 'DATOS_INVALIDOS');
    }
    const res = await summary({ weeks: 53, at: WED_16_10H });
    expect(res.rango.semanas).toBe(53);
    expect(res.dias).toHaveLength(52 * 7 + 3);
    expectError(await handleGetFocusSummary({ weeks: 12, at: 'ayer' }), 'DATOS_INVALIDOS');
    expectError(await handleGetFocusSummary({ weeks: 12, extra: 1 }), 'DATOS_INVALIDOS');
  });

  it('US-F3-AS4 · las filas por objetivo, materia y "Sin objetivo" suman el total; un objetivo con meta y 0 minutos aparece', async () => {
    const leetcode = dataOf(await handleManageObjectives('create', { name: 'LeetCode', weekly_target_minutes: 300 }));
    const algoritmos = dataOf(
      await handleManageObjectives('create', { name: 'Algoritmos', subject_id: 'sub-algoritmos', weekly_target_minutes: 120 })
    );
    const ingles = dataOf(await handleManageObjectives('create', { name: 'Inglés', weekly_target_minutes: 60 }));
    dataOf(await handleManageObjectives('create', { name: 'Sin meta ni sesiones' }));
    const viejo = dataOf(await handleManageObjectives('create', { name: 'Viejo' }));
    const archivadoSinSesiones = dataOf(await handleManageObjectives('create', { name: 'Archivado con meta', weekly_target_minutes: 90 }));

    // Semana del lunes 14 al domingo 20; hoy es el miércoles 16.
    await seed({ start: '2026-09-14T14:00:00.000Z', minutes: 60, objective_id: leetcode.id });
    await seed({ start: '2026-09-15T14:00:00.000Z', minutes: 10, objective_id: leetcode.id, status: 'interrumpida' });
    await seed({ start: '2026-09-14T16:00:00.000Z', minutes: 30, objective_id: algoritmos.id });
    // Objetivo con materia y sesión con otra materia: cae en la fila del objetivo.
    await seed({ start: '2026-09-15T16:00:00.000Z', minutes: 5, objective_id: algoritmos.id, subject_id: 'sub-calculo' });
    await seed({ start: '2026-09-15T18:00:00.000Z', minutes: 25, subject_id: 'sub-calculo' }); // solo materia
    await seed({ start: '2026-09-16T14:00:00.000Z', minutes: 15 }); // sin ningún vínculo
    await seed({ start: '2026-09-16T12:00:00.000Z', minutes: 20, objective_id: viejo.id });
    dataOf(await handleManageObjectives('archive', { id: viejo.id }));
    dataOf(await handleManageObjectives('archive', { id: archivadoSinSesiones.id }));
    // Semana anterior: no entra en la tabla de la semana actual.
    await seed({ start: '2026-09-11T14:00:00.000Z', minutes: 120, objective_id: ingles.id });

    const res = await summary({ weeks: 4, at: WED_16_10H });
    expect(res.total_semana).toBe(165); // 60 + 10 + 30 + 5 + 25 + 15 + 20

    expect(res.por_objetivo).toHaveLength(6);
    expect(res.por_objetivo).toEqual(
      expect.arrayContaining([
        { tipo: 'objetivo', id: leetcode.id, nombre: 'LeetCode', minutos: 70, meta: 300, archivado: false },
        { tipo: 'objetivo', id: algoritmos.id, nombre: 'Algoritmos', minutos: 35, meta: 120, archivado: false },
        // Activo con meta y 0 minutos esta semana (su sesión fue la semana pasada): aparece igual.
        { tipo: 'objetivo', id: ingles.id, nombre: 'Inglés', minutos: 0, meta: 60, archivado: false },
        // Archivado con sesiones esta semana: suma normalmente y se marca archivado.
        { tipo: 'objetivo', id: viejo.id, nombre: 'Viejo', minutos: 20, meta: null, archivado: true },
        { tipo: 'materia', id: 'sub-calculo', nombre: 'Cálculo', minutos: 25, meta: null, archivado: false },
        { tipo: 'sin_objetivo', id: null, nombre: 'Sin objetivo', minutos: 15, meta: null, archivado: false },
      ])
    );
    const filasSumadas = res.por_objetivo.reduce((sum: number, row: any) => sum + row.minutos, 0);
    expect(filasSumadas).toBe(res.total_semana);
    // Ni el activo sin meta ni sesiones, ni el archivado sin sesiones, aparecen.
    expect(res.por_objetivo.map((r: any) => r.nombre)).not.toContain('Sin meta ni sesiones');
    expect(res.por_objetivo.map((r: any) => r.nombre)).not.toContain('Archivado con meta');
  });

  it('US-F3-AS5 · el filtro por objetivo deja solo sus sesiones; por_objetivo no cambia', async () => {
    const leetcode = dataOf(await handleManageObjectives('create', { name: 'LeetCode', weekly_target_minutes: 300 }));
    const algoritmos = dataOf(await handleManageObjectives('create', { name: 'Algoritmos', subject_id: 'sub-algoritmos' }));

    await seed({ start: '2026-09-14T14:00:00.000Z', minutes: 60, objective_id: leetcode.id });
    await seed({ start: '2026-09-15T14:00:00.000Z', minutes: 30, objective_id: algoritmos.id });
    await seed({ start: '2026-09-15T16:00:00.000Z', minutes: 20, subject_id: 'sub-algoritmos' });
    await seed({ start: '2026-09-16T14:00:00.000Z', minutes: 10 });
    await seed({ start: '2026-09-07T14:00:00.000Z', minutes: 45, objective_id: leetcode.id }); // semana anterior

    const sinFiltro = await summary({ weeks: 2, at: WED_16_10H });
    const conFiltro = await summary({ weeks: 2, at: WED_16_10H, objective_id: leetcode.id });

    expect(conFiltro.total_semana).toBe(60);
    expect(conFiltro.semanas).toEqual([
      { lunes: '2026-09-07', minutos: 45 },
      { lunes: '2026-09-14', minutos: 60 },
    ]);
    expect(minutesOfDay(conFiltro, '2026-09-14')).toBe(60);
    expect(minutesOfDay(conFiltro, '2026-09-15')).toBe(0); // había foco de otros objetivos ese día
    expect(minutesOfDay(conFiltro, '2026-09-16')).toBe(0);
    expect(conFiltro.dias).toHaveLength(sinFiltro.dias.length);
    expect(conFiltro.por_objetivo).toEqual(sinFiltro.por_objetivo);
    expect(conFiltro.rango).toEqual(sinFiltro.rango);
    // Sin filtro el total de la semana sigue siendo todo.
    expect(sinFiltro.total_semana).toBe(120);
  });

  it('US-F3-AS5 · el filtro por materia incluye las sesiones directas y las de objetivos ligados a esa materia', async () => {
    const algoritmos = dataOf(await handleManageObjectives('create', { name: 'Algoritmos', subject_id: 'sub-algoritmos' }));
    const leetcode = dataOf(await handleManageObjectives('create', { name: 'LeetCode' })); // sin materia

    await seed({ start: '2026-09-14T14:00:00.000Z', minutes: 30, objective_id: algoritmos.id }); // por el objetivo
    await seed({ start: '2026-09-15T14:00:00.000Z', minutes: 20, subject_id: 'sub-algoritmos' }); // directa
    // Objetivo de Algoritmos con una materia distinta: aparece bajo las dos materias.
    await seed({ start: '2026-09-15T16:00:00.000Z', minutes: 5, objective_id: algoritmos.id, subject_id: 'sub-calculo' });
    await seed({ start: '2026-09-16T14:00:00.000Z', minutes: 15, subject_id: 'sub-calculo' });
    await seed({ start: '2026-09-16T16:00:00.000Z', minutes: 60, objective_id: leetcode.id }); // sin materia
    await seed({ start: '2026-09-16T18:00:00.000Z', minutes: 10 });

    const algoritmosRes = await summary({ weeks: 1, at: WED_16_10H, subject_id: 'sub-algoritmos' });
    expect(algoritmosRes.total_semana).toBe(55); // 30 + 20 + 5
    expect(minutesOfDay(algoritmosRes, '2026-09-14')).toBe(30);
    expect(minutesOfDay(algoritmosRes, '2026-09-15')).toBe(25);
    expect(minutesOfDay(algoritmosRes, '2026-09-16')).toBe(0);

    const calculoRes = await summary({ weeks: 1, at: WED_16_10H, subject_id: 'sub-calculo' });
    expect(calculoRes.total_semana).toBe(20); // 5 (directa, aunque con objetivo de otra materia) + 15

    // Una materia sin sesiones: todo en cero, sin error.
    const vacia = await summary({ weeks: 1, at: WED_16_10H, subject_id: 'sub-inexistente' });
    expect(vacia.total_semana).toBe(0);
    expect(vacia.dias).toHaveLength(3);
  });

  it('US-F3-AS5 · pedir filtro por objetivo y por materia a la vez es DATOS_INVALIDOS', async () => {
    expectError(
      await handleGetFocusSummary({ weeks: 4, objective_id: 'objetivo-x', subject_id: 'sub-algoritmos', at: WED_16_10H }),
      'DATOS_INVALIDOS'
    );
  });

  it('US-F3-AS7 · una sesión en curso no suma; una corregida suma lo corregido; la de un objetivo archivado suma', async () => {
    const viejo = dataOf(await handleManageObjectives('create', { name: 'Viejo' }));
    dataOf(await handleManageObjectives('archive', { id: viejo.id }));

    // Miércoles 16: un cronómetro corregido (de 90 originales a 40), una sesión de un objetivo
    // archivado y un cronómetro todavía en curso desde las 09:00 locales.
    await seed({ start: '2026-09-16T12:00:00.000Z', kind: 'cronometro', minutes: 40, corrected: true });
    await seed({ start: '2026-09-16T13:30:00.000Z', minutes: 20, objective_id: viejo.id });
    await seed({ start: '2026-09-16T14:00:00.000Z', kind: 'cronometro', status: 'en_curso' });

    const res = await summary({ weeks: 1, at: WED_16_10H });
    expect(minutesOfDay(res, '2026-09-16')).toBe(60); // 40 corregidos + 20; el en curso no suma
    expect(res.total_semana).toBe(60);
    expect(res.por_objetivo).toEqual(
      expect.arrayContaining([
        { tipo: 'objetivo', id: viejo.id, nombre: 'Viejo', minutos: 20, meta: null, archivado: true },
        { tipo: 'sin_objetivo', id: null, nombre: 'Sin objetivo', minutos: 40, meta: null, archivado: false },
      ])
    );
    expect(res.por_objetivo.reduce((sum: number, row: any) => sum + row.minutos, 0)).toBe(60);
  });

  it('US-F3-AS9 · GET /api/execution/focus devuelve lo mismo que el handler, ignora `at` y es dinámica', async () => {
    expect(dynamic).toBe('force-dynamic');

    // El reloj se fija ANTES de sembrar: pg-mem devuelve `{}` en las columnas de fecha de filas
    // guardadas con el reloj real y leídas con `Date` simulado, así que todo se escribe y se lee
    // bajo el mismo reloj.
    vi.setSystemTime(new Date(WED_16_10H));
    const leetcode = dataOf(await handleManageObjectives('create', { name: 'LeetCode', weekly_target_minutes: 300 }));
    await seed({ start: '2026-09-14T14:00:00.000Z', minutes: 60, objective_id: leetcode.id });
    await seed({ start: '2026-09-15T14:00:00.000Z', minutes: 30, subject_id: 'sub-algoritmos' });
    await seed({ start: '2026-09-16T11:00:00.000Z', kind: 'cronometro', minutes: 50 });
    const base = 'http://localhost/api/execution/focus';

    // Mismo `weeks`, sin filtro: el handler SIN `at` usa el reloj del sistema, igual que la ruta.
    const handlerNoFilter = await handleGetFocusSummary({ weeks: 12 });
    const webNoFilter = await GET(new Request(`${base}?weeks=12`));
    expect(webNoFilter.status).toBe(200);
    expect(await webNoFilter.json()).toEqual(JSON.parse(JSON.stringify(handlerNoFilter)));
    expect(dataOf(handlerNoFilter).total_semana).toBe(140);

    // Mismo `weeks` y filtro por objetivo.
    const handlerObjective = await handleGetFocusSummary({ weeks: 12, objective_id: leetcode.id });
    const webObjective = await GET(new Request(`${base}?weeks=12&objective_id=${leetcode.id}`));
    expect(await webObjective.json()).toEqual(JSON.parse(JSON.stringify(handlerObjective)));
    expect(dataOf(handlerObjective).total_semana).toBe(60);

    // Mismo `weeks` y filtro por materia.
    const handlerSubject = await handleGetFocusSummary({ weeks: 12, subject_id: 'sub-algoritmos' });
    const webSubject = await GET(new Request(`${base}?weeks=12&subject_id=sub-algoritmos`));
    expect(await webSubject.json()).toEqual(JSON.parse(JSON.stringify(handlerSubject)));
    expect(dataOf(handlerSubject).total_semana).toBe(30);

    // Sin `weeks`: 52 por defecto en ambos.
    const handlerDefault = await handleGetFocusSummary();
    const webDefault = await GET(new Request(base));
    expect(await webDefault.json()).toEqual(JSON.parse(JSON.stringify(handlerDefault)));
    expect(dataOf(handlerDefault).rango.semanas).toBe(52);

    // La web no acepta instantes: `at` se ignora y manda el reloj del servidor.
    const webAt = await GET(new Request(`${base}?weeks=12&at=2020-01-01T00:00:00.000Z`));
    expect(await webAt.json()).toEqual(JSON.parse(JSON.stringify(handlerNoFilter)));
  });

  it('US-F3-AS9 · la ruta responde 400 con el ExecutionResult de error y nunca filtra detalles internos', async () => {
    vi.setSystemTime(new Date(WED_16_10H));
    const base = 'http://localhost/api/execution/focus';

    const both = await GET(new Request(`${base}?objective_id=objetivo-x&subject_id=sub-algoritmos`));
    expect(both.status).toBe(400);
    expect(await both.json()).toMatchObject({ status: 'error', code: 'DATOS_INVALIDOS' });

    for (const weeks of ['0', '54', 'abc', '2.5']) {
      const res = await GET(new Request(`${base}?weeks=${weeks}`));
      expect(res.status, `weeks=${weeks}`).toBe(400);
      expect(await res.json()).toMatchObject({ status: 'error', code: 'DATOS_INVALIDOS' });
    }
  });

  it('US-F3-AS11 · un cronómetro de domingo 23:00 a lunes 01:00 da 60 y 60, cada uno en su semana', async () => {
    vi.setSystemTime(new Date('2026-09-21T04:00:00.000Z')); // domingo 20 23:00 local
    const start = dataOf(await handleManageTandas('start', { kind: 'cronometro' }));
    vi.setSystemTime(new Date('2026-09-21T06:00:00.000Z')); // lunes 21 01:00 local
    dataOf(await handleManageTandas('finish', { id: start.tanda.id }));
    vi.useRealTimers();

    // El domingo suma 60 a la semana que termina y el lunes suma 60 a la que empieza.
    const dos = await summary({ weeks: 2, at: '2026-09-21T15:00:00.000Z' }); // lunes 21 10:00 local
    expect(minutesOfDay(dos, '2026-09-20')).toBe(60);
    expect(minutesOfDay(dos, '2026-09-21')).toBe(60);
    expect(dos.semanas).toEqual([
      { lunes: '2026-09-14', minutos: 60 },
      { lunes: '2026-09-21', minutos: 60 },
    ]);
    expect(dos.total_semana).toBe(60);

    // Un resumen que empieza el lunes incluye los 60 del lunes aunque la sesión empezó el domingo.
    const unaSemana = await summary({ weeks: 1, at: '2026-09-21T15:00:00.000Z' });
    expect(unaSemana.rango).toEqual({ desde: '2026-09-21', hasta: '2026-09-21', semanas: 1 });
    expect(unaSemana.dias).toEqual([{ date: '2026-09-21', minutos: 60, nivel: 2 }]);
    expect(unaSemana.total_semana).toBe(60);
    expect(unaSemana.semanas).toEqual([{ lunes: '2026-09-21', minutos: 60 }]);
  });
  it('US-F3-AS2 · get_today.foco_semana_minutos coincide con get_focus_summary.total_semana y foco_12_semanas tiene 84 días con el mismo nivel', async () => {
    const leetcode = dataOf(await handleManageObjectives('create', { name: 'LeetCode', weekly_target_minutes: 300 }));
    // Rango de 12 semanas al domingo 20: desde el lunes 29-jun. El domingo 28 queda fuera.
    await seed({ start: '2026-06-28T20:00:00.000Z', minutes: 90 }); // un día antes del rango
    await seed({ start: '2026-06-29T20:00:00.000Z', minutes: 45 }); // primer día del rango
    await seed({ start: '2026-09-07T14:00:00.000Z', minutes: 30 }); // semana anterior
    await seed({ start: '2026-09-14T14:00:00.000Z', minutes: 100, objective_id: leetcode.id }); // lunes 14
    await seed({ start: '2026-09-16T14:00:00.000Z', minutes: 20 }); // miércoles 16
    await seed({ start: '2026-09-20T14:00:00.000Z', kind: 'cronometro', minutes: 200 }); // domingo 20

    // Semana terminada (domingo 20): 12 semanas completas = 84 días.
    const domingo = '2026-09-20T23:00:00.000Z'; // domingo 20 18:00 local
    const todayFull = dataOf(await handleGetToday({ at: domingo }));
    const summaryFull = await summary({ weeks: 12, at: domingo });
    expect(todayFull.foco_semana_minutos).toBe(320);
    expect(todayFull.foco_semana_minutos).toBe(summaryFull.total_semana);
    expect(todayFull.foco_12_semanas).toHaveLength(84);
    expect(todayFull.foco_12_semanas[0]).toEqual({ date: '2026-06-29', minutos: 45, nivel: 2 });
    expect(todayFull.foco_12_semanas[83]).toEqual({ date: '2026-09-20', minutos: 200, nivel: 4 });
    // Mismos días, minutos y niveles que el resumen de 12 semanas.
    expect(todayFull.foco_12_semanas).toEqual(summaryFull.dias);

    // Semana en curso (miércoles 16): 77 días de las 11 semanas completas + lunes, martes y miércoles.
    const miercoles = WED_16_10H;
    const todayPartial = dataOf(await handleGetToday({ at: miercoles }));
    const summaryPartial = await summary({ weeks: 12, at: miercoles });
    expect(todayPartial.foco_semana_minutos).toBe(120);
    expect(todayPartial.foco_semana_minutos).toBe(summaryPartial.total_semana);
    expect(todayPartial.foco_12_semanas).toHaveLength(80);
    expect(todayPartial.foco_12_semanas[79].date).toBe('2026-09-16');
    expect(todayPartial.foco_12_semanas).toEqual(summaryPartial.dias);

    // Sin sesiones en la semana: 0 y la lista sigue completa, con ceros explícitos.
    const sinSemana = dataOf(await handleGetToday({ at: '2026-09-28T15:00:00.000Z' })); // lunes 28
    expect(sinSemana.foco_semana_minutos).toBe(0);
    expect(sinSemana.foco_12_semanas).toHaveLength(78); // 77 + el lunes
    expect(sinSemana.foco_12_semanas[77]).toEqual({ date: '2026-09-28', minutos: 0, nivel: 0 });
  });
});
