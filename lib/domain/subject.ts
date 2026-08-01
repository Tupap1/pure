export interface DeliverableItem {
  weight_percentage: number;
  grade?: number;
  status: 'pendiente' | 'entregado' | 'calificado';
}

export interface WeightedGradeResult {
  currentGrade: number;
  evaluatedWeightPercentage: number;
}

/**
  Calcula la nota actual ponderada basada únicamente en los trabajos calificados (REQ-02)
 */
export function calculateWeightedGrade(deliverables: DeliverableItem[]): WeightedGradeResult {
  const gradedItems = deliverables.filter(
    (item) => item.status === 'calificado' && typeof item.grade === 'number'
  );

  if (gradedItems.length === 0) {
    return { currentGrade: 0, evaluatedWeightPercentage: 0 };
  }

  let totalPoints = 0;
  let evaluatedWeightPercentage = 0;

  for (const item of gradedItems) {
    totalPoints += (item.grade as number) * item.weight_percentage;
    evaluatedWeightPercentage += item.weight_percentage;
  }

  if (evaluatedWeightPercentage === 0) {
    return { currentGrade: 0, evaluatedWeightPercentage: 0 };
  }

  const currentGrade = Math.round((totalPoints / evaluatedWeightPercentage) * 100) / 100;

  return {
    currentGrade,
    evaluatedWeightPercentage
  };
}

/**
  Calcula la nota promedio necesaria en el porcentaje restante para alcanzar la nota meta (REQ-02)
 */
export function calculateRequiredGradeForRemaining(
  deliverables: DeliverableItem[],
  targetGrade: number
): number | null {
  const { currentGrade, evaluatedWeightPercentage } = calculateWeightedGrade(deliverables);
  const remainingWeight = 100 - evaluatedWeightPercentage;

  if (remainingWeight <= 0) {
    return null; // Ya se evaluó el 100% de la materia
  }

  const totalPointsNeeded = targetGrade * 100;
  const currentPointsEarned = currentGrade * evaluatedWeightPercentage;
  const pointsMissing = totalPointsNeeded - currentPointsEarned;

  const requiredGrade = Math.round((pointsMissing / remainingWeight) * 100) / 100;

  return requiredGrade;
}
