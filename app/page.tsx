'use client';

import React from 'react';
import { Shell } from '@/components/layout/Shell';
import { CommandCenter } from '@/components/dashboards/CommandCenter';
import { SyllabusDashboard } from '@/components/dashboards/SyllabusDashboard';
import { ScheduleDashboard } from '@/components/dashboards/ScheduleDashboard';
import { DeliverablesDashboard } from '@/components/dashboards/DeliverablesDashboard';
import { ConfigDashboard } from '@/components/dashboards/ConfigDashboard';

export default function Home() {
  return (
    <Shell>
      {(activeTab) => {
        switch (activeTab) {
          case 'command':
            return <CommandCenter />;
          case 'syllabus':
            return <SyllabusDashboard />;
          case 'schedule':
            return <ScheduleDashboard />;
          case 'deliverables':
            return <DeliverablesDashboard />;
          case 'config':
            return <ConfigDashboard />;
          default:
            return <CommandCenter />;
        }
      }}
    </Shell>
  );
}
