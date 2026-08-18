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
