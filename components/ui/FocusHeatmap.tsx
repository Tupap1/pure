import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  formatHeatmapDate,
  heatmapCellLabel,
  heatmapLegend,
  HEATMAP_ROW_LABELS,
  type HeatmapCell,
  type HeatmapGrid,
} from '@/lib/domain/focus-heatmap';

/**
 * Mapa de calor de foco (004, US-F3, FR-F17): una columna por semana de lunes a domingo y una
 * fila por día (L…D). Es presentación pura: la rejilla ya viene armada por `buildHeatmapGrid`
 * (lib/domain/focus-heatmap.ts), que es donde viven los niveles, las etiquetas de mes y los días
 * futuros (sin nivel, se pintan vacíos).
 *
 * Diseño (DESIGN.md): rejilla CSS sin librería (R11), cinco tonos secuenciales del verde synergy
 * como tokens `--heat-0…4` (claro y oscuro), nivel 0 en superficie neutra con borde fino, sin
 * sombras ni glow, y leyenda con las cifras de los niveles. Plex Mono solo en cifras. No muestra
 * rachas ni "días activos". Con 52 semanas la rejilla se desplaza en horizontal dentro de su
 * contenedor (la página no se desborda) y arranca en el extremo reciente.
 *
 * Cada celda lleva `title` y `aria-label` ("5 oct · 45 min"). Como en el móvil no hay cursor, tocar
 * una celda muestra el mismo dato bajo la rejilla.
 */

/**
 * Duración ya formateada ("6 h 40 m") con las cifras en IBM Plex Mono y las unidades en Plex Sans
 * (DESIGN.md: la mono es solo para cifras; entera, "h" y "m" quedan con un hueco enorme).
 */
export const FocusDuration: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(d+)/).map((part, index) =>
      /^d+$/.test(part) ? (
        <span key={index} className="font-mono tabular-nums">
          {part}
        </span>
      ) : (
        part
      )
    )}
  </>
);

type CellLevel = 0 | 1 | 2 | 3 | 4;

const LEVEL_CLASS: Record<CellLevel, string> = {
  0: 'bg-heat-0 border-surface-border',
  1: 'bg-heat-1 border-transparent',
  2: 'bg-heat-2 border-transparent',
  3: 'bg-heat-3 border-transparent',
  4: 'bg-heat-4 border-transparent',
};

/** Alto de la fila de etiquetas de mes (px). Las celdas miden 12 px, con 3 px de hueco. */
const MONTH_ROW_PX = 14;
const CELL_PX = 12;

interface FocusHeatmapProps {
  grid: HeatmapGrid;
  /** Nombre accesible de la región, p. ej. "Minutos enfocados por día, últimas 52 semanas". */
  ariaLabel: string;
  /** La leyenda con las cifras de los niveles (FR-F17). Por defecto se muestra. */
  showLegend?: boolean;
  className?: string;
}

const FocusHeatmapView: React.FC<FocusHeatmapProps> = ({ grid, ariaLabel, showLegend = true, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  // Con muchas semanas la rejilla es más ancha que su contenedor: arranca en el extremo reciente
  // (hoy), que es lo que se mira primero. Solo al montar o al cambiar el número de columnas, para
  // no devolver el desplazamiento al extremo cada vez que se cambia el filtro.
  const columnCount = grid.columns.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columnCount]);

  const cellsByDate = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const column of grid.columns) for (const cell of column.cells) map.set(cell.date, cell);
    return map;
  }, [grid]);

  const picked = pickedDate ? cellsByDate.get(pickedDate) ?? null : null;
  const legend = heatmapLegend();

  return (
    <div className={cn('w-fit max-w-full', className)}>
      <div
        ref={scrollRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-md"
      >
        <div
          className="grid w-max gap-[3px] pr-3"
          style={{
            gridAutoFlow: 'column',
            gridTemplateColumns: `auto repeat(${columnCount}, ${CELL_PX}px)`,
            gridTemplateRows: `${MONTH_ROW_PX}px repeat(7, ${CELL_PX}px)`,
          }}
        >
          {/* Primera columna: etiquetas de fila. Pegada al borde izquierdo al desplazar. */}
          <div aria-hidden className="sticky left-0 z-10 bg-surface" />
          {HEATMAP_ROW_LABELS.map((label, row) => (
            <div
              key={row}
              aria-hidden
              className="sticky left-0 z-10 bg-surface pr-1.5 text-[10px] leading-[12px] text-slate-500 dark:text-slate-400"
            >
              {label}
            </div>
          ))}

          {grid.columns.map((column) => (
            <React.Fragment key={column.lunes}>
              <div aria-hidden className="relative">
                {column.monthLabel && (
                  <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-[14px] text-slate-500 dark:text-slate-400">
                    {column.monthLabel}
                  </span>
                )}
              </div>
              {column.cells.map((cell) => {
                if (cell.nivel === null) {
                  // Día futuro de la semana en curso: vacío, sin nivel ni dato que decir.
                  return <div key={cell.date} aria-hidden />;
                }
                const label = heatmapCellLabel(cell) ?? '';
                return (
                  <div
                    key={cell.date}
                    role="img"
                    aria-label={label}
                    title={label}
                    onClick={() => setPickedDate(cell.date)}
                    className={cn(
                      'box-border rounded-sm border',
                      LEVEL_CLASS[cell.nivel],
                      pickedDate === cell.date && 'outline outline-1 outline-offset-1 outline-slate-500 dark:outline-slate-400'
                    )}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Dato de la celda tocada (en pantallas táctiles no hay cursor para el `title`). Solo existe
          tras un toque y va aparte de la leyenda: así no la empuja a otra línea ni reserva alto. */}
      {picked && picked.nivel !== null && (
        <p aria-hidden className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {formatHeatmapDate(picked.date)} · <span className="font-mono">{picked.minutos}</span> min
        </p>
      )}

      {showLegend && (
        <div
          role="group"
          aria-label="Escala de minutos por día"
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400"
        >
          {legend.map((entry, index) => (
            <span key={entry.nivel} className="inline-flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className={cn('box-border h-3 w-3 rounded-sm border', LEVEL_CLASS[entry.nivel])} />
              <span className="font-mono">{entry.label}</span>
              {/* La unidad va pegada al último nivel: no queda sola en otra línea al envolver. */}
              {index === legend.length - 1 && <span>min</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Hoy se vuelve a renderizar cada segundo mientras hay una sesión en curso: con `grid` estable
// (memoizado por quien la arma) la rejilla de 84 o 364 celdas no se repinta en cada tick.
export const FocusHeatmap = React.memo(FocusHeatmapView);
