import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Constitución de PURE OS, Principio II (Test-First, NO NEGOCIABLE): cada escenario de
// aceptación `USn-ASm` no marcado `[manual]` en spec.md DEBE tener una prueba automatizada
// nombrada con su ID (SC-007). Este test recorre __tests__/ y compara contra la spec en
// ambas direcciones: nada de la spec puede quedar sin test, y ningún test puede inventarse
// un ID que la spec no reconoce.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SPEC_PATH = path.join(REPO_ROOT, 'specs', '001-modulo-ejecucion', 'spec.md');
const TESTS_DIR = path.join(REPO_ROOT, '__tests__');

const SCENARIO_ID_RE = /US\d+-AS\d+/;

/**
 * Extrae los IDs `USn-ASm` declarados como escenario de aceptación en spec.md (líneas con el
 * ID en negrita markdown, p.ej. `**US1-AS1**`), excluyendo los marcados `[manual]` en la misma
 * línea (US4-AS1 y US4-AS2 al momento de escribir esto: se verifican por quickstart, no por
 * test automatizado).
 */
function extractSpecScenarioIds(specContent: string): Set<string> {
  const ids = new Set<string>();
  for (const line of specContent.split('\n')) {
    const match = line.match(/\*\*(US\d+-AS\d+)\*\*/);
    if (!match) continue;
    if (/\[manual\]/.test(line)) continue;
    ids.add(match[1]);
  }
  return ids;
}

function walkTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTestFiles(full));
    } else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** IDs citados dentro de un título de `it(...)` o `it.todo(...)` en un archivo de test. */
function extractCitedIds(content: string): string[] {
  const ids: string[] = [];
  const callRe = /\bit(?:\.todo)?\(\s*(['"`])([\s\S]*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(content))) {
    const idMatch = m[2].match(SCENARIO_ID_RE);
    if (idMatch) ids.push(idMatch[0]);
  }
  return ids;
}

describe('[001] Trazabilidad spec -> tests (SC-007, Principio II)', () => {
  const specContent = fs.readFileSync(SPEC_PATH, 'utf-8');
  const specIds = extractSpecScenarioIds(specContent);

  const testFiles = walkTestFiles(TESTS_DIR);
  const citedIds = new Set<string>();
  for (const file of testFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const id of extractCitedIds(content)) {
      citedIds.add(id);
    }
  }

  it('encuentra escenarios no manuales declarados en la spec (sanity check)', () => {
    // Si esto falla, el parser de spec.md está roto, no el módulo de ejecución.
    expect(specIds.size).toBeGreaterThan(0);
    expect(specIds.has('US4-AS1')).toBe(false);
    expect(specIds.has('US4-AS2')).toBe(false);
  });

  it('todo escenario no manual de spec.md tiene un test (it/it.todo) nombrado con su ID', () => {
    const missing = Array.from(specIds)
      .filter((id) => !citedIds.has(id))
      .sort();
    expect(missing).toEqual([]);
  });

  it('ningún test cita un ID de escenario que no exista en spec.md', () => {
    const invalid = Array.from(citedIds)
      .filter((id) => !specIds.has(id))
      .sort();
    expect(invalid).toEqual([]);
  });
});
