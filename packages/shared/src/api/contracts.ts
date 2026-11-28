import {
  AdminBackupSnapshot,
  AdminConfig,
  AdminRole,
  AdminRoleCredentialStatus,
  CoopQuestLiveStatus,
  GameServerConfig,
  GameState,
  PaymentOrder,
} from '../types/game';

/**
 * عقود الربط الفعلية مع Cloudflare Workers API وقاعدة بيانات Cloudflare D1.
 */

export const API_ENDPOINTS = {
  // صحة النظام
  gameHealth: '/api/health',
  dbCheck: '/api/db-check',

  // مصادقة اللاعبين وبيانات المدينة (D1)
  gameConfig: '/api/game/config',
  authRegister: '/api/auth/register',
  authLogin: '/api/auth/login',
  authLogout: '/api/auth/logout',
  authForgotPassword: '/api/auth/forgot-password',
  gameState: '/api/game/state',
  gamePaymentOrders: '/api/game/payment-orders',
  gameMigrateLocal: '/api/game/migrate-local',
  gameReset: '/api/game/reset',
  coopQuests: '/api/game/coop-quests',
  coopQuestsClaim: '/api/game/coop-quests/claim',

  // فواتير الدفع المصورة (/api/receipts)
  receipts: '/api/receipts',
  receiptById: (id: string) => `/api/receipts/${encodeURIComponent(id)}`,

  // مسارات لوحة الإدارة (RBAC عبر جلسة Cloudflare Workers + D1)
  adminLogin: '/api/admin/login',
  adminLogout: '/api/admin/logout',
  adminOverview: '/api/admin/overview',
  adminConfig: '/api/admin/config',
  adminCredentials: '/api/admin/credentials',
  adminBackups: '/api/admin/backups',
  adminBackupRestore: '/api/admin/backups/restore',
  adminPlayerState: (accountId: string) =>
    `/api/admin/players/${encodeURIComponent(accountId)}/state`,
  adminPlayerPassword: (accountId: string) =>
    `/api/admin/players/${encodeURIComponent(accountId)}/password`,
  adminBackupDelete: (backupId: string) =>
    `/api/admin/backups/${encodeURIComponent(backupId)}`,
} as const;

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  serverTimeUtc?: number;
}

export interface GameConfigResponse {
  ok: true;
  adminConfig: AdminConfig;
  servers: GameServerConfig[];
  serverTimeUtc: number;
}

export interface AuthSessionResponse {
  ok: true;
  token: string;
  expiresAt: number;
  accountId: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  requiresEmailVerification?: boolean;
  state: GameState;
  revision: number;
  adminConfig: AdminConfig;
  serverTimeUtc: number;
}

export interface GameStateSyncResponse {
  ok: true;
  accountId?: string;
  email?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  revision: number;
  state: GameState;
  adminConfig: AdminConfig;
  serverTimeUtc: number;
}

export interface GamePaymentOrderResponse {
  ok: true;
  order: PaymentOrder;
  revision: number;
  state: GameState;
  adminConfig: AdminConfig;
  serverTimeUtc: number;
}

export interface MigrateLocalResponse {
  ok: true;
  migrated: boolean;
  reason?: string;
  revision: number;
  state: GameState;
  adminConfig: AdminConfig;
  serverTimeUtc: number;
}

export interface AdminLoginResponse {
  ok: true;
  token: string;
  role: AdminRole;
  expiresAt: number;
  serverTimeUtc: number;
}

export interface AdminPlayerRecord {
  accountId: string;
  commanderName: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  registrationStatus: string;
  selectedServerId: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  state: GameState;
}

export interface AdminOverviewResponse {
  ok: true;
  role: AdminRole;
  adminConfig: AdminConfig;
  players: AdminPlayerRecord[];
  backups?: AdminBackupSnapshot[];
  serverTimeUtc: number;
}

export interface AdminConfigUpdateResponse {
  ok: true;
  adminConfig: AdminConfig;
  serverTimeUtc: number;
}

export interface AdminPlayerStateUpdateResponse {
  ok: true;
  accountId: string;
  revision: number;
  state: GameState;
  adminConfig: AdminConfig;
  serverTimeUtc: number;
}

export interface AdminBackupsResponse {
  ok: true;
  snapshot?: AdminBackupSnapshot;
  backups: AdminBackupSnapshot[];
  serverTimeUtc: number;
}

export interface AdminResetPasswordResponse {
  ok: true;
  accountId: string;
  message: string;
  serverTimeUtc: number;
}

export interface CoopQuestsStatusResponse {
  ok: true;
  serverId: string;
  serverName: string;
  serverPlayersCount: number;
  eligibleForCoop: boolean;
  mainLevel: number;
  allianceCenterLevel: number;
  quests: CoopQuestLiveStatus[];
  serverTimeUtc: number;
}

export interface CoopQuestClaimResponse {
  ok: true;
  questId: string;
  state: GameState;
  revision: number;
  quests: CoopQuestLiveStatus[];
  serverTimeUtc: number;
}

export interface AdminBackupRestoreResponse {
  ok: true;
  serverId: string;
  serverName: string;
  restoredPlayersCount: number;
  adminConfig: AdminConfig;
  players: AdminPlayerRecord[];
  serverTimeUtc: number;
}

export interface AdminCredentialsResponse {
  ok: true;
  credentials: AdminRoleCredentialStatus[];
  serverTimeUtc: number;
}
