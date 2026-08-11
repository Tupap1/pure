import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pureDB } from '../../lib/db/dexie-schema';
import { pullRemoteState } from '../../lib/sync/sync-engine';

const university = {
  id: 'uni-udea',
  name: 'Universidad de Antioquia',
  modality: 'presencial' as const,
  scale_min: 0,
  scale_max: 5,
  passing_grade: 3,
  color: '#0ea5e9',
};

const subject = (id: string, name: string) => ({
  id,
  university_id: 'uni-udea',
  name,
  credits: 3,
  difficulty: 4,
  modality: 'presencial' as const,
  target_grade: 4.5,
  current_grade: 0,
});

const topic = (id: string, subject_id: string, title: string) => ({
  id,
  subject_id,
  title,
  mastery_status: 'no_iniciado' as const,
  order_index: 1,
});

/** Estado remoto: exactamente lo que devuelve GET /api/sync desde Postgres. */
const remotePayload = {
  universities: [university],
  professors: [],
  subjects: [subject('subj-2585240', 'Química General'), subject('subj-9911', 'Vivamos la Universidad')],
  schedules: [],
  deliverables: [],
  syllabusTopics: [topic('top-remoto', 'subj-2585240', 'Unidad 1: Materia y Energía')],
};

const mockSyncResponse = (data: unknown) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'success', data }),
  });

describe('pullRemoteState: poda de duplicados heredados del caché local', () => {
  beforeEach(async () => {
    await Promise.all([
      pureDB.universities.clear(),
      pureDB.professors.clear(),
      pureDB.subjects.clear(),
      pureDB.schedules.clear(),
      pureDB.deliverables.clear(),
      pureDB.syllabusTopics.clear(),
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deja una sola fila por materia cuando IndexedDB arrastra ids de re-ingestas viejas', async () => {
    // Estado local contaminado: las mismas materias bajo ids antiguos.
    await pureDB.subjects.bulkPut([
      subject('sub-1770000000000', 'Química General'),
      subject('sub-1760000000000', 'Vivamos la Universidad'),
    ]);

    vi.stubGlobal('fetch', mockSyncResponse(remotePayload));
    await pullRemoteState();

    const stored = await pureDB.subjects.toArray();
    expect(stored).toHaveLength(2);
    expect(stored.map((s) => s.id).sort()).toEqual(['subj-2585240', 'subj-9911']);
    expect(stored.filter((s) => s.name === 'Química General')).toHaveLength(1);
    expect(stored.filter((s) => s.name === 'Vivamos la Universidad')).toHaveLength(1);
  });

  it('elimina los temas huérfanos que colgaban de la materia obsoleta', async () => {
    await pureDB.subjects.put(subject('sub-1770000000000', 'Química General'));
    await pureDB.syllabusTopics.bulkPut([
      topic('top-viejo-1', 'sub-1770000000000', 'Unidad 1: Materia y Energía'),
      topic('top-viejo-2', 'sub-1770000000000', 'Unidad 2: Estequiometría'),
    ]);

    vi.stubGlobal('fetch', mockSyncResponse(remotePayload));
    await pullRemoteState();

    const topics = await pureDB.syllabusTopics.toArray();
    expect(topics.map((t) => t.id)).toEqual(['top-remoto']);
  });

  it('conserva una materia creada localmente que el servidor todavía no conoce', async () => {
    await pureDB.subjects.put(subject('sub-local-nueva', 'Electiva Recién Creada'));

    vi.stubGlobal('fetch', mockSyncResponse(remotePayload));
    await pullRemoteState();

    const stored = await pureDB.subjects.toArray();
    expect(stored.map((s) => s.id).sort()).toEqual([
      'sub-local-nueva',
      'subj-2585240',
      'subj-9911',
    ]);
  });

  it('no poda nada si el servidor responde sin universidades', async () => {
    await pureDB.subjects.put(subject('sub-1770000000000', 'Química General'));

    vi.stubGlobal('fetch', mockSyncResponse({ ...remotePayload, universities: [] }));
    await pullRemoteState();

    const stored = await pureDB.subjects.toArray();
    expect(stored.map((s) => s.id)).toEqual(['sub-1770000000000']);
  });

  it('no poda nada si la petición falla', async () => {
    await pureDB.subjects.put(subject('sub-1770000000000', 'Química General'));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await pullRemoteState();

    const stored = await pureDB.subjects.toArray();
    expect(stored.map((s) => s.id)).toEqual(['sub-1770000000000']);
  });

  it('es idempotente: una segunda pasada no altera el resultado', async () => {
    await pureDB.subjects.put(subject('sub-1770000000000', 'Química General'));

    vi.stubGlobal('fetch', mockSyncResponse(remotePayload));
    await pullRemoteState();
    await pullRemoteState();

    const stored = await pureDB.subjects.toArray();
    expect(stored.map((s) => s.id).sort()).toEqual(['subj-2585240', 'subj-9911']);
  });
});
