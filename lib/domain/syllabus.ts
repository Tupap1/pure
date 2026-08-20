export interface SyllabusTopic {
  id: string;
  subject_id: string;
  parent_id?: string;
  title: string;
  description?: string;
  mastery_status: 'no_iniciado' | 'en_estudio' | 'repasado' | 'dominado';
  order_index: number;
}

export interface SynergyMatch {
  topicA: SyllabusTopic;
  topicB: SyllabusTopic;
  similarityScore: number;
}

const MASTERY_SCORES: Record<SyllabusTopic['mastery_status'], number> = {
  no_iniciado: 0.0,
  en_estudio: 0.33,
  repasado: 0.66,
  dominado: 1.0,
};

/**
  Calcula el porcentaje global de avance del syllabus considerando únicamente los temas hojas (REQ-03)
 */
export function calculateSyllabusProgress(topics: SyllabusTopic[]): number {
  if (!topics || topics.length === 0) return 0;

  const parentIds = new Set(topics.map((t) => t.parent_id).filter(Boolean));
  const leafTopics = topics.filter((t) => !parentIds.has(t.id));
  const evalTopics = leafTopics.length > 0 ? leafTopics : topics;

  let totalScore = 0;
  for (const topic of evalTopics) {
    totalScore += MASTERY_SCORES[topic.mastery_status] || 0;
  }

  const progress = (totalScore / evalTopics.length) * 100;
  return Math.round(progress * 100) / 100;
}

/**
  Normaliza y extrae palabras clave con ponderación de términos técnicos de ingeniería
 */
function getStemmedWords(title: string): { word: string; weight: number }[] {
  const genericVerbs = new Set(['metodos', 'metodo', 'resolucion', 'operaciones', 'operacion', 'introduccion', 'principios', 'fundamentos']);

  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => {
      let stem = w;
      if (stem.endsWith('es')) stem = stem.slice(0, -2);
      else if (stem.endsWith('os') || stem.endsWith('as')) stem = stem.slice(0, -2);
      else if (stem.endsWith('o') || stem.endsWith('a')) stem = stem.slice(0, -1);

      // Términos técnicos pesan 2.0, verbos genéricos pesan 1.0
      const weight = genericVerbs.has(w) ? 1.0 : 2.0;
      return { word: stem, weight };
    });
}

/**
  Calcula la similitud de Sinergia Temática entre dos títulos (REQ-04)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const stems1 = getStemmedWords(str1);
  const stems2 = getStemmedWords(str2);

  if (stems1.length === 0 || stems2.length === 0) return 0;

  let sharedWeight = 0;
  let totalWeight1 = 0;

  for (const item1 of stems1) {
    totalWeight1 += item1.weight;
    for (const item2 of stems2) {
      if (
        item1.word === item2.word ||
        (item1.word.length >= 4 && item2.word.length >= 4 && (item1.word.includes(item2.word) || item2.word.includes(item1.word)))
      ) {
        sharedWeight += item1.weight;
        break;
      }
    }
  }

  const score = sharedWeight / totalWeight1;
  return Math.min(1.0, Math.round(score * 100) / 100);
}

/**
  Escanea temarios de distintas materias y retorna coincidencias/sinergias (REQ-04)
 */
export function findSynergiesBetweenTopics(
  topicsA: SyllabusTopic[],
  topicsB: SyllabusTopic[],
  threshold = 0.3
): SynergyMatch[] {
  const matches: SynergyMatch[] = [];

  for (const tA of topicsA) {
    for (const tB of topicsB) {
      if (tA.subject_id !== tB.subject_id) {
        const score = calculateStringSimilarity(tA.title, tB.title);
        if (score >= threshold) {
          matches.push({
            topicA: tA,
            topicB: tB,
            similarityScore: score,
          });
        }
      }
    }
  }

  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Parses raw syllabus text and creates a hierarchical topic structure.
 * Lines starting with "unidad" (case-insensitive) become parent topics.
 * Subsequent lines become children of the most recent unit.
 * Orphan lines (no preceding unit) get parent_id = undefined.
 *
 * Returns array sorted by order_index, ready to persist.
 */
export function parseSyllabusText(rawText: string, subjectId: string): SyllabusTopic[] {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const topics: SyllabusTopic[] = [];
  let currentParentId: string | undefined = undefined;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (line.toLowerCase().startsWith('unidad')) {
      // Detect "Unidad X" as a parent topic
      const parentId = `${subjectId}-unit-${index}`;
      currentParentId = parentId;
      topics.push({
        id: parentId,
        subject_id: subjectId,
        title: line,
        mastery_status: 'no_iniciado',
        order_index: index,
      });
    } else {
      // Regular topic: child of currentParentId (if any)
      topics.push({
        id: `${subjectId}-topic-${index}`,
        subject_id: subjectId,
        parent_id: currentParentId,
        title: line.replace(/^[-*•]\s*/, ''),
        mastery_status: 'no_iniciado',
        order_index: index,
      });
    }
  }

  return topics;
}
