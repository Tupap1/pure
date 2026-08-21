import { computeAcademicLoad } from '../lib/algorithms/academic-load';
import { findSynergiesBetweenTopics, SyllabusTopic } from '../lib/domain/syllabus';
import {
  fetchAcademicOverviewFromDb,
  fetchAcademicLoadInputsFromDb,
  fetchUniversitiesFromDb,
  saveUniversityToDb,
  deleteUniversityFromDb,
  fetchProfessorsFromDb,
  saveProfessorToDb,
  deleteProfessorFromDb,
  fetchSubjectsFromDb,
  saveSubjectToDb,
  deleteSubjectFromDb,
  fetchSchedulesFromDb,
  saveScheduleToDb,
  deleteScheduleFromDb,
  fetchDeliverablesFromDb,
  saveDeliverableToDb,
  deleteDeliverableFromDb,
  fetchSyllabusTopicsFromDb,
  saveSyllabusTopicToDb,
  deleteSyllabusTopicFromDb,
  deleteSyllabusTopicsBySubjectFromDb,
  fetchStudyBlocksFromDb,
  saveStudyBlockToDb,
  deleteStudyBlockFromDb,
  fetchFlashcardsFromDb,
  saveFlashcardToDb,
  deleteFlashcardFromDb,
  fetchDueFlashcardsFromDb,
  fetchClassSessionsFromDb,
  saveClassSessionToDb,
  deleteClassSessionFromDb,
} from './db-repository';

export async function handleGetAcademicOverview() {
  try {
    const [overview, loadInputs] = await Promise.all([
      fetchAcademicOverviewFromDb(),
      fetchAcademicLoadInputsFromDb(),
    ]);
    if (!overview) {
      return { status: 'error', message: 'No se pudo cargar la vista académica desde PostgreSQL' };
    }

    // La carga se deriva de las materias y horarios reales. Sin materias registradas no hay
    // nada que calcular, y devolver un número igualmente sería inventarlo.
    const hasSubjects = loadInputs.subjects.length > 0;
    const load = hasSubjects
      ? computeAcademicLoad(loadInputs.subjects as any, loadInputs.schedules as any, loadInputs.universities as any)
      : null;

    return {
      status: 'success',
      data: {
        creditRule: {
          regulation: 'Decreto 1075 de 2015 (compila el Decreto 1295 de 2010)',
          hoursPerCreditPerSemester: 48,
          semesterWeeks: 16,
          note: 'Cada crédito son 48h de trabajo académico por semestre (3h/semana): acompañamiento directo del docente más trabajo independiente. Las horas independientes se derivan restando las horas de clase reales del horario.',
        },
        academicLoad: load
          ? {
              totalCredits: load.totalCredits,
              classHoursPerWeek: load.classHours,
              independentHoursPerWeek: load.normativeIndependentHours,
              totalAcademicHoursPerWeek: load.totalAcademicHours,
              sleepHoursPerWeek: load.sleepHours,
              subjectsWithoutSchedule: load.subjectsWithoutSchedule,
            }
          : null,
        netFreeTimeHours: load ? load.netFreeTime : null,
        isOverloaded: load ? load.isOverloaded : null,
        netFreeTimeNote: load
          ? 'Resultado de 168h menos clase, trabajo independiente y 49h de sueño. Un valor negativo significa que la carga académica no cabe en la semana.'
          : 'No hay materias registradas: no es posible derivar el tiempo libre neto.',
        universities: overview.universities,
        universitiesCount: overview.universitiesCount,
        professorsCount: overview.professorsCount,
        subjectsCount: overview.subjectsCount,
        schedulesCount: overview.schedulesCount,
        deliverablesCount: overview.deliverablesCount,
        syllabusTopicsCount: overview.syllabusTopicsCount,
      },
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error al obtener el resumen académico' };
  }
}

export async function handleParseAndIngestSyllabus(subjectId: string, rawText: string) {
  try {
    if (!subjectId || !rawText) {
      return { status: 'error', message: 'subject_id y raw_text son requeridos' };
    }

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const topics: SyllabusTopic[] = [];
    let currentParentId: string | undefined = undefined;

    // Reingestar el temario de una materia reemplaza por completo sus nodos previos,
    // para que una ingesta mas corta no deje nodos huerfanos de una version anterior.
    await deleteSyllabusTopicsBySubjectFromDb(subjectId);

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (line.toLowerCase().startsWith('unidad')) {
        const parentId = `${subjectId}-unit-${index}`;
        currentParentId = parentId;
        const topic: SyllabusTopic = {
          id: parentId,
          subject_id: subjectId,
          title: line,
          mastery_status: 'no_iniciado',
          order_index: index,
        };
        await saveSyllabusTopicToDb(topic);
        topics.push(topic);
      } else {
        const topic: SyllabusTopic = {
          id: `${subjectId}-topic-${index}`,
          subject_id: subjectId,
          parent_id: currentParentId,
          title: line.replace(/^[-*•]\s*/, ''),
          mastery_status: 'no_iniciado',
          order_index: index,
        };
        await saveSyllabusTopicToDb(topic);
        topics.push(topic);
      }
    }

    return {
      status: 'success',
      topicsParsed: topics.length,
      topics,
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error al procesar el temario' };
  }
}

export async function handleFindCrossSubjectSynergies() {
  try {
    const topicsRes = await fetchSyllabusTopicsFromDb();
    const topicsArray: SyllabusTopic[] = Array.isArray(topicsRes) ? topicsRes : [];

    const subjectIds = Array.from(new Set(topicsArray.map((t) => t.subject_id)));
    let matches: any[] = [];

    if (subjectIds.length >= 2) {
      const groupA = topicsArray.filter((t) => t.subject_id === subjectIds[0]);
      const groupB = topicsArray.filter((t) => t.subject_id !== subjectIds[0]);
      matches = findSynergiesBetweenTopics(groupA, groupB);
    } else {
      // Fallback sample synergies for demonstration when DB lacks multi-subject syllabus topics
      const topicsAero: SyllabusTopic[] = [
        { id: 'a1', subject_id: 'sub-geom', title: 'Resolución de Matrices y Vectores de Estado', mastery_status: 'dominado', order_index: 1 },
        { id: 'a2', subject_id: 'sub-calc', title: 'Ecuaciones Diferenciales y Métodos Numéricos', mastery_status: 'en_estudio', order_index: 2 },
      ];
      const topicsSoft: SyllabusTopic[] = [
        { id: 's1', subject_id: 'sub-prog', title: 'Algoritmos y Operaciones Matriciales C++', mastery_status: 'no_iniciado', order_index: 1 },
        { id: 's2', subject_id: 'sub-udec-ecuaciones', title: 'Ecuaciones Diferenciales Aplicadas', mastery_status: 'en_estudio', order_index: 2 },
      ];
      matches = findSynergiesBetweenTopics(topicsAero, topicsSoft);
    }

    return {
      status: 'success',
      synergiesCount: matches.length,
      synergies: matches,
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error al buscar sinergias' };
  }
}

export async function handleIngestAcademicEnrollment(rawEnrollmentText?: string) {
  if (!rawEnrollmentText || !rawEnrollmentText.trim()) {
    return {
      status: 'error',
      error: 'invalid_input',
      message: 'No se proporcionó texto de matrícula (raw_text es obligatorio). Formato esperado: JSON estructurado con { universities, professors, subjects, schedules } (convención day_of_week: 1=Lunes..7=Domingo).',
    };
  }

  let parsedJson: any = null;
  let isJson = false;

  try {
    parsedJson = JSON.parse(rawEnrollmentText);
    if (typeof parsedJson === 'object' && parsedJson !== null) {
      isJson = true;
    }
  } catch {
    isJson = false;
  }

  if (isJson) {
    // JSON Branch: Any DB write exception MUST propagate as status "error", NEVER falling through to plain text parsing!
    try {
      let universitiesIngested = 0;
      let professorsIngested = 0;
      let subjectsIngested = 0;
      let schedulesIngested = 0;
      let classroomsUpdatedCount = 0;

      if (Array.isArray(parsedJson.universities)) {
        for (const u of parsedJson.universities) {
          await saveUniversityToDb(u);
          universitiesIngested++;
        }
      }
      if (Array.isArray(parsedJson.professors)) {
        for (const p of parsedJson.professors) {
          await saveProfessorToDb(p);
          professorsIngested++;
        }
      }
      if (Array.isArray(parsedJson.subjects)) {
        for (const s of parsedJson.subjects) {
          await saveSubjectToDb(s);
          subjectsIngested++;
        }
      }
      if (Array.isArray(parsedJson.schedules)) {
        for (const sc of parsedJson.schedules) {
          await saveScheduleToDb(sc);
          schedulesIngested++;
        }
      }

      if (parsedJson.classroomOverrides && typeof parsedJson.classroomOverrides === 'object') {
        const currentSchedulesRes = await fetchSchedulesFromDb();
        const schedulesArray = Array.isArray(currentSchedulesRes) ? currentSchedulesRes : [];
        for (const [subId, newClassroom] of Object.entries(parsedJson.classroomOverrides)) {
          const matching = schedulesArray.filter((sch: any) => sch && sch.subject_id === subId);
          for (const sch of matching) {
            await saveScheduleToDb({ ...sch, classroom: newClassroom as string });
            classroomsUpdatedCount++;
          }
        }
      }

      const totalChanges = universitiesIngested + professorsIngested + subjectsIngested + schedulesIngested + classroomsUpdatedCount;

      if (totalChanges === 0) {
        return {
          status: 'error',
          error: 'invalid_input',
          message: 'El JSON proporcionado no contiene ninguna de las claves esperadas: universities, professors, subjects, schedules o classroomOverrides.',
        };
      }

      return {
        status: 'success',
        message: 'Matrícula e información de aulas procesada exitosamente en el Servidor MCP.',
        data: {
          universitiesCount: universitiesIngested,
          professorsCount: professorsIngested,
          subjectsCount: subjectsIngested,
          schedulesCount: schedulesIngested,
          classroomsUpdated: classroomsUpdatedCount,
        },
      };
    } catch (dbErr: any) {
      return {
        status: 'error',
        message: dbErr.message || 'Error al guardar los datos de matrícula en la base de datos.',
      };
    }
  }

  // Plain Text Branch (only entered when rawEnrollmentText is NOT valid JSON)
  try {
    const lines = rawEnrollmentText.split('\n');
    const subsRes = await fetchSubjectsFromDb();
    const schedsRes = await fetchSchedulesFromDb();
    const subsArray = Array.isArray(subsRes) ? subsRes : [];
    const schedsArray = Array.isArray(schedsRes) ? schedsRes : [];
    let classroomsUpdatedCount = 0;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length === 2) {
        const key = parts[0].trim().toLowerCase();
        const val = parts[1].trim();

        if (key && val) {
          for (const sub of subsArray) {
            if (sub.name && sub.name.toLowerCase().includes(key)) {
              const matchingScheds = schedsArray.filter((sch: any) => sch && sch.subject_id === sub.id);
              for (const sch of matchingScheds) {
                await saveScheduleToDb({ ...sch, classroom: val });
                classroomsUpdatedCount++;
              }
            }
          }
        }
      }
    }

    if (classroomsUpdatedCount === 0) {
      return {
        status: 'error',
        error: 'invalid_input',
        message: 'El texto de entrada no es un JSON válido ni contiene actualizaciones de aulas para materias existentes (formato esperado: JSON con { universities, professors, subjects, schedules } (day_of_week: 1=Lunes..7=Domingo) o "Nombre Materia: Aula").',
      };
    }

    return {
      status: 'success',
      message: 'Aulas actualizadas exitosamente a partir de texto plano.',
      data: {
        schedules: await fetchSchedulesFromDb(),
        classroomsUpdated: classroomsUpdatedCount,
      },
    };
  } catch (err: any) {
    return {
      status: 'error',
      message: err.message || 'Error al procesar texto de matrícula',
    };
  }
}

// --- CRUD HANDLERS (Direct PostgreSQL) ---

export async function handleManageUniversities(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  try {
    switch (action) {
      case 'create': {
        const saved = await saveUniversityToDb(data || {});
        return { status: 'success', message: 'Universidad creada exitosamente', data: saved };
      }
      case 'read': {
        const found = await fetchUniversitiesFromDb(data?.id);
        return { status: 'success', data: found };
      }
      case 'update': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para actualizar' };
        const existing = await fetchUniversitiesFromDb(data.id);
        if (!existing || Array.isArray(existing) === false && existing === null) {
          return { status: 'error', message: 'Universidad no encontrada' };
        }
        const merged = Array.isArray(existing) ? existing[0] : existing;
        if (!merged) return { status: 'error', message: 'Universidad no encontrada' };
        const updated = await saveUniversityToDb({ ...merged, ...data });
        return { status: 'success', message: 'Universidad actualizada', data: updated };
      }
      case 'delete': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para eliminar' };
        await deleteUniversityFromDb(data.id);
        return { status: 'success', message: 'Universidad eliminada' };
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de Universidad' };
  }
}

export async function handleManageProfessors(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  try {
    switch (action) {
      case 'create': {
        const saved = await saveProfessorToDb(data || {});
        return { status: 'success', message: 'Profesor creado exitosamente', data: saved };
      }
      case 'read': {
        const found = await fetchProfessorsFromDb(data?.id);
        return { status: 'success', data: found };
      }
      case 'update': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para actualizar' };
        const existing = await fetchProfessorsFromDb(data.id);
        if (!existing) return { status: 'error', message: 'Profesor no encontrado' };
        const updated = await saveProfessorToDb({ ...existing, ...data });
        return { status: 'success', message: 'Profesor actualizado', data: updated };
      }
      case 'delete': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para eliminar' };
        await deleteProfessorFromDb(data.id);
        return { status: 'success', message: 'Profesor eliminado' };
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de Profesor' };
  }
}

export async function handleManageSubjects(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  try {
    switch (action) {
      case 'create': {
        const saved = await saveSubjectToDb(data || {});
        return { status: 'success', message: 'Asignatura creada exitosamente', data: saved };
      }
      case 'read': {
        const found = await fetchSubjectsFromDb(data?.id);
        return { status: 'success', data: found };
      }
      case 'update': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para actualizar' };
        const existing = await fetchSubjectsFromDb(data.id);
        if (!existing) return { status: 'error', message: 'Asignatura no encontrada' };
        const merged = Array.isArray(existing) ? existing[0] : existing;
        if (!merged) return { status: 'error', message: 'Asignatura no encontrada' };
        const updated = await saveSubjectToDb({ ...merged, ...data });
        return { status: 'success', message: 'Asignatura actualizada', data: updated };
      }
      case 'delete': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para eliminar' };
        await deleteSubjectFromDb(data.id);
        return { status: 'success', message: 'Asignatura eliminada' };
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de Asignatura' };
  }
}

export async function handleManageSchedules(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  try {
    switch (action) {
      case 'create': {
        const saved = await saveScheduleToDb(data || {});
        return { status: 'success', message: 'Horario creado exitosamente', data: saved };
      }
      case 'read': {
        const found = await fetchSchedulesFromDb(data?.id);
        return { status: 'success', data: found };
      }
      case 'update': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para actualizar' };
        const existing = await fetchSchedulesFromDb(data.id);
        if (!existing) return { status: 'error', message: 'Horario no encontrado' };
        const merged = Array.isArray(existing) ? existing[0] : existing;
        if (!merged) return { status: 'error', message: 'Horario no encontrado' };
        const updated = await saveScheduleToDb({ ...merged, ...data });
        return { status: 'success', message: 'Horario actualizado', data: updated };
      }
      case 'delete': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para eliminar' };
        await deleteScheduleFromDb(data.id);
        return { status: 'success', message: 'Horario eliminado' };
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de Horario' };
  }
}

export async function handleManageClassSessions(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  try {
    switch (action) {
      case 'create': {
        const saved = await saveClassSessionToDb(data || {});
        return { status: 'success', message: 'Sesión de clase creada', data: saved };
      }
      case 'read': {
        const found = await fetchClassSessionsFromDb(data?.id);
        return { status: 'success', data: found };
      }
      case 'update': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para actualizar' };
        const existing = await fetchClassSessionsFromDb(data.id);
        const merged = Array.isArray(existing) ? existing[0] : existing;
        if (!merged) return { status: 'error', message: 'Sesión de clase no encontrada' };
        const updated = await saveClassSessionToDb({ ...merged, ...data });
        return { status: 'success', message: 'Sesión de clase actualizada', data: updated };
      }
      case 'delete': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para eliminar' };
        await deleteClassSessionFromDb(data.id);
        return { status: 'success', message: 'Sesión de clase eliminada' };
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de Sesión de clase' };
  }
}

export async function handleManageDeliverables(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  try {
    switch (action) {
      case 'create': {
        const saved = await saveDeliverableToDb(data || {});
        return { status: 'success', message: 'Entregable/Parcial creado exitosamente', data: saved };
      }
      case 'read': {
        const found = await fetchDeliverablesFromDb(data?.id);
        return { status: 'success', data: found };
      }
      case 'update': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para actualizar' };
        const existing = await fetchDeliverablesFromDb(data.id);
        if (!existing) return { status: 'error', message: 'Entregable no encontrado' };
        const merged = Array.isArray(existing) ? existing[0] : existing;
        if (!merged) return { status: 'error', message: 'Entregable no encontrado' };
        const updated = await saveDeliverableToDb({ ...merged, ...data });
        return { status: 'success', message: 'Entregable actualizado', data: updated };
      }
      case 'delete': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para eliminar' };
        await deleteDeliverableFromDb(data.id);
        return { status: 'success', message: 'Entregable eliminado' };
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de Entregable' };
  }
}

export async function handleManageSyllabusTopics(action: 'create' | 'read' | 'update' | 'delete', data?: any) {
  try {
    switch (action) {
      case 'create': {
        const saved = await saveSyllabusTopicToDb(data || {});
        return { status: 'success', message: 'Tema de temario creado exitosamente', data: saved };
      }
      case 'read': {
        const found = await fetchSyllabusTopicsFromDb(data?.id);
        return { status: 'success', data: found };
      }
      case 'update': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para actualizar' };
        const existing = await fetchSyllabusTopicsFromDb(data.id);
        if (!existing) return { status: 'error', message: 'Tema no encontrado' };
        const merged = Array.isArray(existing) ? existing[0] : existing;
        if (!merged) return { status: 'error', message: 'Tema no encontrado' };
        const updated = await saveSyllabusTopicToDb({ ...merged, ...data });
        return { status: 'success', message: 'Tema actualizado', data: updated };
      }
      case 'delete': {
        if (!data?.id) return { status: 'error', message: 'ID es requerido para eliminar' };
        await deleteSyllabusTopicFromDb(data.id);
        return { status: 'success', message: 'Tema eliminado' };
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de Tema' };
  }
}

export async function handleGenerateStudyPlan(
  availableHoursPerDay: number,
  targetSubjectIds?: string[],
  dateStart?: string,
  dateEnd?: string
) {
  try {
    if (!availableHoursPerDay || !dateStart || !dateEnd) {
      return { status: 'error', message: 'available_hours_per_day, date_start, date_end son requeridos' };
    }

    const [subjects, schedules, deliverables] = await Promise.all([
      fetchSubjectsFromDb(),
      fetchSchedulesFromDb(),
      fetchDeliverablesFromDb(),
    ]);

    const filteredSubjects = targetSubjectIds
      ? (Array.isArray(subjects) ? subjects : [subjects]).filter((s: any) => targetSubjectIds.includes(s.id))
      : (Array.isArray(subjects) ? subjects : [subjects]);

    const dmeHoursBySubject = new Map<string, number>();
    filteredSubjects.forEach((s: any) => {
      dmeHoursBySubject.set(s.id, s.difficulty * 0.5);
    });

    const { generateStudyPlan } = await import('../lib/algorithms/study-planner');
    const weekStart = new Date(dateStart);
    const blocks = generateStudyPlan({
      dmeHoursBySubject,
      schedules: (Array.isArray(schedules) ? schedules : [schedules]) as any,
      deliverables: (Array.isArray(deliverables) ? deliverables : [deliverables]) as any,
      weekStartDate: weekStart,
    });

    const filteredBlocks = blocks.filter(b => b.date >= dateStart && b.date <= dateEnd);

    return {
      status: 'success',
      blocksGenerated: filteredBlocks.length,
      blocks: filteredBlocks,
      dateRange: { start: dateStart, end: dateEnd },
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error generando plan de estudio' };
  }
}

export async function handleGetStudyMaterial(
  subjectId?: string,
  topicId?: string,
  sessionDate?: string
) {
  try {
    const [topics, sessions, flashcards, deliverables] = await Promise.all([
      fetchSyllabusTopicsFromDb(),
      fetchClassSessionsFromDb(),
      fetchFlashcardsFromDb(),
      fetchDeliverablesFromDb(),
    ]);

    let filteredTopics = Array.isArray(topics) ? topics : [topics];
    let filteredSessions = Array.isArray(sessions) ? sessions : [sessions];
    let filteredFlashcards = Array.isArray(flashcards) ? flashcards : [flashcards];
    let filteredDeliverables = Array.isArray(deliverables) ? deliverables : [deliverables];

    if (subjectId) {
      filteredTopics = filteredTopics.filter((t: any) => t.subject_id === subjectId);
      filteredSessions = filteredSessions.filter((s: any) => s.subject_id === subjectId);
      filteredFlashcards = filteredFlashcards.filter((f: any) => f.subject_id === subjectId);
      filteredDeliverables = filteredDeliverables.filter((d: any) => d.subject_id === subjectId);
    }

    if (topicId) {
      filteredTopics = filteredTopics.filter((t: any) => t.id === topicId || t.parent_id === topicId);
      filteredFlashcards = filteredFlashcards.filter((f: any) => f.topic_id === topicId);
    }

    if (sessionDate) {
      filteredSessions = filteredSessions.filter((s: any) => s.session_date.split('T')[0] === sessionDate);
    }

    return {
      status: 'success',
      material: {
        syllabusTopics: filteredTopics,
        classSessions: filteredSessions,
        flashcards: filteredFlashcards,
        deliverables: filteredDeliverables,
      },
      counts: {
        topics: filteredTopics.length,
        sessions: filteredSessions.length,
        flashcards: filteredFlashcards.length,
        deliverables: filteredDeliverables.length,
      },
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error obteniendo material de estudio' };
  }
}

export async function handleGeneratePracticeExam(
  subjectId: string,
  topicIds: string[],
  questionCount?: number,
  questionTypes?: string[],
  difficulty?: string,
  sessionId?: string
) {
  try {
    if (!subjectId || !topicIds || topicIds.length === 0) {
      return { status: 'error', message: 'subject_id y topic_ids son requeridos' };
    }

    const count = questionCount || 10;
    const types = questionTypes || ['open', 'mcq'];
    const diff = difficulty || 'medium';

    const [topics, sessions, flashcards] = await Promise.all([
      fetchSyllabusTopicsFromDb(),
      fetchClassSessionsFromDb(),
      fetchFlashcardsFromDb(),
    ]);

    const relevantTopics = (Array.isArray(topics) ? topics : [topics]).filter((t: any) => topicIds.includes(t.id));
    const relevantSessions = (Array.isArray(sessions) ? sessions : [sessions]).filter((s: any) => s.subject_id === subjectId);
    const relevantFlashcards = (Array.isArray(flashcards) ? flashcards : [flashcards]).filter((f: any) => topicIds.includes(f.topic_id));

    // If sessionId is provided, incorporate its content into the context
    let additionalContext = '';
    if (sessionId) {
      const sessionResult = await fetchClassSessionsFromDb(sessionId);
      const session = Array.isArray(sessionResult) ? sessionResult[0] : sessionResult;
      if (session) {
        additionalContext += `Materiales de sesión ${sessionId}:\n`;
        if (session.topics_covered) {
          const covered = typeof session.topics_covered === 'string'
            ? JSON.parse(session.topics_covered)
            : session.topics_covered;
          if (Array.isArray(covered)) {
            additionalContext += `Temas cubiertos: ${covered.join(', ')}\n`;
          }
        }
        if (session.transcript_text) {
          additionalContext += `Transcripción:\n${session.transcript_text}\n`;
        }
      }
    }

    return {
      status: 'success',
      examContext: {
        subject_id: subjectId,
        topic_ids: topicIds,
        difficulty: diff,
        question_count: count,
        question_types: types,
        topics: relevantTopics,
        referenceMaterial: {
          classSessions: relevantSessions,
          existingFlashcards: relevantFlashcards,
        },
      },
      instruction: `Usa este contexto para formular ${count} preguntas de tipo ${types.join(', ')} con dificultad ${diff}.${additionalContext ? '\n' + additionalContext : ''}`,
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error generando examen de práctica' };
  }
}

export async function handleRecordStudyProgress(flashcardId: string, rating: string) {
  try {
    if (!flashcardId || !['again', 'hard', 'good', 'easy'].includes(rating)) {
      return { status: 'error', message: 'flashcard_id y rating (again|hard|good|easy) son requeridos' };
    }

    const flashcard = await fetchFlashcardsFromDb(flashcardId);
    if (!flashcard) {
      return { status: 'error', message: `Flashcard ${flashcardId} no encontrada` };
    }

    const { reviewFlashcard: review } = await import('../lib/algorithms/flashcard-scheduler');
    const updatedCard = review(Array.isArray(flashcard) ? flashcard[0] : flashcard, rating as any);
    await saveFlashcardToDb(updatedCard);

    return {
      status: 'success',
      flashcard: updatedCard,
      message: `Flashcard actualizada. Próxima revisión: ${updatedCard.due}`,
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error registrando progreso de flashcard' };
  }
}

export async function handleGetSyllabusProgress(subjectId?: string) {
  try {
    const topics = await fetchSyllabusTopicsFromDb();
    let filtered = Array.isArray(topics) ? topics : [topics];

    if (subjectId) {
      filtered = filtered.filter((t: any) => t.subject_id === subjectId);
    }

    const units = new Map<string | undefined, any[]>();
    filtered.forEach((topic: any) => {
      const parentId = topic.parent_id;
      if (!units.has(parentId)) units.set(parentId, []);
      units.get(parentId)!.push(topic);
    });

    const progress = Array.from(units.entries()).map(([unitId, unitTopics]) => {
      const statuses = unitTopics.map((t: any) => t.mastery_status);
      const counts = {
        total: unitTopics.length,
        no_iniciado: statuses.filter((s: string) => s === 'no_iniciado').length,
        en_estudio: statuses.filter((s: string) => s === 'en_estudio').length,
        repasado: statuses.filter((s: string) => s === 'repasado').length,
        dominado: statuses.filter((s: string) => s === 'dominado').length,
      };
      const completionPercent = counts.total > 0 ? Math.round((counts.dominado / counts.total) * 100) : 0;

      return {
        unit_id: unitId,
        topics: unitTopics,
        progress: {
          completionPercent,
          ...counts,
        },
      };
    });

    return {
      status: 'success',
      progress,
      subjectId: subjectId || 'all',
      totalTopics: filtered.length,
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error obteniendo progreso del temario' };
  }
}

export async function handleGetClassContext(input: { session_id?: string; subject_id?: string; date?: string }) {
  try {
    let session: any = null;

    // Resolve the session
    if (input.session_id) {
      const result = await fetchClassSessionsFromDb(input.session_id);
      session = Array.isArray(result) ? result[0] : result;
    } else if (input.subject_id) {
      // Fetch all sessions for this subject, sort by session_date DESC, take the first
      const allSessions = await fetchClassSessionsFromDb();
      const sessionsArray = Array.isArray(allSessions) ? allSessions : [allSessions];
      const filtered = sessionsArray.filter((s: any) => s && s.subject_id === input.subject_id);
      if (filtered.length > 0) {
        filtered.sort((a: any, b: any) => {
          const dateA = new Date(a.session_date || 0).getTime();
          const dateB = new Date(b.session_date || 0).getTime();
          return dateB - dateA; // DESC
        });
        session = filtered[0];
      }
    } else {
      return { status: 'error', message: 'Debe indicar session_id o subject_id' };
    }

    if (!session) {
      return { status: 'error', message: 'Sesión de clase no encontrada' };
    }

    // Load subject
    const subjectResult = await fetchSubjectsFromDb(session.subject_id);
    const subj = Array.isArray(subjectResult) ? subjectResult[0] : subjectResult;

    // Load all syllabus topics and filter by subject_id
    const allTopics = await fetchSyllabusTopicsFromDb();
    const topicsArray = Array.isArray(allTopics) ? allTopics : [allTopics];
    const relatedTopics = topicsArray
      .filter((t: any) => t && t.subject_id === session.subject_id)
      .map((t: any) => ({
        id: t.id,
        title: t.title,
        mastery_status: t.mastery_status,
      }));

    // Parse topics_covered if it's a string (JSON array)
    let topicsCovered: string[] = [];
    if (session.topics_covered) {
      if (typeof session.topics_covered === 'string') {
        try {
          topicsCovered = JSON.parse(session.topics_covered);
        } catch {
          topicsCovered = [];
        }
      } else if (Array.isArray(session.topics_covered)) {
        topicsCovered = session.topics_covered;
      }
    }

    // Parse ai_action_items if it's a string
    let actionItems: string[] = [];
    if (session.ai_action_items) {
      if (typeof session.ai_action_items === 'string') {
        try {
          actionItems = JSON.parse(session.ai_action_items);
        } catch {
          actionItems = [];
        }
      } else if (Array.isArray(session.ai_action_items)) {
        actionItems = session.ai_action_items;
      }
    }

    // Parse ai_questions if it's a string
    let questions: string[] = [];
    if (session.ai_questions) {
      if (typeof session.ai_questions === 'string') {
        try {
          questions = JSON.parse(session.ai_questions);
        } catch {
          questions = [];
        }
      } else if (Array.isArray(session.ai_questions)) {
        questions = session.ai_questions;
      }
    }

    // Ensure session_date is a string (it may be a Date object from the database)
    const sessionDateStr = typeof session.session_date === 'string'
      ? session.session_date
      : session.session_date instanceof Date
      ? session.session_date.toISOString()
      : String(session.session_date);

    return {
      status: 'success',
      data: {
        id: session.id,
        title: session.title,
        session_date: sessionDateStr,
        subject: {
          id: session.subject_id,
          name: subj?.name ?? null,
        },
        summary: session.ai_summary ?? session.summary ?? null,
        topics: topicsCovered,
        action_items: actionItems,
        questions: questions,
        transcript_text: session.transcript_text ?? null,
        transcript_available: !!session.transcript_text,
        related_syllabus_topics: relatedTopics,
      },
    };
  } catch (error: any) {
    return { status: 'error', message: error.message };
  }
}

export async function handleSyncFireflies(force?: boolean) {
  try {
    const apiKey = process.env.FIREFLIES_API_KEY;
    if (!apiKey) {
      return { status: 'error', message: 'FIREFLIES_API_KEY no está configurado' };
    }

    const [schedules, subjects, existingSessions] = await Promise.all([
      fetchSchedulesFromDb(),
      fetchSubjectsFromDb(),
      fetchClassSessionsFromDb(),
    ]);

    const { syncFirefliesTranscripts } = await import('../lib/integrations/fireflies-sync');
    const syncResult = await syncFirefliesTranscripts(
      apiKey,
      (Array.isArray(schedules) ? schedules : [schedules]) as any,
      (Array.isArray(subjects) ? subjects : [subjects]) as any,
      (Array.isArray(existingSessions) ? existingSessions : [existingSessions]) as any
    );

    const { saveClassSessionToDb } = await import('./db-repository');
    for (const session of syncResult.newSessions) {
      await saveClassSessionToDb(session);
    }

    return {
      status: 'success',
      message: `Sincronización completada: ${syncResult.matched} coincidencias, ${syncResult.unmatched} no coincididas`,
      newSessionsCreated: syncResult.newSessions.length,
      matched: syncResult.matched,
      unmatched: syncResult.unmatched,
      sessions: syncResult.newSessions,
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error sincronizando Fireflies' };
  }
}

export async function handleManageStudyBlocks(action: string, data?: any) {
  try {
    const { fetchStudyBlocksFromDb, saveStudyBlockToDb, deleteStudyBlockFromDb } = await import('./db-repository');

    switch (action) {
      case 'create': {
        if (!data || !data.subject_id || !data.date || !data.start_time || !data.end_time) {
          return { status: 'error', message: 'subject_id, date, start_time, end_time son requeridos para crear' };
        }
        const block = {
          id: data.id || `block-${Date.now()}`,
          ...data,
          created_at: new Date().toISOString(),
        };
        await saveStudyBlockToDb(block);
        return { status: 'success', block };
      }

      case 'read': {
        const blocks = await fetchStudyBlocksFromDb(data?.subject_id);
        return { status: 'success', blocks };
      }

      case 'update': {
        if (!data || !data.id) {
          return { status: 'error', message: 'id es requerido para actualizar' };
        }
        const existing = await fetchStudyBlocksFromDb();
        const toUpdate = (Array.isArray(existing) ? existing : [existing]).find((b: any) => b.id === data.id);
        if (!toUpdate) {
          return { status: 'error', message: `Bloque ${data.id} no encontrado` };
        }
        const updated = { ...toUpdate, ...data };
        await saveStudyBlockToDb(updated);
        return { status: 'success', block: updated };
      }

      case 'delete': {
        if (!data || !data.id) {
          return { status: 'error', message: 'id es requerido para eliminar' };
        }
        await deleteStudyBlockFromDb(data.id);
        return { status: 'success', message: `Bloque ${data.id} eliminado` };
      }

      default:
        return { status: 'error', message: `Acción no válida: ${action}` };
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de bloques de estudio' };
  }
}

export async function handleManageFlashcards(action: string, data?: any) {
  try {
    const { fetchFlashcardsFromDb, saveFlashcardToDb, deleteFlashcardFromDb, fetchDueFlashcardsFromDb } = await import('./db-repository');

    switch (action) {
      case 'create': {
        if (!data || !data.subject_id || !data.topic_id || !data.question || !data.answer) {
          return { status: 'error', message: 'subject_id, topic_id, question, answer son requeridos para crear' };
        }
        const card = {
          id: data.id || `card-${Date.now()}`,
          ...data,
          created_at: new Date().toISOString(),
        };
        await saveFlashcardToDb(card);
        return { status: 'success', flashcard: card };
      }

      case 'read': {
        const cards = await fetchFlashcardsFromDb(data?.subject_id);
        return { status: 'success', flashcards: cards };
      }

      case 'update': {
        if (!data || !data.id) {
          return { status: 'error', message: 'id es requerido para actualizar' };
        }
        const existing = await fetchFlashcardsFromDb();
        const toUpdate = (Array.isArray(existing) ? existing : [existing]).find((c: any) => c.id === data.id);
        if (!toUpdate) {
          return { status: 'error', message: `Flashcard ${data.id} no encontrada` };
        }
        const updated = { ...toUpdate, ...data };
        await saveFlashcardToDb(updated);
        return { status: 'success', flashcard: updated };
      }

      case 'delete': {
        if (!data || !data.id) {
          return { status: 'error', message: 'id es requerido para eliminar' };
        }
        await deleteFlashcardFromDb(data.id);
        return { status: 'success', message: `Flashcard ${data.id} eliminada` };
      }

      case 'due_today': {
        const today = new Date().toISOString().split('T')[0];
        const dueCards = await fetchDueFlashcardsFromDb(today);
        return { status: 'success', flashcards: dueCards, count: dueCards.length, date: today };
      }

      default:
        return { status: 'error', message: `Acción no válida: ${action}` };
    }
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error en operación de flashcards' };
  }
}
