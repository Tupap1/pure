'use client';

import React from 'react';
import { useSyncEngine } from '@/lib/hooks/useSyncEngine';
import { Shell } from '@/components/layout/Shell';
import { TodayDashboard } from '@/components/dashboards/TodayDashboard';
import { CommandCenter } from '@/components/dashboards/CommandCenter';
import { SyllabusDashboard } from '@/components/dashboards/SyllabusDashboard';
import { ScheduleDashboard } from '@/components/dashboards/ScheduleDashboard';
import { DeliverablesDashboard } from '@/components/dashboards/DeliverablesDashboard';
import { ClassSessionsDashboard } from '@/components/dashboards/ClassSessionsDashboard';
import { WeekView } from '@/components/dashboards/WeekView';
import { ConfigDashboard } from '@/components/dashboards/ConfigDashboard';
import { SubjectsIndex } from '@/components/dashboards/SubjectsIndex';
import { SubjectHub } from '@/components/dashboards/SubjectHub';

export default function Home() {
  useSyncEngine(15000); // Sincroniza cada 15 segundos
  return (
    <Shell>
      {(view) => {
        // Superficies de detalle (drill-in): se anteponen al switch de pestañas.
        if (view.kind === 'subject') {
          return <SubjectHub subjectId={view.subjectId} />;
        }
        if (view.kind === 'subjects-index') {
          return <SubjectsIndex />;
        }

        switch (view.tab) {
          case 'hoy':
            return <TodayDashboard />;
          case 'command':
            return <CommandCenter />;
          case 'syllabus':
            return <SyllabusDashboard />;
          case 'schedule':
            return <ScheduleDashboard />;
          case 'deliverables':
            return <DeliverablesDashboard />;
          case 'sessions':
            return <ClassSessionsDashboard />;
          case 'semana':
            return <WeekView />;
          case 'config':
            return <ConfigDashboard />;
          default:
            return <TodayDashboard />;
        }
      }}
    </Shell>
  );
}
