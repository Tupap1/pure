import { describe, it, expect } from 'vitest';
import { findShadowedIds, findOrphanIds } from '@/lib/sync/reconcile';
import {
  dedupeByIdentity,
  subjectIdentity,
  syllabusTopicIdentity,
} from '@/lib/domain/entity-identity';

/**
 * Bug 2: la vista de Sílabus mostraba "Química General" y "Vivamos la Universidad" varias
 * veces. Postgres tiene una sola fila de cada una; lo que se acumulaba era el caché local
 * de Dexie, que solo hacía upsert por `id` y nunca podaba las versiones de re-ingestas
 * anteriores (mismo nombre, `id` viejo).
 */
describe('Reconciliación del caché local contra el remoto', () => {
  const remoteSubjects = [
    { id: 'subj-2585240', university_id: 'uni-udea', name: 'Química General' },
    { id: 'subj-9911', university_id: 'uni-udea', name: 'Vivamos la Universidad' },
  ];

  it('marca como obsoletas las materias con id viejo pero misma identidad lógica', () => {
    const localSubjects = [
      ...remoteSubjects,
      { id: 'sub-1770000000000', university_id: 'uni-udea', name: 'Química General' },
      { id: 'sub-1760000000000', university_id: 'uni-udea', name: 'Vivamos la Universidad' },
    ];

    const stale = findShadowedIds(localSubjects, remoteSubjects, subjectIdentity);
    expect(stale.sort()).toEqual(['sub-1760000000000', 'sub-1770000000000']);
  });

  it('no toca una materia creada localmente que el servidor no conoce', () => {
    const localSubjects = [
      ...remoteSubjects,
      { id: 'sub-local-nueva', university_id: 'uni-udea', name: 'Electiva Recién Creada' },
    ];

    expect(findShadowedIds(localSubjects, remoteSubjects, subjectIdentity)).toEqual([]);
  });

  it('ignora diferencias de espacios y mayúsculas al comparar identidades', () => {
    const localSubjects = [
      ...remoteSubjects,
      { id: 'sub-viejo', university_id: 'uni-udea', name: '  química general ' },
    ];

    expect(findShadowedIds(localSubjects, remoteSubjects, subjectIdentity)).toEqual(['sub-viejo']);
  });

  it('conserva materias homónimas de universidades distintas', () => {
    const localSubjects = [
      ...remoteSubjects,
      { id: 'sub-udec-quimica', university_id: 'uni-udec', name: 'Química General' },
    ];

    expect(findShadowedIds(localSubjects, remoteSubjects, subjectIdentity)).toEqual([]);
  });

  it('arrastra los temas huérfanos de una materia obsoleta', () => {
    const remoteTopics = [
      { id: 'top-1', subject_id: 'subj-2585240', title: 'Unidad 1: Materia y Energía' },
    ];
    const localTopics = [
      ...remoteTopics,
      { id: 'top-viejo-1', subject_id: 'sub-1770000000000', title: 'Unidad 1: Materia y Energía' },
      { id: 'top-viejo-2', subject_id: 'sub-1770000000000', title: 'Unidad 2: Estequiometría' },
    ];

    const orphans = findOrphanIds(
      localTopics,
      remoteTopics,
      new Set(['sub-1770000000000']),
      (t) => t.subject_id
    );
    expect(orphans.sort()).toEqual(['top-viejo-1', 'top-viejo-2']);
  });

  it('no borra nada cuando no se eliminó ninguna materia padre', () => {
    const remoteTopics = [{ id: 'top-1', subject_id: 'subj-2585240', title: 'Unidad 1' }];
    const localTopics = [...remoteTopics, { id: 'top-2', subject_id: 'subj-otro', title: 'Unidad X' }];

    expect(findOrphanIds(localTopics, remoteTopics, new Set(), (t) => t.subject_id)).toEqual([]);
  });

  it('nunca propone borrar una fila que el remoto sí tiene', () => {
    const orphans = findOrphanIds(
      [{ id: 'top-1', subject_id: 'sub-viejo', title: 'Unidad 1' }],
      [{ id: 'top-1', subject_id: 'subj-2585240', title: 'Unidad 1' }],
      new Set(['sub-viejo']),
      (t) => t.subject_id
    );
    expect(orphans).toEqual([]);
  });
});

describe('dedupeByIdentity en la lista de materias del Sílabus', () => {
  it('deja una sola entrada por materia y prefiere la que tiene temario', () => {
    const subjects = [
      { id: 'sub-viejo', university_id: 'uni-udea', name: 'Química General' },
      { id: 'subj-2585240', university_id: 'uni-udea', name: 'Química General' },
      { id: 'subj-9911', university_id: 'uni-udea', name: 'Vivamos la Universidad' },
      { id: 'sub-viejo-2', university_id: 'uni-udea', name: 'Vivamos la Universidad' },
    ];
    const topicCount: Record<string, number> = { 'subj-2585240': 42 };

    const unique = dedupeByIdentity(subjects, subjectIdentity, (s) => topicCount[s.id] || 0);

    expect(unique).toHaveLength(2);
    expect(unique[0].id).toBe('subj-2585240');
    // Sin temario en ninguna de las dos, gana la primera aparición.
    expect(unique[1].id).toBe('subj-9911');
  });

  it('preserva el orden original de las materias', () => {
    const subjects = [
      { id: 'a', university_id: 'u1', name: 'Cálculo' },
      { id: 'b', university_id: 'u1', name: 'Física' },
      { id: 'a-dup', university_id: 'u1', name: 'Cálculo' },
      { id: 'c', university_id: 'u1', name: 'Álgebra' },
    ];

    expect(dedupeByIdentity(subjects, subjectIdentity).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('la identidad de un tema depende de la materia a la que pertenece', () => {
    expect(syllabusTopicIdentity({ subject_id: 'sub-1', title: 'Unidad 1' })).not.toBe(
      syllabusTopicIdentity({ subject_id: 'sub-2', title: 'Unidad 1' })
    );
  });
});
