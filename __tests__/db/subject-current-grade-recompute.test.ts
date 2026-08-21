import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { pureDB, SubjectEntity, DeliverableEntity } from '@/lib/db/dexie-schema';
import {
  saveSubject,
  saveDeliverable,
  deleteDeliverable,
  recomputeSubjectCurrentGrade,
} from '@/lib/db/repository';

/**
 * B3: `subject.current_grade` es ahora un valor DERIVADO de las entregas calificadas, no un
 * campo escrito a mano que quedaba stale. `recomputeSubjectCurrentGrade` es la fuente única y
 * `saveDeliverable`/`deleteDeliverable` lo mantienen al día en el camino local-first.
 */
const makeSubject = (over: Partial<SubjectEntity> = {}): SubjectEntity => ({
  id: 'sub-calc',
  university_id: 'uni-1',
  name: 'Cálculo',
  code: 'MAT-201',
  credits: 4,
  difficulty: 3,
  modality: 'presencial',
  target_grade: 4.5,
  current_grade: 0,
  ...over,
});

const makeDeliverable = (over: Partial<DeliverableEntity> = {}): DeliverableEntity => ({
  id: `deliv-${Math.random().toString(36).slice(2)}`,
  subject_id: 'sub-calc',
  title: 'Entrega',
  due_date: '2026-10-01',
  weight_percentage: 20,
  type: 'parcial',
  is_group: false,
  complexity: 'medio',
  status: 'pendiente',
  ...over,
});

describe('B3: recomputeSubjectCurrentGrade y hooks de save/delete', () => {
  beforeEach(async () => {
    await pureDB.subjects.clear();
    await pureDB.deliverables.clear();
    await pureDB.syncQueue.clear();
  });

  it('promedia solo las entregas calificadas ponderadas por su peso', async () => {
    await saveSubject(makeSubject());
    await pureDB.deliverables.bulkPut([
      makeDeliverable({ id: 'd1', weight_percentage: 20, grade: 4.0, status: 'calificado' }),
      makeDeliverable({ id: 'd2', weight_percentage: 5, grade: 5.0, status: 'calificado', type: 'quiz' }),
      makeDeliverable({ id: 'd3', weight_percentage: 20, status: 'pendiente' }),
    ]);

    const result = await recomputeSubjectCurrentGrade('sub-calc');
    // (4.0*20 + 5.0*5) / 25 = 105 / 25 = 4.20
    expect(result).toBe(4.2);
    const subject = await pureDB.subjects.get('sub-calc');
    expect(subject?.current_grade).toBe(4.2);
  });

  it('saveDeliverable recalcula current_grade automáticamente al agregar notas', async () => {
    await saveSubject(makeSubject());

    await saveDeliverable(makeDeliverable({ id: 'd1', weight_percentage: 50, grade: 3.0, status: 'calificado' }));
    expect((await pureDB.subjects.get('sub-calc'))?.current_grade).toBe(3.0);

    await saveDeliverable(makeDeliverable({ id: 'd2', weight_percentage: 50, grade: 5.0, status: 'calificado' }));
    // (3*50 + 5*50) / 100 = 4.0
    expect((await pureDB.subjects.get('sub-calc'))?.current_grade).toBe(4.0);
  });

  it('deleteDeliverable recalcula excluyendo la entrega borrada', async () => {
    await saveSubject(makeSubject());
    await saveDeliverable(makeDeliverable({ id: 'd1', weight_percentage: 50, grade: 3.0, status: 'calificado' }));
    await saveDeliverable(makeDeliverable({ id: 'd2', weight_percentage: 50, grade: 5.0, status: 'calificado' }));
    expect((await pureDB.subjects.get('sub-calc'))?.current_grade).toBe(4.0);

    await deleteDeliverable('d1');
    // solo queda d2 (5.0)
    expect((await pureDB.subjects.get('sub-calc'))?.current_grade).toBe(5.0);
  });

  it('sin entregas calificadas la nota derivada es 0, aunque hubiese heredado otra', async () => {
    await saveSubject(makeSubject({ current_grade: 4.5 }));
    await saveDeliverable(makeDeliverable({ id: 'd1', weight_percentage: 50, status: 'pendiente' }));
    expect((await pureDB.subjects.get('sub-calc'))?.current_grade).toBe(0);
  });

  it('no crea la materia si no existe localmente', async () => {
    const result = await recomputeSubjectCurrentGrade('sub-inexistente');
    expect(result).toBeNull();
    expect(await pureDB.subjects.get('sub-inexistente')).toBeUndefined();
  });
});
