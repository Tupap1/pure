import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Constitución de PURE OS, Principio II (Test-First, NO NEGOCIABLE): cada escenario de
// aceptación `USn-ASm` no marcado `[manual]` en spec.md DEBE tener una prueba automatizada
// nombrada con su ID (SC-007). Este test recorre __tests__/ y compara contra múltiples specs
// en ambas direcciones: nada de la spec puede quedar sin test, y ningún test puede inventarse
// un ID que la spec no reconoce.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TESTS_DIR = path.join(REPO_ROOT, '__tests__');

interface SpecConfig {
  feature: string;
  spec: string;
  idRe: RegExp;
  manualExclusions: Set<string>;
  expectedCount?: number;
}

const SPECS: SpecConfig[] = [
  {
    feature: '001',
    spec: path.join(REPO_ROOT, 'specs', '001-modulo-ejecucion', 'spec.md'),
    idRe: /US\d+-AS\d+/,
    manualExclusions: new Set(['US4-AS1', 'US4-AS2']),
  },
  {
    feature: '002',
    spec: path.join(REPO_ROOT, 'specs', '002-ejecucion-ajustes', 'spec.md'),
    idRe: /US-B\d+-AS\d+/,
    manualExclusions: new Set(['US-B4-AS8']),
    expectedCount: 34,
  },
];

/**
 * Extrae los IDs declarados como escenario de aceptación en spec.md (líneas con el
 * ID en negrita markdown, p.ej. `**US1-AS1**`), excluyendo los marcados `[manual]` en la misma
 * línea. Usa el patrón de ID (idRe) de la spec para buscar.
 */
function extractSpecScenarioIds(specContent: string, idRe: RegExp): Set<string> {
  const ids = new Set<string>();
  for (const line of specContent.split('\n')) {
    // Buscar el patrón entre ** ** (negrita markdown)
    const boldMatch = line.match(/\*\*([^*]+)\*\*/);
    if (!boldMatch) continue;
    const boldContent = boldMatch[1];
    const idMatch = boldContent.match(idRe);
    if (!idMatch) continue;
    if (/\[manual\]/.test(line)) continue;
    ids.add(idMatch[0]);
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
function extractCitedIds(content: string, idRe: RegExp): string[] {
  const ids: string[] = [];
  const callRe = /\bit(?:\.todo)?\(\s*(['"`])([\s\S]*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(content))) {
    const idMatch = m[2].match(idRe);
    if (idMatch) ids.push(idMatch[0]);
  }
  return ids;
}

// Procesar todos los archivos de test una sola vez
const testFiles = walkTestFiles(TESTS_DIR);
const allTestContent = testFiles.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');

describe('[001] Trazabilidad spec -> tests (SC-007, Principio II)', () => {
  const cfg = SPECS[0];
  const specContent = fs.readFileSync(cfg.spec, 'utf-8');
  const specIds = extractSpecScenarioIds(specContent, cfg.idRe);

  const citedIds = new Set<string>();
  for (const id of extractCitedIds(allTestContent, cfg.idRe)) {
    citedIds.add(id);
  }

  it('encuentra escenarios no manuales declarados en la spec (sanity check)', () => {
    expect(specIds.size).toBeGreaterThan(0);
    for (const excluded of cfg.manualExclusions) {
      expect(specIds.has(excluded)).toBe(false);
    }
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

describe('[002] Trazabilidad spec -> tests (SC-B06, Principio II)', () => {
  const cfg = SPECS[1];
  const specContent = fs.readFileSync(cfg.spec, 'utf-8');
  const specIds = extractSpecScenarioIds(specContent, cfg.idRe);

  const citedIds = new Set<string>();
  for (const id of extractCitedIds(allTestContent, cfg.idRe)) {
    citedIds.add(id);
  }

  it('encuentra escenarios no manuales declarados en la spec (sanity check)', () => {
    expect(specIds.size).toBe(cfg.expectedCount);
    for (const excluded of cfg.manualExclusions) {
      expect(specIds.has(excluded)).toBe(false);
    }
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
