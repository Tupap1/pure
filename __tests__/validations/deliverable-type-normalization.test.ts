import { describe, it, expect } from 'vitest';
import { DeliverableSchema, validateEntity } from '@/lib/validations/schemas';

/**
 * B2: el `type` de una entrega se escribía capitalizado ('Parcial') pero el planificador de
 * estudio lo lee en minúscula ('parcial'/'examen_final'), así que ninguna entrega creada por
 * UI se clasificaba. El DeliverableSchema ahora normaliza el `type` a minúscula canónica
 * antes de validar. Estas pruebas fijan ese contrato.
 */
describe('B2: normalización del `type` de las entregas', () => {
  const base = {
    subject_id: 'sub-1',
    title: 'Actividad de prueba',
    weight_percentage: 20,
    due_date: '2026-10-15',
    is_group: false,
    complexity: 'medio',
    status: 'pendiente',
  };

  const cases: Array<[string, string]> = [
    ['Parcial', 'parcial'],
    ['Taller', 'taller'],
    ['Proyecto', 'proyecto'],
    ['Quiz', 'quiz'],
    ['Laboratorio', 'laboratorio'],
    ['Examen Final', 'examen_final'], // el espacio se vuelve guion bajo
    ['examen final', 'examen_final'],
    ['QUIZ', 'quiz'],
    ['  Parcial  ', 'parcial'], // se recorta el espacio
    ['examen_final', 'examen_final'], // ya canónico
  ];

  it.each(cases)('normaliza "%s" a "%s"', (input, expected) => {
    const result = validateEntity(DeliverableSchema, { ...base, type: input });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe(expected);
    }
  });

  it('rechaza un tipo que no existe en el enum', () => {
    const result = validateEntity(DeliverableSchema, { ...base, type: 'ensayo' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.type).toBeDefined();
    }
  });

  it('el valor normalizado coincide con lo que lee el planificador de estudio', () => {
    // study-planner.ts compara contra 'examen_final' y 'parcial' en minúscula.
    const result = validateEntity(DeliverableSchema, { ...base, type: 'Examen Final' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(['taller', 'proyecto', 'parcial', 'quiz', 'laboratorio', 'examen_final']).toContain(
        result.data.type
      );
    }
  });
});
