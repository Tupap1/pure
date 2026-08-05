import { calculateNetFreeTime } from '../lib/algorithms/study-hours-dme';
import { findSynergiesBetweenTopics, SyllabusTopic } from '../lib/domain/syllabus';
import { UniversityEntity, SubjectEntity } from '../lib/db/dexie-schema';

// In-Memory Storage for MCP Server state (mirrors DB entities)
const store = {
  universities: [
    {
      id: 'uni-udea',
      name: 'Universidad de Antioquia - Ingeniería Aeroespacial',
      modality: 'presencial' as const,
      scale_min: 0.0,
      scale_max: 5.0,
      passing_grade: 3.0,
      color: '#0ea5e9',
    },
    {
      id: 'uni-udec',
      name: 'Universidad de Cartagena - Ingeniería de Software (A Distancia)',
      modality: 'virtual' as const,
      scale_min: 0.0,
      scale_max: 5.0,
      passing_grade: 3.0,
      color: '#6366f1',
    },
  ] as Omit<UniversityEntity, 'created_at'>[],

  professors: [
    { id: 'prof-udea', university_id: 'uni-udea', name: 'Coordinación Aeroespacial UdeA', email: 'aeroespacial@udea.edu.co' },
    { id: 'prof-javier-gomez', university_id: 'uni-udec', name: 'Javier Gómez', email: 'jgomez@unicartagena.edu.co' },
    { id: 'prof-carlos-caceres', university_id: 'uni-udec', name: 'Carlos Cáceres', email: 'ccaceres@unicartagena.edu.co' },
    { id: 'prof-atilano-arrieta', university_id: 'uni-udec', name: 'Atilano Arrieta', email: 'aarrieta@unicartagena.edu.co' },
    { id: 'prof-armando-acosta', university_id: 'uni-udec', name: 'Armando Acosta', email: 'aacosta@unicartagena.edu.co' },
  ] as any[],

  subjects: [
    // --- UdeA ---
    { id: 'sub-vivamos', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Vivamos la Universidad', code: '2585101', credits: 1, difficulty: 1, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-geom', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Geometría Vectorial y Analítica', code: '2585131', credits: 3, difficulty: 4, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-calc', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Cálculo Diferencial', code: '2585132', credits: 3, difficulty: 4, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-quim', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Química General', code: '2585240', credits: 4, difficulty: 3, modality: 'presencial', target_grade: 4.5 },
    { id: 'sub-intro-aero', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Introducción a la Ingeniería Aeroespacial', code: '2591101', credits: 1, difficulty: 2, modality: 'presencial', target_grade: 4.8 },
    { id: 'sub-prog', university_id: 'uni-udea', professor_id: 'prof-udea', name: 'Programación y Ciencia Computacional', code: '2591102', credits: 3, difficulty: 3, modality: 'presencial', target_grade: 4.8 },

    // --- UdeC ---
    { id: 'sub-udec-fisica1', university_id: 'uni-udec', professor_id: 'prof-javier-gomez', name: 'Física I (Mecánica y Termodinámica)', code: 'CFBD269', credits: 2, difficulty: 4, modality: 'virtual', target_grade: 4.5 },
    { id: 'sub-udec-bd2', university_id: 'uni-udec', professor_id: 'prof-carlos-caceres', name: 'Base de Datos II', code: 'IX24450', credits: 3, difficulty: 3, modality: 'virtual', target_grade: 4.5 },
    { id: 'sub-udec-ecuaciones', university_id: 'uni-udec', professor_id: 'prof-atilano-arrieta', name: 'Ecuaciones Diferenciales', code: 'CFBD272', credits: 2, difficulty: 4, modality: 'virtual', target_grade: 4.5 },
    { id: 'sub-udec-web', university_id: 'uni-udec', professor_id: 'prof-armando-acosta', name: 'Desarrollo de Software Web', code: 'IX24451', credits: 3, difficulty: 3, modality: 'virtual', target_grade: 4.8 },
    { id: 'sub-udec-ingsoft', university_id: 'uni-udec', professor_id: 'prof-carlos-caceres', name: 'Ingeniería de Software B1', code: 'IX24452', credits: 3, difficulty: 3, modality: 'virtual', target_grade: 4.8 },
    { id: 'sub-udec-cienciadatos', university_id: 'uni-udec', professor_id: 'prof-armando-acosta', name: 'Ciencia de Datos I', code: 'IX24454', credits: 3, difficulty: 4, modality: 'virtual', target_grade: 4.7 },
    { id: 'sub-udec-ingles', university_id: 'uni-udec', name: 'Inglés VI', code: 'ENGV006', credits: 2, difficulty: 2, modality: 'virtual', target_grade: 4.5 },
  ] as Omit<SubjectEntity, 'created_at' | 'current_grade'>[],

  schedules: [
    { id: 'sch-1', subject_id: 'sub-vivamos', day_of_week: 3, start_time: '11:00', end_time: '13:00', classroom: 'Aula por definir / Edificio Central' },
    { id: 'sch-2', subject_id: 'sub-geom', day_of_week: 2, start_time: '09:00', end_time: '11:00', classroom: 'Aula 2-305' },
    { id: 'sch-3', subject_id: 'sub-geom', day_of_week: 4, start_time: '09:00', end_time: '11:00', classroom: 'Aula 2-305' },
    { id: 'sch-4', subject_id: 'sub-calc', day_of_week: 3, start_time: '09:00', end_time: '11:00', classroom: 'Aula 2-306' },
    { id: 'sch-5', subject_id: 'sub-calc', day_of_week: 5, start_time: '09:00', end_time: '11:00', classroom: 'Aula 2-306' },
    { id: 'sch-6', subject_id: 'sub-quim', day_of_week: 2, start_time: '07:00', end_time: '09:00', classroom: 'Aula 2-305 (Teoría)' },
    { id: 'sch-7', subject_id: 'sub-quim', day_of_week: 2, start_time: '11:00', end_time: '13:00', classroom: 'LAB 3-103 (Práctica)' },
    { id: 'sch-8', subject_id: 'sub-quim', day_of_week: 4, start_time: '07:00', end_time: '09:00', classroom: 'Aula 2-305 (Teoría)' },
    { id: 'sch-9', subject_id: 'sub-intro-aero', day_of_week: 3, start_time: '15:00', end_time: '17:00', classroom: 'Aula 1-403' },
    { id: 'sch-10', subject_id: 'sub-prog', day_of_week: 3, start_time: '13:00', end_time: '15:00', classroom: 'SISTEMAS 1A' },
    { id: 'sch-11', subject_id: 'sub-prog', day_of_week: 5, start_time: '13:00', end_time: '15:00', classroom: 'SISTEMAS 1A' },
    { id: 'sch-12', subject_id: 'sub-udec-fisica1', day_of_week: 6, start_time: '07:00', end_time: '08:40', classroom: 'Sábado A • Aula A304' },
    { id: 'sch-13', subject_id: 'sub-udec-bd2', day_of_week: 6, start_time: '08:40', end_time: '10:20', classroom: 'Sábado A • Aula F212' },
    { id: 'sch-14', subject_id: 'sub-udec-ecuaciones', day_of_week: 6, start_time: '12:00', end_time: '13:50', classroom: 'Sábado A • Aula A304' },
    { id: 'sch-15', subject_id: 'sub-udec-web', day_of_week: 6, start_time: '07:00', end_time: '08:40', classroom: 'Sábado B • F215 Lab Redes A' },
    { id: 'sch-16', subject_id: 'sub-udec-ingsoft', day_of_week: 6, start_time: '10:20', end_time: '12:00', classroom: 'Sábado B • Aula F212' },
    { id: 'sch-17', subject_id: 'sub-udec-cienciadatos', day_of_week: 6, start_time: '12:00', end_time: '13:50', classroom: 'Sábado B • Bloque F215 Lab Redes A' },
  ] as any[],

  deliverables: [
    { id: 'deliv-1', subject_id: 'sub-calc', title: 'Parcial 1 Cálculo', due_date: '2026-08-15T09:00:00Z', weight_percentage: 25, type: 'Parcial', status: 'pendiente' },
    { id: 'deliv-2', subject_id: 'sub-geom', title: 'Taller Matrices', due_date: '2026-08-20T18:00:00Z', weight_percentage: 15, type: 'Taller', status: 'pendiente' },
  ] as any[],

  syllabusTopics: [] as SyllabusTopic[],
};

export function handleGetAcademicOverview() {
  return {
    status: 'success',
    data: {
      netFreeTimeHours: calculateNetFreeTime({ classHours: 28, dmeHours: 24, sleepHoursPerNight: 7 }),
      universities: store.universities.map((u) => ({ name: u.name, modality: u.modality })),
      universitiesCount: store.universities.length,
      professorsCount: store.professors.length,
      subjectsCount: store.subjects.length,
      schedulesCount: store.schedules.length,
      deliverablesCount: store.deliverables.length,
    },
  };
}

export function handleParseAndIngestSyllabus(subjectId: string, rawText: string) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const topics: SyllabusTopic[] = [];
  let currentParentId: string | undefined = undefined;

  lines.forEach((line, index) => {
    if (line.toLowerCase().startsWith('unidad')) {
      const parentId = `unit-${index}`;
      currentParentId = parentId;
      topics.push({
        id: parentId,
        subject_id: subjectId,
        title: line,
        mastery_status: 'no_iniciado',
        order_index: index,
      });
    } else {
      topics.push({
        id: `topic-${index}`,
        subject_id: subjectId,
        parent_id: currentParentId,
        title: line.replace(/^[-*•]\s*/, ''),
        mastery_status: 'no_iniciado',
        order_index: index,
      });
    }
  });

  store.syllabusTopics.push(...topics);

  return {
    status: 'success',
    topicsParsed: topics.length,
    topics,
  };
}

export function handleFindCrossSubjectSynergies() {
  const topicsAero: SyllabusTopic[] = [
    { id: 'a1', subject_id: 'sub-geom', title: 'Resolución de Matrices y Vectores de Estado', mastery_status: 'dominado', order_index: 1 },
    { id: 'a2', subject_id: 'sub-calc', title: 'Ecuaciones Diferenciales y Métodos Numéricos', mastery_status: 'en_estudio', order_index: 2 },
  ];

  const topicsSoft: SyllabusTopic[] = [
    { id: 's1', subject_id: 'sub-prog', title: 'Algoritmos y Operaciones Matriciales C++', mastery_status: 'no_iniciado', order_index: 1 },
    { id: 's2', subject_id: 'sub-udec-ecuaciones', title: 'Ecuaciones Diferenciales Aplicadas', mastery_status: 'en_estudio', order_index: 2 },
  ];

  const matches = findSynergiesBetweenTopics(topicsAero, topicsSoft);

  return {
    status: 'success',
    synergiesCount: matches.length,
    synergies: matches,
  };
}

/**
 * Ingesta dinámica de matrícula académica.
 * Si recibe JSON o texto estructurado con custom classrooms o asignaturas,
 * actualiza el store respetando exactamente las aulas enviadas.
 */
export function handleIngestAcademicEnrollment(rawEnrollmentText?: string) {
  if (rawEnrollmentText) {
    try {
      const parsed = JSON.parse(rawEnrollmentText);
      if (parsed.universities) store.universities = parsed.universities;
      if (parsed.professors) store.professors = parsed.professors;
      if (parsed.subjects) store.subjects = parsed.subjects;
      if (parsed.schedules) store.schedules = parsed.schedules;

      // Classroom overrides map: e.g. { "sub-vivamos": "2-212", "sub-geom": "2-209" }
      if (parsed.classroomOverrides) {
        for (const [subId, newClassroom] of Object.entries(parsed.classroomOverrides)) {
          store.schedules
            .filter((sch) => sch.subject_id === subId)
            .forEach((sch) => {
              sch.classroom = newClassroom;
            });
        }
      }
    } catch {
      // Plain text classroom extraction
      const lines = rawEnrollmentText.split('\n');
      lines.forEach((line) => {
        const parts = line.split(':');
        if (parts.length === 2) {
          const key = parts[0].trim().toLowerCase();
          const val = parts[1].trim();

          store.subjects.forEach((sub) => {
            if (sub.name.toLowerCase().includes(key)) {
              store.schedules
                .filter((sch) => sch.subject_id === sub.id)
                .forEach((sch) => {
                  sch.classroom = val;
                });
            }
          });
        }
      });
    }
  }

  return {
    status: 'success',
    message: 'Matrícula e información de aulas procesada exitosamente en el Servidor MCP.',
    data: {
      universitiesCount: store.universities.length,
      professorsCount: store.professors.length,
      subjectsCount: store.subjects.length,
      schedulesCount: store.schedules.length,
      universities: store.universities,
      professors: store.professors,
      subjects: store.subjects,
      schedules: store.schedules,
    },
  };
}

// --- CRUD HANDLERS ---

export function handleManageUniversities(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  switch (action) {
    case 'create': {
      const newUni = {
        id: data.id || `uni-${Date.now()}`,
        name: data.name,
        modality: data.modality || 'presencial',
        scale_min: Number(data.scale_min ?? 0),
        scale_max: Number(data.scale_max ?? 5),
        passing_grade: Number(data.passing_grade ?? 3),
        color: data.color || '#0ea5e9',
      };
      store.universities.push(newUni);
      return { status: 'success', message: 'Universidad creada exitosamente', data: newUni };
    }
    case 'read': {
      if (data?.id) {
        const found = store.universities.find((u) => u.id === data.id);
        return { status: 'success', data: found || null };
      }
      return { status: 'success', data: store.universities };
    }
    case 'update': {
      const idx = store.universities.findIndex((u) => u.id === data.id);
      if (idx === -1) return { status: 'error', message: 'Universidad no encontrada' };
      store.universities[idx] = { ...store.universities[idx], ...data };
      return { status: 'success', message: 'Universidad actualizada', data: store.universities[idx] };
    }
    case 'delete': {
      store.universities = store.universities.filter((u) => u.id !== data.id);
      return { status: 'success', message: 'Universidad eliminada' };
    }
  }
}

export function handleManageProfessors(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  switch (action) {
    case 'create': {
      const newProf = {
        id: data.id || `prof-${Date.now()}`,
        university_id: data.university_id,
        name: data.name,
        email: data.email || null,
        office_hours: data.office_hours || null,
        notes: data.notes || null,
      };
      store.professors.push(newProf);
      return { status: 'success', message: 'Profesor creado exitosamente', data: newProf };
    }
    case 'read': {
      if (data?.id) {
        const found = store.professors.find((p) => p.id === data.id);
        return { status: 'success', data: found || null };
      }
      return { status: 'success', data: store.professors };
    }
    case 'update': {
      const idx = store.professors.findIndex((p) => p.id === data.id);
      if (idx === -1) return { status: 'error', message: 'Profesor no encontrado' };
      store.professors[idx] = { ...store.professors[idx], ...data };
      return { status: 'success', message: 'Profesor actualizado', data: store.professors[idx] };
    }
    case 'delete': {
      store.professors = store.professors.filter((p) => p.id !== data.id);
      return { status: 'success', message: 'Profesor eliminado' };
    }
  }
}

export function handleManageSubjects(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  switch (action) {
    case 'create': {
      const newSub = {
        id: data.id || `sub-${Date.now()}`,
        university_id: data.university_id,
        professor_id: data.professor_id || null,
        name: data.name,
        code: data.code || null,
        credits: Number(data.credits ?? 3),
        difficulty: Number(data.difficulty ?? 3),
        modality: data.modality || 'presencial',
        target_grade: Number(data.target_grade ?? 4.5),
      };
      store.subjects.push(newSub);
      return { status: 'success', message: 'Asignatura creada exitosamente', data: newSub };
    }
    case 'read': {
      if (data?.id) {
        const found = store.subjects.find((s) => s.id === data.id);
        return { status: 'success', data: found || null };
      }
      return { status: 'success', data: store.subjects };
    }
    case 'update': {
      const idx = store.subjects.findIndex((s) => s.id === data.id);
      if (idx === -1) return { status: 'error', message: 'Asignatura no encontrada' };
      store.subjects[idx] = { ...store.subjects[idx], ...data };
      return { status: 'success', message: 'Asignatura actualizada', data: store.subjects[idx] };
    }
    case 'delete': {
      store.subjects = store.subjects.filter((s) => s.id !== data.id);
      return { status: 'success', message: 'Asignatura eliminada' };
    }
  }
}

export function handleManageSchedules(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  switch (action) {
    case 'create': {
      const newSched = {
        id: data.id || `sch-${Date.now()}`,
        subject_id: data.subject_id,
        day_of_week: Number(data.day_of_week),
        start_time: data.start_time,
        end_time: data.end_time,
        classroom: data.classroom || null,
      };
      store.schedules.push(newSched);
      return { status: 'success', message: 'Horario creado exitosamente', data: newSched };
    }
    case 'read': {
      if (data?.id) {
        const found = store.schedules.find((sc) => sc.id === data.id);
        return { status: 'success', data: found || null };
      }
      return { status: 'success', data: store.schedules };
    }
    case 'update': {
      const idx = store.schedules.findIndex((sc) => sc.id === data.id);
      if (idx === -1) return { status: 'error', message: 'Horario no encontrado' };
      store.schedules[idx] = { ...store.schedules[idx], ...data };
      return { status: 'success', message: 'Horario actualizado', data: store.schedules[idx] };
    }
    case 'delete': {
      store.schedules = store.schedules.filter((sc) => sc.id !== data.id);
      return { status: 'success', message: 'Horario eliminado' };
    }
  }
}

export function handleManageDeliverables(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  switch (action) {
    case 'create': {
      const newDeliv = {
        id: data.id || `deliv-${Date.now()}`,
        subject_id: data.subject_id,
        title: data.title,
        description: data.description || null,
        due_date: data.due_date || new Date().toISOString(),
        weight_percentage: Number(data.weight_percentage ?? 20),
        grade: data.grade !== undefined ? Number(data.grade) : null,
        type: data.type || 'Parcial',
        status: data.status || 'pendiente',
      };
      store.deliverables.push(newDeliv);
      return { status: 'success', message: 'Entregable/Parcial creado exitosamente', data: newDeliv };
    }
    case 'read': {
      if (data?.id) {
        const found = store.deliverables.find((d) => d.id === data.id);
        return { status: 'success', data: found || null };
      }
      return { status: 'success', data: store.deliverables };
    }
    case 'update': {
      const idx = store.deliverables.findIndex((d) => d.id === data.id);
      if (idx === -1) return { status: 'error', message: 'Entregable no encontrado' };
      store.deliverables[idx] = { ...store.deliverables[idx], ...data };
      return { status: 'success', message: 'Entregable actualizado', data: store.deliverables[idx] };
    }
    case 'delete': {
      store.deliverables = store.deliverables.filter((d) => d.id !== data.id);
      return { status: 'success', message: 'Entregable eliminado' };
    }
  }
}

export function handleManageSyllabusTopics(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  switch (action) {
    case 'create': {
      const newTopic: SyllabusTopic = {
        id: data.id || `topic-${Date.now()}`,
        subject_id: data.subject_id,
        parent_id: data.parent_id || undefined,
        title: data.title,
        description: data.description,
        mastery_status: data.mastery_status || 'no_iniciado',
        order_index: Number(data.order_index ?? 0),
      };
      store.syllabusTopics.push(newTopic);
      return { status: 'success', message: 'Tema de temario creado exitosamente', data: newTopic };
    }
    case 'read': {
      if (data?.id) {
        const found = store.syllabusTopics.find((t) => t.id === data.id);
        return { status: 'success', data: found || null };
      }
      return { status: 'success', data: store.syllabusTopics };
    }
    case 'update': {
      const idx = store.syllabusTopics.findIndex((t) => t.id === data.id);
      if (idx === -1) return { status: 'error', message: 'Tema no encontrado' };
      store.syllabusTopics[idx] = { ...store.syllabusTopics[idx], ...data };
      return { status: 'success', message: 'Tema actualizado', data: store.syllabusTopics[idx] };
    }
    case 'delete': {
      store.syllabusTopics = store.syllabusTopics.filter((t) => t.id !== data.id);
      return { status: 'success', message: 'Tema eliminado' };
    }
  }
}
