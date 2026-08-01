export interface UniversityConfig {
  id?: string;
  name: string;
  modality: 'presencial' | 'virtual' | 'hibrida';
  scale_min: number;
  scale_max: number;
  passing_grade: number;
  color: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
  Valida las reglas de negocio para la entidad Universidad (REQ-01)
 */
export function validateUniversity(config: UniversityConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.name || config.name.trim() === '') {
    errors.push('El nombre de la universidad es obligatorio');
  }

  if (config.scale_min >= config.scale_max) {
    errors.push('La escala mínima debe ser estrictamente menor que la escala máxima');
  }

  if (
    config.passing_grade < config.scale_min ||
    config.passing_grade > config.scale_max
  ) {
    errors.push('La nota aprobatoria debe estar dentro del rango de la escala');
  }

  if (!['presencial', 'virtual', 'hibrida'].includes(config.modality)) {
    errors.push('La modalidad debe ser presencial, virtual o hibrida');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
  Normaliza una calificación a porcentaje de 0% a 100%
 */
export function normalizeGrade(
  grade: number,
  scale: { scale_min: number; scale_max: number }
): number {
  const range = scale.scale_max - scale.scale_min;
  if (range <= 0) return 0;
  
  const normalized = ((grade - scale.scale_min) / range) * 100;
  return Math.round(normalized * 100) / 100;
}
