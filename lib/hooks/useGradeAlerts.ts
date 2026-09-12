import { useCallback, useEffect, useState } from 'react';

// Alertas de proyección de nota (US5, elevadas por US9 a la Agenda): materias "ciega" (sin
// evaluaciones registradas) o "abandonada" (evaluación en menos de 7 días sin tandas recientes).
// GET /api/execution/grade-projection ya filtra qué puede salir por la web (nunca datos que no
// deban); este hook solo se queda con `alertas`, que es lo único que
// components/dashboards/DeliverablesDashboard.tsx necesita (US9-AS3).

export interface GradeAlert {
  kind: 'abandonada' | 'ciega';
  subject_id: string;
  detalle: string;
}

export function useGradeAlerts() {
  const [alerts, setAlerts] = useState<GradeAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/execution/grade-projection');
      const json = await res.json();
      setAlerts(json.status === 'success' && Array.isArray(json.data?.alertas) ? json.data.alertas : []);
    } catch {
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { alerts, isLoading, refresh };
}
