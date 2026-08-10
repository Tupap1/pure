import { calculateNetFreeTime } from '../lib/algorithms/study-hours-dme';
import { findSynergiesBetweenTopics, SyllabusTopic } from '../lib/domain/syllabus';
import {
  fetchAcademicOverviewFromDb,
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
} from './db-repository';

export async function handleGetAcademicOverview() {
  try {
    const overview = await fetchAcademicOverviewFromDb();
    if (!overview) {
      return { status: 'error', message: 'No se pudo cargar la vista académica desde PostgreSQL' };
    }

    return {
      status: 'success',
      data: {
        netFreeTimeHours: calculateNetFreeTime({ classHours: 28, dmeHours: 24, sleepHoursPerNight: 7 }),
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

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (line.toLowerCase().startsWith('unidad')) {
        const parentId = `unit-${index}`;
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
          id: `topic-${index}`,
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
  try {
    if (rawEnrollmentText) {
      try {
        const parsed = JSON.parse(rawEnrollmentText);
        if (parsed.universities) {
          for (const u of parsed.universities) await saveUniversityToDb(u);
        }
        if (parsed.professors) {
          for (const p of parsed.professors) await saveProfessorToDb(p);
        }
        if (parsed.subjects) {
          for (const s of parsed.subjects) await saveSubjectToDb(s);
        }
        if (parsed.schedules) {
          for (const sc of parsed.schedules) await saveScheduleToDb(sc);
        }

        if (parsed.classroomOverrides) {
          const currentSchedulesRes = await fetchSchedulesFromDb();
          const schedulesArray = Array.isArray(currentSchedulesRes) ? currentSchedulesRes : [];
          for (const [subId, newClassroom] of Object.entries(parsed.classroomOverrides)) {
            const matching = schedulesArray.filter((sch: any) => sch && sch.subject_id === subId);
            for (const sch of matching) {
              await saveScheduleToDb({ ...sch, classroom: newClassroom });
            }
          }
        }
      } catch {
        // Plain text parsing
        const lines = rawEnrollmentText.split('\n');
        const subsRes = await fetchSubjectsFromDb();
        const schedsRes = await fetchSchedulesFromDb();
        const subsArray = Array.isArray(subsRes) ? subsRes : [];
        const schedsArray = Array.isArray(schedsRes) ? schedsRes : [];

        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length === 2) {
            const key = parts[0].trim().toLowerCase();
            const val = parts[1].trim();

            for (const sub of subsArray) {
              if (sub.name.toLowerCase().includes(key)) {
                const matchingScheds = schedsArray.filter((sch: any) => sch.subject_id === sub.id);
                for (const sch of matchingScheds) {
                  await saveScheduleToDb({ ...sch, classroom: val });
                }
              }
            }
          }
        }
      }
    }

    const overview = await fetchAcademicOverviewFromDb();
    const universities = await fetchUniversitiesFromDb();
    const professors = await fetchProfessorsFromDb();
    const subjects = await fetchSubjectsFromDb();
    const schedules = await fetchSchedulesFromDb();

    const unisArr = Array.isArray(universities) ? universities : universities ? [universities] : [];
    const profsArr = Array.isArray(professors) ? professors : professors ? [professors] : [];
    const subsArr = Array.isArray(subjects) ? subjects : subjects ? [subjects] : [];
    const schedsArr = Array.isArray(schedules) ? schedules : schedules ? [schedules] : [];

    return {
      status: 'success',
      message: 'Matrícula e información de aulas procesada exitosamente en el Servidor MCP.',
      data: {
        universitiesCount: overview?.universitiesCount || unisArr.length,
        professorsCount: overview?.professorsCount || profsArr.length,
        subjectsCount: overview?.subjectsCount || subsArr.length,
        schedulesCount: overview?.schedulesCount || schedsArr.length,
        universities: unisArr,
        professors: profsArr,
        subjects: subsArr,
        schedules: schedsArr,
      },
    };
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Error al ingestar matrícula' };
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
