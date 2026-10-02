// Servicio de frases (US-F5). Frases latinas con traducción y fuente opcionales que Hoy rota por
// fecha (`quoteOfDay`, lib/domain/focus.ts). Entran SOLO por MCP (manage_quotes), una a una o en
// carga múltiple (FR-F25): la web no las escribe, así que la lista blanca de
// app/api/execution/route.ts no incluye esta herramienta (US-F5-AS6).
//
// Idempotencia (research R4): el id de cada frase es determinista, `frase-` + los primeros 16 hex
// del SHA-256 de `lower(trim(text))`, de modo que "Carpe diem" y " CARPE DIEM " son la misma frase.
// `create_many` valida el lote entero con Zod (lo hace el handler: todo o nada), lee los ids
// existentes, calcula en TypeScript cuáles son nuevos e inserta solo esos dentro de una
// transacción. `ON CONFLICT (id) DO NOTHING` queda como red de seguridad ante dos cargas
// simultáneas. Las cifras `creadas` y `omitidas` salen de esa diferencia en TypeScript y NO de
// `RETURNING`: pg-mem devuelve la fila aunque haya conflicto y Postgres real no, así que contar
// con RETURNING daría cifras distintas en las pruebas y en producción.
//
// Cambiar el `text` de una frase NO cambia su id (el id sale del texto original): el orden de la
// rotación es estable aunque se corrija una errata.

import crypto from 'crypto';
import {
  fetchQuotesFromDb,
  insertQuotesInDb,
  updateQuoteInDb,
  withExecutionTransaction,
  QuoteRecord,
} from '../db/execution-pg';
import type { ExecutionResult, ExecutionErrorResult } from '../validations/schemas';

export interface QuoteCreateInput {
  text: string;
  translation?: string;
  source?: string;
}

export interface QuoteCreateManyInput {
  frases: QuoteCreateInput[];
}

export interface QuoteReadInput {
  include_inactive?: boolean;
}

export interface QuoteUpdateInput {
  id: string;
  text?: string;
  translation?: string;
  source?: string;
  active?: boolean;
}

export interface QuoteDeactivateInput {
  id: string;
}

/** Id determinista de una frase (R4): `frase-` + 16 hex del SHA-256 de `lower(trim(text))`. */
export function quoteId(text: string): string {
  const digest = crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
  return `frase-${digest.slice(0, 16)}`;
}

/** Texto opcional ya recortado: vacío o ausente es `null` (no se guardan cadenas vacías). */
function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function notFoundError(id: string): ExecutionErrorResult {
  return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la frase ${id}.` };
}

async function listQuotes(): Promise<QuoteRecord[]> {
  const raw = await fetchQuotesFromDb();
  return Array.isArray(raw) ? raw : [];
}

/** FR-F25: crea una frase activa. Idempotente por texto normalizado: si ya existe devuelve la
 * existente (sin tocar su traducción, fuente ni estado) y no duplica. La forma (texto 1-300,
 * traducción hasta 300, fuente hasta 120) la valida el esquema. */
export async function createQuote(input: QuoteCreateInput): Promise<ExecutionResult<QuoteRecord>> {
  const id = quoteId(input.text);
  const existing = (await listQuotes()).find((q) => q.id === id);
  if (existing) return { status: 'success', data: existing };

  await insertQuotesInDb([
    {
      id,
      text: input.text.trim(),
      translation: optionalText(input.translation),
      source: optionalText(input.source),
      active: true,
    },
  ]);
  const created = (await listQuotes()).find((q) => q.id === id);
  return { status: 'success', data: created! };
}

/** FR-F25: carga múltiple todo o nada (el esquema ya rechazó el lote entero si una frase era
 * inválida) e idempotente por texto normalizado. Devuelve `{ creadas, omitidas }`: omitida es la que
 * ya existía o la que repite, dentro del mismo lote, a otra anterior. */
export async function createManyQuotes(
  input: QuoteCreateManyInput
): Promise<ExecutionResult<{ creadas: number; omitidas: number }>> {
  const known = new Set((await listQuotes()).map((q) => q.id));
  const nuevas: Array<Partial<QuoteRecord>> = [];

  for (const frase of input.frases) {
    const id = quoteId(frase.text);
    if (known.has(id)) continue;
    known.add(id);
    nuevas.push({
      id,
      text: frase.text.trim(),
      translation: optionalText(frase.translation),
      source: optionalText(frase.source),
      active: true,
    });
  }

  if (nuevas.length > 0) {
    await withExecutionTransaction((client) => insertQuotesInDb(nuevas, client));
  }
  return { status: 'success', data: { creadas: nuevas.length, omitidas: input.frases.length - nuevas.length } };
}

/** `{ frases[] }` ordenadas por id (el mismo orden estable de la rotación). Las desactivadas solo
 * salen con `include_inactive`. */
export async function readQuotes(input: QuoteReadInput = {}): Promise<ExecutionResult<{ frases: QuoteRecord[] }>> {
  const frases = (await listQuotes()).filter((q) => input.include_inactive || q.active);
  return { status: 'success', data: { frases } };
}

/** Actualiza texto, traducción, fuente y/o estado. Lo no enviado no se toca; cambiar el texto no
 * cambia el id. NO_ENCONTRADO si el id no existe. */
export async function updateQuote(input: QuoteUpdateInput): Promise<ExecutionResult<QuoteRecord>> {
  const existing = (await listQuotes()).find((q) => q.id === input.id);
  if (!existing) return notFoundError(input.id);

  const updated = await updateQuoteInDb({
    id: existing.id,
    text: input.text !== undefined ? input.text.trim() : existing.text,
    translation: input.translation !== undefined ? optionalText(input.translation) : (existing.translation ?? null),
    source: input.source !== undefined ? optionalText(input.source) : (existing.source ?? null),
    active: input.active !== undefined ? input.active : existing.active,
  });
  return { status: 'success', data: updated };
}

/** FR-F26 / US-F5-AS5: saca la frase de la rotación (`active = false`). Idempotente: desactivar una
 * ya inactiva devuelve la frase. NO_ENCONTRADO si el id no existe. */
export async function deactivateQuote(input: QuoteDeactivateInput): Promise<ExecutionResult<QuoteRecord>> {
  const existing = (await listQuotes()).find((q) => q.id === input.id);
  if (!existing) return notFoundError(input.id);
  if (!existing.active) return { status: 'success', data: existing };

  const updated = await updateQuoteInDb({ ...existing, active: false });
  return { status: 'success', data: updated };
}
