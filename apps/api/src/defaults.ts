export type JsonObject = Record<string, unknown>;

const KSA_OFFSET_MS = 3 * 60 * 60 * 1000;
const PROTECTION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

function getKsaDayKey(ts: number): string {
  const d = new Date(ts + KSA_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getKsaWeekKey(ts: number): string {
  const d = new Date(ts + KSA_OFFSET_MS);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

function getKsaMonthKey(ts: number): string {
  const d = new Date(ts + KSA_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function createDefaultMonthlyRewards() {
  const speedLabelMap: Record<string, string> = {
    '1m': '1 دقيقة',
    '5m': '5 دقائق',
    '30m': '30 دقيقة',
    '1h': 'ساعة واحدة',
    '24h': '24 ساعة',
    '3d': '3 أيام',
    '7d': '7 أيام',
  };

  const days: JsonObject[] = [];
  for (let d = 1; d <= 30; d++) {
    const scale = 1 + Math.floor((d - 1) / 5) * 0.4;
    const isDay30 = d === 30;
    const isMajorMilestone = d % 10 === 0;
    const isMinorMilestone = d % 5 === 0;

    const freeSpeed = isDay30
      ? '1h'
      : d === 10 || d === 20
        ? '30m'
        : isMinorMilestone
          ? '5m'
          : d % 3 === 0
            ? '1m'
            : undefined;

    const vipSpeed = isDay30
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
      ...(freeSpeed ? { freeSpeedUpTier: freeSpeed } : {}),
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

export function createDefaultAdminConfig(): JsonObject {
  return {
    gemPackages: [
      { id: 'pack-starter', name: 'الباقة المبتدئة', baseGems: 100, bonusGems: 0, priceSar: 10 },
      { id: 'pack-small', name: 'الباقة الصغيرة', baseGems: 250, bonusGems: 0, priceSar: 25 },
      { id: 'pack-medium', name: 'الباقة المتوسطة', baseGems: 500, bonusGems: 25, priceSar: 50 },
      { id: 'pack-advanced', name: 'الباقة المتقدمة', baseGems: 1000, bonusGems: 100, priceSar: 100 },
      { id: 'pack-large', name: 'الباقة الكبيرة', baseGems: 2000, bonusGems: 300, priceSar: 200 },
      { id: 'pack-royal', name: 'الباقة الملكية', baseGems: 5000, bonusGems: 1000, priceSar: 500 },
    ],
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
    servers: [
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
    ],
    paymentMethods: {
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
}

function generateInitialWorldMap(now: number): JsonObject[] {
  const tiles: JsonObject[] = [];
  const centerX = 412;
  const centerY = 288;
  const terrainPattern = ['plains', 'forest', 'plains', 'mountains', 'coast', 'desert', 'forest'] as const;
  const terrainLabels: Record<string, string> = {
    plains: 'سهول زراعية',
    forest: 'غابات',
    mountains: 'جبال',
    desert: 'صحاري',
    coast: 'سواحل',
  };

  const npcCities: Record<string, { name: string; owner: string; hq: number; points: number; protectedDays: number; terrain: string; loot: JsonObject }> = {
    '410,287': { name: 'مدينة المجد', owner: 'القائد طارق', hq: 3, points: 420, protectedDays: 11, terrain: 'plains', loot: { wheat: 620, wood: 480, iron: 390 } },
    '414,287': { name: 'بوابة النور', owner: 'الأمير سيف', hq: 4, points: 610, protectedDays: 0, terrain: 'forest', loot: { wheat: 850, wood: 940, iron: 510 } },
    '411,290': { name: 'حصن الفولاذ', owner: 'القائدة نورة', hq: 2, points: 290, protectedDays: 13, terrain: 'mountains', loot: { wheat: 310, wood: 350, iron: 480 } },
    '415,289': { name: 'ميناء الخليج', owner: 'المهندس راشد', hq: 5, points: 940, protectedDays: 0, terrain: 'coast', loot: { wheat: 1100, wood: 980, iron: 820 } },
    '409,289': { name: 'الواحة الخضراء', owner: 'القائد فيصل', hq: 3, points: 470, protectedDays: 6, terrain: 'plains', loot: { wheat: 540, wood: 410, iron: 300 } },
  };

  const strategicSites: Record<string, { name: string; siteCategory: string; terrain: string }> = {
    '413,286': { name: 'محطة رصد التل الشمالي', siteCategory: 'موقع مراقبة', terrain: 'mountains' },
    '411,286': { name: 'غابة الإمداد المركزية', siteCategory: 'مورد استراتيجي', terrain: 'forest' },
    '413,289': { name: 'معبر الوادي التجاري', siteCategory: 'ممر استراتيجي', terrain: 'plains' },
    '410,290': { name: 'سوق القوافل الإقليمي', siteCategory: 'موقع تجاري', terrain: 'desert' },
    '415,286': { name: 'القطاع العسكري الشرقي', siteCategory: 'موقع عسكري', terrain: 'mountains' },
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
          ...(npc.protectedDays > 0 ? { protectedUntil: now + npc.protectedDays * 24 * 60 * 60 * 1000 } : {}),
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
        name: terrainLabels[terrain],
        scouted: false,
      });
    }
  }
  return tiles;
}

function createInitialMarketOffers(now: number): JsonObject[] {
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

export function buildInitialPlayerState(params: {
  accountId: string;
  commanderName: string;
  email: string | null;
  phone: string | null;
  serverId: string;
  adminConfig: JsonObject;
  now: number;
  registration?: JsonObject;
  paymentOrders?: JsonObject[];
}): JsonObject {
  const { accountId, commanderName, email, phone, serverId, adminConfig, now } = params;
  const registrationFeeSar =
    typeof adminConfig.registrationFeeSar === 'number' ? adminConfig.registrationFeeSar : 200;

  return {
    version: 3,
    accountId,
    commanderName,
    cityName: 'عاصمة التاج',
    cityCoords: { x: 412, y: 288 },
    cityTerrain: 'plains',
    createdAt: now,
    lastTickAt: now,
    protectionEndsAt: now + PROTECTION_DURATION_MS,
    shieldEndsAt: null,
    combatBuffs: {
      attackBoostEndsAt: null,
      defenseBoostEndsAt: null,
    },
    resources: { wheat: 600, wood: 600, iron: 600 },
    gemLedger: {
      chargedGems: 0,
      bonusGems: 0,
      marketGems: 0,
    },
    ledger: {
      paidGems: 0,
      tradeBalance: 0,
      achievementPoints: 0,
    },
    specialization: null,
    smartBotActive: false,
    smartBotExpiresAt: null,
    hakimSubscription: {
      active: false,
      startedAt: null,
      expiresAt: null,
      renewCount: 0,
    },
    vipSubscription: {
      active: false,
      startedAt: null,
      expiresAt: null,
      renewCount: 0,
    },
    monthlyRewards: {
      claimedDays: [],
      lastClaimKsaDayKey: null,
      vipClaimsByDay: [],
    },
    botConfig: {
      planId: 'balanced_economy',
      autoDevelopCity: false,
      autoRaidResourceFields: false,
      minGarrisonReservePct: 50,
    },
    maritime: {
      cargoShips: 0,
      surveyVessels: 0,
      discoveredOilWells: 0,
      discoveredGasFields: 0,
      crudeOilStock: 0,
      naturalGasStock: 0,
      activeExpeditions: [],
    },
    buildings: [
      { id: 'b-hq', plotId: 'p-hq', type: 'hq', level: 1, targetLevel: 1, status: 'COMPLETED' },
      { id: 'b-wh', plotId: 'p-wh', type: 'warehouse', level: 1, targetLevel: 1, status: 'COMPLETED' },
      { id: 'b-wall', plotId: 'p-wall', type: 'fortifications', level: 0, targetLevel: 0, status: 'EMPTY' },
    ],
    buildQueue: [],
    researchLevels: {},
    researchQueue: [],
    units: { infantry: 0, tank: 0, aircraft: 0, scout: 0 },
    trainingQueue: [],
    marches: [],
    speedUpCards: { '1m': 2, '5m': 2, '30m': 0, '1h': 0, '24h': 0, '3d': 0, '7d': 0 },
    questClaims: {},
    coopQuestClaims: {},
    dailyResetKey: getKsaDayKey(now),
    weeklyResetKey: getKsaWeekKey(now),
    reports: [
      {
        id: 'rep-welcome',
        category: 'bot',
        title: 'توجيه المساعد المجاني: تأسيس مدينتك في ENGINORA CITY',
        summary: 'بدأت مدينتك عند المبنى الرئيسي مستوى 1 بمخزن مركزي مستوى 1 وحماية مبتدئ لمدة 14 يومًا.',
        details: [
          'تم تخصيص 600 قمح، 600 خشب، و600 حديد كبداية متساوية لجميع اللاعبين.',
          'التوقيت الرسمي داخل اللعبة هو التوقيت العالمي (UTC)، وتبدأ دورة اليوم الجديد عند الساعة 21:00 UTC.',
          'ترقية المبنى الرئيسي إلى المستوى 2 تتطلب وجود المزرعة والمنشرة والمنجم بمستوى 1.',
        ],
        createdAt: now,
        read: false,
      },
    ],
    worldMap: generateInitialWorldMap(now),
    market: {
      offers: createInitialMarketOffers(now),
      pendingBuys: [],
      tradeLedger: [],
      purchasedBatches: [],
      quotaMonthKey: getKsaMonthKey(now),
      monthlyStockSnapshot: 1800,
      usedQuotaUnits: 0,
      marketFrozenForPlayer: false,
      marketBanUntil: null,
      playerInternalDebtGems: 0,
    },
    paymentOrders: params.paymentOrders ?? [],
    financialLogs: [],
    adminAuditLogs: [],
    supportTickets: [
      {
        id: 'TKT-1001',
        accountId,
        playerName: commanderName,
        subject: 'استفسار تجريبي حول باقة الجواهر والتجارة',
        category: 'المدفوعات والمتجر',
        status: 'replied',
        createdAt: now - 3600 * 1000,
        updatedAt: now - 1800 * 1000,
        unreadByPlayer: true,
        unreadBySupport: false,
        messages: [
          {
            id: 'msg-1',
            senderRole: 'player',
            senderName: commanderName,
            text: 'مرحبًا، أين أستطيع متابعة حالة طلبات التحويل البنكي الخاصة بي؟',
            attachments: [],
            createdAt: now - 3600 * 1000,
          },
          {
            id: 'msg-2',
            senderRole: 'support',
            senderName: 'فريق الدعم الفني',
            text: 'أهلاً بك يا قائد! جميع طلبات الدفع (Apple Pay / مدى / التحويل البنكي) تظهر في قسم «المتجر والجواهر» وتتم مراجعتها يدويًا من المؤسس قبل تفعيل الجواهر.',
            attachments: [],
            createdAt: now - 1800 * 1000,
          },
        ],
      },
    ],
    telegram: {
      linked: false,
      username: '',
      verificationCode: '',
      codeExpiresAt: null,
      alerts: {
        market: true,
        purchases: true,
        offerExpiry: true,
        construction: true,
        research: true,
        army: true,
        important: true,
      },
    },
    allianceMeta: {
      currentAlliance: null,
      lastCreatedAllianceAt: null,
    },
    adminConfig,
    selectedServerId: serverId,
    registration: params.registration ?? {
      status: 'unregistered',
      nickname: commanderName,
      fullName: '',
      nationalId: '',
      email: email ?? '',
      phone: phone ?? '',
      feeAmountSar: registrationFeeSar,
      acceptedPolicies: false,
    },
    soundEnabled: true,
  };
}

export interface ApiCoopQuestDef {
  id: string;
  title: string;
  description: string;
  metricKey:
    | 'total_building_upgrades'
    | 'hq10_players'
    | 'alliance_center_levels'
    | 'total_research_levels'
    | 'total_army_units'
    | 'maritime_energy_stock';
  unitLabel: string;
  targetValue: number;
  minHqRequired: number;
  requiresAllianceCenter: boolean;
  rewards: {
    wheat: number;
    wood: number;
    iron: number;
    achievementPoints: number;
    speedUp?: { tier: string; count: number };
  };
}

export const COOP_QUESTS_CATALOG: ApiCoopQuestDef[] = [
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

