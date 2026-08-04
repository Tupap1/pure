import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { pureDB } from '@/lib/db/dexie-schema';
import { clearAllData, seedDemoData } from '@/lib/db/seed';
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
  Sparkles
} from 'lucide-react';

export const ConfigDashboard: React.FC = () => {
  const { isLoaded, universities, professors, subjects, schedules } = usePureData();
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

  // Schedule form
  const [schedSubjectId, setSchedSubjectId] = useState('');
  const [schedDay, setSchedDay] = useState(1); // 1 = Lunes
  const [schedStart, setSchedStart] = useState('08:00');
  const [schedEnd, setSchedEnd] = useState('10:00');
  const [schedClassroom, setSchedClassroom] = useState('');

  if (!isLoaded) {
    return <div className="p-8 text-center text-slate-400 font-mono">Cargando directorio...</div>;
  }

  const handleAddUni = async () => {
    if (!uniName.trim()) return;

    await pureDB.universities.add({
      name: uniName,
      modality: uniModality,
      scale_min: Number(uniMin),
      scale_max: Number(uniMax),
      passing_grade: Number(uniPassing),
      color: uniModality === 'presencial' ? '#0ea5e9' : '#6366f1',
      created_at: new Date().toISOString(),
    });

    setUniName('');
    setIsAddUniOpen(false);
  };

  const handleDeleteUni = async (id: string) => {
    await pureDB.universities.delete(id);
  };

  const handleAddProf = async () => {
    if (!profName.trim() || !profUniId) return;

    await pureDB.professors.add({
      university_id: profUniId,
      name: profName,
      email: profEmail,
      created_at: new Date().toISOString(),
    });

    setProfName('');
    setIsAddProfOpen(false);
  };

  const handleDeleteProf = async (id: string) => {
    await pureDB.professors.delete(id);
  };

  const handleAddSubject = async () => {
    if (!subName.trim() || !subUniId) return;

    await pureDB.subjects.add({
      university_id: subUniId,
      professor_id: subProfId || undefined,
      name: subName,
      code: subCode || 'MAT-101',
      credits: Number(subCredits),
      difficulty: Number(subDifficulty),
      modality: subModality,
      target_grade: Number(subTargetGrade),
      current_grade: 0,
      created_at: new Date().toISOString(),
    });

    setSubName('');
    setSubCode('');
    setIsAddSubjectOpen(false);
  };

  const handleDeleteSubject = async (id: string) => {
    await pureDB.subjects.delete(id);
  };

  const handleAddSchedule = async () => {
    if (!schedSubjectId) return;

    await pureDB.schedules.add({
      subject_id: schedSubjectId,
      day_of_week: Number(schedDay),
      start_time: schedStart,
      end_time: schedEnd,
      classroom: schedClassroom || 'Aula por definir',
      created_at: new Date().toISOString(),
    });

    setIsAddScheduleOpen(false);
  };

  const handleDeleteSchedule = async (id: string) => {
    await pureDB.schedules.delete(id);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-sky-400" />
            Configuración & Directorio Base
          </h2>
          <p className="text-xs text-slate-400">
            Administra universidades, profesores, asignaturas y clases guardados en tu base de datos local (IndexedDB).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => clearAllData()}>
            <RotateCcw className="w-3.5 h-3.5" /> Limpiar Base de Datos
          </Button>

          <Button variant="primary" size="sm" onClick={() => seedDemoData()}>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Cargar Datos Demo
          </Button>
        </div>
      </div>

      {/* 1. Universidades Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-sky-400" />
            Universidades ({universities.length})
          </h3>
          <Button variant="aeroespacial" size="sm" onClick={() => setIsAddUniOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Agregar Universidad
          </Button>
        </div>

        {universities.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-800 bg-slate-950/40">
            <GraduationCap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No hay universidades registradas</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
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
                      <h4 className="text-base font-bold text-slate-100">{uni.name}</h4>
                      <Badge variant={uni.modality === 'presencial' ? 'aeroespacial' : 'software'} className="mt-1">
                        Modalidad {uni.modality}
                      </Badge>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteUni(uni.id!)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-900/80 text-center text-xs font-mono">
                  <div>
                    <div className="text-slate-400 text-[10px]">Min</div>
                    <div className="text-slate-200 font-bold">{uni.scale_min.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Max</div>
                    <div className="text-slate-200 font-bold">{uni.scale_max.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Aprobatorio</div>
                    <div className="text-emerald-400 font-bold">{uni.passing_grade.toFixed(1)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 2. Profesores Directory Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            Directorio de Profesores ({professors.length})
          </h3>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddProfOpen(true)}
            disabled={universities.length === 0}
          >
            <Plus className="w-3.5 h-3.5" /> Registrar Profesor
          </Button>
        </div>

        {professors.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-slate-800 bg-slate-950/40">
            <UserCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No hay profesores registrados</p>
            <p className="text-xs text-slate-500 mt-1">
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
                    <div className="w-9 h-9 rounded-lg bg-slate-800 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {prof.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{prof.name}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-500" /> {prof.email || 'Sin correo registrado'}
                      </p>
                      <span className="text-[11px] text-sky-400 mt-0.5 block">
                        {uni?.name || 'Universidad'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteProf(prof.id!)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Materias / Asignaturas Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            Asignaturas / Materias ({subjects.length})
          </h3>
          <Button
            variant="aeroespacial"
            size="sm"
            onClick={() => setIsAddSubjectOpen(true)}
            disabled={universities.length === 0}
          >
            <Plus className="w-3.5 h-3.5" /> Registrar Materia
          </Button>
        </div>

        {subjects.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-800 bg-slate-950/40">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No hay materias registradas</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Registra tus asignaturas para ver el horario unificado, calcular tu Dosis Mínima Eficaz (DME) y buscar sinergias.
            </p>
            <Button
              variant="aeroespacial"
              size="sm"
              className="mt-4"
              onClick={() => setIsAddSubjectOpen(true)}
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
                        <span className="text-xs font-mono text-sky-400 font-bold">{sub.code}</span>
                        <Badge variant={sub.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                          {sub.modality}
                        </Badge>
                      </div>
                      <h4 className="text-base font-bold text-slate-100 mt-1">{sub.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {uni?.name} {prof ? `• Profe: ${prof.name}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteSubject(sub.id!)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-2 font-mono">
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
          <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            Horarios Semanales Registrados ({schedules.length})
          </h3>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddScheduleOpen(true)}
            disabled={subjects.length === 0}
          >
            <Plus className="w-3.5 h-3.5" /> Asignar Horario
          </Button>
        </div>

        {schedules.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-slate-800 bg-slate-950/40">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No hay horarios asignados</p>
            <p className="text-xs text-slate-500 mt-1">
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
                    <div className="text-xs font-bold text-slate-200">{sub?.name || 'Materia'}</div>
                    <div className="text-[11px] text-sky-400 font-mono mt-0.5">
                      {days[sched.day_of_week]} • {sched.start_time} - {sched.end_time}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{sched.classroom}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteSchedule(sched.id!)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Add University */}
      <Modal
        isOpen={isAddUniOpen}
        onClose={() => setIsAddUniOpen(false)}
        title="Configurar Nueva Universidad"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Nombre de la Institución</label>
            <input
              type="text"
              value={uniName}
              onChange={(e) => setUniName(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Universidad EAFIT"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Modalidad</label>
            <select
              value={uniModality}
              onChange={(e) => setUniModality(e.target.value as any)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
              <option value="hibrida">Híbrida</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Escala Min</label>
              <input
                type="number"
                value={uniMin}
                onChange={(e) => setUniMin(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Escala Max</label>
              <input
                type="number"
                value={uniMax}
                onChange={(e) => setUniMax(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Aprobación</label>
              <input
                type="number"
                value={uniPassing}
                onChange={(e) => setUniPassing(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddUniOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleAddUni}>
              Guardar Universidad
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add Professor */}
      <Modal
        isOpen={isAddProfOpen}
        onClose={() => setIsAddProfOpen(false)}
        title="Registrar Nuevo Profesor"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Nombre Completo</label>
            <input
              type="text"
              value={profName}
              onChange={(e) => setProfName(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Dr. Carlos Pérez"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Universidad Asignada</label>
            <select
              value={profUniId}
              onChange={(e) => setProfUniId(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
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
            <label className="text-xs font-semibold text-slate-300 block mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={profEmail}
              onChange={(e) => setProfEmail(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="cperez@universidad.edu"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddProfOpen(false)}>
              Cancelar
            </Button>
            <Button variant="synergy" onClick={handleAddProf}>
              Guardar Profesor
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add Subject */}
      <Modal
        isOpen={isAddSubjectOpen}
        onClose={() => setIsAddSubjectOpen(false)}
        title="Registrar Nueva Asignatura"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Nombre de la Materia</label>
            <input
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Cálculo Vectorial y Geometría"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Código</label>
              <input
                type="text"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                placeholder="MAT-201"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Universidad</label>
              <select
                value={subUniId}
                onChange={(e) => setSubUniId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Profesor Asignado</label>
              <select
                value={subProfId}
                onChange={(e) => setSubProfId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Modalidad</label>
              <select
                value={subModality}
                onChange={(e) => setSubModality(e.target.value as any)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="presencial">Presencial</option>
                <option value="virtual">Virtual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Créditos</label>
              <input
                type="number"
                value={subCredits}
                onChange={(e) => setSubCredits(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Dificultad (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={subDifficulty}
                onChange={(e) => setSubDifficulty(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Nota Meta</label>
              <input
                type="number"
                step="0.1"
                value={subTargetGrade}
                onChange={(e) => setSubTargetGrade(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddSubjectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleAddSubject}>
              Guardar Materia
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add Schedule */}
      <Modal
        isOpen={isAddScheduleOpen}
        onClose={() => setIsAddScheduleOpen(false)}
        title="Asignar Horario a Materia"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Asignatura</label>
            <select
              value={schedSubjectId}
              onChange={(e) => setSchedSubjectId(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="">Selecciona una asignatura</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Día</label>
              <select
                value={schedDay}
                onChange={(e) => setSchedDay(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Hora Inicio</label>
              <input
                type="text"
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
                placeholder="08:00"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Hora Fin</label>
              <input
                type="text"
                value={schedEnd}
                onChange={(e) => setSchedEnd(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-sky-500"
                placeholder="10:00"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Aula / Salón / Enlace</label>
            <input
              type="text"
              value={schedClassroom}
              onChange={(e) => setSchedClassroom(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Salón 301 - Edificio Tecnológico"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddScheduleOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleAddSchedule}>
              Guardar Horario
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
