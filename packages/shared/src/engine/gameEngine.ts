import {
  ALLIANCE_CENTER_UPGRADE_TABLE,
  BARRACKS_UPGRADE_TABLE,
  BUILDINGS_META,
  CITY_PLOTS,
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_GAME_SERVERS,
  DEFAULT_PAYMENT_METHODS,
  FORTIFICATION_DEFENSE_POINTS,
  FORTIFICATION_UPGRADE_TABLE,
  HOSPITAL_UPGRADE_TABLE,
  HQ_UPGRADE_TABLE,
  INITIAL_RESOURCES,
  KSA_OFFSET_MS,
  MARITIME_VESSELS_META,
  MARKET_RESOURCES_META,
  OFFSHORE_RIG_UPGRADE_TABLE,
  PRODUCTION_RATES_PER_HOUR,
  PRODUCTION_UPGRADE_TABLE,
  PROTECTION_DURATION_MS,
  QUESTS_CATALOG,
  RESEARCH_CENTER_UPGRADE_TABLE,
  RESEARCH_TREE,
  SEAPORT_UPGRADE_TABLE,
  SHIELD_PACKAGES,
  SMART_BOT_PLANS,
  SPEEDUP_CARDS_META,
  TICKET_STATUS_LABELS,
  UNITS_META,
  WAREHOUSE_CAPACITIES,
  WAREHOUSE_UPGRADE_TABLE,
  createInitialMarketOffers,
  generateInitialWorldMap,
  isLegacyPlateauMonthlyRewards,
} from '../data/gameData';
import {
  AdminBackupSnapshot,
  AdminConfig,
  AdminRole,
  BotConfig,
  BuildQueueItem,
  BuildingType,
  FinancialCategory,
  FinancialLogEntry,
  GameState,
  MaritimeState,
  MarketOffer,
  MarketResourceId,
  OrderProductType,
  PaymentMethodConfig,
  PaymentMethodId,
  PaymentOrder,
  PlacedBuilding,
  PlayerRegistration,
  ResourceBundle,
  SpecializationId,
  SpeedUpTierId,
  SupportTicket,
  TicketAttachment,
  TicketStatus,
  UnitType,
} from '../types/game';

const STORAGE_KEY = 'empire_gdd_v2_save_state';
const ADMIN_BACKUP_STORAGE_KEY = 'enginora_founder_backups_v1';
const DAY_MS = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Official Game Clock: Global Time (UTC) · Game Day Resets at 21:00 UTC     */
/* -------------------------------------------------------------------------- */

function ksaShiftedDate(ts: number): Date {
  // Game day rolls over at 21:00 UTC (equivalent to 00:00 UTC+3)
  return new Date(ts + KSA_OFFSET_MS);
}

export function getKsaDayKey(ts: number): string {
  const d = ksaShiftedDate(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function getKsaWeekKey(ts: number): string {
  const d = ksaShiftedDate(ts);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

export function getKsaMonthKey(ts: number): string {
  const d = ksaShiftedDate(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getSecondsUntilKsaMidnight(ts: number): number {
  const d = ksaShiftedDate(ts);
  const nextMidnightShifted = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
  return Math.max(0, Math.floor((nextMidnightShifted - (ts + KSA_OFFSET_MS)) / 1000));
}

export function getSecondsUntilKsaMonday(ts: number): number {
  const d = ksaShiftedDate(ts);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const daysAhead = day === 0 ? 1 : 8 - day;
  const nextMondayShifted = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysAhead, 0, 0, 0);
  return Math.max(0, Math.floor((nextMondayShifted - (ts + KSA_OFFSET_MS)) / 1000));
}

export function formatUtcDateTime(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min} (UTC)`;
}

export function formatUtcTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const sec = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${min}:${sec}`;
}

export const formatKsaDateTime = formatUtcDateTime;
export const formatKsaTime = formatUtcTime;
export const getSecondsUntilDailyReset = getSecondsUntilKsaMidnight;

export function getUtcDayKey(ts: number): string {
  return getKsaDayKey(ts);
}

export function getUtcWeekKey(ts: number): string {
  return getKsaWeekKey(ts);
}

/* -------------------------------------------------------------------------- */
/*  Defaults, Initial State & Migration                                       */
/* -------------------------------------------------------------------------- */

export const DEFAULT_BOT_CONFIG: BotConfig = {
  planId: 'balanced_economy',
  autoDevelopCity: false,
  autoRaidResourceFields: false,
  minGarrisonReservePct: 50,
};

export const DEFAULT_MARITIME_STATE: MaritimeState = {
  cargoShips: 0,
  surveyVessels: 0,
  discoveredOilWells: 0,
  discoveredGasFields: 0,
  crudeOilStock: 0,
  naturalGasStock: 0,
  activeExpeditions: [],
};

export const DEFAULT_SPEEDUP_CARDS: Record<SpeedUpTierId, number> = {
  '1m': 2,
  '5m': 2,
  '30m': 0,
  '1h': 0,
  '24h': 0,
  '3d': 0,
  '7d': 0,
};

export const DEFAULT_UNITS: Record<UnitType, number> = {
  infantry: 0,
  tank: 0,
  aircraft: 0,
  scout: 0,
};

export const DEFAULT_REGISTRATION: PlayerRegistration = {
  status: 'unregistered',
  nickname: '',
  fullName: '',
  nationalId: '',
  email: '',
  phone: '',
  feeAmountSar: 200,
  acceptedPolicies: false,
};

export function cloneAdminConfig(cfg: AdminConfig): AdminConfig {
  const defaultPm = DEFAULT_PAYMENT_METHODS;
  const pm = cfg.paymentMethods ?? defaultPm;
  return {
    ...cfg,
    gemPackages: cfg.gemPackages.map((p) => ({ ...p })),
    speedUpGemCosts: { ...cfg.speedUpGemCosts },
    shieldPricesGems: { ...cfg.shieldPricesGems },
    servers: Array.isArray(cfg.servers) && cfg.servers.length > 0
      ? cfg.servers.map((s) => ({ ...s }))
      : DEFAULT_GAME_SERVERS.map((s) => ({ ...s })),
    paymentMethods: {
      apple_pay: { ...defaultPm.apple_pay, ...(pm.apple_pay ?? {}) },
      mada: { ...defaultPm.mada, ...(pm.mada ?? {}) },
      bank_transfer: { ...defaultPm.bank_transfer, ...(pm.bank_transfer ?? {}) },
      binance: { ...defaultPm.binance, ...(pm.binance ?? {}) },
    },
    resourcePriceBounds: {
      wheat: { ...cfg.resourcePriceBounds.wheat },
      wood: { ...cfg.resourcePriceBounds.wood },
      iron: { ...cfg.resourcePriceBounds.iron },
      crude_oil: { ...cfg.resourcePriceBounds.crude_oil },
      natural_gas: { ...cfg.resourcePriceBounds.natural_gas },
    },
    monthlyRewards: cfg.monthlyRewards.map((d) => ({ ...d })),
  };
}

export function createInitialState(commanderName = 'القائد سيف'): GameState {
  const now = Date.now();
  const stockSnapshot =
    INITIAL_RESOURCES.wheat + INITIAL_RESOURCES.wood + INITIAL_RESOURCES.iron;

  return {
    version: 3,
    accountId: 'ENG-10482',
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
    resources: { ...INITIAL_RESOURCES },
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
    botConfig: { ...DEFAULT_BOT_CONFIG },
    maritime: { ...DEFAULT_MARITIME_STATE, activeExpeditions: [] },
    buildings: [
      {
        id: 'b-hq',
        plotId: 'p-hq',
        type: 'hq',
        level: 1,
        targetLevel: 1,
        status: 'COMPLETED',
      },
      {
        id: 'b-wh',
        plotId: 'p-wh',
        type: 'warehouse',
        level: 1,
        targetLevel: 1,
        status: 'COMPLETED',
      },
      {
        id: 'b-wall',
        plotId: 'p-wall',
        type: 'fortifications',
        level: 0,
        targetLevel: 0,
        status: 'EMPTY',
      },
    ],
    buildQueue: [],
    researchLevels: {},
    researchQueue: [],
    units: { ...DEFAULT_UNITS },
    trainingQueue: [],
    marches: [],
    speedUpCards: { ...DEFAULT_SPEEDUP_CARDS },
    questClaims: {},
    coopQuestClaims: {},
    dailyResetKey: getKsaDayKey(now),
    weeklyResetKey: getKsaWeekKey(now),
    reports: [
      {
        id: 'rep-welcome',
        category: 'bot',
        title: 'توجيه المساعد المجاني: تأسيس مدينتك في ENGINORA CITY',
        summary:
          'بدأت مدينتك عند المبنى الرئيسي مستوى 1 بمخزن مركزي مستوى 1 وحماية مبتدئ لمدة 14 يومًا.',
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
      monthlyStockSnapshot: stockSnapshot,
      usedQuotaUnits: 0,
      marketFrozenForPlayer: false,
      marketBanUntil: null,
      playerInternalDebtGems: 0,
    },
    paymentOrders: [],
    financialLogs: [],
    adminAuditLogs: [],
    supportTickets: [
      {
        id: 'TKT-1001',
        accountId: 'ENG-10482',
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
    adminConfig: cloneAdminConfig(DEFAULT_ADMIN_CONFIG),
    selectedServerId: DEFAULT_GAME_SERVERS[0].id,
    registration: { ...DEFAULT_REGISTRATION },
    soundEnabled: true,
  };
}

export function hydrateLoadedState(
  parsed: Partial<GameState> & { speedUpCards?: Record<string, number> },
  now: number = Date.now()
): GameState {
  if (
    !parsed ||
    (parsed.version !== 2 && parsed.version !== 3) ||
    !Array.isArray(parsed.buildings)
  ) {
    return createInitialState();
  }

  const base = createInitialState(parsed.commanderName ?? 'القائد سيف');
    const hydratedGemLedger = parsed.gemLedger
      ? {
          chargedGems: parsed.gemLedger.chargedGems ?? 0,
          bonusGems: parsed.gemLedger.bonusGems ?? 0,
          marketGems: parsed.gemLedger.marketGems ?? 0,
        }
      : {
          chargedGems: parsed.ledger?.paidGems ?? 0,
          bonusGems: 0,
          marketGems: 0,
        };
    const migratedCards: Record<SpeedUpTierId, number> = {
      ...DEFAULT_SPEEDUP_CARDS,
      ...(parsed.speedUpCards ?? {}),
    };

    const defaultBounds = cloneAdminConfig(DEFAULT_ADMIN_CONFIG).resourcePriceBounds;
    const savedCfg = parsed.adminConfig;
    const hasPer1kSchema = Boolean(
      savedCfg?.resourcePriceBounds?.wheat &&
        typeof (savedCfg.resourcePriceBounds.wheat as { referencePrice?: number }).referencePrice === 'number'
    );
    const hydratedBounds = hasPer1kSchema && savedCfg?.resourcePriceBounds
      ? {
          wheat: { ...defaultBounds.wheat, ...savedCfg.resourcePriceBounds.wheat },
          wood: { ...defaultBounds.wood, ...savedCfg.resourcePriceBounds.wood },
          iron: { ...defaultBounds.iron, ...savedCfg.resourcePriceBounds.iron },
          crude_oil: { ...defaultBounds.crude_oil, ...savedCfg.resourcePriceBounds.crude_oil },
          natural_gas: { ...defaultBounds.natural_gas, ...savedCfg.resourcePriceBounds.natural_gas },
        }
      : defaultBounds;

    const rawOffers: MarketOffer[] = Array.isArray(parsed.market?.offers)
      ? parsed.market.offers
      : base.market.offers;
    const migratedOffers: MarketOffer[] = hasPer1kSchema
      ? rawOffers
      : rawOffers.map((o: MarketOffer) => {
          const b = hydratedBounds[o.resource];
          return o.unitPriceGems < b.min
            ? { ...o, unitPriceGems: b.referencePrice }
            : o;
        });

    const hydratedHakim = {
      ...base.hakimSubscription,
      ...(parsed.hakimSubscription ?? {}),
    };
    const hasActivePaidHakim =
      Boolean(hydratedHakim.active) &&
      typeof hydratedHakim.expiresAt === 'number' &&
      hydratedHakim.expiresAt > now;

    const hydrated: GameState = {
      ...base,
      ...parsed,
      version: 3,
      gemLedger: hydratedGemLedger,
      ledger: {
        paidGems:
          hydratedGemLedger.chargedGems +
          hydratedGemLedger.bonusGems +
          hydratedGemLedger.marketGems,
        tradeBalance: parsed.ledger?.tradeBalance ?? 0,
        achievementPoints: parsed.ledger?.achievementPoints ?? 0,
      },
      combatBuffs: {
        ...base.combatBuffs,
        ...(parsed.combatBuffs ?? {}),
      },
      hakimSubscription: {
        ...hydratedHakim,
        active: hasActivePaidHakim,
        expiresAt: hasActivePaidHakim ? hydratedHakim.expiresAt : null,
      },
      smartBotActive: hasActivePaidHakim ? Boolean(parsed.smartBotActive) : false,
      smartBotExpiresAt: hasActivePaidHakim ? hydratedHakim.expiresAt : null,
      vipSubscription: {
        ...base.vipSubscription,
        ...(parsed.vipSubscription ?? {}),
      },
      monthlyRewards: {
        ...base.monthlyRewards,
        ...(parsed.monthlyRewards ?? {}),
      },
      units: {
        ...DEFAULT_UNITS,
        ...(parsed.units ?? {}),
      },
      speedUpCards: migratedCards,
      coopQuestClaims: { ...(parsed.coopQuestClaims ?? {}) },
      botConfig: {
        ...DEFAULT_BOT_CONFIG,
        ...(parsed.botConfig ?? {}),
      },
      maritime: {
        ...DEFAULT_MARITIME_STATE,
        ...(parsed.maritime ?? {}),
        activeExpeditions: Array.isArray(parsed.maritime?.activeExpeditions)
          ? parsed.maritime.activeExpeditions
          : [],
      },
      market: {
        ...base.market,
        ...(parsed.market ?? {}),
        offers: migratedOffers,
        pendingBuys: Array.isArray(parsed.market?.pendingBuys)
          ? parsed.market.pendingBuys.map((p) => ({
              ...p,
              tradePointsEarned: p.tradePointsEarned ?? 0,
            }))
          : [],
        tradeLedger: Array.isArray(parsed.market?.tradeLedger)
          ? parsed.market.tradeLedger
          : [],
        purchasedBatches: Array.isArray(parsed.market?.purchasedBatches)
          ? parsed.market.purchasedBatches
          : [],
      },
      paymentOrders: Array.isArray(parsed.paymentOrders)
        ? parsed.paymentOrders
        : [],
      financialLogs: Array.isArray(parsed.financialLogs)
        ? parsed.financialLogs
        : [],
      adminAuditLogs: Array.isArray(parsed.adminAuditLogs)
        ? parsed.adminAuditLogs
        : [],
      supportTickets: Array.isArray(parsed.supportTickets)
        ? parsed.supportTickets
        : base.supportTickets,
      telegram: {
        ...base.telegram,
        ...(parsed.telegram ?? {}),
        alerts: {
          ...base.telegram.alerts,
          ...(parsed.telegram?.alerts ?? {}),
        },
      },
      allianceMeta: {
        ...base.allianceMeta,
        ...(parsed.allianceMeta ?? {}),
      },
      adminConfig: savedCfg
        ? {
            ...cloneAdminConfig(DEFAULT_ADMIN_CONFIG),
            ...savedCfg,
            tradePointsPer100NetGems: savedCfg.tradePointsPer100NetGems ?? 80,
            registrationFeeSar: savedCfg.registrationFeeSar ?? 200,
            servers:
              Array.isArray(savedCfg.servers) && savedCfg.servers.length > 0
                ? savedCfg.servers.map((s) => ({ ...s }))
                : DEFAULT_GAME_SERVERS.map((s) => ({ ...s })),
            paymentMethods: {
              apple_pay: {
                ...DEFAULT_PAYMENT_METHODS.apple_pay,
                ...(savedCfg.paymentMethods?.apple_pay ?? {}),
              },
              mada: {
                ...DEFAULT_PAYMENT_METHODS.mada,
                ...(savedCfg.paymentMethods?.mada ?? {}),
              },
              bank_transfer: {
                ...DEFAULT_PAYMENT_METHODS.bank_transfer,
                ...(savedCfg.paymentMethods?.bank_transfer ?? {}),
              },
              binance: {
                ...DEFAULT_PAYMENT_METHODS.binance,
                ...(savedCfg.paymentMethods?.binance ?? {}),
              },
            },
            resourcePriceBounds: hydratedBounds,
            monthlyRewards: isLegacyPlateauMonthlyRewards(savedCfg.monthlyRewards)
              ? cloneAdminConfig(DEFAULT_ADMIN_CONFIG).monthlyRewards
              : savedCfg.monthlyRewards,
          }
        : cloneAdminConfig(DEFAULT_ADMIN_CONFIG),
      selectedServerId:
        parsed.selectedServerId ??
        savedCfg?.servers?.[0]?.id ??
        DEFAULT_GAME_SERVERS[0].id,
      registration: parsed.registration
        ? {
            ...DEFAULT_REGISTRATION,
            ...parsed.registration,
          }
        : { ...DEFAULT_REGISTRATION },
    };

  return advanceGameState(hydrated, now).state;
}

export function readLegacyLocalState(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameState> & {
      speedUpCards?: Record<string, number>;
    };
    if (
      !parsed ||
      (parsed.version !== 2 && parsed.version !== 3) ||
      !Array.isArray(parsed.buildings)
    ) {
      return null;
    }
    return hydrateLoadedState(parsed, Date.now());
  } catch {
    return null;
  }
}

export function loadSavedState(): GameState {
  if (typeof window === 'undefined') return createInitialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<GameState> & {
      speedUpCards?: Record<string, number>;
    };
    return hydrateLoadedState(parsed, Date.now());
  } catch {
    return createInitialState();
  }
}

export function saveGameState(state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota failures
  }
}

export function clearSavedState(): GameState {
  const fresh = createInitialState();
  saveGameState(fresh);
  return fresh;
}

/* -------------------------------------------------------------------------- */
/*  Core City / Warehouse / Gems / Power Helpers                              */
/* -------------------------------------------------------------------------- */

export function getMainBuildingLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'hq')?.level ?? 1;
}

export function getHqLevel(state: GameState): number {
  return getMainBuildingLevel(state);
}

export function getWarehouseLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'warehouse')?.level ?? 1;
}

export function getFortificationLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'fortifications')?.level ?? 0;
}

export function getResearchCenterLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'research_center')?.level ?? 0;
}

export function getBarracksLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'barracks')?.level ?? 0;
}

export function getHospitalLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'hospital')?.level ?? 0;
}

export function getAllianceCenterLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'alliance_center')?.level ?? 0;
}

export function getSeaportLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'seaport')?.level ?? 0;
}

export function getOffshoreRigLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'offshore_rig')?.level ?? 0;
}

export function getMaxBuildSlots(state: GameState): number {
  return state.smartBotActive ? 4 : 2;
}

export function getMaxResearchSlots(state: GameState): number {
  return state.smartBotActive ? 2 : 1;
}

export function getWarehouseCapacity(state: GameState): number {
  const lv = getWarehouseLevel(state);
  return WAREHOUSE_CAPACITIES[lv] ?? 6000;
}

export function getProtectedWarehouseCapacity(state: GameState): number {
  return getWarehouseCapacity(state);
}

export function getTotalStoredResources(res: ResourceBundle): number {
  return Math.floor(res.wheat) + Math.floor(res.wood) + Math.floor(res.iron);
}

export function getExposedExcessResources(state: GameState): {
  excessTotal: number;
  maxLootablePerAttack: number;
} {
  const cap = getProtectedWarehouseCapacity(state);
  const stored = getTotalStoredResources(state.resources);
  const excessTotal = Math.max(0, stored - cap);
  return {
    excessTotal,
    maxLootablePerAttack: Math.floor(excessTotal * 0.5),
  };
}

export function getTotalGems(state: GameState): number {
  return (
    Math.floor(state.gemLedger.chargedGems) +
    Math.floor(state.gemLedger.bonusGems) +
    Math.floor(state.gemLedger.marketGems)
  );
}

export function creditGems(
  state: GameState,
  bucket: 'chargedGems' | 'bonusGems' | 'marketGems',
  amount: number
): GameState {
  const safeAmt = Math.max(0, Number(amount));
  const nextLedger = {
    ...state.gemLedger,
    [bucket]: Number((state.gemLedger[bucket] + safeAmt).toFixed(2)),
  };
  const total =
    Math.floor(nextLedger.chargedGems) +
    Math.floor(nextLedger.bonusGems) +
    Math.floor(nextLedger.marketGems);
  return {
    ...state,
    gemLedger: nextLedger,
    ledger: {
      ...state.ledger,
      paidGems: total,
    },
  };
}

export function spendGems(
  state: GameState,
  amount: number
): { state: GameState; ok: boolean } {
  const needed = Math.max(0, Number(amount));
  if (getTotalGems(state) + 1e-6 < needed) {
    return { state, ok: false };
  }

  let rem = needed;
  let charged = state.gemLedger.chargedGems;
  let bonus = state.gemLedger.bonusGems;
  let market = state.gemLedger.marketGems;

  const takeCharged = Math.min(charged, rem);
  charged -= takeCharged;
  rem -= takeCharged;

  if (rem > 0) {
    const takeBonus = Math.min(bonus, rem);
    bonus -= takeBonus;
    rem -= takeBonus;
  }

  if (rem > 0) {
    const takeMarket = Math.min(market, rem);
    market -= takeMarket;
    rem -= takeMarket;
  }

  const nextLedger = {
    chargedGems: Number(Math.max(0, charged).toFixed(2)),
    bonusGems: Number(Math.max(0, bonus).toFixed(2)),
    marketGems: Number(Math.max(0, market).toFixed(2)),
  };
  const total =
    Math.floor(nextLedger.chargedGems) +
    Math.floor(nextLedger.bonusGems) +
    Math.floor(nextLedger.marketGems);

  return {
    ok: true,
    state: {
      ...state,
      gemLedger: nextLedger,
      ledger: {
        ...state.ledger,
        paidGems: total,
      },
    },
  };
}

export function appendFinancialLog(
  state: GameState,
  entry: Omit<FinancialLogEntry, 'id'>
): GameState {
  const newEntry: FinancialLogEntry = {
    ...entry,
    id: `FIN-${entry.createdAt}-${Math.floor(Math.random() * 10000)}`,
  };
  return {
    ...state,
    financialLogs: [newEntry, ...state.financialLogs].slice(0, 200),
  };
}

export function appendAuditLog(
  state: GameState,
  actorRole: AdminRole,
  action: string,
  details: string,
  now: number
): GameState {
  const actorName =
    actorRole === 'founder'
      ? 'المؤسس (Founder)'
      : actorRole === 'partner'
        ? 'الشريك (Partner)'
        : 'الدعم الفني (Support)';
  return {
    ...state,
    adminAuditLogs: [
      {
        id: `AUD-${now}-${Math.floor(Math.random() * 10000)}`,
        actorRole,
        actorName,
        action,
        details,
        createdAt: now,
      },
      ...state.adminAuditLogs,
    ].slice(0, 120),
  };
}

export function getHighestLevelOfType(
  buildings: PlacedBuilding[],
  type: BuildingType
): number {
  return buildings
    .filter((b) => b.type === type)
    .reduce((max, b) => Math.max(max, b.level), 0);
}

export function getProductionRates(state: GameState): ResourceBundle {
  const logisticsBonus = 1 + (state.researchLevels['logistics_opt'] ?? 0) * 0.04;
  const energyBonus =
    state.specialization === 'energy'
      ? 1 + (state.researchLevels['eng_smart_grid'] ?? 0) * 0.05
      : 1;
  const agriBonus =
    state.specialization === 'agriculture'
      ? 1 + (state.researchLevels['agri_hydroponics'] ?? 0) * 0.06
      : 1;
  const indBonus =
    state.specialization === 'industry'
      ? 1 + (state.researchLevels['ind_automation'] ?? 0) * 0.06
      : 1;
  const minBonus =
    state.specialization === 'mining'
      ? 1 + (state.researchLevels['min_deep_shaft'] ?? 0) * 0.06
      : 1;

  let wheat = 0;
  let wood = 0;
  let iron = 0;

  for (const b of state.buildings) {
    if (b.level <= 0) continue;
    const base = PRODUCTION_RATES_PER_HOUR[b.level] ?? 0;
    if (b.type === 'farm') wheat += base * logisticsBonus * energyBonus * agriBonus;
    if (b.type === 'sawmill') wood += base * logisticsBonus * energyBonus * indBonus;
    if (b.type === 'iron_mine') iron += base * logisticsBonus * energyBonus * minBonus;
  }

  return {
    wheat: Math.round(wheat),
    wood: Math.round(wood),
    iron: Math.round(iron),
  };
}

export function isShieldActive(state: GameState, now: number): boolean {
  return state.protectionEndsAt > now || (state.shieldEndsAt ?? 0) > now;
}

export function getActiveShieldEndsAt(state: GameState, now: number): number | null {
  const ends = Math.max(state.protectionEndsAt || 0, state.shieldEndsAt || 0);
  return ends > now ? ends : null;
}

export function isAttackBoostActive(state: GameState, now: number): boolean {
  return Boolean(state.combatBuffs.attackBoostEndsAt && state.combatBuffs.attackBoostEndsAt > now);
}

export function isDefenseBoostActive(state: GameState, now: number): boolean {
  return Boolean(state.combatBuffs.defenseBoostEndsAt && state.combatBuffs.defenseBoostEndsAt > now);
}

export function getReconRevealPct(state: GameState): number {
  const techLv = state.researchLevels['mil_recon_doctrine'] ?? 0;
  return Math.min(70, 20 + techLv * 10);
}

export function getCityDefensePower(state: GameState, now = Date.now()): number {
  const unitDef =
    (state.units.infantry ?? 0) * UNITS_META.infantry.defense +
    (state.units.tank ?? 0) * UNITS_META.tank.defense +
    (state.units.aircraft ?? 0) * UNITS_META.aircraft.defense +
    (state.units.scout ?? 0) * UNITS_META.scout.defense;
  const fortLv = getFortificationLevel(state);
  const fortDef = FORTIFICATION_DEFENSE_POINTS[fortLv] ?? 0;
  const base = unitDef + fortDef;
  return isDefenseBoostActive(state, now) ? Math.round(base * 1.1) : base;
}

export function getCityAttackPower(state: GameState, now = Date.now()): number {
  const base =
    (state.units.infantry ?? 0) * UNITS_META.infantry.attack +
    (state.units.tank ?? 0) * UNITS_META.tank.attack +
    (state.units.aircraft ?? 0) * UNITS_META.aircraft.attack +
    (state.units.scout ?? 0) * UNITS_META.scout.attack;
  return isAttackBoostActive(state, now) ? Math.round(base * 1.1) : base;
}

export function getCityPoints(state: GameState): number {
  const bPts = state.buildings.reduce((sum, b) => sum + b.level * 35, 0);
  const rPts = Object.values(state.researchLevels).reduce((s, lv) => s + lv * 25, 0);
  const uPts =
    (state.units.infantry ?? 0) * 3 +
    (state.units.tank ?? 0) * 8 +
    (state.units.aircraft ?? 0) * 12 +
    (state.units.scout ?? 0) * 2;
  return 85 + bPts + rPts + uPts;
}

export function checkHqRequirements(
  state: GameState,
  targetMainLevel: number
): { met: boolean; unmetReasons: string[] } {
  const spec = HQ_UPGRADE_TABLE.find((h) => h.level === targetMainLevel);
  if (!spec) {
    return {
      met: false,
      unmetReasons: ['وصلت إلى الحد الأقصى للمرحلة الحالية (المبنى الرئيسي مستوى 10)'],
    };
  }

  const req = spec.requirements;
  const reasons: string[] = [];

  const farmMax = getHighestLevelOfType(state.buildings, 'farm');
  const sawMax = getHighestLevelOfType(state.buildings, 'sawmill');
  const mineMax = getHighestLevelOfType(state.buildings, 'iron_mine');
  const whLv = getWarehouseLevel(state);
  const rcLv = getResearchCenterLevel(state);
  const barLv = getBarracksLevel(state);

  if (req.farmMinLevel && farmMax < req.farmMinLevel) {
    reasons.push(`مزرعة ذكية مستوى ${req.farmMinLevel} (الحالي: ${farmMax})`);
  }
  if (req.sawmillMinLevel && sawMax < req.sawmillMinLevel) {
    reasons.push(`منشرة حديثة مستوى ${req.sawmillMinLevel} (الحالي: ${sawMax})`);
  }
  if (req.ironMineMinLevel && mineMax < req.ironMineMinLevel) {
    reasons.push(`منجم حديد مستوى ${req.ironMineMinLevel} (الحالي: ${mineMax})`);
  }
  if (req.anyTwoProductionAtLevel) {
    const countAtLevel = [farmMax, sawMax, mineMax].filter(
      (lv) => lv >= (req.anyTwoProductionAtLevel ?? 0)
    ).length;
    if (countAtLevel < 2) {
      reasons.push(
        `منشأتا إنتاج مختلفتان بمستوى ${req.anyTwoProductionAtLevel} (المتوفر: ${countAtLevel}/2)`
      );
    }
  }
  if (req.warehouseMinLevel && whLv < req.warehouseMinLevel) {
    reasons.push(`المخزن المركزي مستوى ${req.warehouseMinLevel} (الحالي: ${whLv})`);
  }
  if (req.researchCenterMinLevel && rcLv < req.researchCenterMinLevel) {
    reasons.push(`مركز الأبحاث مستوى ${req.researchCenterMinLevel} (الحالي: ${rcLv})`);
  }
  if (req.barracksMinLevel && barLv < req.barracksMinLevel) {
    reasons.push(`الثكنة العسكرية مستوى ${req.barracksMinLevel} (الحالي: ${barLv})`);
  }

  return { met: reasons.length === 0, unmetReasons: reasons };
}

export function getNextBuildingUpgradeSpec(
  state: GameState,
  type: BuildingType,
  currentLevel: number
): {
  nextLevel: number;
  cost: ResourceBundle;
  durationSec: number;
  canUpgrade: boolean;
  lockReasons: string[];
} {
  const meta = BUILDINGS_META[type];
  const nextLevel = currentLevel + 1;
  const mainLv = getMainBuildingLevel(state);

  if (nextLevel > meta.maxLevel) {
    return {
      nextLevel,
      cost: { wheat: 0, wood: 0, iron: 0 },
      durationSec: 0,
      canUpgrade: false,
      lockReasons: ['تم الوصول إلى الحد الأقصى لهذا المبنى في هذه المرحلة'],
    };
  }

  if (type === 'hq') {
    const row = HQ_UPGRADE_TABLE.find((r) => r.level === nextLevel);
    if (!row) {
      return {
        nextLevel,
        cost: { wheat: 0, wood: 0, iron: 0 },
        durationSec: 0,
        canUpgrade: false,
        lockReasons: ['غير متاح'],
      };
    }
    const reqCheck = checkHqRequirements(state, nextLevel);
    return {
      nextLevel,
      cost: row.cost,
      durationSec: row.durationSec,
      canUpgrade: reqCheck.met,
      lockReasons: reqCheck.unmetReasons,
    };
  }

  if (type === 'warehouse') {
    const row = WAREHOUSE_UPGRADE_TABLE.find((r) => r.level === nextLevel)!;
    return {
      nextLevel,
      cost: row.cost,
      durationSec: row.durationSec,
      canUpgrade: true,
      lockReasons: [],
    };
  }

  if (type === 'farm' || type === 'sawmill' || type === 'iron_mine') {
    const row = PRODUCTION_UPGRADE_TABLE.find((r) => r.level === nextLevel)!;
    return {
      nextLevel,
      cost: row.cost,
      durationSec: row.durationSec,
      canUpgrade: true,
      lockReasons: [],
    };
  }

  const tables: Record<
    string,
    readonly { level: number; cost: ResourceBundle; durationSec: number; requiredHq: number }[]
  > = {
    fortifications: FORTIFICATION_UPGRADE_TABLE,
    research_center: RESEARCH_CENTER_UPGRADE_TABLE,
    hospital: HOSPITAL_UPGRADE_TABLE,
    alliance_center: ALLIANCE_CENTER_UPGRADE_TABLE,
    seaport: SEAPORT_UPGRADE_TABLE,
    offshore_rig: OFFSHORE_RIG_UPGRADE_TABLE,
    barracks: BARRACKS_UPGRADE_TABLE,
  };

  const row = tables[type]?.find((r) => r.level === nextLevel);
  if (!row) {
    return {
      nextLevel,
      cost: { wheat: 0, wood: 0, iron: 0 },
      durationSec: 0,
      canUpgrade: false,
      lockReasons: ['غير متاح'],
    };
  }

  const reasons: string[] = [];
  if (mainLv < row.requiredHq) {
    reasons.push(`يتطلب المبنى الرئيسي مستوى ${row.requiredHq}`);
  }
  return {
    nextLevel,
    cost: row.cost,
    durationSec: row.durationSec,
    canUpgrade: reasons.length === 0,
    lockReasons: reasons,
  };
}

export function canAfford(res: ResourceBundle, cost: ResourceBundle): boolean {
  return res.wheat >= cost.wheat && res.wood >= cost.wood && res.iron >= cost.iron;
}

export function deductResources(res: ResourceBundle, cost: ResourceBundle): ResourceBundle {
  return {
    wheat: Math.max(0, res.wheat - cost.wheat),
    wood: Math.max(0, res.wood - cost.wood),
    iron: Math.max(0, res.iron - cost.iron),
  };
}

/**
 * GDD v3.1 (§35-§37): Production & incoming resources do NOT stop at warehouse capacity.
 * Warehouse capacity defines ONLY the protected amount safe from looting.
 */
export function addResources(res: ResourceBundle, add: ResourceBundle): ResourceBundle {
  return {
    wheat: res.wheat + Math.max(0, add.wheat),
    wood: res.wood + Math.max(0, add.wood),
    iron: res.iron + Math.max(0, add.iron),
  };
}

export function addResourcesWithCap(
  res: ResourceBundle,
  add: ResourceBundle,
  _warehouseCap?: number
): ResourceBundle {
  return addResources(res, add);
}

/* -------------------------------------------------------------------------- */
/*  World Tick Simulation                                                     */
/* -------------------------------------------------------------------------- */

function getTotalCityResourcePool(state: GameState): number {
  return Math.floor(
    state.resources.wheat +
      state.resources.wood +
      state.resources.iron +
      state.maritime.crudeOilStock +
      state.maritime.naturalGasStock
  );
}

export function advanceGameState(
  prevState: GameState,
  now: number
): { state: GameState; completedEvents: string[] } {
  const completedEvents: string[] = [];
  let state: GameState = {
    ...prevState,
    resources: { ...prevState.resources },
    gemLedger: { ...prevState.gemLedger },
    ledger: { ...prevState.ledger },
    combatBuffs: { ...prevState.combatBuffs },
    hakimSubscription: { ...prevState.hakimSubscription },
    vipSubscription: { ...prevState.vipSubscription },
    monthlyRewards: {
      ...prevState.monthlyRewards,
      claimedDays: [...prevState.monthlyRewards.claimedDays],
      vipClaimsByDay: [...prevState.monthlyRewards.vipClaimsByDay],
    },
    botConfig: {
      ...DEFAULT_BOT_CONFIG,
      ...(prevState.botConfig ?? {}),
    },
    maritime: {
      ...DEFAULT_MARITIME_STATE,
      ...(prevState.maritime ?? {}),
      activeExpeditions: Array.isArray(prevState.maritime?.activeExpeditions)
        ? prevState.maritime.activeExpeditions.map((e) => ({ ...e }))
        : [],
    },
    buildings: prevState.buildings.map((b) => ({ ...b })),
    buildQueue: prevState.buildQueue.map((q) => ({ ...q })),
    researchLevels: { ...prevState.researchLevels },
    researchQueue: prevState.researchQueue.map((r) => ({ ...r })),
    units: { ...DEFAULT_UNITS, ...(prevState.units ?? {}) },
    trainingQueue: prevState.trainingQueue.map((t) => ({ ...t })),
    marches: prevState.marches.map((m) => ({ ...m, units: { ...DEFAULT_UNITS, ...m.units } })),
    reports: [...prevState.reports],
    questClaims: { ...prevState.questClaims },
    worldMap: prevState.worldMap.map((t) => ({ ...t })),
    market: {
      ...prevState.market,
      offers: prevState.market.offers.map((o) => ({ ...o })),
      pendingBuys: prevState.market.pendingBuys.map((p) => ({ ...p })),
      tradeLedger: [...prevState.market.tradeLedger],
      purchasedBatches: prevState.market.purchasedBatches.filter(
        (b) => b.unlocksAt > now
      ),
    },
  };

  // Clear expired buffs & shields cleanly
  if (state.shieldEndsAt && now >= state.shieldEndsAt) {
    state.shieldEndsAt = null;
  }
  if (state.combatBuffs.attackBoostEndsAt && now >= state.combatBuffs.attackBoostEndsAt) {
    state.combatBuffs.attackBoostEndsAt = null;
  }
  if (state.combatBuffs.defenseBoostEndsAt && now >= state.combatBuffs.defenseBoostEndsAt) {
    state.combatBuffs.defenseBoostEndsAt = null;
  }

  // Handle Smart Bot Hakim subscription enforcement & expiration (NO free activation, NO auto-renewal)
  const hasPaidHakim =
    Boolean(state.hakimSubscription?.active) &&
    typeof state.hakimSubscription?.expiresAt === 'number' &&
    state.hakimSubscription.expiresAt > now;
  if (!hasPaidHakim) {
    state.smartBotActive = false;
    state.smartBotExpiresAt = null;
    if (state.hakimSubscription?.active) {
      state.hakimSubscription = {
        ...state.hakimSubscription,
        active: false,
      };
    }
  } else {
    state.smartBotExpiresAt = state.hakimSubscription.expiresAt;
  }
  if (
    state.vipSubscription.active &&
    state.vipSubscription.expiresAt &&
    now >= state.vipSubscription.expiresAt
  ) {
    state.vipSubscription = {
      ...state.vipSubscription,
      active: false,
    };
  }

  // KSA (UTC+3) Daily (12:00 AM KSA), Weekly (Monday 00:00 KSA), Monthly Quotas
  const currentDayKey = getKsaDayKey(now);
  const currentWeekKey = getKsaWeekKey(now);
  const currentMonthKey = getKsaMonthKey(now);

  if (state.dailyResetKey !== currentDayKey) {
    state.dailyResetKey = currentDayKey;
    for (const q of QUESTS_CATALOG) {
      if (q.category === 'daily') {
        delete state.questClaims[q.id];
      }
    }
  }
  if (state.weeklyResetKey !== currentWeekKey) {
    state.weeklyResetKey = currentWeekKey;
    for (const q of QUESTS_CATALOG) {
      if (q.category === 'weekly') {
        delete state.questClaims[q.id];
      }
    }
  }
  if (state.market.quotaMonthKey !== currentMonthKey) {
    state.market.quotaMonthKey = currentMonthKey;
    state.market.usedQuotaUnits = 0;
    state.market.monthlyStockSnapshot = Math.max(1000, getTotalCityResourcePool(state));
  }

  // Auto-finalize matured 5-second pending market buys (§29)
  const maturePending = state.market.pendingBuys.filter((p) => now >= p.confirmAt);
  for (const p of maturePending) {
    const fin = finalizePendingMarketBuy(state, p.id, p.confirmAt);
    state = fin.state;
    if (!fin.error) {
      completedEvents.push(
        `تم تأكيد صفقة السوق (${p.quantity} ${MARKET_RESOURCES_META[p.resource].name})`
      );
    }
  }

  // Auto-expire 7-day market offers (§25)
  for (let i = 0; i < state.market.offers.length; i++) {
    const off = state.market.offers[i];
    if (off.status === 'active' && now >= off.expiresAt) {
      const unsold = off.remainingQty;
      off.remainingQty = 0;
      off.status = 'expired';
      if (off.sellerId === state.accountId && unsold > 0) {
        state = creditResourceStock(state, off.resource, unsold);
        state.market.usedQuotaUnits = Math.max(0, state.market.usedQuotaUnits - unsold);
      }
      state.market.tradeLedger.unshift({
        id: `tr-exp-${off.id}-${now}`,
        action: 'expired',
        resource: off.resource,
        quantity: unsold,
        unitPriceGems: off.unitPriceGems,
        grossGems: 0,
        commissionGems: 0,
        netGems: 0,
        buyerName: '—',
        sellerName: off.sellerName,
        createdAt: off.expiresAt,
        note: 'انتهاء مهلة العرض (7 أيام) وإعادة الكمية غير المباعة',
      });
    }
  }

  // Chronological resource + completion simulation from lastTickAt to now
  let cursor = Math.min(state.lastTickAt, now);

  while (true) {
    const nextBuild = state.buildQueue
      .filter((b) => b.endsAt <= now)
      .sort((a, b) => a.endsAt - b.endsAt)[0];
    const nextResearch = state.researchQueue
      .filter((r) => r.endsAt <= now)
      .sort((a, b) => a.endsAt - b.endsAt)[0];

    let nextEventTime: number | null = null;
    if (nextBuild) nextEventTime = nextBuild.endsAt;
    if (nextResearch && (nextEventTime === null || nextResearch.endsAt < nextEventTime)) {
      nextEventTime = nextResearch.endsAt;
    }

    if (nextEventTime === null) break;

    const dtHours = Math.max(0, (nextEventTime - cursor) / 3600000);
    if (dtHours > 0) {
      const rates = getProductionRates(state);
      state.resources = addResources(state.resources, {
        wheat: rates.wheat * dtHours,
        wood: rates.wood * dtHours,
        iron: rates.iron * dtHours,
      });
      cursor = nextEventTime;
    }

    if (nextBuild && nextBuild.endsAt === nextEventTime) {
      const bIdx = state.buildings.findIndex((b) => b.id === nextBuild.buildingId);
      if (bIdx >= 0) {
        state.buildings[bIdx] = {
          ...state.buildings[bIdx],
          level: nextBuild.toLevel,
          targetLevel: nextBuild.toLevel,
          status: 'COMPLETED',
        };
      }
      state.buildQueue = state.buildQueue.filter((q) => q.id !== nextBuild.id);

      const bName = BUILDINGS_META[nextBuild.buildingType].name;
      completedEvents.push(`اكتمل ${bName} (المستوى ${nextBuild.toLevel})`);
      state.reports.unshift({
        id: `rep-b-${nextBuild.id}-${nextEventTime}`,
        category: 'construction',
        title: `اكتمال ${bName} — المستوى ${nextBuild.toLevel}`,
        summary: `أصبح ${bName} جاهزًا للعمل عند المستوى ${nextBuild.toLevel}.`,
        details: [
          `المستوى السابق: ${nextBuild.fromLevel} · المستوى الجديد: ${nextBuild.toLevel}`,
          'تم تحرير خانة البناء تلقائيًا.',
        ],
        createdAt: nextEventTime,
        read: false,
      });
    } else if (nextResearch && nextResearch.endsAt === nextEventTime) {
      state.researchLevels[nextResearch.techId] = nextResearch.toLevel;
      state.researchQueue = state.researchQueue.filter((r) => r.id !== nextResearch.id);
      const tech = RESEARCH_TREE.find((t) => t.id === nextResearch.techId);
      completedEvents.push(
        `اكتمل بحث ${tech?.name ?? nextResearch.techId} (المستوى ${nextResearch.toLevel})`
      );
      state.reports.unshift({
        id: `rep-r-${nextResearch.id}-${nextEventTime}`,
        category: 'research',
        title: `اكتمال بحث: ${tech?.name ?? nextResearch.techId}`,
        summary: `ارتفع مستوى التقنية إلى ${nextResearch.toLevel}.`,
        details: [tech?.effectLabel ?? 'تم تفعيل تحسين التقنية.'],
        createdAt: nextEventTime,
        read: false,
      });
    }
  }

  // Accrue remaining resources uncapped (§35)
  const remainingHours = Math.max(0, (now - cursor) / 3600000);
  if (remainingHours > 0) {
    const rates = getProductionRates(state);
    state.resources = addResources(state.resources, {
      wheat: rates.wheat * remainingHours,
      wood: rates.wood * remainingHours,
      iron: rates.iron * remainingHours,
    });
  }

  // Process unit training queues
  const remainingTraining: typeof state.trainingQueue = [];
  for (const job of state.trainingQueue) {
    const unitMs = job.perUnitDurationSec * 1000;
    const elapsedSinceStart = Math.max(0, now - job.startedAt);
    const totalCompleted = Math.min(job.count, Math.floor(elapsedSinceStart / unitMs));
    const newlyCompleted = totalCompleted - job.completedCount;
    if (newlyCompleted > 0) {
      state.units[job.unitType] = (state.units[job.unitType] ?? 0) + newlyCompleted;
    }
    if (totalCompleted < job.count) {
      remainingTraining.push({
        ...job,
        completedCount: totalCompleted,
        nextUnitEndsAt: job.startedAt + (totalCompleted + 1) * unitMs,
      });
    } else {
      completedEvents.push(`اكتمل تدريب ${job.count} ${UNITS_META[job.unitType].name}`);
    }
  }
  state.trainingQueue = remainingTraining;

  // Process marches (Recon, Resource Raids, Player Attacks)
  const remainingMarches: typeof state.marches = [];
  for (const march of state.marches) {
    if (march.phase === 'OUTBOUND' && now >= march.arrivalAt) {
      if (march.mission === 'resource_raid') {
        const loot = march.loot ?? { wheat: 110, wood: 95, iron: 80 };
        state.reports.unshift({
          id: `rep-raid-${march.id}`,
          category: 'bot',
          title: `غارة حقل موارد: ${march.targetName}`,
          summary: `نجحت القوة في تأمين إمدادات (${loot.wheat} قمح · ${loot.wood} خشب · ${loot.iron} حديد).`,
          details: [
            `الإحداثيات: (${march.targetCoords.x} | ${march.targetCoords.y})`,
            'الحمولة في طريق العودة الآمنة إلى المدينة.',
          ],
          createdAt: march.arrivalAt,
          read: false,
        });
        completedEvents.push(`نجحت حملة الموارد على ${march.targetName}`);

        if (now >= march.returnAt) {
          state.resources = addResources(state.resources, loot);
          for (const u of Object.keys(DEFAULT_UNITS) as UnitType[]) {
            state.units[u] += march.units[u] ?? 0;
          }
        } else {
          remainingMarches.push({ ...march, phase: 'RETURNING' });
        }
        continue;
      }

      if (march.mission === 'player_attack') {
        const tileIdx = state.worldMap.findIndex((t) => t.id === march.targetTileId);
        const tile = tileIdx >= 0 ? state.worldMap[tileIdx] : null;
        const carryCap =
          (march.units.infantry ?? 0) * UNITS_META.infantry.carry +
          (march.units.tank ?? 0) * UNITS_META.tank.carry +
          (march.units.aircraft ?? 0) * UNITS_META.aircraft.carry;

        const targetStock = tile?.mockLootStock ?? { wheat: 400, wood: 350, iron: 280 };
        // Up to 50% of exposed excess resources per attack (§37)
        const maxPool = Math.floor(
          (targetStock.wheat + targetStock.wood + targetStock.iron) * 0.5
        );
        const takeRatio = maxPool > 0 ? Math.min(1, carryCap / maxPool) : 0;
        const loot: ResourceBundle = {
          wheat: Math.round(targetStock.wheat * 0.5 * takeRatio),
          wood: Math.round(targetStock.wood * 0.5 * takeRatio),
          iron: Math.round(targetStock.iron * 0.5 * takeRatio),
        };

        if (tile && tileIdx >= 0) {
          state.worldMap[tileIdx] = {
            ...tile,
            mockLootStock: {
              wheat: Math.max(0, targetStock.wheat - loot.wheat),
              wood: Math.max(0, targetStock.wood - loot.wood),
              iron: Math.max(0, targetStock.iron - loot.iron),
            },
          };
        }

        state.reports.unshift({
          id: `rep-atk-${march.id}`,
          category: 'military',
          title: `تقرير هجوم عسكري على ${march.targetName}`,
          summary: `اكتملت العملية بنهب ${loot.wheat} قمح · ${loot.wood} خشب · ${loot.iron} حديد (بحد أقصى 50% من الموارد المكشوفة).`,
          details: [
            `القوات المشاركة: ${march.units.infantry} مشاة · ${march.units.tank} دبابات · ${march.units.aircraft} طيران`,
            'ملاحظة: إذا تجاوزت موارد مدينتك السعة المحمية للمخزن فيُعرّض الفائض لنفس قاعدة النهب.',
          ],
          createdAt: march.arrivalAt,
          read: false,
        });
        completedEvents.push(`اكتمل الهجوم على ${march.targetName}`);

        if (now >= march.returnAt) {
          state.resources = addResources(state.resources, loot);
          for (const u of Object.keys(DEFAULT_UNITS) as UnitType[]) {
            state.units[u] += march.units[u] ?? 0;
          }
        } else {
          remainingMarches.push({ ...march, phase: 'RETURNING', loot });
        }
        continue;
      }

      // Recon report with §40 reveal formula: 20% base + 10%/level up to 70%
      const revealPct = getReconRevealPct(state);
      const tileIdx = state.worldMap.findIndex((t) => t.id === march.targetTileId);
      const tile = tileIdx >= 0 ? state.worldMap[tileIdx] : null;
      let reconSummary = `تم استطلاع القطاع بنجاح (نسبة الكشف: ${revealPct}%).`;
      const details: string[] = [
        `الإحداثيات: (${march.targetCoords.x} | ${march.targetCoords.y})`,
        `دقة كشف الاستطلاع الحالية: ${revealPct}% (الأساس 20% + تطوير الاستطلاع حتى 70%)`,
        'لم يتم إلغاء درع الحماية لأن الاستطلاع لا يُعد هجومًا (§17).',
      ];

      if (tile) {
        if (tile.kind === 'npc_city') {
          const isProt = Boolean(tile.protectedUntil && tile.protectedUntil > now);
          const estStock = tile.mockLootStock ?? { wheat: 400, wood: 300, iron: 250 };
          const visibleRatio = revealPct / 100;
          reconSummary = `تم رصد ${tile.name} (المبنى الرئيسي ${tile.hqLevel ?? 2}) — ${isProt ? 'تحت الحماية' : 'مكشوفة للهجوم'} · كشف ${revealPct}%.`;
          details.push(`الحاكم: ${tile.ownerName ?? 'غير معروف'}`);
          details.push(`نقاط المدينة: ${tile.points ?? 300}`);
          details.push(
            `تقدير الموارد المرصودة (${revealPct}%): ~${Math.round(estStock.wheat * visibleRatio)} قمح · ~${Math.round(estStock.wood * visibleRatio)} خشب · ~${Math.round(estStock.iron * visibleRatio)} حديد`
          );
          details.push(isProt ? 'حالة الحماية: محمية (يمنع الهجوم)' : 'حالة الحماية: غير محمية');
        } else if (tile.kind === 'strategic_site') {
          reconSummary = `استطلاع ${tile.name} (${tile.siteCategory}) — نسبة كشف ${revealPct}%.`;
          details.push('ملاحظة: الاستكشاف يكشف المعلومات فقط ولا يمنح الملكية تلقائيًا.');
        } else {
          reconSummary = `مسح جغرافي لقطاع ${tile.name} (كشف ${revealPct}%).`;
        }
        state.worldMap[tileIdx] = {
          ...tile,
          scouted: true,
          lastScoutInfo: reconSummary,
        };
      }

      state.reports.unshift({
        id: `rep-recon-${march.id}`,
        category: 'recon',
        title: `تقرير استطلاع: ${march.targetName}`,
        summary: reconSummary,
        details,
        createdAt: march.arrivalAt,
        read: false,
      });
      completedEvents.push(`وصل الكشافة إلى ${march.targetName} (كشف ${revealPct}%)`);

      if (now >= march.returnAt) {
        state.units.scout += march.units.scout ?? 0;
      } else {
        remainingMarches.push({ ...march, phase: 'RETURNING' });
      }
    } else if (march.phase === 'RETURNING' && now >= march.returnAt) {
      if ((march.mission === 'resource_raid' || march.mission === 'player_attack') && march.loot) {
        state.resources = addResources(state.resources, march.loot);
      }
      for (const u of Object.keys(DEFAULT_UNITS) as UnitType[]) {
        state.units[u] += march.units[u] ?? 0;
      }
      completedEvents.push(`عادت القوات من ${march.targetName}`);
    } else {
      remainingMarches.push(march);
    }
  }
  state.marches = remainingMarches;

  // Maritime trade & offshore oil/gas voyages
  const remainingSea: typeof state.maritime.activeExpeditions = [];
  const seaportLv = Math.max(1, getSeaportLevel(state));
  const rigLv = Math.max(1, getOffshoreRigLevel(state));
  const maritimeTechMult = 1 + (state.researchLevels['maritime_logistics'] ?? 0) * 0.08;
  const seismicTechMult = 1 + (state.researchLevels['offshore_seismic'] ?? 0) * 0.12;

  for (const exp of state.maritime.activeExpeditions) {
    if (now >= exp.endsAt) {
      if (exp.kind === 'maritime_trade') {
        const mult = seaportLv * exp.vesselCount * maritimeTechMult;
        const bundle: ResourceBundle = {
          wheat: Math.round(140 * mult),
          wood: Math.round(115 * mult),
          iron: Math.round(105 * mult),
        };
        const achievementGain = Math.round(15 * seaportLv * exp.vesselCount * maritimeTechMult);
        state.resources = addResources(state.resources, bundle);
        state.ledger.achievementPoints += achievementGain;
        completedEvents.push(`عادت سفن التجارة البحرية (+${achievementGain} نقطة إنجاز وموارد)`);
        state.reports.unshift({
          id: `rep-sea-${exp.id}`,
          category: 'maritime',
          title: `وصول قافلة التجارة البحرية (${exp.vesselCount} سفينة)`,
          summary: `حققت الرحلة البحرية عوائد إمداد وموارد (+${achievementGain} نقطة إنجاز، دون احتسابها في رصيد التجارة).`,
          details: [
            `الشحنة الموردة: ${bundle.wheat} قمح · ${bundle.wood} خشب · ${bundle.iron} حديد`,
            'تم إضافة العوائد إلى رصيد المدينة دون إيقاف الإنتاج عند تجاوز السعة المحمية.',
          ],
          createdAt: exp.endsAt,
          read: false,
        });
      } else {
        const rigSpec =
          OFFSHORE_RIG_UPGRADE_TABLE.find((r) => r.level === rigLv) ??
          OFFSHORE_RIG_UPGRADE_TABLE[0];
        const oilFound = Math.round(rigSpec.oilYieldPerSurvey * exp.vesselCount * seismicTechMult);
        const gasFound = Math.round(rigSpec.gasYieldPerSurvey * exp.vesselCount * seismicTechMult);
        if (state.maritime.discoveredOilWells < 12) state.maritime.discoveredOilWells += 1;
        if (state.maritime.discoveredGasFields < 12) state.maritime.discoveredGasFields += 1;
        state.maritime.crudeOilStock += oilFound;
        state.maritime.naturalGasStock += gasFound;
        state.resources = addResources(state.resources, {
          wheat: 60 * exp.vesselCount,
          wood: 70 * exp.vesselCount,
          iron: 120 * exp.vesselCount,
        });
        completedEvents.push(`اكتمال مسح بحري: +${oilFound} نفط و +${gasFound} غاز`);
        state.reports.unshift({
          id: `rep-rig-${exp.id}`,
          category: 'maritime',
          title: 'نجاح استكشاف آبار النفط والغاز البحرية',
          summary: `تم ضخ ${oilFound} برميل نفط خام و${gasFound} وحدة غاز طبيعي من الآبار البحرية المكتشفة.`,
          details: [
            `إجمالي آبار النفط البحرية النشطة: ${state.maritime.discoveredOilWells}`,
            `إجمالي حقول الغاز الطبيعي البحرية: ${state.maritime.discoveredGasFields}`,
          ],
          createdAt: exp.endsAt,
          read: false,
        });
      }
    } else {
      remainingSea.push(exp);
    }
  }
  state.maritime.activeExpeditions = remainingSea;

  // Keep player city tile synced on world map
  const playerTileIdx = state.worldMap.findIndex((t) => t.kind === 'player_city');
  if (playerTileIdx >= 0) {
    state.worldMap[playerTileIdx] = {
      ...state.worldMap[playerTileIdx],
      hqLevel: getMainBuildingLevel(state),
      points: getCityPoints(state),
      name: state.cityName,
      ownerName: state.commanderName,
      protectedUntil: getActiveShieldEndsAt(state, now) ?? undefined,
    };
  }

  // Autonomous Smart Bot Hakim continuous execution tick every 6 seconds
  if (
    state.smartBotActive &&
    (state.botConfig.autoDevelopCity || state.botConfig.autoRaidResourceFields) &&
    now - (state.botConfig.lastActionAt ?? 0) >= 6_000
  ) {
    const autoSummaries: string[] = [];

    if (state.botConfig.autoDevelopCity) {
      const maxBuildSlots = getMaxBuildSlots(state);
      for (let slot = 0; slot < maxBuildSlots; slot++) {
        if (state.buildQueue.length >= maxBuildSlots) break;
        const stepRes = executeSmartBotPlanStep(state, now, true);
        if (stepRes.error || !stepRes.summary) break;
        state = stepRes.state;
        autoSummaries.push(stepRes.summary);
        completedEvents.push(`المستشار الذكي: ${stepRes.summary}`);
      }

      if (getMainBuildingLevel(state) >= 6 && getResearchCenterLevel(state) >= 1) {
        const maxResearchSlots = getMaxResearchSlots(state);
        const planOrder =
          state.botConfig.planId === 'maritime_energy'
            ? ['maritime_logistics', 'offshore_seismic', 'eng_smart_grid', 'logistics_opt']
            : state.botConfig.planId === 'industrial_mining'
              ? ['min_deep_shaft', 'ind_automation', 'logistics_opt', 'urban_engineering']
              : state.botConfig.planId === 'military_defense'
                ? ['mil_infantry_tactics', 'mil_recon_doctrine', 'urban_engineering', 'logistics_opt']
                : ['logistics_opt', 'urban_engineering', 'maritime_logistics', 'agri_hydroponics'];

        for (let rSlot = 0; rSlot < maxResearchSlots; rSlot++) {
          if (state.researchQueue.length >= maxResearchSlots) break;
          let startedAny = false;
          for (const techId of planOrder) {
            const rRes = startResearchTech(state, techId, now);
            if (!rRes.error) {
              const techName = RESEARCH_TREE.find((t) => t.id === techId)?.name ?? techId;
              state = rRes.state;
              autoSummaries.push(`بدء بحث: ${techName}`);
              completedEvents.push(`المستشار الذكي: بدء بحث ${techName}`);
              startedAny = true;
              break;
            }
          }
          if (!startedAny) break;
        }
      }

      if (getSeaportLevel(state) >= 1 && state.maritime.cargoShips === 0) {
        const vRes = buildNavalVessel(state, 'cargo_ship');
        if (!vRes.error) {
          state = vRes.state;
          autoSummaries.push('تدشين سفينة شحن تجارية تلقائيًا');
          completedEvents.push('المستشار الذكي: تدشين سفينة شحن تجارية');
        }
      }
      if (getOffshoreRigLevel(state) >= 1 && state.maritime.surveyVessels === 0) {
        const sRes = buildNavalVessel(state, 'survey_vessel');
        if (!sRes.error) {
          state = sRes.state;
          autoSummaries.push('تدشين سفينة مسح نفطي تلقائيًا');
          completedEvents.push('المستشار الذكي: تدشين سفينة مسح نفطي');
        }
      }

      if (
        getSeaportLevel(state) >= 1 &&
        state.maritime.cargoShips > 0 &&
        !state.maritime.activeExpeditions.some((e) => e.kind === 'maritime_trade')
      ) {
        const mRes = dispatchMaritimeTrade(state, now);
        if (!mRes.error) {
          state = mRes.state;
          autoSummaries.push('إطلاق قافلة تجارة بحرية');
        }
      }
      if (
        getOffshoreRigLevel(state) >= 1 &&
        state.maritime.surveyVessels > 0 &&
        !state.maritime.activeExpeditions.some((e) => e.kind === 'offshore_survey')
      ) {
        const oRes = dispatchOffshoreSurvey(state, now);
        if (!oRes.error) {
          state = oRes.state;
          autoSummaries.push('إطلاق بعثة مسح نفط وغاز');
        }
      }

      if (
        getMainBuildingLevel(state) >= 9 &&
        getBarracksLevel(state) >= 1 &&
        state.units.infantry < 10 &&
        state.trainingQueue.length === 0
      ) {
        const tRes = startTrainUnits(state, 'infantry', 5, now);
        if (!tRes.error) {
          state = tRes.state;
          autoSummaries.push('بدء تدريب 5 جنود مشاة');
        }
      }
    }

    if (
      autoSummaries.length === 0 &&
      state.botConfig.autoRaidResourceFields &&
      state.marches.length === 0
    ) {
      const raidRes = dispatchSmartBotResourceRaid(state, now, true);
      if (!raidRes.error && raidRes.summary) {
        state = raidRes.state;
        autoSummaries.push(raidRes.summary);
        completedEvents.push(`المستشار الذكي: ${raidRes.summary}`);
      }
    }

    if (autoSummaries.length > 0) {
      state = {
        ...state,
        botConfig: {
          ...state.botConfig,
          lastActionAt: now,
          lastActionSummary: autoSummaries.slice(0, 2).join(' · '),
        },
      };
    }
  }

  if (state.reports.length > 40) {
    state.reports = state.reports.slice(0, 40);
  }

  state.lastTickAt = now;
  return { state, completedEvents };
}

/* -------------------------------------------------------------------------- */
/*  Buildings, Speed-Ups & Instant Finish (§13-§14)                           */
/* -------------------------------------------------------------------------- */

export function startNewBuildingOnPlot(
  state: GameState,
  plotId: string,
  type: BuildingType,
  now: number
): { state: GameState; error?: string } {
  const maxSlots = getMaxBuildSlots(state);
  if (state.buildQueue.length >= maxSlots) {
    return { state, error: `جميع خانات البناء مشغولة (${state.buildQueue.length}/${maxSlots})` };
  }

  if (state.buildings.some((b) => b.plotId === plotId && b.status !== 'EMPTY')) {
    return { state, error: 'هذا الموقع مشغول بمبنى آخر.' };
  }

  const meta = BUILDINGS_META[type];
  const existingCount = state.buildings.filter((b) => b.type === type).length;
  if (!meta.allowMultiple && existingCount >= 1) {
    return { state, error: `لا يمكن بناء أكثر من نسخة واحدة من ${meta.name}.` };
  }
  if (meta.allowMultiple && existingCount >= meta.maxInstances) {
    return { state, error: `وصلت إلى الحد الأقصى المسموح لعدد ${meta.name} (${meta.maxInstances}).` };
  }

  const mainLv = getMainBuildingLevel(state);
  if (mainLv < meta.minHqToBuild) {
    return { state, error: `يتطلب المبنى الرئيسي مستوى ${meta.minHqToBuild}.` };
  }

  const spec = getNextBuildingUpgradeSpec(state, type, 0);
  if (!spec.canUpgrade) {
    return { state, error: spec.lockReasons[0] ?? 'المتطلبات غير مكتملة.' };
  }
  if (!canAfford(state.resources, spec.cost)) {
    return { state, error: 'الموارد غير كافية للبناء.' };
  }

  const buildingId = `b-${type}-${now}-${Math.floor(Math.random() * 1000)}`;
  const newBuilding: PlacedBuilding = {
    id: buildingId,
    plotId,
    type,
    level: 0,
    targetLevel: 1,
    status: 'CONSTRUCTING',
  };

  const queueItem: BuildQueueItem = {
    id: `bq-${now}-${Math.floor(Math.random() * 1000)}`,
    buildingId,
    plotId,
    buildingType: type,
    fromLevel: 0,
    toLevel: 1,
    startedAt: now,
    endsAt: now + spec.durationSec * 1000,
    cost: spec.cost,
  };

  return {
    state: {
      ...state,
      resources: deductResources(state.resources, spec.cost),
      buildings: [...state.buildings, newBuilding],
      buildQueue: [...state.buildQueue, queueItem],
    },
  };
}

export function startUpgradeBuilding(
  state: GameState,
  buildingId: string,
  now: number
): { state: GameState; error?: string } {
  const maxSlots = getMaxBuildSlots(state);
  if (state.buildQueue.length >= maxSlots) {
    return { state, error: `جميع خانات البناء مشغولة (${state.buildQueue.length}/${maxSlots})` };
  }

  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) {
    return { state, error: 'المبنى غير موجود.' };
  }
  if (building.status === 'CONSTRUCTING' || building.status === 'UPGRADING') {
    return { state, error: 'هذا المبنى قيد العمل بالفعل.' };
  }

  const spec = getNextBuildingUpgradeSpec(state, building.type, building.level);
  if (!spec.canUpgrade) {
    return { state, error: spec.lockReasons[0] ?? 'المتطلبات غير مكتملة.' };
  }
  if (!canAfford(state.resources, spec.cost)) {
    return { state, error: 'الموارد غير كافية للترقية.' };
  }

  const queueItem: BuildQueueItem = {
    id: `bq-${now}-${Math.floor(Math.random() * 1000)}`,
    buildingId: building.id,
    plotId: building.plotId,
    buildingType: building.type,
    fromLevel: building.level,
    toLevel: spec.nextLevel,
    startedAt: now,
    endsAt: now + spec.durationSec * 1000,
    cost: spec.cost,
  };

  return {
    state: {
      ...state,
      resources: deductResources(state.resources, spec.cost),
      buildings: state.buildings.map((b) =>
        b.id === building.id
          ? {
              ...b,
              targetLevel: spec.nextLevel,
              status: building.level === 0 ? 'CONSTRUCTING' : 'UPGRADING',
            }
          : b
      ),
      buildQueue: [...state.buildQueue, queueItem],
    },
  };
}

export function applySpeedUpToBuild(
  state: GameState,
  queueId: string,
  tierId: SpeedUpTierId,
  now: number
): { state: GameState; error?: string } {
  const count = state.speedUpCards[tierId] ?? 0;
  if (count <= 0) {
    return { state, error: 'لا تملك رصيدًا من بطاقة التسريع هذه.' };
  }
  const job = state.buildQueue.find((q) => q.id === queueId);
  if (!job) {
    return { state, error: 'عملية البناء لم تعد نشطة.' };
  }

  const reduceMs = SPEEDUP_CARDS_META[tierId].seconds * 1000;
  const newEndsAt = Math.max(now, job.endsAt - reduceMs);

  const updatedState: GameState = {
    ...state,
    speedUpCards: {
      ...state.speedUpCards,
      [tierId]: count - 1,
    },
    buildQueue: state.buildQueue.map((q) =>
      q.id === queueId ? { ...q, endsAt: newEndsAt } : q
    ),
  };

  return { state: advanceGameState(updatedState, now).state };
}

export function applySpeedUpToResearch(
  state: GameState,
  queueId: string,
  tierId: SpeedUpTierId,
  now: number
): { state: GameState; error?: string } {
  const count = state.speedUpCards[tierId] ?? 0;
  if (count <= 0) return { state, error: 'لا تملك رصيدًا من بطاقة التسريع هذه.' };
  const job = state.researchQueue.find((q) => q.id === queueId);
  if (!job) return { state, error: 'عملية البحث لم تعد نشطة.' };

  const reduceMs = SPEEDUP_CARDS_META[tierId].seconds * 1000;
  const newEndsAt = Math.max(now, job.endsAt - reduceMs);
  const updatedState: GameState = {
    ...state,
    speedUpCards: { ...state.speedUpCards, [tierId]: count - 1 },
    researchQueue: state.researchQueue.map((q) =>
      q.id === queueId ? { ...q, endsAt: newEndsAt } : q
    ),
  };
  return { state: advanceGameState(updatedState, now).state };
}

export function applySpeedUpToTraining(
  state: GameState,
  queueId: string,
  tierId: SpeedUpTierId,
  now: number
): { state: GameState; error?: string } {
  const count = state.speedUpCards[tierId] ?? 0;
  if (count <= 0) return { state, error: 'لا تملك رصيدًا من بطاقة التسريع هذه.' };
  const job = state.trainingQueue.find((q) => q.id === queueId);
  if (!job) return { state, error: 'عملية التدريب لم تعد نشطة.' };

  const reduceMs = SPEEDUP_CARDS_META[tierId].seconds * 1000;
  const updatedState: GameState = {
    ...state,
    speedUpCards: { ...state.speedUpCards, [tierId]: count - 1 },
    trainingQueue: state.trainingQueue.map((q) =>
      q.id === queueId
        ? {
            ...q,
            startedAt: q.startedAt - reduceMs,
            nextUnitEndsAt: Math.max(now, q.nextUnitEndsAt - reduceMs),
            endsAt: Math.max(now, q.endsAt - reduceMs),
          }
        : q
    ),
  };
  return { state: advanceGameState(updatedState, now).state };
}

export function getInstantFinishBuildCost(
  job: BuildQueueItem,
  now: number,
  adminConfig: AdminConfig
): { remainingMinutes: number; gemCost: number } {
  const remainingSec = Math.max(0, (job.endsAt - now) / 1000);
  const remainingMinutes = remainingSec / 60;
  const blocks = Math.max(
    1,
    Math.ceil(remainingMinutes / Math.max(1, adminConfig.instantFinishBlockMinutes))
  );
  return {
    remainingMinutes,
    gemCost: blocks * adminConfig.instantFinishGemsPerBlock,
  };
}

export function instantFinishBuildJob(
  state: GameState,
  queueId: string,
  now: number
): { state: GameState; gemCost?: number; error?: string } {
  const job = state.buildQueue.find((q) => q.id === queueId);
  if (!job) return { state, error: 'لا توجد ترقية نشطة لهذا المبنى.' };

  const { gemCost } = getInstantFinishBuildCost(job, now, state.adminConfig);
  const spent = spendGems(state, gemCost);
  if (!spent.ok) {
    return {
      state,
      error: `رصيد ENGINORA GEMS غير كافٍ (المطلوب: ${gemCost} جوهرة).`,
    };
  }

  let next = spent.state;
  next = {
    ...next,
    buildQueue: next.buildQueue.map((q) =>
      q.id === queueId ? { ...q, endsAt: now } : q
    ),
  };
  next = appendFinancialLog(next, {
    accountId: next.accountId,
    category: 'instant_finish',
    actionType: 'إنهاء فوري لبناء/ترقية',
    amountGems: gemCost,
    amountSar: 0,
    tradePointsDelta: 0,
    source: BUILDINGS_META[job.buildingType].name,
    referenceId: queueId,
    createdAt: now,
  });

  return { state: advanceGameState(next, now).state, gemCost };
}

/* -------------------------------------------------------------------------- */
/*  Paid Gem Perks: Speedups, March Speedup, Buffs, Shields (§13-§17)         */
/* -------------------------------------------------------------------------- */

export function buySpeedUpCard(
  state: GameState,
  tierId: SpeedUpTierId,
  qty: number,
  now: number
): { state: GameState; error?: string } {
  const safeQty = Math.max(1, Math.floor(qty));
  const unitCost =
    state.adminConfig.speedUpGemCosts[tierId] ?? SPEEDUP_CARDS_META[tierId].gemCost;
  const totalGems = unitCost * safeQty;
  const spent = spendGems(state, totalGems);
  if (!spent.ok) {
    return {
      state,
      error: `رصيد الجواهر غير كافٍ لشراء البطاقة (المطلوب ${totalGems} جوهرة).`,
    };
  }

  let next = spent.state;
  next = {
    ...next,
    speedUpCards: {
      ...next.speedUpCards,
      [tierId]: (next.speedUpCards[tierId] ?? 0) + safeQty,
    },
  };
  next = appendFinancialLog(next, {
    accountId: next.accountId,
    category: 'speedup_sales',
    actionType: `شراء بطاقة تسريع ${SPEEDUP_CARDS_META[tierId].name} ×${safeQty}`,
    amountGems: totalGems,
    amountSar: 0,
    tradePointsDelta: 0,
    source: 'متجر بطاقات التسريع',
    referenceId: `SU-${tierId}-${now}`,
    createdAt: now,
  });
  return { state: next };
}

export function speedUpMarchWithGems(
  state: GameState,
  marchId: string,
  minutes: number,
  now: number
): { state: GameState; gemCost?: number; error?: string } {
  const march = state.marches.find((m) => m.id === marchId);
  if (!march) return { state, error: 'الحملة الميدانية لم تعد نشطة.' };

  const phaseEnd = march.phase === 'OUTBOUND' ? march.arrivalAt : march.returnAt;
  const remMinutes = Math.max(1, Math.ceil((phaseEnd - now) / 60000));
  const appliedMin = Math.min(remMinutes, Math.max(1, Math.floor(minutes)));
  const gemCost = appliedMin * state.adminConfig.marchSpeedUpGemsPerMin;

  const spent = spendGems(state, gemCost);
  if (!spent.ok) {
    return {
      state,
      error: `رصيد الجواهر غير كافٍ (50 جوهرة/دقيقة · المطلوب ${gemCost} جوهرة).`,
    };
  }

  const reduceMs = appliedMin * 60 * 1000;
  let next = spent.state;
  next = {
    ...next,
    marches: next.marches.map((m) => {
      if (m.id !== marchId) return m;
      if (m.phase === 'OUTBOUND') {
        const newArr = Math.max(now, m.arrivalAt - reduceMs);
        const shift = m.arrivalAt - newArr;
        return { ...m, arrivalAt: newArr, returnAt: Math.max(newArr, m.returnAt - shift) };
      }
      return { ...m, returnAt: Math.max(now, m.returnAt - reduceMs) };
    }),
  };

  next = appendFinancialLog(next, {
    accountId: next.accountId,
    category: 'speedup_sales',
    actionType: `تسريع تحرك الجيش (${appliedMin} دقيقة)`,
    amountGems: gemCost,
    amountSar: 0,
    tradePointsDelta: 0,
    source: march.targetName,
    referenceId: marchId,
    createdAt: now,
  });

  return { state: advanceGameState(next, now).state, gemCost };
}

export function buyCombatBuff(
  state: GameState,
  kind: 'attack' | 'defense',
  now: number
): { state: GameState; error?: string } {
  const gemCost =
    kind === 'attack'
      ? state.adminConfig.attackBoostGems
      : state.adminConfig.defenseBoostGems;
  const spent = spendGems(state, gemCost);
  if (!spent.ok) {
    return { state, error: `رصيد الجواهر غير كافٍ (المطلوب ${gemCost} جوهرة).` };
  }

  let next = spent.state;
  const curEnd =
    kind === 'attack'
      ? next.combatBuffs.attackBoostEndsAt ?? 0
      : next.combatBuffs.defenseBoostEndsAt ?? 0;
  const newEnd = Math.max(now, curEnd) + DAY_MS;

  next = {
    ...next,
    combatBuffs: {
      ...next.combatBuffs,
      ...(kind === 'attack'
        ? { attackBoostEndsAt: newEnd }
        : { defenseBoostEndsAt: newEnd }),
    },
  };
  next = appendFinancialLog(next, {
    accountId: next.accountId,
    category: 'boost_sales',
    actionType:
      kind === 'attack'
        ? 'تفعيل/تمديد تعزيز الهجوم +10% (24 ساعة)'
        : 'تفعيل/تمديد تعزيز الدفاع +10% (24 ساعة)',
    amountGems: gemCost,
    amountSar: 0,
    tradePointsDelta: 0,
    source: 'متجر التعزيزات القتالية',
    referenceId: `BUFF-${kind}-${now}`,
    createdAt: now,
  });
  return { state: next };
}

export function buyProtectionShield(
  state: GameState,
  tier: '24h' | '3d' | '7d' | '30d',
  now: number
): { state: GameState; error?: string } {
  const pkg = SHIELD_PACKAGES.find((p) => p.id === tier);
  if (!pkg) return { state, error: 'فئة الدرع غير معروفة.' };
  const gemCost = state.adminConfig.shieldPricesGems[tier] ?? pkg.defaultGems;

  const spent = spendGems(state, gemCost);
  if (!spent.ok) {
    return { state, error: `رصيد الجواهر غير كافٍ (المطلوب ${gemCost} جوهرة).` };
  }

  let next = spent.state;
  const currentBase = Math.max(
    now,
    next.shieldEndsAt ?? 0,
    next.protectionEndsAt > now ? next.protectionEndsAt : 0
  );
  const newShieldEndsAt = currentBase + pkg.durationSec * 1000;

  next = {
    ...next,
    shieldEndsAt: newShieldEndsAt,
  };
  next = appendFinancialLog(next, {
    accountId: next.accountId,
    category: 'shield_sales',
    actionType: `تفعيل ${pkg.name} (تمديد متراكم)`,
    amountGems: gemCost,
    amountSar: 0,
    tradePointsDelta: 0,
    source: 'متجر دروع الحماية',
    referenceId: `SHD-${tier}-${now}`,
    createdAt: now,
  });
  return { state: next };
}

/* -------------------------------------------------------------------------- */
/*  Research, Military Training, Recon & Player Attack (§17, §38-§40)         */
/* -------------------------------------------------------------------------- */

export function selectCitySpecialization(
  state: GameState,
  specId: SpecializationId
): { state: GameState; error?: string } {
  if (getMainBuildingLevel(state) < 5) {
    return { state, error: 'يُفتح اختيار التخصص الرئيسي عند المبنى الرئيسي مستوى 5.' };
  }
  if (state.specialization) {
    return { state, error: 'تم اختيار التخصص الرئيسي مسبقًا.' };
  }
  return {
    state: {
      ...state,
      specialization: specId,
    },
  };
}

export function startResearchTech(
  state: GameState,
  techId: string,
  now: number
): { state: GameState; error?: string } {
  if (getMainBuildingLevel(state) < 6) {
    return { state, error: 'يُفتح مركز الأبحاث عند المبنى الرئيسي مستوى 6.' };
  }
  const rcLv = getResearchCenterLevel(state);
  if (rcLv < 1) {
    return { state, error: 'يجب بناء مركز الأبحاث أولًا.' };
  }
  const maxResearchSlots = getMaxResearchSlots(state);
  if (state.researchQueue.length >= maxResearchSlots) {
    return {
      state,
      error: `جميع خانات البحث مشغولة (${state.researchQueue.length}/${maxResearchSlots}).`,
    };
  }
  if (state.researchQueue.some((r) => r.techId === techId)) {
    return { state, error: 'هذا البحث قيد التنفيذ حاليًا.' };
  }

  const tech = RESEARCH_TREE.find((t) => t.id === techId);
  if (!tech || tech.lockedFuture) {
    return { state, error: 'هذه التقنية غير متاحة في المرحلة الحالية.' };
  }
  if (
    tech.path !== 'shared' &&
    tech.path !== 'military' &&
    tech.path !== state.specialization
  ) {
    return { state, error: 'هذا المسار غير متوافق مع تخصص مدينتك.' };
  }

  const currentLv = state.researchLevels[techId] ?? 0;
  if (currentLv >= tech.maxLevel) {
    return { state, error: 'وصل هذا البحث إلى الحد الأقصى.' };
  }
  if (rcLv < tech.requiredResearchCenterLevel) {
    return { state, error: `يتطلب مركز أبحاث مستوى ${tech.requiredResearchCenterLevel}.` };
  }
  if (getMainBuildingLevel(state) < tech.requiredHq) {
    return { state, error: `يتطلب المبنى الرئيسي مستوى ${tech.requiredHq}.` };
  }

  const multiplier = Math.pow(1.45, currentLv);
  const cost: ResourceBundle = {
    wheat: Math.round(tech.baseCost.wheat * multiplier),
    wood: Math.round(tech.baseCost.wood * multiplier),
    iron: Math.round(tech.baseCost.iron * multiplier),
  };

  if (!canAfford(state.resources, cost)) {
    return { state, error: 'الموارد غير كافية لبدء البحث.' };
  }

  const durationSec = Math.round(tech.baseDurationSec * Math.pow(1.35, currentLv));
  return {
    state: {
      ...state,
      resources: deductResources(state.resources, cost),
      researchQueue: [
        ...state.researchQueue,
        {
          id: `rq-${techId}-${now}`,
          techId,
          fromLevel: currentLv,
          toLevel: currentLv + 1,
          startedAt: now,
          endsAt: now + durationSec * 1000,
        },
      ],
    },
  };
}

export function startTrainUnits(
  state: GameState,
  unitType: UnitType,
  count: number,
  now: number
): { state: GameState; error?: string } {
  if (count <= 0) return { state, error: 'حدد عددًا صحيحًا من الوحدات.' };
  const barLv = getBarracksLevel(state);
  if (barLv < 1 || getMainBuildingLevel(state) < 9) {
    return { state, error: 'تُفتح الثكنة العسكرية عند المبنى الرئيسي مستوى 9.' };
  }

  const meta = UNITS_META[unitType];
  if (barLv < meta.requiredBarracksLevel) {
    return {
      state,
      error: `تدريب ${meta.name} يتطلب الثكنة العسكرية مستوى ${meta.requiredBarracksLevel}.`,
    };
  }

  const cost: ResourceBundle = {
    wheat: meta.cost.wheat * count,
    wood: meta.cost.wood * count,
    iron: meta.cost.iron * count,
  };
  if (!canAfford(state.resources, cost)) {
    return { state, error: 'الموارد غير كافية لتدريب هذه الوحدات.' };
  }

  const totalSec = meta.trainTimeSec * count;
  const lastEnd =
    state.trainingQueue.length > 0
      ? Math.max(...state.trainingQueue.map((t) => t.endsAt))
      : now;

  return {
    state: {
      ...state,
      resources: deductResources(state.resources, cost),
      trainingQueue: [
        ...state.trainingQueue,
        {
          id: `tq-${unitType}-${now}`,
          unitType,
          count,
          completedCount: 0,
          perUnitDurationSec: meta.trainTimeSec,
          startedAt: lastEnd,
          nextUnitEndsAt: lastEnd + meta.trainTimeSec * 1000,
          endsAt: lastEnd + totalSec * 1000,
        },
      ],
    },
  };
}

export function dispatchReconMarch(
  state: GameState,
  tileId: string,
  scoutCount: number,
  now: number
): { state: GameState; error?: string } {
  if (scoutCount <= 0) {
    return { state, error: 'اختر كشافًا واحدًا على الأقل للاستطلاع.' };
  }
  if (state.units.scout < scoutCount) {
    return { state, error: 'عدد كشافة الاستطلاع المتاح غير كافٍ.' };
  }
  const tile = state.worldMap.find((t) => t.id === tileId);
  if (!tile || tile.kind === 'player_city') {
    return { state, error: 'الهدف غير صالح للاستطلاع.' };
  }

  const dist = Math.hypot(tile.x - state.cityCoords.x, tile.y - state.cityCoords.y);
  const outboundSec = Math.max(15, Math.round((dist * 160) / UNITS_META.scout.speed));
  const returnSec = Math.max(12, Math.round(outboundSec * 0.8));

  return {
    state: {
      ...state,
      units: {
        ...state.units,
        scout: state.units.scout - scoutCount,
      },
      marches: [
        ...state.marches,
        {
          id: `m-${now}-${Math.floor(Math.random() * 1000)}`,
          mission: 'recon',
          targetTileId: tile.id,
          targetName: tile.name,
          targetCoords: { x: tile.x, y: tile.y },
          units: { infantry: 0, tank: 0, aircraft: 0, scout: scoutCount },
          phase: 'OUTBOUND',
          startedAt: now,
          arrivalAt: now + outboundSec * 1000,
          returnAt: now + (outboundSec + returnSec) * 1000,
        },
      ],
    },
  };
}

export function dispatchPlayerAttack(
  state: GameState,
  tileId: string,
  attackUnits: { infantry: number; tank: number; aircraft: number },
  now: number
): { state: GameState; shieldCancelled: boolean; error?: string } {
  const inf = Math.max(0, Math.floor(attackUnits.infantry));
  const tnk = Math.max(0, Math.floor(attackUnits.tank));
  const air = Math.max(0, Math.floor(attackUnits.aircraft));
  if (inf + tnk + air <= 0) {
    return { state, shieldCancelled: false, error: 'اختر وحدة قتالية واحدة على الأقل.' };
  }
  if (
    state.units.infantry < inf ||
    state.units.tank < tnk ||
    state.units.aircraft < air
  ) {
    return { state, shieldCancelled: false, error: 'عدد القوات المختارة يتجاوز المتاح بالمدينة.' };
  }

  const tile = state.worldMap.find((t) => t.id === tileId);
  if (!tile || tile.kind !== 'npc_city') {
    return { state, shieldCancelled: false, error: 'اختر مدينة منافسة غير محمية للهجوم.' };
  }
  if (tile.protectedUntil && tile.protectedUntil > now) {
    return { state, shieldCancelled: false, error: 'هذه المدينة محمية بدرع حماية ولا يمكن مهاجمتها.' };
  }

  const shieldWasActive = isShieldActive(state, now);
  const dist = Math.hypot(tile.x - state.cityCoords.x, tile.y - state.cityCoords.y);
  const minSpeed = Math.min(
    inf > 0 ? UNITS_META.infantry.speed : 99,
    tnk > 0 ? UNITS_META.tank.speed : 99,
    air > 0 ? UNITS_META.aircraft.speed : 99
  );
  const outboundSec = Math.max(18, Math.round((dist * 150) / Math.max(5, minSpeed)));
  const returnSec = Math.max(14, Math.round(outboundSec * 0.8));

  const nextState: GameState = {
    ...state,
    // §17: Attacking immediately cancels player's shield with NO refund
    protectionEndsAt: shieldWasActive ? 0 : state.protectionEndsAt,
    shieldEndsAt: null,
    units: {
      ...state.units,
      infantry: state.units.infantry - inf,
      tank: state.units.tank - tnk,
      aircraft: state.units.aircraft - air,
    },
    marches: [
      ...state.marches,
      {
        id: `atk-${now}-${Math.floor(Math.random() * 1000)}`,
        mission: 'player_attack',
        targetTileId: tile.id,
        targetName: tile.name,
        targetCoords: { x: tile.x, y: tile.y },
        units: { infantry: inf, tank: tnk, aircraft: air, scout: 0 },
        phase: 'OUTBOUND',
        startedAt: now,
        arrivalAt: now + outboundSec * 1000,
        returnAt: now + (outboundSec + returnSec) * 1000,
      },
    ],
  };

  if (shieldWasActive) {
    nextState.reports = [
      {
        id: `rep-shd-break-${now}`,
        category: 'military',
        title: 'تم إلغاء درع الحماية لشن هجوم عسكري',
        summary: 'بسبب بدء الهجوم على مدينة أخرى تم إيقاف درع الحماية فورًا دون استرجاع قيمته.',
        details: [`الهدف: ${tile.name} (${tile.x} | ${tile.y})`],
        createdAt: now,
        read: false,
      },
      ...nextState.reports,
    ];
  }

  return { state: nextState, shieldCancelled: shieldWasActive };
}

/* -------------------------------------------------------------------------- */
/*  Quests & Monthly Rewards (Free + VIP, KSA Midnight UTC+3)                 */
/* -------------------------------------------------------------------------- */

export function isQuestConditionMet(state: GameState, questId: string): boolean {
  const completedBuildings = state.buildings.filter((b) => b.level > 0);
  const hasFarm = completedBuildings.some((b) => b.type === 'farm');
  const hasSawmill = completedBuildings.some((b) => b.type === 'sawmill');
  const hasMine = completedBuildings.some((b) => b.type === 'iron_mine');
  const mainLv = getMainBuildingLevel(state);
  const whLv = getWarehouseLevel(state);
  const fortLv = getFortificationLevel(state);
  const rates = getProductionRates(state);
  const totalRate = rates.wheat + rates.wood + rates.iron;
  const totalLevels = completedBuildings.reduce((s, b) => s + b.level, 0);

  switch (questId) {
    case 'ach_first_farm':
      return hasFarm;
    case 'ach_all_three_prod':
      return hasFarm && hasSawmill && hasMine;
    case 'ach_hq2':
      return mainLv >= 2;
    case 'ach_warehouse2':
      return whLv >= 2;
    case 'ach_fort1':
      return fortLv >= 1;
    case 'ach_hq5_spec':
      return mainLv >= 5 && state.specialization !== null;
    case 'daily_build_action':
      return state.buildQueue.length > 0 || hasFarm || hasSawmill || hasMine;
    case 'daily_prod_200':
      return totalRate >= 200;
    case 'weekly_infra_push':
      return totalLevels >= 6;
    default:
      return false;
  }
}

export function claimQuest(
  state: GameState,
  questId: string
): { state: GameState; error?: string } {
  if (state.questClaims[questId]) {
    return { state, error: 'تم استلام مكافأة هذه المهمة مسبقًا.' };
  }
  if (!isQuestConditionMet(state, questId)) {
    return { state, error: 'شروط المهمة لم تكتمل بعد.' };
  }

  const quest = QUESTS_CATALOG.find((q) => q.id === questId);
  if (!quest) return { state, error: 'المهمة غير موجودة.' };

  const newResources = addResources(state.resources, {
    wheat: quest.rewards.wheat,
    wood: quest.rewards.wood,
    iron: quest.rewards.iron,
  });

  const newSpeedUpCards = { ...state.speedUpCards };
  if (quest.rewards.speedUp) {
    newSpeedUpCards[quest.rewards.speedUp.tier] =
      (newSpeedUpCards[quest.rewards.speedUp.tier] ?? 0) +
      quest.rewards.speedUp.count;
  }

  return {
    state: {
      ...state,
      resources: newResources,
      speedUpCards: newSpeedUpCards,
      ledger: {
        ...state.ledger,
        achievementPoints:
          state.ledger.achievementPoints + quest.rewards.achievementPoints,
      },
      questClaims: {
        ...state.questClaims,
        [questId]: true,
      },
    },
  };
}

export function claimMonthlyRewardDay(
  state: GameState,
  day: number,
  now: number
): { state: GameState; error?: string } {
  const todayKsa = getKsaDayKey(now);
  if (state.monthlyRewards.lastClaimKsaDayKey === todayKsa) {
    return {
      state,
      error: 'استلمت مكافأة اليوم بالفعل — يتجدد اليوم الجديد عند الساعة 21:00 بتوقيت UTC العالمي.',
    };
  }
  const expectedDay =
    state.monthlyRewards.claimedDays.length >= 30
      ? 1
      : state.monthlyRewards.claimedDays.length + 1;
  if (day !== expectedDay) {
    return { state, error: `اليوم المتاح للاستلام حاليًا هو اليوم ${expectedDay}.` };
  }

  const cfg = state.adminConfig.monthlyRewards.find((d) => d.day === day);
  if (!cfg) return { state, error: 'إعدادات هذا اليوم غير متوفرة.' };

  const isVipActive = Boolean(
    state.vipSubscription.active &&
      state.vipSubscription.expiresAt &&
      state.vipSubscription.expiresAt > now
  );

  let next = { ...state };
  next.resources = addResources(next.resources, {
    wheat: cfg.freeWheat + (isVipActive ? cfg.vipWheat : 0),
    wood: cfg.freeWood + (isVipActive ? cfg.vipWood : 0),
    iron: cfg.freeIron + (isVipActive ? cfg.vipIron : 0),
  });

  const cards = { ...next.speedUpCards };
  if (cfg.freeSpeedUpTier) {
    cards[cfg.freeSpeedUpTier] = (cards[cfg.freeSpeedUpTier] ?? 0) + 1;
  }
  if (isVipActive && cfg.vipSpeedUpTier) {
    cards[cfg.vipSpeedUpTier] = (cards[cfg.vipSpeedUpTier] ?? 0) + 1;
  }
  next.speedUpCards = cards;

  if (isVipActive && cfg.vipGems > 0) {
    next = creditGems(next, 'bonusGems', cfg.vipGems);
  }

  const resetCycle = state.monthlyRewards.claimedDays.length >= 30;
  next.monthlyRewards = {
    claimedDays: resetCycle ? [day] : [...state.monthlyRewards.claimedDays, day],
    lastClaimKsaDayKey: todayKsa,
    vipClaimsByDay: isVipActive
      ? resetCycle
        ? [day]
        : [...state.monthlyRewards.vipClaimsByDay, day]
      : resetCycle
        ? []
        : state.monthlyRewards.vipClaimsByDay,
  };

  return { state: next };
}

/* -------------------------------------------------------------------------- */
/*  Trade Market System (§24-§34)                                             */
/* -------------------------------------------------------------------------- */

export function getResourceStock(state: GameState, res: MarketResourceId): number {
  switch (res) {
    case 'wheat':
      return Math.floor(state.resources.wheat);
    case 'wood':
      return Math.floor(state.resources.wood);
    case 'iron':
      return Math.floor(state.resources.iron);
    case 'crude_oil':
      return Math.floor(state.maritime.crudeOilStock);
    case 'natural_gas':
      return Math.floor(state.maritime.naturalGasStock);
  }
}

export function creditResourceStock(
  state: GameState,
  res: MarketResourceId,
  qty: number
): GameState {
  const safe = Math.max(0, Math.floor(qty));
  if (res === 'wheat' || res === 'wood' || res === 'iron') {
    return {
      ...state,
      resources: { ...state.resources, [res]: state.resources[res] + safe },
    };
  }
  if (res === 'crude_oil') {
    return {
      ...state,
      maritime: { ...state.maritime, crudeOilStock: state.maritime.crudeOilStock + safe },
    };
  }
  return {
    ...state,
    maritime: { ...state.maritime, naturalGasStock: state.maritime.naturalGasStock + safe },
  };
}

export function deductResourceStock(
  state: GameState,
  res: MarketResourceId,
  qty: number
): GameState {
  const safe = Math.max(0, Math.floor(qty));
  if (res === 'wheat' || res === 'wood' || res === 'iron') {
    return {
      ...state,
      resources: {
        ...state.resources,
        [res]: Math.max(0, state.resources[res] - safe),
      },
    };
  }
  if (res === 'crude_oil') {
    return {
      ...state,
      maritime: {
        ...state.maritime,
        crudeOilStock: Math.max(0, state.maritime.crudeOilStock - safe),
      },
    };
  }
  return {
    ...state,
    maritime: {
      ...state.maritime,
      naturalGasStock: Math.max(0, state.maritime.naturalGasStock - safe),
    },
  };
}

export function getLockedResourceQty(
  state: GameState,
  res: MarketResourceId,
  now: number
): number {
  return state.market.purchasedBatches
    .filter((b) => b.resource === res && b.unlocksAt > now)
    .reduce((sum, b) => sum + b.quantity, 0);
}

export function getSellableResourceQty(
  state: GameState,
  res: MarketResourceId,
  now: number
): number {
  return Math.max(0, getResourceStock(state, res) - getLockedResourceQty(state, res, now));
}

export function getPlayerMonthlyQuotaInfo(state: GameState): {
  basePct: number;
  hakimBonusPct: number;
  totalPct: number;
  capUnits: number;
  usedUnits: number;
  remainingUnits: number;
  maxActiveOffers: number;
} {
  const mainLv = getMainBuildingLevel(state);
  const basePct = Math.min(state.adminConfig.marketMaxQuotaPct, mainLv);
  const hakimBonusPct = state.smartBotActive ? state.adminConfig.hakimBonusQuotaPct : 0;
  const totalPct = Math.min(35, basePct + hakimBonusPct);
  const capUnits = Math.floor((state.market.monthlyStockSnapshot * totalPct) / 100);
  const usedUnits = state.market.usedQuotaUnits;
  return {
    basePct,
    hakimBonusPct,
    totalPct,
    capUnits,
    usedUnits,
    remainingUnits: Math.max(0, capUnits - usedUnits),
    maxActiveOffers: state.smartBotActive ? 2 : 1,
  };
}

export function calculateMarketDealMetrics(
  state: GameState,
  resource: MarketResourceId,
  quantity: number,
  pricePer1kGems: number
): {
  grossGems: number;
  commissionGems: number;
  netSellerGems: number;
  eligibleGrossGems: number;
  eligibleNetGems: number;
  tradePointsEarned: number;
  referenceValueGems: number;
} {
  const safeQty = Math.max(0, quantity);
  const bounds = state.adminConfig.resourcePriceBounds[resource];
  const feePct = state.adminConfig.marketFeePct;
  const factorPer100 = state.adminConfig.tradePointsPer100NetGems ?? 80;

  const grossGems = Math.max(0.01, Number(((safeQty / 1000) * pricePer1kGems).toFixed(2)));
  const referenceValueGems = Number(((safeQty / 1000) * bounds.referencePrice).toFixed(2));
  const commissionGems = Number(((grossGems * feePct) / 100).toFixed(2));
  const netSellerGems = Number((grossGems - commissionGems).toFixed(2));

  // Anti-inflation rule: eligible value = min(actual gross sale, reference value for quantity sold)
  // Oil & gas gathered from offshore oil ships never count toward trade points
  const isOffshoreEnergy = resource === 'crude_oil' || resource === 'natural_gas';
  const eligibleGrossGems = Math.min(grossGems, referenceValueGems);
  const eligibleNetRaw = eligibleGrossGems * (1 - feePct / 100);
  const tradePointsEarned = isOffshoreEnergy
    ? 0
    : Number((eligibleNetRaw * (factorPer100 / 100)).toFixed(2));

  return {
    grossGems,
    commissionGems,
    netSellerGems,
    eligibleGrossGems,
    eligibleNetGems: Number(eligibleNetRaw.toFixed(2)),
    tradePointsEarned,
    referenceValueGems,
  };
}

export function publishMarketOffer(
  state: GameState,
  resource: MarketResourceId,
  quantity: number,
  unitPriceGems: number,
  now: number
): { state: GameState; error?: string } {
  if (getMainBuildingLevel(state) < 10) {
    return { state, error: 'يفتح سوق التجارة عند المبنى الرئيسي مستوى 10.' };
  }
  if (
    state.market.marketFrozenForPlayer ||
    (state.market.marketBanUntil && state.market.marketBanUntil > now)
  ) {
    return { state, error: 'السوق مجمّد حاليًا لهذا الحساب بانتظار المراجعة الإدارية.' };
  }

  const qty = Math.floor(quantity);
  if (qty <= 0) return { state, error: 'حدد كمية صالحة للبيع.' };

  const bounds = state.adminConfig.resourcePriceBounds[resource];
  if (!bounds.enabled) {
    return { state, error: 'تم إيقاف تداول هذا المنتج مؤقتًا من لوحة الإدارة.' };
  }
  if (unitPriceGems < bounds.min || unitPriceGems > bounds.max) {
    return {
      state,
      error: `السعر يجب أن يكون ضمن النطاق الرسمي (${bounds.min} – ${bounds.max} جوهرة لكل 1,000 وحدة).`,
    };
  }

  const quota = getPlayerMonthlyQuotaInfo(state);
  const activePlayerOffers = state.market.offers.filter(
    (o) => o.sellerId === state.accountId && o.status === 'active'
  );
  if (activePlayerOffers.length >= quota.maxActiveOffers) {
    return {
      state,
      error: `الحد الأقصى للعروض النشطة المتاحة لك حاليًا هو ${quota.maxActiveOffers} عرض.`,
    };
  }

  const sellable = getSellableResourceQty(state, resource, now);
  if (qty > sellable) {
    return {
      state,
      error: `الكمية القابلة للبيع حاليًا هي ${sellable} (تُمنع إعادة بيع الموارد المشتراة لمدة ${state.adminConfig.marketResaleHoldDays} يومًا).`,
    };
  }

  if (qty > quota.remainingUnits) {
    return {
      state,
      error: `الكمية تتجاوز حصتك الشهرية المتبقية (${quota.remainingUnits} وحدة).`,
    };
  }

  const expiresAt = now + state.adminConfig.marketOfferDurationDays * DAY_MS;
  const newOffer: MarketOffer = {
    id: `offer-${now}-${Math.floor(Math.random() * 10000)}`,
    sellerId: state.accountId,
    sellerName: state.commanderName,
    sellerCity: state.cityName,
    sellerMainLevel: getMainBuildingLevel(state),
    resource,
    initialQty: qty,
    remainingQty: qty,
    reservedQty: 0,
    unitPriceGems: Number(unitPriceGems.toFixed(2)),
    createdAt: now,
    expiresAt,
    status: 'active',
  };

  let next = deductResourceStock(state, resource, qty);
  next = {
    ...next,
    market: {
      ...next.market,
      usedQuotaUnits: next.market.usedQuotaUnits + qty,
      offers: [newOffer, ...next.market.offers],
      tradeLedger: [
        {
          id: `tl-pub-${now}`,
          action: 'publish',
          resource,
          quantity: qty,
          unitPriceGems: newOffer.unitPriceGems,
          grossGems: 0,
          commissionGems: 0,
          netGems: 0,
          buyerName: '—',
          sellerName: state.commanderName,
          createdAt: now,
          note: 'نشر عرض بيع (لكل 1,000 وحدة · صلاحية 7 أيام)',
        },
        ...next.market.tradeLedger,
      ],
    },
  };

  return { state: next };
}

export function editMarketOffer(
  state: GameState,
  offerId: string,
  newUnitPriceGems: number,
  now: number
): { state: GameState; error?: string } {
  const offer = state.market.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'active' || offer.sellerId !== state.accountId) {
    return { state, error: 'العرض غير متاح للتعديل.' };
  }
  const bounds = state.adminConfig.resourcePriceBounds[offer.resource];
  if (!bounds.enabled) {
    return { state, error: 'تداول هذا المنتج متوقف مؤقتًا من لوحة الإدارة.' };
  }
  if (newUnitPriceGems < bounds.min || newUnitPriceGems > bounds.max) {
    return {
      state,
      error: `السعر الجديد خارج النطاق الرسمي (${bounds.min} – ${bounds.max} لكل 1,000 وحدة).`,
    };
  }

  const rounded = Number(newUnitPriceGems.toFixed(2));
  return {
    state: {
      ...state,
      market: {
        ...state.market,
        offers: state.market.offers.map((o) =>
          o.id === offerId ? { ...o, unitPriceGems: rounded } : o
        ),
        tradeLedger: [
          {
            id: `tl-ed-${now}`,
            action: 'edit',
            resource: offer.resource,
            quantity: offer.remainingQty,
            unitPriceGems: rounded,
            grossGems: 0,
            commissionGems: 0,
            netGems: 0,
            buyerName: '—',
            sellerName: offer.sellerName,
            createdAt: now,
            note: `تعديل السعر من ${offer.unitPriceGems} إلى ${rounded} جوهرة / 1,000 وحدة`,
          },
          ...state.market.tradeLedger,
        ],
      },
    },
  };
}

export function cancelMarketOffer(
  state: GameState,
  offerId: string,
  now: number
): { state: GameState; error?: string } {
  const offer = state.market.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'active' || offer.sellerId !== state.accountId) {
    return { state, error: 'العرض غير متاح للإلغاء.' };
  }
  if (offer.reservedQty > 0) {
    return { state, error: 'يوجد طلب شراء قيد التأكيد (5 ثوانٍ) على هذا العرض حاليًا.' };
  }

  const refundQty = offer.remainingQty;
  let next = creditResourceStock(state, offer.resource, refundQty);
  next = {
    ...next,
    market: {
      ...next.market,
      usedQuotaUnits: Math.max(0, next.market.usedQuotaUnits - refundQty),
      offers: next.market.offers.map((o) =>
        o.id === offerId ? { ...o, remainingQty: 0, status: 'cancelled' } : o
      ),
      tradeLedger: [
        {
          id: `tl-can-${now}`,
          action: 'cancel',
          resource: offer.resource,
          quantity: refundQty,
          unitPriceGems: offer.unitPriceGems,
          grossGems: 0,
          commissionGems: 0,
          netGems: 0,
          buyerName: '—',
          sellerName: offer.sellerName,
          createdAt: now,
          note: 'إلغاء العرض وإرجاع الكمية غير المباعة',
        },
        ...next.market.tradeLedger,
      ],
    },
  };
  return { state: next };
}

export function initiateMarketBuy(
  state: GameState,
  offerId: string,
  quantity: number,
  now: number
): { state: GameState; pendingId?: string; error?: string } {
  if (getMainBuildingLevel(state) < 10) {
    return { state, error: 'يفتح سوق التجارة عند المبنى الرئيسي مستوى 10.' };
  }
  if (
    state.market.marketFrozenForPlayer ||
    (state.market.marketBanUntil && state.market.marketBanUntil > now)
  ) {
    return { state, error: 'التداول مجمّد حاليًا لهذا الحساب.' };
  }

  const offer = state.market.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'active') {
    return { state, error: 'العرض غير متاح.' };
  }
  const bounds = state.adminConfig.resourcePriceBounds[offer.resource];
  if (!bounds.enabled) {
    return { state, error: 'تم إيقاف تداول هذا المنتج مؤقتًا من قِبل الإدارة.' };
  }
  if (offer.sellerId === state.accountId) {
    return { state, error: 'لا يمكنك شراء عرضك الخاص.' };
  }

  const qty = Math.floor(quantity);
  if (qty <= 0 || qty > offer.remainingQty) {
    return { state, error: `الكمية المتاحة في العرض: ${offer.remainingQty}.` };
  }

  const metrics = calculateMarketDealMetrics(state, offer.resource, qty, offer.unitPriceGems);
  if (getTotalGems(state) + 1e-6 < metrics.grossGems) {
    return {
      state,
      error: `رصيد الجواهر غير كافٍ للشراء (المطلوب: ${metrics.grossGems} جوهرة).`,
    };
  }

  const pendingId = `pb-${now}-${Math.floor(Math.random() * 10000)}`;

  return {
    pendingId,
    state: {
      ...state,
      market: {
        ...state.market,
        offers: state.market.offers.map((o) =>
          o.id === offerId
            ? {
                ...o,
                remainingQty: o.remainingQty - qty,
                reservedQty: o.reservedQty + qty,
              }
            : o
        ),
        pendingBuys: [
          ...state.market.pendingBuys,
          {
            id: pendingId,
            offerId,
            buyerId: state.accountId,
            buyerName: state.commanderName,
            sellerId: offer.sellerId,
            sellerName: offer.sellerName,
            resource: offer.resource,
            quantity: qty,
            unitPriceGems: offer.unitPriceGems,
            grossGems: metrics.grossGems,
            commissionGems: metrics.commissionGems,
            netSellerGems: metrics.netSellerGems,
            tradePointsEarned: metrics.tradePointsEarned,
            createdAt: now,
            confirmAt: now + 5000,
          },
        ],
      },
    },
  };
}

export function cancelPendingMarketBuy(
  state: GameState,
  pendingId: string
): { state: GameState; error?: string } {
  const pending = state.market.pendingBuys.find((p) => p.id === pendingId);
  if (!pending) return { state, error: 'العملية غير موجودة.' };

  return {
    state: {
      ...state,
      market: {
        ...state.market,
        offers: state.market.offers.map((o) =>
          o.id === pending.offerId
            ? {
                ...o,
                remainingQty: o.remainingQty + pending.quantity,
                reservedQty: Math.max(0, o.reservedQty - pending.quantity),
              }
            : o
        ),
        pendingBuys: state.market.pendingBuys.filter((p) => p.id !== pendingId),
      },
    },
  };
}

export function finalizePendingMarketBuy(
  state: GameState,
  pendingId: string,
  now: number
): { state: GameState; error?: string } {
  const pending = state.market.pendingBuys.find((p) => p.id === pendingId);
  if (!pending) return { state, error: 'العملية المؤقتة غير موجودة.' };

  const spent = spendGems(state, pending.grossGems);
  if (!spent.ok) {
    const rolledBack = cancelPendingMarketBuy(state, pendingId);
    return {
      state: rolledBack.state,
      error: 'تعذر إتمام الشراء لعدم كفاية الجواهر عند لحظة التأكيد.',
    };
  }

  let next = spent.state;
  next = creditResourceStock(next, pending.resource, pending.quantity);

  const isPlayerSeller = pending.sellerId === next.accountId;
  const sellerEligibleForTradePoints = isPlayerSeller && getMainBuildingLevel(next) >= 10;
  const tradePointsAwarded = sellerEligibleForTradePoints ? pending.tradePointsEarned : 0;

  if (isPlayerSeller) {
    next = creditGems(next, 'marketGems', pending.netSellerGems);
    if (tradePointsAwarded > 0) {
      next = {
        ...next,
        ledger: {
          ...next.ledger,
          tradeBalance: Number((next.ledger.tradeBalance + tradePointsAwarded).toFixed(2)),
        },
      };
    }
  }

  const holdMs = next.adminConfig.marketResaleHoldDays * DAY_MS;

  next = {
    ...next,
    market: {
      ...next.market,
      offers: next.market.offers.map((o) => {
        if (o.id !== pending.offerId) return o;
        const newReserved = Math.max(0, o.reservedQty - pending.quantity);
        const done = o.remainingQty <= 0 && newReserved <= 0;
        return {
          ...o,
          reservedQty: newReserved,
          status: done ? 'completed' : o.status,
        };
      }),
      pendingBuys: next.market.pendingBuys.filter((p) => p.id !== pendingId),
      purchasedBatches: [
        ...next.market.purchasedBatches,
        {
          id: `batch-${pendingId}`,
          resource: pending.resource,
          quantity: pending.quantity,
          purchasedAt: now,
          unlocksAt: now + holdMs,
        },
      ],
      tradeLedger: [
        {
          id: `tl-buy-${pendingId}`,
          action: 'buy',
          resource: pending.resource,
          quantity: pending.quantity,
          unitPriceGems: pending.unitPriceGems,
          grossGems: pending.grossGems,
          commissionGems: pending.commissionGems,
          netGems: pending.netSellerGems,
          tradePointsEarned: pending.tradePointsEarned,
          buyerName: pending.buyerName,
          sellerName: pending.sellerName,
          createdAt: now,
          note: `عمولة ${next.adminConfig.marketFeePct}% · نقاط التجارة المحتسبة للبائع: ${pending.tradePointsEarned} · حظر ${next.adminConfig.marketResaleHoldDays} يومًا`,
        },
        ...next.market.tradeLedger,
      ],
    },
  };

  next = appendFinancialLog(next, {
    accountId: next.accountId,
    category: 'player_market_trade',
    actionType: `شراء ${pending.quantity} ${MARKET_RESOURCES_META[pending.resource].name}`,
    amountGems: pending.grossGems,
    amountSar: 0,
    tradePointsDelta: 0,
    source: `من ${pending.sellerName}`,
    referenceId: pendingId,
    createdAt: now,
  });

  next = appendFinancialLog(next, {
    accountId: 'PLATFORM-COMMISSION',
    category: 'market_commission',
    actionType: `عمولة السوق (${next.adminConfig.marketFeePct}%)`,
    amountGems: pending.commissionGems,
    amountSar: 0,
    tradePointsDelta: 0,
    source: `صفقة ${pendingId}`,
    referenceId: pendingId,
    createdAt: now,
  });

  if (tradePointsAwarded > 0) {
    next = appendFinancialLog(next, {
      accountId: pending.sellerId,
      category: 'trade_points',
      actionType: `إضافة نقاط تجارة (${next.adminConfig.tradePointsPer100NetGems}/100 صافي مرجعي)`,
      amountGems: 0,
      amountSar: 0,
      tradePointsDelta: tradePointsAwarded,
      source: `صفقة ${pendingId}`,
      referenceId: pendingId,
      createdAt: now,
    });
  }

  return { state: next };
}

/* -------------------------------------------------------------------------- */
/*  Payments, Founder Approval, Support, Telegram, Alliances, Admin RBAC      */
/* -------------------------------------------------------------------------- */

export function getPaymentMethodDiscountedSar(
  baseSar: number,
  methodId: PaymentMethodId,
  cfg: AdminConfig
): { finalSar: number; discountPct: number; enabled: boolean } {
  const pm: PaymentMethodConfig | undefined = cfg.paymentMethods?.[methodId];
  const enabled = pm ? pm.enabled : true;
  const rawPct = pm?.discountPct ?? 0;
  const discountPct = Math.max(0, Math.min(90, Number.isFinite(rawPct) ? rawPct : 0));
  const finalSar = Number((baseSar * (1 - discountPct / 100)).toFixed(2));
  return { finalSar, discountPct, enabled };
}

export function submitPaymentOrder(
  state: GameState,
  productType: OrderProductType,
  productId: string,
  paymentMethod: PaymentMethodId,
  transferRef: string,
  receiptName: string | undefined,
  receiptPreviewUrl: string | undefined,
  now: number,
  receiptId?: string
): { state: GameState; order?: PaymentOrder; error?: string } {
  const pmInfo = getPaymentMethodDiscountedSar(100, paymentMethod, state.adminConfig);
  if (!pmInfo.enabled) {
    return { state, error: 'وسيلة الدفع المختارة متوقفة حاليًا من الإدارة.' };
  }

  let title = '';
  let baseAmountSar = 0;

  if (productType === 'gem_package') {
    const pack = state.adminConfig.gemPackages.find((p) => p.id === productId);
    if (!pack) return { state, error: 'الباقة المحددة غير موجودة.' };
    title = `${pack.name} (${pack.baseGems} + ${pack.bonusGems} جوهرة)`;
    baseAmountSar = pack.priceSar;
  } else if (productType === 'hakim_sub') {
    title = `اشتراك المساعد الذكي حكيم (${state.adminConfig.hakimDurationDays} يومًا)`;
    baseAmountSar = state.adminConfig.hakimPriceSar;
  } else if (productType === 'registration_fee') {
    title = `رسوم تسجيل وتفعيل حساب لاعب (${state.adminConfig.registrationFeeSar} ريال)`;
    baseAmountSar = state.adminConfig.registrationFeeSar || 200;
  } else {
    title = `اشتراك الباقة الشهرية VIP (${state.adminConfig.vipDurationDays} يومًا)`;
    baseAmountSar = state.adminConfig.vipPriceSar;
  }

  const { finalSar, discountPct } = getPaymentMethodDiscountedSar(
    baseAmountSar,
    paymentMethod,
    state.adminConfig
  );
  if (discountPct > 0) {
    title = `${title} — خصم وسيلة الدفع ${discountPct}%`;
  }

  if (
    (paymentMethod === 'bank_transfer' || paymentMethod === 'binance') &&
    !receiptPreviewUrl &&
    !receiptId
  ) {
    return {
      state,
      error:
        paymentMethod === 'binance'
          ? 'يرجى إرفاق صورة إيصال تحويل بايننس (رقم العملية المرجعي اختياري).'
          : 'يرجى إرفاق صورة الفاتورة / إيصال التحويل البنكي (رقم العملية المرجعي اختياري).',
    };
  }

  const order: PaymentOrder = {
    id: `ORD-${now}-${Math.floor(Math.random() * 1000)}`,
    accountId: state.accountId,
    playerName: state.commanderName,
    productType,
    productId,
    productTitle: title,
    amountSar: finalSar,
    paymentMethod,
    transferRef: transferRef.trim() || undefined,
    receiptName,
    ...(receiptId ? { receiptId } : {}),
    receiptPreviewUrl,
    status: 'pending',
    createdAt: now,
  };

  return {
    order,
    state: {
      ...state,
      paymentOrders: [order, ...state.paymentOrders],
    },
  };
}


/* -------------------------------------------------------------------------- */
/*  Support Tickets (§55-§60)                                                 */
/* -------------------------------------------------------------------------- */

export function createSupportTicket(
  state: GameState,
  subject: string,
  category: string,
  text: string,
  attachments: TicketAttachment[],
  now: number
): { state: GameState; ticket?: SupportTicket; error?: string } {
  if (!subject.trim() || !text.trim()) {
    return { state, error: 'أدخل عنوان التذكرة ووصف المشكلة.' };
  }

  const ticketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
  const ticket: SupportTicket = {
    id: ticketId,
    accountId: state.accountId,
    playerName: state.commanderName,
    subject: subject.trim(),
    category: category || 'عام',
    status: 'new',
    createdAt: now,
    updatedAt: now,
    unreadByPlayer: false,
    unreadBySupport: true,
    messages: [
      {
        id: `tmsg-${now}`,
        senderRole: 'player',
        senderName: state.commanderName,
        text: text.trim(),
        attachments,
        createdAt: now,
      },
    ],
  };

  return {
    ticket,
    state: {
      ...state,
      supportTickets: [ticket, ...state.supportTickets],
    },
  };
}

export function replyToSupportTicket(
  state: GameState,
  ticketId: string,
  senderRole: 'player' | 'support',
  text: string,
  attachments: TicketAttachment[],
  now: number
): { state: GameState; error?: string } {
  if (!text.trim() && attachments.length === 0) {
    return { state, error: 'اكتب نص الرد أو أرفق صورة توضيحية.' };
  }

  const ticket = state.supportTickets.find((t) => t.id === ticketId);
  if (!ticket) return { state, error: 'التذكرة غير موجودة.' };

  const newStatus: TicketStatus =
    senderRole === 'support' ? 'replied' : 'in_review';

  return {
    state: {
      ...state,
      supportTickets: state.supportTickets.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: newStatus,
              updatedAt: now,
              unreadByPlayer: senderRole === 'support',
              unreadBySupport: senderRole === 'player',
              messages: [
                ...t.messages,
                {
                  id: `tmsg-${now}-${Math.floor(Math.random() * 1000)}`,
                  senderRole,
                  senderName:
                    senderRole === 'support'
                      ? 'فريق الدعم الفني'
                      : state.commanderName,
                  text: text.trim(),
                  attachments,
                  createdAt: now,
                },
              ],
            }
          : t
      ),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Telegram Linking (§52-§54) & Alliances (§61-§62)                          */
/* -------------------------------------------------------------------------- */

export function generateTelegramCode(state: GameState, now: number): GameState {
  const code = `ENG-${Math.floor(100000 + Math.random() * 900000)}`;
  return {
    ...state,
    telegram: {
      ...state.telegram,
      verificationCode: code,
      codeExpiresAt: now + 15 * 60 * 1000,
    },
  };
}

export function linkTelegramAccount(
  state: GameState,
  username: string,
  now: number
): { state: GameState; error?: string } {
  const clean = username.trim().replace(/^@/, '');
  if (!clean) return { state, error: 'أدخل اسم مستخدم تيليغرام صالحًا.' };
  if (
    !state.telegram.verificationCode ||
    !state.telegram.codeExpiresAt ||
    now > state.telegram.codeExpiresAt
  ) {
    return { state, error: 'قم بتوليد كود ربط مؤقت صالح أولًا.' };
  }
  return {
    state: {
      ...state,
      telegram: {
        ...state.telegram,
        linked: true,
        username: `@${clean}`,
      },
    },
  };
}

export function unlinkTelegramAccount(state: GameState): GameState {
  return {
    ...state,
    telegram: {
      ...state.telegram,
      linked: false,
      username: '',
      verificationCode: '',
      codeExpiresAt: null,
    },
  };
}

export function updateTelegramAlerts(
  state: GameState,
  patch: Partial<GameState['telegram']['alerts']>
): GameState {
  return {
    ...state,
    telegram: {
      ...state.telegram,
      alerts: {
        ...state.telegram.alerts,
        ...patch,
      },
    },
  };
}

export function createAlliance(
  state: GameState,
  name: string,
  tag: string,
  now: number
): { state: GameState; error?: string } {
  const mainLv = getMainBuildingLevel(state);
  const acLv = getAllianceCenterLevel(state);
  if (mainLv < 10 || acLv < 1) {
    return { state, error: 'تأسيس التحالف يتطلب المبنى الرئيسي مستوى 10 ومركز التحالف.' };
  }
  if (state.allianceMeta.currentAlliance) {
    return { state, error: 'أنت منضم بالفعل إلى تحالف نشط.' };
  }
  const cooldownMs = 30 * DAY_MS;
  if (
    state.allianceMeta.lastCreatedAllianceAt &&
    now - state.allianceMeta.lastCreatedAllianceAt < cooldownMs
  ) {
    const remDays = Math.ceil(
      (cooldownMs - (now - state.allianceMeta.lastCreatedAllianceAt)) / DAY_MS
    );
    return {
      state,
      error: `يتطلب إنشاء تحالف جديد مرور 30 يومًا من آخر تأسيس (المتبقي: ${remDays} يومًا).`,
    };
  }
  const cleanName = name.trim();
  const cleanTag = tag.trim().toUpperCase().slice(0, 4);
  if (cleanName.length < 3 || cleanTag.length < 2) {
    return { state, error: 'أدخل اسم التحالف (3 أحرف+) واختصارًا (2-4 أحرف).' };
  }

  return {
    state: {
      ...state,
      allianceMeta: {
        currentAlliance: {
          id: `aly-${now}`,
          name: cleanName,
          tag: cleanTag,
          leaderName: state.commanderName,
          memberCount: 1,
          maxMembers: 10, // §62: Cap 10 players per alliance
          createdAt: now,
        },
        lastCreatedAllianceAt: now,
      },
    },
  };
}

export function leaveAlliance(state: GameState): GameState {
  return {
    ...state,
    allianceMeta: {
      ...state.allianceMeta,
      currentAlliance: null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Maritime Naval Vessels & Voyages                                          */
/* -------------------------------------------------------------------------- */

export function buildNavalVessel(
  state: GameState,
  vesselType: 'cargo_ship' | 'survey_vessel'
): { state: GameState; error?: string } {
  const seaportLv = getSeaportLevel(state);
  const rigLv = getOffshoreRigLevel(state);

  if (vesselType === 'cargo_ship' && seaportLv < 1) {
    return { state, error: 'يجب بناء الميناء البحري التجاري أولًا.' };
  }
  if (vesselType === 'survey_vessel' && rigLv < 1 && seaportLv < 1) {
    return { state, error: 'يجب بناء منصة النفط والغاز أو الميناء البحري أولًا.' };
  }

  const maxFleet =
    (SEAPORT_UPGRADE_TABLE.find((r) => r.level === Math.max(1, seaportLv))?.maxFleet ?? 2) +
    rigLv * 2;
  const currentTotal = state.maritime.cargoShips + state.maritime.surveyVessels;
  if (currentTotal >= maxFleet) {
    return {
      state,
      error: `بلغ الأسطول البحري سعته القصوى (${currentTotal}/${maxFleet}). قم بترقية الميناء لزيادة السعة.`,
    };
  }

  const meta = MARITIME_VESSELS_META[vesselType];
  if (!canAfford(state.resources, meta.cost)) {
    return { state, error: 'الموارد غير كافية لبناء هذه السفينة.' };
  }

  return {
    state: {
      ...state,
      resources: deductResources(state.resources, meta.cost),
      maritime: {
        ...state.maritime,
        cargoShips:
          vesselType === 'cargo_ship'
            ? state.maritime.cargoShips + 1
            : state.maritime.cargoShips,
        surveyVessels:
          vesselType === 'survey_vessel'
            ? state.maritime.surveyVessels + 1
            : state.maritime.surveyVessels,
      },
    },
  };
}

export function dispatchMaritimeTrade(
  state: GameState,
  now: number
): { state: GameState; error?: string } {
  const seaportLv = getSeaportLevel(state);
  if (seaportLv < 1) {
    return { state, error: 'قم ببناء الميناء البحري التجاري لإطلاق قوافل التجارة البحرية.' };
  }
  if (state.maritime.cargoShips < 1) {
    return { state, error: 'قم ببناء سفينة شحن تجارية واحدة على الأقل.' };
  }
  if (state.maritime.activeExpeditions.some((e) => e.kind === 'maritime_trade')) {
    return { state, error: 'هناك قافلة تجارة بحرية مبحرة بالفعل حاليًا.' };
  }

  const vessels = Math.min(state.maritime.cargoShips, seaportLv + 1);
  const voyageSec = MARITIME_VESSELS_META.cargo_ship.voyageSec;
  return {
    state: {
      ...state,
      maritime: {
        ...state.maritime,
        activeExpeditions: [
          ...state.maritime.activeExpeditions,
          {
            id: `sea-trade-${now}`,
            kind: 'maritime_trade',
            title: `قافلة تجارة بحرية (${vessels} سفينة)`,
            vesselCount: vessels,
            startedAt: now,
            endsAt: now + voyageSec * 1000,
            expectedYieldLabel: 'إمدادات موارد + نقاط تجارة',
          },
        ],
      },
    },
  };
}

export function dispatchOffshoreSurvey(
  state: GameState,
  now: number
): { state: GameState; error?: string } {
  const rigLv = getOffshoreRigLevel(state);
  if (rigLv < 1) {
    return { state, error: 'قم ببناء منصة النفط والغاز البحرية لبدء المسح السيزمي.' };
  }
  if (state.maritime.surveyVessels < 1) {
    return { state, error: 'قم ببناء سفينة مسح وتنقيب بحري واحدة على الأقل.' };
  }
  if (state.maritime.activeExpeditions.some((e) => e.kind === 'offshore_survey')) {
    return { state, error: 'توجد بعثة استكشاف نفط وغاز قيد العمل حاليًا.' };
  }

  const vessels = Math.min(state.maritime.surveyVessels, rigLv + 1);
  const voyageSec = MARITIME_VESSELS_META.survey_vessel.voyageSec;
  return {
    state: {
      ...state,
      maritime: {
        ...state.maritime,
        activeExpeditions: [
          ...state.maritime.activeExpeditions,
          {
            id: `sea-rig-${now}`,
            kind: 'offshore_survey',
            title: `بعثة تنقيب نفط وغاز (${vessels} سفينة)`,
            vesselCount: vessels,
            startedAt: now,
            endsAt: now + voyageSec * 1000,
            expectedYieldLabel: 'اكتشاف آبار نفط وحقول غاز بحرية',
          },
        ],
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Smart Bot Hakim Legacy Plan Execution Helpers                             */
/* -------------------------------------------------------------------------- */

export interface SmartBotAdvisorReport {
  planName: string;
  currentPhaseLabel: string;
  recommendedActionTitle: string;
  recommendedActionReason: string;
  actionType: 'build' | 'upgrade' | 'wait';
  targetBuildingId?: string;
  targetBuildingType?: BuildingType;
  targetPlotId?: string;
  affordableNow: boolean;
  milestones: { label: string; completed: boolean }[];
}

export function getSmartBotAdvisorReport(state: GameState): SmartBotAdvisorReport {
  const plan = SMART_BOT_PLANS[state.botConfig.planId] ?? SMART_BOT_PLANS.balanced_economy;
  const mainLv = getMainBuildingLevel(state);
  const whLv = getWarehouseLevel(state);
  const farmMax = getHighestLevelOfType(state.buildings, 'farm');
  const sawMax = getHighestLevelOfType(state.buildings, 'sawmill');
  const mineMax = getHighestLevelOfType(state.buildings, 'iron_mine');
  const seaportLv = getSeaportLevel(state);
  const rigLv = getOffshoreRigLevel(state);
  const rcLv = getResearchCenterLevel(state);
  const fortLv = getFortificationLevel(state);

  const currentPhaseLabel =
    mainLv < 5
      ? 'المرحلة المبكرة: التأسيس والبنية التحتية'
      : mainLv < 9
        ? 'المرحلة المتوسطة: التخصص والأبحاث والبحر'
        : 'المرحلة المتقدمة: التسليح والاستعداد للسوق العالمي';

  const milestones = [
    {
      label: 'اكتمال ثلاثية الإنتاج الأساسية (مزرعة + منشرة + منجم)',
      completed: farmMax >= 1 && sawMax >= 1 && mineMax >= 1,
    },
    {
      label: 'تأمين التحصينات والمخزن المركزي (مخزن ≥ 2)',
      completed: whLv >= 2 && fortLv >= 1,
    },
    {
      label: 'فتح الميناء البحري التجاري عند المبنى الرئيسي 3',
      completed: seaportLv >= 1,
    },
    {
      label: 'بلوغ المبنى الرئيسي 5 واختيار التخصص ومنصة النفط والغاز',
      completed: mainLv >= 5 && (state.specialization !== null || rigLv >= 1),
    },
    {
      label: 'تفعيل مركز الأبحاث عند المبنى الرئيسي 6 والوصول نحو المستوى 10',
      completed: mainLv >= 6 && rcLv >= 1,
    },
  ];

  const occupiedPlotIds = new Set(state.buildings.map((b) => b.plotId));
  const freeLandPlot = CITY_PLOTS.find(
    (p) => !p.fixedType && !p.isCoastal && !occupiedPlotIds.has(p.id)
  );
  const hqBuilding = state.buildings.find((b) => b.type === 'hq');
  const hqSpec = getNextBuildingUpgradeSpec(state, 'hq', mainLv);

  const cap = getWarehouseCapacity(state);
  const stored = getTotalStoredResources(state.resources);
  const whBuilding = state.buildings.find(
    (b) => b.type === 'warehouse' && b.status === 'COMPLETED'
  );
  if (whBuilding && stored >= cap * 0.9) {
    const whSpec = getNextBuildingUpgradeSpec(state, 'warehouse', whBuilding.level);
    if (whSpec.canUpgrade && canAfford(state.resources, whSpec.cost)) {
      return {
        planName: plan.name,
        currentPhaseLabel,
        recommendedActionTitle: `توسيع المخزن المركزي إلى مستوى ${whSpec.nextLevel}`,
        recommendedActionReason:
          'تجاوز المخزون السعة المحمية للمخزن يعرّض الفائض للنهب (حتى 50%) — التوسعة الفورية تحمي مواردك.',
        actionType: 'upgrade',
        targetBuildingId: whBuilding.id,
        targetBuildingType: 'warehouse',
        affordableNow: true,
        milestones,
      };
    }
  }

  if (
    hqBuilding &&
    hqBuilding.status === 'COMPLETED' &&
    hqSpec.canUpgrade &&
    canAfford(state.resources, hqSpec.cost)
  ) {
    return {
      planName: plan.name,
      currentPhaseLabel,
      recommendedActionTitle: `ترقية المبنى الرئيسي إلى المستوى ${hqSpec.nextLevel}`,
      recommendedActionReason: 'جميع المتطلبات مكتملة؛ الترقية تفتح منشآت ومراحل جديدة.',
      actionType: 'upgrade',
      targetBuildingId: hqBuilding.id,
      targetBuildingType: 'hq',
      affordableNow: true,
      milestones,
    };
  }

  const nextHqRow = HQ_UPGRADE_TABLE.find((h) => h.level === mainLv + 1);
  if (nextHqRow) {
    const req = nextHqRow.requirements;
    const neededTypes: BuildingType[] = [];
    if (req.farmMinLevel && farmMax < req.farmMinLevel) neededTypes.push('farm');
    if (req.sawmillMinLevel && sawMax < req.sawmillMinLevel) neededTypes.push('sawmill');
    if (req.ironMineMinLevel && mineMax < req.ironMineMinLevel) neededTypes.push('iron_mine');
    if (req.warehouseMinLevel && whLv < req.warehouseMinLevel) neededTypes.push('warehouse');
    if (req.researchCenterMinLevel && rcLv < req.researchCenterMinLevel)
      neededTypes.push('research_center');
    if (req.barracksMinLevel && getBarracksLevel(state) < req.barracksMinLevel)
      neededTypes.push('barracks');
    if (req.anyTwoProductionAtLevel) {
      const prods: { type: BuildingType; lv: number }[] = [
        { type: 'farm' as BuildingType, lv: farmMax },
        { type: 'sawmill' as BuildingType, lv: sawMax },
        { type: 'iron_mine' as BuildingType, lv: mineMax },
      ].sort((a, b) => b.lv - a.lv);
      for (const p of prods.slice(0, 2)) {
        if (p.lv < req.anyTwoProductionAtLevel && !neededTypes.includes(p.type)) {
          neededTypes.push(p.type);
        }
      }
    }

    for (const needType of neededTypes) {
      const existing = state.buildings.filter((b) => b.type === needType);
      if (
        existing.length === 0 &&
        freeLandPlot &&
        mainLv >= BUILDINGS_META[needType].minHqToBuild
      ) {
        const spec = getNextBuildingUpgradeSpec(state, needType, 0);
        if (spec.canUpgrade && canAfford(state.resources, spec.cost)) {
          return {
            planName: plan.name,
            currentPhaseLabel,
            recommendedActionTitle: `بناء ${BUILDINGS_META[needType].name}`,
            recommendedActionReason: `خطوة حاسمة لفتح متطلبات المبنى الرئيسي مستوى ${mainLv + 1}.`,
            actionType: 'build',
            targetBuildingType: needType,
            targetPlotId: freeLandPlot.id,
            affordableNow: true,
            milestones,
          };
        }
      }
      const targetB = existing
        .filter((b) => b.status === 'COMPLETED')
        .sort((a, b) => a.level - b.level)[0];
      if (targetB) {
        const spec = getNextBuildingUpgradeSpec(state, needType, targetB.level);
        if (spec.canUpgrade && canAfford(state.resources, spec.cost)) {
          return {
            planName: plan.name,
            currentPhaseLabel,
            recommendedActionTitle: `ترقية ${BUILDINGS_META[needType].name} إلى مستوى ${spec.nextLevel}`,
            recommendedActionReason: `مطلوب لاستيفاء شروط الترقية إلى المبنى الرئيسي مستوى ${mainLv + 1}.`,
            actionType: 'upgrade',
            targetBuildingId: targetB.id,
            targetBuildingType: needType,
            affordableNow: true,
            milestones,
          };
        }
      }
    }
  }

  for (const bType of plan.focusBuildings) {
    const meta = BUILDINGS_META[bType];
    if (mainLv < meta.minHqToBuild) continue;
    const existing = state.buildings.filter((b) => b.type === bType);
    if (existing.length === 0) {
      const targetPlot =
        bType === 'seaport'
          ? CITY_PLOTS.find((p) => p.id === 'p-seaport')
          : bType === 'offshore_rig'
            ? CITY_PLOTS.find((p) => p.id === 'p-offshore')
            : bType === 'hospital'
              ? CITY_PLOTS.find((p) => p.id === 'p-hospital' && !occupiedPlotIds.has(p.id)) ??
                freeLandPlot
              : bType === 'alliance_center'
                ? CITY_PLOTS.find((p) => p.id === 'p-alliance' && !occupiedPlotIds.has(p.id)) ??
                  freeLandPlot
                : freeLandPlot;
      if (targetPlot) {
        const spec = getNextBuildingUpgradeSpec(state, bType, 0);
        if (spec.canUpgrade) {
          return {
            planName: plan.name,
            currentPhaseLabel,
            recommendedActionTitle: `بناء ${meta.name}`,
            recommendedActionReason: `منشأة أساسية ضمن ${plan.name} في ${targetPlot.districtName}.`,
            actionType: 'build',
            targetBuildingType: bType,
            targetPlotId: targetPlot.id,
            affordableNow: canAfford(state.resources, spec.cost),
            milestones,
          };
        }
      }
    }
  }

  const candidates = state.buildings
    .filter((b) => b.status === 'COMPLETED' && b.type !== 'hq')
    .map((b) => ({
      building: b,
      spec: getNextBuildingUpgradeSpec(state, b.type, b.level),
      priority: plan.focusBuildings.includes(b.type) ? 0 : 1,
    }))
    .filter((c) => c.spec.canUpgrade)
    .sort((a, b) => a.priority - b.priority || a.building.level - b.building.level);

  const best = candidates[0];
  if (best) {
    return {
      planName: plan.name,
      currentPhaseLabel,
      recommendedActionTitle: `ترقية ${BUILDINGS_META[best.building.type].name} إلى مستوى ${best.spec.nextLevel}`,
      recommendedActionReason:
        'رفع مستوى المنشآت يدعم متطلبات المبنى الرئيسي القادمة ويعظم العائد الساعي.',
      actionType: 'upgrade',
      targetBuildingId: best.building.id,
      targetBuildingType: best.building.type,
      affordableNow: canAfford(state.resources, best.spec.cost),
      milestones,
    };
  }

  return {
    planName: plan.name,
    currentPhaseLabel,
    recommendedActionTitle: 'تراكم الموارد وإتمام الطوابير الحالية',
    recommendedActionReason: 'جميع الخانات مشغولة أو بانتظار توفر الموارد لتنفيذ الخطوة التالية.',
    actionType: 'wait',
    affordableNow: false,
    milestones,
  };
}

export function executeSmartBotPlanStep(
  state: GameState,
  now: number,
  silent = false
): { state: GameState; summary?: string; error?: string } {
  const maxSlots = getMaxBuildSlots(state);
  if (state.buildQueue.length >= maxSlots) {
    return { state, error: `خانات البناء مشغولة (${state.buildQueue.length}/${maxSlots}).` };
  }

  const report = getSmartBotAdvisorReport(state);
  if (report.actionType === 'build' && report.targetPlotId && report.targetBuildingType) {
    const res = startNewBuildingOnPlot(state, report.targetPlotId, report.targetBuildingType, now);
    if (res.error) return { state, error: res.error };
    const summary = `تنفيذ الخطة: ${report.recommendedActionTitle}`;
    const nextState: GameState = {
      ...res.state,
      botConfig: {
        ...res.state.botConfig,
        lastActionAt: now,
        lastActionSummary: summary,
      },
      reports: silent
        ? res.state.reports
        : [
            {
              id: `rep-bot-plan-${now}`,
              category: 'bot',
              title: `تطوير مفوض: ${report.recommendedActionTitle}`,
              summary,
              details: [`الخطة المعتمدة: ${report.planName}`],
              createdAt: now,
              read: false,
            },
            ...res.state.reports,
          ],
    };
    return { state: nextState, summary };
  }

  if (report.actionType === 'upgrade' && report.targetBuildingId) {
    const res = startUpgradeBuilding(state, report.targetBuildingId, now);
    if (res.error) return { state, error: res.error };
    const summary = `تنفيذ الخطة: ${report.recommendedActionTitle}`;
    const nextState: GameState = {
      ...res.state,
      botConfig: {
        ...res.state.botConfig,
        lastActionAt: now,
        lastActionSummary: summary,
      },
      reports: silent
        ? res.state.reports
        : [
            {
              id: `rep-bot-upg-${now}`,
              category: 'bot',
              title: `ترقية مفوضة: ${report.recommendedActionTitle}`,
              summary,
              details: [`الخطة المعتمدة: ${report.planName}`],
              createdAt: now,
              read: false,
            },
            ...res.state.reports,
          ],
    };
    return { state: nextState, summary };
  }

  return { state, error: report.recommendedActionReason };
}

export function dispatchSmartBotResourceRaid(
  state: GameState,
  now: number,
  silent = false
): { state: GameState; summary?: string; error?: string } {
  const reserveRatio = Math.max(
    0.2,
    Math.min(0.85, (state.botConfig.minGarrisonReservePct ?? 50) / 100)
  );
  const availableInfantry = Math.floor(state.units.infantry * (1 - reserveRatio));
  const availableTanks = Math.floor(state.units.tank * (1 - reserveRatio));
  const availableScouts = Math.floor(state.units.scout * (1 - reserveRatio));

  const resourceTargets = state.worldMap.filter(
    (t) => t.kind === 'strategic_site' || t.kind === 'wilderness'
  );
  const target =
    resourceTargets.find((t) => t.siteCategory === 'مورد استراتيجي') ??
    resourceTargets[0];

  if (!target) {
    return { state, error: 'لا توجد حقول موارد متاحة في هذا القطاع.' };
  }

  const sendingUnits =
    availableInfantry >= 2 || availableTanks >= 1 || availableScouts >= 1
      ? {
          infantry: Math.min(20, availableInfantry),
          tank: Math.min(8, availableTanks),
          aircraft: 0,
          scout: Math.min(10, availableScouts),
        }
      : null;

  if (!sendingUnits) {
    if (getMainBuildingLevel(state) < 9 || getBarracksLevel(state) < 1) {
      return {
        state,
        error: `تتطلب حملات القتال تدريب وحدات في الثكنة (المبنى الرئيسي 9)، مع الاحتفاظ بـ ${state.botConfig.minGarrisonReservePct}% كحامية دفاعية.`,
      };
    }
    return {
      state,
      error: `عدد القوات الفائض عن الاحتياطي الدفاعي (${state.botConfig.minGarrisonReservePct}%) غير كافٍ للانطلاق.`,
    };
  }

  const dist = Math.hypot(target.x - state.cityCoords.x, target.y - state.cityCoords.y);
  const outboundSec = Math.max(18, Math.round(dist * 8));
  const returnSec = Math.max(14, Math.round(outboundSec * 0.8));
  const carryPower =
    sendingUnits.infantry * UNITS_META.infantry.carry +
    sendingUnits.tank * UNITS_META.tank.carry +
    60;
  const loot: ResourceBundle = {
    wheat: Math.round(carryPower * 0.45),
    wood: Math.round(carryPower * 0.35),
    iron: Math.round(carryPower * 0.3),
  };

  const summary = `حملة حقول موارد إلى ${target.name} (${sendingUnits.infantry} مشاة · ${sendingUnits.tank} دبابات · ${sendingUnits.scout} كشاف)`;
  const nextState: GameState = {
    ...state,
    units: {
      ...state.units,
      infantry: state.units.infantry - sendingUnits.infantry,
      tank: state.units.tank - sendingUnits.tank,
      scout: state.units.scout - sendingUnits.scout,
    },
    marches: [
      ...state.marches,
      {
        id: `raid-${now}-${Math.floor(Math.random() * 1000)}`,
        mission: 'resource_raid',
        targetTileId: target.id,
        targetName: target.name,
        targetCoords: { x: target.x, y: target.y },
        units: sendingUnits,
        phase: 'OUTBOUND',
        startedAt: now,
        arrivalAt: now + outboundSec * 1000,
        returnAt: now + (outboundSec + returnSec) * 1000,
        loot,
      },
    ],
    botConfig: {
      ...state.botConfig,
      lastActionAt: now,
      lastActionSummary: summary,
    },
    reports: silent
      ? state.reports
      : [
          {
            id: `rep-bot-raid-${now}`,
            category: 'bot',
            title: `انطلاق حملة موارد مفوضة: ${target.name}`,
            summary,
            details: [
              `تم حجز ${state.botConfig.minGarrisonReservePct}% من الحامية داخل المدينة للدفاع.`,
              'ملاحظة: المستشار الذكي لا يهاجم مدن اللاعبين أو تحالفاتهم مطلقًا.',
            ],
            createdAt: now,
            read: false,
          },
          ...state.reports,
        ],
  };

  return { state: nextState, summary };
}

/* -------------------------------------------------------------------------- */
/*  Formatting Utilities                                                      */
/* -------------------------------------------------------------------------- */

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (days > 0) {
    return `${days}ي ${String(hours).padStart(2, '0')}س`;
  }
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDurationArabic(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (mins > 0) parts.push(`${mins} دقيقة`);
  if (secs > 0 && hours === 0) parts.push(`${secs} ثانية`);
  return parts.join(' و ') || 'فوري';
}

export function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

export function formatDecimal(n: number): string {
  return Number(n.toFixed(2)).toLocaleString('en-US', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

/* -------------------------------------------------------------------------- */
/*  Player Registration (200 SAR Gate) & Founder-Only Backups                 */
/* -------------------------------------------------------------------------- */

export interface RegistrationSubmitPayload {
  nickname: string;
  fullName: string;
  nationalId: string;
  email: string;
  phone: string;
  paymentMethod?: PaymentMethodId;
  serverId?: string;
  transferRef?: string;
  receiptName?: string;
  receiptId?: string;
  receiptPreviewUrl?: string;
  acceptedPolicies: boolean;
}

export function submitPlayerRegistration(
  state: GameState,
  payload: RegistrationSubmitPayload,
  now: number
): { state: GameState; error?: string } {
  const nickname = payload.nickname.trim();
  const fullName = payload.fullName.trim();
  const nationalId = payload.nationalId.trim();
  const email = payload.email.trim();
  const phone = payload.phone.trim();
  const transferRef = (payload.transferRef ?? '').trim();
  const paymentMethod: PaymentMethodId = payload.paymentMethod ?? 'bank_transfer';
  const targetServerId =
    payload.serverId ??
    state.selectedServerId ??
    state.adminConfig.servers[0]?.id ??
    'srv-1';

  const baseFeeSar = state.adminConfig.registrationFeeSar || 200;
  const { finalSar: feeSar, discountPct, enabled } = getPaymentMethodDiscountedSar(
    baseFeeSar,
    paymentMethod,
    state.adminConfig
  );

  if (!enabled) {
    return { state, error: 'وسيلة الدفع المختارة متوقفة حاليًا من الإدارة.' };
  }
  if (nickname.length < 2) {
    return { state, error: 'أدخل الاسم المستعار باللعبة (حرفان على الأقل).' };
  }
  if (fullName.length < 4) {
    return { state, error: 'أدخل الاسم الحقيقي الكامل.' };
  }
  if (nationalId.length < 8) {
    return { state, error: 'أدخل رقم الهوية الوطنية / الإقامة بشكل صحيح.' };
  }
  if (!email.includes('@') || !email.includes('.')) {
    return { state, error: 'أدخل بريدًا إلكترونيًا صالحًا.' };
  }
  if (phone.length < 9) {
    return { state, error: 'أدخل رقم الجوال بشكل صحيح.' };
  }
  if (!payload.receiptPreviewUrl && !payload.receiptId) {
    return {
      state,
      error: `يرجى إرفاق صورة فاتورة دفع رسوم التسجيل (${feeSar} ريال).`,
    };
  }
  if (!payload.acceptedPolicies) {
    return {
      state,
      error: 'يجب الموافقة على سياسة الخصوصية والشروط والأحكام (بما فيها عدم الاسترداد وعدم الوعد بتحقيق دخل) للمتابعة.',
    };
  }

  const regOrderId = `REG-${now}-${Math.floor(100 + Math.random() * 900)}`;

  const regOrder: PaymentOrder = {
    id: regOrderId,
    accountId: state.accountId,
    playerName: `${nickname} — ${fullName}`,
    productType: 'registration_fee',
    productId: 'reg_200_sar',
    productTitle:
      discountPct > 0
        ? `رسوم تسجيل لاعب جديد (${feeSar} ريال بعد خصم ${discountPct}%) — هوية ${nationalId}`
        : `رسوم تسجيل لاعب جديد (${feeSar} ريال) — هوية ${nationalId}`,
    amountSar: feeSar,
    paymentMethod,
    transferRef: transferRef || undefined,
    receiptName: payload.receiptName || 'فاتورة-التسجيل.png',
    ...(payload.receiptId ? { receiptId: payload.receiptId } : {}),
    receiptPreviewUrl: payload.receiptPreviewUrl,
    status: 'pending',
    createdAt: now,
  };

  const cleanedOrders = state.paymentOrders.filter(
    (o) => !(o.productType === 'registration_fee' && (o.status === 'pending' || o.status === 'rejected'))
  );

  return {
    state: {
      ...state,
      commanderName: nickname,
      selectedServerId: targetServerId,
      registration: {
        status: 'pending',
        nickname,
        fullName,
        nationalId,
        email,
        phone,
        feeAmountSar: feeSar,
        paymentMethod,
        serverId: targetServerId,
        transferRef: transferRef || undefined,
        receiptName: regOrder.receiptName,
        ...(payload.receiptId ? { receiptId: payload.receiptId } : {}),
        receiptPreviewUrl: payload.receiptPreviewUrl,
        acceptedPolicies: true,
        acceptedPoliciesAt: now,
        submittedAt: now,
      },
      paymentOrders: [regOrder, ...cleanedOrders],
    },
  };
}
