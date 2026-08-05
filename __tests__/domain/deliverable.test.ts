import { describe, it, expect } from 'vitest';
import {
  filterDeliverables,
  sortDeliverablesByUrgency,
  calculateSubjectGradeProgress,
  generateDeliverablesFromPreset,
  PRESETS,
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
    expect(sorted[0].id).toBe('d2'); // Más urgente (4 de agosto)
    expect(sorted[1].id).toBe('d1'); // Segundo más urgente (10 de agosto)
  });

  it('debe calcular el progreso de notas y el promedio acumulado ponderado correctamente', () => {
    const deliverables: Deliverable[] = [
      { id: 'd-p1', subject_id: 'sub-calc', title: 'Parcial 1', weight_percentage: 20, grade: 4.0, status: 'calificado', type: 'parcial', due_date: '', is_group: false, complexity: 'medio' },
      { id: 'd-q1', subject_id: 'sub-calc', title: 'Quiz 1', weight_percentage: 5, grade: 5.0, status: 'calificado', type: 'quiz', due_date: '', is_group: false, complexity: 'facil' },
      { id: 'd-p2', subject_id: 'sub-calc', title: 'Parcial 2', weight_percentage: 20, status: 'pendiente', type: 'parcial', due_date: '', is_group: false, complexity: 'medio' },
    ];

    const progress = calculateSubjectGradeProgress(deliverables as any, 'sub-calc');
    expect(progress.totalConfiguredWeight).toBe(45);
    expect(progress.evaluatedWeight).toBe(25);
    // (4.0 * 20 + 5.0 * 5) / 25 = (80 + 25) / 25 = 105 / 25 = 4.20
    expect(progress.currentWeightedGrade).toBe(4.20);
    expect(progress.isComplete100Percent).toBe(false);
  });

  it('debe generar entregables a partir de una plantilla de 4 parciales (20%) + 1 actividad (20%) sumando 100%', () => {
    const preset = PRESETS[0];
    const generated = generateDeliverablesFromPreset(preset, 'sub-calc');
    expect(generated).toHaveLength(5);
    const sum = generated.reduce((acc, item) => acc + item.weight_percentage, 0);
    expect(sum).toBe(100);
  });
});
