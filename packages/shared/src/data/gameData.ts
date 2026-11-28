import {
  AdminConfig,
  BuildingType,
  CityPlotDef,
  CoopQuestDef,
  GameServerConfig,
  GemPackageConfig,
  MarketOffer,
  MarketResourceId,
  MonthlyRewardDayConfig,
  PaymentMethodConfig,
  PaymentMethodId,
  ResourceBundle,
  SmartBotPlanId,
  SpecializationId,
  SpeedUpTierId,
  TerrainType,
  TicketStatus,
  UnitType,
  WorldTile,
} from '../types/game';

export const GAME_BRAND_NAME = 'ENGINORA CITY';
export const GAME_STATUS_BADGE = 'نسخة قيد التطوير (v3.1)';
export const MAIN_BUILDING_LABEL = 'المبنى الرئيسي';

export const PROTECTION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days / 336 hours
export const KSA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3 Saudi Arabia Standard Time

export const SAR_PER_USD = 3.75;
export const GEMS_PER_SAR = 10;
export const SAR_PER_GEM = 0.1;

export const INITIAL_RESOURCES: ResourceBundle = {
  wheat: 600,
  wood: 600,
  iron: 600,
};

// Production rate per hour (Levels 1-10) - GDD v2.0 §6
export const PRODUCTION_RATES_PER_HOUR: readonly number[] = [
  0,
  100,
  150,
  220,
  310,
  420,
  550,
  700,
  870,
  1060,
  1280,
];

// Production facility costs & duration (Levels 1-10)
export const PRODUCTION_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
}[] = [
  { level: 1, cost: { wheat: 100, wood: 80, iron: 50 }, durationSec: 2 * 60 },
  { level: 2, cost: { wheat: 150, wood: 110, iron: 70 }, durationSec: 5 * 60 },
  { level: 3, cost: { wheat: 230, wood: 170, iron: 110 }, durationSec: 10 * 60 },
  { level: 4, cost: { wheat: 340, wood: 250, iron: 170 }, durationSec: 20 * 60 },
  { level: 5, cost: { wheat: 500, wood: 370, iron: 250 }, durationSec: 35 * 60 },
  { level: 6, cost: { wheat: 720, wood: 530, iron: 360 }, durationSec: 55 * 60 },
  { level: 7, cost: { wheat: 1000, wood: 740, iron: 500 }, durationSec: 80 * 60 },
  { level: 8, cost: { wheat: 1400, wood: 1030, iron: 700 }, durationSec: 110 * 60 },
  { level: 9, cost: { wheat: 1900, wood: 1400, iron: 950 }, durationSec: 150 * 60 },
  { level: 10, cost: { wheat: 2600, wood: 1900, iron: 1300 }, durationSec: 200 * 60 },
];

// Central Warehouse shared protected capacity (Levels 1-10) - §35-36 v3.1
export const WAREHOUSE_CAPACITIES: readonly number[] = [
  0,
  6000,
  9000,
  13000,
  18000,
  24000,
  31000,
  39000,
  48000,
  58000,
  70000,
];

export const WAREHOUSE_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
}[] = [
  { level: 1, cost: { wheat: 100, wood: 100, iron: 60 }, durationSec: 2 * 60 },
  { level: 2, cost: { wheat: 160, wood: 180, iron: 100 }, durationSec: 8 * 60 },
  { level: 3, cost: { wheat: 260, wood: 290, iron: 170 }, durationSec: 20 * 60 },
  { level: 4, cost: { wheat: 420, wood: 460, iron: 270 }, durationSec: 40 * 60 },
  { level: 5, cost: { wheat: 660, wood: 720, iron: 430 }, durationSec: 70 * 60 },
  { level: 6, cost: { wheat: 1020, wood: 1100, iron: 680 }, durationSec: 110 * 60 },
  { level: 7, cost: { wheat: 1550, wood: 1680, iron: 1020 }, durationSec: 160 * 60 },
  { level: 8, cost: { wheat: 2300, wood: 2450, iron: 1500 }, durationSec: 220 * 60 },
  { level: 9, cost: { wheat: 3300, wood: 3500, iron: 2150 }, durationSec: 300 * 60 },
  { level: 10, cost: { wheat: 4700, wood: 4900, iron: 3000 }, durationSec: 400 * 60 },
];

export interface MainBuildingRequirementSpec {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
  summary: string;
  requirements: {
    farmMinLevel?: number;
    sawmillMinLevel?: number;
    ironMineMinLevel?: number;
    anyTwoProductionAtLevel?: number;
    warehouseMinLevel?: number;
    researchCenterMinLevel?: number;
    barracksMinLevel?: number;
  };
}

// Main Building Levels 2 - 10 (Strict compliance with §3: no "HQ" exposed to players)
export const HQ_UPGRADE_TABLE: readonly MainBuildingRequirementSpec[] = [
  {
    level: 2,
    cost: { wheat: 200, wood: 150, iron: 100 },
    durationSec: 10 * 60,
    summary: 'مزرعة 1 · منشرة 1 · منجم حديد 1',
    requirements: { farmMinLevel: 1, sawmillMinLevel: 1, ironMineMinLevel: 1 },
  },
  {
    level: 3,
    cost: { wheat: 350, wood: 250, iron: 180 },
    durationSec: 45 * 60,
    summary: 'مبنيان إنتاج بمستوى 2 · مخزن مستوى 2 (يفتح التحالفات والميناء)',
    requirements: { anyTwoProductionAtLevel: 2, warehouseMinLevel: 2 },
  },
  {
    level: 4,
    cost: { wheat: 600, wood: 450, iron: 300 },
    durationSec: 2 * 3600,
    summary: 'منشآت الإنتاج الثلاثة بمستوى 2',
    requirements: { farmMinLevel: 2, sawmillMinLevel: 2, ironMineMinLevel: 2 },
  },
  {
    level: 5,
    cost: { wheat: 900, wood: 700, iron: 500 },
    durationSec: 5 * 3600,
    summary: 'منشآت الإنتاج الثلاثة بمستوى 3 (يفتح اختيار التخصص ومنصة النفط)',
    requirements: { farmMinLevel: 3, sawmillMinLevel: 3, ironMineMinLevel: 3 },
  },
  {
    level: 6,
    cost: { wheat: 1400, wood: 1000, iron: 750 },
    durationSec: 8 * 3600,
    summary: 'مركز أبحاث 1 · مخزن مستوى 3 (يفتح شجرة الأبحاث)',
    requirements: { researchCenterMinLevel: 1, warehouseMinLevel: 3 },
  },
  {
    level: 7,
    cost: { wheat: 2100, wood: 1600, iron: 1200 },
    durationSec: 12 * 3600,
    summary: 'منشآت الإنتاج الثلاثة بمستوى 4 · مخزن مستوى 4',
    requirements: {
      farmMinLevel: 4,
      sawmillMinLevel: 4,
      ironMineMinLevel: 4,
      warehouseMinLevel: 4,
    },
  },
  {
    level: 8,
    cost: { wheat: 3000, wood: 2300, iron: 1800 },
    durationSec: 18 * 3600,
    summary: 'مركز أبحاث 2 · مخزن مستوى 4',
    requirements: { researchCenterMinLevel: 2, warehouseMinLevel: 4 },
  },
  {
    level: 9,
    cost: { wheat: 4300, wood: 3300, iron: 2600 },
    durationSec: 24 * 3600,
    summary: 'منشآت الإنتاج الثلاثة بمستوى 5 · مخزن مستوى 5 (يفتح الثكنة الأرضية)',
    requirements: {
      farmMinLevel: 5,
      sawmillMinLevel: 5,
      ironMineMinLevel: 5,
      warehouseMinLevel: 5,
    },
  },
  {
    level: 10,
    cost: { wheat: 6000, wood: 4600, iron: 3600 },
    durationSec: 30 * 3600,
    summary: 'الثكنة مستوى 2 · مركز الأبحاث مستوى 3 · مخزن مستوى 6 (يفتح سوق التجارة)',
    requirements: {
      barracksMinLevel: 2,
      researchCenterMinLevel: 3,
      warehouseMinLevel: 6,
    },
  },
];

// Fortifications (Levels 0-5)
export const FORTIFICATION_DEFENSE_POINTS: readonly number[] = [
  0, 100, 220, 360, 520, 700,
];

export const FORTIFICATION_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
  requiredHq: number;
}[] = [
  { level: 1, cost: { wheat: 180, wood: 240, iron: 220 }, durationSec: 12 * 60, requiredHq: 2 },
  { level: 2, cost: { wheat: 320, wood: 420, iron: 390 }, durationSec: 30 * 60, requiredHq: 4 },
  { level: 3, cost: { wheat: 560, wood: 740, iron: 680 }, durationSec: 75 * 60, requiredHq: 6 },
  { level: 4, cost: { wheat: 940, wood: 1220, iron: 1140 }, durationSec: 140 * 60, requiredHq: 8 },
  { level: 5, cost: { wheat: 1500, wood: 1950, iron: 1820 }, durationSec: 240 * 60, requiredHq: 9 },
];

export const RESEARCH_CENTER_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
  requiredHq: number;
}[] = [
  { level: 1, cost: { wheat: 360, wood: 420, iron: 340 }, durationSec: 25 * 60, requiredHq: 5 },
  { level: 2, cost: { wheat: 680, wood: 780, iron: 620 }, durationSec: 65 * 60, requiredHq: 7 },
  { level: 3, cost: { wheat: 1250, wood: 1400, iron: 1120 }, durationSec: 140 * 60, requiredHq: 9 },
  { level: 4, cost: { wheat: 2100, wood: 2300, iron: 1850 }, durationSec: 220 * 60, requiredHq: 10 },
];

export const BARRACKS_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
  requiredHq: number;
}[] = [
  { level: 1, cost: { wheat: 850, wood: 900, iron: 1100 }, durationSec: 45 * 60, requiredHq: 9 },
  { level: 2, cost: { wheat: 1550, wood: 1650, iron: 1950 }, durationSec: 110 * 60, requiredHq: 9 },
  { level: 3, cost: { wheat: 2600, wood: 2700, iron: 3200 }, durationSec: 200 * 60, requiredHq: 10 },
];

export const HOSPITAL_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
  requiredHq: number;
  capacity: number;
}[] = [
  { level: 1, cost: { wheat: 220, wood: 240, iron: 200 }, durationSec: 10 * 60, requiredHq: 2, capacity: 500 },
  { level: 2, cost: { wheat: 420, wood: 460, iron: 380 }, durationSec: 28 * 60, requiredHq: 4, capacity: 1200 },
  { level: 3, cost: { wheat: 780, wood: 840, iron: 720 }, durationSec: 65 * 60, requiredHq: 6, capacity: 2500 },
  { level: 4, cost: { wheat: 1350, wood: 1450, iron: 1250 }, durationSec: 130 * 60, requiredHq: 8, capacity: 4500 },
  { level: 5, cost: { wheat: 2200, wood: 2350, iron: 2050 }, durationSec: 220 * 60, requiredHq: 9, capacity: 7500 },
];

export const ALLIANCE_CENTER_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
  requiredHq: number;
  embassySlots: number;
}[] = [
  { level: 1, cost: { wheat: 620, wood: 720, iron: 640 }, durationSec: 25 * 60, requiredHq: 10, embassySlots: 2 },
  { level: 2, cost: { wheat: 980, wood: 1100, iron: 960 }, durationSec: 50 * 60, requiredHq: 10, embassySlots: 4 },
  { level: 3, cost: { wheat: 1450, wood: 1620, iron: 1400 }, durationSec: 95 * 60, requiredHq: 10, embassySlots: 6 },
  { level: 4, cost: { wheat: 2050, wood: 2250, iron: 1950 }, durationSec: 160 * 60, requiredHq: 10, embassySlots: 8 },
  { level: 5, cost: { wheat: 2700, wood: 2950, iron: 2550 }, durationSec: 240 * 60, requiredHq: 10, embassySlots: 12 },
];

export const SEAPORT_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
  requiredHq: number;
  maxFleet: number;
  tradeFeeDiscountPct: number;
}[] = [
  { level: 1, cost: { wheat: 240, wood: 360, iron: 260 }, durationSec: 12 * 60, requiredHq: 3, maxFleet: 2, tradeFeeDiscountPct: 10 },
  { level: 2, cost: { wheat: 460, wood: 680, iron: 480 }, durationSec: 32 * 60, requiredHq: 5, maxFleet: 4, tradeFeeDiscountPct: 20 },
  { level: 3, cost: { wheat: 840, wood: 1200, iron: 860 }, durationSec: 75 * 60, requiredHq: 7, maxFleet: 6, tradeFeeDiscountPct: 30 },
  { level: 4, cost: { wheat: 1450, wood: 1950, iron: 1450 }, durationSec: 140 * 60, requiredHq: 9, maxFleet: 8, tradeFeeDiscountPct: 40 },
  { level: 5, cost: { wheat: 2350, wood: 3100, iron: 2300 }, durationSec: 220 * 60, requiredHq: 10, maxFleet: 12, tradeFeeDiscountPct: 50 },
];

export const OFFSHORE_RIG_UPGRADE_TABLE: readonly {
  level: number;
  cost: ResourceBundle;
  durationSec: number;
  requiredHq: number;
  oilYieldPerSurvey: number;
  gasYieldPerSurvey: number;
}[] = [
  { level: 1, cost: { wheat: 420, wood: 560, iron: 680 }, durationSec: 25 * 60, requiredHq: 5, oilYieldPerSurvey: 120, gasYieldPerSurvey: 95 },
  { level: 2, cost: { wheat: 780, wood: 980, iron: 1200 }, durationSec: 60 * 60, requiredHq: 6, oilYieldPerSurvey: 220, gasYieldPerSurvey: 180 },
  { level: 3, cost: { wheat: 1350, wood: 1650, iron: 2050 }, durationSec: 120 * 60, requiredHq: 8, oilYieldPerSurvey: 360, gasYieldPerSurvey: 300 },
  { level: 4, cost: { wheat: 2200, wood: 2600, iron: 3250 }, durationSec: 190 * 60, requiredHq: 9, oilYieldPerSurvey: 540, gasYieldPerSurvey: 460 },
  { level: 5, cost: { wheat: 3400, wood: 3900, iron: 4900 }, durationSec: 280 * 60, requiredHq: 10, oilYieldPerSurvey: 780, gasYieldPerSurvey: 680 },
];

export const MARITIME_VESSELS_META = {
  cargo_ship: {
    id: 'cargo_ship',
    name: 'سفينة شحن تجارية',
    desc: 'تنقل البضائع والقمح والحديد عبر الممرات البحرية وتدعم خطوط الإمداد.',
    cost: { wheat: 180, wood: 320, iron: 220 } as ResourceBundle,
    voyageSec: 45,
  },
  survey_vessel: {
    id: 'survey_vessel',
    name: 'سفينة مسح وتنقيب بحري',
    desc: 'تستكشف قاع البحر لاكتشاف آبار النفط وحقول الغاز الطبيعي البحرية.',
    cost: { wheat: 200, wood: 260, iron: 360 } as ResourceBundle,
    voyageSec: 55,
  },
} as const;

export interface BuildingMeta {
  type: BuildingType;
  name: string;
  shortDesc: string;
  category: 'core' | 'production' | 'tech_military';
  maxLevel: number;
  allowMultiple: boolean;
  maxInstances: number;
  minHqToBuild: number;
}

export const BUILDINGS_META: Record<BuildingType, BuildingMeta> = {
  hq: {
    type: 'hq',
    name: 'المبنى الرئيسي',
    shortDesc: 'مركز القيادة والإدارة الحضرية؛ يفتح ترقيات المدينة والتخصص والمراحل المتقدمة.',
    category: 'core',
    maxLevel: 10,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 1,
  },
  warehouse: {
    type: 'warehouse',
    name: 'المخزن المركزي',
    shortDesc: 'مستودع حماية مشترك للقمح والخشب والحديد يحمي السعة الأساسية من النهب.',
    category: 'core',
    maxLevel: 10,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 1,
  },
  fortifications: {
    type: 'fortifications',
    name: 'التحصينات الدفاعية',
    shortDesc: 'أسوار وبوابات وأبراج مراقبة حديثة تضيف نقاط دفاع مباشرة للمدينة.',
    category: 'core',
    maxLevel: 5,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 2,
  },
  farm: {
    type: 'farm',
    name: 'المزرعة الذكية',
    shortDesc: 'بيوت محمية وحقول زراعية حديثة لإنتاج القمح بالساعة.',
    category: 'production',
    maxLevel: 10,
    allowMultiple: true,
    maxInstances: 4,
    minHqToBuild: 1,
  },
  sawmill: {
    type: 'sawmill',
    name: 'المنشرة الحديثة',
    shortDesc: 'محطة معالجة أخشاب آلية مرتبطة بغابات الإمداد لإنتاج الخشب بالساعة.',
    category: 'production',
    maxLevel: 10,
    allowMultiple: true,
    maxInstances: 4,
    minHqToBuild: 1,
  },
  iron_mine: {
    type: 'iron_mine',
    name: 'منجم الحديد',
    shortDesc: 'مجمع استخراج ومعالجة خامات الحديد بالساعة لتغذية البناء والصناعة.',
    category: 'production',
    maxLevel: 10,
    allowMultiple: true,
    maxInstances: 4,
    minHqToBuild: 1,
  },
  research_center: {
    type: 'research_center',
    name: 'مركز الأبحاث',
    shortDesc: 'مختبر تقني لرفع كفاءة الإنتاج وفتح المسارات التخصصية والعسكرية والاستطلاع.',
    category: 'tech_military',
    maxLevel: 4,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 5,
  },
  barracks: {
    type: 'barracks',
    name: 'الثكنة العسكرية',
    shortDesc: 'منشأة التدريب العسكري لإعداد جنود المشاة والدبابات والطيران وكشافة الاستطلاع.',
    category: 'tech_military',
    maxLevel: 3,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 9,
  },
  hospital: {
    type: 'hospital',
    name: 'المستشفى الحديث',
    shortDesc: 'مركز طبي متكامل لعلاج الجرحى ورفع الجاهزية الطبية واستدامة القوات في المدينة.',
    category: 'tech_military',
    maxLevel: 5,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 2,
  },
  alliance_center: {
    type: 'alliance_center',
    name: 'مركز التحالف',
    shortDesc: 'مقر دبلوماسي يُفتح عند المبنى الرئيسي مستوى 10 لتأسيس التحالفات والمشاركة في المهام الجماعية المشتركة.',
    category: 'core',
    maxLevel: 5,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 10,
  },
  seaport: {
    type: 'seaport',
    name: 'الميناء البحري التجاري',
    shortDesc: 'رصيف شحن بحري لبناء السفن التجارية وإطلاق القوافل البحرية عبر الساحل.',
    category: 'production',
    maxLevel: 5,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 3,
  },
  offshore_rig: {
    type: 'offshore_rig',
    name: 'منصة النفط والغاز البحرية',
    shortDesc: 'منصة استكشاف بحرية لإرسال سفن المسح السيزمي واكتشاف آبار النفط وحقول الغاز.',
    category: 'tech_military',
    maxLevel: 5,
    allowMultiple: false,
    maxInstances: 1,
    minHqToBuild: 5,
  },
};

export const CITY_PLOTS: CityPlotDef[] = [
  { id: 'p-hq', gx: 2, gy: 2, districtName: 'الساحة المركزية', fixedType: 'hq' },
  { id: 'p-wh', gx: 1, gy: 2, districtName: 'المنطقة اللوجستية', fixedType: 'warehouse' },
  { id: 'p-hospital', gx: 3, gy: 1, districtName: 'الحي الطبي (موقع المستشفى)', suggestedType: 'hospital' },
  { id: 'p-alliance', gx: 3, gy: 2, districtName: 'الساحة الدبلوماسية (مركز التحالف)', suggestedType: 'alliance_center' },
  { id: 'p-wall', gx: 2, gy: 6, districtName: 'البوابة الأمنية وجسر المدينة', fixedType: 'fortifications', isPerimeter: true },

  // Interactive Coastal & Deep-Sea Zone Plots
  { id: 'p-seaport', gx: 5, gy: 0, districtName: 'خليج الميناء البحري (الساحل)', suggestedType: 'seaport', isCoastal: true },
  { id: 'p-offshore', gx: 5, gy: 1, districtName: 'المياه الإقليمية العميقة (آبار النفط والغاز)', suggestedType: 'offshore_rig', isCoastal: true },

  // Open buildable plots across city districts
  { id: 'p-1', gx: 1, gy: 0, districtName: 'الحي الشمالي الغربي' },
  { id: 'p-2', gx: 2, gy: 0, districtName: 'الضاحية الساحلية' },
  { id: 'p-3', gx: 1, gy: 1, districtName: 'مرتفع الخامات' },
  { id: 'p-4', gx: 2, gy: 1, districtName: 'القطاع الشرقي العلوي' },
  { id: 'p-5', gx: 0, gy: 2, districtName: 'سهل الغرب' },
  { id: 'p-6', gx: 4, gy: 2, districtName: 'ساحة الأبحاث' },
  { id: 'p-7', gx: 4, gy: 1, districtName: 'المنطقة الصناعية' },
  { id: 'p-8', gx: 1, gy: 3, districtName: 'الواحة الزراعية' },
  { id: 'p-9', gx: 2, gy: 3, districtName: 'الحي الأوسط الغربي' },
  { id: 'p-10', gx: 3, gy: 3, districtName: 'البوليفارد المركزي' },
  { id: 'p-11', gx: 4, gy: 3, districtName: 'الحي الأوسط الشرقي' },
  { id: 'p-12', gx: 2, gy: 4, districtName: 'قطاع الإمداد الجنوبي' },
  { id: 'p-13', gx: 3, gy: 4, districtName: 'القاعدة الجنوبية' },
  { id: 'p-14', gx: 4, gy: 4, districtName: 'مجمع الواجهة البحرية' },
];

export interface SpecializationMeta {
  id: SpecializationId;
  name: string;
  tagline: string;
  description: string;
  futureProducts: string[];
  tradeRole: string;
}

export const SPECIALIZATIONS: Record<SpecializationId, SpecializationMeta> = {
  agriculture: {
    id: 'agriculture',
    name: 'الزراعة',
    tagline: 'الأمن الغذائي والمنتجات الحيوية',
    description: 'يركز على سلاسل الغذاء المتقدمة، الصوامع الذكية، وتوريد المحاصيل الاستراتيجية لبقية المدن.',
    futureProducts: ['محاصيل مهجنة', 'وقود حيوي', 'حصص إعاشة عسكرية'],
    tradeRole: 'مورّد أساسي للغذاء والإمداد اللوجستي للجيوش والمدن الصناعية.',
  },
  industry: {
    id: 'industry',
    name: 'الصناعة',
    tagline: 'التصنيع المتقدم والمعدات',
    description: 'يركز على خطوط التجميع والمكونات الهندسية وتحويل المواد الخام إلى معدات مدنية وعسكرية.',
    futureProducts: ['مكونات هندسية', 'هياكل مدرعة', 'أنظمة أتمتة'],
    tradeRole: 'محور تحويل خامات التعدين والطاقة إلى منتجات عالية القيمة.',
  },
  mining: {
    id: 'mining',
    name: 'التعدين',
    tagline: 'استخراج المعادن والخامات الثقيلة',
    description: 'يركز على المناجم العميقة وصهر المعادن النادرة وتزويد المدن الصناعية بالسبائك.',
    futureProducts: ['سبائك فولاذية', 'معادن نادرة', 'خامات تيتانيوم'],
    tradeRole: 'المغذي الرئيسي لقطاع الصناعة والتحصينات والعتاد العسكري.',
  },
  energy: {
    id: 'energy',
    name: 'الطاقة',
    tagline: 'محطات التوليد والشبكات الذكية',
    description: 'يركز على الطاقة المتجددة والمحطات الكهربائية عالية الكفاءة لدعم المصانع ومراكز الأبحاث.',
    futureProducts: ['خلايا طاقة عالية الكثافة', 'وقود مكرر', 'بطاريات استراتيجية'],
    tradeRole: 'عصب التشغيل للمنشآت المتقدمة والمصانع الكبرى في السوق التجاري.',
  },
};

export interface ResearchTechDef {
  id: string;
  name: string;
  description: string;
  path: 'shared' | SpecializationId | 'military';
  maxLevel: number;
  requiredResearchCenterLevel: number;
  requiredHq: number;
  baseCost: ResourceBundle;
  baseDurationSec: number;
  effectLabel: string;
  lockedFuture?: boolean;
}

export const RESEARCH_TREE: ResearchTechDef[] = [
  {
    id: 'logistics_opt',
    name: 'تحسين سلاسل الإمداد',
    description: 'رفع كفاءة تدفق الموارد بين منشآت الإنتاج والمخزن المركزي.',
    path: 'shared',
    maxLevel: 5,
    requiredResearchCenterLevel: 1,
    requiredHq: 6,
    baseCost: { wheat: 300, wood: 260, iron: 220 },
    baseDurationSec: 20 * 60,
    effectLabel: '+4% كفاءة إنتاج لكل مستوى',
  },
  {
    id: 'urban_engineering',
    name: 'الهندسة العمرانية الحديثة',
    description: 'تنظيم التخطيط الحضري واستقرار البنية التحتية للمدينة.',
    path: 'shared',
    maxLevel: 5,
    requiredResearchCenterLevel: 1,
    requiredHq: 6,
    baseCost: { wheat: 250, wood: 350, iron: 280 },
    baseDurationSec: 25 * 60,
    effectLabel: 'تحسين متطلبات البنية التحتية وتقليل الفاقد',
  },
  {
    id: 'agri_hydroponics',
    name: 'الزراعة المائية الدقيقة',
    description: 'بحث مخصص لتخصص الزراعة يرفع إنتاج القمح ويمهد لخطوط الغذاء.',
    path: 'agriculture',
    maxLevel: 5,
    requiredResearchCenterLevel: 1,
    requiredHq: 6,
    baseCost: { wheat: 420, wood: 280, iron: 180 },
    baseDurationSec: 30 * 60,
    effectLabel: '+6% إنتاج القمح لكل مستوى',
  },
  {
    id: 'ind_automation',
    name: 'الأتمتة الصناعية',
    description: 'بحث مخصص لتخصص الصناعة لتهيئة خطوط التصنيع المتقدمة بعد المستوى 10 من المبنى الرئيسي.',
    path: 'industry',
    maxLevel: 5,
    requiredResearchCenterLevel: 1,
    requiredHq: 6,
    baseCost: { wheat: 260, wood: 380, iron: 360 },
    baseDurationSec: 30 * 60,
    effectLabel: '+6% إنتاج الأخشاب والجاهزية الصناعية',
  },
  {
    id: 'min_deep_shaft',
    name: 'تقنيات الحفر العميق',
    description: 'بحث مخصص لتخصص التعدين لتعزيز استخراج الحديد والمعادن.',
    path: 'mining',
    maxLevel: 5,
    requiredResearchCenterLevel: 1,
    requiredHq: 6,
    baseCost: { wheat: 240, wood: 320, iron: 440 },
    baseDurationSec: 30 * 60,
    effectLabel: '+6% إنتاج الحديد لكل مستوى',
  },
  {
    id: 'eng_smart_grid',
    name: 'الشبكات الكهربائية الذكية',
    description: 'بحث مخصص لتخصص الطاقة لتحسين كفاءة التشغيل الشاملة.',
    path: 'energy',
    maxLevel: 5,
    requiredResearchCenterLevel: 1,
    requiredHq: 6,
    baseCost: { wheat: 300, wood: 300, iron: 360 },
    baseDurationSec: 30 * 60,
    effectLabel: '+5% كفاءة عامة للمنشآت',
  },
  {
    id: 'maritime_logistics',
    name: 'الملاحة والتجارة البحرية',
    description: 'تحسين خطوط الشحن البحري بالميناء لرفع عائد التجارة البحرية وسرعة السفن.',
    path: 'shared',
    maxLevel: 5,
    requiredResearchCenterLevel: 1,
    requiredHq: 6,
    baseCost: { wheat: 320, wood: 420, iron: 300 },
    baseDurationSec: 25 * 60,
    effectLabel: '+8% عوائد رحلات السفن التجارية لكل مستوى',
  },
  {
    id: 'offshore_seismic',
    name: 'المسح الجيوفيزيائي البحري',
    description: 'تقنيات متقدمة لرصد مكامن النفط والغاز الطبيعي تحت قاع البحر.',
    path: 'energy',
    maxLevel: 5,
    requiredResearchCenterLevel: 2,
    requiredHq: 6,
    baseCost: { wheat: 350, wood: 390, iron: 520 },
    baseDurationSec: 35 * 60,
    effectLabel: '+12% كمية استكشاف النفط والغاز البحري لكل مستوى',
  },
  {
    id: 'mil_recon_doctrine',
    name: 'تطوير الاستطلاع الميداني',
    description: 'رفع دقة كشافة الاستطلاع لكشف نسبة أكبر من موارد ومستويات مباني المدن المستطلعة.',
    path: 'military',
    maxLevel: 5,
    requiredResearchCenterLevel: 1,
    requiredHq: 6,
    baseCost: { wheat: 280, wood: 260, iron: 240 },
    baseDurationSec: 20 * 60,
    effectLabel: '+10 نقاط مئوية لنسبة الكشف لكل مستوى (من 20% إلى 70%)',
  },
  {
    id: 'mil_infantry_tactics',
    name: 'عقيدة المشاة والعمليات البرية',
    description: 'تطوير قدرات المشاة والدبابات والتنسيق التكتيكي في الميدان.',
    path: 'military',
    maxLevel: 3,
    requiredResearchCenterLevel: 2,
    requiredHq: 9,
    baseCost: { wheat: 500, wood: 420, iron: 540 },
    baseDurationSec: 45 * 60,
    effectLabel: 'تعزيز الجاهزية القتالية للمشاة والدبابات',
  },
  {
    id: 'mil_armor_division',
    name: 'عقيدة الدفاع الجوي المتقدم',
    description: 'تطوير تكتيكي للمراحل المتقدمة بعد المستوى 10 من المبنى الرئيسي.',
    path: 'military',
    maxLevel: 3,
    requiredResearchCenterLevel: 4,
    requiredHq: 11,
    baseCost: { wheat: 1500, wood: 1400, iron: 2000 },
    baseDurationSec: 120 * 60,
    effectLabel: 'يفتح بعد المبنى الرئيسي مستوى 10 ضمن المرحلة المتقدمة',
    lockedFuture: true,
  },
];

export interface SmartBotPlanMeta {
  id: SmartBotPlanId;
  name: string;
  tagline: string;
  targetSpec: SpecializationId;
  focusBuildings: BuildingType[];
  horizons: {
    phase: string;
    goal: string;
  }[];
}

export const SMART_BOT_PLANS: Record<SmartBotPlanId, SmartBotPlanMeta> = {
  balanced_economy: {
    id: 'balanced_economy',
    name: 'خطة الاقتصاد المتوازن',
    tagline: 'نمو متناغم للموارد الثلاثة والمخزن والميناء للوصول الآمن إلى المبنى الرئيسي مستوى 10.',
    targetSpec: 'agriculture',
    focusBuildings: ['farm', 'sawmill', 'iron_mine', 'warehouse', 'seaport', 'hq'],
    horizons: [
      { phase: 'المدى القصير (مستوى 1–4)', goal: 'تشييد المزرعة والمنشرة والمنجم ثم رفع المخزن للمستوى 2 وفتح الميناء البحري.' },
      { phase: 'المدى المتوسط (مستوى 5–7)', goal: 'اعتماد التخصص وتفعيل مركز الأبحاث وتحسين سلاسل الإمداد.' },
      { phase: 'المدى الطويل (مستوى 8–10)', goal: 'بناء الثكنة العسكرية والجاهزية للتداول في السوق عند المستوى 10.' },
    ],
  },
  industrial_mining: {
    id: 'industrial_mining',
    name: 'خطة الصناعة والتعدين الثقيل',
    tagline: 'تعظيم إنتاج الحديد والخشب لقيادة سلاسل التصنيع والتحصينات.',
    targetSpec: 'mining',
    focusBuildings: ['iron_mine', 'sawmill', 'warehouse', 'research_center', 'hq'],
    horizons: [
      { phase: 'المدى القصير (مستوى 1–4)', goal: 'تأسيس منجمَي حديد ومنشرة وتوسيع المخزن المركزي مبكرًا.' },
      { phase: 'المدى المتوسط (مستوى 5–7)', goal: 'اختيار تخصص التعدين أو الصناعة وتطوير أبحاث الحفر العميق.' },
      { phase: 'المدى الطويل (مستوى 8–10)', goal: 'دعم السوق التجاري بالسبائك والخشب وتشغيل خطوط الإنتاج المتقدمة.' },
    ],
  },
  military_defense: {
    id: 'military_defense',
    name: 'خطة الدفاع والردع الاستراتيجي',
    tagline: 'أولوية قصوى للتحصينات والمستشفى الحديث وحماية حقول الموارد.',
    targetSpec: 'industry',
    focusBuildings: ['fortifications', 'hospital', 'alliance_center', 'barracks', 'hq'],
    horizons: [
      { phase: 'المدى القصير (مستوى 1–4)', goal: 'بناء التحصينات المستوى 1 والمستشفى الحديث ومركز التحالف لتأمين المدينة.' },
      { phase: 'المدى المتوسط (مستوى 5–7)', goal: 'رفع التحصينات للمستوى 3 وتعزيز الإنتاج لدعم التدريب المستقبلي.' },
      { phase: 'المدى الطويل (مستوى 8–10)', goal: 'تشغيل الثكنة العسكرية وحملات حقول الموارد مع حامية دفاعية صلبة.' },
    ],
  },
  maritime_energy: {
    id: 'maritime_energy',
    name: 'خطة التجارة البحرية والطاقة',
    tagline: 'استثمار الساحل عبر الميناء البحري ومنصة استكشاف النفط والغاز.',
    targetSpec: 'energy',
    focusBuildings: ['seaport', 'offshore_rig', 'warehouse', 'research_center', 'hq'],
    horizons: [
      { phase: 'المدى القصير (مستوى 1–4)', goal: 'بناء الميناء البحري عند المستوى 3 وإطلاق أسطول سفن الشحن التجاري.' },
      { phase: 'المدى المتوسط (مستوى 5–7)', goal: 'تشييد منصة النفط والغاز عند المستوى 5 واعتماد تخصص الطاقة.' },
      { phase: 'المدى الطويل (مستوى 8–10)', goal: 'تكثيف مسح آبار النفط والغاز لتغذية السوق العالمي بالموارد.' },
    ],
  },
};

export interface UnitMeta {
  type: UnitType;
  name: string;
  roleDesc: string;
  attack: number;
  defense: number;
  speed: number;
  carry: number;
  cost: ResourceBundle;
  trainTimeSec: number;
  requiredBarracksLevel: number;
}

// GDD §39 Active Troop Types: جنود مشاة · دبابات · طيران + كشافة الاستطلاع
export const UNITS_META: Record<UnitType, UnitMeta> = {
  infantry: {
    type: 'infantry',
    name: 'جنود مشاة',
    roleDesc: 'القوة الأساسية للدفاع عن المدينة وحمل الموارد في العمليات الميدانية.',
    attack: 10,
    defense: 12,
    speed: 10,
    carry: 10,
    cost: { wheat: 5, wood: 3, iron: 2 },
    trainTimeSec: 30,
    requiredBarracksLevel: 1,
  },
  tank: {
    type: 'tank',
    name: 'دبابات',
    roleDesc: 'قوة برية مدرعة ثقيلة ذات قدرة اختراق عالية وحماية صلبة لخطوط القتال.',
    attack: 42,
    defense: 38,
    speed: 7,
    carry: 35,
    cost: { wheat: 18, wood: 14, iron: 36 },
    trainTimeSec: 75,
    requiredBarracksLevel: 1,
  },
  aircraft: {
    type: 'aircraft',
    name: 'طيران',
    roleDesc: 'وحدات جوية هجومية فائقة السرعة لفرض السيطرة والضربات السريعة.',
    attack: 68,
    defense: 24,
    speed: 18,
    carry: 18,
    cost: { wheat: 24, wood: 26, iron: 48 },
    trainTimeSec: 110,
    requiredBarracksLevel: 2,
  },
  scout: {
    type: 'scout',
    name: 'كشافة استطلاع',
    roleDesc: 'وحدة سريعة لكشف المدن ومواقع الموارد (20% أساسي وحتى 70% مع التطوير، ولا يلغي الدرع).',
    attack: 1,
    defense: 3,
    speed: 16,
    carry: 0,
    cost: { wheat: 4, wood: 2, iron: 1 },
    trainTimeSec: 25,
    requiredBarracksLevel: 1,
  },
};

export interface SpeedUpCardMeta {
  id: SpeedUpTierId;
  name: string;
  seconds: number;
  gemCost: number;
}

// GDD v3.1 §13: Exact 7 tiers (5h removed), starting 10 Gems then ×5 per tier
export const SPEEDUP_CARDS_META: Record<SpeedUpTierId, SpeedUpCardMeta> = {
  '1m': { id: '1m', name: 'دقيقة واحدة', seconds: 60, gemCost: 10 },
  '5m': { id: '5m', name: '5 دقائق', seconds: 5 * 60, gemCost: 50 },
  '30m': { id: '30m', name: '30 دقيقة', seconds: 30 * 60, gemCost: 250 },
  '1h': { id: '1h', name: 'ساعة واحدة', seconds: 60 * 60, gemCost: 1250 },
  '24h': { id: '24h', name: '24 ساعة', seconds: 24 * 3600, gemCost: 6250 },
  '3d': { id: '3d', name: '3 أيام', seconds: 3 * 24 * 3600, gemCost: 31250 },
  '7d': { id: '7d', name: 'أسبوع', seconds: 7 * 24 * 3600, gemCost: 156250 },
};

export const SHIELD_PACKAGES: readonly {
  id: '24h' | '3d' | '7d' | '30d';
  name: string;
  durationSec: number;
  defaultGems: number;
}[] = [
  { id: '24h', name: 'درع حماية 24 ساعة', durationSec: 24 * 3600, defaultGems: 150 },
  { id: '3d', name: 'درع حماية 3 أيام', durationSec: 3 * 24 * 3600, defaultGems: 400 },
  { id: '7d', name: 'درع حماية أسبوع', durationSec: 7 * 24 * 3600, defaultGems: 850 },
  { id: '30d', name: 'درع حماية شهر', durationSec: 30 * 24 * 3600, defaultGems: 2500 },
];

// GDD v3.1 §12 Gem Packages
export const DEFAULT_GEM_PACKAGES: GemPackageConfig[] = [
  { id: 'pack-starter', name: 'الباقة المبتدئة', baseGems: 100, bonusGems: 0, priceSar: 10 },
  { id: 'pack-small', name: 'الباقة الصغيرة', baseGems: 250, bonusGems: 0, priceSar: 25 },
  { id: 'pack-medium', name: 'الباقة المتوسطة', baseGems: 500, bonusGems: 25, priceSar: 50 },
  { id: 'pack-advanced', name: 'الباقة المتقدمة', baseGems: 1000, bonusGems: 100, priceSar: 100 },
  { id: 'pack-large', name: 'الباقة الكبيرة', baseGems: 2000, bonusGems: 300, priceSar: 200 },
  { id: 'pack-royal', name: 'الباقة الملكية', baseGems: 5000, bonusGems: 1000, priceSar: 500 },
];

export const PAYMENT_METHODS_META: Record<
  PaymentMethodId,
  { id: PaymentMethodId; name: string; subtitle: string; requiresReceipt: boolean }
> = {
  apple_pay: {
    id: 'apple_pay',
    name: 'Apple Pay',
    subtitle: 'دفع إلكتروني سريع عبر Apple Pay — يدخل الطلب للمراجعة قبل التفعيل.',
    requiresReceipt: false,
  },
  mada: {
    id: 'mada',
    name: 'بطاقة مدى',
    subtitle: 'الشبكة السعودية للمدفوعات — مطابقة يدوية من الإدارة قبل التفعيل.',
    requiresReceipt: false,
  },
  bank_transfer: {
    id: 'bank_transfer',
    name: 'التحويل البنكي',
    subtitle: 'تحويل بنكي مباشر مع إرفاق صورة الفاتورة أو الإيصال للمراجعة المالية.',
    requiresReceipt: true,
  },
  binance: {
    id: 'binance',
    name: 'بايننس (Binance Pay)',
    subtitle: 'تحويل عبر Binance Pay أو USDT مع إرفاق صورة إيصال التحويل للمراجعة.',
    requiresReceipt: true,
  },
};

export const DEFAULT_GAME_SERVERS: GameServerConfig[] = [
  {
    id: 'srv-1',
    code: 'S1',
    name: 'السيرفر الأول — عاصمة التاج',
    capacity: 150,
    isOpen: false,
    note: 'السيرفر الافتتاحي (مغلق لحين فتحه لجميع اللاعبين من الإدارة)',
  },
  {
    id: 'srv-2',
    code: 'S2',
    name: 'السيرفر الثاني — آفاق الطاقة',
    capacity: 150,
    isOpen: false,
    note: 'سيرفر توسعي جديد بسعة 150 لاعبًا',
  },
];

export const DEFAULT_PAYMENT_METHODS: Record<PaymentMethodId, PaymentMethodConfig> = {
  apple_pay: {
    id: 'apple_pay',
    enabled: true,
    discountPct: 0,
    note: '',
    bankOrNetwork: '',
    accountTitle: '',
    accountNumber: '',
    ibanOrAddress: '',
    paymentLink: '',
    instructions: '',
  },
  mada: {
    id: 'mada',
    enabled: true,
    discountPct: 0,
    note: '',
    bankOrNetwork: '',
    accountTitle: '',
    accountNumber: '',
    ibanOrAddress: '',
    paymentLink: '',
    instructions: '',
  },
  bank_transfer: {
    id: 'bank_transfer',
    enabled: true,
    discountPct: 0,
    note: '',
    bankOrNetwork: '',
    accountTitle: '',
    accountNumber: '',
    ibanOrAddress: '',
    paymentLink: '',
    instructions: '',
  },
  binance: {
    id: 'binance',
    enabled: true,
    discountPct: 0,
    note: '',
    bankOrNetwork: '',
    accountTitle: '',
    accountNumber: '',
    ibanOrAddress: '',
    paymentLink: '',
    instructions: '',
  },
};

export const MARKET_RESOURCES_META: Record<
  MarketResourceId,
  {
    id: MarketResourceId;
    name: string;
    unit: string;
    category: 'مورد أساسي' | 'طاقة بحرية';
    defaultMinPrice: number;
    defaultMaxPrice: number;
    suggestedFairPrice: number; // Reference price per 1,000 units (Gems)
  }
> = {
  wheat: {
    id: 'wheat',
    name: 'القمح الاستراتيجي',
    unit: 'وحدة',
    category: 'مورد أساسي',
    defaultMinPrice: 13.3,
    defaultMaxPrice: 28.5,
    suggestedFairPrice: 19,
  },
  wood: {
    id: 'wood',
    name: 'الأخشاب المعالجة',
    unit: 'وحدة',
    category: 'مورد أساسي',
    defaultMinPrice: 9.8,
    defaultMaxPrice: 21,
    suggestedFairPrice: 14,
  },
  iron: {
    id: 'iron',
    name: 'خام الحديد',
    unit: 'وحدة',
    category: 'مورد أساسي',
    defaultMinPrice: 7,
    defaultMaxPrice: 15,
    suggestedFairPrice: 10,
  },
  crude_oil: {
    id: 'crude_oil',
    name: 'النفط الخام البحري',
    unit: 'برميل',
    category: 'طاقة بحرية',
    defaultMinPrice: 28,
    defaultMaxPrice: 60,
    suggestedFairPrice: 40,
  },
  natural_gas: {
    id: 'natural_gas',
    name: 'الغاز الطبيعي',
    unit: 'وحدة',
    category: 'طاقة بحرية',
    defaultMinPrice: 22.4,
    defaultMaxPrice: 48,
    suggestedFairPrice: 32,
  },
};

export function createDefaultMonthlyRewards(): MonthlyRewardDayConfig[] {
  const days: MonthlyRewardDayConfig[] = [];
  for (let d = 1; d <= 30; d++) {
    const scale = 1 + Math.floor((d - 1) / 5) * 0.4;
    const isDay30 = d === 30;
    const isMajorMilestone = d % 10 === 0;
    const isMinorMilestone = d % 5 === 0;

    // Free track: suitable daily resources & speed-up cards (no gems)
    const freeSpeed: SpeedUpTierId | undefined = isDay30
      ? '1h'
      : d === 10 || d === 20
        ? '30m'
        : isMinorMilestone
          ? '5m'
          : d % 3 === 0
            ? '1m'
            : undefined;

    // Paid VIP track: rich resources & speed-ups on Days 1-29 (0 gems), ONLY Day 30 has 100 gems
    const vipSpeed: SpeedUpTierId | undefined = isDay30
      ? '24h'
      : d === 25
        ? '24h'
        : d === 7 || d === 14 || d === 21 || d === 28
          ? '1h'
          : isMajorMilestone || isMinorMilestone
            ? '30m'
            : d % 2 === 0
              ? '5m'
              : '1m';

    const speedLabelMap: Record<SpeedUpTierId, string> = {
      '1m': '1 دقيقة',
      '5m': '5 دقائق',
      '30m': '30 دقيقة',
      '1h': 'ساعة واحدة',
      '24h': '24 ساعة',
      '3d': '3 أيام',
      '7d': '7 أيام',
    };

    const freeWheat = Math.round(110 * scale);
    const freeWood = Math.round(95 * scale);
    const freeIron = Math.round(80 * scale);

    const vipWheat = Math.round(320 * scale);
    const vipWood = Math.round(280 * scale);
    const vipIron = Math.round(240 * scale);

    days.push({
      day: d,
      freeLabel: isDay30
        ? `ختام الشهر المجاني (${freeWheat} قمح · ${freeWood} خشب · ${freeIron} حديد)`
        : freeSpeed
          ? `حزمة اليوم ${d} + تسريع ${speedLabelMap[freeSpeed]}`
          : `حزمة إمداد اليوم ${d} (${freeWheat} قمح / ${freeWood} خشب / ${freeIron} حديد)`,
      freeWheat,
      freeWood,
      freeIron,
      freeSpeedUpTier: freeSpeed,
      vipLabel: isDay30
        ? 'الجائزة الكبرى (اليوم 30): 100 جوهرة + إمداد ملكي + تسريع 24 ساعة'
        : `حزمة VIP اليوم ${d} + بطاقة تسريع ${speedLabelMap[vipSpeed]}`,
      vipGems: isDay30 ? 100 : 0,
      vipWheat,
      vipWood,
      vipIron,
      vipSpeedUpTier: vipSpeed,
    });
  }
  return days;
}

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  gemPackages: DEFAULT_GEM_PACKAGES.map((p) => ({ ...p })),
  speedUpGemCosts: {
    '1m': 10,
    '5m': 50,
    '30m': 250,
    '1h': 1250,
    '24h': 6250,
    '3d': 31250,
    '7d': 156250,
  },
  instantFinishGemsPerBlock: 100,
  instantFinishBlockMinutes: 3,
  marchSpeedUpGemsPerMin: 50,
  attackBoostGems: 100,
  defenseBoostGems: 100,
  shieldPricesGems: {
    '24h': 150,
    '3d': 400,
    '7d': 850,
    '30d': 2500,
  },
  hakimPriceSar: 3000,
  hakimDurationDays: 90,
  vipPriceSar: 37.5,
  vipPriceUsd: 10,
  vipDurationDays: 30,
  marketFeePct: 5,
  marketOfferDurationDays: 7,
  marketResaleHoldDays: 14,
  marketMaxQuotaPct: 30,
  hakimBonusQuotaPct: 5,
  tradePointsPer100NetGems: 80,
  registrationFeeSar: 200,
  servers: DEFAULT_GAME_SERVERS.map((s) => ({ ...s })),
  paymentMethods: {
    apple_pay: { ...DEFAULT_PAYMENT_METHODS.apple_pay },
    mada: { ...DEFAULT_PAYMENT_METHODS.mada },
    bank_transfer: { ...DEFAULT_PAYMENT_METHODS.bank_transfer },
    binance: { ...DEFAULT_PAYMENT_METHODS.binance },
  },
  resourcePriceBounds: {
    wheat: { referencePrice: 19, min: 13.3, max: 28.5, enabled: true },
    wood: { referencePrice: 14, min: 9.8, max: 21, enabled: true },
    iron: { referencePrice: 10, min: 7, max: 15, enabled: true },
    crude_oil: { referencePrice: 40, min: 28, max: 60, enabled: true },
    natural_gas: { referencePrice: 32, min: 22.4, max: 48, enabled: true },
  },
  monthlyRewards: createDefaultMonthlyRewards(),
  notificationsEnabled: true,
};

export function createInitialMarketOffers(now: number): MarketOffer[] {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return [
    {
      id: 'offer-seed-1',
      sellerId: 'npc-iron-citadel',
      sellerName: 'القائدة نورة',
      sellerCity: 'حصن الفولاذ',
      sellerMainLevel: 10,
      resource: 'iron',
      initialQty: 1200,
      remainingQty: 1200,
      reservedQty: 0,
      unitPriceGems: 10.5,
      createdAt: now - 3 * 3600 * 1000,
      expiresAt: now - 3 * 3600 * 1000 + sevenDays,
      status: 'active',
    },
    {
      id: 'offer-seed-2',
      sellerId: 'npc-glory-city',
      sellerName: 'القائد طارق',
      sellerCity: 'مدينة المجد',
      sellerMainLevel: 10,
      resource: 'wheat',
      initialQty: 2500,
      remainingQty: 2500,
      reservedQty: 0,
      unitPriceGems: 19,
      createdAt: now - 6 * 3600 * 1000,
      expiresAt: now - 6 * 3600 * 1000 + sevenDays,
      status: 'active',
    },
    {
      id: 'offer-seed-3',
      sellerId: 'npc-gulf-port',
      sellerName: 'المهندس راشد',
      sellerCity: 'ميناء الخليج',
      sellerMainLevel: 11,
      resource: 'crude_oil',
      initialQty: 400,
      remainingQty: 400,
      reservedQty: 0,
      unitPriceGems: 40,
      createdAt: now - 9 * 3600 * 1000,
      expiresAt: now - 9 * 3600 * 1000 + sevenDays,
      status: 'active',
    },
    {
      id: 'offer-seed-4',
      sellerId: 'npc-light-gate',
      sellerName: 'الأمير سيف',
      sellerCity: 'بوابة النور',
      sellerMainLevel: 10,
      resource: 'wood',
      initialQty: 1500,
      remainingQty: 1500,
      reservedQty: 0,
      unitPriceGems: 14,
      createdAt: now - 2 * 3600 * 1000,
      expiresAt: now - 2 * 3600 * 1000 + sevenDays,
      status: 'active',
      suspiciousFlag: true,
      flagReason: 'مؤشر تداول متكرر على نفس النطاق (للمراجعة الإدارية دون حظر تلقائي)',
    },
  ];
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'جديدة',
  in_review: 'قيد المراجعة',
  awaiting_player: 'بانتظار رد اللاعب',
  replied: 'تم الرد',
  closed: 'مغلقة',
};

export interface QuestDef {
  id: string;
  category: 'daily' | 'weekly' | 'achievement';
  title: string;
  description: string;
  rewards: {
    wheat: number;
    wood: number;
    iron: number;
    achievementPoints: number;
    speedUp?: { tier: SpeedUpTierId; count: number };
  };
}

export const QUESTS_CATALOG: QuestDef[] = [
  {
    id: 'ach_first_farm',
    category: 'achievement',
    title: 'تأمين الغذاء الأول',
    description: 'قم ببناء مزرعة ذكية واحدة على الأقل في مدينتك.',
    rewards: {
      wheat: 180,
      wood: 120,
      iron: 90,
      achievementPoints: 20,
      speedUp: { tier: '5m', count: 1 },
    },
  },
  {
    id: 'ach_all_three_prod',
    category: 'achievement',
    title: 'ثلاثية الإنتاج الأساسية',
    description: 'امتلك مزرعة ومنشرة ومنجم حديد مكتملة البناء.',
    rewards: {
      wheat: 260,
      wood: 260,
      iron: 220,
      achievementPoints: 40,
      speedUp: { tier: '5m', count: 2 },
    },
  },
  {
    id: 'ach_hq2',
    category: 'achievement',
    title: 'توسيع المبنى الرئيسي',
    description: 'قم بترقية المبنى الرئيسي إلى المستوى 2.',
    rewards: {
      wheat: 320,
      wood: 280,
      iron: 240,
      achievementPoints: 50,
      speedUp: { tier: '30m', count: 1 },
    },
  },
  {
    id: 'ach_warehouse2',
    category: 'achievement',
    title: 'توسيع المخزن المركزي',
    description: 'طوّر المخزن المركزي إلى المستوى 2 لحماية 9,000 وحدة من الموارد.',
    rewards: {
      wheat: 300,
      wood: 300,
      iron: 200,
      achievementPoints: 45,
    },
  },
  {
    id: 'ach_fort1',
    category: 'achievement',
    title: 'درع المدينة الأول',
    description: 'شيّد التحصينات الدفاعية إلى المستوى 1.',
    rewards: {
      wheat: 280,
      wood: 320,
      iron: 300,
      achievementPoints: 60,
    },
  },
  {
    id: 'ach_hq5_spec',
    category: 'achievement',
    title: 'تحديد هوية الاقتصاد',
    description: 'صل إلى المستوى 5 من المبنى الرئيسي واختر التخصص الرئيسي لمدينتك.',
    rewards: {
      wheat: 800,
      wood: 800,
      iron: 650,
      achievementPoints: 120,
      speedUp: { tier: '1h', count: 1 },
    },
  },
  // Daily Quests (21:00 UTC daily reset)
  {
    id: 'daily_build_action',
    category: 'daily',
    title: 'حركة البناء اليومية',
    description: 'امتلك عملية بناء أو تطوير نشطة أو منشأة إنتاج واحدة على الأقل (يتجدد الساعة 21:00 بتوقيت UTC العالمي).',
    rewards: { wheat: 140, wood: 140, iron: 100, achievementPoints: 15 },
  },
  {
    id: 'daily_prod_200',
    category: 'daily',
    title: 'تدفق الموارد المستمر',
    description: 'حقق معدل إنتاج إجمالي لا يقل عن 200 وحدة/ساعة.',
    rewards: { wheat: 200, wood: 180, iron: 160, achievementPoints: 20 },
  },
  // Weekly Quests (Sunday 21:00 UTC reset)
  {
    id: 'weekly_infra_push',
    category: 'weekly',
    title: 'خطة التطوير الأسبوعية',
    description: 'حقق إجمالي مستويات مبانٍ لا يقل عن 6 مستويات في مدينتك (يبدأ الأسبوع الساعة 21:00 مساء الأحد بتوقيت UTC العالمي).',
    rewards: {
      wheat: 550,
      wood: 500,
      iron: 420,
      achievementPoints: 75,
      speedUp: { tier: '30m', count: 1 },
    },
  },
];

export const COOP_QUESTS_CATALOG: CoopQuestDef[] = [
  {
    id: 'coop_builds_30',
    title: 'حملة الإعمار الجماعية',
    description:
      'يتعاون جميع لاعبي السيرفر لإنجاز 30 ترقية مبنى إضافية إجمالاً (تُحتسب المستويات المطوّرة فوق مستوى البداية).',
    metricKey: 'total_building_upgrades',
    unitLabel: 'ترقية مبنى',
    targetValue: 30,
    minHqRequired: 10,
    requiresAllianceCenter: true,
    rewards: {
      wheat: 1500,
      wood: 1500,
      iron: 1200,
      achievementPoints: 120,
      speedUp: { tier: '30m', count: 2 },
    },
  },
  {
    id: 'coop_hq10_3',
    title: 'قادة النخبة — المستوى 10',
    description:
      'وصول 3 قادة على الأقل في نفس السيرفر إلى المبنى الرئيسي مستوى 10 لفتح عصر التحالفات الكبرى.',
    metricKey: 'hq10_players',
    unitLabel: 'قائد (HQ 10)',
    targetValue: 3,
    minHqRequired: 10,
    requiresAllianceCenter: true,
    rewards: {
      wheat: 3200,
      wood: 3200,
      iron: 2800,
      achievementPoints: 250,
      speedUp: { tier: '1h', count: 1 },
    },
  },
  {
    id: 'coop_alliance_10',
    title: 'الركيزة الدبلوماسية للسيرفر',
    description:
      'رفع مجموع مستويات مباني «مركز التحالف» لدى جميع لاعبي السيرفر إلى 10 مستويات مشتركة.',
    metricKey: 'alliance_center_levels',
    unitLabel: 'مستوى مركز تحالف',
    targetValue: 10,
    minHqRequired: 10,
    requiresAllianceCenter: true,
    rewards: {
      wheat: 2800,
      wood: 2800,
      iron: 2400,
      achievementPoints: 220,
      speedUp: { tier: '1h', count: 1 },
    },
  },
  {
    id: 'coop_research_20',
    title: 'مبادرة التفوق التقني',
    description:
      'إتمام 20 مستوى بحث علمي بشكل تراكمي بين جميع لاعبي السيرفر في مراكز الأبحاث.',
    metricKey: 'total_research_levels',
    unitLabel: 'مستوى بحث',
    targetValue: 20,
    minHqRequired: 10,
    requiresAllianceCenter: true,
    rewards: {
      wheat: 2200,
      wood: 2200,
      iron: 2600,
      achievementPoints: 180,
      speedUp: { tier: '30m', count: 2 },
    },
  },
  {
    id: 'coop_army_500',
    title: 'الجاهزية العسكرية المشتركة',
    description:
      'حشد وتدريب 500 وحدة عسكرية واستطلاعية في مجموع حاميات لاعبي السيرفر.',
    metricKey: 'total_army_units',
    unitLabel: 'وحدة عسكرية',
    targetValue: 500,
    minHqRequired: 10,
    requiresAllianceCenter: true,
    rewards: {
      wheat: 2400,
      wood: 2000,
      iron: 3000,
      achievementPoints: 200,
      speedUp: { tier: '1h', count: 1 },
    },
  },
  {
    id: 'coop_energy_1500',
    title: 'تحالف الطاقة البحرية',
    description:
      'تكوين مخزون مشترك قدره 1,500 وحدة من النفط الخام والغاز الطبيعي لدى لاعبي السيرفر.',
    metricKey: 'maritime_energy_stock',
    unitLabel: 'برميل/وحدة طاقة',
    targetValue: 1500,
    minHqRequired: 10,
    requiresAllianceCenter: true,
    rewards: {
      wheat: 3600,
      wood: 3400,
      iron: 3400,
      achievementPoints: 350,
      speedUp: { tier: '24h', count: 1 },
    },
  },
];

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  plains: 'سهول زراعية',
  forest: 'غابات',
  mountains: 'جبال',
  desert: 'صحاري',
  coast: 'سواحل',
};

export function generateInitialWorldMap(now: number): WorldTile[] {
  const tiles: WorldTile[] = [];
  const centerX = 412;
  const centerY = 288;

  const terrainPattern: TerrainType[] = [
    'plains',
    'forest',
    'plains',
    'mountains',
    'coast',
    'desert',
    'forest',
  ];

  const npcCities: Record<
    string,
    {
      name: string;
      owner: string;
      hq: number;
      points: number;
      protectedDays: number;
      terrain: TerrainType;
      loot: ResourceBundle;
    }
  > = {
    '410,287': {
      name: 'مدينة المجد',
      owner: 'القائد طارق',
      hq: 3,
      points: 420,
      protectedDays: 11,
      terrain: 'plains',
      loot: { wheat: 620, wood: 480, iron: 390 },
    },
    '414,287': {
      name: 'بوابة النور',
      owner: 'الأمير سيف',
      hq: 4,
      points: 610,
      protectedDays: 0,
      terrain: 'forest',
      loot: { wheat: 850, wood: 940, iron: 510 },
    },
    '411,290': {
      name: 'حصن الفولاذ',
      owner: 'القائدة نورة',
      hq: 2,
      points: 290,
      protectedDays: 13,
      terrain: 'mountains',
      loot: { wheat: 310, wood: 350, iron: 480 },
    },
    '415,289': {
      name: 'ميناء الخليج',
      owner: 'المهندس راشد',
      hq: 5,
      points: 940,
      protectedDays: 0,
      terrain: 'coast',
      loot: { wheat: 1100, wood: 980, iron: 820 },
    },
    '409,289': {
      name: 'الواحة الخضراء',
      owner: 'القائد فيصل',
      hq: 3,
      points: 470,
      protectedDays: 6,
      terrain: 'plains',
      loot: { wheat: 540, wood: 410, iron: 300 },
    },
  };

  const strategicSites: Record<
    string,
    {
      name: string;
      siteCategory: WorldTile['siteCategory'];
      terrain: TerrainType;
    }
  > = {
    '413,286': {
      name: 'محطة رصد التل الشمالي',
      siteCategory: 'موقع مراقبة',
      terrain: 'mountains',
    },
    '411,286': {
      name: 'غابة الإمداد المركزية',
      siteCategory: 'مورد استراتيجي',
      terrain: 'forest',
    },
    '413,289': {
      name: 'معبر الوادي التجاري',
      siteCategory: 'ممر استراتيجي',
      terrain: 'plains',
    },
    '410,290': {
      name: 'سوق القوافل الإقليمي',
      siteCategory: 'موقع تجاري',
      terrain: 'desert',
    },
    '415,286': {
      name: 'القطاع العسكري الشرقي',
      siteCategory: 'موقع عسكري',
      terrain: 'mountains',
    },
  };

  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      const key = `${x},${y}`;

      if (x === centerX && y === centerY) {
        tiles.push({
          id: `tile-${x}-${y}`,
          x,
          y,
          terrain: 'plains',
          kind: 'player_city',
          name: 'عاصمة التاج',
          ownerName: 'أنت',
          hqLevel: 1,
          points: 120,
          protectedUntil: now + PROTECTION_DURATION_MS,
          scouted: true,
        });
        continue;
      }

      const npc = npcCities[key];
      if (npc) {
        tiles.push({
          id: `tile-${x}-${y}`,
          x,
          y,
          terrain: npc.terrain,
          kind: 'npc_city',
          name: npc.name,
          ownerName: npc.owner,
          hqLevel: npc.hq,
          points: npc.points,
          protectedUntil:
            npc.protectedDays > 0
              ? now + npc.protectedDays * 24 * 60 * 60 * 1000
              : undefined,
          scouted: false,
          mockLootStock: npc.loot,
        });
        continue;
      }

      const site = strategicSites[key];
      if (site) {
        tiles.push({
          id: `tile-${x}-${y}`,
          x,
          y,
          terrain: site.terrain,
          kind: 'strategic_site',
          name: site.name,
          siteCategory: site.siteCategory,
          scouted: false,
        });
        continue;
      }

      const idx = Math.abs(x * 7 + y * 13) % terrainPattern.length;
      const terrain = terrainPattern[idx];
      tiles.push({
        id: `tile-${x}-${y}`,
        x,
        y,
        terrain,
        kind: 'wilderness',
        name: TERRAIN_LABELS[terrain],
        scouted: false,
      });
    }
  }

  return tiles;
}
