import React, { useState } from 'react';
import {
  Binoculars,
  CheckCircle2,
  Clock,
  Cpu,
  FlaskConical,
  Flame,
  Gem,
  Lock,
  Pickaxe,
  Shield,
  ShieldAlert,
  Sprout,
  Swords,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  FORTIFICATION_DEFENSE_POINTS,
  RESEARCH_TREE,
  SPECIALIZATIONS,
  SPEEDUP_CARDS_META,
  UNITS_META,
} from '../data/gameData';
import {
  canAfford,
  formatDuration,
  formatNumber,
  getBarracksLevel,
  getCityAttackPower,
  getCityDefensePower,
  getFortificationLevel,
  getMainBuildingLevel,
  getMaxResearchSlots,
  getReconRevealPct,
  getResearchCenterLevel,
  isAttackBoostActive,
  isDefenseBoostActive,
} from '../engine/gameEngine';
import { GameState, SpeedUpTierId, UnitType } from '../types/game';
import { PanelHeader, ResourceCostRow } from './PanelPrimitives';

interface MilitaryViewProps {
  state: GameState;
  now: number;
  onTrainUnits: (unitType: UnitType, count: number) => void;
  onUpgradeFortifications: () => void;
  onUseSpeedUpTraining?: (queueId: string, tierId: SpeedUpTierId) => void;
  onSpeedUpMarch?: (marchId: string, minutes: number) => void;
}

const UNIT_ORDER: UnitType[] = ['infantry', 'tank', 'aircraft', 'scout'];

export const MilitaryView: React.FC<MilitaryViewProps> = ({
  state,
  now,
  onTrainUnits,
  onUpgradeFortifications,
  onUseSpeedUpTraining,
  onSpeedUpMarch,
}) => {
  const [counts, setCounts] = useState<Record<UnitType, number>>({
    infantry: 5,
    tank: 2,
    aircraft: 1,
    scout: 2,
  });

  const mainLv = getMainBuildingLevel(state);
  const barLv = getBarracksLevel(state);
  const fortLv = getFortificationLevel(state);
  const fortBuilding = state.buildings.find((b) => b.type === 'fortifications');
  const fortBusy =
    fortBuilding?.status === 'CONSTRUCTING' || fortBuilding?.status === 'UPGRADING';

  const atkPower = getCityAttackPower(state, now);
  const defPower = getCityDefensePower(state, now);
  const fortDef = FORTIFICATION_DEFENSE_POINTS[fortLv] ?? 0;
  const atkBuff = isAttackBoostActive(state, now);
  const defBuff = isDefenseBoostActive(state, now);
  const reconPct = getReconRevealPct(state);

  const totalUnits =
    (state.units.infantry ?? 0) +
    (state.units.tank ?? 0) +
    (state.units.aircraft ?? 0) +
    (state.units.scout ?? 0);

  const ownedSpeedUps = (Object.keys(SPEEDUP_CARDS_META) as SpeedUpTierId[]).filter(
    (tier) => (state.speedUpCards[tier] ?? 0) > 0
  );

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(29,78,216,0.16),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(217,119,6,0.10),transparent_45%)]">
      <div className="max-w-5xl mx-auto space-y-5 pb-6">
        <PanelHeader
          icon={Swords}
          title="الجيش والدفاع"
          subtitle="درّب قواتك البرية والجوية (المشاة، الدبابات، الطائرات، الكشافة) وقوِّ أسوار المدينة لحماية الموارد."
          rightSlot={
            <div className="flex flex-wrap items-center gap-2">
              <div className="glass-subpanel px-3 py-2 rounded-xl text-xs font-num flex items-center gap-1.5">
                <Binoculars className="w-4 h-4 text-sky-300" />
                <span className="text-slate-300">كشف الاستطلاع:</span>
                <span className="font-bold text-sky-300">{reconPct}%</span>
              </div>
              <div className="glass-subpanel px-3.5 py-2 rounded-xl text-xs font-num flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-300" />
                <span className="text-slate-300">إجمالي الوحدات:</span>
                <span className="font-bold text-amber-300">
                  {formatNumber(totalUnits)}
                </span>
              </div>
            </div>
          }
        />

        {/* Power & Wall Overview (Glassmorphism Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="group glass-panel p-4 sm:p-5 rounded-2xl space-y-2 transition-colors hover:border-amber-400/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>القوة الهجومية</span>
                {atkBuff && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-[10px] text-rose-200 font-num">
                    +10%
                  </span>
                )}
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <Swords className="w-4 h-4 text-amber-300" />
              </div>
            </div>
            <div className="text-2xl font-bold font-num text-amber-300">
              {formatNumber(atkPower)}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              تُحسب تلقائيًا للمشاة والدبابات والطائرات عند إرسال الهجمات أو الغارات.
            </p>
          </div>

          <div className="group glass-panel p-4 sm:p-5 rounded-2xl space-y-2 transition-colors hover:border-sky-400/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>القوة الدفاعية</span>
                {defBuff && (
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[10px] text-sky-200 font-num">
                    +10%
                  </span>
                )}
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/35 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <ShieldAlert className="w-4 h-4 text-sky-300" />
              </div>
            </div>
            <div className="text-2xl font-bold font-num text-sky-300">
              {formatNumber(defPower)}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              دفاع القوات المتمركزة مضافًا إليه{' '}
              <span className="font-num text-sky-300 font-semibold">{fortDef}</span> من الأسوار.
            </p>
          </div>

          <div className="group glass-panel p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-3 transition-colors hover:border-slate-500/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">التحصينات الدفاعية</span>
                <span className="font-num text-xs font-bold text-slate-100">
                  {fortLv} / 5
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((lv) => (
                  <div
                    key={lv}
                    className={`h-2 rounded-full transition-colors ${
                      fortLv >= lv ? 'bg-amber-400' : 'bg-slate-800/80'
                    }`}
                  />
                ))}
              </div>
            </div>

            {fortBusy ? (
              <div className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 shrink-0" />
                <span>جارٍ تطوير الأسوار حاليًا</span>
              </div>
            ) : fortLv < 5 ? (
              <button
                type="button"
                onClick={onUpgradeFortifications}
                className="w-full min-h-[44px] sm:min-h-[38px] py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 border border-slate-600/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Wrench className="w-4 h-4" />
                <span>ترقية التحصينات للمستوى {fortLv + 1}</span>
              </button>
            ) : (
              <div className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>التحصينات في أعلى مستوى (700 دفاع)</span>
              </div>
            )}
          </div>
        </div>

        {/* Barracks Units (Unlocks at Main Building Lv 9) */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-amber-300" />
              <h3 className="text-sm font-bold text-slate-100">
                تدريب الوحدات في الثكنة العسكرية
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-num">
              مستوى الثكنة: {barLv}
            </span>
          </div>

          {mainLv < 9 || barLv < 1 ? (
            <div className="glass-panel p-5 rounded-2xl border-amber-500/35 flex items-start sm:items-center gap-3.5 text-sm text-slate-200">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-amber-300" />
              </div>
              <div className="space-y-1">
                <div className="font-bold">تُفتح الثكنة عند المبنى الرئيسي مستوى 9</div>
                <p className="text-xs text-slate-300/90 leading-relaxed">
                  {mainLv < 9
                    ? `مستواك الحالي: المبنى الرئيسي ${mainLv}. طوّر مدينتك حتى المبنى الرئيسي 9 لتتمكن من بناء الثكنة وتدريب المشاة والدبابات والطائرات والكشافة.`
                    : 'وصلت إلى المبنى الرئيسي 9! ابنِ الثكنة من خريطة المدينة أو قائمة البناء لتبدأ التدريب فورًا.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {UNIT_ORDER.map((uType) => {
                const u = UNITS_META[uType];
                const qty = counts[uType] ?? 1;
                const totalCost = {
                  wheat: u.cost.wheat * qty,
                  wood: u.cost.wood * qty,
                  iron: u.cost.iron * qty,
                };
                const barLocked = barLv < u.requiredBarracksLevel;
                const affordable = canAfford(state.resources, totalCost);
                const canTrain = !barLocked && affordable;

                return (
                  <div
                    key={uType}
                    className={`group glass-panel p-4 sm:p-5 rounded-2xl space-y-4 ${
                      barLocked ? 'opacity-85' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <span>{u.name}</span>
                          {barLocked && (
                            <span className="text-[11px] font-num text-amber-300 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              ثكنة {u.requiredBarracksLevel}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-300/85 leading-relaxed">
                          {u.roleDesc}
                        </p>
                      </div>
                      <div className="glass-subpanel px-3 py-1.5 rounded-xl text-center shrink-0">
                        <div className="text-[10px] text-slate-400">المتوفر</div>
                        <div className="text-sm font-num font-bold text-amber-300">
                          {formatNumber(state.units[uType] ?? 0)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs glass-subpanel p-2.5 rounded-xl">
                      <div>
                        <div className="text-[10px] text-slate-400">هجوم</div>
                        <div className="font-num font-bold text-amber-300">{u.attack}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">دفاع</div>
                        <div className="font-num font-bold text-sky-300">{u.defense}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">سرعة</div>
                        <div className="font-num font-bold text-emerald-300">{u.speed}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">حمولة</div>
                        <div className="font-num font-bold text-slate-100">{u.carry}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 5, 10, 25].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setCounts((prev) => ({ ...prev, [uType]: preset }))
                          }
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-num font-bold border transition-colors ${
                            qty === preset
                              ? 'bg-[#1D4ED8] border-blue-400 text-white'
                              : 'bg-slate-900/70 border-slate-700/60 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          ×{preset}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={qty}
                        onChange={(e) =>
                          setCounts((prev) => ({
                            ...prev,
                            [uType]: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        className="ms-auto w-20 min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs font-num text-slate-100 text-center"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-700/40 space-y-3">
                      <ResourceCostRow
                        cost={totalCost}
                        currentResources={state.resources}
                        durationSec={u.trainTimeSec * qty}
                      />

                      <button
                        type="button"
                        disabled={!canTrain}
                        onClick={() => onTrainUnits(uType, qty)}
                        className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold transition-colors ${
                          canTrain
                            ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white shadow-lg shadow-blue-950/50'
                            : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {barLocked
                          ? `يتطلب ثكنة مستوى ${u.requiredBarracksLevel}`
                          : affordable
                            ? `بدء تدريب ${qty} ${u.name}`
                            : 'الموارد غير كافية للتدريب'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Training & Marches with Speed-Ups */}
        {(state.trainingQueue.length > 0 || state.marches.length > 0) && (
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-200 px-1">
              العمليات والتحركات الحالية
            </h3>
            <div className="space-y-2">
              {state.trainingQueue.map((tq) => (
                <div
                  key={tq.id}
                  className="glass-panel p-3.5 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-200">
                      جارٍ تدريب {tq.count - tq.completedCount} {UNITS_META[tq.unitType].name}
                    </span>
                    <span className="font-num font-bold text-emerald-300 flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration((tq.endsAt - now) / 1000)}
                    </span>
                  </div>
                  {ownedSpeedUps.length > 0 && onUseSpeedUpTraining && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      {ownedSpeedUps.map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => onUseSpeedUpTraining(tq.id, tier)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-600/30 border border-amber-500/40 text-[11px] text-amber-200"
                        >
                          {SPEEDUP_CARDS_META[tier].name} ({state.speedUpCards[tier]})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {state.marches.map((m) => (
                <div
                  key={m.id}
                  className="glass-panel p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <span className="font-semibold text-slate-200">
                    {m.mission === 'player_attack' ? 'حملة هجوم' : 'بعثة استطلاع'} ·{' '}
                    {m.phase === 'OUTBOUND' ? 'في الطريق إلى' : 'عائد من'} {m.targetName} ({m.targetCoords.x}|{m.targetCoords.y})
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-num font-bold text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(((m.phase === 'OUTBOUND' ? m.arrivalAt : m.returnAt) - now) / 1000)}
                    </span>
                    {onSpeedUpMarch && (
                      <button
                        type="button"
                        onClick={() => onSpeedUpMarch(m.id, 1)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold flex items-center gap-1"
                        title="تسريع المسيرة بمقدار دقيقة مقابل 50 جوهرة"
                      >
                        <Gem className="w-3 h-3 text-amber-300" />
                        <span>-1د (50 جوهرة)</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

interface ResearchViewProps {
  state: GameState;
  now: number;
  onStartResearch: (techId: string) => void;
  onUseSpeedUpResearch?: (queueId: string, tierId: SpeedUpTierId) => void;
}

const BRANCH_GROUPS: {
  id: 'shared' | 'agriculture' | 'industry' | 'mining' | 'energy' | 'military';
  title: string;
  subtitle: string;
  accent: string;
  iconBg: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'shared',
    title: 'الأبحاث الأساسية والملاحة البحرية',
    subtitle: 'متاحة لجميع المدن فور فتح مركز الأبحاث عند المبنى الرئيسي مستوى 6',
    accent: 'text-sky-300',
    iconBg: 'bg-sky-500/15 border-sky-400/35 text-sky-300',
    icon: FlaskConical,
  },
  {
    id: 'agriculture',
    title: 'تخصص الزراعة والغذاء',
    subtitle: 'تُفتح عند اختيار تخصص الزراعة في المبنى الرئيسي (مستوى 5)',
    accent: 'text-emerald-300',
    iconBg: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300',
    icon: Sprout,
  },
  {
    id: 'industry',
    title: 'تخصص الصناعة والهندسة',
    subtitle: 'تُفتح عند اختيار تخصص الصناعة في المبنى الرئيسي (مستوى 5)',
    accent: 'text-amber-300',
    iconBg: 'bg-amber-500/15 border-amber-400/35 text-amber-300',
    icon: Cpu,
  },
  {
    id: 'mining',
    title: 'تخصص التعدين والمعادن',
    subtitle: 'تُفتح عند اختيار تخصص التعدين في المبنى الرئيسي (مستوى 5)',
    accent: 'text-orange-300',
    iconBg: 'bg-orange-500/15 border-orange-400/35 text-orange-300',
    icon: Pickaxe,
  },
  {
    id: 'energy',
    title: 'تخصص الطاقة والنفط البحري',
    subtitle: 'تُفتح عند اختيار تخصص الطاقة لرفع عوائد آبار النفط والغاز',
    accent: 'text-cyan-300',
    iconBg: 'bg-cyan-500/15 border-cyan-400/35 text-cyan-300',
    icon: Flame,
  },
  {
    id: 'military',
    title: 'الأبحاث العسكرية والاستطلاع',
    subtitle: 'ترفع كفاءة القوات، دقة كشف الاستطلاع (20% إلى 70%)، وقوة دفاع المدينة',
    accent: 'text-rose-300',
    iconBg: 'bg-rose-500/15 border-rose-400/35 text-rose-300',
    icon: Swords,
  },
];

export const ResearchView: React.FC<ResearchViewProps> = ({
  state,
  now,
  onStartResearch,
  onUseSpeedUpResearch,
}) => {
  const [selectedBranch, setSelectedBranch] = useState<'all' | (typeof BRANCH_GROUPS)[number]['id']>('all');
  const mainLv = getMainBuildingLevel(state);
  const rcLv = getResearchCenterLevel(state);
  const maxSlots = getMaxResearchSlots(state);
  const slotsFull = state.researchQueue.length >= maxSlots;
  const centerUnlocked = mainLv >= 6 && rcLv >= 1;

  const ownedSpeedUps = (Object.keys(SPEEDUP_CARDS_META) as SpeedUpTierId[]).filter(
    (tier) => (state.speedUpCards[tier] ?? 0) > 0
  );

  const visibleBranches =
    selectedBranch === 'all'
      ? BRANCH_GROUPS
      : BRANCH_GROUPS.filter((b) => b.id === selectedBranch);

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(14,165,233,0.14),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(29,78,216,0.12),transparent_45%)]">
      <div className="max-w-6xl mx-auto space-y-5 pb-6">
        <PanelHeader
          icon={FlaskConical}
          title="الأبحاث والتكنولوجيا"
          subtitle={`خانات البحث النشطة: ${state.researchQueue.length} من ${maxSlots} · التخصص الحالي: ${state.specialization ? SPECIALIZATIONS[state.specialization].name : 'يُختار عند المبنى الرئيسي 5'}`}
          rightSlot={
            <div className="flex items-center gap-1.5 p-1 rounded-xl glass-subpanel overflow-x-auto no-scrollbar max-w-full">
              <button
                type="button"
                onClick={() => setSelectedBranch('all')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  selectedBranch === 'all'
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                الكل
              </button>
              {BRANCH_GROUPS.map((bg) => {
                const BranchIcon = bg.icon;
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setSelectedBranch(bg.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      selectedBranch === bg.id
                        ? 'bg-[#1D4ED8] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <BranchIcon className="w-3.5 h-3.5" />
                    <span>
                      {bg.id === 'shared'
                        ? 'الأساسية'
                        : bg.id === 'military'
                          ? 'العسكرية'
                          : SPECIALIZATIONS[bg.id].name}
                    </span>
                  </button>
                );
              })}
            </div>
          }
        />

        {!centerUnlocked && (
          <div className="glass-panel p-4 rounded-2xl border-amber-500/40 flex items-start sm:items-center gap-3 text-xs text-amber-100">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-amber-300" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-sm">
                تصفّح شجرة الأبحاث الكاملة — يبدأ التشغيل عند المبنى الرئيسي 6 وبناء مركز الأبحاث
              </div>
              <p className="text-slate-300 leading-relaxed">
                يمكنك مراجعة جميع المسارات ومزاياها من الآن لتخطط لتخصص مدينتك القادم بوضوح.
              </p>
            </div>
          </div>
        )}

        {/* Multi-branch Research Tree */}
        <div className="space-y-5">
          {visibleBranches.map((branch) => {
            const branchTechs = RESEARCH_TREE.filter((t) => t.path === branch.id);
            const BranchIcon = branch.icon;
            const isSpecBranch =
              branch.id !== 'shared' && branch.id !== 'military';
            const specMismatch =
              isSpecBranch &&
              state.specialization !== null &&
              state.specialization !== branch.id;
            const specUnchosen = isSpecBranch && state.specialization === null;

            return (
              <section
                key={branch.id}
                className="glass-panel p-4 sm:p-5 rounded-2xl space-y-4"
              >
                <div className="group flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-700/45">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${branch.iconBg}`}
                    >
                      <BranchIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${branch.accent}`}>
                        {branch.title}
                      </h3>
                      <p className="text-xs text-slate-300/85 mt-0.5 leading-relaxed">
                        {branch.subtitle}
                      </p>
                    </div>
                  </div>
                  {specMismatch && (
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      مرتبط بتخصص آخر
                    </span>
                  )}
                  {specUnchosen && (
                    <span className="text-xs text-amber-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      يُختار عند المبنى الرئيسي 5
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {branchTechs.map((tech) => {
                    const currentLv = state.researchLevels[tech.id] ?? 0;
                    const activeJob = state.researchQueue.find(
                      (r) => r.techId === tech.id
                    );
                    const isMax = currentLv >= tech.maxLevel;
                    const multiplier = Math.pow(1.45, currentLv);
                    const cost = {
                      wheat: Math.round(tech.baseCost.wheat * multiplier),
                      wood: Math.round(tech.baseCost.wood * multiplier),
                      iron: Math.round(tech.baseCost.iron * multiplier),
                    };
                    const durationSec = Math.round(
                      tech.baseDurationSec * Math.pow(1.35, currentLv)
                    );

                    const lockReasons: string[] = [];
                    if (tech.lockedFuture) lockReasons.push('متاح في المراحل المتقدمة بعد المبنى الرئيسي 10');
                    if (mainLv < tech.requiredHq) lockReasons.push(`يتطلب المبنى الرئيسي مستوى ${tech.requiredHq}`);
                    if (rcLv < tech.requiredResearchCenterLevel) {
                      lockReasons.push(`يتطلب مركز أبحاث مستوى ${tech.requiredResearchCenterLevel}`);
                    }
                    if (specUnchosen) lockReasons.push('اختر هذا التخصص عند المبنى الرئيسي 5');
                    if (specMismatch) lockReasons.push('مخصص لمسار آخر');

                    const reqLocked = lockReasons.length > 0;
                    const affordable = canAfford(state.resources, cost);
                    const canResearch =
                      centerUnlocked &&
                      !activeJob &&
                      !isMax &&
                      !slotsFull &&
                      !reqLocked &&
                      affordable;

                    const activePct = activeJob
                      ? Math.min(
                          100,
                          Math.max(
                            4,
                            Math.round(
                              ((now - activeJob.startedAt) /
                                Math.max(1, activeJob.endsAt - activeJob.startedAt)) *
                                100
                            )
                          )
                        )
                      : 0;

                    return (
                      <div
                        key={tech.id}
                        className={`glass-subpanel p-4 rounded-xl flex flex-col justify-between gap-3.5 transition-colors ${
                          reqLocked
                            ? 'opacity-85'
                            : 'hover:border-sky-400/45'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                              <BranchIcon className={`w-4 h-4 shrink-0 ${branch.accent}`} />
                              <span>{tech.name}</span>
                            </span>
                            <span className="text-xs font-num text-amber-300 font-bold">
                              {currentLv}/{tech.maxLevel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: tech.maxLevel }).map((_, i) => (
                              <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full ${
                                  i < currentLv ? 'bg-amber-400' : 'bg-slate-800'
                                }`}
                              />
                            ))}
                          </div>

                          <p className="text-xs text-slate-300/85 leading-relaxed">
                            {tech.description}
                          </p>
                          <div className="text-xs text-emerald-300 font-semibold">
                            الفائدة: {tech.effectLabel}
                          </div>
                        </div>

                        {activeJob ? (
                          <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-400/40 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-sky-200 font-semibold">
                                جارٍ التطوير إلى المستوى {activeJob.toLevel}
                              </span>
                              <span className="font-num text-sky-300 font-bold">
                                {formatDuration((activeJob.endsAt - now) / 1000)}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-sky-400 transition-all"
                                style={{ width: `${activePct}%` }}
                              />
                            </div>
                            {ownedSpeedUps.length > 0 && onUseSpeedUpResearch && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-sky-500/20">
                                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                {ownedSpeedUps.map((tier) => (
                                  <button
                                    key={tier}
                                    type="button"
                                    onClick={() => onUseSpeedUpResearch(activeJob.id, tier)}
                                    className="px-2 py-1 rounded bg-slate-900 hover:bg-sky-700/40 border border-sky-400/40 text-[11px] text-sky-200"
                                  >
                                    {SPEEDUP_CARDS_META[tier].name} ({state.speedUpCards[tier]})
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : isMax ? (
                          <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/35 text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>اكتمل هذا البحث بالكامل</span>
                          </div>
                        ) : (
                          <div className="space-y-2.5 pt-2.5 border-t border-slate-700/40">
                            <ResourceCostRow
                              cost={cost}
                              currentResources={state.resources}
                              durationSec={durationSec}
                            />

                            {reqLocked && (
                              <div className="text-[11px] text-amber-300 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span>{lockReasons[0]}</span>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={!canResearch}
                              onClick={() => onStartResearch(tech.id)}
                              className={`w-full min-h-[44px] sm:min-h-[38px] py-2 px-4 rounded-xl text-xs font-bold transition-colors ${
                                canResearch
                                  ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                                  : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {reqLocked
                                ? 'الشروط غير مكتملة بعد'
                                : slotsFull
                                  ? 'خانات البحث مشغولة حاليًا'
                                  : !affordable
                                    ? 'الموارد غير كافية'
                                    : `بدء البحث (مستوى ${currentLv + 1})`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
