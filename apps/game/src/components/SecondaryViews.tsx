import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  ArrowLeftRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coins,
  FileText,
  Flame,
  Gem,
  Hammer,
  Info,
  Landmark,
  Lock,
  Pencil,
  Pickaxe,
  PlusCircle,
  Scale,
  Search,
  Shield,
  Ship,
  Store,
  Swords,
  Trees,
  TrendingUp,
  Undo2,
  Users,
  Vote,
  Wheat,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  ALLIANCE_CENTER_UPGRADE_TABLE,
  MARKET_RESOURCES_META,
  QUESTS_CATALOG,
  SEAPORT_UPGRADE_TABLE,
  SPECIALIZATIONS,
  SPEEDUP_CARDS_META,
} from '@enginora/shared';
import {
  calculateMarketDealMetrics,
  formatDecimal,
  formatDuration,
  formatKsaDateTime,
  formatNumber,
  getAllianceCenterLevel,
  getCityAttackPower,
  getCityDefensePower,
  getCityPoints,
  getExposedExcessResources,
  getLockedResourceQty,
  getMainBuildingLevel,
  getPlayerMonthlyQuotaInfo,
  getProductionRates,
  getProtectedWarehouseCapacity,
  getSeaportLevel,
  getSecondsUntilKsaMidnight,
  getSecondsUntilKsaMonday,
  getSellableResourceQty,
  getTotalGems,
  getTotalStoredResources,
  isQuestConditionMet,
} from '@enginora/shared';
import { GameReport, GameState, MarketResourceId } from '@enginora/shared';
import { PanelHeader } from '@enginora/shared';

/* -------------------------------------------------------------------------- */
/*  1. QuestsView (KSA UTC+3 Daily/Weekly Reset + Trade Points Reference)     */
/* -------------------------------------------------------------------------- */

export const QuestsView: React.FC<{
  state: GameState;
  now?: number;
  onClaimQuest: (questId: string) => void;
}> = ({ state, now = Date.now(), onClaimQuest }) => {
  const [tab, setTab] = useState<'all' | 'daily' | 'weekly' | 'achievement'>('all');
  const filtered = QUESTS_CATALOG.filter((q) =>
    tab === 'all' ? true : q.category === tab
  );

  const readyCount = QUESTS_CATALOG.filter(
    (q) => !state.questClaims[q.id] && isQuestConditionMet(state, q.id)
  ).length;
  const completedCount = QUESTS_CATALOG.filter((q) => Boolean(state.questClaims[q.id])).length;

  const dailyResetSec = getSecondsUntilKsaMidnight(now);
  const weeklyResetSec = getSecondsUntilKsaMonday(now);

  const categoryLabels: Record<string, string> = {
    daily: 'مهمة يومية',
    weekly: 'مهمة أسبوعية',
    achievement: 'إنجاز دائم',
  };

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(217,119,6,0.13),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(29,78,216,0.14),transparent_45%)]">
      <div className="max-w-4xl mx-auto space-y-5 pb-6">
        <PanelHeader
          icon={ClipboardCheck}
          title="المهام والإنجازات"
          subtitle="أكمل المهام اليومية والأسبوعية وفق التوقيت العالمي (UTC) — يبدأ اليوم الجديد الساعة 21:00 UTC واجمع الموارد وبطاقات التسريع."
          rightSlot={
            <div className="flex items-center gap-1 p-1 rounded-xl glass-subpanel overflow-x-auto no-scrollbar max-w-full">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'daily', label: 'يومية' },
                { id: 'weekly', label: 'أسبوعية' },
                { id: 'achievement', label: 'إنجازات' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    tab === t.id
                      ? 'bg-[#1D4ED8] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        />

        {/* KSA Reset Timers & Quick Progress Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 text-xs">
          <div className="group glass-panel p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span>جاهزة للاستلام</span>
              <Zap className="w-4 h-4 text-amber-300 transition-transform group-hover:scale-110" />
            </div>
            <div className="text-lg sm:text-xl font-num font-bold text-amber-300">
              {readyCount}
            </div>
          </div>
          <div className="group glass-panel p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span>مهام مكتملة</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-300 transition-transform group-hover:scale-110" />
            </div>
            <div className="text-lg sm:text-xl font-num font-bold text-emerald-300">
              {completedCount} / {QUESTS_CATALOG.length}
            </div>
          </div>
          <div className="group glass-panel p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span>تصفير اليومي (21:00 UTC)</span>
              <Clock className="w-4 h-4 text-sky-300" />
            </div>
            <div className="text-base sm:text-lg font-num font-bold text-sky-300">
              {formatDuration(dailyResetSec)}
            </div>
          </div>
          <div className="group glass-panel p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span>تصفير الأسبوعي (الأحد 21:00 UTC)</span>
              <Gem className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-base sm:text-lg font-num font-bold text-slate-200">
              {formatDuration(weeklyResetSec)}
            </div>
          </div>
        </div>

        {/* Trade Points Separation Reference Card (§20) */}
        <div className="glass-panel p-4 rounded-2xl border-emerald-500/35 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Coins className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-emerald-200">
                نقاط التجارة (Trade Points) — دفتر منفصل عن ENGINORA GEMS
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                تُكتسب نقاط التجارة من المهام والإنجازات وتجارة الميناء، وتبقى منفصلة تمامًا عن رصيد الجواهر. معدلات الكسب النهائية ونظام الصرف قيد التصميم النهائي باعتماد المؤسس.
              </p>
            </div>
          </div>
          <div className="glass-subpanel px-3.5 py-2 rounded-xl text-left font-num shrink-0">
            <div className="text-[10px] text-slate-400">نقاط الإنجاز / التجارة</div>
            <div className="font-bold text-emerald-300">
              {formatNumber(state.ledger.achievementPoints)} إنجاز · {formatNumber(state.ledger.tradeBalance)} تجارة
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((q) => {
            const claimed = Boolean(state.questClaims[q.id]);
            const ready = !claimed && isQuestConditionMet(state, q.id);

            return (
              <div
                key={q.id}
                className={`group glass-panel p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  ready ? 'border-amber-400/60' : 'hover:border-slate-600/60'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ClipboardCheck className="w-3.5 h-3.5 text-amber-300 transition-transform group-hover:scale-110" />
                    <span>{categoryLabels[q.category]}</span>
                    {ready && (
                      <>
                        <span>·</span>
                        <span className="text-amber-300 font-bold">جاهزة للاستلام</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-100">
                    {q.title}
                  </h3>
                  <p className="text-xs text-slate-300/90 leading-relaxed">{q.description}</p>

                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs font-num pt-1">
                    {q.rewards.wheat > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                        <Wheat className="w-3.5 h-3.5" />+{formatNumber(q.rewards.wheat)}
                      </span>
                    )}
                    {q.rewards.wood > 0 && (
                      <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                        <Trees className="w-3.5 h-3.5" />+{formatNumber(q.rewards.wood)}
                      </span>
                    )}
                    {q.rewards.iron > 0 && (
                      <span className="inline-flex items-center gap-1 text-sky-300 font-semibold">
                        <Pickaxe className="w-3.5 h-3.5" />+{formatNumber(q.rewards.iron)}
                      </span>
                    )}
                    <span className="text-slate-300">
                      +{q.rewards.achievementPoints} نقطة إنجاز
                    </span>
                    {q.rewards.speedUp && (
                      <span className="inline-flex items-center gap-1 text-amber-200 font-semibold">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        {SPEEDUP_CARDS_META[q.rewards.speedUp.tier].name} (×{q.rewards.speedUp.count})
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {claimed ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/35 text-xs font-bold text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تم الاستلام</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => onClaimQuest(q.id)}
                      className={`w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                        ready
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40'
                          : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {ready ? 'استلام المكافأة' : 'قيد التنفيذ'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  2. ReportsView (KSA Timezone + Military/Market Filters)                   */
/* -------------------------------------------------------------------------- */

export const ReportsView: React.FC<{
  state: GameState;
  onMarkAllRead: () => void;
}> = ({ state, onMarkAllRead }) => {
  const [filter, setFilter] = useState<'all' | 'unread' | GameReport['category']>('all');
  const unreadCount = state.reports.filter((r) => !r.read).length;

  const filteredReports = state.reports.filter((rep) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !rep.read;
    return rep.category === filter;
  });

  const categoryIcon = (cat: GameReport['category']) => {
    switch (cat) {
      case 'construction':
        return <Hammer className="w-4 h-4 text-amber-300 shrink-0" />;
      case 'maritime':
        return <Ship className="w-4 h-4 text-cyan-300 shrink-0" />;
      case 'bot':
        return <Bot className="w-4 h-4 text-amber-300 shrink-0" />;
      case 'recon':
        return <Shield className="w-4 h-4 text-emerald-300 shrink-0" />;
      case 'military':
        return <Swords className="w-4 h-4 text-rose-300 shrink-0" />;
      case 'market':
        return <Store className="w-4 h-4 text-emerald-300 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-sky-300 shrink-0" />;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.13),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(29,78,216,0.12),transparent_45%)]">
      <div className="max-w-4xl mx-auto space-y-5 pb-6">
        <PanelHeader
          icon={FileText}
          title="التقارير والسجلات"
          subtitle="كل ما يحدث في مدينتك من بناء واستكشاف بحري وأبحاث ومعارك وتجارة بالتوقيت العالمي (UTC)."
          rightSlot={
            unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
              >
                تحديد الكل كمقروء ({unreadCount})
              </button>
            ) : undefined
          }
        />

        {/* Category Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: `الكل (${state.reports.length})` },
            { id: 'unread', label: `غير مقروءة (${unreadCount})` },
            { id: 'construction', label: 'البناء' },
            { id: 'research', label: 'الأبحاث' },
            { id: 'maritime', label: 'الميناء والنفط' },
            { id: 'recon', label: 'الاستطلاع' },
            { id: 'military', label: 'العسكرية والهجوم' },
            { id: 'market', label: 'السوق والتجارة' },
            { id: 'bot', label: 'المستشار' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id as typeof filter)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                filter === f.id
                  ? 'bg-[#1D4ED8] border-blue-400 text-white'
                  : 'glass-subpanel text-slate-300 hover:border-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredReports.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl text-center text-xs text-slate-300">
            لا توجد تقارير ضمن هذا التصنيف حاليًا.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((rep) => (
              <article
                key={rep.id}
                className={`group glass-panel p-4 sm:p-5 rounded-2xl space-y-2.5 transition-colors ${
                  rep.read ? '' : 'border-amber-400/55'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg glass-subpanel flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      {categoryIcon(rep.category)}
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 leading-snug">
                      {rep.title}
                    </h3>
                    {!rep.read && (
                      <span className="text-[11px] font-bold text-amber-300 shrink-0">
                        جديد
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-num text-slate-400 shrink-0">
                    {formatKsaDateTime(rep.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-200/95 leading-relaxed">{rep.summary}</p>
                {rep.details.length > 0 && (
                  <ul className="space-y-1 text-xs text-slate-400 pt-2 border-t border-slate-700/40 leading-relaxed">
                    {rep.details.map((d, i) => (
                      <li key={i}>· {d}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  3. StatisticsView (Separated Ledgers + Uncapped Warehouse Exposure)       */
/* -------------------------------------------------------------------------- */

export const StatisticsView: React.FC<{ state: GameState; now?: number }> = ({
  state,
  now = Date.now(),
}) => {
  const mainLv = getMainBuildingLevel(state);
  const rates = getProductionRates(state);
  const cap = getProtectedWarehouseCapacity(state);
  const stored = getTotalStoredResources(state.resources);
  const { excessTotal, maxLootablePerAttack } = getExposedExcessResources(state);
  const storagePct = Math.min(100, Math.round((stored / Math.max(1, cap)) * 100));
  const maxRate = Math.max(1, rates.wheat, rates.wood, rates.iron);
  const atk = getCityAttackPower(state, now);
  const def = getCityDefensePower(state, now);
  const pts = getCityPoints(state);
  const totalGems = getTotalGems(state);

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(29,78,216,0.16),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.10),transparent_45%)]">
      <div className="max-w-4xl mx-auto space-y-5 pb-6">
        <PanelHeader
          icon={BarChart3}
          title="إحصائيات المدينة والاقتصاد"
          subtitle="نظرة واضحة على قوة مدينتك، معدلات الإنتاج المستمر، الحماية المخزنية، وفصل دفاتر الجواهر ونقاط التجارة."
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'المبنى الرئيسي', val: `مستوى ${mainLv}`, color: 'text-amber-300', icon: Landmark },
            { label: 'نقاط المدينة', val: formatNumber(pts), color: 'text-slate-100', icon: TrendingUp },
            { label: 'القوة الدفاعية', val: formatNumber(def), color: 'text-sky-300', icon: Shield },
            { label: 'القوة الهجومية', val: formatNumber(atk), color: 'text-emerald-300', icon: Flame },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="group glass-panel p-4 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{stat.label}</span>
                  <Icon className={`w-4 h-4 ${stat.color} transition-transform group-hover:scale-110`} />
                </div>
                <div className={`text-xl font-bold font-num ${stat.color}`}>
                  {stat.val}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="group glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-300 transition-transform group-hover:scale-110" />
              <span>معدل الإنتاج والحماية المخزنية</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              {[
                { label: 'إنتاج القمح', val: rates.wheat, color: 'bg-amber-400', text: 'text-amber-300', icon: Wheat },
                { label: 'إنتاج الخشب', val: rates.wood, color: 'bg-emerald-400', text: 'text-emerald-300', icon: Trees },
                { label: 'إنتاج الحديد', val: rates.iron, color: 'bg-sky-400', text: 'text-sky-300', icon: Pickaxe },
              ].map((item) => {
                const ResIcon = item.icon;
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-200 flex items-center gap-1.5">
                        <ResIcon className={`w-3.5 h-3.5 ${item.text}`} />
                        <span>{item.label}</span>
                      </span>
                      <span className={`font-num font-bold ${item.text}`}>
                        +{formatNumber(item.val)} / ساعة
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                      <div
                        className={`h-full ${item.color}`}
                        style={{ width: `${Math.round((item.val / maxRate) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-700/45 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-200">المخزون / السعة المحمية ({storagePct}%)</span>
                  <span className="font-num font-bold text-slate-100">
                    {formatNumber(stored)} / {formatNumber(cap)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className={`h-full ${
                      excessTotal > 0 ? 'bg-amber-400' : 'bg-blue-500'
                    }`}
                    style={{ width: `${storagePct}%` }}
                  />
                </div>
                {excessTotal > 0 ? (
                  <div className="text-[11px] text-amber-300 leading-relaxed">
                    فائض غير محمي: <span className="font-num font-bold">{formatNumber(excessTotal)}</span> (أقصى نهب لكل هجوم 50% = <span className="font-num font-bold">{formatNumber(maxLootablePerAttack)}</span>). الإنتاج لا يتوقف أبدًا.
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-300">
                    جميع مواردك الحالية محمية بالكامل داخل سعة المخزن.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="group glass-panel p-5 rounded-2xl space-y-3.5">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Gem className="w-4 h-4 text-amber-400 transition-transform group-hover:scale-110" />
              <span>التخصص والدفاتر المالية المنفصلة</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center glass-subpanel px-3 py-2 rounded-xl">
                <span className="text-slate-400">تخصص المدينة</span>
                <span className="font-bold text-amber-300">
                  {state.specialization
                    ? SPECIALIZATIONS[state.specialization].name
                    : 'يُختار عند المبنى الرئيسي 5'}
                </span>
              </div>
              <div className="glass-subpanel px-3 py-2.5 rounded-xl space-y-1.5 border border-amber-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-amber-200 font-bold">إجمالي ENGINORA GEMS</span>
                  <span className="font-num font-bold text-amber-300">
                    {formatNumber(totalGems)} جوهرة
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-num">
                  <span>مشحونة: {formatNumber(state.gemLedger.chargedGems)}</span>
                  <span>مكافآت: {formatNumber(state.gemLedger.bonusGems)}</span>
                  <span>سوق: {formatNumber(state.gemLedger.marketGems)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center glass-subpanel px-3 py-2 rounded-xl border border-emerald-500/30">
                <span className="text-emerald-200 font-bold">نقاط التجارة (منفصلة)</span>
                <span className="font-num font-bold text-emerald-300">
                  {formatNumber(state.ledger.tradeBalance)} نقطة
                </span>
              </div>
              <div className="flex justify-between items-center glass-subpanel px-3 py-2 rounded-xl">
                <span className="text-slate-400">مخزون النفط والغاز البحري</span>
                <span className="font-num font-bold text-sky-300">
                  {formatNumber(state.maritime.crudeOilStock)} نفط · {formatNumber(state.maritime.naturalGasStock)} غاز
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  4. MarketView (v3.1 Trade Market §24-§34)                                 */
/* -------------------------------------------------------------------------- */

const RESOURCE_ICON_MAP: Record<
  MarketResourceId,
  { icon: React.ComponentType<{ className?: string }>; tint: string }
> = {
  wheat: { icon: Wheat, tint: 'text-amber-300' },
  wood: { icon: Trees, tint: 'text-emerald-300' },
  iron: { icon: Pickaxe, tint: 'text-sky-300' },
  crude_oil: { icon: Flame, tint: 'text-amber-400' },
  natural_gas: { icon: Zap, tint: 'text-cyan-300' },
};

export interface MarketViewProps {
  state: GameState;
  now: number;
  onPublishOffer: (
    resource: MarketResourceId,
    quantity: number,
    unitPriceGems: number
  ) => void;
  onEditOffer: (offerId: string, newUnitPriceGems: number) => void;
  onCancelOffer: (offerId: string) => void;
  onInitiateBuy: (offerId: string, quantity: number) => void;
  onCancelPendingBuy: (pendingId: string) => void;
  onFinalizePendingBuy: (pendingId: string) => void;
}

export const MarketView: React.FC<MarketViewProps> = ({
  state,
  now,
  onPublishOffer,
  onEditOffer,
  onCancelOffer,
  onInitiateBuy,
  onCancelPendingBuy,
  onFinalizePendingBuy,
}) => {
  const [tab, setTab] = useState<'exchange' | 'publish' | 'ledger'>('exchange');
  const [resourceFilter, setResourceFilter] = useState<'all' | MarketResourceId>('all');
  const [buyQtys, setBuyQtys] = useState<Record<string, number>>({});
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<number>(1);
  const [ledgerQuery, setLedgerQuery] = useState('');

  // Publish form state (pricing per 1,000 units)
  const [pubResource, setPubResource] = useState<MarketResourceId>('wheat');
  const [pubQty, setPubQty] = useState<number>(1000);
  const [pubPrice, setPubPrice] = useState<number>(
    () => state.adminConfig.resourcePriceBounds.wheat.referencePrice
  );

  const mainLv = getMainBuildingLevel(state);
  const seaportLv = getSeaportLevel(state);
  const unlocked = mainLv >= 10;
  const isFrozen = Boolean(
    state.market.marketFrozenForPlayer ||
      (state.market.marketBanUntil && state.market.marketBanUntil > now)
  );
  const totalGems = getTotalGems(state);
  const quota = getPlayerMonthlyQuotaInfo(state);
  const activePlayerOffers = state.market.offers.filter(
    (o) => o.sellerId === state.accountId && o.status === 'active'
  );

  const bounds = state.adminConfig.resourcePriceBounds[pubResource];
  const suggestedFairPrice = bounds.referencePrice;
  const sellableSelected = getSellableResourceQty(state, pubResource, now);
  const publishMetrics = calculateMarketDealMetrics(state, pubResource, pubQty, pubPrice);

  const activeOffers = state.market.offers.filter(
    (o) =>
      o.status === 'active' &&
      o.remainingQty > 0 &&
      (resourceFilter === 'all' || o.resource === resourceFilter)
  );

  const filteredLedger = useMemo(() => {
    const q = ledgerQuery.trim().toLowerCase();
    if (!q) return state.market.tradeLedger;
    return state.market.tradeLedger.filter((entry) => {
      const resName = MARKET_RESOURCES_META[entry.resource]?.name ?? entry.resource;
      return (
        resName.toLowerCase().includes(q) ||
        entry.sellerName.toLowerCase().includes(q) ||
        entry.buyerName.toLowerCase().includes(q) ||
        (entry.note ?? '').toLowerCase().includes(q)
      );
    });
  }, [state.market.tradeLedger, ledgerQuery]);

  const handleSelectPubResource = (res: MarketResourceId) => {
    setPubResource(res);
    const b = state.adminConfig.resourcePriceBounds[res];
    setPubPrice(b.referencePrice);
  };

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(217,119,6,0.12),transparent_45%)]">
      <div className="max-w-6xl mx-auto space-y-5 pb-6">
        <PanelHeader
          icon={Store}
          title="سوق التجارة العالمي (ENGINORA MARKET)"
          subtitle="بيع وشراء الموارد بالجواهر ضمن السقف الرسمي للإدارة، مع مهلة إلغاء 5 ثوانٍ وحظر إعادة البيع 14 يومًا."
          rightSlot={
            <div className="flex items-center gap-1 p-1 rounded-xl glass-subpanel overflow-x-auto no-scrollbar max-w-full">
              {[
                { id: 'exchange', label: 'عروض السوق', icon: ArrowLeftRight },
                { id: 'publish', label: 'نشر عرض بيع', icon: PlusCircle },
                { id: 'ledger', label: `السجل التجاري (${state.market.tradeLedger.length})`, icon: FileText },
              ].map((t) => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id as typeof tab)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      tab === t.id
                        ? 'bg-[#1D4ED8] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          }
        />

        {/* Pending Buys 5-Second Cancel Countdown Banner (§29) */}
        {state.market.pendingBuys.length > 0 && (
          <div className="space-y-2">
            {state.market.pendingBuys.map((pb) => {
              const secLeft = Math.max(0, Math.ceil((pb.confirmAt - now) / 1000));
              const rMeta = MARKET_RESOURCES_META[pb.resource];
              return (
                <div
                  key={pb.id}
                  className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-400/70 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
                    <div>
                      <div className="font-bold text-amber-200">
                        طلب شراء قيد التأكيد: {formatNumber(pb.quantity)} {rMeta.name} مقابل {formatNumber(pb.grossGems)} جوهرة
                      </div>
                      <div className="text-[11px] text-slate-300">
                        يمكنك التراجع مجانًا خلال <span className="font-num font-bold text-amber-300">{secLeft}</span> ثوانٍ قبل التنفيذ النهائي.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onCancelPendingBuy(pb.id)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>تراجع وإلغاء الشراء</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onFinalizePendingBuy(pb.id)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      تأكيد فوري
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Unlock, Freeze & Monthly Quota Banner */}
        <div
          className={`glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3.5 text-xs ${
            isFrozen
              ? 'border-rose-500/60 text-rose-100'
              : unlocked
                ? 'border-emerald-500/45 text-emerald-100'
                : 'border-amber-500/45 text-amber-100'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl glass-subpanel flex items-center justify-center shrink-0">
              {isFrozen ? (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              ) : unlocked ? (
                <Store className="w-5 h-5 text-emerald-300" />
              ) : (
                <Lock className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-sm">
                {isFrozen
                  ? 'حسابك مجمّد مؤقتًا عن التداول بانتظار المراجعة الإدارية'
                  : unlocked
                    ? 'سوق التجارة مفتوح الآن — تنفيذ يدوي مباشر بين اللاعبين'
                    : `يفتح السوق عند المبنى الرئيسي مستوى 10 (مستواك الحالي: ${mainLv} / 10)`}
              </div>
              <p className="text-[11px] text-slate-300/90 leading-relaxed">
                عمولة المنصة الرسمية: <span className="font-num font-bold">{state.adminConfig.marketFeePct}%</span> · صلاحية العرض: <span className="font-num font-bold">{state.adminConfig.marketOfferDurationDays}</span> أيام · حظر إعادة بيع المشتريات: <span className="font-num font-bold">{state.adminConfig.marketResaleHoldDays}</span> يومًا · الميناء البحري (مستوى {seaportLv}).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-num glass-subpanel px-3.5 py-2.5 rounded-xl shrink-0">
            <div>
              <div className="text-[10px] text-slate-400">ENGINORA GEMS</div>
              <div className="font-bold text-amber-300">{formatNumber(totalGems)}</div>
            </div>
            <div className="h-6 w-px bg-slate-700/60" />
            <div>
              <div className="text-[10px] text-slate-400">نقاط التجارة (منفصل)</div>
              <div className="font-bold text-emerald-300">{formatDecimal(state.ledger.tradeBalance)}</div>
            </div>
            <div className="h-6 w-px bg-slate-700/60" />
            <div>
              <div className="text-[10px] text-slate-400">الحصة الشهرية ({quota.totalPct}%)</div>
              <div className="font-bold text-sky-300">
                {formatNumber(quota.remainingUnits)} / {formatNumber(quota.capUnits)}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700/60" />
            <div>
              <div className="text-[10px] text-slate-400">عروضك النشطة</div>
              <div className="font-bold text-slate-100">
                {activePlayerOffers.length} / {quota.maxActiveOffers}
              </div>
            </div>
          </div>
        </div>

        {/* 5 Commodities Stock, Reference Prices (per 1,000) & Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.keys(MARKET_RESOURCES_META) as MarketResourceId[]).map((resId) => {
            const meta = MARKET_RESOURCES_META[resId];
            const iconCfg = RESOURCE_ICON_MAP[resId];
            const Icon = iconCfg.icon;
            const sellable = getSellableResourceQty(state, resId, now);
            const locked = getLockedResourceQty(state, resId, now);
            const rBounds = state.adminConfig.resourcePriceBounds[resId];

            return (
              <div
                key={resId}
                className={`group glass-panel p-3.5 rounded-2xl space-y-1.5 transition-colors ${
                  rBounds.enabled ? 'hover:border-slate-500/50' : 'opacity-75 border-rose-500/45'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-200 font-bold flex items-center gap-1">
                    <Icon className={`w-3.5 h-3.5 ${iconCfg.tint}`} />
                    <span>{meta.name}</span>
                  </span>
                  <span className={`text-[10px] font-bold ${rBounds.enabled ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {rBounds.enabled ? 'مفعّل' : 'متوقف'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[10px] text-slate-400 font-num">
                  <span>مرجعي / 1,000: <strong className="text-amber-300">{rBounds.referencePrice}</strong></span>
                  <span>({rBounds.min}–{rBounds.max})</span>
                </div>
                <div className="flex items-baseline justify-between pt-0.5 text-xs">
                  <span className="text-slate-400">قابل للبيع:</span>
                  <span className="font-num font-bold text-emerald-300">
                    {formatNumber(sellable)}
                  </span>
                </div>
                {locked > 0 && (
                  <div className="flex items-baseline justify-between text-[10px] text-amber-300">
                    <span>محجوز 14 يومًا:</span>
                    <span className="font-num font-bold">{formatNumber(locked)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* TAB 1: Active Market Order Book */}
        {tab === 'exchange' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-700/45 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-sky-300" />
                  <span>العروض النشطة ({activeOffers.length})</span>
                </h3>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setResourceFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      resourceFilter === 'all'
                        ? 'bg-[#1D4ED8] text-white'
                        : 'bg-slate-900 text-slate-300'
                    }`}
                  >
                    الكل
                  </button>
                  {(Object.keys(MARKET_RESOURCES_META) as MarketResourceId[]).map((rid) => (
                    <button
                      key={rid}
                      type="button"
                      onClick={() => setResourceFilter(rid)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                        resourceFilter === rid
                          ? 'bg-[#1D4ED8] text-white'
                          : 'bg-slate-900 text-slate-300'
                      }`}
                    >
                      {MARKET_RESOURCES_META[rid].name}
                    </button>
                  ))}
                </div>
              </div>

              {activeOffers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  لا توجد عروض نشطة مطابقة للفلتر حاليًا.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/70">
                  {activeOffers.map((offer) => {
                    const isMine = offer.sellerId === state.accountId;
                    const rMeta = MARKET_RESOURCES_META[offer.resource];
                    const rIcon = RESOURCE_ICON_MAP[offer.resource];
                    const Icon = rIcon.icon;
                    const offerBounds = state.adminConfig.resourcePriceBounds[offer.resource];
                    const qtyInput = Math.max(
                      1,
                      Math.min(offer.remainingQty, buyQtys[offer.id] ?? Math.min(1000, offer.remainingQty))
                    );
                    const dealMetrics = calculateMarketDealMetrics(
                      state,
                      offer.resource,
                      qtyInput,
                      offer.unitPriceGems
                    );
                    const totalCostGems = dealMetrics.grossGems;
                    const isEditing = editingOfferId === offer.id;

                    return (
                      <div key={offer.id} className="p-4 space-y-2.5 hover:bg-slate-900/40 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${rIcon.tint}`} />
                            <span className="font-bold text-slate-100 text-sm">
                              {rMeta.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-num text-[11px] text-amber-300">
                              المتاح: {formatNumber(offer.remainingQty)} {rMeta.unit}
                            </span>
                            {isMine && (
                              <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[10px] font-bold text-sky-200">
                                عرضك
                              </span>
                            )}
                            {!offerBounds.enabled && (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-[10px] font-bold text-rose-200">
                                متوقف إداريًا
                              </span>
                            )}
                          </div>

                          <div className="font-num font-bold text-amber-300 text-sm">
                            {offer.unitPriceGems} جوهرة / 1,000 {rMeta.unit}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span>
                            البائع: <strong className="text-slate-200">{offer.sellerName}</strong> ({offer.sellerCity} · رئيسي {offer.sellerMainLevel})
                          </span>
                          <span className="font-num">
                            المرجعي: {offerBounds.referencePrice} · ينتهي خلال: {formatDuration(Math.max(0, (offer.expiresAt - now) / 1000))}
                          </span>
                        </div>

                        {isMine ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {isEditing ? (
                              <>
                                <input
                                  type="number"
                                  step={0.1}
                                  min={offerBounds.min}
                                  max={offerBounds.max}
                                  value={editPriceVal}
                                  onChange={(e) => setEditPriceVal(Number(e.target.value) || offerBounds.min)}
                                  className="w-28 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-num text-slate-100"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    onEditOffer(offer.id, editPriceVal);
                                    setEditingOfferId(null);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                >
                                  حفظ السعر
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingOfferId(null)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                                >
                                  إلغاء
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingOfferId(offer.id);
                                    setEditPriceVal(offer.unitPriceGems);
                                  }}
                                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-200 font-bold flex items-center gap-1"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>تعديل السعر</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={offer.reservedQty > 0}
                                  onClick={() => onCancelOffer(offer.id)}
                                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 font-bold flex items-center gap-1 disabled:opacity-50"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>إلغاء العرض وإرجاع الكمية</span>
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <label className="text-[11px] text-slate-400">الكمية:</label>
                            <input
                              type="number"
                              min={1}
                              max={offer.remainingQty}
                              value={qtyInput}
                              onChange={(e) =>
                                setBuyQtys((prev) => ({
                                  ...prev,
                                  [offer.id]: Math.max(
                                    1,
                                    Math.min(offer.remainingQty, Number(e.target.value) || 1)
                                  ),
                                }))
                              }
                              className="w-24 min-h-[38px] px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 font-num text-slate-100 text-center"
                            />
                            <button
                              type="button"
                              disabled={!unlocked || isFrozen || !offerBounds.enabled || totalGems + 1e-6 < totalCostGems}
                              onClick={() => onInitiateBuy(offer.id, qtyInput)}
                              className={`min-h-[38px] px-4 py-1.5 rounded-xl font-bold transition-colors ${
                                unlocked && !isFrozen && offerBounds.enabled && totalGems + 1e-6 >= totalCostGems
                                  ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {!offerBounds.enabled
                                ? 'التداول متوقف إداريًا'
                                : !unlocked
                                  ? 'يفتح عند المبنى الرئيسي 10'
                                  : totalGems + 1e-6 < totalCostGems
                                    ? `تحتاج ${formatDecimal(totalCostGems)} جوهرة`
                                    : `شراء (${formatDecimal(totalCostGems)} جوهرة · 5ث إلغاء)`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Market Rules & Hakim Advisory Card */}
            <div className="space-y-3.5">
              <div className="glass-panel p-4 sm:p-5 rounded-2xl space-y-2.5 text-xs">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  <span>ضوابط السوق العادل ونقاط التجارة</span>
                </h3>
                <ul className="space-y-1.5 text-slate-300 leading-relaxed">
                  <li>· التسعير لكل <strong className="text-slate-100">1,000 وحدة</strong> ضمن النطاق المعتمد إداريًا (70% – 150% من المرجعي).</li>
                  <li>· نقاط التجارة عند المستوى 10+: <strong className="text-emerald-300">{state.adminConfig.tradePointsPer100NetGems} نقطة لكل 100 جوهرة صافية</strong> على القيمة الأقل من البيع أو المرجعي بعد خصم 5% عمولة.</li>
                  <li>· حصة البيع الشهرية: 1% لكل مستوى مبنى رئيسي (حتى 30%، وحكيم يرفعها +5% حتى 35%).</li>
                  <li>· صلاحية العرض 7 أيام، والمشتريات محظورة من إعادة البيع 14 يومًا، مع 5 ثوانٍ لإلغاء الشراء.</li>
                </ul>
              </div>

              <div className="glass-panel p-4 sm:p-5 rounded-2xl border-amber-500/35 space-y-2 text-xs">
                <h3 className="text-sm font-bold text-sky-300 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber-400" />
                  <span>دور المستشار حكيم في السوق</span>
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  {state.smartBotActive
                    ? 'المستشار الذكي حكيم يرفع سقف حصتك الشهرية +5% ويسمح بعرضين نشطين متزامنين، ويقترح السعر المرجعي العادل فقط دون أي بيع أو شراء تلقائي.'
                    : 'جميع صفقات البيع والشراء تُنفذ يدويًا بقرارك المباشر؛ يمكنك تفعيل حكيم لرفع حصتك الشهرية +5% والحصول على عرضين نشطين.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Publish Market Offer */}
        {tab === 'publish' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-100">نشر عرض بيع جديد بالجواهر</h3>

              <div>
                <label className="block text-slate-300 mb-1.5">المورد المراد بيعه</label>
                <select
                  value={pubResource}
                  onChange={(e) => handleSelectPubResource(e.target.value as MarketResourceId)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100"
                >
                  {(Object.keys(MARKET_RESOURCES_META) as MarketResourceId[]).map((rid) => {
                    const m = MARKET_RESOURCES_META[rid];
                    const avail = getSellableResourceQty(state, rid, now);
                    return (
                      <option key={rid} value={rid}>
                        {m.name} — المتاح للبيع: {formatNumber(avail)} {m.unit}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1.5">
                    الكمية (أقصاه {formatNumber(Math.min(sellableSelected, quota.remainingUnits))})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Math.min(sellableSelected, quota.remainingUnits))}
                    value={pubQty}
                    onChange={(e) => setPubQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 font-num text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1.5">
                    السعر لكل 1,000 وحدة ({bounds.min} – {bounds.max} جوهرة)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={bounds.min}
                    max={bounds.max}
                    value={pubPrice}
                    onChange={(e) => setPubPrice(Number(e.target.value) || bounds.min)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 font-num text-slate-100"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/35 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-200">
                  <Info className="w-4 h-4 text-sky-300 shrink-0" />
                  <span>
                    السعر المرجعي الرسمي لكل 1,000 وحدة:{' '}
                    <strong className="font-num text-amber-300">{suggestedFairPrice} جوهرة</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPubPrice(suggestedFairPrice)}
                  className="px-2.5 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-100 font-bold shrink-0"
                >
                  تطبيق
                </button>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-100">ملخص العرض والعمولة ونقاط التجارة</h3>
                <div className="glass-subpanel p-4 rounded-xl space-y-2 font-num">
                  <div className="flex justify-between">
                    <span className="text-slate-400">إجمالي قيمة البيع الفعلية</span>
                    <span className="font-bold text-slate-100">
                      {formatDecimal(publishMetrics.grossGems)} جوهرة
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">القيمة المؤهلة للنقاط (الأقل من الفعلي أو المرجعي)</span>
                    <span className="font-bold text-sky-300">
                      {formatDecimal(publishMetrics.eligibleGrossGems)} جوهرة
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      عمولة المنصة ({state.adminConfig.marketFeePct}%)
                    </span>
                    <span className="font-bold text-amber-300">
                      {formatDecimal(publishMetrics.commissionGems)} جوهرة
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-700/45 text-sm">
                    <span className="font-bold text-slate-100">صافي العائد (جواهر سوق)</span>
                    <span className="font-bold text-emerald-300">
                      {formatDecimal(publishMetrics.netSellerGems)} جوهرة
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-slate-300">
                      نقاط التجارة المتوقعة ({state.adminConfig.tradePointsPer100NetGems} / 100 صافي مرجعي)
                    </span>
                    <span className="font-bold text-emerald-300">
                      +{formatDecimal(publishMetrics.tradePointsEarned)} نقطة
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  العروض النشطة: {activePlayerOffers.length} / {quota.maxActiveOffers} · متبقي من الحصة الشهرية: {formatNumber(quota.remainingUnits)} وحدة.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  !unlocked ||
                  isFrozen ||
                  !bounds.enabled ||
                  activePlayerOffers.length >= quota.maxActiveOffers ||
                  pubQty > sellableSelected ||
                  pubQty > quota.remainingUnits
                }
                onClick={() => {
                  onPublishOffer(pubResource, pubQty, pubPrice);
                  setTab('exchange');
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold transition-colors"
              >
                {!bounds.enabled
                  ? 'تم إيقاف تداول هذا المنتج إداريًا'
                  : unlocked
                    ? 'نشر عرض البيع الآن'
                    : `يفتح عند المبنى الرئيسي 10 (حاليًا ${mainLv})`}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Searchable Trade Ledger (السجل التجاري) */}
        {tab === 'ledger' && (
          <div className="glass-panel rounded-2xl overflow-hidden text-xs">
            <div className="px-4 py-3.5 border-b border-slate-700/45 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-100">السجل التجاري الموثق</h3>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ledgerQuery}
                  onChange={(e) => setLedgerQuery(e.target.value)}
                  placeholder="بحث بالمورد أو التاجر..."
                  className="w-full min-h-[38px] pr-9 pl-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100"
                />
              </div>
            </div>

            {filteredLedger.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                لا توجد عمليات مسجلة مطابقة للبحث في السجل التجاري حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right min-w-[640px]">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">العملية</th>
                      <th className="py-2.5 px-3">السلعة والكمية</th>
                      <th className="py-2.5 px-3">السعر (/1,000)</th>
                      <th className="py-2.5 px-3">العمولة / الصافي</th>
                      <th className="py-2.5 px-3">الأطراف</th>
                      <th className="py-2.5 px-3">التوقيت (UTC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredLedger.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-3 font-bold text-amber-300">
                          {row.note}
                        </td>
                        <td className="py-2.5 px-3 font-num text-slate-100">
                          {formatNumber(row.quantity)} {MARKET_RESOURCES_META[row.resource]?.name}
                        </td>
                        <td className="py-2.5 px-3 font-num text-sky-300">
                          {row.unitPriceGems} ج
                        </td>
                        <td className="py-2.5 px-3 font-num text-emerald-300">
                          {row.grossGems > 0
                            ? `عمولة ${row.commissionGems} · صافي ${row.netGems}${
                                row.tradePointsEarned ? ` · +${row.tradePointsEarned} نقطة` : ''
                              }`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {row.sellerName} → {row.buyerName}
                        </td>
                        <td className="py-2.5 px-3 font-num text-[11px] text-slate-400">
                          {formatKsaDateTime(row.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  5. AlliancesView (10-Member Cap, Free First Creation, 30d Cooldown §61)   */
/* -------------------------------------------------------------------------- */

const REGIONAL_ALLIANCES = [
  {
    id: 'al-1',
    tag: 'SHLD',
    name: 'ائتلاف درع الشمال',
    leader: 'الأمير سيف',
    members: '8 / 10',
    power: 42850,
    perk: '+8% كفاءة الشحن البحري وحماية الممرات',
    minMainLv: 3,
  },
  {
    id: 'al-2',
    tag: 'IRON',
    name: 'اتحاد التعدين والصناعة',
    leader: 'القائدة نورة',
    members: '7 / 10',
    power: 38120,
    perk: '+6% توريد الخامات وتأمين القوافل البرية',
    minMainLv: 3,
  },
  {
    id: 'al-3',
    tag: 'GULF',
    name: 'تحالف موانئ الخليج للطاقة',
    leader: 'المهندس راشد',
    members: '9 / 10',
    power: 51900,
    perk: '+10% تنسيق آبار النفط والغاز البحرية',
    minMainLv: 5,
  },
];

const COUNCIL_PROPOSALS = [
  {
    id: 'prop-1',
    title: 'تنسيق خطوط الإمداد والدفاع المشترك بين المدن المتحالفة',
    endsIn: '18 ساعة متبقية',
    yesPct: 78,
    noPct: 22,
  },
  {
    id: 'prop-2',
    title: 'توحيد دوريات الاستطلاع حول المواقع الاستراتيجية',
    endsIn: '6 ساعات متبقية',
    yesPct: 64,
    noPct: 36,
  },
];

export interface AlliancesViewProps {
  state: GameState;
  now?: number;
  onCreateAlliance?: (name: string, tag: string) => void;
  onLeaveAlliance?: () => void;
}

export const AlliancesView: React.FC<AlliancesViewProps> = ({
  state,
  now = Date.now(),
  onCreateAlliance,
  onLeaveAlliance,
}) => {
  const [tab, setTab] = useState<'directory' | 'council' | 'treasury'>('directory');
  const [votedProposals, setVotedProposals] = useState<Record<string, 'yes' | 'no'>>({});
  const [allianceName, setAllianceName] = useState('');
  const [allianceTag, setAllianceTag] = useState('');

  const mainLv = getMainBuildingLevel(state);
  const acLv = getAllianceCenterLevel(state);
  const cityPts = getCityPoints(state);
  const embassySlots =
    ALLIANCE_CENTER_UPGRADE_TABLE.find((r) => r.level === acLv)?.embassySlots ?? 0;
  const centerReady = mainLv >= 3 && acLv >= 1;

  const currentAlliance = state.allianceMeta.currentAlliance;
  const cooldownMs = 30 * 24 * 60 * 60 * 1000;
  const cooldownRemainingMs = state.allianceMeta.lastCreatedAllianceAt
    ? Math.max(0, cooldownMs - (now - state.allianceMeta.lastCreatedAllianceAt))
    : 0;

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(29,78,216,0.16),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(14,165,233,0.12),transparent_45%)]">
      <div className="max-w-6xl mx-auto space-y-5 pb-6">
        <PanelHeader
          icon={Users}
          title="التحالفات والدبلوماسية"
          subtitle="حد التحالف الأقصى 10 لاعبين — إنشاء التحالف الأول مجاني تمامًا مع مهلة 30 يومًا قبل تأسيس تحالف آخر."
          rightSlot={
            <div className="flex items-center gap-1 p-1 rounded-xl glass-subpanel overflow-x-auto no-scrollbar max-w-full">
              {[
                { id: 'directory', label: 'دليل وتأسيس التحالف', icon: Users },
                { id: 'council', label: 'التصويت والتنسيق', icon: Vote },
                { id: 'treasury', label: 'الدفاع والوفود', icon: Landmark },
              ].map((t) => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id as typeof tab)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      tab === t.id
                        ? 'bg-[#1D4ED8] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          }
        />

        {/* Status & Unlock Prerequisites Banner */}
        <div
          className={`glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3.5 text-xs ${
            centerReady
              ? 'border-sky-400/45 text-sky-100'
              : 'border-amber-500/45 text-amber-100'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl glass-subpanel flex items-center justify-center shrink-0">
              {centerReady ? (
                <Landmark className="w-5 h-5 text-sky-300" />
              ) : (
                <Lock className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-sm">
                {centerReady
                  ? `مركز التحالف نشط (مستوى ${acLv}) — متاح ${embassySlots} مكاتب بعثات للدعم`
                  : `تُفتح التحالفات عند المبنى الرئيسي 3 وبناء مركز التحالف (الحالي: ${mainLv} · المركز: ${acLv})`}
              </div>
              <p className="text-slate-300/90 leading-relaxed">
                الحد الأقصى لأعضاء التحالف الواحد هو 10 لاعبين. التأسيس الأول مجاني بالكامل مع فاصل 30 يومًا بين كل تأسيس وآخر.
              </p>
            </div>
          </div>

          <div className="font-num glass-subpanel px-4 py-2.5 rounded-xl text-right shrink-0">
            <div className="text-[10px] text-slate-400">نقاط مدينتك</div>
            <div className="font-bold text-amber-300">{formatNumber(cityPts)} نقطة</div>
          </div>
        </div>

        {/* Active Player Alliance Card if in an Alliance */}
        {currentAlliance && (
          <div className="glass-panel p-5 rounded-2xl border-emerald-500/50 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 font-num font-bold text-emerald-300">
                  [{currentAlliance.tag}]
                </span>
                <h3 className="text-base font-bold text-slate-100">
                  {currentAlliance.name}
                </h3>
                <span className="text-[11px] font-num text-sky-300">
                  ({currentAlliance.memberCount} / {currentAlliance.maxMembers} أعضاء)
                </span>
              </div>
              <div className="text-slate-300">
                القائد: <strong className="text-amber-300">{currentAlliance.leaderName}</strong> · تأسس في {formatKsaDateTime(currentAlliance.createdAt)}
              </div>
            </div>
            {onLeaveAlliance && (
              <button
                type="button"
                onClick={onLeaveAlliance}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/45 text-rose-200 font-bold"
              >
                مغادرة التحالف
              </button>
            )}
          </div>
        )}

        {/* TAB 1: Directory & Create Alliance */}
        {tab === 'directory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3.5">
              {REGIONAL_ALLIANCES.map((al) => (
                <div
                  key={al.id}
                  className="group glass-panel p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-sky-400/40"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded-lg bg-blue-950/70 border border-sky-400/40 text-[11px] font-num font-bold text-sky-300">
                        [{al.tag}]
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-100">
                        {al.name}
                      </h3>
                    </div>
                    <div className="text-xs text-slate-300/85 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>القائد: {al.leader}</span>
                      <span>·</span>
                      <span className="font-num">الأعضاء: {al.members}</span>
                      <span>·</span>
                      <span className="font-num text-amber-300">
                        القوة: {formatNumber(al.power)}
                      </span>
                    </div>
                    <div className="text-xs text-emerald-300 font-medium">{al.perk}</div>
                  </div>

                  <button
                    type="button"
                    disabled={!centerReady || mainLv < al.minMainLv || Boolean(currentAlliance)}
                    className={`w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      centerReady && mainLv >= al.minMainLv && !currentAlliance
                        ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {currentAlliance
                      ? 'منضم لتحالف حاليًا'
                      : !centerReady
                        ? 'يتطلب مركز التحالف'
                        : mainLv < al.minMainLv
                          ? `يتطلب المبنى الرئيسي ${al.minMainLv}`
                          : 'إرسال طلب انضمام'}
                  </button>
                </div>
              ))}
            </div>

            <div className="group glass-panel p-5 rounded-2xl space-y-3.5 text-xs h-fit">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                  <Users className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>تأسيس تحالف جديد</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  مجاني (10 أعضاء)
                </span>
              </div>
              <p className="text-slate-300/85 leading-relaxed">
                أنشئ تحالفك الخاص مجانًا وادعُ حتى 9 قادة آخرين لتنسيق الدفاع والمشروعات المشتركة.
              </p>
              {cooldownRemainingMs > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-500/40 text-[11px] text-amber-200 font-num">
                  مهلة التأسيس التالي: متبقي {Math.ceil(cooldownRemainingMs / (24 * 60 * 60 * 1000))} يومًا من أصل 30 يومًا.
                </div>
              )}
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={allianceName}
                  onChange={(e) => setAllianceName(e.target.value)}
                  placeholder="اسم التحالف (3 أحرف على الأقل)"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100"
                />
                <input
                  type="text"
                  maxLength={4}
                  value={allianceTag}
                  onChange={(e) => setAllianceTag(e.target.value.toUpperCase())}
                  placeholder="اختصار التحالف (مثل ENGN)"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 font-num text-slate-100"
                />
                <button
                  type="button"
                  disabled={
                    !centerReady ||
                    Boolean(currentAlliance) ||
                    cooldownRemainingMs > 0 ||
                    !onCreateAlliance
                  }
                  onClick={() => {
                    if (onCreateAlliance) {
                      onCreateAlliance(allianceName, allianceTag);
                    }
                  }}
                  className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold transition-colors ${
                    centerReady && !currentAlliance && cooldownRemainingMs <= 0
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {currentAlliance
                    ? 'غادر تحالفك الحالي أولًا'
                    : cooldownRemainingMs > 0
                      ? 'ضمن فترة الـ 30 يومًا'
                      : centerReady
                        ? 'إنشاء التحالف مجانًا'
                        : 'ابنِ مركز التحالف أولًا (رئيسي 3)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Diplomatic Council & Coalition Voting */}
        {tab === 'council' && (
          <div className="space-y-4">
            {COUNCIL_PROPOSALS.map((prop) => {
              const vote = votedProposals[prop.id];
              return (
                <div
                  key={prop.id}
                  className="group glass-panel p-5 rounded-2xl space-y-3.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                      <Vote className="w-4 h-4 text-sky-300 transition-transform group-hover:scale-110 shrink-0" />
                      <span>{prop.title}</span>
                    </div>
                    <span className="font-num text-amber-300 font-bold">
                      {prop.endsIn}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-slate-900/90 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${prop.yesPct}%` }}
                    />
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${prop.noPct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-num text-slate-300">
                      موافق: <span className="text-emerald-300 font-bold">{prop.yesPct}%</span> · معارض:{' '}
                      <span className="text-rose-300 font-bold">{prop.noPct}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!centerReady}
                        onClick={() =>
                          setVotedProposals((p) => ({ ...p, [prop.id]: 'yes' }))
                        }
                        className={`min-h-[42px] px-4 py-1.5 rounded-xl font-bold ${
                          vote === 'yes'
                            ? 'bg-emerald-600 text-white'
                            : centerReady
                              ? 'bg-slate-800/80 hover:bg-emerald-700 text-slate-200'
                              : 'bg-slate-900/80 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        موافق
                      </button>
                      <button
                        type="button"
                        disabled={!centerReady}
                        onClick={() =>
                          setVotedProposals((p) => ({ ...p, [prop.id]: 'no' }))
                        }
                        className={`min-h-[42px] px-4 py-1.5 rounded-xl font-bold ${
                          vote === 'no'
                            ? 'bg-rose-600 text-white'
                            : centerReady
                              ? 'bg-slate-800/80 hover:bg-rose-700 text-slate-200'
                              : 'bg-slate-900/80 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        معارض
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: Shared Defense Reinforcements & Coordination */}
        {tab === 'treasury' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="group glass-panel p-5 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-sky-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>دعم الحلفاء وحماية المدينة</span>
                </span>
                <span className="font-num font-bold text-amber-300">
                  {embassySlots} بعثات
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                يستقبل مركز التحالف قوات المساعدة من أعضاء التحالف (حد أقصى 10 أعضاء) لحماية المدينة وقت الخطر.
              </p>
              <div className="glass-subpanel p-3.5 rounded-xl space-y-2 font-num">
                <div className="flex justify-between">
                  <span className="text-slate-400">مستوى مركز التحالف</span>
                  <span className="font-bold text-slate-100">{acLv} / 5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">سعة البعثات المتاحة</span>
                  <span className="font-bold text-sky-300">{embassySlots} وفود</span>
                </div>
              </div>
            </div>

            <div className="group glass-panel p-5 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <Landmark className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>ضوابط العضوية والتأسيس</span>
                </span>
                <span className="text-[11px] text-emerald-300 font-bold">مفعّل</span>
              </div>
              <ul className="space-y-2 text-slate-300 leading-relaxed">
                <li>· الحد الأقصى لأعضاء التحالف: <strong className="font-num text-amber-300">10</strong> لاعبين.</li>
                <li>· تأسيس أول تحالف: <strong className="text-emerald-300">مجاني بالكامل</strong>.</li>
                <li>· مهلة التبريد بين كل إنشاء تحالف جديد: <strong className="font-num text-sky-300">30 يومًا</strong>.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
