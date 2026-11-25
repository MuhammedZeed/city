import React from 'react';
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Globe2,
  Hammer,
  Headphones,
  Lock,
  ShieldAlert,
  Store,
  Users,
} from 'lucide-react';
import { QUESTS_CATALOG } from '../data/gameData';
import { getMainBuildingLevel, isQuestConditionMet } from '../engine/gameEngine';
import { GameState, NavSection } from '../types/game';

interface SidebarNavProps {
  state: GameState;
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

interface NavGroup {
  title: string;
  items: {
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    unlockMainLv?: number;
  }[];
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  state,
  activeSection,
  onSelectSection,
}) => {
  const mainLv = getMainBuildingLevel(state);
  const unreadReports = state.reports.filter((r) => !r.read).length;
  const unreadSupport = state.supportTickets.filter((t) => t.unreadByPlayer).length;
  const claimableQuests = QUESTS_CATALOG.filter(
    (q) => !state.questClaims[q.id] && isQuestConditionMet(state, q.id)
  ).length;

  const groups: NavGroup[] = [
    {
      title: 'إدارة المدينة',
      items: [
        { id: 'city', label: 'خريطة المدينة', icon: Building2 },
        { id: 'build', label: 'البناء والتطوير', icon: Hammer },
        { id: 'military', label: 'الجيش والدفاع', icon: ShieldAlert },
        { id: 'research', label: 'الأبحاث والتقنية', icon: FlaskConical, unlockMainLv: 6 },
      ],
    },
    {
      title: 'العالم والتجارة',
      items: [
        { id: 'world_map', label: 'خريطة العالم', icon: Globe2 },
        { id: 'alliances', label: 'التحالفات', icon: Users, unlockMainLv: 3 },
        { id: 'market', label: 'سوق التجارة', icon: Store, unlockMainLv: 10 },
      ],
    },
    {
      title: 'المتابعة والدعم',
      items: [
        { id: 'quests', label: 'المهام اليومية', icon: ClipboardCheck, badge: claimableQuests },
        { id: 'reports', label: 'التقارير', icon: FileText, badge: unreadReports },
        { id: 'stats', label: 'إحصائيات المدينة', icon: BarChart3 },
        { id: 'support', label: 'الدعم والتذاكر', icon: Headphones, badge: unreadSupport },
      ],
    },
  ];

  return (
    <nav
      aria-label="القائمة الجانبية"
      className="w-full md:w-52 lg:w-56 [@media(max-height:500px)]:md:w-44 shrink-0 bg-[#0A1120] border-b md:border-b-0 md:border-l border-slate-800/90 flex md:flex-col overflow-x-auto md:overflow-y-auto no-scrollbar px-2 py-1.5 sm:p-2.5 [@media(max-height:500px)]:py-1 gap-2 sm:gap-3"
    >
      {groups.map((group) => (
        <div
          key={group.title}
          className="flex md:flex-col items-center md:items-stretch gap-1 shrink-0"
        >
          <div className="hidden md:block px-2.5 pt-1 pb-0.5 text-[10px] font-bold text-slate-500">
            {group.title}
          </div>

          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isLocked = item.unlockMainLv !== undefined && mainLv < item.unlockMainLv;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`min-h-[40px] md:min-h-[40px] [@media(max-height:500px)]:min-h-[36px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-gradient-to-l from-[#1D4ED8] to-[#1E40AF] border-blue-400/50 text-white shadow-md shadow-blue-950/50'
                    : 'border-transparent text-slate-300 hover:bg-slate-800/75 hover:text-amber-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-amber-300' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>

                {item.badge !== undefined && item.badge > 0 ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-num font-bold rounded-md bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                ) : isLocked ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-num text-slate-500">
                    <Lock className="w-3 h-3 shrink-0" />
                    <span className="hidden sm:inline">رئيسي {item.unlockMainLv}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
};
