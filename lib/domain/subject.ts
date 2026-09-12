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
 * Estado normalizado de una entrega. El enum real es `pendiente|entregado|calificado`, pero el
 * MCP históricamente guardó lo que llegó del agente, así que en la base hay datos `completado`
 * (R-11). `normalizeDeliverableStatus` tolera eso en lectura sin tocar la escritura.
 */
export type NormalizedDeliverableStatus = 'pendiente' | 'entregado' | 'calificado';

/**
 * Normaliza el estado heredado `completado` a `entregado` (R-11, FR-029). Cualquier valor que
 * no sea uno de los tres estados válidos (incluido `null`/`undefined`) se trata como `pendiente`,
 * para no contarlo por accidente como una entrega calificada.
 */
export function normalizeDeliverableStatus(
  status: string | null | undefined
): NormalizedDeliverableStatus {
  if (status === 'completado') return 'entregado';
  if (status === 'pendiente' || status === 'entregado' || status === 'calificado') return status;
  return 'pendiente';
}

/**
 * Una entrega cuenta como calificada cuando su estado normalizado no es `pendiente` y tiene una
 * nota numérica (FR-029, US5-AS7): tanto `calificado` como `entregado` con nota cuentan, en
 * cualquier vista que reutilice esta función (`calculateWeightedGrade`,
 * `calculateSubjectGradeProgress`).
 */
export function isGradedDeliverable(item: { status: string; grade?: number | null }): boolean {
  const normalized = normalizeDeliverableStatus(item.status);
  return normalized !== 'pendiente' && typeof item.grade === 'number' && !Number.isNaN(item.grade);
}

/**
  Calcula la nota actual ponderada basada únicamente en los trabajos calificados (REQ-02, US5-AS7)
 */
export function calculateWeightedGrade(deliverables: DeliverableItem[]): WeightedGradeResult {
  const gradedItems = deliverables.filter(isGradedDeliverable);

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

// ---------------------------------------------------------------------------------------------
// US5 · Proyección de nota por materia (FR-026..FR-029)
// ---------------------------------------------------------------------------------------------

export interface GradeProjectionDeliverable {
  weight_percentage: number;
  grade?: number | null;
  /** Estado crudo, tolerado como string porque la base puede traer el valor heredado `completado`. */
  status: string;
  due_date?: string | null;
}

export interface GradeProjectionOptions {
  /** Escala de la universidad de la materia (típicamente 5). */
  scaleMax: number;
  /** Nota aprobatoria de la universidad de la materia (típicamente 3.0). */
  passingGrade: number;
  /** Meta personal del usuario para la materia. */
  targetGrade: number;
}

export interface GradeProjection {
  /** Suma de los pesos declarados. Debe ser 100 para que se calculen necesaria y techo. */
  declaredWeight: number;
  /** Peso de las entregas que cuentan como calificadas (`isGradedDeliverable`). */
  gradedWeight: number;
  /** Peso de las entregas "entregado" sin nota todavía (subconjunto de lo no calificado). */
  awaitingGradeWeight: number;
  /** Peso declarado que aún no cuenta como calificado (`declaredWeight - gradedWeight`). */
  remainingWeight: number;
  /** Promedio de las entregas calificadas (aporte / peso calificado * 100). */
  currentAverage: number;
  /** Aporte acumulado a la nota final (Σ nota·peso / 100). */
  consolidated: number;
  /** Nota necesaria en el peso restante para aprobar, redondeada hacia arriba (R-16). `null` si no se puede calcular. */
  neededToPass: number | null;
  /** Nota necesaria en el peso restante para la meta, redondeada hacia arriba (R-16). `null` si no se puede calcular. */
  neededForTarget: number | null;
  /** Techo alcanzable si el resto del peso se saca perfecto, redondeado hacia abajo (R-16). `null` si no se puede calcular. */
  ceiling: number | null;
}

export type GradeProjectionFlag =
  | 'ciega'
  | 'pesos_inconsistentes'
  | 'entregado_sin_nota'
  | 'vencido_sin_registrar'
  | 'meta_inalcanzable'
  | 'materia_perdida';

export interface GradeProjectionResult {
  projection: GradeProjection;
  flags: GradeProjectionFlag[];
}

/** Margen para absorber el ruido de punto flotante sin desplazar un valor genuino (R-16). */
const ROUNDING_EPSILON = 1e-9;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Redondea hacia arriba a 2 decimales sin el ruido de punto flotante que hace que
 * `Math.round((266 / 80) * 100) / 100` dé a veces 3.32 en vez de 3.33 (R-16). La nota necesaria
 * SIEMPRE se redondea hacia arriba: nunca debe prometer menos de lo que realmente hace falta.
 */
function ceil2(value: number): number {
  return Math.ceil(value * 100 - ROUNDING_EPSILON) / 100;
}

/**
 * Redondea hacia abajo a 2 decimales, con la misma protección contra ruido de punto flotante
 * que `ceil2` (R-16). El techo SIEMPRE se redondea hacia abajo: nunca debe prometer más de lo
 * alcanzable.
 */
function floor2(value: number): number {
  return Math.floor(value * 100 + ROUNDING_EPSILON) / 100;
}

/**
 * Proyecta la nota de una materia: aporte acumulado, promedio evaluado, peso restante, nota
 * necesaria para aprobar y para la meta (redondeadas hacia arriba) y techo alcanzable (redondeado
 * hacia abajo), más las alertas de FR-027 cuando los datos no alcanzan o son inconsistentes.
 *
 * Nunca lee `subjects.current_grade`: la escala, la aprobatoria y la meta llegan por `options`,
 * y `now` (el reloj del servidor, nunca el del cliente — Principio III) decide qué pendientes
 * están vencidas.
 */
export function projectSubjectGrade(
  deliverables: GradeProjectionDeliverable[],
  options: GradeProjectionOptions,
  now: Date
): GradeProjectionResult {
  const { scaleMax, passingGrade, targetGrade } = options;

  if (deliverables.length === 0) {
    return {
      projection: {
        declaredWeight: 0,
        gradedWeight: 0,
        awaitingGradeWeight: 0,
        remainingWeight: 0,
        currentAverage: 0,
        consolidated: 0,
        neededToPass: null,
        neededForTarget: null,
        ceiling: null,
      },
      flags: ['ciega'],
    };
  }

  const flags: GradeProjectionFlag[] = [];

  const declaredWeight = round2(
    deliverables.reduce((sum, item) => sum + (item.weight_percentage || 0), 0)
  );
  const isConsistent = declaredWeight === 100;
  if (!isConsistent) {
    flags.push('pesos_inconsistentes');
  }

  const gradedItems = deliverables.filter(isGradedDeliverable);
  const gradedWeight = round2(
    gradedItems.reduce((sum, item) => sum + (item.weight_percentage || 0), 0)
  );
  const consolidated = round2(
    gradedItems.reduce((sum, item) => sum + (item.grade as number) * item.weight_percentage, 0) / 100
  );
  const currentAverage = gradedWeight > 0 ? round2((consolidated * 100) / gradedWeight) : 0;

  const awaitingGradeWeight = round2(
    deliverables.reduce((sum, item) => {
      if (normalizeDeliverableStatus(item.status) !== 'entregado') return sum;
      const missingGrade = typeof item.grade !== 'number' || Number.isNaN(item.grade);
      return missingGrade ? sum + (item.weight_percentage || 0) : sum;
    }, 0)
  );
  if (awaitingGradeWeight > 0) {
    flags.push('entregado_sin_nota');
  }

  const hasOverduePending = deliverables.some((item) => {
    if (normalizeDeliverableStatus(item.status) !== 'pendiente') return false;
    if (!item.due_date) return false;
    return new Date(item.due_date).getTime() < now.getTime();
  });
  if (hasOverduePending) {
    flags.push('vencido_sin_registrar');
  }

  const remainingWeight = round2(declaredWeight - gradedWeight);

  let neededToPass: number | null = null;
  let neededForTarget: number | null = null;
  let ceiling: number | null = null;

  if (isConsistent) {
    if (remainingWeight <= 0) {
      // Nada queda por evaluar: el aporte acumulado ya es la nota final, sin nada que proyectar.
      ceiling = consolidated;
    } else {
      neededToPass = Math.max(0, ceil2(((passingGrade - consolidated) * 100) / remainingWeight));
      neededForTarget = Math.max(0, ceil2(((targetGrade - consolidated) * 100) / remainingWeight));
      ceiling = floor2(consolidated + (scaleMax * remainingWeight) / 100);
    }
  }

  if (neededForTarget !== null && neededForTarget > scaleMax) {
    flags.push('meta_inalcanzable');
  }
  if (ceiling !== null && ceiling < passingGrade) {
    flags.push('materia_perdida');
  }

  return {
    projection: {
      declaredWeight,
      gradedWeight,
      awaitingGradeWeight,
      remainingWeight,
      currentAverage,
      consolidated,
      neededToPass,
      neededForTarget,
      ceiling,
    },
    flags,
  };
}
