import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { UniversityEntity, ProfessorEntity, SubjectEntity, ScheduleEntity } from '@/lib/db/dexie-schema';
import {
  saveUniversity, deleteUniversity,
  saveProfessor, deleteProfessor,
  saveSubject, deleteSubject,
  saveSchedule, deleteSchedule
} from '@/lib/db/repository';
import { clearAllData } from '@/lib/db/seed';
import {
  UniversitySchema,
  ProfessorSchema,
  SubjectSchema,
  ScheduleSchema,
  validateEntity
} from '@/lib/validations/schemas';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Building2,
  UserCheck,
  Plus,
  Mail,
  Trash2,
  Edit3,
  GraduationCap,
  BookOpen,
  Calendar,
  RotateCcw
} from 'lucide-react';

export const ConfigDashboard: React.FC = () => {
  const { isLoaded, universities, professors, subjects, schedules } = usePureData();

  // Add Modal States
  const [isAddUniOpen, setIsAddUniOpen] = useState(false);
  const [isAddProfOpen, setIsAddProfOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);

  // Edit Modal States
  const [editingUni, setEditingUni] = useState<UniversityEntity | null>(null);
  const [editingProf, setEditingProf] = useState<ProfessorEntity | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectEntity | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEntity | null>(null);

  // Uni form
  const [uniName, setUniName] = useState('');
  const [uniModality, setUniModality] = useState<'presencial' | 'virtual' | 'hibrida'>('presencial');
  const [uniMin, setUniMin] = useState(0);
  const [uniMax, setUniMax] = useState(5);
  const [uniPassing, setUniPassing] = useState(3);
  const [uniHasAlternatingSaturdays, setUniHasAlternatingSaturdays] = useState(false);
  const [uniFirstSabadoADate, setUniFirstSabadoADate] = useState('');

  // Prof form
  const [profName, setProfName] = useState('');
  const [profUniId, setProfUniId] = useState('');
  const [profEmail, setProfEmail] = useState('');

  // Subject form
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subUniId, setSubUniId] = useState('');
  const [subProfId, setSubProfId] = useState('');
  const [subCredits, setSubCredits] = useState(3);
  const [subDifficulty, setSubDifficulty] = useState(3);
  const [subModality, setSubModality] = useState<'presencial' | 'virtual' | 'hibrida'>('presencial');
  const [subTargetGrade, setSubTargetGrade] = useState(4.5);

  // Schedule form
  const [schedSubjectId, setSchedSubjectId] = useState('');
  const [schedDay, setSchedDay] = useState(1);
  const [schedStart, setSchedStart] = useState('08:00');
  const [schedEnd, setSchedEnd] = useState('10:00');
  const [schedClassroom, setSchedClassroom] = useState('');
  const [schedPeriodicity, setSchedPeriodicity] = useState<'semanal' | 'sabado_a' | 'sabado_b'>('semanal');

  // Form Error States
  const [uniErrors, setUniErrors] = useState<Record<string, string>>({});
  const [profErrors, setProfErrors] = useState<Record<string, string>>({});
  const [subErrors, setSubErrors] = useState<Record<string, string>>({});
  const [schedErrors, setSchedErrors] = useState<Record<string, string>>({});

  if (!isLoaded) {
    return (
      <div className="space-y-8 animate-pulse pb-16" role="status" aria-label="Cargando directorio">
        <div className="h-16 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  const handleClearAllData = () => {
    const confirmed = window.confirm(
      'Esto eliminará permanentemente todas tus universidades, profesores, materias, horarios, temarios y entregas guardados en este dispositivo. Esta acción no se puede deshacer. ¿Continuar?'
    );
    if (confirmed) {
      clearAllData();
    }
  };

  // --- UNIVERSITY HANDLERS ---
  const openAddUni = () => {
    setUniName('');
    setUniModality('presencial');
    setUniMin(0);
    setUniMax(5);
    setUniPassing(3);
    setUniHasAlternatingSaturdays(false);
    setUniFirstSabadoADate('');
    setUniErrors({});
    setIsAddUniOpen(true);
  };

  const openEditUni = (uni: UniversityEntity) => {
    setEditingUni(uni);
    setUniName(uni.name);
    setUniModality(uni.modality);
    setUniMin(uni.scale_min);
    setUniMax(uni.scale_max);
    setUniPassing(uni.passing_grade);
    setUniHasAlternatingSaturdays(uni.has_alternating_saturdays ?? false);
    setUniFirstSabadoADate(uni.first_sabado_a_date || '');
    setUniErrors({});
  };

  const handleSaveUni = async () => {
    const uniData = {
      name: uniName,
      modality: uniModality,
      scale_min: Number(uniMin),
      scale_max: Number(uniMax),
      passing_grade: Number(uniPassing),
      color: uniModality === 'presencial' ? '#0ea5e9' : '#6366f1',
      has_alternating_saturdays: uniHasAlternatingSaturdays,
      first_sabado_a_date: uniHasAlternatingSaturdays ? uniFirstSabadoADate : undefined,
    };

    const validation = validateEntity(UniversitySchema, uniData);
    if (!validation.success) {
      setUniErrors(validation.errors);
      return;
    }

    setUniErrors({});
    if (editingUni && editingUni.id) {
      await saveUniversity({
        ...editingUni,
        ...validation.data,
      });
      setEditingUni(null);
    } else {
      await saveUniversity({
        ...validation.data,
        color: validation.data.color || (uniModality === 'presencial' ? '#0ea5e9' : '#6366f1'),
        created_at: new Date().toISOString(),
      });
      setIsAddUniOpen(false);
    }
  };

  const handleDeleteUni = async (id: string) => {
    await deleteUniversity(id);
  };

  // --- PROFESSOR HANDLERS ---
  const openAddProf = () => {
    setProfName('');
    setProfUniId(universities[0]?.id || '');
    setProfEmail('');
    setProfErrors({});
    setIsAddProfOpen(true);
  };

  const openEditProf = (prof: ProfessorEntity) => {
    setEditingProf(prof);
    setProfName(prof.name);
    setProfUniId(prof.university_id);
    setProfEmail(prof.email || '');
    setProfErrors({});
  };

  const handleSaveProf = async () => {
    const profData = {
      university_id: profUniId,
      name: profName,
      email: profEmail,
    };

    const validation = validateEntity(ProfessorSchema, profData);
    if (!validation.success) {
      setProfErrors(validation.errors);
      return;
    }

    setProfErrors({});
    if (editingProf && editingProf.id) {
      await saveProfessor({
        ...editingProf,
        ...validation.data,
        id: editingProf.id,
      });
      setEditingProf(null);
    } else {
      await saveProfessor(validation.data);
      setIsAddProfOpen(false);
    }
  };

  const handleDeleteProf = async (id: string) => {
    await deleteProfessor(id);
  };

  // --- SUBJECT HANDLERS ---
  const openAddSubject = () => {
    setSubName('');
    setSubCode('');
    setSubUniId(universities[0]?.id || '');
    setSubProfId('');
    setSubCredits(3);
    setSubDifficulty(3);
    setSubModality('presencial');
    setSubTargetGrade(4.5);
    setSubErrors({});
    setIsAddSubjectOpen(true);
  };

  const openEditSubject = (sub: SubjectEntity) => {
    setEditingSubject(sub);
    setSubName(sub.name);
    setSubCode(sub.code || '');
    setSubUniId(sub.university_id);
    setSubProfId(sub.professor_id || '');
    setSubCredits(sub.credits);
    setSubDifficulty(sub.difficulty);
    setSubModality(sub.modality);
    setSubTargetGrade(sub.target_grade);
    setSubErrors({});
  };

  const handleSaveSubject = async () => {
    const subData = {
      university_id: subUniId,
      professor_id: subProfId || undefined,
      name: subName,
      code: subCode || 'MAT-101',
      credits: Number(subCredits),
      difficulty: Number(subDifficulty),
      modality: subModality,
      target_grade: Number(subTargetGrade),
      current_grade: editingSubject ? editingSubject.current_grade : 0,
    };

    const validation = validateEntity(SubjectSchema, subData);
    if (!validation.success) {
      setSubErrors(validation.errors);
      return;
    }

    setSubErrors({});
    if (editingSubject && editingSubject.id) {
      await saveSubject({
        ...editingSubject,
        ...validation.data,
        id: editingSubject.id,
      });
      setEditingSubject(null);
    } else {
      await saveSubject({
        ...validation.data,
        modality: validation.data.modality || subModality || 'presencial',
        target_grade: validation.data.target_grade ?? Number(subTargetGrade) ?? 3.0,
        current_grade: validation.data.current_grade ?? 0,
      });
      setIsAddSubjectOpen(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    await deleteSubject(id);
  };

  // --- SCHEDULE HANDLERS ---
  const openAddSchedule = () => {
    setSchedSubjectId(subjects[0]?.id || '');
    setSchedDay(1);
    setSchedStart('08:00');
    setSchedEnd('10:00');
    setSchedClassroom('');
    setSchedPeriodicity('semanal');
    setSchedErrors({});
    setIsAddScheduleOpen(true);
  };

  const openEditSchedule = (sched: ScheduleEntity) => {
    setEditingSchedule(sched);
    setSchedSubjectId(sched.subject_id);
    setSchedDay(sched.day_of_week);
    setSchedStart(sched.start_time);
    setSchedEnd(sched.end_time);
    setSchedClassroom(sched.classroom || '');
    setSchedPeriodicity(sched.periodicity || 'semanal');
    setSchedErrors({});
  };

  const handleSaveSchedule = async () => {
    const schedData = {
      subject_id: schedSubjectId,
      day_of_week: Number(schedDay),
      start_time: schedStart,
      end_time: schedEnd,
      classroom: schedClassroom || 'Aula por definir',
      periodicity: Number(schedDay) === 6 ? schedPeriodicity : 'semanal',
    };

    const validation = validateEntity(ScheduleSchema, schedData);
    if (!validation.success) {
      setSchedErrors(validation.errors);
      return;
    }

    setSchedErrors({});
    if (editingSchedule && editingSchedule.id) {
      await saveSchedule({
        ...editingSchedule,
        ...validation.data,
        id: editingSchedule.id,
      });
      setEditingSchedule(null);
    } else {
      await saveSchedule(validation.data);
      setIsAddScheduleOpen(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    await deleteSchedule(id);
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500 transition-colors';

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-heading font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            Configuración & Directorio Base (CRUD Completo)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Administra y edita universidades, profesores, asignaturas y clases guardados en tu base de datos local.
          </p>
        </div>
        <Button variant="danger" size="sm" className="w-full sm:w-auto" onClick={handleClearAllData}>
          <RotateCcw className="w-3.5 h-3.5" /> Limpiar Todo
        </Button>
      </div>

      {/* 1. Universidades Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            Universidades ({universities.length})
          </h3>
          <Button variant="aeroespacial" size="sm" className="w-full sm:w-auto" onClick={openAddUni}>
            <Plus className="w-3.5 h-3.5" /> Agregar Universidad
          </Button>
        </div>

        {universities.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <GraduationCap className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No hay universidades registradas</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-md mx-auto">
              Crea tu primera universidad para comenzar a organizar tus carreras y asignaturas.
            </p>
            <Button variant="aeroespacial" size="sm" className="mt-4" onClick={openAddUni}>
              <Plus className="w-3.5 h-3.5" /> Crear Universidad
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {universities.map((uni) => (
              <Card key={uni.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-slate-950"
                      style={{ backgroundColor: uni.color || '#38bdf8' }}
                    >
                      {uni.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">{uni.name}</h4>
                      <Badge variant={uni.modality === 'presencial' ? 'aeroespacial' : 'software'} className="mt-1">
                        Modalidad {uni.modality}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditUni(uni)}
                      aria-label={`Editar ${uni.name}`}
                      className="text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                      title="Editar Universidad"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUni(uni.id!)}
                      aria-label={`Eliminar ${uni.name}`}
                      className="text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                      title="Eliminar Universidad"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-center text-xs font-mono">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">Min</div>
                    <div className="text-slate-800 dark:text-slate-200 font-bold">{uni.scale_min.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">Max</div>
                    <div className="text-slate-800 dark:text-slate-200 font-bold">{uni.scale_max.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">Aprobatorio</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold">{uni.passing_grade.toFixed(1)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 2. Profesores Directory Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            Directorio de Profesores ({professors.length})
          </h3>
          <Button
            variant="primary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={openAddProf}
            disabled={universities.length === 0}
          >
            <Plus className="w-3.5 h-3.5" /> Registrar Profesor
          </Button>
        </div>

        {professors.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <UserCheck className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No hay profesores registrados</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              {universities.length === 0
                ? 'Registra primero una Universidad para vincular profesores.'
                : 'Agrega a los profesores a cargo de tus asignaturas.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {professors.map((prof) => {
              const uni = universities.find((u) => u.id === prof.university_id);
              return (
                <Card key={prof.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {prof.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{prof.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" /> {prof.email || 'Sin correo registrado'}
                      </p>
                      <span className="text-[11px] text-sky-600 dark:text-sky-400 mt-0.5 block">
                        {uni?.name || 'Universidad'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditProf(prof)}
                      aria-label={`Editar ${prof.name}`}
                      className="text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                      title="Editar Profesor"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProf(prof.id!)}
                      aria-label={`Eliminar ${prof.name}`}
                      className="text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                      title="Eliminar Profesor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Materias / Asignaturas Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Asignaturas / Materias ({subjects.length})
          </h3>
          <Button
            variant="aeroespacial"
            size="sm"
            className="w-full sm:w-auto"
            onClick={openAddSubject}
            disabled={universities.length === 0}
          >
            <Plus className="w-3.5 h-3.5" /> Registrar Materia
          </Button>
        </div>

        {subjects.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <BookOpen className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No hay materias registradas</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-md mx-auto">
              Registra tus asignaturas para ver el horario unificado, calcular tu Dosis Mínima Eficaz (DME) y buscar sinergias.
            </p>
            <Button
              variant="aeroespacial"
              size="sm"
              className="mt-4"
              onClick={openAddSubject}
              disabled={universities.length === 0}
            >
              <Plus className="w-3.5 h-3.5" /> Registrar Primera Materia
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjects.map((sub) => {
              const uni = universities.find((u) => u.id === sub.university_id);
              const prof = professors.find((p) => p.id === sub.professor_id);
              const subSchedules = schedules.filter((s) => s.subject_id === sub.id);

              return (
                <Card key={sub.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold">{sub.code}</span>
                        <Badge variant={sub.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                          {sub.modality}
                        </Badge>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">{sub.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {uni?.name} {prof ? `• Profe: ${prof.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditSubject(sub)}
                        aria-label={`Editar ${sub.name}`}
                        className="text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                        title="Editar Materia"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(sub.id!)}
                        aria-label={`Eliminar ${sub.name}`}
                        className="text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                        title="Eliminar Materia"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1 gap-x-3 sm:flex sm:items-center sm:justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2 font-mono">
                    <span>Créditos: {sub.credits}</span>
                    <span>Dificultad: {sub.difficulty}/5</span>
                    <span>Nota Meta: {sub.target_grade}</span>
                    <span>{subSchedules.length} Horarios</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Horarios de Clases Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            Horarios Semanales Registrados ({schedules.length})
          </h3>
          <Button
            variant="primary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={openAddSchedule}
            disabled={subjects.length === 0}
          >
            <Plus className="w-3.5 h-3.5" /> Asignar Horario
          </Button>
        </div>

        {schedules.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No hay horarios asignados</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Asigna los días, horas y salones de tus asignaturas para generar tu Master Schedule.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {schedules.map((sched) => {
              const sub = subjects.find((s) => s.id === sched.subject_id);
              const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

              return (
                <Card key={sched.id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-200">{sub?.name || 'Materia'}</div>
                    <div className="text-[11px] text-sky-600 dark:text-sky-400 font-mono mt-0.5">
                      {days[sched.day_of_week]} • {sched.start_time} - {sched.end_time}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{sched.classroom}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditSchedule(sched)}
                      aria-label={`Editar horario de ${sub?.name || 'materia'}`}
                      className="text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                      title="Editar Horario"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(sched.id!)}
                      aria-label={`Eliminar horario de ${sub?.name || 'materia'}`}
                      className="text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                      title="Eliminar Horario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Add / Edit University */}
      <Modal
        isOpen={isAddUniOpen || editingUni !== null}
        onClose={() => {
          setIsAddUniOpen(false);
          setEditingUni(null);
        }}
        title={editingUni ? `Editar Universidad: ${editingUni.name}` : 'Configurar Nueva Universidad'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nombre de la Institución</label>
            <input
              type="text"
              value={uniName}
              onChange={(e) => setUniName(e.target.value)}
              className={inputClass}
              placeholder="Ej: Universidad EAFIT"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Modalidad</label>
            <select
              value={uniModality}
              onChange={(e) => setUniModality(e.target.value as any)}
              className={inputClass}
            >
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
              <option value="hibrida">Híbrida</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Escala Min</label>
              <input
                type="number"
                value={uniMin}
                onChange={(e) => setUniMin(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Escala Max</label>
              <input
                type="number"
                value={uniMax}
                onChange={(e) => setUniMax(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Aprobación</label>
              <input
                type="number"
                value={uniPassing}
                onChange={(e) => setUniPassing(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={uniHasAlternatingSaturdays}
                onChange={(e) => setUniHasAlternatingSaturdays(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-700 focus:ring-sky-500 dark:bg-slate-900"
              />
              <span>¿Maneja sábados alternos (quincenal)?</span>
            </label>

            {uniHasAlternatingSaturdays && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Fecha del primer Sábado A
                </label>
                <input
                  type="date"
                  value={uniFirstSabadoADate}
                  onChange={(e) => setUniFirstSabadoADate(e.target.value)}
                  className={inputClass}
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Fecha de referencia de un sábado donde se dicta la clase Sábado A. A partir de esta fecha se calcula la alternancia.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => { setIsAddUniOpen(false); setEditingUni(null); }}>
              Cancelar
            </Button>
            <Button
              variant="aeroespacial"
              className="w-full sm:w-auto"
              onClick={handleSaveUni}
              disabled={!uniName.trim()}
            >
              {editingUni ? 'Guardar Cambios' : 'Guardar Universidad'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add / Edit Professor */}
      <Modal
        isOpen={isAddProfOpen || editingProf !== null}
        onClose={() => {
          setIsAddProfOpen(false);
          setEditingProf(null);
        }}
        title={editingProf ? `Editar Profesor: ${editingProf.name}` : 'Registrar Nuevo Profesor'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nombre Completo</label>
            <input
              type="text"
              value={profName}
              onChange={(e) => setProfName(e.target.value)}
              className={inputClass}
              placeholder="Ej: Dr. Carlos Pérez"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Universidad Asignada</label>
            <select
              value={profUniId}
              onChange={(e) => setProfUniId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona una universidad</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={profEmail}
              onChange={(e) => setProfEmail(e.target.value)}
              className={inputClass}
              placeholder="cperez@universidad.edu"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => { setIsAddProfOpen(false); setEditingProf(null); }}>
              Cancelar
            </Button>
            <Button
              variant="synergy"
              className="w-full sm:w-auto"
              onClick={handleSaveProf}
              disabled={!profName.trim() || !profUniId}
            >
              {editingProf ? 'Guardar Cambios' : 'Guardar Profesor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add / Edit Subject */}
      <Modal
        isOpen={isAddSubjectOpen || editingSubject !== null}
        onClose={() => {
          setIsAddSubjectOpen(false);
          setEditingSubject(null);
        }}
        title={editingSubject ? `Editar Asignatura: ${editingSubject.name}` : 'Registrar Nueva Asignatura'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nombre de la Materia</label>
            <input
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              className={inputClass}
              placeholder="Ej: Cálculo Vectorial y Geometría"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Código</label>
              <input
                type="text"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                className={inputClass}
                placeholder="MAT-201"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Universidad</label>
              <select
                value={subUniId}
                onChange={(e) => setSubUniId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecciona institución</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Profesor Asignado</label>
              <select
                value={subProfId}
                onChange={(e) => setSubProfId(e.target.value)}
                className={inputClass}
              >
                <option value="">Sin profesor asignado</option>
                {professors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Modalidad</label>
              <select
                value={subModality}
                onChange={(e) => setSubModality(e.target.value as any)}
                className={inputClass}
              >
                <option value="presencial">Presencial</option>
                <option value="virtual">Virtual</option>
                <option value="hibrida">Híbrida</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Créditos</label>
              <input
                type="number"
                value={subCredits}
                onChange={(e) => setSubCredits(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Dificultad (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={subDifficulty}
                onChange={(e) => setSubDifficulty(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nota Meta</label>
              <input
                type="number"
                step="0.1"
                value={subTargetGrade}
                onChange={(e) => setSubTargetGrade(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => { setIsAddSubjectOpen(false); setEditingSubject(null); }}>
              Cancelar
            </Button>
            <Button
              variant="aeroespacial"
              className="w-full sm:w-auto"
              onClick={handleSaveSubject}
              disabled={!subName.trim() || !subUniId}
            >
              {editingSubject ? 'Guardar Cambios' : 'Guardar Materia'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add / Edit Schedule */}
      <Modal
        isOpen={isAddScheduleOpen || editingSchedule !== null}
        onClose={() => {
          setIsAddScheduleOpen(false);
          setEditingSchedule(null);
        }}
        title={editingSchedule ? 'Editar Horario' : 'Asignar Horario a Materia'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Asignatura</label>
            <select
              value={schedSubjectId}
              onChange={(e) => setSchedSubjectId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona una asignatura</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Día</label>
              <select
                value={schedDay}
                onChange={(e) => setSchedDay(Number(e.target.value))}
                className={inputClass}
              >
                <option value={1}>Lunes</option>
                <option value={2}>Martes</option>
                <option value={3}>Miércoles</option>
                <option value={4}>Jueves</option>
                <option value={5}>Viernes</option>
                <option value={6}>Sábado</option>
                <option value={7}>Domingo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Hora Inicio</label>
              <input
                type="text"
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
                className={inputClass}
                placeholder="08:00"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Hora Fin</label>
              <input
                type="text"
                value={schedEnd}
                onChange={(e) => setSchedEnd(e.target.value)}
                className={inputClass}
                placeholder="10:00"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Aula / Salón / Enlace</label>
            <input
              type="text"
              value={schedClassroom}
              onChange={(e) => setSchedClassroom(e.target.value)}
              className={inputClass}
              placeholder="Ej: Aula 2-305"
            />
          </div>

          {(() => {
            const selSub = subjects.find((s) => s.id === schedSubjectId);
            const selUni = universities.find((u) => u.id === selSub?.university_id);
            const showPeriodicity = Number(schedDay) === 6 && (selUni?.has_alternating_saturdays ?? true);
            if (!showPeriodicity) return null;
            return (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Periodicidad Sábado</label>
                <select
                  value={schedPeriodicity}
                  onChange={(e) => setSchedPeriodicity(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="semanal">Semanal (Todos los sábados)</option>
                  <option value="sabado_a">Sábado A (Quincenal)</option>
                  <option value="sabado_b">Sábado B (Quincenal)</option>
                </select>
              </div>
            );
          })()}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => { setIsAddScheduleOpen(false); setEditingSchedule(null); }}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              onClick={handleSaveSchedule}
              disabled={!schedSubjectId || !schedStart.trim() || !schedEnd.trim()}
            >
              {editingSchedule ? 'Guardar Cambios' : 'Guardar Horario'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
