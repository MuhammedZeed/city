import React, { useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  Gem,
  Hammer,
  Shield,
  Target,
  Zap,
} from 'lucide-react';
import {
  BUILDINGS_META,
  QUESTS_CATALOG,
  RESEARCH_TREE,
  SPECIALIZATIONS,
  SPEEDUP_CARDS_META,
  UNITS_META,
} from '@enginora/shared';
import {
  formatDuration,
  formatNumber,
  getCityAttackPower,
  getCityDefensePower,
  getMaxBuildSlots,
  getMaxResearchSlots,
  getProductionRates,
  isQuestConditionMet,
} from '@enginora/shared';
import { GameState, NavSection, SpeedUpTierId } from '@enginora/shared';

interface BottomDockProps {
  state: GameState;
  now: number;
  onNavigate: (section: NavSection) => void;
  onClaimQuest: (questId: string) => void;
  onUseSpeedUp: (queueId: string, tierId: SpeedUpTierId) => void;
  onUseSpeedUpResearch?: (queueId: string, tierId: SpeedUpTierId) => void;
  onUseSpeedUpTraining?: (queueId: string, tierId: SpeedUpTierId) => void;
  onSpeedUpMarch?: (marchId: string, minutes: number) => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  state,
  now,
  onNavigate,
  onClaimQuest,
  onUseSpeedUp,
  onUseSpeedUpResearch,
  onUseSpeedUpTraining,
  onSpeedUpMarch,
}) => {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const maxBuild = getMaxBuildSlots(state);
  const maxRes = getMaxResearchSlots(state);
  const rates = getProductionRates(state);
  const totalRate = rates.wheat + rates.wood + rates.iron;
  const defPower = getCityDefensePower(state, now);
  const atkPower = getCityAttackPower(state, now);

  const firstAvailableSpeedUp = (Object.keys(SPEEDUP_CARDS_META) as SpeedUpTierId[]).find(
    (t) => (state.speedUpCards[t] ?? 0) > 0
  );

  // Pick next unclaimed quest or first claimable quest
  const priorityQuest =
    QUESTS_CATALOG.find(
      (q) => !state.questClaims[q.id] && isQuestConditionMet(state, q.id)
    ) ?? QUESTS_CATALOG.find((q) => !state.questClaims[q.id]);

  const questReady = priorityQuest
    ? isQuestConditionMet(state, priorityQuest.id)
    : false;

  const activeJobsCount =
    state.buildQueue.length +
    state.researchQueue.length +
    state.trainingQueue.length +
    state.marches.length;

  const hasActiveJobs = activeJobsCount > 0;

  const panelsContent = (
    <>
      {/* Panel 1: Active Operations (الأعمال الجارية) */}
      <div className="p-2.5 sm:p-3 rounded-xl glass-subpanel flex flex-col justify-between min-h-[76px]">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Hammer className="w-3.5 h-3.5 text-amber-400" />
            <span>الأعمال الجارية</span>
          </span>
          <span className="text-[11px] font-num text-slate-400">
            البناء {state.buildQueue.length}/{maxBuild} · الأبحاث {state.researchQueue.length}/{maxRes}
          </span>
        </div>

        {!hasActiveJobs ? (
          <div className="text-xs text-slate-400 flex items-center justify-between gap-2">
            <span>لا توجد أعمال بناء أو تحركات جارية حاليًا.</span>
            <button
              type="button"
              onClick={() => {
                setMobileExpanded(false);
                onNavigate('build');
              }}
              className="min-h-[34px] px-2.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 hover:text-amber-200 font-semibold whitespace-nowrap"
            >
              ابدأ البناء
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-24 lg:max-h-16 overflow-y-auto pr-0.5">
            {state.buildQueue.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-2 text-xs bg-slate-950/70 px-2.5 py-1.5 rounded-lg"
              >
                <span className="text-slate-200 truncate">
                  {BUILDINGS_META[job.buildingType].name} (مستوى {job.toLevel})
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-num text-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration((job.endsAt - now) / 1000)}
                  </span>
                  {firstAvailableSpeedUp && (
                    <button
                      type="button"
                      onClick={() => onUseSpeedUp(job.id, firstAvailableSpeedUp)}
                      title={`استخدام ${SPEEDUP_CARDS_META[firstAvailableSpeedUp].name}`}
                      className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 text-[10px] font-bold flex items-center gap-0.5"
                    >
                      <Zap className="w-2.5 h-2.5" />
                      <span>تسريع</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {state.researchQueue.map((rq) => {
              const tech = RESEARCH_TREE.find((t) => t.id === rq.techId);
              return (
                <div
                  key={rq.id}
                  className="flex items-center justify-between gap-2 text-xs bg-slate-950/70 px-2.5 py-1.5 rounded-lg"
                >
                  <span className="text-sky-200 truncate">
                    بحث: {tech?.name ?? rq.techId} ({rq.toLevel})
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-num text-sky-300">
                      {formatDuration((rq.endsAt - now) / 1000)}
                    </span>
                    {firstAvailableSpeedUp && onUseSpeedUpResearch && (
                      <button
                        type="button"
                        onClick={() => onUseSpeedUpResearch(rq.id, firstAvailableSpeedUp)}
                        title={`استخدام ${SPEEDUP_CARDS_META[firstAvailableSpeedUp].name}`}
                        className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 text-[10px] font-bold flex items-center gap-0.5"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        <span>تسريع</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {state.trainingQueue.map((tq) => (
              <div
                key={tq.id}
                className="flex items-center justify-between gap-2 text-xs bg-slate-950/70 px-2.5 py-1.5 rounded-lg"
              >
                <span className="text-emerald-200 truncate">
                  تدريب: {tq.count - tq.completedCount} {UNITS_META[tq.unitType].name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-num text-emerald-300">
                    {formatDuration((tq.endsAt - now) / 1000)}
                  </span>
                  {firstAvailableSpeedUp && onUseSpeedUpTraining && (
                    <button
                      type="button"
                      onClick={() => onUseSpeedUpTraining(tq.id, firstAvailableSpeedUp)}
                      title={`استخدام ${SPEEDUP_CARDS_META[firstAvailableSpeedUp].name}`}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[10px] font-bold flex items-center gap-0.5"
                    >
                      <Zap className="w-2.5 h-2.5" />
                      <span>تسريع</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {state.marches.map((m) => {
              const endTs = m.phase === 'OUTBOUND' ? m.arrivalAt : m.returnAt;
              const actionWord = m.mission === 'player_attack' ? 'هجوم نحو' : 'استطلاع نحو';
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-xs bg-slate-950/70 px-2.5 py-1.5 rounded-lg"
                >
                  <span className="text-amber-200 truncate">
                    {m.phase === 'OUTBOUND' ? actionWord : 'عودة من'} {m.targetName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-num text-amber-300">
                      {formatDuration((endTs - now) / 1000)}
                    </span>
                    {onSpeedUpMarch && (
                      <button
                        type="button"
                        onClick={() => onSpeedUpMarch(m.id, 1)}
                        title="تسريع المسيرة 1 دقيقة مقابل 50 جوهرة"
                        className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 text-[10px] font-bold flex items-center gap-0.5"
                      >
                        <Gem className="w-2.5 h-2.5" />
                        <span>50</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel 2: City Statistics Summary (ملخص المدينة) */}
      <div className="p-3 rounded-xl glass-subpanel flex flex-col justify-between min-h-[76px]">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>ملخص المدينة</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setMobileExpanded(false);
              onNavigate('stats');
            }}
            className="text-[11px] text-sky-300 hover:text-sky-200 font-semibold"
          >
            التفاصيل ←
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-[10px] text-slate-400">الإنتاج/ساعة</div>
            <div className="font-num font-bold text-emerald-300">
              +{formatNumber(totalRate)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">القوة الدفاعية</div>
            <div className="font-num font-bold text-sky-300">
              {formatNumber(defPower)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">التخصص</div>
            <div className="font-bold text-amber-300 truncate">
              {state.specialization
                ? SPECIALIZATIONS[state.specialization].name
                : atkPower > 0
                  ? `هجوم ${atkPower}`
                  : 'مرحلة التأسيس'}
            </div>
          </div>
        </div>
      </div>

      {/* Panel 3: Priority Quest & Bot Guidance (المهمة الحالية) */}
      <div className="p-3 rounded-xl glass-subpanel flex flex-col justify-between min-h-[76px]">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span>المهمة التالية</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setMobileExpanded(false);
              onNavigate('quests');
            }}
            className="text-[11px] text-amber-300 hover:text-amber-200 font-semibold"
          >
            كل المهام ←
          </button>
        </div>

        {priorityQuest ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-100 truncate">
                {priorityQuest.title}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {priorityQuest.description}
              </div>
            </div>
            {questReady ? (
              <button
                type="button"
                onClick={() => onClaimQuest(priorityQuest.id)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shrink-0 transition-colors"
              >
                استلام المكافأة
              </button>
            ) : (
              <Bot className="w-4 h-4 text-blue-400 shrink-0" />
            )}
          </div>
        ) : (
          <div className="text-xs text-emerald-300">
            أنجزت جميع المهام المتاحة حاليًا! تابع تطوير المبنى الرئيسي نحو المرحلة التالية.
          </div>
        )}
      </div>
    </>
  );

  return (
    <footer className="w-full bg-[#090F1E]/95 backdrop-blur-md border-t border-slate-800/90 px-2.5 sm:px-5 py-1.5 lg:py-2.5 pb-safe shrink-0 z-30 relative">
      {/* Mobile & Tablet (< lg): Compact 1-row bar with expandable drawer */}
      <div className="lg:hidden">
        {mobileExpanded && (
          <>
            <div
              onClick={() => setMobileExpanded(false)}
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs"
            />
            <div className="fixed inset-x-2.5 bottom-14 z-40 rounded-2xl glass-panel p-3 space-y-2.5 max-h-[68dvh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                <span className="text-xs font-bold text-amber-300">
                  لوحة العمليات والملخص السريع
                </span>
                <button
                  type="button"
                  onClick={() => setMobileExpanded(false)}
                  className="min-h-[36px] px-2.5 rounded-lg bg-slate-800/80 text-xs text-slate-300 flex items-center gap-1"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>إغلاق</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {panelsContent}
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            className="min-h-[40px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 min-w-0 flex-1"
          >
            <Hammer className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold truncate">
              {hasActiveJobs
                ? `العمليات الجارية (${activeJobsCount})`
                : 'ملخص المدينة والعمليات'}
            </span>
            <span className="hidden xs:inline text-[11px] font-num text-emerald-300 shrink-0">
              +{formatNumber(totalRate)}/س
            </span>
            {mobileExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400 mr-auto shrink-0" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400 mr-auto shrink-0" />
            )}
          </button>

          {priorityQuest && questReady ? (
            <button
              type="button"
              onClick={() => onClaimQuest(priorityQuest.id)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shrink-0 flex items-center gap-1.5 shadow"
            >
              <Target className="w-3.5 h-3.5" />
              <span>استلام مكافأة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('build')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white text-xs font-bold shrink-0"
            >
              البناء
            </button>
          )}
        </div>
      </div>

      {/* Desktop (lg+): Full 3-column dock */}
      <div className="hidden lg:grid grid-cols-3 gap-3">{panelsContent}</div>
    </footer>
  );
};
