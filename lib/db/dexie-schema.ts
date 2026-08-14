import Dexie, { Table } from 'dexie';

export interface UniversityEntity {
  id?: string;
  name: string;
  modality: 'presencial' | 'virtual' | 'hibrida';
  scale_min: number;
  scale_max: number;
  passing_grade: number;
  color: string;
  has_alternating_saturdays?: boolean;
  first_sabado_a_date?: string;
  created_at?: string;
}

export interface ProfessorEntity {
  id?: string;
  university_id: string;
  name: string;
  email?: string;
  office_hours?: string;
  notes?: string;
  created_at?: string;
}

export interface SubjectEntity {
  id?: string;
  university_id: string;
  professor_id?: string;
  name: string;
  code?: string;
  credits: number;
  difficulty: number;
  modality: 'presencial' | 'virtual' | 'hibrida';
  target_grade: number;
  current_grade: number;
  max_absences?: number;
  created_at?: string;
}

export interface ScheduleEntity {
  id?: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  classroom?: string;
  periodicity?: 'semanal' | 'sabado_a' | 'sabado_b';
  created_at?: string;
}

export interface SyllabusTopicEntity {
  id?: string;
  subject_id: string;
  parent_id?: string;
  title: string;
  description?: string;
  mastery_status: 'no_iniciado' | 'en_estudio' | 'repasado' | 'dominado';
  order_index: number;
  created_at?: string;
}

export interface DeliverableEntity {
  id?: string;
  subject_id: string;
  topic_id?: string;
  title: string;
  description?: string;
  due_date: string;
  weight_percentage: number;
  grade?: number;
  type: 'taller' | 'proyecto' | 'parcial' | 'quiz' | 'laboratorio' | 'examen_final';
  location_modality?: 'presencial' | 'virtual';
  is_group: boolean;
  complexity: 'facil' | 'medio' | 'dificil';
  status: 'pendiente' | 'entregado' | 'calificado';
  created_at?: string;
}

export interface StudySessionEntity {
  id?: string;
  subject_id: string;
  topic_id?: string;
  deliverable_id?: string;
  scheduled_start: string;
  scheduled_end: string;
  is_completed: boolean;
  source: 'algorithm' | 'ai_mcp' | 'manual';
  created_at?: string;
}

export interface ClassSessionEntity {
  id?: string;
  subject_id: string;
  schedule_id?: string;
  session_date: string;
  title: string;
  summary?: string | null;
  notion_link?: string | null;
  recording_url?: string | null;
  topics_covered?: string[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SyncQueueItem {
  id?: number;
  action: 'insert' | 'update' | 'delete';
  table_name: string;
  data: any;
  timestamp: string;
}

export class PureDatabase extends Dexie {
  universities!: Table<UniversityEntity, string>;
  professors!: Table<ProfessorEntity, string>;
  subjects!: Table<SubjectEntity, string>;
  schedules!: Table<ScheduleEntity, string>;
  syllabusTopics!: Table<SyllabusTopicEntity, string>;
  deliverables!: Table<DeliverableEntity, string>;
  studySessions!: Table<StudySessionEntity, string>;
  classSessions!: Table<ClassSessionEntity, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('PureDB');

    this.version(1).stores({
      universities: '++id, name, modality',
      professors: '++id, university_id, name',
      subjects: '++id, university_id, professor_id, name, difficulty',
      schedules: '++id, subject_id, day_of_week',
      syllabusTopics: '++id, subject_id, parent_id, mastery_status',
      deliverables: '++id, subject_id, topic_id, due_date, status, is_group',
      studySessions: '++id, subject_id, topic_id, deliverable_id, is_completed',
      syncQueue: '++id, action, table_name, timestamp'
    });

    // classSessions llegó después de que la versión 1 ya estuviera instalada en los
    // navegadores. Declararla dentro de version(1) obligaba a Dexie a parchear el
    // esquema por su cuenta ("SchemaDiff: Schema was extended without increasing the
    // number passed to db.version()"), un camino de rescate que él mismo desaconseja y
    // que deja la migración a merced de una heurística. Pedirla en su propia versión
    // hace explícito el ascenso y lo vuelve reproducible.
    this.version(2).stores({
      classSessions: '++id, subject_id, schedule_id, session_date'
    });
  }
}

export const pureDB = new PureDatabase();
