import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { pureDB } from '@/lib/db/dexie-schema';
import { clearAllData, seedDemoData } from '@/lib/db/seed';
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
  GraduationCap,
  BookOpen,
  Calendar,
  RotateCcw,
  Sparkles,
  Pencil
} from 'lucide-react';

export const ConfigDashboard: React.FC = () => {
  const { isLoaded, universities, professors, subjects, schedules } = usePureData();
  const [activeConfigTab, setActiveConfigTab] = useState<'universities' | 'subjects' | 'professors' | 'maintenance'>('universities');

  const [isAddUniOpen, setIsAddUniOpen] = useState(false);
  const [isAddProfOpen, setIsAddProfOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);

  // Uni form
  const [uniName, setUniName] = useState('');
  const [uniModality, setUniModality] = useState<'presencial' | 'virtual' | 'hibrida'>('presencial');
  const [uniMin, setUniMin] = useState(0);
  const [uniMax, setUniMax] = useState(5);
  const [uniPassing, setUniPassing] = useState(3);

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
  const [subModality, setSubModality] = useState<'presencial' | 'virtual'>('presencial');
  const [subTargetGrade, setSubTargetGrade] = useState(4.5);
  const [subMaxAbsences, setSubMaxAbsences] = useState(4);

  // Schedule form
  const [schedSubjectId, setSchedSubjectId] = useState('');
  const [schedDay, setSchedDay] = useState(1); // 1 = Lunes
  const [schedStart, setSchedStart] = useState('08:00');
  const [schedEnd, setSchedEnd] = useState('10:00');
  const [schedClassroom, setSchedClassroom] = useState('');

  // Editing IDs
  const [editingUniId, setEditingUniId] = useState<string | null>(null);
  const [editingProfId, setEditingProfId] = useState<string | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSchedId, setEditingSchedId] = useState<string | null>(null);

  // Form Error States
  const [uniErrors, setUniErrors] = useState<Record<string, string>>({});
  const [profErrors, setProfErrors] = useState<Record<string, string>>({});
  const [subErrors, setSubErrors] = useState<Record<string, string>>({});
  const [schedErrors, setSchedErrors] = useState<Record<string, string>>({});

  if (!isLoaded) {
    return <div className="p-8 text-center text-slate-400 font-mono">Cargando directorio...</div>;
  }

  // --- EDIT OPEN HANDLERS ---
  const handleOpenEditUni = (uni: any) => {
    setEditingUniId(uni.id);
    setUniName(uni.name);
    setUniModality(uni.modality);
    setUniMin(uni.scale_min);
    setUniMax(uni.scale_max);
    setUniPassing(uni.passing_grade);
    setIsAddUniOpen(true);
  };

  const handleOpenEditProf = (prof: any) => {
    setEditingProfId(prof.id);
    setProfName(prof.name);
    setProfUniId(prof.university_id);
    setProfEmail(prof.email || '');
    setIsAddProfOpen(true);
  };

  const handleOpenEditSubject = (sub: any) => {
    setEditingSubId(sub.id);
    setSubName(sub.name);
    setSubCode(sub.code || '');
    setSubUniId(sub.university_id);
    setSubProfId(sub.professor_id || '');
    setSubCredits(sub.credits || 3);
    setSubDifficulty(sub.difficulty || 3);
    setSubModality(sub.modality || 'presencial');
    setSubTargetGrade(sub.target_grade || 4.5);
    setSubMaxAbsences(sub.max_absences || 4);
    setIsAddSubjectOpen(true);
  };

  const handleOpenEditSchedule = (sched: any) => {
    setEditingSchedId(sched.id);
    setSchedSubjectId(sched.subject_id);
    setSchedDay(sched.day_of_week);
    setSchedStart(sched.start_time);
    setSchedEnd(sched.end_time);
    setSchedClassroom(sched.classroom || '');
    setIsAddScheduleOpen(true);
  };

  // --- SAVE HANDLERS (ADD OR UPDATE) ---
  const handleAddUni = async () => {
    const uniData = {
      name: uniName,
      modality: uniModality,
      scale_min: Number(uniMin),
      scale_max: Number(uniMax),
      passing_grade: Number(uniPassing),
      color: uniModality === 'presencial' ? '#0ea5e9' : '#6366f1',
    };

    const validation = validateEntity(UniversitySchema, uniData);
    if (!validation.success) {
      setUniErrors(validation.errors);
      return;
    }

    setUniErrors({});
    if (editingUniId) {
      await pureDB.universities.update(editingUniId, {
        ...validation.data,
        color: validation.data.color || (uniModality === 'presencial' ? '#0ea5e9' : '#6366f1'),
      });
    } else {
      await pureDB.universities.add({
        ...validation.data,
        color: validation.data.color || (uniModality === 'presencial' ? '#0ea5e9' : '#6366f1'),
        created_at: new Date().toISOString(),
      });
    }

    setUniName('');
    setEditingUniId(null);
    setIsAddUniOpen(false);
  };

  const handleDeleteUni = async (id: string) => {
    await pureDB.universities.delete(id);
  };

  const handleAddProf = async () => {
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
    if (editingProfId) {
      await pureDB.professors.update(editingProfId, validation.data);
    } else {
      await pureDB.professors.add({
        ...validation.data,
        created_at: new Date().toISOString(),
      });
    }

    setProfName('');
    setProfEmail('');
    setEditingProfId(null);
    setIsAddProfOpen(false);
  };

  const handleDeleteProf = async (id: string) => {
    await pureDB.professors.delete(id);
  };

  const handleAddSubject = async () => {
    const subData = {
      university_id: subUniId,
      professor_id: subProfId || undefined,
      name: subName,
      code: subCode || 'MAT-101',
      credits: Number(subCredits),
      difficulty: Number(subDifficulty),
      modality: subModality,
      target_grade: Number(subTargetGrade),
      max_absences: Number(subMaxAbsences),
      current_grade: 0,
    };

    const validation = validateEntity(SubjectSchema, subData);
    if (!validation.success) {
      setSubErrors(validation.errors);
      return;
    }

    setSubErrors({});
    const finalData = {
      ...validation.data,
      modality: (validation.data.modality === 'virtual' ? 'virtual' : 'presencial') as 'presencial' | 'virtual',
      target_grade: validation.data.target_grade ?? Number(subTargetGrade) ?? 3.0,
      current_grade: validation.data.current_grade ?? 0,
    };

    if (editingSubId) {
      await pureDB.subjects.update(editingSubId, finalData);
    } else {
      await pureDB.subjects.add({
        ...finalData,
        created_at: new Date().toISOString(),
      });
    }

    setSubName('');
    setSubCode('');
    setEditingSubId(null);
    setIsAddSubjectOpen(false);
  };

  const handleDeleteSubject = async (id: string) => {
    await pureDB.subjects.delete(id);
  };

  const handleAddSchedule = async () => {
    const schedData = {
      subject_id: schedSubjectId,
      day_of_week: Number(schedDay),
      start_time: schedStart,
      end_time: schedEnd,
      classroom: schedClassroom || 'Aula por definir',
    };

    const validation = validateEntity(ScheduleSchema, schedData);
    if (!validation.success) {
      setSchedErrors(validation.errors);
      return;
    }

    setSchedErrors({});
    if (editingSchedId) {
      await pureDB.schedules.update(editingSchedId, validation.data);
    } else {
      await pureDB.schedules.add({
        ...validation.data,
        created_at: new Date().toISOString(),
      });
    }

    setEditingSchedId(null);
    setIsAddScheduleOpen(false);
  };

  const handleDeleteSchedule = async (id: string) => {
    await pureDB.schedules.delete(id);
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500 transition-colors';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2 font-heading tracking-tight">
            <Building2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Configuración & Directorio Base
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => clearAllData()}>
            <RotateCcw className="w-3.5 h-3.5" /> Limpiar Todo
          </Button>

          <Button variant="software" size="sm" onClick={() => seedDemoData()}>
            <Sparkles className="w-3.5 h-3.5" /> Cargar Matrícula Demo
          </Button>
        </div>
      </div>

      {/* Segmented Sub-Tab Navigation (SaaS Settings Benchmark) */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveConfigTab('universities')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${
            activeConfigTab === 'universities'
              ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <GraduationCap className="w-4 h-4" /> Instituciones ({universities.length})
        </button>
        <button
          onClick={() => setActiveConfigTab('subjects')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${
            activeConfigTab === 'subjects'
              ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Asignaturas ({subjects.length})
        </button>
        <button
          onClick={() => setActiveConfigTab('professors')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${
            activeConfigTab === 'professors'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Docentes ({professors.length})
        </button>
        <button
          onClick={() => setActiveConfigTab('maintenance')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${
            activeConfigTab === 'maintenance'
              ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <RotateCcw className="w-4 h-4" /> Mantenimiento
        </button>
      </div>

      {/* 1. Universidades Section */}
      {activeConfigTab === 'universities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              Instituciones Universitarias ({universities.length})
            </h3>
            <Button variant="aeroespacial" size="sm" onClick={() => setIsAddUniOpen(true)}>
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
            <Button variant="aeroespacial" size="sm" className="mt-4" onClick={() => setIsAddUniOpen(true)}>
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditUni(uni)}
                      title="Editar universidad"
                      className="text-slate-400 hover:text-sky-500 transition-colors p-1"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUni(uni.id!)}
                      title="Eliminar universidad"
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
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
      )}

      {/* 2. Profesores Directory Section */}
      {activeConfigTab === 'professors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Directorio de Docentes ({professors.length})
            </h3>
          <Button
            variant="software"
            size="sm"
            onClick={() => {
              setEditingProfId(null);
              setProfName('');
              setProfEmail('');
              setIsAddProfOpen(true);
            }}
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditProf(prof)}
                      title="Editar profesor"
                      className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProf(prof.id!)}
                      title="Eliminar profesor"
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
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
      )}

      {/* 3. Asignaturas & Horarios Section */}
      {activeConfigTab === 'subjects' && (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Asignaturas / Materias ({subjects.length})
          </h3>
          <Button
            variant="aeroespacial"
            size="sm"
            onClick={() => {
              setEditingSubId(null);
              setSubName('');
              setSubCode('');
              setIsAddSubjectOpen(true);
            }}
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
              onClick={() => {
                setEditingSubId(null);
                setSubName('');
                setSubCode('');
                setIsAddSubjectOpen(true);
              }}
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditSubject(sub)}
                        title="Editar asignatura"
                        className="text-slate-400 hover:text-sky-500 transition-colors p-1"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(sub.id!)}
                        title="Eliminar asignatura"
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2 font-mono">
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
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Horarios Semanales Registrados ({schedules.length})
          </h3>
          <Button
            variant="software"
            size="sm"
            onClick={() => {
              setEditingSchedId(null);
              setIsAddScheduleOpen(true);
            }}
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditSchedule(sched)}
                      title="Editar horario"
                      className="text-slate-400 hover:text-amber-500 transition-colors p-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(sched.id!)}
                      title="Eliminar horario"
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

      {/* 4. Mantenimiento & Sistema Section */}
      {activeConfigTab === 'maintenance' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Mantenimiento & Acciones de Base de Datos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3 border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-500" /> Cargar Matrícula Demo (UdeA + UdeC)
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Puebla automáticamente la base de datos IndexedDB local con instituciones, asignaturas de doble ingeniería, docentes y horarios de prueba.
              </p>
              <Button variant="software" size="sm" onClick={() => seedDemoData()}>
                Cargar Datos Demo
              </Button>
            </Card>

            <Card className="p-5 space-y-3 border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-800 dark:text-rose-300">
                <Trash2 className="w-4 h-4 text-rose-500" /> Resetear Base de Datos Local
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Elimina permanentemente todos los registros locales guardados (universidades, asignaturas, entregables y horarios).
              </p>
              <Button variant="danger" size="sm" onClick={() => clearAllData()}>
                Vaciar Base de Datos
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* Modal Add / Edit University */}
      <Modal
        isOpen={isAddUniOpen}
        onClose={() => setIsAddUniOpen(false)}
        title={editingUniId ? 'Editar Universidad' : 'Configurar Nueva Universidad'}
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
            {uniErrors.name && <p className="text-xs text-rose-500 font-medium mt-1">{uniErrors.name}</p>}
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

          <div className="grid grid-cols-3 gap-3">
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
          {uniErrors.scale_max && <p className="text-xs text-rose-500 font-medium mt-1">{uniErrors.scale_max}</p>}
          {uniErrors.passing_grade && <p className="text-xs text-rose-500 font-medium mt-1">{uniErrors.passing_grade}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddUniOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleAddUni}>
              {editingUniId ? 'Guardar Cambios' : 'Guardar Universidad'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add / Edit Professor */}
      <Modal
        isOpen={isAddProfOpen}
        onClose={() => setIsAddProfOpen(false)}
        title={editingProfId ? 'Editar Profesor' : 'Registrar Nuevo Profesor'}
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
            {profErrors.name && <p className="text-xs text-rose-500 font-medium mt-1">{profErrors.name}</p>}
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
            {profErrors.university_id && <p className="text-xs text-rose-500 font-medium mt-1">{profErrors.university_id}</p>}
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
            {profErrors.email && <p className="text-xs text-rose-500 font-medium mt-1">{profErrors.email}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddProfOpen(false)}>
              Cancelar
            </Button>
            <Button variant="synergy" onClick={handleAddProf}>
              {editingProfId ? 'Guardar Cambios' : 'Guardar Profesor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add / Edit Subject */}
      <Modal
        isOpen={isAddSubjectOpen}
        onClose={() => setIsAddSubjectOpen(false)}
        title={editingSubId ? 'Editar Asignatura' : 'Registrar Nueva Asignatura'}
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
            {subErrors.name && <p className="text-xs text-rose-500 font-medium mt-1">{subErrors.name}</p>}
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
              {subErrors.code && <p className="text-xs text-rose-500 font-medium mt-1">{subErrors.code}</p>}
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
              {subErrors.university_id && <p className="text-xs text-rose-500 font-medium mt-1">{subErrors.university_id}</p>}
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
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Fallas Permisibles</label>
              <input
                type="number"
                min={0}
                max={20}
                value={subMaxAbsences}
                onChange={(e) => setSubMaxAbsences(Number(e.target.value))}
                className={inputClass}
                placeholder="4"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddSubjectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleAddSubject}>
              {editingSubId ? 'Guardar Cambios' : 'Guardar Materia'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add / Edit Schedule */}
      <Modal
        isOpen={isAddScheduleOpen}
        onClose={() => setIsAddScheduleOpen(false)}
        title={editingSchedId ? 'Editar Horario de Clase' : 'Asignar Horario a Materia'}
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
            {schedErrors.subject_id && <p className="text-xs text-rose-500 font-medium mt-1">{schedErrors.subject_id}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
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
              {schedErrors.start_time && <p className="text-xs text-rose-500 font-medium mt-1">{schedErrors.start_time}</p>}
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
              {schedErrors.end_time && <p className="text-xs text-rose-500 font-medium mt-1">{schedErrors.end_time}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Aula / Salón / Enlace</label>
            <input
              type="text"
              value={schedClassroom}
              onChange={(e) => setSchedClassroom(e.target.value)}
              className={inputClass}
              placeholder="Ej: Salón 301 - Edificio Tecnológico"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddScheduleOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleAddSchedule}>
              {editingSchedId ? 'Guardar Cambios' : 'Guardar Horario'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
