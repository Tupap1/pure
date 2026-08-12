import { useMemo } from 'react';
import { usePureData } from './usePureData';
import { computeAcademicLoad, type AcademicLoadSummary } from '../algorithms/academic-load';

/**
 * Fuente única de las métricas de carga académica.
 *
 * El encabezado, el Command Center y la tabla de telemetría calculaban cada uno por su cuenta
 * las mismas horas, con riesgo de mostrar cifras distintas en la misma pantalla. Todos leen
 * ahora de aquí.
 */
export function useAcademicLoad(): AcademicLoadSummary & { isLoaded: boolean } {
  const { isLoaded, subjects, schedules, universities } = usePureData();

  const summary = useMemo(
    () => computeAcademicLoad(subjects, schedules, universities),
    [subjects, schedules, universities]
  );

  return { ...summary, isLoaded };
}
