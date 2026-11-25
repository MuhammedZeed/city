import {
  AdminAuditEntry,
  AdminBackupSnapshot,
  AdminConfig,
  AdminRole,
  FinancialLogEntry,
  GameServerConfig,
  GameState,
  PaymentOrder,
  PlayerRegistration,
  SupportTicket,
} from '../types/game';

/**
 * عقود الربط المستقبلية مع واجهة API المشتركة وقاعدة بيانات Cloudflare D1 (المرحلة الثانية والثالثة).
 * ملاحظة: هذه العقود جاهزة للتوصيل بالخادم ولا تمثل خادمًا حيًا في المرحلة الأولى.
 */

export const API_ENDPOINTS = {
  // مسارات مشروع اللعبة (عامة للاعب المصادق عليه فقط)
  gameHealth: '/api/health',
  gameBootstrap: '/api/game/bootstrap',
  gameStateSync: '/api/game/state',
  gameRegister: '/api/game/register',
  gameLogin: '/api/game/login',
  gameServersStatus: '/api/game/servers',
  gamePaymentOrder: '/api/game/payments',
  gameMarketOffers: '/api/game/market/offers',
  gameSupportTickets: '/api/game/tickets',

  // مسارات مشروع الإدارة (محمية من جهة الخادم عبر Cloudflare Access + RBAC)
  adminSession: '/api/admin/session',
  adminRegistrations: '/api/admin/registrations',
  adminPayments: '/api/admin/payments',
  adminServers: '/api/admin/servers',
  adminConfig: '/api/admin/config',
  adminFinancials: '/api/admin/financials',
  adminMarketOps: '/api/admin/market',
  adminTickets: '/api/admin/tickets',
  adminAuditLogs: '/api/admin/audit-logs',
  adminBackups: '/api/admin/backups',
} as const;

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  serverTimeUtc?: number;
}

export interface ServerVerifiedAdminSession {
  authenticated: boolean;
  email: string | null;
  role: AdminRole | null;
  verifiedBy: 'cloudflare_access' | 'server_session' | 'pending_phase_2';
}

export interface GameBootstrapResponse {
  playerState: GameState;
  servers: GameServerConfig[];
  adminConfig: AdminConfig;
  serverTimeUtc: number;
}

export interface AdminOverviewPayload {
  servers: GameServerConfig[];
  adminConfig: AdminConfig;
  registrations: PlayerRegistration[];
  paymentOrders: PaymentOrder[];
  financialLogs: FinancialLogEntry[];
  adminAuditLogs: AdminAuditEntry[];
  supportTickets: SupportTicket[];
  backups?: AdminBackupSnapshot[];
}
