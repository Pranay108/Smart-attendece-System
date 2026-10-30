import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Camera,
  BarChart3,
  Compass,
  Bot,
  HelpCircle,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/students', label: 'Students', icon: Users },
    { to: '/sessions', label: 'Sessions', icon: CalendarDays },
    { to: '/media-processing', label: 'Media Processing', icon: Camera },
    { to: '/analytics', label: 'Attendance Analytics', icon: BarChart3 },
    { to: '/engagement', label: 'Engagement Indicators', icon: Compass },
    { to: '/agent', label: 'AI Attendance Agent', icon: Bot },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 min-h-[calc(100vh-65px)]">
      <div className="p-4 flex-1 space-y-1">
        <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase pb-1">
          Navigation
        </p>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 text-xs space-y-1 text-slate-600">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Faculty Note</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            All facial detections & matches require teacher confirmation. Corrections are recorded in the institutional audit log.
          </p>
        </div>
      </div>
    </aside>
  );
};
