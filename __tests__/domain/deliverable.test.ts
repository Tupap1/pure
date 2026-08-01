import { describe, it, expect } from 'vitest';
import {
  filterDeliverables,
  sortDeliverablesByUrgency,
  DeliverableFilterOptions,
  Deliverable
} from '@/lib/domain/deliverable';

describe('REQ-05: Entregas, Evaluaciones y Filtros de Tareas', () => {
  const mockDeliverables: Deliverable[] = [
    {
      id: 'd1',
      subject_id: 'sub-1',
      title: 'Taller 1: Mecánica Orbital',
      due_date: '2026-08-10T23:59:00Z',
      weight_percentage: 15,
      type: 'taller',
      is_group: false,
      complexity: 'medio',
      status: 'pendiente',
    },
    {
      id: 'd2',
      subject_id: 'sub-2',
      title: 'Proyecto Integrador: Avionica C++',
      due_date: '2026-08-04T23:59:00Z',
      weight_percentage: 30,
      type: 'proyecto',
      is_group: true,
      complexity: 'dificil',
      status: 'pendiente',
    },
    {
      id: 'd3',
      subject_id: 'sub-1',
      title: 'Parcial 1: Estructuras',
      due_date: '2026-08-02T12:00:00Z',
      weight_percentage: 25,
      type: 'parcial',
      is_group: false,
      complexity: 'dificil',
      status: 'calificado',
      grade: 4.8,
    },
  ];

  it('debe filtrar entregas por modalidad (grupal vs individual)', () => {
    const groupOnly = filterDeliverables(mockDeliverables, { is_group: true });
    expect(groupOnly).toHaveLength(1);
    expect(groupOnly[0].id).toBe('d2');

    const individualOnly = filterDeliverables(mockDeliverables, { is_group: false });
    expect(individualOnly).toHaveLength(2);
  });

  it('debe filtrar entregas por estado (pendiente, entregado, calificado)', () => {
    const pendingOnly = filterDeliverables(mockDeliverables, { status: 'pendiente' });
    expect(pendingOnly).toHaveLength(2);
  });

  it('debe ordenar entregas pendientes por urgencia de fecha límite', () => {
    const sorted = sortDeliverablesByUrgency(mockDeliverables);
    // d3 está calificado, d2 es el 04 de agosto, d1 es el 10 de agosto
    expect(sorted[0].id).toBe('d2'); // Más urgente (4 de agosto)
    expect(sorted[1].id).toBe('d1'); // Segundo más urgente (10 de agosto)
  });
});
