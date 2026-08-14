/**
 * Identidad lógica de las entidades académicas.
 *
 * El `id` es la identidad técnica (la que asigna Postgres / el pipeline MCP), pero una
 * misma materia puede haber sido re-ingestada con un `id` distinto en algún momento. La
 * copia local en Dexie nunca se poda, así que esas versiones antiguas sobreviven en el
 * navegador y la UI las muestra como si fueran materias diferentes.
 *
 * Estas funciones definen la identidad *lógica* (la que percibe el usuario) para poder
 * detectar y colapsar esos duplicados.
 */

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export interface WithId {
  id?: string | number;
}

export function universityIdentity(u: { name?: string }): string {
  return norm(u.name);
}

export function professorIdentity(p: { university_id?: string; name?: string }): string {
  return `${norm(p.university_id)}|${norm(p.name)}`;
}

export function subjectIdentity(s: { university_id?: string; name?: string }): string {
  return `${norm(s.university_id)}|${norm(s.name)}`;
}

export function scheduleIdentity(s: {
  subject_id?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
}): string {
  return `${norm(s.subject_id)}|${norm(s.day_of_week)}|${norm(s.start_time)}|${norm(s.end_time)}`;
}

export function deliverableIdentity(d: { subject_id?: string; title?: string; due_date?: string }): string {
  return `${norm(d.subject_id)}|${norm(d.title)}|${norm(d.due_date)}`;
}

export function syllabusTopicIdentity(t: { subject_id?: string; title?: string }): string {
  return `${norm(t.subject_id)}|${norm(t.title)}`;
}

export function classSessionIdentity(cs: { subject_id?: string; title?: string; session_date?: string }): string {
  return `${norm(cs.subject_id)}|${norm(cs.title)}|${norm(cs.session_date)}`;
}

/**
 * Colapsa una lista dejando una sola entrada por identidad lógica, preservando el orden
 * de aparición. Cuando hay varias candidatas gana la de mayor `preferenceOf` (por defecto,
 * la primera que aparece).
 */
export function dedupeByIdentity<T>(
  rows: T[],
  identityOf: (row: T) => string,
  preferenceOf?: (row: T) => number
): T[] {
  const winnerByIdentity = new Map<string, { row: T; score: number; order: number }>();

  rows.forEach((row, order) => {
    const identity = identityOf(row);
    const score = preferenceOf ? preferenceOf(row) : 0;
    const current = winnerByIdentity.get(identity);
    if (!current || score > current.score) {
      winnerByIdentity.set(identity, { row, score, order: current ? current.order : order });
    }
  });

  return Array.from(winnerByIdentity.values())
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.row);
}
