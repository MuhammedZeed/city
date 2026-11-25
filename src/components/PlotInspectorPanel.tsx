import React, { useState } from 'react';
import {
  Anchor,
  CheckCircle2,
  Clock,
  Flame,
  Gem,
  Lock,
  Ship,
  Shield,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  ALLIANCE_CENTER_UPGRADE_TABLE,
  BUILDINGS_META,
  CITY_PLOTS,
  FORTIFICATION_DEFENSE_POINTS,
  HOSPITAL_UPGRADE_TABLE,
  MARITIME_VESSELS_META,
  OFFSHORE_RIG_UPGRADE_TABLE,
  PRODUCTION_RATES_PER_HOUR,
  SEAPORT_UPGRADE_TABLE,
  SPECIALIZATIONS,
  SPEEDUP_CARDS_META,
  WAREHOUSE_CAPACITIES,
} from '../data/gameData';
import {
  canAfford,
  formatDuration,
  formatDurationArabic,
  formatNumber,
  getExposedExcessResources,
  getInstantFinishBuildCost,
  getMainBuildingLevel,
  getMaxBuildSlots,
  getNextBuildingUpgradeSpec,
  getProtectedWarehouseCapacity,
  getTotalGems,
} from '../engine/gameEngine';
import {
  BuildingType,
  GameState,
  SpecializationId,
  SpeedUpTierId,
} from '../types/game';
import { BuildingArtPreview } from './BuildingArtPreview';
import { ResourceCostRow } from './PanelPrimitives';

interface PlotInspectorPanelProps {
  state: GameState;
  plotId: string;
  now: number;
  onClose: () => void;
  onBuildNew: (plotId: string, type: BuildingType) => void;
  onUpgrade: (buildingId: string) => void;
  onUseSpeedUp: (queueId: string, tierId: SpeedUpTierId) => void;
  onInstantFinishBuild?: (queueId: string) => void;
  onSelectSpecialization: (specId: SpecializationId) => void;
  onBuildNavalVessel: (vesselType: 'cargo_ship' | 'survey_vessel') => void;
  onDispatchMaritimeTrade: () => void;
  onDispatchOffshoreSurvey: () => void;
}

const BUILDABLE_TYPES: BuildingType[] = [
  'farm',
  'sawmill',
  'iron_mine',
  'hospital',
  'alliance_center',
  'research_center',
  'barracks',
];

export const PlotInspectorPanel: React.FC<PlotInspectorPanelProps> = ({
  state,
  plotId,
  now,
  onClose,
  onBuildNew,
  onUpgrade,
  onUseSpeedUp,
  onInstantFinishBuild,
  onSelectSpecialization,
  onBuildNavalVessel,
  onDispatchMaritimeTrade,
  onDispatchOffshoreSurvey,
}) => {
  const [confirmInstantId, setConfirmInstantId] = useState<string | null>(null);
  const plot = CITY_PLOTS.find((p) => p.id === plotId);
  if (!plot) return null;

  const building = state.buildings.find((b) => b.plotId === plotId);
  const hqLv = getMainBuildingLevel(state);
  const maxSlots = getMaxBuildSlots(state);
  const slotsFull = state.buildQueue.length >= maxSlots;

  // Empty buildable plot
  if (!building || building.status === 'EMPTY') {
    const isWallPlot = plot.fixedType === 'fortifications';
    const typesToShow: BuildingType[] = isWallPlot
      ? ['fortifications']
      : plot.isCoastal
        ? [plot.suggestedType ?? 'seaport']
        : plot.suggestedType
          ? [
              plot.suggestedType,
              ...BUILDABLE_TYPES.filter((t) => t !== plot.suggestedType),
            ]
          : BUILDABLE_TYPES;

    return (
      <aside className="w-full lg:w-[370px] shrink-0 bg-[#0B1222]/98 backdrop-blur-xl border-t lg:border-t-0 lg:border-r border-slate-700/80 rounded-t-3xl lg:rounded-none max-h-[82dvh] lg:max-h-full lg:h-full flex flex-col overflow-hidden shadow-2xl">
        <div className="lg:hidden w-12 h-1.5 rounded-full bg-slate-600/80 mx-auto mt-2.5 shrink-0" />
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              {isWallPlot
                ? 'التحصينات الدفاعية'
                : plot.isCoastal
                  ? 'موقع بحري تفاعلي'
                  : 'موقع بناء جديد'}
            </h3>
            <p className="text-xs text-slate-400">
              {plot.districtName} · متاح للبناء
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {slotsFull && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200">
              خانات البناء ممتلئة حاليًا ({state.buildQueue.length}/{maxSlots}). انتظر انتهاء عملية جارية أو استخدم بطاقة تسريع.
            </div>
          )}

          {typesToShow.map((type) => {
            const meta = BUILDINGS_META[type];
            const existingCount = state.buildings.filter((b) => b.type === type).length;
            const reachedLimit = !meta.allowMultiple
              ? existingCount >= 1
              : existingCount >= meta.maxInstances;

            // GDD §5: Incompatible or out-of-scope shouldn't confuse; compatible locked buildings show lock reason
            const spec = getNextBuildingUpgradeSpec(state, type, 0);
            const hqLocked = hqLv < meta.minHqToBuild;
            const affordable = canAfford(state.resources, spec.cost);
            const canBuild =
              !slotsFull && !reachedLimit && !hqLocked && spec.canUpgrade && affordable;

            return (
              <div
                key={type}
                className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-start gap-3">
                  <BuildingArtPreview type={type} className="w-20 aspect-[4/3] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-bold text-slate-100">
                        {meta.name}
                      </div>
                      {meta.allowMultiple && (
                        <span className="text-xs text-slate-400 font-num whitespace-nowrap">
                          {existingCount}/{meta.maxInstances}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {meta.shortDesc}
                    </div>
                  </div>
                </div>

                <ResourceCostRow
                  cost={spec.cost}
                  currentResources={state.resources}
                  durationSec={spec.durationSec}
                />

                {(hqLocked || reachedLimit || !spec.canUpgrade) && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-300">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {reachedLimit
                        ? 'مبني بالفعل في المدينة'
                        : hqLocked
                          ? `يفتح عند المبنى الرئيسي مستوى ${meta.minHqToBuild}`
                          : spec.lockReasons[0]}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canBuild}
                  onClick={() => onBuildNew(plot.id, type)}
                  className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold transition-colors ${
                    canBuild
                      ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {reachedLimit
                    ? 'موجود في المدينة'
                    : hqLocked
                      ? `يفتح عند المبنى الرئيسي ${meta.minHqToBuild}`
                      : !affordable
                        ? 'الموارد غير كافية'
                        : slotsFull
                          ? 'خانات البناء ممتلئة'
                          : `إنشاء ${meta.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    );
  }

  const meta = BUILDINGS_META[building.type];
  const queueJob = state.buildQueue.find((q) => q.buildingId === building.id);
  const nextSpec = getNextBuildingUpgradeSpec(state, building.type, building.level);
  const affordable = canAfford(state.resources, nextSpec.cost);
  const isMaxLevel = building.level >= meta.maxLevel;
  const isBusy = building.status === 'CONSTRUCTING' || building.status === 'UPGRADING';
  const canUpgrade =
    !isBusy && !isMaxLevel && !slotsFull && nextSpec.canUpgrade && affordable;

  const ownedSpeedUps = (Object.keys(SPEEDUP_CARDS_META) as SpeedUpTierId[]).filter(
    (tier) => (state.speedUpCards[tier] ?? 0) > 0
  );

  const renderBuildingStats = () => {
    if (
      building.type === 'farm' ||
      building.type === 'sawmill' ||
      building.type === 'iron_mine'
    ) {
      const currRate = PRODUCTION_RATES_PER_HOUR[building.level] ?? 0;
      const nextRate = PRODUCTION_RATES_PER_HOUR[building.level + 1];
      return (
        <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">الإنتاج الأساسي الحالي</span>
            <span className="font-bold text-emerald-300 font-num">{currRate} / ساعة</span>
          </div>
          {nextRate !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">بعد الترقية (مستوى {building.level + 1})</span>
              <span className="font-bold text-amber-300 font-num">+{nextRate} / ساعة</span>
            </div>
          )}
        </div>
      );
    }
    if (building.type === 'warehouse') {
      const currCap = getProtectedWarehouseCapacity(state);
      const nextCap = WAREHOUSE_CAPACITIES[building.level + 1];
      const { excessTotal, maxLootablePerAttack } = getExposedExcessResources(state);
      return (
        <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">السعة المحمية من النهب</span>
            <span className="font-bold text-sky-300 font-num">{formatNumber(currCap)}</span>
          </div>
          {nextCap !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">سعة الحماية بالمستوى {building.level + 1}</span>
              <span className="font-bold text-amber-300 font-num">{formatNumber(nextCap)}</span>
            </div>
          )}
          {excessTotal > 0 && (
            <div className="flex justify-between text-amber-300 pt-1 border-t border-slate-800">
              <span>فائض مكشوف حاليًا (معرّض حتى 50% نهب)</span>
              <span className="font-num font-bold">
                {formatNumber(excessTotal)} (حد النهب {formatNumber(maxLootablePerAttack)})
              </span>
            </div>
          )}
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 leading-relaxed">
            الإنتاج والغارات والمهام والسوق لا تتوقف أبدًا؛ المخزن يحمي مواردك حتى سعته فقط، وما يزيد عن ذلك يكون عرضة لنهب حتى 50% عند الهجوم.
          </p>
        </div>
      );
    }
    if (building.type === 'fortifications') {
      const currDef = FORTIFICATION_DEFENSE_POINTS[building.level] ?? 0;
      const nextDef = FORTIFICATION_DEFENSE_POINTS[building.level + 1];
      return (
        <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">نقاط التحصين الحالية</span>
            <span className="font-bold text-sky-300 font-num">+{currDef} دفاع</span>
          </div>
          {nextDef !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">عند المستوى {building.level + 1}</span>
              <span className="font-bold text-amber-300 font-num">+{nextDef} دفاع</span>
            </div>
          )}
        </div>
      );
    }
    if (building.type === 'hospital') {
      const currCap =
        HOSPITAL_UPGRADE_TABLE.find((r) => r.level === building.level)?.capacity ?? 0;
      const nextCap = HOSPITAL_UPGRADE_TABLE.find(
        (r) => r.level === building.level + 1
      )?.capacity;
      return (
        <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">السعة الاستشفائية الحالية</span>
            <span className="font-bold text-emerald-300 font-num">{formatNumber(currCap)} سرير</span>
          </div>
          {nextCap !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">بعد الترقية (مستوى {building.level + 1})</span>
              <span className="font-bold text-amber-300 font-num">{formatNumber(nextCap)} سرير</span>
            </div>
          )}
        </div>
      );
    }
    if (building.type === 'alliance_center') {
      const currSlots =
        ALLIANCE_CENTER_UPGRADE_TABLE.find((r) => r.level === building.level)
          ?.embassySlots ?? 0;
      const nextSlots = ALLIANCE_CENTER_UPGRADE_TABLE.find(
        (r) => r.level === building.level + 1
      )?.embassySlots;
      return (
        <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">مكاتب الوفود والتنسيق</span>
            <span className="font-bold text-sky-300 font-num">{currSlots} بعثات</span>
          </div>
          {nextSlots !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">بعد الترقية (مستوى {building.level + 1})</span>
              <span className="font-bold text-amber-300 font-num">{nextSlots} بعثات</span>
            </div>
          )}
        </div>
      );
    }
    if (building.type === 'seaport') {
      const currRow = SEAPORT_UPGRADE_TABLE.find((r) => r.level === building.level);
      const nextRow = SEAPORT_UPGRADE_TABLE.find((r) => r.level === building.level + 1);
      const activeTrade = state.maritime.activeExpeditions.find(
        (e) => e.kind === 'maritime_trade'
      );
      const cargoMeta = MARITIME_VESSELS_META.cargo_ship;
      const canBuildShip = canAfford(state.resources, cargoMeta.cost);

      return (
        <div className="space-y-3">
          <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">سعة الأسطول بالميناء</span>
              <span className="font-bold text-sky-300 font-num">
                {currRow?.maxFleet ?? 0} سفن
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">خصم رسوم الشحن البحري</span>
              <span className="font-bold text-emerald-300 font-num">
                {currRow?.tradeFeeDiscountPct ?? 0}%
              </span>
            </div>
            {nextRow && (
              <div className="flex justify-between">
                <span className="text-slate-400">عند المستوى {building.level + 1}</span>
                <span className="font-bold text-amber-300 font-num">
                  {nextRow.maxFleet} سفن · خصم {nextRow.tradeFeeDiscountPct}%
                </span>
              </div>
            )}
          </div>

          {/* Interactive Coastal Maritime Trade Operations */}
          {building.level > 0 && (
            <div className="p-3.5 rounded-lg bg-sky-950/30 border border-sky-500/40 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-200 flex items-center gap-1.5">
                  <Anchor className="w-4 h-4 text-sky-300" />
                  <span>أسطول التجارة البحرية</span>
                </span>
                <span className="font-num font-bold text-amber-300">
                  {state.maritime.cargoShips} سفينة شحن
                </span>
              </div>

              <div className="text-[11px] text-slate-300">
                تكلفة بناء سفينة: {cargoMeta.cost.wheat} قمح · {cargoMeta.cost.wood} خشب · {cargoMeta.cost.iron} حديد
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={!canBuildShip}
                  onClick={() => onBuildNavalVessel('cargo_ship')}
                  className={`w-full min-h-[42px] py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    canBuildShip
                      ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Ship className="w-4 h-4" />
                  <span>بناء سفينة شحن تجارية</span>
                </button>

                {activeTrade ? (
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-sky-500/40 flex items-center justify-between">
                    <span className="text-sky-200">{activeTrade.title}</span>
                    <span className="font-num font-bold text-amber-300">
                      {formatDuration((activeTrade.endsAt - now) / 1000)}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={state.maritime.cargoShips < 1}
                    onClick={onDispatchMaritimeTrade}
                    className={`w-full min-h-[42px] py-2 px-3 rounded-xl font-bold transition-colors ${
                      state.maritime.cargoShips >= 1
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    إطلاق قافلة تجارة بحرية (عائد موارد + رصيد تجارة)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    if (building.type === 'offshore_rig') {
      const currRow = OFFSHORE_RIG_UPGRADE_TABLE.find((r) => r.level === building.level);
      const activeSurvey = state.maritime.activeExpeditions.find(
        (e) => e.kind === 'offshore_survey'
      );
      const surveyMeta = MARITIME_VESSELS_META.survey_vessel;
      const canBuildSurvey = canAfford(state.resources, surveyMeta.cost);

      return (
        <div className="space-y-3">
          <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">آبار النفط البحرية المكتشفة</span>
              <span className="font-bold text-amber-300 font-num">
                {state.maritime.discoveredOilWells} بئر
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">حقول الغاز الطبيعي البحرية</span>
              <span className="font-bold text-sky-300 font-num">
                {state.maritime.discoveredGasFields} حقل
              </span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-slate-800">
              <span className="text-slate-400">المخزون النفطي / الغاز</span>
              <span className="font-bold text-emerald-300 font-num">
                {formatNumber(state.maritime.crudeOilStock)} نفط · {formatNumber(state.maritime.naturalGasStock)} غاز
              </span>
            </div>
            {currRow && (
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>عائد البعثة للمستوى {building.level}</span>
                <span className="font-num">
                  +{currRow.oilYieldPerSurvey} نفط / +{currRow.gasYieldPerSurvey} غاز
                </span>
              </div>
            )}
          </div>

          {building.level > 0 && (
            <div className="p-3.5 rounded-lg bg-amber-950/25 border border-amber-500/40 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-200 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>أسطول التنقيب والمسح السيزمي</span>
                </span>
                <span className="font-num font-bold text-sky-300">
                  {state.maritime.surveyVessels} سفينة مسح
                </span>
              </div>

              <div className="text-[11px] text-slate-300">
                تكلفة سفينة المسح: {surveyMeta.cost.wheat} قمح · {surveyMeta.cost.wood} خشب · {surveyMeta.cost.iron} حديد
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={!canBuildSurvey}
                  onClick={() => onBuildNavalVessel('survey_vessel')}
                  className={`w-full min-h-[42px] py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    canBuildSurvey
                      ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Ship className="w-4 h-4" />
                  <span>بناء سفينة مسح وتنقيب بحري</span>
                </button>

                {activeSurvey ? (
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/40 flex items-center justify-between">
                    <span className="text-amber-200">{activeSurvey.title}</span>
                    <span className="font-num font-bold text-sky-300">
                      {formatDuration((activeSurvey.endsAt - now) / 1000)}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={state.maritime.surveyVessels < 1}
                    onClick={onDispatchOffshoreSurvey}
                    className={`w-full min-h-[42px] py-2 px-3 rounded-xl font-bold transition-colors ${
                      state.maritime.surveyVessels >= 1
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    إرسال بعثة استكشاف آبار نفط وغاز
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <aside className="w-full lg:w-[370px] shrink-0 bg-[#0B1222]/98 backdrop-blur-xl border-t lg:border-t-0 lg:border-r border-slate-700/80 rounded-t-3xl lg:rounded-none max-h-[82dvh] lg:max-h-full lg:h-full flex flex-col overflow-hidden shadow-2xl">
      <div className="lg:hidden w-12 h-1.5 rounded-full bg-slate-600/80 mx-auto mt-2.5 shrink-0" />
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 shrink-0">
        <div>
          <h3 className="text-base font-bold text-slate-100">
            {meta.name} · مستوى <span className="font-num">{building.level}</span>
          </h3>
          <p className="text-xs text-slate-400">{plot.districtName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
        <BuildingArtPreview type={building.type} className="aspect-[4/3] w-full" />
        <p className="text-xs text-slate-300 leading-relaxed">{meta.shortDesc}</p>

        {renderBuildingStats()}

        {/* Active Construction / Upgrade Progress + Speed-up Cards */}
        {isBusy && queueJob && (
          <div className="p-4 rounded-lg bg-amber-950/25 border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {building.status === 'CONSTRUCTING'
                  ? 'قيد الإنشاء (مستوى 1)'
                  : `قيد التطوير إلى المستوى ${queueJob.toLevel}`}
              </span>
              <span className="font-num font-bold text-amber-200">
                {formatDuration((queueJob.endsAt - now) / 1000)}
              </span>
            </div>

            <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    ((now - queueJob.startedAt) /
                      Math.max(1, queueJob.endsAt - queueJob.startedAt)) *
                      100
                  )}%`,
                }}
              />
            </div>

            {ownedSpeedUps.length > 0 && (
              <div className="pt-2 border-t border-amber-500/20 space-y-2">
                <div className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>استخدام بطاقة تسريع مرتبطة بالحساب:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ownedSpeedUps.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => onUseSpeedUp(queueJob.id, tier)}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-amber-600/30 border border-amber-500/40 text-xs text-amber-200 transition-colors"
                    >
                      {SPEEDUP_CARDS_META[tier].name} ({state.speedUpCards[tier]})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Instant Finish Build Job with ENGINORA GEMS + Pre-Confirm Dialog */}
            {onInstantFinishBuild && (() => {
              const { remainingMinutes, gemCost } = getInstantFinishBuildCost(
                queueJob,
                now,
                state.adminConfig
              );
              const hasEnoughGems = getTotalGems(state) >= gemCost;
              const isConfirming = confirmInstantId === queueJob.id;

              return (
                <div className="pt-2 border-t border-amber-500/20 space-y-2">
                  {isConfirming ? (
                    <div className="p-2.5 rounded-lg bg-slate-950/90 border border-amber-400/60 space-y-2">
                      <div className="text-[11px] text-amber-200 leading-relaxed">
                        تأكيد الإنهاء الفوري للترقية خلال{' '}
                        <span className="font-num font-bold">{Math.ceil(remainingMinutes)}</span> دقيقة متبقية مقابل{' '}
                        <span className="font-num font-bold text-amber-300">{formatNumber(gemCost)}</span> جوهرة؟
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!hasEnoughGems}
                          onClick={() => {
                            onInstantFinishBuild(queueJob.id);
                            setConfirmInstantId(null);
                          }}
                          className={`flex-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold ${
                            hasEnoughGems
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          تأكيد الخصم ({formatNumber(gemCost)} جوهرة)
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmInstantId(null)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!hasEnoughGems}
                      onClick={() => setConfirmInstantId(queueJob.id)}
                      className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        hasEnoughGems
                          ? 'bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200'
                          : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Gem className="w-3.5 h-3.5 text-amber-400" />
                      <span>إنهاء فوري بالجواهر ({formatNumber(gemCost)} جوهرة)</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Specialization Selection inside Main Building when level >= 5 and not yet chosen */}
        {building.type === 'hq' && hqLv >= 5 && !state.specialization && (
          <div className="p-4 rounded-lg bg-blue-950/35 border border-blue-500/40 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-200">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>اختيار التخصص الرئيسي (المبنى الرئيسي مستوى 5)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              اختر تخصص مدينتك الرئيسي. يحتفظ التخصص بإنتاج القمح والخشب والحديد ويفتح مسار أبحاثك ومنتجاتك المستقبلية.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SPECIALIZATIONS) as SpecializationId[]).map((sid) => {
                const sp = SPECIALIZATIONS[sid];
                return (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => onSelectSpecialization(sid)}
                    className="p-2.5 rounded-lg bg-slate-900 hover:bg-blue-900/50 border border-slate-700 hover:border-amber-400 text-right transition-colors"
                  >
                    <div className="text-xs font-bold text-amber-300">{sp.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {sp.tagline}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Upgrade Action Section */}
        {!isBusy && (
          <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
            {isMaxLevel ? (
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>وصل المبنى إلى أقصى مستوى متاح في هذه المرحلة ({meta.maxLevel}).</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    الترقية إلى المستوى {nextSpec.nextLevel}
                  </span>
                  <span className="text-xs text-slate-400 font-num">
                    {formatDurationArabic(nextSpec.durationSec)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-num">
                  <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">قمح</div>
                    <div className={state.resources.wheat >= nextSpec.cost.wheat ? 'text-amber-300 font-bold' : 'text-rose-400 font-bold'}>
                      {formatNumber(nextSpec.cost.wheat)}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">خشب</div>
                    <div className={state.resources.wood >= nextSpec.cost.wood ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                      {formatNumber(nextSpec.cost.wood)}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">حديد</div>
                    <div className={state.resources.iron >= nextSpec.cost.iron ? 'text-sky-300 font-bold' : 'text-rose-400 font-bold'}>
                      {formatNumber(nextSpec.cost.iron)}
                    </div>
                  </div>
                </div>

                {!nextSpec.canUpgrade && nextSpec.lockReasons.length > 0 && (
                  <div className="p-2.5 rounded bg-slate-950 border border-amber-500/30 space-y-1">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>متطلبات الترقية غير المكتملة:</span>
                    </div>
                    {nextSpec.lockReasons.map((reason, idx) => (
                      <div key={idx} className="text-[11px] text-slate-300">
                        · {reason}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canUpgrade}
                  onClick={() => onUpgrade(building.id)}
                  className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    canUpgrade
                      ? 'bg-[#D97706] hover:bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>
                    {slotsFull
                      ? 'خانات البناء ممتلئة'
                      : !nextSpec.canUpgrade
                        ? 'استكمل المتطلبات أولًا'
                        : !affordable
                          ? 'الموارد غير كافية'
                          : `ترقية إلى المستوى ${nextSpec.nextLevel}`}
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
