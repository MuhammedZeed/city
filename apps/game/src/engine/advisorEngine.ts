import {
  ALLIANCE_CENTER_UPGRADE_TABLE,
  BUILDINGS_META,
  CITY_PLOTS,
  FORTIFICATION_DEFENSE_POINTS,
  GAME_BRAND_NAME,
  HOSPITAL_UPGRADE_TABLE,
  HQ_UPGRADE_TABLE,
  MARITIME_VESSELS_META,
  OFFSHORE_RIG_UPGRADE_TABLE,
  QUESTS_CATALOG,
  RESEARCH_TREE,
  SEAPORT_UPGRADE_TABLE,
  SHIELD_PACKAGES,
  SMART_BOT_PLANS,
  SPECIALIZATIONS,
  SPEEDUP_CARDS_META,
  UNITS_META,
  WAREHOUSE_CAPACITIES,
} from '@enginora/shared';
import {
  BuildingType,
  GameState,
  NavSection,
  ResourceBundle,
  SmartBotPlanId,
} from '@enginora/shared';
import {
  buildNavalVessel,
  canAfford,
  checkHqRequirements,
  dispatchMaritimeTrade,
  dispatchOffshoreSurvey,
  dispatchSmartBotResourceRaid,
  formatDurationArabic,
  getAllianceCenterLevel,
  getBarracksLevel,
  getCityDefensePower,
  getExposedExcessResources,
  getFortificationLevel,
  getHighestLevelOfType,
  getHospitalLevel,
  getMainBuildingLevel,
  getMaxBuildSlots,
  getMaxResearchSlots,
  getNextBuildingUpgradeSpec,
  getOffshoreRigLevel,
  getProductionRates,
  getReconRevealPct,
  getResearchCenterLevel,
  getSeaportLevel,
  getTotalGems,
  getTotalStoredResources,
  getWarehouseCapacity,
  getWarehouseLevel,
  isQuestConditionMet,
  startNewBuildingOnPlot,
  startResearchTech,
  startTrainUnits,
  startUpgradeBuilding,
} from '@enginora/shared';

export const FREE_ADVISOR_PORTRAIT =
  '/src/assets/images/free_advisor_portrait_1795468631637.jpg';
export const SMART_ADVISOR_PORTRAIT =
  '/src/assets/images/smart_advisor_portrait_1795468632002.jpg';

export interface AdvisorActionLink {
  label: string;
  section?: NavSection;
  plotId?: string;
  openModalTab?: 'qa' | 'strategy' | 'delegation' | 'tiers';
  runStep?: boolean;
}

export interface AdvisorBriefingMessage {
  id: string;
  speakerName: string;
  speakerRole: string;
  tone: 'info' | 'warning' | 'action' | 'success';
  title: string;
  body: string;
  primaryAction?: AdvisorActionLink;
  secondaryAction?: AdvisorActionLink;
}

export interface StrategicPlanStep {
  id: string;
  priority: number;
  category: 'hq' | 'build' | 'research' | 'maritime' | 'military' | 'raid';
  title: string;
  reason: string;
  status: 'ready' | 'need_resources' | 'queue_full' | 'locked';
  cost?: ResourceBundle;
  missingText?: string;
  execute: (
    state: GameState,
    now: number
  ) => { state: GameState; summary?: string; error?: string };
}

export interface SmartStrategyAnalysis {
  planId: SmartBotPlanId;
  planName: string;
  currentPhaseLabel: string;
  bottleneckSummary: string;
  warehouseFillPct: number;
  exposedExcessTotal: number;
  buildSlotsUsed: number;
  buildSlotsMax: number;
  researchSlotsUsed: number;
  researchSlotsMax: number;
  steps: StrategicPlanStep[];
  milestones: { label: string; completed: boolean }[];
}

export interface AdvisorQaCategory {
  id: string;
  label: string;
  questions: string[];
}

export interface AdvisorQaResponse {
  topicTitle: string;
  answerLines: string[];
  tips: string[];
  action?: AdvisorActionLink;
}

export const ADVISOR_QUICK_CATEGORIES: AdvisorQaCategory[] = [
  {
    id: 'main_build',
    label: 'المبنى الرئيسي والبناء',
    questions: [
      'ما هي متطلبات ترقية المبنى الرئيسي التالية؟',
      'كيف أفتح المباني المتقدمة مثل الثكنة والسوق والأبحاث؟',
      'أين أبني المستشفى ومركز التحالف والتحصينات؟',
    ],
  },
  {
    id: 'economy',
    label: 'الموارد والمخزن والوقت',
    questions: [
      'كيف يعمل المخزن المركزي وهل يتوقف الإنتاج عند تجاوز السعة؟',
      'ما هو التوقيت الرسمي للعبة ومتى تتجدد المهام والباقة الشهرية؟',
      'ما الفرق بين ENGINORA GEMS ورصيد نقاط التجارة؟',
    ],
  },
  {
    id: 'perks_market',
    label: 'السوق والجواهر والدروع',
    questions: [
      'ما هي قواعد سوق التجارة والحصة الشهرية وقفل 14 يومًا؟',
      'كيف تُحسب تكلفة الإنهاء الفوري وبطاقات التسريع؟',
      'كيف تعمل دروع الحماية والتعزيزات القتالية +10%؟',
    ],
  },
  {
    id: 'maritime',
    label: 'البحر والنفط',
    questions: [
      'كيف أستخدم الميناء البحري والسفن التجارية؟',
      'كيف أستكشف آبار النفط والغاز في البحر؟',
    ],
  },
  {
    id: 'war_world',
    label: 'الجيش والخريطة',
    questions: [
      'كيف تعمل الوحدات العسكرية والاستطلاع (20%–70%)؟',
      'ماذا يهاجم المستشار الذكي حكيم وما هي حدوده؟',
      'ما الفرق بين المساعد المجاني والمستشار الذكي حكيم؟',
    ],
  },
  {
    id: 'support_sub',
    label: 'الباقة الشهرية والدعم',
    questions: [
      'كيف تعمل الباقة الشهرية (المجانية + VIP) والدفع والموافقة؟',
      'كيف أربط حساب تيليغرام وأفتح تذكرة دعم فني؟',
    ],
  },
];

function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatMissingCost(res: ResourceBundle, cost: ResourceBundle): string {
  const parts: string[] = [];
  if (res.wheat < cost.wheat) parts.push(`${Math.ceil(cost.wheat - res.wheat)} قمح`);
  if (res.wood < cost.wood) parts.push(`${Math.ceil(cost.wood - res.wood)} خشب`);
  if (res.iron < cost.iron) parts.push(`${Math.ceil(cost.iron - res.iron)} حديد`);
  return parts.length > 0 ? `ينقص: ${parts.join(' · ')}` : '';
}

function findBestPlotForBuilding(
  state: GameState,
  bType: BuildingType
): (typeof CITY_PLOTS)[number] | undefined {
  const occupied = new Set(
    state.buildings.filter((b) => b.status !== 'EMPTY').map((b) => b.plotId)
  );

  if (bType === 'seaport') {
    return !occupied.has('p-seaport')
      ? CITY_PLOTS.find((p) => p.id === 'p-seaport')
      : undefined;
  }
  if (bType === 'offshore_rig') {
    return !occupied.has('p-offshore')
      ? CITY_PLOTS.find((p) => p.id === 'p-offshore')
      : undefined;
  }
  if (bType === 'fortifications') {
    return !occupied.has('p-wall')
      ? CITY_PLOTS.find((p) => p.id === 'p-wall')
      : undefined;
  }
  if (bType === 'hospital') {
    const pref = CITY_PLOTS.find((p) => p.id === 'p-hospital');
    if (pref && !occupied.has(pref.id)) return pref;
  }
  if (bType === 'alliance_center') {
    const pref = CITY_PLOTS.find((p) => p.id === 'p-alliance');
    if (pref && !occupied.has(pref.id)) return pref;
  }

  return CITY_PLOTS.find(
    (p) => !p.fixedType && !p.isCoastal && !occupied.has(p.id)
  );
}

/**
 * Advanced Strategic Planner for Smart Advisor Hakim & Free Advisor Tareq
 */
export function buildSmartStrategicPlan(
  state: GameState,
  now: number
): SmartStrategyAnalysis {
  const planId = state.botConfig.planId;
  const plan = SMART_BOT_PLANS[planId] ?? SMART_BOT_PLANS.balanced_economy;
  const mainLv = getMainBuildingLevel(state);
  const whLv = getWarehouseLevel(state);
  const farmMax = getHighestLevelOfType(state.buildings, 'farm');
  const sawMax = getHighestLevelOfType(state.buildings, 'sawmill');
  const mineMax = getHighestLevelOfType(state.buildings, 'iron_mine');
  const seaportLv = getSeaportLevel(state);
  const rigLv = getOffshoreRigLevel(state);
  const rcLv = getResearchCenterLevel(state);
  const barLv = getBarracksLevel(state);
  const fortLv = getFortificationLevel(state);
  const hospLv = getHospitalLevel(state);
  const allyLv = getAllianceCenterLevel(state);

  const warehouseCap = getWarehouseCapacity(state);
  const storedTotal = getTotalStoredResources(state.resources);
  const warehouseFillPct = Math.min(
    100,
    Math.round((storedTotal / Math.max(1, warehouseCap)) * 100)
  );
  const exposed = getExposedExcessResources(state);

  const buildSlotsUsed = state.buildQueue.length;
  const buildSlotsMax = getMaxBuildSlots(state);
  const researchSlotsUsed = state.researchQueue.length;
  const researchSlotsMax = getMaxResearchSlots(state);
  const buildQueueFull = buildSlotsUsed >= buildSlotsMax;

  const currentPhaseLabel =
    mainLv < 5
      ? 'المرحلة المبكرة (المستوى 1–4): التأسيس وتأمين الإنتاج'
      : mainLv < 9
        ? 'المرحلة المتوسطة (المستوى 5–8): التخصص والأبحاث والتوسع البحري'
        : 'المرحلة المتقدمة (المستوى 9–10+): التسليح وسوق التجارة';

  const milestones = [
    {
      label: 'اكتمال ثلاثية الإنتاج الأساسية (مزرعة + منشرة + منجم)',
      completed: farmMax >= 1 && sawMax >= 1 && mineMax >= 1,
    },
    {
      label: 'تأمين المخزن المركزي والتحصينات (مخزن ≥ 2 ودفاعات ≥ 1)',
      completed: whLv >= 2 && fortLv >= 1,
    },
    {
      label: 'فتح الميناء البحري التجاري عند المبنى الرئيسي 3 وتشغيل سفن الشحن',
      completed: seaportLv >= 1 && state.maritime.cargoShips >= 1,
    },
    {
      label: 'بلوغ المبنى الرئيسي مستوى 5 واختيار التخصص ومنصة النفط والغاز',
      completed: mainLv >= 5 && (state.specialization !== null || rigLv >= 1),
    },
    {
      label: 'تفعيل مركز الأبحاث عند المستوى 6 والوصول نحو سوق التجارة (المستوى 10)',
      completed: mainLv >= 6 && rcLv >= 1,
    },
  ];

  const steps: StrategicPlanStep[] = [];
  const usedBuildingIds = new Set<string>();
  const usedBuildTypes = new Set<BuildingType>();

  const pushBuildOrUpgradeStep = (
    bType: BuildingType,
    priority: number,
    reason: string,
    category: StrategicPlanStep['category'] = 'build'
  ) => {
    const meta = BUILDINGS_META[bType];
    if (mainLv < meta.minHqToBuild) return;

    const existingAll = state.buildings.filter((b) => b.type === bType);
    const activeQueued = state.buildings.filter(
      (b) =>
        b.type === bType &&
        (b.status === 'CONSTRUCTING' || b.status === 'UPGRADING')
    );

    const shouldBuildNewInstance =
      existingAll.length === 0 ||
      (meta.allowMultiple &&
        existingAll.length < 2 &&
        activeQueued.length === 0 &&
        ((planId === 'balanced_economy' && farmMax >= 2 && sawMax >= 2 && mineMax >= 2) ||
          (planId === 'industrial_mining' && (bType === 'iron_mine' || bType === 'sawmill')) ||
          (planId === 'maritime_energy' && bType === 'iron_mine')) &&
        !usedBuildTypes.has(bType));

    if (existingAll.length === 0 || shouldBuildNewInstance) {
      if (usedBuildTypes.has(bType)) return;
      const plot = findBestPlotForBuilding(state, bType);
      if (!plot) return;
      const spec = getNextBuildingUpgradeSpec(state, bType, 0);
      if (!spec.canUpgrade) return;

      const affordable = canAfford(state.resources, spec.cost);
      usedBuildTypes.add(bType);
      steps.push({
        id: `step-build-${bType}-${plot.id}`,
        priority,
        category,
        title: `تشييد ${meta.name} في ${plot.districtName}`,
        reason,
        status: buildQueueFull
          ? 'queue_full'
          : affordable
            ? 'ready'
            : 'need_resources',
        cost: spec.cost,
        missingText: affordable ? undefined : formatMissingCost(state.resources, spec.cost),
        execute: (st, ts) => {
          const r = startNewBuildingOnPlot(st, plot.id, bType, ts);
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: `تشييد ${meta.name} في ${plot.districtName}` };
        },
      });
      return;
    }

    const targetB = existingAll
      .filter((b) => b.status === 'COMPLETED' && !usedBuildingIds.has(b.id))
      .sort((a, b) => a.level - b.level)[0];
    if (!targetB) return;

    const spec = getNextBuildingUpgradeSpec(state, bType, targetB.level);
    if (!spec.canUpgrade) return;
    const affordable = canAfford(state.resources, spec.cost);
    usedBuildingIds.add(targetB.id);
    steps.push({
      id: `step-upg-${targetB.id}-${spec.nextLevel}`,
      priority,
      category,
      title: `ترقية ${meta.name} إلى المستوى ${spec.nextLevel}`,
      reason,
      status: buildQueueFull
        ? 'queue_full'
        : affordable
          ? 'ready'
          : 'need_resources',
      cost: spec.cost,
      missingText: affordable ? undefined : formatMissingCost(state.resources, spec.cost),
      execute: (st, ts) => {
        const r = startUpgradeBuilding(st, targetB.id, ts);
        return r.error
          ? { state: st, error: r.error }
          : {
              state: r.state,
              summary: `ترقية ${meta.name} إلى المستوى ${spec.nextLevel}`,
            };
      },
    });
  };

  // 1. Warehouse protection safeguard (§35-§37: production NEVER halts, but excess > capacity is 50% lootable)
  if (exposed.excessTotal > 0 || warehouseFillPct >= 85) {
    pushBuildOrUpgradeStep(
      'warehouse',
      100,
      exposed.excessTotal > 0
        ? `يوجد فائض ${exposed.excessTotal.toLocaleString('en-US')} وحدة فوق السعة المحمية للمخزن — معرضة للنهب حتى 50% في كل هجوم.`
        : `السعة المحمية للمخزن عند ${warehouseFillPct}% — الترقية تحمي مواردك المتزايدة من النهب.`
    );
  }

  // 2. Main Building Critical-Path Solver
  const nextMainLv = mainLv + 1;
  const mainSpecRow = HQ_UPGRADE_TABLE.find((h) => h.level === nextMainLv);
  const mainCheck = checkHqRequirements(state, nextMainLv);
  let bottleneckSummary = 'جميع مسارات التطوير مستقرة ومتوافقة مع خطة المدينة.';

  if (mainSpecRow) {
    if (mainCheck.met) {
      const mainB = state.buildings.find((b) => b.type === 'hq' && b.status === 'COMPLETED');
      if (mainB) {
        const affordable = canAfford(state.resources, mainSpecRow.cost);
        bottleneckSummary = `متطلبات المبنى الرئيسي مستوى ${nextMainLv} مكتملة بالكامل — الترقية هي الأولوية الاستراتيجية القصوى.`;
        steps.push({
          id: `step-main-${nextMainLv}`,
          priority: 95,
          category: 'hq',
          title: `ترقية المبنى الرئيسي إلى المستوى ${nextMainLv}`,
          reason: `متطلبات المستوى ${nextMainLv} مكتملة؛ الترقية تفتح (${mainSpecRow.summary}).`,
          status: buildQueueFull
            ? 'queue_full'
            : affordable
              ? 'ready'
              : 'need_resources',
          cost: mainSpecRow.cost,
          missingText: affordable
            ? undefined
            : formatMissingCost(state.resources, mainSpecRow.cost),
          execute: (st, ts) => {
            const r = startUpgradeBuilding(st, mainB.id, ts);
            return r.error
              ? { state: st, error: r.error }
              : { state: r.state, summary: `بدء ترقية المبنى الرئيسي إلى المستوى ${nextMainLv}` };
          },
        });
      }
    } else {
      bottleneckSummary = `عنصر الحسم نحو المبنى الرئيسي مستوى ${nextMainLv}: ${mainCheck.unmetReasons.join(' · ')}`;
      const req = mainSpecRow.requirements;
      if (req.farmMinLevel && farmMax < req.farmMinLevel) {
        pushBuildOrUpgradeStep(
          'farm',
          92,
          `مطلوب لفتح المبنى الرئيسي مستوى ${nextMainLv}: رفع المزرعة الذكية إلى المستوى ${req.farmMinLevel}.`
        );
      }
      if (req.sawmillMinLevel && sawMax < req.sawmillMinLevel) {
        pushBuildOrUpgradeStep(
          'sawmill',
          91,
          `مطلوب لفتح المبنى الرئيسي مستوى ${nextMainLv}: رفع المنشرة الحديثة إلى المستوى ${req.sawmillMinLevel}.`
        );
      }
      if (req.ironMineMinLevel && mineMax < req.ironMineMinLevel) {
        pushBuildOrUpgradeStep(
          'iron_mine',
          90,
          `مطلوب لفتح المبنى الرئيسي مستوى ${nextMainLv}: رفع منجم الحديد إلى المستوى ${req.ironMineMinLevel}.`
        );
      }
      if (req.anyTwoProductionAtLevel) {
        const prodList: { type: BuildingType; lv: number }[] = [
          { type: 'farm' as BuildingType, lv: farmMax },
          { type: 'sawmill' as BuildingType, lv: sawMax },
          { type: 'iron_mine' as BuildingType, lv: mineMax },
        ].sort((a, b) => b.lv - a.lv);
        for (const item of prodList.slice(0, 2)) {
          if (item.lv < req.anyTwoProductionAtLevel) {
            pushBuildOrUpgradeStep(
              item.type,
              89,
              `مطلوب لفتح المبنى الرئيسي مستوى ${nextMainLv}: وصول منشأتي إنتاج إلى المستوى ${req.anyTwoProductionAtLevel}.`
            );
          }
        }
      }
      if (req.warehouseMinLevel && whLv < req.warehouseMinLevel) {
        pushBuildOrUpgradeStep(
          'warehouse',
          88,
          `مطلوب لفتح المبنى الرئيسي مستوى ${nextMainLv}: رفع المخزن المركزي إلى المستوى ${req.warehouseMinLevel}.`
        );
      }
      if (req.researchCenterMinLevel && rcLv < req.researchCenterMinLevel) {
        pushBuildOrUpgradeStep(
          'research_center',
          87,
          `مطلوب لفتح المبنى الرئيسي مستوى ${nextMainLv}: رفع مركز الأبحاث إلى المستوى ${req.researchCenterMinLevel}.`
        );
      }
      if (req.barracksMinLevel && barLv < req.barracksMinLevel) {
        pushBuildOrUpgradeStep(
          'barracks',
          86,
          `مطلوب لفتح المبنى الرئيسي مستوى ${nextMainLv}: رفع الثكنة العسكرية إلى المستوى ${req.barracksMinLevel}.`
        );
      }
    }
  }

  // 3. Doctrine-specific priority buildings
  plan.focusBuildings.forEach((bType, idx) => {
    const weight = 78 - idx * 4;
    let reason = `منشأة محورية ضمن «${plan.name}» لتحقيق التوازن طويل المدى.`;
    if (bType === 'seaport') {
      reason = 'يفتح بناء سفن الشحن وقوافل التجارة البحرية.';
    } else if (bType === 'offshore_rig') {
      reason = 'يفعّل المسح السيزمي واكتشاف آبار النفط وحقول الغاز البحرية.';
    } else if (bType === 'hospital' && hospLv === 0) {
      reason = 'يحمي الجرحى ويرفع الجاهزية الطبية لاستدامة الجيش.';
    } else if (bType === 'alliance_center' && allyLv === 0) {
      reason = 'يفعّل الدبلوماسية وتأسيس التحالفات (حتى 10 أعضاء).';
    } else if (bType === 'fortifications') {
      reason = 'يضيف نقاط دفاع ثابتة لحماية المدينة ومواردها.';
    }
    pushBuildOrUpgradeStep(bType, weight, reason);
  });

  // 4. Production Bottleneck Balancing
  const rates = getProductionRates(state);
  const minProd = [
    { type: 'farm' as BuildingType, rate: rates.wheat, label: 'القمح' },
    { type: 'sawmill' as BuildingType, rate: rates.wood, label: 'الخشب' },
    { type: 'iron_mine' as BuildingType, rate: rates.iron, label: 'الحديد' },
  ].sort((a, b) => a.rate - b.rate)[0];
  if (minProd) {
    pushBuildOrUpgradeStep(
      minProd.type,
      62,
      `أضعف معدل إنتاج حاليًا هو ${minProd.label} (+${minProd.rate}/س)؛ تطويره يزيل عنق الزجاجة الموردي.`
    );
  }

  // 5. Research Strategy Step (when Main Building >= 6 and Research Center >= 1)
  if (mainLv >= 6 && rcLv >= 1) {
    const preferredTechOrder: string[] =
      planId === 'maritime_energy'
        ? ['maritime_logistics', 'offshore_seismic', 'eng_smart_grid', 'logistics_opt']
        : planId === 'industrial_mining'
          ? ['min_deep_shaft', 'ind_automation', 'logistics_opt', 'urban_engineering']
          : planId === 'military_defense'
            ? ['mil_infantry_tactics', 'mil_recon_doctrine', 'urban_engineering', 'logistics_opt']
            : ['logistics_opt', 'urban_engineering', 'maritime_logistics', 'mil_recon_doctrine'];

    const eligibleTechs = RESEARCH_TREE.filter((t) => {
      if (t.lockedFuture) return false;
      if (mainLv < t.requiredHq || rcLv < t.requiredResearchCenterLevel) return false;
      if (t.path !== 'shared' && t.path !== 'military' && t.path !== state.specialization) {
        return false;
      }
      const lv = state.researchLevels[t.id] ?? 0;
      const inQueue = state.researchQueue.some((rq) => rq.techId === t.id);
      return lv < t.maxLevel && !inQueue;
    }).sort((a, b) => {
      const ia = preferredTechOrder.indexOf(a.id);
      const ib = preferredTechOrder.indexOf(b.id);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const bestTech = eligibleTechs[0];
    if (bestTech) {
      const curLv = state.researchLevels[bestTech.id] ?? 0;
      const mult = Math.pow(1.45, curLv);
      const cost: ResourceBundle = {
        wheat: Math.round(bestTech.baseCost.wheat * mult),
        wood: Math.round(bestTech.baseCost.wood * mult),
        iron: Math.round(bestTech.baseCost.iron * mult),
      };
      const affordable = canAfford(state.resources, cost);
      const rQueueFull = researchSlotsUsed >= researchSlotsMax;
      steps.push({
        id: `step-research-${bestTech.id}`,
        priority: 76,
        category: 'research',
        title: `بحث تقني: ${bestTech.name} (مستوى ${curLv + 1})`,
        reason: `${bestTech.effectLabel} — متوافق مع عقيدة «${plan.name}».`,
        status: rQueueFull ? 'queue_full' : affordable ? 'ready' : 'need_resources',
        cost,
        missingText: affordable ? undefined : formatMissingCost(state.resources, cost),
        execute: (st, ts) => {
          const r = startResearchTech(st, bestTech.id, ts);
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: `بدء بحث ${bestTech.name} (${curLv + 1})` };
        },
      });
    }
  }

  // 6. Maritime Trade & Offshore Oil/Gas Execution Steps
  if (seaportLv >= 1) {
    const hasCargoVoyage = state.maritime.activeExpeditions.some(
      (e) => e.kind === 'maritime_trade'
    );
    if (state.maritime.cargoShips === 0) {
      const shipCost = MARITIME_VESSELS_META.cargo_ship.cost;
      const affordable = canAfford(state.resources, shipCost);
      steps.push({
        id: 'step-build-cargo-ship',
        priority: planId === 'maritime_energy' ? 84 : 68,
        category: 'maritime',
        title: 'تدشين سفينة شحن تجارية بالميناء',
        reason: 'الميناء جاهز بلا سفن؛ أول سفينة شحن تفعّل أرباح القوافل البحرية.',
        status: affordable ? 'ready' : 'need_resources',
        cost: shipCost,
        missingText: affordable ? undefined : formatMissingCost(state.resources, shipCost),
        execute: (st) => {
          const r = buildNavalVessel(st, 'cargo_ship');
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: 'تدشين سفينة شحن تجارية جديدة' };
        },
      });
    } else if (!hasCargoVoyage) {
      steps.push({
        id: 'step-dispatch-sea-trade',
        priority: planId === 'maritime_energy' ? 83 : 66,
        category: 'maritime',
        title: 'إطلاق قافلة تجارة بحرية',
        reason: `لديك ${state.maritime.cargoShips} سفن شحن جاهزة لتحقيق عائد موارد متواصل.`,
        status: 'ready',
        execute: (st, ts) => {
          const r = dispatchMaritimeTrade(st, ts);
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: 'إبحار قافلة التجارة البحرية' };
        },
      });
    }
  }

  if (rigLv >= 1) {
    const hasSurveyVoyage = state.maritime.activeExpeditions.some(
      (e) => e.kind === 'offshore_survey'
    );
    if (state.maritime.surveyVessels === 0) {
      const vCost = MARITIME_VESSELS_META.survey_vessel.cost;
      const affordable = canAfford(state.resources, vCost);
      steps.push({
        id: 'step-build-survey-vessel',
        priority: planId === 'maritime_energy' ? 82 : 65,
        category: 'maritime',
        title: 'تدشين سفينة مسح وتنقيب بحري',
        reason: 'منصة النفط والغاز مفعلة؛ سفينة المسح ضرورية لاكتشاف الآبار وحقول الغاز.',
        status: affordable ? 'ready' : 'need_resources',
        cost: vCost,
        missingText: affordable ? undefined : formatMissingCost(state.resources, vCost),
        execute: (st) => {
          const r = buildNavalVessel(st, 'survey_vessel');
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: 'تدشين سفينة مسح بحري جديدة' };
        },
      });
    } else if (!hasSurveyVoyage) {
      steps.push({
        id: 'step-dispatch-offshore-survey',
        priority: planId === 'maritime_energy' ? 81 : 64,
        category: 'maritime',
        title: 'إطلاق بعثة مسح سيزمي للنفط والغاز',
        reason: 'استكشاف آبار نفط وحقول غاز جديدة وضخ مخزون الطاقة القابل للتداول في السوق.',
        status: 'ready',
        execute: (st, ts) => {
          const r = dispatchOffshoreSurvey(st, ts);
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: 'إطلاق بعثة استكشاف نفط وغاز بحرية' };
        },
      });
    }
  }

  // 7. Military Readiness (Infantry, Tanks, Aircraft) & Safe Resource Field Raids (Main Building >= 9)
  if (mainLv >= 9 && barLv >= 1) {
    if (state.units.infantry < 15 && state.trainingQueue.length === 0) {
      const count = 5;
      const cost: ResourceBundle = {
        wheat: UNITS_META.infantry.cost.wheat * count,
        wood: UNITS_META.infantry.cost.wood * count,
        iron: UNITS_META.infantry.cost.iron * count,
      };
      const affordable = canAfford(state.resources, cost);
      steps.push({
        id: 'step-train-infantry-batch',
        priority: planId === 'military_defense' ? 75 : 58,
        category: 'military',
        title: `تدريب ${count} جنود مشاة لتأمين الحامية`,
        reason: 'تأمين حامية دفاعية صلبة وتجهيز فائض لحملات حقول الموارد.',
        status: affordable ? 'ready' : 'need_resources',
        cost,
        missingText: affordable ? undefined : formatMissingCost(state.resources, cost),
        execute: (st, ts) => {
          const r = startTrainUnits(st, 'infantry', count, ts);
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: `بدء تدريب ${count} جنود مشاة` };
        },
      });
    } else if ((state.units.tank ?? 0) < 4 && state.trainingQueue.length === 0) {
      const count = 2;
      const cost: ResourceBundle = {
        wheat: UNITS_META.tank.cost.wheat * count,
        wood: UNITS_META.tank.cost.wood * count,
        iron: UNITS_META.tank.cost.iron * count,
      };
      const affordable = canAfford(state.resources, cost);
      steps.push({
        id: 'step-train-tank-batch',
        priority: planId === 'military_defense' ? 73 : 56,
        category: 'military',
        title: `تدريب ${count} دبابات مدرعة للردع القتالي`,
        reason: 'الدبابات تضاعف قوة الدفاع والهجوم وتتحمل الصدمات الميدانية.',
        status: affordable ? 'ready' : 'need_resources',
        cost,
        missingText: affordable ? undefined : formatMissingCost(state.resources, cost),
        execute: (st, ts) => {
          const r = startTrainUnits(st, 'tank', count, ts);
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: `بدء تدريب ${count} دبابات مدرعة` };
        },
      });
    } else if (
      barLv >= 2 &&
      (state.units.aircraft ?? 0) < 2 &&
      state.trainingQueue.length === 0
    ) {
      const count = 1;
      const cost: ResourceBundle = {
        wheat: UNITS_META.aircraft.cost.wheat * count,
        wood: UNITS_META.aircraft.cost.wood * count,
        iron: UNITS_META.aircraft.cost.iron * count,
      };
      const affordable = canAfford(state.resources, cost);
      steps.push({
        id: 'step-train-aircraft-batch',
        priority: planId === 'military_defense' ? 72 : 55,
        category: 'military',
        title: 'تدريب طائرة حربية للدعم الجوي',
        reason: 'الطائرات الحربية أسرع وحدة قتالية وتمنح تفوقًا هجوميًا ودفاعيًا عاليًا.',
        status: affordable ? 'ready' : 'need_resources',
        cost,
        missingText: affordable ? undefined : formatMissingCost(state.resources, cost),
        execute: (st, ts) => {
          const r = startTrainUnits(st, 'aircraft', count, ts);
          return r.error
            ? { state: st, error: r.error }
            : { state: r.state, summary: 'بدء تدريب طائرة حربية' };
        },
      });
    } else if (state.marches.length === 0 && state.units.infantry >= 6) {
      steps.push({
        id: 'step-raid-resource-field',
        priority: 54,
        category: 'raid',
        title: 'حملة إمداد على حقل موارد استراتيجي',
        reason: `إرسال فائض القوات مع الاحتفاظ بـ ${state.botConfig.minGarrisonReservePct}% للدفاع عن المدينة.`,
        status: 'ready',
        execute: (st, ts) => dispatchSmartBotResourceRaid(st, ts, false),
      });
    }
  }

  const sortedSteps = steps
    .sort((a, b) => {
      const scoreA = a.priority + (a.status === 'ready' ? 20 : 0);
      const scoreB = b.priority + (b.status === 'ready' ? 20 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 6);

  return {
    planId,
    planName: plan.name,
    currentPhaseLabel,
    bottleneckSummary,
    warehouseFillPct,
    exposedExcessTotal: exposed.excessTotal,
    buildSlotsUsed,
    buildSlotsMax,
    researchSlotsUsed,
    researchSlotsMax,
    steps: sortedSteps,
    milestones,
  };
}

/**
 * Smart Advisor Batch/Cycle Executor: runs up to maxActionsPerCycle ready steps safely
 */
export function runSmartStrategyCycle(
  state: GameState,
  now: number,
  options: { maxActions?: number; silent?: boolean } = {}
): { state: GameState; actionsTaken: string[]; error?: string } {
  const maxActions = options.maxActions ?? (state.smartBotActive ? 3 : 1);
  let current = state;
  const actionsTaken: string[] = [];

  for (let i = 0; i < maxActions; i++) {
    const analysis = buildSmartStrategicPlan(current, now);
    const readyStep = analysis.steps.find((s) => s.status === 'ready');
    if (!readyStep) break;

    const res = readyStep.execute(current, now);
    if (res.error) {
      if (actionsTaken.length === 0) {
        return { state: current, actionsTaken, error: res.error };
      }
      break;
    }
    current = res.state;
    if (res.summary) {
      actionsTaken.push(res.summary);
    }
  }

  if (actionsTaken.length === 0) {
    const analysis = buildSmartStrategicPlan(current, now);
    const topStep = analysis.steps[0];
    return {
      state: current,
      actionsTaken,
      error:
        topStep?.missingText ??
        (topStep?.status === 'queue_full'
          ? 'جميع خانات البناء أو البحث مشغولة حاليًا.'
          : 'لا توجد خطوة جاهزة حاليًا — تتراكم الموارد تلقائيًا.'),
    };
  }

  const summaryText = actionsTaken.join(' · ');
  const updatedState: GameState = {
    ...current,
    botConfig: {
      ...current.botConfig,
      lastActionAt: now,
      lastActionSummary: summaryText,
    },
    reports: options.silent
      ? current.reports
      : [
          {
            id: `rep-smart-cycle-${now}-${Math.floor(Math.random() * 1000)}`,
            category: 'bot',
            title: `تنفيذ خطة المستشار حكيم: ${actionsTaken[0]}`,
            summary: summaryText,
            details: [
              `العقيدة النشطة: ${SMART_BOT_PLANS[current.botConfig.planId]?.name ?? 'متوازن'}`,
              `عدد الإجراءات المنفذة في الدورة: ${actionsTaken.length}`,
            ],
            createdAt: now,
            read: false,
          },
          ...current.reports,
        ],
  };

  return { state: updatedState, actionsTaken };
}

/**
 * Proactive Context-Aware Advisor Briefing Banner for the current screen & city state
 */
export function getContextualAdvisorBriefing(
  state: GameState,
  activeSection: NavSection,
  now: number
): AdvisorBriefingMessage {
  const isSmart = state.smartBotActive;
  const speakerName = isSmart ? 'المستشار الذكي حكيم' : 'المستشار الميداني طارق';
  const speakerRole = isSmart ? 'حكيم الذكي (4/2)' : 'المساعد المجاني (2/1)';

  const analysis = buildSmartStrategicPlan(state, now);
  const mainLv = getMainBuildingLevel(state);
  const claimableQuest = QUESTS_CATALOG.find(
    (q) => !state.questClaims[q.id] && isQuestConditionMet(state, q.id)
  );
  const readyStep = analysis.steps.find((s) => s.status === 'ready');

  if (analysis.exposedExcessTotal > 0) {
    return {
      id: 'alert-warehouse-exposed',
      speakerName,
      speakerRole,
      tone: 'warning',
      title: `فائض غير محمي: ${analysis.exposedExcessTotal.toLocaleString('en-US')} وحدة`,
      body: 'الإنتاج مستمر دون توقف، لكن الموارد الزائدة عن سعة المخزن معرضة للنهب بنسبة تصل إلى 50% عند الهجوم. استثمرها في الترقية أو طوّر المخزن.',
      primaryAction: readyStep
        ? { label: 'تنفيذ خطوة الاستثمار الآن', runStep: true }
        : { label: 'فتح المخزن المركزي', section: 'city', plotId: 'p-wh' },
      secondaryAction: { label: 'تفاصيل المخزن', openModalTab: 'qa' },
    };
  }

  if (mainLv >= 5 && state.specialization === null) {
    return {
      id: 'alert-spec-ready',
      speakerName,
      speakerRole,
      tone: 'action',
      title: 'قرار استراتيجي متاح: اختيار التخصص الرئيسي!',
      body: 'وصلت إلى المبنى الرئيسي مستوى 5! افتح المبنى الرئيسي الآن لتحديد هوية مدينتك (الزراعة، الصناعة، التعدين، أو الطاقة).',
      primaryAction: { label: 'اختيار التخصص الآن', section: 'city', plotId: 'p-hq' },
      secondaryAction: { label: 'قارن التخصصات', openModalTab: 'qa' },
    };
  }

  if (activeSection === 'world_map') {
    const revealPct = getReconRevealPct(state);
    return {
      id: 'ctx-world-map',
      speakerName,
      speakerRole,
      tone: 'info',
      title: `إرشاد الخريطة · كشف الاستطلاع ${revealPct}%`,
      body: `الاستطلاع يكشف المعلومات فقط دون كسر الدرع، بينما الهجوم على مدينة لاعب أخرى يلغي درع الحماية فورًا دون استرجاع قيمته. احتياطي الحامية ${state.botConfig.minGarrisonReservePct}%.`,
      primaryAction: { label: 'إعداد خطة الغارات', openModalTab: 'delegation' },
      secondaryAction: { label: 'أساسيات الخريطة', openModalTab: 'qa' },
    };
  }

  if (activeSection === 'research') {
    return {
      id: 'ctx-research',
      speakerName,
      speakerRole,
      tone: 'info',
      title:
        mainLv < 6
          ? 'مركز الأبحاث يُفتح عند المبنى الرئيسي 6'
          : 'توجيه الأبحاث التقنية',
      body:
        mainLv < 6
          ? `مستواك الحالي: المبنى الرئيسي ${mainLv}. ركز على ترقية الإنتاج والمخزن للوصول إلى المستوى 6 وفتح شجرة الأبحاث.`
          : `خانات الأبحاث النشطة: ${analysis.researchSlotsUsed}/${analysis.researchSlotsMax}. ابحث «عقيدة الاستطلاع» لرفع كشف التجسس حتى 70% و«سلاسل الإمداد» للإنتاج.`,
      primaryAction: readyStep
        ? { label: 'تنفيذ الخطوة المثلى', runStep: true }
        : { label: 'الخطة الاستراتيجية', openModalTab: 'strategy' },
    };
  }

  if (activeSection === 'market') {
    return {
      id: 'ctx-market',
      speakerName,
      speakerRole,
      tone: 'info',
      title:
        mainLv < 10
          ? 'سوق التجارة يفتح عند المبنى الرئيسي 10'
          : 'قواعد سوق التجارة وإرشاد الأسعار',
      body: 'السوق يتداول بالـ ENGINORA GEMS فقط بعمولة 5% ومهلة إلغاء 5 ثوانٍ وقفل 14 يومًا على المشتريات. يقدم حكيم تقييم السعر العادل فقط دون تنفيذ صفقات بالنيابة عنك.',
      primaryAction: { label: 'اسأل عن الحصة والرسوم', openModalTab: 'qa' },
      secondaryAction: { label: 'خريطة المدينة', section: 'city' },
    };
  }

  if (activeSection === 'store') {
    return {
      id: 'ctx-store',
      speakerName,
      speakerRole,
      tone: 'info',
      title: 'المتجر الرسمي · ENGINORA GEMS',
      body: '10 جواهر = 1 ريال سعودي. عمليات الدفع عبر Apple Pay أو مدى أو التحويل البنكي تمر بمراجعة واعتماد المؤسس قبل إضافة الرصيد.',
      primaryAction: { label: 'الباقة الشهرية', section: 'monthly' },
      secondaryAction: { label: 'أسعار الجواهر والدرع', openModalTab: 'qa' },
    };
  }

  if (activeSection === 'monthly') {
    return {
      id: 'ctx-monthly',
      speakerName,
      speakerRole,
      tone: 'info',
      title: 'الباقة الشهرية · التوقيت العالمي (UTC)',
      body: 'استلم مكافآت 30 يومًا متتالية يوميًا عند الساعة 21:00 بتوقيت UTC (بداية اليوم الجديد داخل اللعبة). تفعيل VIP (10$ / 37.50 ريال لـ 30 يومًا) يفتح المسار الإضافي وجائزة اليوم 30.',
      primaryAction: { label: 'ترقية إلى VIP', section: 'store' },
    };
  }

  if (activeSection === 'support') {
    return {
      id: 'ctx-support',
      speakerName,
      speakerRole,
      tone: 'info',
      title: 'مركز الدعم الفني والتذاكر',
      body: 'يمكنك رفع تذكرة جديدة وإرفاق لقطات شاشة (PNG/JPG/WEBP حتى 2MB) ومتابعة حالة الرد خطوة بخطوة.',
      primaryAction: { label: 'العودة إلى المدينة', section: 'city' },
    };
  }

  if (activeSection === 'admin') {
    return {
      id: 'ctx-admin',
      speakerName,
      speakerRole,
      tone: 'info',
      title: 'لوحة الإدارة والحوكمة المالية',
      body: 'تتيح تبديل الدور بين المؤسس (صلاحية كاملة)، الشريك (عرض مالي وتقارير فقط)، والدعم الفني (إدارة التذاكر فقط).',
      primaryAction: { label: 'العودة للمدينة', section: 'city' },
    };
  }

  if (activeSection === 'alliances') {
    return {
      id: 'ctx-alliances',
      speakerName,
      speakerRole,
      tone: 'info',
      title:
        mainLv < 3
          ? 'التحالفات تفتح عند المبنى الرئيسي 3'
          : 'التحالفات والتنسيق الدبلوماسي',
      body: 'الحد الأقصى للتحالف 10 لاعبين. أول تأسيس مجاني تمامًا، وتُطبّق مهلة 30 يومًا قبل إنشاء تحالف جديد.',
      primaryAction: { label: 'موقع مركز التحالف', section: 'city', plotId: 'p-alliance' },
    };
  }

  if (activeSection === 'military') {
    const defPower = getCityDefensePower(state, now);
    return {
      id: 'ctx-military',
      speakerName,
      speakerRole,
      tone: 'info',
      title: `الجاهزية العسكرية · الدفاع ${defPower} نقطة`,
      body:
        mainLv < 9
          ? 'تُفتح الثكنة العسكرية عند المبنى الرئيسي 9. اعتمد حاليًا على التحصينات والمستشفى ودرع الحماية.'
          : 'درّب المشاة والدبابات والطائرات (ثكنة مستوى 2) وكشافة الاستطلاع. التعزيزات القتالية ترفع الهجوم أو الدفاع +10% (تمديد متراكم).',
      primaryAction: { label: 'شراء تعزيزات ودروع', section: 'store' },
      secondaryAction: { label: 'خطة الدفاع والردع', openModalTab: 'strategy' },
    };
  }

  if (isSmart && state.botConfig.autoDevelopCity && activeSection === 'city') {
    const activeQueues = `${analysis.buildSlotsUsed}/${analysis.buildSlotsMax} بناء · ${analysis.researchSlotsUsed}/${analysis.researchSlotsMax} بحث`;
    const nextNote = readyStep
      ? `الخطوة القادمة الجاهزة: ${readyStep.title}`
      : analysis.bottleneckSummary;
    return {
      id: `ctx-auto-${state.botConfig.planId}-${readyStep?.id ?? 'steady'}`,
      speakerName,
      speakerRole,
      tone: 'success',
      title: `حكيم يعمل تلقائيًا (${activeQueues})`,
      body: state.botConfig.lastActionSummary
        ? `أعمل تلقائيًا على «${analysis.planName}». ${nextNote}.`
        : `أراقب طوابير المدينة وأنفذ خطة «${analysis.planName}» تلقائيًا أولاً بأول. ${nextNote}.`,
      primaryAction: readyStep
        ? { label: 'تسريع وتنفيذ فوري', runStep: true }
        : { label: 'لوحة الخطة والنتائج', openModalTab: 'strategy' },
      secondaryAction: { label: 'إعدادات التفويض', openModalTab: 'delegation' },
    };
  }

  if (claimableQuest) {
    return {
      id: `ctx-quest-${claimableQuest.id}`,
      speakerName,
      speakerRole,
      tone: 'success',
      title: `مهمة مكتملة: ${claimableQuest.title}`,
      body: 'لديك مكافأة موارد ونقاط إنجاز جاهزة للاستلام فورًا لتسريع تطور المدينة.',
      primaryAction: { label: 'عرض المهام واستلامها', section: 'quests' },
      secondaryAction: readyStep
        ? { label: 'تنفيذ الخطوة التالية', runStep: true }
        : undefined,
    };
  }

  if (readyStep) {
    return {
      id: `ctx-ready-${readyStep.id}`,
      speakerName,
      speakerRole,
      tone: 'action',
      title: readyStep.title,
      body: `${readyStep.reason} (${analysis.bottleneckSummary})`,
      primaryAction: { label: 'تنفيذ الخطوة الآن', runStep: true },
      secondaryAction: { label: 'فتح مركز المستشار', openModalTab: 'strategy' },
    };
  }

  return {
    id: 'ctx-steady',
    speakerName,
    speakerRole,
    tone: 'info',
    title: `${analysis.planName} — المتابعة جارية`,
    body: analysis.bottleneckSummary,
    primaryAction: { label: 'خطة المدى الطويل', openModalTab: 'strategy' },
    secondaryAction: { label: 'اسأل عن الأساسيات', openModalTab: 'qa' },
  };
}

/**
 * Comprehensive Knowledge Base Engine for the Free Assistant & Smart Advisor Hakim (v3.1)
 */
export function answerPlayerQuestion(
  rawQuestion: string,
  state: GameState
): AdvisorQaResponse {
  const q = normalizeArabic(rawQuestion);
  const mainLv = getMainBuildingLevel(state);
  const whLv = getWarehouseLevel(state);
  const whCap = getWarehouseCapacity(state);
  const stored = getTotalStoredResources(state.resources);
  const exposed = getExposedExcessResources(state);
  const rates = getProductionRates(state);
  const seaportLv = getSeaportLevel(state);
  const rigLv = getOffshoreRigLevel(state);
  const rcLv = getResearchCenterLevel(state);
  const barLv = getBarracksLevel(state);
  const fortLv = getFortificationLevel(state);
  const hospLv = getHospitalLevel(state);
  const allyLv = getAllianceCenterLevel(state);

  // 1. Main Building Upgrade & Unlock Milestones
  if (
    q.includes('رئيسي') ||
    q.includes('مبني') ||
    q.includes('ترقيه') ||
    q.includes('مستوي') ||
    q.includes('تفتح') ||
    q.includes('متطلب') ||
    q.includes('متي يفتح')
  ) {
    const nextMain = HQ_UPGRADE_TABLE.find((r) => r.level === mainLv + 1);
    const check = checkHqRequirements(state, mainLv + 1);
    return {
      topicTitle: `دليل المبنى الرئيسي (مستواك الحالي: ${mainLv})`,
      answerLines: [
        nextMain
          ? `للوصول إلى المستوى ${nextMain.level}: التكلفة (${nextMain.cost.wheat} قمح · ${nextMain.cost.wood} خشب · ${nextMain.cost.iron} حديد) والمدة ${formatDurationArabic(nextMain.durationSec)}.`
          : 'وصلت إلى الحد الأقصى للمرحلة التأسيسية الحالية (المستوى 10)!',
        nextMain
          ? check.met
            ? `الوضع الحالي: جميع متطلبات المستوى ${nextMain.level} مكتملة وجاهز للترقية!`
            : `المتطلبات الناقصة حاليًا للمستوى ${nextMain.level}: ${check.unmetReasons.join(' ، ')}.`
          : 'من المستوى 10 ينفتح سوق التجارة للتبادل الاقتصادي بين اللاعبين.',
        'خريطة الفتوحات الأساسية: مستوى 2 (التحصينات والمستشفى) · مستوى 3 (التحالفات والميناء البحري) · مستوى 5 (التخصص الرئيسي ومنصة النفط والغاز) · مستوى 6 (مركز الأبحاث) · مستوى 9 (الثكنة العسكرية) · مستوى 10 (سوق التجارة).',
      ],
      tips: [
        `التطوير في ${GAME_BRAND_NAME} مترابط: استوفِ متطلبات الإنتاج والمخزن أولاً لفتح ترقية المبنى الرئيسي.`,
      ],
      action: { label: 'تحديد المبنى الرئيسي على الخريطة', section: 'city', plotId: 'p-hq' },
    };
  }

  // 2. Trade Market Rules (§24-§34)
  if (
    q.includes('سوق') ||
    q.includes('تجاره') ||
    q.includes('حصه') ||
    q.includes('عموله') ||
    q.includes('قفل') ||
    q.includes('14 يوم') ||
    q.includes('تلاعب')
  ) {
    return {
      topicTitle: 'قواعد سوق التجارة والاقتصاد الرسمي (المبنى الرئيسي 10)',
      answerLines: [
        `السوق يفتح عند المبنى الرئيسي مستوى 10 (مستواك الحالي ${mainLv}). التداول يتم حصرًا بـ ENGINORA GEMS فقط بعمولة ثابتة 5% تُحتسب من جواهر الشراء.`,
        'الحدود والضوابط: يجب أن يقع سعر الوحدة ضمن النطاق الرسمي من لوحة الإدارة، وتصل صلاحية العرض إلى 7 أيام، مع مهلة 5 ثوانٍ للمشتري لإلغاء الصفقة قبل تثبيتها نهائيًا.',
        'الحصة الشهرية (Quota): تُحسب من مخزون بداية الشهر بنسبة 1% لكل مستوى للمبنى الرئيسي حتى 30% كحد أقصى (+5% إضافية لحكيم لتصل إلى 35%). والمشتريات تُقفل ضد إعادة البيع لمدة 14 يومًا.',
      ],
      tips: [
        'حكيم يقدم إرشاد السعر العادل فقط داخل السوق ولا يبيع أو يشتري نيابة عنك إطلاقًا.',
      ],
      action: { label: 'معاينة سوق التجارة', section: 'market' },
    };
  }

  // 3. Official Global UTC Clock (21:00 UTC Reset) & Separate Financial Ledgers (§4-§12)
  if (
    q.includes('توقيت') ||
    q.includes('عالمي') ||
    q.includes('utc') ||
    q.includes('ساعه') ||
    q.includes('بدايه اليوم') ||
    q.includes('فصل') ||
    q.includes('جواهر') ||
    q.includes('نقاط') ||
    q.includes('رصيد')
  ) {
    return {
      topicTitle: 'التوقيت العالمي المعتمد (UTC) وفصل المحافظ',
      answerLines: [
        'التوقيت الرسمي المعتمد داخل اللعبة لجميع الأنظمة والتقارير والمهام والباقة الشهرية هو التوقيت العالمي (UTC): وتبدأ دورة اليوم الجديد الساعة 21:00 UTC، والتصفير الأسبوعي الساعة 21:00 مساء الأحد بتوقيت UTC.',
        `محفظة ENGINORA GEMS (${getTotalGems(state)} جوهرة — 10 جواهر = 1 ريال سعودي) مفصلة إلى: جواهر شحن + جواهر إضافية + جواهر السوق، ومفصولة تمامًا عن رصيد نقاط التجارة (${state.ledger.tradeBalance}).`,
        'نقاط التجارة تُحتسب وفق مبيعات السوق الرسمية وتُفصل تمامًا عن رصيد الجواهر.',
      ],
      tips: [
        'لا يمكن دمج نقاط التجارة مع رصيد جواهر ENGINORA GEMS نهائيًا.',
      ],
      action: { label: 'فتح المتجر والمحافظ', section: 'store' },
    };
  }

  // 4. Instant Finish, Speedups, Buffs & Shields (§13-§17)
  if (
    q.includes('فوري') ||
    q.includes('انهاء') ||
    q.includes('تسريع') ||
    q.includes('بطاق') ||
    q.includes('درع') ||
    q.includes('تعزيز') ||
    q.includes('حمايه')
  ) {
    return {
      topicTitle: 'بطاقات التسريع، الإنهاء الفوري، التعزيزات والدروع',
      answerLines: [
        'بطاقات التسريع تضم 7 فئات (1 د، 5 د، 30 د، 1 س، 24 س، 3 أيام، 7 أيام) وهي مرتبطة بالحساب ولا تُتداول. كما يمكن تسريع تحركات الجيش بتكلفة 50 جوهرة لكل دقيقة متبقية.',
        'الإنهاء الفوري للبناء أو الترقية: تُحسب تكلفته تلقائيًا بـ 100 جوهرة لكل كتلة من 3 دقائق متبقية (100 × ⌈الدقائق المتبقية ÷ 3⌉) ويظهر السعر قبل التأكيد.',
        `التعزيزات القتالية (+10% هجوم أو +10% دفاع لمدة 24 ساعة بـ 100 جوهرة) تتراكم مدتها بدون حد أقصى دون تجاوز +10%. ودروع الحماية (${SHIELD_PACKAGES.map((s) => `${s.name}: ${s.defaultGems}`).join(' · ')}) تتراكم مدتها وتبقى أثناء الاستطلاع لكنها تُلغى فورًا بدون استرجاع عند مهاجمة لاعب آخر.`,
      ],
      tips: [
        'راجع المتجر لمراقبة الدقائق المتبقية على الدروع والتعزيزات النشطة.',
      ],
      action: { label: 'شراء التسريع والدروع', section: 'store' },
    };
  }

  // 5. Maritime Seaport & Trade
  if (
    q.includes('ميناء') ||
    q.includes('بحر') ||
    q.includes('سفن') ||
    q.includes('سفينه') ||
    q.includes('تجاره بحريه') ||
    q.includes('رصيف')
  ) {
    const portSpec = SEAPORT_UPGRADE_TABLE.find((r) => r.level === Math.max(1, seaportLv));
    return {
      topicTitle: 'الميناء التجاري والتجارة البحرية',
      answerLines: [
        `الميناء البحري يُشيد على الرصيف الساحلي ويُفتح عند المبنى الرئيسي 3 (مستواك الحالي: ${seaportLv > 0 ? `مستوى ${seaportLv}` : 'غير مبني'}).`,
        `يتيح بناء «سفن الشحن التجارية» وإطلاق قوافل بحرية لمدة ${MARITIME_VESSELS_META.cargo_ship.voyageSec} ثانية تجلب موارد إضافية للمدينة.`,
        `يرفع الميناء سعة الأسطول إلى ${portSpec?.maxFleet ?? 2} سفن عند المستوى الحالي.`,
      ],
      tips: [
        'تفاعل مباشرة مع السفن المتحركة أو الرصيف البحري في خريطة المدينة لفتح لوحة الميناء.',
        'ابحث عن «الملاحة والتجارة البحرية» في مركز الأبحاث لرفع عوائد القوافل بنسبة +8% لكل مستوى.',
      ],
      action: { label: 'الانتقال إلى الرصيف البحري', section: 'city', plotId: 'p-seaport' },
    };
  }

  // 6. Offshore Oil & Gas Exploration
  if (
    q.includes('نفط') ||
    q.includes('غاز') ||
    q.includes('منصه') ||
    q.includes('ابار') ||
    q.includes('تنقيب') ||
    q.includes('استكشاف')
  ) {
    const rigSpec = OFFSHORE_RIG_UPGRADE_TABLE.find((r) => r.level === Math.max(1, rigLv));
    return {
      topicTitle: 'استكشاف آبار النفط والغاز البحرية',
      answerLines: [
        `تُفتح «منصة النفط والغاز البحرية» عند المبنى الرئيسي 5 في قطاع المياه الإقليمية العميقة (مستواك الحالي: ${rigLv > 0 ? `مستوى ${rigLv}` : 'غير مبنية'}).`,
        `بناء «سفن المسح والتنقيب البحري» يمكّنك من إطلاق بعثات مسح سيزمي لاكتشاف آبار نفط وحقول غاز جديدة وضخ ${rigSpec?.oilYieldPerSurvey ?? 120} نفط و${rigSpec?.gasYieldPerSurvey ?? 95} غاز لكل سفينة بالرحلة.`,
        `إنتاجك البحري المسجل حاليًا: ${state.maritime.discoveredOilWells} بئر نفط · ${state.maritime.discoveredGasFields} حقل غاز · مخزون ${state.maritime.crudeOilStock} نفط و${state.maritime.naturalGasStock} غاز.`,
      ],
      tips: [
        'النفط الخام والغاز الطبيعي قابلان للتداول في سوق التجارة عند المبنى الرئيسي 10.',
      ],
      action: { label: 'فتح منطقة النفط والغاز', section: 'city', plotId: 'p-offshore' },
    };
  }

  // 7. Warehouse Protection Rules (§35-§37)
  if (
    q.includes('مخزن') ||
    q.includes('موارد') ||
    q.includes('قمح') ||
    q.includes('خشب') ||
    q.includes('حديد') ||
    q.includes('انتاج') ||
    q.includes('سعه') ||
    q.includes('نهب')
  ) {
    const nextWhCap = WAREHOUSE_CAPACITIES[whLv + 1];
    return {
      topicTitle: `المخزن المركزي والحماية من النهب (المحمي: ${whCap.toLocaleString('en-US')})`,
      answerLines: [
        `المخزن المركزي يحدد الحد المحمي للموارد (المستوى ${whLv}: ${whCap.toLocaleString('en-US')} وحدة إجمالاً). المجموع الحالي: ${stored.toLocaleString('en-US')} وحدة (${exposed.excessTotal > 0 ? `فائض غير محمي: ${exposed.excessTotal.toLocaleString('en-US')}` : 'آمن بالكامل'}).`,
        'الإنتاج والمكافآت والتجارة لا تتوقف ولا تُحذف عند تجاوز سعة المخزن! ولكن أي كمية تفوق سعة المخزن تصبح معرضة للنهب بنسبة تصل إلى 50% في كل هجوم عسكري.',
        `معدلات مدينتك الحالية: +${rates.wheat}/س قمح · +${rates.wood}/س خشب · +${rates.iron}/س حديد.`,
      ],
      tips: [
        nextWhCap
          ? `ترقية المخزن إلى المستوى ${whLv + 1} ترفع السعة المحمية إلى ${nextWhCap.toLocaleString('en-US')} وحدة.`
          : 'المخزن المركزي في الحد الأقصى (70,000 وحدة محمية).',
      ],
      action: { label: 'فحص المخزن المركزي', section: 'city', plotId: 'p-wh' },
    };
  }

  // 8. Specialization
  if (q.includes('تخصص') || q.includes('زراعه') || q.includes('صناعه') || q.includes('تعدين') || q.includes('طاقه')) {
    const specText = state.specialization
      ? `تخصصك المعتمد حاليًا هو: «${SPECIALIZATIONS[state.specialization].name}» (${SPECIALIZATIONS[state.specialization].tagline}).`
      : 'لم تختر التخصص الرئيسي بعد — يُفتح عند وصول المبنى الرئيسي إلى المستوى 5.';
    return {
      topicTitle: 'نظام التخصص الاقتصادي (يُفتح عند المستوى 5)',
      answerLines: [
        specText,
        'التخصصات الأربعة: الزراعة (الغذاء والوقود الحيوي) · الصناعة (المكونات الهندسية والمعدات) · التعدين (السبائك والمعادن النادرة) · الطاقة (الشبكات الذكية والوقود المكرر).',
        'كل تخصص يفتح أبحاثًا حصرية في مركز الأبحاث.',
      ],
      tips: [
        'اختر تخصصك بنفسك في المبنى الرئيسي؛ المستشار لا يختار التخصص عنك.',
      ],
      action: { label: 'عرض التخصص في المبنى الرئيسي', section: 'city', plotId: 'p-hq' },
    };
  }

  // 9. Research Tree
  if (q.includes('بحث') || q.includes('ابحاث') || q.includes('تقنيه') || q.includes('مختبر')) {
    return {
      topicTitle: 'مركز الأبحاث وشجرة التقنيات (المستوى 6)',
      answerLines: [
        `مركز الأبحاث يُبنى عند المستوى 5 ويفتح إجراء الأبحاث عند المبنى الرئيسي 6 (مستوى المركز الحالي: ${rcLv}).`,
        'المسارات المتاحة: المسار المشترك، مسار التخصص، والمسار العسكري (يشمل «عقيدة الاستطلاع» لرفع كشف التجسس حتى 70%).',
        'المساعد المجاني يمنح خانة بحث واحدة، بينما يمنح المستشار الذكي حكيم خانتي أبحاث متزامنتين.',
      ],
      tips: [
        'ابدأ بـ «تحسين سلاسل الإمداد» (+4% إنتاج لكل مستوى) فور فتح المستوى 6.',
      ],
      action: { label: 'فتح شجرة الأبحاث', section: 'research' },
    };
  }

  // 10. Hospital, Fortifications & Alliances
  if (
    q.includes('مستشفي') ||
    q.includes('تحالف') ||
    q.includes('تحصين') ||
    q.includes('سور') ||
    q.includes('دفاع')
  ) {
    return {
      topicTitle: 'المستشفى، التحصينات، والتحالفات (حد أقصى 10 أعضاء)',
      answerLines: [
        `التحصينات الدفاعية (المستوى ${fortLv}): تُبنى عند المبنى الرئيسي 2 وتضيف ${FORTIFICATION_DEFENSE_POINTS[fortLv] ?? 0} نقطة دفاع (تصل إلى 700 نقطة عند المستوى 5).`,
        `المستشفى الحديث (المستوى ${hospLv}): يُفتح عند المستوى 2 بسعة تبدأ من ${HOSPITAL_UPGRADE_TABLE[0].capacity} سرير وتصل إلى 7,500 سرير.`,
        `التحالفات (مركز التحالف مستوى ${allyLv}): يُفتح عند المبنى الرئيسي 3، والحد الأقصى للتحالف 10 لاعبين. الإنشاء الأول مجاني مع مهلة 30 يومًا قبل إنشاء تحالف جديد (سعة السفارات: ${ALLIANCE_CENTER_UPGRADE_TABLE[Math.max(0, allyLv - 1)]?.embassySlots ?? 2}).`,
      ],
      tips: [
        'المدينة الجديدة تبدأ بحماية مبتدئ لمدة 14 يومًا (336 ساعة) ضد هجمات اللاعبين.',
      ],
      action: { label: 'عرض التحالفات', section: 'alliances' },
    };
  }

  // 11. Military, Tanks, Aircraft, Barracks & Recon
  if (
    q.includes('جيش') ||
    q.includes('ثكنه') ||
    q.includes('جنود') ||
    q.includes('مشاه') ||
    q.includes('دباب') ||
    q.includes('طائر') ||
    q.includes('كشاف') ||
    q.includes('استطلاع') ||
    q.includes('خريطه')
  ) {
    return {
      topicTitle: `الجيش، الاستطلاع (${getReconRevealPct(state)}%)، وخريطة العالم`,
      answerLines: [
        `الثكنة العسكرية تُفتح عند المبنى الرئيسي 9 (المستوى الحالي: ${barLv}). الوحدات الأربع: المشاة (ثكنة 1)، الدبابات المدرعة (ثكنة 1)، الكشافة (ثكنة 1)، والطائرات الحربية (تُفتح عند ثكنة مستوى 2).`,
        `كشف الاستطلاع الحالي هو ${getReconRevealPct(state)}% (يبدأ من 20% ويرتفع +10% لكل مستوى من بحث «عقيدة الاستطلاع» حتى 70%). الاستطلاع لا يكسر الدرع، بينما الهجوم على مدينة لاعب يلغي درعك فورًا.`,
        `قواتك الحالية: ${state.units.infantry} مشاة · ${state.units.tank ?? 0} دبابة · ${state.units.aircraft ?? 0} طائرة · ${state.units.scout} كشاف (الدفاع: ${getCityDefensePower(state)}).`,
      ],
      tips: [
        'احتفظ بنسبة حامية دفاعية كافية (50% افتراضيًا) قبل إرسال حملات حقول الموارد.',
      ],
      action: { label: 'فتح الثكنة والجيش', section: 'military' },
    };
  }

  // 12. Monthly Rewards, VIP, Telegram, Support, Payments (§45-§66)
  if (
    q.includes('باقه') ||
    q.includes('شهري') ||
    q.includes('vip') ||
    q.includes('تيليغرام') ||
    q.includes('تذكره') ||
    q.includes('دعم') ||
    q.includes('دفع') ||
    q.includes('تحويل') ||
    q.includes('apple') ||
    q.includes('مدي')
  ) {
    return {
      topicTitle: 'الباقة الشهرية، الدفع، الدعم الفني، وتيليغرام',
      answerLines: [
        'الباقة الشهرية تمتد 30 يومًا وتضم المسار المجاني ومسار VIP (بـ 10 دولار / 37.50 ريال لـ 30 يومًا دون تجديد تلقائي) وتتجدد يوميًا عند الساعة 21:00 بتوقيت UTC العالمي.',
        'وسائل الدفع المتاحة (Apple Pay · مدى · التحويل البنكي مع إرفاق صورة الفاتورة) تمر جميعها بحالة «قيد المراجعة» ولا تُضاف الجواهر أو الاشتراكات إلا بعد الاعتماد والمطابقة.',
        'الدعم الفني والتنبيهات: افتح تذكرة في قسم الدعم الفني وأرفق صور PNG/JPG/WEBP (حتى 2MB)، كما يمكنك ربط تيليغرام من الإعدادات عبر كود تحقق مؤقت.',
      ],
      tips: [
        'مزايا التذاكر والباقة الشهرية وإحصائيات لوحة الإدارة تعمل لحظيًا داخل اللعبة.',
      ],
      action: { label: 'عرض الباقة الشهرية', section: 'monthly' },
    };
  }

  // 13. Free Assistant vs Smart Advisor Hakim
  if (
    q.includes('بوت') ||
    q.includes('مساعد') ||
    q.includes('مستشار') ||
    q.includes('حكيم') ||
    q.includes('طارق') ||
    q.includes('ذكي') ||
    q.includes('مجاني') ||
    q.includes('تفويض') ||
    q.includes('يهاجم') ||
    q.includes('فرق')
  ) {
    return {
      topicTitle: 'المساعد المجاني (طارق) مقابل المستشار الذكي (حكيم)',
      answerLines: [
        'المساعد المجاني طارق (دائم): يمنح خانتي بناء (2) + خانة بحث (1)، ويشرح قواعد اللعبة والخطط وتنفيذ الخطوات يدويًا.',
        'المستشار الذكي حكيم (3,000 ريال لـ 90 يومًا بدون تجديد تلقائي): يوسع الخانات إلى (4 بناء + 2 بحث)، +5% حصة سوق شهرية (حتى 35%)، نشر عرضين نشطين، تشغيل تلقائي للبناء والأبحاث والسفن وغارات حقول الموارد، وإرشاد أسعار السوق دون تنفيذ صفقات.',
        'الحدود السيادية الصارمة: لا يهاجم مدن اللاعبين، ولا يعقد صفقات بيع أو شراء، ولا يعلن الحروب، ولا يختار التخصص نيابةً عنك.',
      ],
      tips: [
        'يمكنك الاشتراك في باقة حكيم من المتجر أو معاينته من تبويب «المساعد المجاني مقابل الذكي».',
      ],
      action: { label: 'إدارة الخطط والتفويض', openModalTab: 'strategy' },
    };
  }

  // Default intelligent overview tailored to current city state
  const analysis = buildSmartStrategicPlan(state, Date.now());
  const topStep = analysis.steps[0];
  return {
    topicTitle: `ملخص إرشادي لمدينتك (المبنى الرئيسي ${mainLv})`,
    answerLines: [
      `أهلاً بك يا ${state.commanderName} في ${GAME_BRAND_NAME}! المبنى الرئيسي في المستوى ${mainLv}، المحمي بالمخزن ${whCap.toLocaleString('en-US')} (المخزون ${stored.toLocaleString('en-US')})، والإنتاج (+${rates.wheat} قمح · +${rates.wood} خشب · +${rates.iron} حديد/س).`,
      `أولوية التطوير الحالية: ${analysis.bottleneckSummary}`,
      topStep
        ? `الخطوة الموصى بها الآن: ${topStep.title} — ${topStep.reason}`
        : 'جميع خطوط الإنتاج والترقيات تسير بانتظام.',
    ],
    tips: [
      'اسألني عن: المبنى الرئيسي، المخزن والنهب، السوق والحصة الشهرية، التوقيت العالمي (UTC)، الدروع، الباقة الشهرية، الدعم الفني، أو حكيم.',
    ],
    action: { label: 'عرض الخطة الاستراتيجية الكاملة', openModalTab: 'strategy' },
  };
}
