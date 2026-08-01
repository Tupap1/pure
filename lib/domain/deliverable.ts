export interface Deliverable {
  id: string;
  subject_id: string;
  topic_id?: string;
  title: string;
  description?: string;
  due_date: string; // ISO String
  weight_percentage: number;
  grade?: number;
  type: 'taller' | 'proyecto' | 'parcial' | 'quiz' | 'examen_final';
  is_group: boolean;
  complexity: 'facil' | 'medio' | 'dificil';
  status: 'pendiente' | 'entregado' | 'calificado';
}

export interface DeliverableFilterOptions {
  is_group?: boolean;
  status?: 'pendiente' | 'entregado' | 'calificado';
  complexity?: 'facil' | 'medio' | 'dificil';
  type?: 'taller' | 'proyecto' | 'parcial' | 'quiz' | 'examen_final';
  subject_id?: string;
}

/**
  Filtra la lista de entregas según los criterios especificados (REQ-05)
 */
export function filterDeliverables(
  items: Deliverable[],
  options: DeliverableFilterOptions = {}
): Deliverable[] {
  return items.filter((item) => {
    if (options.is_group !== undefined && item.is_group !== options.is_group) {
      return false;
    }
    if (options.status && item.status !== options.status) {
      return false;
    }
    if (options.complexity && item.complexity !== options.complexity) {
      return false;
    }
    if (options.type && item.type !== options.type) {
      return false;
    }
    if (options.subject_id && item.subject_id !== options.subject_id) {
      return false;
    }
    return true;
  });
}

/**
  Ordena las entregas pendientes por urgencia según fecha límite ascendente (REQ-05)
 */
export function sortDeliverablesByUrgency(items: Deliverable[]): Deliverable[] {
  const pendingItems = items.filter((item) => item.status === 'pendiente');

  return [...pendingItems].sort((a, b) => {
    const timeA = new Date(a.due_date).getTime();
    const timeB = new Date(b.due_date).getTime();
    return timeA - timeB;
  });
}
