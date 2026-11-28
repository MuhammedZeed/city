export type BuildingType =
  | 'hq'
  | 'warehouse'
  | 'farm'
  | 'sawmill'
  | 'iron_mine'
  | 'research_center'
  | 'barracks'
  | 'fortifications'
  | 'hospital'
  | 'alliance_center'
  | 'seaport'
  | 'offshore_rig';

export type BuildingStatus =
  | 'EMPTY'
  | 'CONSTRUCTING'
  | 'COMPLETED'
  | 'UPGRADING'
  | 'PAUSED';

export type SpecializationId =
  | 'agriculture'
  | 'industry'
  | 'mining'
  | 'energy';

export type SmartBotPlanId =
  | 'balanced_economy'
  | 'industrial_mining'
  | 'military_defense'
  | 'maritime_energy';

export type NavSection =
  | 'city'
  | 'build'
  | 'military'
  | 'research'
  | 'world_map'
  | 'alliances'
  | 'market'
  | 'store'
  | 'monthly'
  | 'quests'
  | 'reports'
  | 'stats'
  | 'support'
  | 'admin';

export type TerrainType =
  | 'plains'
  | 'forest'
  | 'mountains'
  | 'desert'
  | 'coast';

export type SpeedUpTierId = '1m' | '5m' | '30m' | '1h' | '24h' | '3d' | '7d';

export type UnitType = 'infantry' | 'tank' | 'aircraft' | 'scout';

export type MarketResourceId =
  | 'wheat'
  | 'wood'
  | 'iron'
  | 'crude_oil'
  | 'natural_gas';

export type PaymentMethodId = 'apple_pay' | 'mada' | 'bank_transfer' | 'binance';

export interface PaymentMethodConfig {
  id: PaymentMethodId;
  enabled: boolean;
  discountPct: number;
  note?: string;
  bankOrNetwork?: string;
  accountTitle?: string;
  accountNumber?: string;
  ibanOrAddress?: string;
  paymentLink?: string;
  instructions?: string;
}

export interface GameServerConfig {
  id: string;
  code: string;
  name: string;
  capacity: number;
  isOpen: boolean;
  note?: string;
}

export type OrderProductType =
  | 'gem_package'
  | 'hakim_sub'
  | 'vip_sub'
  | 'registration_fee';

export type TicketStatus =
  | 'new'
  | 'in_review'
  | 'awaiting_player'
  | 'replied'
  | 'closed';

export type AdminRole = 'founder' | 'partner' | 'support';

export type PlayerRegistrationStatus =
  | 'unregistered'
  | 'pending'
  | 'approved'
  | 'rejected';

export interface PlayerRegistration {
  status: PlayerRegistrationStatus;
  nickname: string;
  fullName: string;
  nationalId: string;
  email: string;
  phone: string;
  feeAmountSar: number;
  paymentMethod?: PaymentMethodId;
  serverId?: string;
  transferRef?: string;
  receiptName?: string;
  receiptId?: string;
  receiptPreviewUrl?: string;
  acceptedPolicies?: boolean;
  acceptedPoliciesAt?: number;
  submittedAt?: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface AdminBackupSnapshot {
  id: string;
  label: string;
  createdAt: number;
  createdBy: string;
  totalSarApproved: number;
  commanderName: string;
  backupType?: 'server_snapshot_v1' | 'legacy_player_snapshot';
  serverId?: string;
  serverName?: string;
  playersCount?: number;
  payloadJson: string;
}

export type CoopQuestMetricKey =
  | 'total_building_upgrades'
  | 'hq10_players'
  | 'alliance_center_levels'
  | 'total_research_levels'
  | 'total_army_units'
  | 'maritime_energy_stock';

export interface CoopQuestDef {
  id: string;
  title: string;
  description: string;
  metricKey: CoopQuestMetricKey;
  unitLabel: string;
  targetValue: number;
  minHqRequired: number;
  requiresAllianceCenter: boolean;
  rewards: {
    wheat: number;
    wood: number;
    iron: number;
    achievementPoints: number;
    speedUp?: { tier: SpeedUpTierId; count: number };
  };
}

export interface CoopQuestLiveStatus {
  quest: CoopQuestDef;
  currentValue: number;
  targetValue: number;
  progressPct: number;
  completed: boolean;
  claimed: boolean;
  canClaim: boolean;
  contributorsCount: number;
}

export interface AdminRoleCredentialStatus {
  role: AdminRole;
  source: 'database' | 'env_secret' | 'unconfigured';
  updatedAt: number | null;
}

export interface ResourceBundle {
  wheat: number;
  wood: number;
  iron: number;
}

export interface CityPlotDef {
  id: string;
  gx: number;
  gy: number;
  districtName: string;
  fixedType?: BuildingType;
  suggestedType?: BuildingType;
  isPerimeter?: boolean;
  isCoastal?: boolean;
}

export interface PlacedBuilding {
  id: string;
  plotId: string;
  type: BuildingType;
  level: number;
  targetLevel: number;
  status: BuildingStatus;
}

export interface BuildQueueItem {
  id: string;
  buildingId: string;
  plotId: string;
  buildingType: BuildingType;
  fromLevel: number;
  toLevel: number;
  startedAt: number;
  endsAt: number;
  cost: ResourceBundle;
}

export interface ResearchQueueItem {
  id: string;
  techId: string;
  fromLevel: number;
  toLevel: number;
  startedAt: number;
  endsAt: number;
}

export interface TrainingQueueItem {
  id: string;
  unitType: UnitType;
  count: number;
  completedCount: number;
  perUnitDurationSec: number;
  startedAt: number;
  nextUnitEndsAt: number;
  endsAt: number;
}

export interface MarchItem {
  id: string;
  mission: 'recon' | 'resource_raid' | 'player_attack';
  targetTileId: string;
  targetName: string;
  targetCoords: { x: number; y: number };
  units: Record<UnitType, number>;
  phase: 'OUTBOUND' | 'RETURNING';
  startedAt: number;
  arrivalAt: number;
  returnAt: number;
  loot?: ResourceBundle;
}

export interface SeaExpedition {
  id: string;
  kind: 'maritime_trade' | 'offshore_survey';
  title: string;
  vesselCount: number;
  startedAt: number;
  endsAt: number;
  expectedYieldLabel: string;
}

export interface MaritimeState {
  cargoShips: number;
  surveyVessels: number;
  discoveredOilWells: number;
  discoveredGasFields: number;
  crudeOilStock: number;
  naturalGasStock: number;
  activeExpeditions: SeaExpedition[];
}

export interface BotConfig {
  planId: SmartBotPlanId;
  autoDevelopCity: boolean;
  autoRaidResourceFields: boolean;
  minGarrisonReservePct: number;
  lastActionAt?: number;
  lastActionSummary?: string;
}

export interface QuestProgress {
  id: string;
  claimed: boolean;
}

export interface GameReport {
  id: string;
  category: 'construction' | 'recon' | 'bot' | 'research' | 'maritime' | 'military' | 'market';
  title: string;
  summary: string;
  details: string[];
  createdAt: number;
  read: boolean;
}

export interface WorldTile {
  id: string;
  x: number;
  y: number;
  terrain: TerrainType;
  kind: 'player_city' | 'npc_city' | 'strategic_site' | 'wilderness';
  name: string;
  ownerName?: string;
  hqLevel?: number;
  points?: number;
  protectedUntil?: number;
  siteCategory?:
    | 'مورد استراتيجي'
    | 'موقع مراقبة'
    | 'ممر استراتيجي'
    | 'موقع تجاري'
    | 'موقع عسكري';
  scouted?: boolean;
  lastScoutInfo?: string;
  mockLootStock?: ResourceBundle;
}

export interface GemLedger {
  chargedGems: number;
  bonusGems: number;
  marketGems: number;
}

export interface CombatBuffsState {
  attackBoostEndsAt: number | null;
  defenseBoostEndsAt: number | null;
}

export interface SubscriptionRecord {
  active: boolean;
  startedAt: number | null;
  expiresAt: number | null;
  renewCount: number;
}

export interface MarketPriceBounds {
  referencePrice: number; // Official baseline price per 1,000 units (Gems)
  min: number; // Minimum allowed price per 1,000 units (default 70%)
  max: number; // Maximum allowed price per 1,000 units (default 150%)
  enabled: boolean; // Founder toggle to enable/pause trading for this product
}

export interface PurchasedResourceBatch {
  id: string;
  resource: MarketResourceId;
  quantity: number;
  purchasedAt: number;
  unlocksAt: number;
}

export interface MarketOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerCity: string;
  sellerMainLevel: number;
  resource: MarketResourceId;
  initialQty: number;
  remainingQty: number;
  reservedQty: number;
  unitPriceGems: number;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'completed' | 'cancelled' | 'expired' | 'admin_cancelled';
  suspiciousFlag?: boolean;
  flagReason?: string;
}

export interface PendingMarketBuy {
  id: string;
  offerId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  resource: MarketResourceId;
  quantity: number;
  unitPriceGems: number; // Price per 1,000 units
  grossGems: number;
  commissionGems: number;
  netSellerGems: number;
  tradePointsEarned: number;
  createdAt: number;
  confirmAt: number; // createdAt + 5000ms
}

export interface TradeLedgerEntry {
  id: string;
  action: 'buy' | 'sell' | 'publish' | 'edit' | 'cancel' | 'expired' | 'admin_reversal';
  resource: MarketResourceId;
  quantity: number;
  unitPriceGems: number; // Price per 1,000 units
  grossGems: number;
  commissionGems: number;
  netGems: number;
  tradePointsEarned?: number;
  buyerName: string;
  sellerName: string;
  createdAt: number;
  note?: string;
}

export interface MarketState {
  offers: MarketOffer[];
  pendingBuys: PendingMarketBuy[];
  tradeLedger: TradeLedgerEntry[];
  purchasedBatches: PurchasedResourceBatch[];
  quotaMonthKey: string;
  monthlyStockSnapshot: number;
  usedQuotaUnits: number;
  marketFrozenForPlayer: boolean;
  marketBanUntil: number | null;
  playerInternalDebtGems: number;
}

export interface GemPackageConfig {
  id: string;
  name: string;
  baseGems: number;
  bonusGems: number;
  priceSar: number;
}

export interface MonthlyRewardDayConfig {
  day: number;
  freeLabel: string;
  freeWheat: number;
  freeWood: number;
  freeIron: number;
  freeSpeedUpTier?: SpeedUpTierId;
  vipLabel: string;
  vipGems: number;
  vipWheat: number;
  vipWood: number;
  vipIron: number;
  vipSpeedUpTier?: SpeedUpTierId;
}

export interface AdminConfig {
  gemPackages: GemPackageConfig[];
  speedUpGemCosts: Record<SpeedUpTierId, number>;
  instantFinishGemsPerBlock: number;
  instantFinishBlockMinutes: number;
  marchSpeedUpGemsPerMin: number;
  attackBoostGems: number;
  defenseBoostGems: number;
  shieldPricesGems: Record<'24h' | '3d' | '7d' | '30d', number>;
  hakimPriceSar: number;
  hakimDurationDays: number;
  vipPriceSar: number;
  vipPriceUsd: number;
  vipDurationDays: number;
  marketFeePct: number;
  marketOfferDurationDays: number;
  marketResaleHoldDays: number;
  marketMaxQuotaPct: number;
  hakimBonusQuotaPct: number;
  tradePointsPer100NetGems: number;
  registrationFeeSar: number;
  servers: GameServerConfig[];
  paymentMethods: Record<PaymentMethodId, PaymentMethodConfig>;
  resourcePriceBounds: Record<MarketResourceId, MarketPriceBounds>;
  monthlyRewards: MonthlyRewardDayConfig[];
  notificationsEnabled: boolean;
}

export interface PaymentOrder {
  id: string;
  accountId: string;
  playerName: string;
  productType: OrderProductType;
  productId: string;
  productTitle: string;
  amountSar: number;
  paymentMethod: PaymentMethodId;
  receiptName?: string;
  receiptId?: string;
  receiptPreviewUrl?: string;
  transferRef?: string;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  note?: string;
}

export type FinancialCategory =
  | 'gem_sales'
  | 'player_market_trade'
  | 'market_commission'
  | 'hakim_subscription'
  | 'vip_subscription'
  | 'speedup_sales'
  | 'instant_finish'
  | 'boost_sales'
  | 'shield_sales'
  | 'trade_points'
  | 'payment_refund'
  | 'cancelled_suspicious'
  | 'admin_adjustment'
  | 'support_stats';

export interface FinancialLogEntry {
  id: string;
  accountId: string;
  category: FinancialCategory;
  actionType: string;
  amountGems: number;
  amountSar: number;
  tradePointsDelta: number;
  source: string;
  referenceId: string;
  createdAt: number;
}

export interface AdminAuditEntry {
  id: string;
  actorRole: AdminRole;
  actorName: string;
  action: string;
  details: string;
  createdAt: number;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface TicketMessage {
  id: string;
  senderRole: 'player' | 'support';
  senderName: string;
  text: string;
  attachments: TicketAttachment[];
  createdAt: number;
}

export interface SupportTicket {
  id: string;
  accountId: string;
  playerName: string;
  subject: string;
  category: string;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  unreadByPlayer: boolean;
  unreadBySupport: boolean;
  messages: TicketMessage[];
}

export interface TelegramConfig {
  linked: boolean;
  username: string;
  verificationCode: string;
  codeExpiresAt: number | null;
  alerts: {
    market: boolean;
    purchases: boolean;
    offerExpiry: boolean;
    construction: boolean;
    research: boolean;
    army: boolean;
    important: boolean;
  };
}

export interface AllianceInfo {
  id: string;
  name: string;
  tag: string;
  leaderName: string;
  memberCount: number;
  maxMembers: number;
  createdAt: number;
}

export interface AllianceMeta {
  currentAlliance: AllianceInfo | null;
  lastCreatedAllianceAt: number | null;
}

export interface MonthlyRewardsState {
  claimedDays: number[];
  lastClaimKsaDayKey: string | null;
  vipClaimsByDay: number[];
}

export interface GameState {
  version: number;
  accountId: string;
  commanderName: string;
  cityName: string;
  cityCoords: { x: number; y: number };
  cityTerrain: TerrainType;
  createdAt: number;
  lastTickAt: number;
  protectionEndsAt: number; // New player 14d shield
  shieldEndsAt: number | null; // Purchased gem protection shield
  combatBuffs: CombatBuffsState;
  resources: ResourceBundle;
  // Separate ledgers per GDD v3.1 (§8-§23)
  gemLedger: GemLedger;
  ledger: {
    paidGems: number; // mirrored total ENGINORA GEMS for compatibility
    tradeBalance: number; // Trade & reward points ledger (completely separate)
    achievementPoints: number;
  };
  specialization: SpecializationId | null;
  smartBotActive: boolean;
  smartBotExpiresAt: number | null;
  hakimSubscription: SubscriptionRecord;
  vipSubscription: SubscriptionRecord;
  monthlyRewards: MonthlyRewardsState;
  botConfig: BotConfig;
  maritime: MaritimeState;
  buildings: PlacedBuilding[];
  buildQueue: BuildQueueItem[];
  researchLevels: Record<string, number>;
  researchQueue: ResearchQueueItem[];
  units: Record<UnitType, number>;
  trainingQueue: TrainingQueueItem[];
  marches: MarchItem[];
  speedUpCards: Record<SpeedUpTierId, number>;
  questClaims: Record<string, boolean>;
  coopQuestClaims?: Record<string, boolean>;
  dailyResetKey: string;
  weeklyResetKey: string;
  reports: GameReport[];
  worldMap: WorldTile[];
  market: MarketState;
  paymentOrders: PaymentOrder[];
  financialLogs: FinancialLogEntry[];
  adminAuditLogs: AdminAuditEntry[];
  supportTickets: SupportTicket[];
  telegram: TelegramConfig;
  allianceMeta: AllianceMeta;
  adminConfig: AdminConfig;
  selectedServerId?: string;
  registration: PlayerRegistration;
  soundEnabled: boolean;
  lastAdminSyncAt?: number;
}
