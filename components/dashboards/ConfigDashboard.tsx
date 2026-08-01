import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { pureDB } from '@/lib/db/dexie-schema';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Building2,
  UserCheck,
  Plus,
  Mail,
  Clock,
  Trash2,
  GraduationCap
} from 'lucide-react';

export const ConfigDashboard: React.FC = () => {
  const { isLoaded, universities, professors } = usePureData();
  const [isAddUniOpen, setIsAddUniOpen] = useState(false);
  const [isAddProfOpen, setIsAddProfOpen] = useState(false);

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
      color: uniModality === 'presencial' ? '#38bdf8' : '#a855f7',
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-slate-50 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-sky-400" />
            Universidades, Profesores & Asignaturas (CRUD Directory)
          </h2>
          <p className="text-xs text-slate-400">
            Crea y administra universidades, profesores y parámetros de materias directamente en IndexedDB.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="aeroespacial" onClick={() => setIsAddUniOpen(true)}>
            <Plus className="w-4 h-4" /> Agregar Universidad
          </Button>
        </div>
      </div>

      {/* Universities CRUD Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {universities.map((uni) => (
          <Card key={uni.id} className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-800 text-sky-400 border border-slate-700">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100 font-heading">{uni.name}</h3>
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

            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/60 text-center text-xs font-mono">
              <div>
                <div className="text-slate-400">Escala Min</div>
                <div className="text-slate-100 font-bold mt-0.5">{uni.scale_min.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-slate-400">Escala Max</div>
                <div className="text-slate-100 font-bold mt-0.5">{uni.scale_max.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-slate-400">Aprobación</div>
                <div className="text-emerald-400 font-bold mt-0.5">{uni.passing_grade.toFixed(1)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Professors Directory Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-400" />
            Directorio de Profesores Asignados
          </h3>
          <Button variant="primary" size="sm" onClick={() => setIsAddProfOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Registrar Profesor
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {professors.map((prof) => {
            const uni = universities.find((u) => u.id === prof.university_id);
            return (
              <Card key={prof.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-purple-400 flex items-center justify-center font-bold font-heading">
                    {prof.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{prof.name}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" /> {prof.email || 'Sin correo registrado'}
                    </p>
                    <span className="text-[11px] text-sky-400 mt-1 block">
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
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Universidad EAFIT"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Modalidad</label>
            <select
              value={uniModality}
              onChange={(e) => setUniModality(e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
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
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Escala Max</label>
              <input
                type="number"
                value={uniMax}
                onChange={(e) => setUniMax(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Aprobación</label>
              <input
                type="number"
                value={uniPassing}
                onChange={(e) => setUniPassing(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsAddUniOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleAddUni}>
              Guardar en IndexedDB
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
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              placeholder="Ej: Dr. Carlos Pérez"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Universidad Asignada</label>
            <select
              value={profUniId}
              onChange={(e) => setProfUniId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
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
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
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
    </div>
  );
};
