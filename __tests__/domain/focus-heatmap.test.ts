import { describe, it, expect } from 'vitest';
import {
  buildHeatmapGrid,
  buildFocusStripView,
  formatFocusMinutes,
  formatHeatmapDate,
  heatmapCellLabel,
  heatmapLegend,
  HEATMAP_ROW_LABELS,
  type HeatmapDayInput,
} from '@/lib/domain/focus-heatmap';
import { dayNumber, heatLevel } from '@/lib/domain/focus';

// 004 · US-F3 (mapa de calor de foco). Lógica pura de la rejilla (columnas = semanas de lunes a
// domingo, filas = días L…D), del formato de minutos y del modelo de vista de Hoy. Sin DOM ni
// zona horaria: todo se calcula sobre fechas 'YYYY-MM-DD' ya resueltas por el servidor.

/** Miércoles. La semana en curso es la que empieza el lunes 5 de octubre de 2026. */
const TODAY = '2026-10-07';

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' + `delta` días, aritmética UTC sobre la fecha de calendario. */
function addDays(dateKey: string, delta: number): string {
  return new Date((dayNumber(dateKey) + delta) * DAY_MS).toISOString().slice(0, 10);
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha de calendario. */
function isoDow(dateKey: string): number {
  const dow = new Date(dayNumber(dateKey) * DAY_MS).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/**
 * Lo que devuelve el servidor: del lunes de hace `weeks − 1` semanas hasta `todayKey`, sin huecos
 * y con 0 explícito en los días vacíos. `minutosPorDia` fija los días con foco.
 */
function serverDays(weeks: number, todayKey: string, minutosPorDia: Record<string, number> = {}): HeatmapDayInput[] {
  const lunesDeHoy = addDays(todayKey, -(isoDow(todayKey) - 1));
  const desde = addDays(lunesDeHoy, -(weeks - 1) * 7);
  const out: HeatmapDayInput[] = [];
  for (let date = desde; date <= todayKey; date = addDays(date, 1)) {
    const minutos = minutosPorDia[date] ?? 0;
    out.push({ date, minutos, nivel: heatLevel(minutos) });
  }
  return out;
}

describe('[004] US-F3 · rejilla del mapa de calor', () => {
  it('US-F3-AS8 · cada columna es una semana de lunes a domingo y cada fila un día (L…D)', () => {
    const grid = buildHeatmapGrid(serverDays(12, TODAY), 12, TODAY);

    expect(HEATMAP_ROW_LABELS).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    expect(grid.columns).toHaveLength(12);

    for (const column of grid.columns) {
      expect(column.cells).toHaveLength(7);
      // La fila 0 es el lunes y la fila 6 el domingo; los días son consecutivos.
      column.cells.forEach((cell, row) => expect(isoDow(cell.date)).toBe(row + 1));
      column.cells.forEach((cell, row) => expect(cell.date).toBe(addDays(column.lunes, row)));
    }

    // Columnas consecutivas: cada una empieza siete días después de la anterior.
    for (let i = 1; i < grid.columns.length; i++) {
      expect(grid.columns[i].lunes).toBe(addDays(grid.columns[i - 1].lunes, 7));
    }
  });

  it('US-F3-AS8 · Hoy pinta 12 semanas: la última columna es la semana en curso y la primera empieza 11 semanas antes', () => {
    const grid = buildHeatmapGrid(serverDays(12, TODAY), 12, TODAY);

    expect(grid.columns).toHaveLength(12);
    expect(grid.columns[11].lunes).toBe('2026-10-05');
    expect(grid.columns[0].lunes).toBe('2026-07-20');
    expect(grid.columns[11].cells.map((c) => c.date)).toContain(TODAY);
  });

  it('US-F3-AS8 · Command Center pinta 52 semanas: del lunes de hace 51 semanas a la semana en curso', () => {
    const dias = serverDays(52, TODAY);
    const grid = buildHeatmapGrid(dias, 52, TODAY);

    expect(grid.columns).toHaveLength(52);
    expect(grid.columns[0].lunes).toBe('2025-10-13');
    expect(grid.columns[0].lunes).toBe(dias[0].date); // la rejilla arranca donde arranca el resumen
    expect(grid.columns[51].lunes).toBe('2026-10-05');
    expect(grid.columns.flatMap((c) => c.cells)).toHaveLength(52 * 7);
  });

  it('US-F3-AS8 · los días futuros de la semana en curso quedan vacíos, sin nivel (null)', () => {
    const grid = buildHeatmapGrid(serverDays(12, TODAY, { [TODAY]: 45 }), 12, TODAY);
    const current = grid.columns[11].cells;

    // L, M y X (hoy) ya pasaron; J, V, S y D están en el futuro.
    expect(current.slice(0, 3).every((c) => c.nivel !== null)).toBe(true);
    expect(current.slice(3).map((c) => c.nivel)).toEqual([null, null, null, null]);
    expect(current.slice(3).map((c) => c.date)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(current.slice(3).every((c) => c.minutos === 0)).toBe(true);

    // Hoy no es futuro: trae su nivel real. Y las semanas anteriores no tienen ningún null.
    expect(current[2]).toMatchObject({ date: TODAY, minutos: 45, nivel: 2 });
    const previousCells = grid.columns.slice(0, 11).flatMap((c) => c.cells);
    expect(previousCells.every((c) => c.nivel !== null)).toBe(true);
  });

  it('US-F3-AS8 · un resumen que termina en domingo no deja ningún día vacío en la última columna', () => {
    const sunday = '2026-10-11';
    const grid = buildHeatmapGrid(serverDays(12, sunday), 12, sunday);

    expect(grid.columns[11].lunes).toBe('2026-10-05');
    expect(grid.columns[11].cells.every((c) => c.nivel !== null)).toBe(true);
  });

  it('US-F3-AS8 · las celdas toman minutos y nivel del resumen; un día pasado que el resumen omitió vale 0, nivel 0', () => {
    const dias = serverDays(12, TODAY, { '2026-10-05': 400, '2026-10-06': 31 }).filter((d) => d.date !== '2026-09-30');
    const grid = buildHeatmapGrid(dias, 12, TODAY);
    const cells = new Map(grid.columns.flatMap((c) => c.cells).map((c) => [c.date, c]));

    expect(cells.get('2026-10-05')).toMatchObject({ minutos: 400, nivel: 4 });
    expect(cells.get('2026-10-06')).toMatchObject({ minutos: 31, nivel: 2 });
    expect(cells.get('2026-10-07')).toMatchObject({ minutos: 0, nivel: 0 });
    expect(cells.get('2026-09-30')).toMatchObject({ minutos: 0, nivel: 0 });
  });

  it('US-F3-AS8 · la etiqueta de mes sale solo en la primera columna de cada mes', () => {
    const grid = buildHeatmapGrid(serverDays(12, TODAY), 12, TODAY);
    const labelled = grid.columns
      .map((column, index) => ({ index, label: column.monthLabel }))
      .filter((entry) => entry.label !== null);

    // Lunes de las columnas: 20 jul, 27 jul, 3 ago, …, 31 ago, 7 sep, …, 28 sep, 5 oct.
    expect(labelled).toEqual([
      { index: 0, label: 'jul' },
      { index: 2, label: 'ago' },
      { index: 7, label: 'sep' },
      { index: 11, label: 'oct' },
    ]);
  });

  it('US-F3-AS8 · con 52 semanas hay una etiqueta por mes, justo en la columna donde el mes cambia', () => {
    const grid = buildHeatmapGrid(serverDays(52, TODAY), 52, TODAY);
    const monthOf = (dateKey: string) => dateKey.slice(5, 7);
    const labelled = grid.columns.map((column, index) => ({ column, index })).filter((e) => e.column.monthLabel !== null);

    // 52 semanas abarcan de octubre de un año a octubre del siguiente: 13 etiquetas, con 'oct' en
    // los dos extremos y cada mes de en medio una sola vez.
    expect(labelled.map((e) => e.column.monthLabel)).toEqual([
      'oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct',
    ]);

    // Toda columna etiquetada (salvo la primera) es la primera de su mes: el lunes anterior es de otro mes.
    for (const { column, index } of labelled) {
      if (index === 0) continue;
      expect(monthOf(column.lunes)).not.toBe(monthOf(grid.columns[index - 1].lunes));
    }
    // Y todo cambio de mes entre columnas contiguas lleva etiqueta: no hay mes sin nombre.
    for (let i = 1; i < grid.columns.length; i++) {
      if (monthOf(grid.columns[i].lunes) !== monthOf(grid.columns[i - 1].lunes)) {
        expect(grid.columns[i].monthLabel).not.toBeNull();
      }
    }
  });

  it('US-F3-AS8 · la etiqueta de la primera columna se omite si la del mes siguiente quedaría pegada', () => {
    // Semana en curso: lunes 14 dic 2026. Primera columna: lunes 28 sep; segunda: lunes 5 oct.
    // Cambian de mes en columnas contiguas, así que 'sep' y 'oct' se encimarían: queda solo 'oct'.
    const today = '2026-12-16';
    const grid = buildHeatmapGrid(serverDays(12, today), 12, today);

    expect(grid.columns[0].lunes).toBe('2026-09-28');
    expect(grid.columns[1].lunes).toBe('2026-10-05');
    expect(grid.columns[0].monthLabel).toBeNull();
    expect(grid.columns[1].monthLabel).toBe('oct');

    // Nunca hay dos etiquetas en columnas contiguas.
    for (let i = 1; i < grid.columns.length; i++) {
      expect(grid.columns[i - 1].monthLabel !== null && grid.columns[i].monthLabel !== null).toBe(false);
    }
  });

  it('US-F3-AS8 · la rejilla de una semana sola tiene una columna con su etiqueta de mes', () => {
    const grid = buildHeatmapGrid(serverDays(1, TODAY, { [TODAY]: 10 }), 1, TODAY);

    expect(grid.columns).toHaveLength(1);
    expect(grid.columns[0].lunes).toBe('2026-10-05');
    expect(grid.columns[0].monthLabel).toBe('oct');
  });
});

describe('[004] formatFocusMinutes', () => {
  it('400 minutos son "6 h 40 m"', () => {
    expect(formatFocusMinutes(400)).toBe('6 h 40 m');
  });

  it('menos de una hora se escribe solo en minutos: 45 → "45 m"', () => {
    expect(formatFocusMinutes(45)).toBe('45 m');
    expect(formatFocusMinutes(59)).toBe('59 m');
    expect(formatFocusMinutes(1)).toBe('1 m');
  });

  it('cero es "0 m"', () => {
    expect(formatFocusMinutes(0)).toBe('0 m');
  });

  it('horas exactas no llevan minutos: 60 → "1 h", 120 → "2 h"', () => {
    expect(formatFocusMinutes(60)).toBe('1 h');
    expect(formatFocusMinutes(120)).toBe('2 h');
  });

  it('más de 99 horas no cambia de formato y las horas con minutos de un dígito no se rellenan con cero', () => {
    expect(formatFocusMinutes(61)).toBe('1 h 1 m');
    expect(formatFocusMinutes(6000)).toBe('100 h');
  });

  it('un valor negativo, no finito o con decimales se normaliza a minutos enteros sin negativos', () => {
    expect(formatFocusMinutes(-5)).toBe('0 m');
    expect(formatFocusMinutes(Number.NaN)).toBe('0 m');
    expect(formatFocusMinutes(44.6)).toBe('45 m');
  });
});

describe('[004] textos de la rejilla', () => {
  it('formatHeatmapDate escribe el día sin cero y el mes abreviado en español: "5 oct"', () => {
    expect(formatHeatmapDate('2026-10-05')).toBe('5 oct');
    expect(formatHeatmapDate('2026-01-31')).toBe('31 ene');
    expect(formatHeatmapDate('2026-12-01')).toBe('1 dic');
  });

  it('heatmapCellLabel da "5 oct · 45 min" y no etiqueta los días futuros', () => {
    expect(heatmapCellLabel({ date: '2026-10-05', minutos: 45, nivel: 2 })).toBe('5 oct · 45 min');
    expect(heatmapCellLabel({ date: '2026-10-06', minutos: 0, nivel: 0 })).toBe('6 oct · 0 min');
    expect(heatmapCellLabel({ date: '2026-10-09', minutos: 0, nivel: null })).toBeNull();
  });

  it('la leyenda dice las cifras de los cinco niveles de FR-F17: 0 · 1–30 · 31–90 · 91–180 · >180 min', () => {
    const legend = heatmapLegend();

    expect(legend.map((entry) => entry.nivel)).toEqual([0, 1, 2, 3, 4]);
    expect(legend.map((entry) => entry.label)).toEqual(['0', '1–30', '31–90', '91–180', '>180']);
  });
});

describe('[004] franja de foco de Hoy (FR-F18)', () => {
  it('US-F3-AS8 · expone el total de la semana y una rejilla de 12 semanas', () => {
    const view = buildFocusStripView({
      date: TODAY,
      foco_semana_minutos: 400,
      foco_12_semanas: serverDays(12, TODAY, { '2026-10-05': 400 }),
    });

    expect(view).not.toBeNull();
    expect(view!.weekLabel).toBe('Esta semana');
    expect(view!.totalText).toBe('6 h 40 m');
    expect(view!.grid.columns).toHaveLength(12);
    expect(view!.grid.columns[11].cells[0]).toMatchObject({ date: '2026-10-05', minutos: 400, nivel: 4 });
  });

  it('solo expone total y rejilla: ni metas, ni minutos faltantes, ni avance, ni rachas (FR-F18)', () => {
    const view = buildFocusStripView({
      date: TODAY,
      foco_semana_minutos: 0,
      foco_12_semanas: serverDays(12, TODAY),
    });

    expect(Object.keys(view!).sort()).toEqual(['grid', 'totalText', 'weekLabel']);
    expect(view!.totalText).toBe('0 m');
  });

  it('un payload que todavía no trae los campos de foco no produce franja (null) en vez de romper Hoy', () => {
    expect(buildFocusStripView({ date: TODAY })).toBeNull();
    expect(buildFocusStripView({ date: TODAY, foco_semana_minutos: 30 })).toBeNull();
    expect(buildFocusStripView({ date: TODAY, foco_12_semanas: serverDays(12, TODAY) })).toBeNull();
  });
});
