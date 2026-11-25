import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Hammer,
  Lock,
  MapPin,
  Wrench,
} from 'lucide-react';
import {
  BUILDINGS_META,
  CITY_PLOTS,
  HQ_UPGRADE_TABLE,
  PRODUCTION_RATES_PER_HOUR,
} from '../data/gameData';
import {
  canAfford,
  formatDuration,
  formatDurationArabic,
  formatNumber,
  getHqLevel,
  getMaxBuildSlots,
  getNextBuildingUpgradeSpec,
} from '../engine/gameEngine';
import { BuildingType, GameState } from '../types/game';
import { BuildingArtPreview } from './BuildingArtPreview';
import { PanelHeader, ResourceCostRow } from './PanelPrimitives';

interface BuildCatalogViewProps {
  state: GameState;
  now: number;
  onStartPlaceOnMap: (type: BuildingType) => void;
  onUpgradeBuilding: (buildingId: string) => void;
  onFocusPlotOnCity: (plotId: string) => void;
}

const CATALOG_ORDER: BuildingType[] = [
  'hq',
  'warehouse',
  'farm',
  'sawmill',
  'iron_mine',
  'seaport',
  'offshore_rig',
  'hospital',
  'alliance_center',
  'fortifications',
  'research_center',
  'barracks',
];

const NEW_BUILDING_GROUPS: Record<
  'all' | 'production' | 'city_sea' | 'military',
  { label: string; types: BuildingType[] }
> = {
  all: {
    label: 'الكل',
    types: ['farm', 'sawmill', 'iron_mine', 'seaport', 'offshore_rig', 'hospital', 'alliance_center', 'research_center', 'barracks'],
  },
  production: {
    label: 'إنتاج الموارد',
    types: ['farm', 'sawmill', 'iron_mine'],
  },
  city_sea: {
    label: 'البحر والمدينة',
    types: ['seaport', 'offshore_rig', 'hospital', 'alliance_center', 'research_center'],
  },
  military: {
    label: 'الجيش',
    types: ['barracks'],
  },
};

export const BuildCatalogView: React.FC<BuildCatalogViewProps> = ({
  state,
  now,
  onStartPlaceOnMap,
  onUpgradeBuilding,
  onFocusPlotOnCity,
}) => {
  const [tab, setTab] = useState<'existing' | 'new' | 'roadmap'>('existing');
  const [newFilter, setNewFilter] = useState<keyof typeof NEW_BUILDING_GROUPS>('all');

  const hqLv = getHqLevel(state);
  const maxSlots = getMaxBuildSlots(state);
  const slotsFull = state.buildQueue.length >= maxSlots;

  const catalogTypes = NEW_BUILDING_GROUPS[newFilter].types.filter((t) =>
    CATALOG_ORDER.includes(t)
  );

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#080F1E]">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
        <PanelHeader
          icon={Hammer}
          title="البناء والتطوير"
          subtitle={`لديك ${state.buildQueue.length} من ${maxSlots} خانات بناء قيد العمل الآن — اختر أي منشأة لترقيتها أو أنشئ منشأة جديدة في مدينتك.`}
          rightSlot={
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/75 border border-slate-700/70 overflow-x-auto no-scrollbar max-w-full">
              {[
                { id: 'existing', label: `مبانيك (${state.buildings.length})` },
                { id: 'new', label: 'تشييد مبنى جديد' },
                { id: 'roadmap', label: 'ترقيات المبنى الرئيسي' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    tab === t.id
                      ? 'bg-[#1D4ED8] text-white shadow'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        />

        {slotsFull && (
          <div className="px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-2">
            <span>
              جميع خانات البناء مشغولة حاليًا ({state.buildQueue.length}/{maxSlots}). انتظر انتهاء العمل الجاري أو سرّعه من أسفل الشاشة.
            </span>
          </div>
        )}

        {/* TAB 1: Active City Buildings */}
        {tab === 'existing' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {state.buildings.map((b) => {
              const meta = BUILDINGS_META[b.type];
              const plot = CITY_PLOTS.find((p) => p.id === b.plotId);
              const job = state.buildQueue.find((q) => q.buildingId === b.id);
              const isBusy = b.status === 'CONSTRUCTING' || b.status === 'UPGRADING';
              const nextSpec = getNextBuildingUpgradeSpec(state, b.type, b.level);
              const isMax = b.level >= meta.maxLevel;
              const affordable = canAfford(state.resources, nextSpec.cost);
              const canUpg =
                !isBusy && !isMax && !slotsFull && nextSpec.canUpgrade && affordable;
              const pct = job
                ? Math.min(
                    100,
                    Math.max(
                      4,
                      Math.round(
                        ((now - job.startedAt) /
                          Math.max(1, job.endsAt - job.startedAt)) *
                          100
                      )
                    )
                  )
                : 0;

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl glass-panel flex flex-col justify-between gap-3.5 hover:border-slate-500/70 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-100 truncate">
                          {meta.name}
                        </h3>
                        <span className="text-xs font-num font-bold text-amber-300">
                          مستوى {b.level}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {plot?.districtName ?? 'المدينة'}
                        {b.level > 0 &&
                        (b.type === 'farm' ||
                          b.type === 'sawmill' ||
                          b.type === 'iron_mine')
                          ? ` · ينتج +${PRODUCTION_RATES_PER_HOUR[b.level]} / ساعة`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onFocusPlotOnCity(b.plotId)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-semibold text-sky-300 flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>عرض بالمدينة</span>
                    </button>
                  </div>

                  {isBusy && job ? (
                    <div className="p-3 rounded-lg bg-amber-950/25 border border-amber-500/35 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-200 font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {b.status === 'CONSTRUCTING'
                            ? 'جارٍ البناء الأول'
                            : `جارٍ الترقية للمستوى ${job.toLevel}`}
                        </span>
                        <span className="font-num font-bold text-amber-300">
                          {formatDuration((job.endsAt - now) / 1000)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ) : isMax ? (
                    <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>وصل هذا المبنى إلى الحد الأقصى ({meta.maxLevel})</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
                      <ResourceCostRow
                        cost={nextSpec.cost}
                        currentResources={state.resources}
                        durationSec={nextSpec.durationSec}
                      />

                      {!nextSpec.canUpgrade && nextSpec.lockReasons[0] && (
                        <div className="text-[11px] text-amber-300 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>{nextSpec.lockReasons[0]}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!canUpg}
                        onClick={() => onUpgradeBuilding(b.id)}
                        className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          canUpg
                            ? 'bg-[#D97706] hover:bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>
                          {!nextSpec.canUpgrade
                            ? 'أكمل المتطلبات أعلاه أولًا'
                            : !affordable
                              ? 'الموارد غير كافية للترقية'
                              : slotsFull
                                ? 'لا توجد خانة بناء متاحة'
                                : `ترقية إلى المستوى ${nextSpec.nextLevel}`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: New Buildings Catalog */}
        {tab === 'new' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-0.5">
                {(Object.keys(NEW_BUILDING_GROUPS) as (keyof typeof NEW_BUILDING_GROUPS)[]).map(
                  (key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewFilter(key)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                        newFilter === key
                          ? 'bg-sky-600 border-sky-400 text-white'
                          : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {NEW_BUILDING_GROUPS[key].label}
                    </button>
                  )
                )}
              </div>
              <span className="text-xs text-slate-400">
                اختر المبنى ثم حدد موقعه مباشرة على خريطة المدينة
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogTypes.map((type) => {
                const meta = BUILDINGS_META[type];
                const count = state.buildings.filter((b) => b.type === type).length;
                const atLimit = !meta.allowMultiple
                  ? count >= 1
                  : count >= meta.maxInstances;
                const hqLocked = hqLv < meta.minHqToBuild;
                const spec = getNextBuildingUpgradeSpec(state, type, 0);

                return (
                  <div
                    key={type}
                    className="p-4 rounded-2xl glass-panel flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2.5">
                      <BuildingArtPreview type={type} className="aspect-[4/3] w-full" />
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-100">
                          {meta.name}
                        </h3>
                        <span className="text-xs font-num text-slate-400">
                          مبني: {count}/{meta.maxInstances}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {meta.shortDesc}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                      <ResourceCostRow
                        cost={spec.cost}
                        currentResources={state.resources}
                        durationSec={spec.durationSec}
                      />
                      <button
                        type="button"
                        disabled={atLimit || hqLocked || slotsFull}
                        onClick={() => onStartPlaceOnMap(type)}
                        className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          !atLimit && !hqLocked && !slotsFull
                            ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {hqLocked ? (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>يفتح عند المبنى الرئيسي {meta.minHqToBuild}</span>
                          </>
                        ) : atLimit ? (
                          <span>الحد الأقصى مبني بالكامل</span>
                        ) : (
                          <>
                            <Hammer className="w-3.5 h-3.5" />
                            <span>اختر موقعًا على الخريطة</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: HQ Progression Roadmap */}
        {tab === 'roadmap' && (
          <div className="rounded-2xl border border-slate-800 bg-[#0F172A] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">
                دليل ترقية المبنى الرئيسي (من المستوى 2 حتى 10)
              </h3>
              <span className="text-xs text-amber-300 font-num font-bold">
                مستواك الحالي: المبنى الرئيسي {hqLv}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">المستوى</th>
                    <th className="py-3 px-4 font-semibold">الشروط والمزايا الجديدة</th>
                    <th className="py-3 px-4 font-semibold">التكلفة المطلوبة</th>
                    <th className="py-3 px-4 font-semibold">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {HQ_UPGRADE_TABLE.map((row) => {
                    const done = hqLv >= row.level;
                    const isNext = hqLv + 1 === row.level;
                    return (
                      <tr
                        key={row.level}
                        className={
                          isNext
                            ? 'bg-blue-950/35 text-slate-100'
                            : done
                              ? 'text-emerald-300/85'
                              : 'text-slate-400'
                        }
                      >
                        <td className="py-3 px-4 font-num font-bold whitespace-nowrap">
                          المبنى الرئيسي {row.level} {done ? '✓' : isNext ? '← التالي' : ''}
                        </td>
                        <td className="py-3 px-4">{row.summary}</td>
                        <td className="py-3 px-4 font-num whitespace-nowrap">
                          {formatNumber(row.cost.wheat)} قمح · {formatNumber(row.cost.wood)} خشب · {formatNumber(row.cost.iron)} حديد
                        </td>
                        <td className="py-3 px-4 font-num whitespace-nowrap">
                          {formatDurationArabic(row.durationSec)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
