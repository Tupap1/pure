import { describe, it, expect } from 'vitest';
import {
  calculateSyllabusProgress,
  findSynergiesBetweenTopics,
  SyllabusTopic
} from '@/lib/domain/syllabus';

describe('REQ-03 & REQ-04: Ejes Temáticos, Dominio y Motor de Sinergias Temáticas', () => {
  const mockSyllabus: SyllabusTopic[] = [
    { id: '1', subject_id: 'sub-1', title: 'Unidad 1: Álgebra y Matrices', mastery_status: 'dominado', order_index: 1 },
    { id: '2', subject_id: 'sub-1', title: 'Tema 1.1: Multiplicación de Matrices', parent_id: '1', mastery_status: 'dominado', order_index: 1 },
    { id: '3', subject_id: 'sub-1', title: 'Tema 1.2: Determinantes y Inversas', parent_id: '1', mastery_status: 'en_estudio', order_index: 2 },
    { id: '4', subject_id: 'sub-1', title: 'Unidad 2: Ecuaciones Diferenciales', mastery_status: 'no_iniciado', order_index: 2 },
  ];

  it('debe calcular el porcentaje global de avance del syllabus ponderando los estados de dominio', () => {
    // dominado = 1.0, en_estudio = 0.33, no_iniciado = 0.0
    // Promedio de temas hojas: (1.0 + 0.33 + 0.0) / 3 = 1.33 / 3 = 44.33%
    const progress = calculateSyllabusProgress(mockSyllabus);
    expect(progress).toBeGreaterThan(40);
    expect(progress).toBeLessThan(48);
  });

  it('debe detectar sinergias temáticas (similitud) entre temas de distintas materias', () => {
    const topicsAeroespacial: SyllabusTopic[] = [
      { id: 'a1', subject_id: 'aero-1', title: 'Métodos Numéricos y Resolución de Matrices', mastery_status: 'dominado', order_index: 1 },
      { id: 'a2', subject_id: 'aero-1', title: 'Termodinámica de Gases en Módulos', mastery_status: 'no_iniciado', order_index: 2 },
    ];

    const topicsSoftware: SyllabusTopic[] = [
      { id: 's1', subject_id: 'soft-1', title: 'Algoritmos Numéricos y Operaciones con Matrices', mastery_status: 'no_iniciado', order_index: 1 },
      { id: 's2', subject_id: 'soft-1', title: 'Patrones de Diseño de Software', mastery_status: 'no_iniciado', order_index: 2 },
    ];

    const synergies = findSynergiesBetweenTopics(topicsAeroespacial, topicsSoftware);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].topicA.id).toBe('a1');
    expect(synergies[0].topicB.id).toBe('s1');
    expect(synergies[0].similarityScore).toBeGreaterThan(0.6);
  });
});
