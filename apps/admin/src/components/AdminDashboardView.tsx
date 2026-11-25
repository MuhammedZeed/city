import React, { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gamepad2,
  Gem,
  HardDriveDownload,
  LifeBuoy,
  Lock,
  Percent,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  Wallet,
} from "lucide-react";
import {
  MARKET_RESOURCES_META,
  PAYMENT_METHODS_META,
  PanelHeader,
  SHIELD_PACKAGES,
  SPEEDUP_CARDS_META,
  TICKET_STATUS_LABELS,
  formatDecimal,
  formatKsaDateTime,
  formatNumber,
  getMainBuildingLevel,
  getTotalGems,
  AdminBackupSnapshot,
  AdminConfig,
  AdminRole,
  FinancialCategory,
  GameServerConfig,
  GameState,
  MarketResourceId,
  PaymentMethodId,
  SpeedUpTierId,
  TicketAttachment,
  TicketStatus,
} from "@enginora/shared";

const FounderVaultSection = React.lazy(() => import("./FounderVaultSection"));


const FINANCIAL_CATEGORY_LABELS: Record<FinancialCategory, string> = {
  gem_sales: 'مبيعات الجواهر',
  player_market_trade: 'تداولات السوق بين اللاعبين',
  market_commission: 'عمولة السوق (5%)',
  hakim_subscription: 'اشتراكات المستشار حكيم',
  vip_subscription: 'اشتراكات VIP الشهرية',
  speedup_sales: 'مبيعات التسريع والمسيرة',
  instant_finish: 'الإنهاء الفوري للبناء',
  boost_sales: 'مبيعات التعزيزات (+10%)',
  shield_sales: 'مبيعات دروع الحماية',
  trade_points: 'نقاط التجارة',
  payment_refund: 'المبالغ المستردة',
  cancelled_suspicious: 'الصفقات الملغاة/المشبوهة',
  admin_adjustment: 'التسويات الإدارية',
  support_stats: 'إحصائيات التذاكر والدعم',
};

const ALL_FINANCIAL_CATEGORIES = Object.keys(
  FINANCIAL_CATEGORY_LABELS
) as FinancialCategory[];

const ROLE_LABELS: Record<AdminRole, string> = {
  founder: 'المؤسس (Founder) — صلاحية كاملة',
  partner: 'الشريك (Partner) — عرض مالي وتقارير فقط',
  support: 'الدعم الفني (Support) — تذاكر الدعم فقط',
};

/* -------------------------------------------------------------------------- */
/*  Admin Governance Dashboard (§67-§77) with Strict RBAC                     */
/* -------------------------------------------------------------------------- */

export const AdminDashboardView: React.FC<{
  state: GameState;
  now: number;
  adminRole: AdminRole;
  backupSnapshots: AdminBackupSnapshot[];
  onChangeAdminRole: (role: AdminRole) => void;
  onReviewPaymentOrder: (
    orderId: string,
    decision: 'approve' | 'reject' | 'refund',
    note: string
  ) => void;
  onReviewRegistration: (decision: 'approve' | 'reject', note: string) => void;
  onCreateBackupSnapshot: (label: string) => void;
  onRestoreBackupSnapshot: (payloadJson: string) => void;
  onDeleteBackupSnapshot: (snapshotId: string) => void;
  onReverseMarketOffer: (offerId: string, reason: string) => void;
  onToggleMarketFreeze: (freeze: boolean, reason: string) => void;
  onUpdateAdminConfig: (patch: Partial<AdminConfig>, summary: string) => void;
  onReplySupportTicket: (
    ticketId: string,
    text: string,
    attachments: TicketAttachment[]
  ) => void;
  onUpdateTicketStatus: (ticketId: string, status: TicketStatus) => void;
  onEnterGameAsAdmin?: () => void;
}> = ({
  state,
  adminRole,
  backupSnapshots,
  onChangeAdminRole,
  onReviewPaymentOrder,
  onReviewRegistration,
  onCreateBackupSnapshot,
  onRestoreBackupSnapshot,
  onDeleteBackupSnapshot,
  onReverseMarketOffer,
  onToggleMarketFreeze,
  onUpdateAdminConfig,
  onReplySupportTicket,
  onUpdateTicketStatus,
  onEnterGameAsAdmin,
}) => {
  const defaultTab = adminRole === 'support' ? 'tickets' : 'payments';
  const [tab, setTab] = useState<
    'payments' | 'servers' | 'financials' | 'market_ops' | 'config' | 'tickets' | 'backups'
  >(defaultTab);
  const [finFilter, setFinFilter] = useState<'all' | FinancialCategory>('all');
  const [finGroup, setFinGroup] = useState<
    'all' | 'sar_income' | 'gems_economy' | 'trade_points' | 'refunds_flags'
  >('all');
  const [finSearch, setFinSearch] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [backupLabel, setBackupLabel] = useState('');
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | TicketStatus>('all');
  const [supportReplyMap, setSupportReplyMap] = useState<Record<string, string>>({});
  const [configDraft, setConfigDraft] = useState<AdminConfig>(state.adminConfig);
  const [newServerCode, setNewServerCode] = useState('S3');
  const [newServerName, setNewServerName] = useState('');
  const [newServerCapacity, setNewServerCapacity] = useState(150);
  const [receiptLightbox, setReceiptLightbox] = useState<string | null>(null);

  useEffect(() => {
    setConfigDraft(state.adminConfig);
  }, [state.adminConfig]);

  const isFounder = adminRole === 'founder';
  const canViewFinance = adminRole === 'founder' || adminRole === 'partner';
  const canManageSupport = adminRole === 'founder' || adminRole === 'support';

  const financialStats = useMemo(() => {
    let totalSarApproved = 0;
    let totalRefundSar = 0;
    let regSar = 0;
    let regCount = 0;
    let gemPackSar = 0;
    let gemPackCount = 0;
    let hakimSar = 0;
    let hakimCount = 0;
    let vipSar = 0;
    let vipCount = 0;

    let commissionGems = 0;
    let instantFinishGems = 0;
    let speedupGems = 0;
    let buffsAndShieldsGems = 0;
    let marketTradeVolumeGems = 0;
    let tradePointsIssued = 0;

    for (const log of state.financialLogs) {
      if (log.category === 'payment_refund') {
        totalRefundSar += Math.abs(log.amountSar);
      } else if (log.amountSar > 0) {
        totalSarApproved += log.amountSar;
      }

      if (log.category === 'gem_sales' && log.amountSar > 0) {
        gemPackSar += log.amountSar;
        gemPackCount += 1;
      } else if (log.category === 'hakim_subscription' && log.amountSar > 0) {
        hakimSar += log.amountSar;
        hakimCount += 1;
      } else if (log.category === 'vip_subscription' && log.amountSar > 0) {
        vipSar += log.amountSar;
        vipCount += 1;
      } else if (log.category === 'admin_adjustment' && log.amountSar > 0) {
        regSar += log.amountSar;
        regCount += 1;
      }

      if (log.category === 'market_commission') commissionGems += log.amountGems;
      if (log.category === 'instant_finish') instantFinishGems += log.amountGems;
      if (log.category === 'speedup_sales') speedupGems += log.amountGems;
      if (log.category === 'boost_sales' || log.category === 'shield_sales') {
        buffsAndShieldsGems += log.amountGems;
      }
      if (log.category === 'player_market_trade') {
        marketTradeVolumeGems += log.amountGems;
      }
      if (log.tradePointsDelta > 0) {
        tradePointsIssued += log.tradePointsDelta;
      }
    }

    const pendingOrders = state.paymentOrders.filter((o) => o.status === 'pending');
    const pendingSar = pendingOrders.reduce((s, o) => s + (o.amountSar || 0), 0);
    const netSar = Math.max(0, totalSarApproved - totalRefundSar);
    const totalSpentGems = instantFinishGems + speedupGems + buffsAndShieldsGems;

    return {
      totalSarApproved,
      totalRefundSar,
      netSar,
      pendingSar,
      pendingCount: pendingOrders.length,
      regSar,
      regCount,
      gemPackSar,
      gemPackCount,
      hakimSar,
      hakimCount,
      vipSar,
      vipCount,
      commissionGems,
      instantFinishGems,
      speedupGems,
      buffsAndShieldsGems,
      totalSpentGems,
      marketTradeVolumeGems,
      tradePointsIssued,
    };
  }, [state.financialLogs, state.paymentOrders]);

  const filteredFinLogs = useMemo(() => {
    const q = finSearch.trim().toLowerCase();
    return state.financialLogs.filter((l) => {
      if (finFilter !== 'all' && l.category !== finFilter) return false;
      if (finGroup === 'sar_income') {
        if (!(l.amountSar > 0 && l.category !== 'payment_refund')) return false;
      } else if (finGroup === 'gems_economy') {
        if (
          ![
            'player_market_trade',
            'market_commission',
            'speedup_sales',
            'instant_finish',
            'boost_sales',
            'shield_sales',
          ].includes(l.category)
        ) {
          return false;
        }
      } else if (finGroup === 'trade_points') {
        if (l.category !== 'trade_points' && l.tradePointsDelta === 0) return false;
      } else if (finGroup === 'refunds_flags') {
        if (l.category !== 'payment_refund' && l.category !== 'cancelled_suspicious') {
          return false;
        }
      }

      if (!q) return true;
      return (
        l.referenceId.toLowerCase().includes(q) ||
        l.actionType.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        FINANCIAL_CATEGORY_LABELS[l.category].toLowerCase().includes(q)
      );
    });
  }, [state.financialLogs, finFilter, finGroup, finSearch]);

  const filteredTickets = state.supportTickets.filter((t) => {
    if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false;
    const q = ticketSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      t.id.toLowerCase().includes(q) ||
      t.playerName.toLowerCase().includes(q) ||
      t.accountId.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
    );
  });

  const navTabs = [
    { id: 'payments', label: 'المدفوعات والتسجيلات', icon: CreditCard },
    { id: 'servers', label: 'السيرفرات', icon: Server },
    { id: 'financials', label: 'التقارير المالية', icon: BarChart3 },
    { id: 'market_ops', label: 'رقابة السوق', icon: AlertTriangle },
    { id: 'config', label: 'الأسعار والدفع', icon: Settings2 },
    { id: 'tickets', label: 'تذاكر الدعم', icon: LifeBuoy },
    ...(isFounder ? ([{ id: 'backups', label: 'النسخ الاحتياطي', icon: Archive }] as const) : []),
  ] as const;

  const servers = state.adminConfig.servers ?? [];
  const openServersCount = servers.filter((s) => s.isOpen).length;

  const handleToggleServerOpen = (serverId: string) => {
    const updated = servers.map((s) =>
      s.id === serverId ? { ...s, isOpen: !s.isOpen } : s
    );
    const target = updated.find((s) => s.id === serverId);
    onUpdateAdminConfig(
      { servers: updated },
      target
        ? `${target.isOpen ? 'تفعيل وفتح' : 'إيقاف وإغلاق'} السيرفر ${target.name} (${target.code})`
        : 'تحديث حالة السيرفر'
    );
  };

  const handleUpdateServerField = (
    serverId: string,
    patch: Partial<GameServerConfig>,
    summary: string
  ) => {
    const updated = servers.map((s) =>
      s.id === serverId ? { ...s, ...patch } : s
    );
    onUpdateAdminConfig({ servers: updated }, summary);
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newServerName.trim();
    const cleanCode = newServerCode.trim().toUpperCase() || `S${servers.length + 1}`;
    if (!cleanName) return;
    const nextServer: GameServerConfig = {
      id: `srv-${Date.now()}`,
      code: cleanCode,
      name: cleanName,
      capacity: Math.max(10, Math.min(5000, Number(newServerCapacity) || 150)),
      isOpen: false,
      note: 'سيرفر جديد (مغلق لحين التفعيل)',
    };
    onUpdateAdminConfig(
      { servers: [...servers, nextServer] },
      `إضافة سيرفر جديد: [${nextServer.code}] ${nextServer.name} (سعة ${nextServer.capacity})`
    );
    setNewServerName('');
    setNewServerCode(`S${servers.length + 2}`);
    setNewServerCapacity(150);
  };

  const handleDeleteServer = (serverId: string) => {
    if (servers.length <= 1) return;
    const target = servers.find((s) => s.id === serverId);
    onUpdateAdminConfig(
      { servers: servers.filter((s) => s.id !== serverId) },
      `حذف السيرفر ${target?.name ?? serverId}`
    );
  };

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.10),transparent_45%)]">
      <div className="max-w-6xl mx-auto space-y-5 pb-8">
        <PanelHeader
          icon={ShieldCheck}
          title="لوحة الإدارة والحوكمة المالية"
          subtitle="إدارة السيرفرات، التسجيلات، المدفوعات، الأسعار ووسائل الدفع والخصومات، التقارير المالية، الدعم، والنسخ الاحتياطي للمؤسس."
          rightSlot={
            <div className="flex items-center gap-1 p-1 rounded-xl glass-subpanel overflow-x-auto no-scrollbar max-w-full">
              {navTabs.map((t) => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
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

        {/* RBAC Role Switcher Bar & Founder Direct Game Entry */}
        <div className="glass-panel p-4 rounded-2xl border-amber-500/45 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              <span>محاكي الصلاحيات الإدارية (RBAC): {ROLE_LABELS[adminRole]}</span>
            </div>
            <p className="text-[11px] text-slate-300">
              {adminRole === 'founder'
                ? 'المؤسس يملك صلاحية فتح وإغلاق السيرفرات، اعتماد المدفوعات، تعديل الأسعار والخصومات، الدخول للعبة للاختبار، والنسخ الاحتياطي.'
                : adminRole === 'partner'
                  ? 'الشريك يطّلع على التقارير والمدفوعات فقط (للقراءة دون تعديل أسعار أو اعتماد أو نسخ احتياطي أو وصول لأي ملفات).'
                  : 'الدعم الفني يطّلع على تذاكر اللاعبين ويرد عليها فقط؛ لا يرى البيانات المالية ولا يعتمد المدفوعات.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onEnterGameAsAdmin && (
              <button
                type="button"
                onClick={onEnterGameAsAdmin}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-lg transition-colors"
              >
                <Gamepad2 className="w-4 h-4 shrink-0" />
                <span>دخول مباشر للعبة للاختبار</span>
              </button>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {(['founder', 'partner', 'support'] as AdminRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    onChangeAdminRole(role);
                    if (role === 'support') setTab('tickets');
                    else if (role !== 'founder' && tab === 'backups') setTab('payments');
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl font-bold border transition-colors ${
                    adminRole === role
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {role === 'founder'
                    ? 'المؤسس Founder'
                    : role === 'partner'
                      ? 'الشريك Partner'
                      : 'الدعم Support'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Access Guard for Support role trying non-ticket tabs */}
        {!canViewFinance && tab !== 'tickets' && (
          <div className="glass-panel p-6 rounded-2xl border-rose-500/50 flex items-center gap-3 text-xs text-rose-200">
            <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">الوصول مرفوض لصلاحية الدعم الفني</div>
              <p className="text-slate-300 mt-0.5">
                حساب الدعم الفني (Support) مخصص لإدارة تذاكر اللاعبين فقط ولا يطّلع على التقارير المالية أو المدفوعات أو أسعار المنصة أو النسخ الاحتياطي.
              </p>
            </div>
          </div>
        )}

        {/* Access Guard for Backups (Founder ONLY — strictly blocked for Partner & Support) */}
        {tab === 'backups' && !isFounder && canViewFinance && (
          <div className="glass-panel p-6 rounded-2xl border-rose-500/50 flex items-center gap-3 text-xs text-rose-200">
            <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">النسخ الاحتياطي حصري للمؤسس فقط</div>
              <p className="text-slate-300 mt-0.5">
                لا يُسمح للشريك أو الدعم الفني بالوصول إلى النسخ الاحتياطية أو ملفات النظام.
              </p>
            </div>
          </div>
        )}

        {/* TAB: Server Management & Open/Close Gate */}
        {tab === 'servers' && canViewFinance && (
          <div className="space-y-4 text-xs">
            <div className="glass-panel p-4 sm:p-5 rounded-2xl border-sky-500/40 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-sky-300 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <span>إدارة السيرفرات والتحكم بفتح الدخول للاعبين</span>
                </h3>
                <p className="text-slate-300">
                  عند إيقاف أي سيرفر، يظهر للاعبين في شاشة الدخول رسالة <strong>«السيرفر مغلق حاليًا»</strong> ولا يُسمح لأي لاعب بالدخول حتى تقوم بتفعيل السيرفر هنا.
                </p>
              </div>
              <div className="flex items-center gap-2 font-num">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/45 text-emerald-300 font-bold">
                  مفتوح: {openServersCount}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/45 text-rose-300 font-bold">
                  مغلق: {servers.length - openServersCount}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {servers.map((srv) => (
                <div
                  key={srv.id}
                  className={`glass-panel p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
                    srv.isOpen ? 'border-emerald-500/50' : 'border-rose-500/40'
                  }`}
                >
                  <div className="space-y-2 flex-1 min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-num font-bold text-amber-300">
                        {srv.code}
                      </span>
                      <span className="text-sm font-bold text-slate-100">{srv.name}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg border font-bold text-[11px] ${
                          srv.isOpen
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                        }`}
                      >
                        {srv.isOpen ? 'مفعل — مفتوح للدخول' : 'مغلق حاليًا'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 font-num">
                      <span>السعة المحددة: {srv.capacity} لاعب</span>
                      {srv.note && <span className="text-slate-400">· {srv.note}</span>}
                    </div>

                    {isFounder && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="text"
                          defaultValue={srv.name}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== srv.name) {
                              handleUpdateServerField(
                                srv.id,
                                { name: val },
                                `تغيير اسم السيرفر ${srv.code} إلى ${val}`
                              );
                            }
                          }}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 w-56"
                          aria-label="اسم السيرفر"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">السعة:</span>
                          <input
                            type="number"
                            min={10}
                            max={5000}
                            defaultValue={srv.capacity}
                            onBlur={(e) => {
                              const cap = Math.max(10, Number(e.target.value) || 150);
                              if (cap !== srv.capacity) {
                                handleUpdateServerField(
                                  srv.id,
                                  { capacity: cap },
                                  `تعديل سعة السيرفر ${srv.code} إلى ${cap} لاعب`
                                );
                              }
                            }}
                            className="min-h-[34px] w-24 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-num font-bold text-center"
                            aria-label="سعة السيرفر"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!isFounder ? (
                      <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400">
                        عرض فقط (الشريك)
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleServerOpen(srv.id)}
                          className={`min-h-[42px] px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors shadow ${
                            srv.isOpen
                              ? 'bg-rose-600 hover:bg-rose-500 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                          <span>{srv.isOpen ? 'إيقاف (إغلاق السيرفر)' : 'تفعيل (فتح السيرفر)'}</span>
                        </button>
                        {servers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteServer(srv.id)}
                            className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950 border border-slate-700 hover:border-rose-500/50 text-rose-300 font-bold"
                            title="حذف السيرفر"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isFounder && (
              <form
                onSubmit={handleAddServer}
                className="glass-panel p-4 rounded-2xl border-slate-700/60 flex flex-wrap items-end gap-3"
              >
                <div>
                  <label className="block text-slate-300 mb-1">رمز السيرفر</label>
                  <input
                    type="text"
                    value={newServerCode}
                    onChange={(e) => setNewServerCode(e.target.value)}
                    placeholder="S3"
                    className="w-24 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-num font-bold text-amber-300"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-slate-300 mb-1">اسم السيرفر الجديد</label>
                  <input
                    type="text"
                    required
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    placeholder="مثال: السيرفر الثالث — مرسى الشرق"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">سعة اللاعبين</label>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={newServerCapacity}
                    onChange={(e) => setNewServerCapacity(Number(e.target.value) || 150)}
                    className="w-28 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-num text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة سيرفر (مغلق افتراضيًا)</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 1: Registration Reviews (200 SAR) + Payment Orders */}
        {tab === 'payments' && canViewFinance && (
          <div className="space-y-4 text-xs">
            {/* Player Registration Approval Card */}
            <div className="glass-panel p-4 rounded-2xl border-amber-500/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-amber-300">
                    طلبات تسجيل اللاعبين الجديدة (رسوم التفعيل {state.adminConfig.registrationFeeSar || 200} ريال)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    يُسمح للاعب بدخول المدينة فقط بعد مطابقة الهوية وفاتورة الدفع واعتماد المؤسس.
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                    state.registration.status === 'approved'
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                      : state.registration.status === 'pending'
                        ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {state.registration.status === 'approved'
                    ? 'حساب معتمد'
                    : state.registration.status === 'pending'
                      ? 'بانتظار مراجعة المؤسس'
                      : state.registration.status === 'rejected'
                        ? 'مرفوض'
                        : 'لم يتم التسجيل بعد'}
                </span>
              </div>

              {state.registration.status !== 'unregistered' ? (
                <div className="glass-subpanel p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 text-[11px]">
                    <div className="text-slate-100 font-bold text-xs">
                      الاسم المستعار: {state.registration.nickname} · الاسم الحقيقي: {state.registration.fullName}
                    </div>
                    <div className="text-slate-300 font-num">
                      الهوية: {state.registration.nationalId} · الجوال: {state.registration.phone} · البريد: {state.registration.email}
                    </div>
                    <div className="text-emerald-300 font-num">
                      قيمة الفاتورة: {state.registration.feeAmountSar} ريال
                      {state.registration.transferRef ? ` · مرجع الحوالة: ${state.registration.transferRef}` : ''}
                      {state.registration.submittedAt ? ` · ${formatKsaDateTime(state.registration.submittedAt)}` : ''}
                    </div>
                    {state.registration.receiptPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => setReceiptLightbox(state.registration.receiptPreviewUrl!)}
                        className="mt-1 inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200 underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة فاتورة الـ {state.registration.feeAmountSar} ريال ({state.registration.receiptName})</span>
                      </button>
                    )}
                  </div>

                  {state.registration.status === 'pending' && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isFounder ? (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400">
                          عرض فقط (الشريك)
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onReviewRegistration('approve', orderNote)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            قبول وتفعيل اللاعب
                          </button>
                          <button
                            type="button"
                            onClick={() => onReviewRegistration('reject', orderNote)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                          >
                            رفض الطلب
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  لا توجد طلبات تسجيل قيد المراجعة حاليًا.
                </div>
              )}
            </div>

            <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-slate-100">
                  طلبات الدفع والشحن ({state.paymentOrders.length})
                </div>
                <div className="text-slate-400 mt-0.5">
                  تظهر الطلبات بحالة «قيد المراجعة» ولا يضاف الرصيد إلا بعد اعتماد المؤسس.
                </div>
              </div>
              {isFounder && (
                <input
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="ملاحظة مراجعة اختيارية قبل الاعتماد أو الرفض..."
                  className="min-h-[40px] w-full sm:w-72 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                />
              )}
            </div>

            {state.paymentOrders.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl text-center text-slate-400">
                لا توجد طلبات دفع مسجلة حتى الآن. جرّب إرسال طلب من «المتجر والجواهر».
              </div>
            ) : (
              <div className="space-y-3">
                {state.paymentOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-num font-bold text-amber-300">{ord.id}</span>
                        <span className="font-bold text-slate-100">{ord.productTitle}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold text-sky-300">
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-num">
                        اللاعب: {ord.playerName} ({ord.accountId}) · {PAYMENT_METHODS_META[ord.paymentMethod].name} ·{' '}
                        {ord.amountSar} ريال · {formatKsaDateTime(ord.createdAt)}
                        {ord.transferRef ? ` · مرجع: ${ord.transferRef}` : ''}
                      </div>
                      {ord.receiptPreviewUrl && (
                        <button
                          type="button"
                          onClick={() => setReceiptLightbox(ord.receiptPreviewUrl!)}
                          className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-sky-300 hover:text-sky-200 underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة صورة الإيصال ({ord.receiptName})</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isFounder ? (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400">
                          عرض فقط (الشريك)
                        </span>
                      ) : ord.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onReviewPaymentOrder(ord.id, 'approve', orderNote)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            اعتماد وإضافة الرصيد
                          </button>
                          <button
                            type="button"
                            onClick={() => onReviewPaymentOrder(ord.id, 'reject', orderNote)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                          >
                            رفض
                          </button>
                        </>
                      ) : ord.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => onReviewPaymentOrder(ord.id, 'refund', orderNote)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                        >
                          استرداد مالي
                        </button>
                      ) : (
                        <span className="text-slate-400 font-semibold">
                          مغلق ({ord.reviewedBy})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Clear Executive Financial Reports & Ledger */}
        {tab === 'financials' && canViewFinance && (
          <div className="space-y-5 text-xs">
            {/* 1. Top 4 Clear KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="glass-panel p-4 rounded-2xl border-emerald-500/40 space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-semibold">صافي الدخل الفعلي</span>
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-num font-bold text-emerald-300">
                  {formatNumber(financialStats.netSar)} ريال
                </div>
                <div className="text-[11px] text-slate-400 font-num">
                  معتمد: {formatNumber(financialStats.totalSarApproved)} · مسترد: {formatNumber(financialStats.totalRefundSar)} ريال
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border-amber-500/35 space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-semibold">طلبات بانتظار المراجعة</span>
                  <CreditCard className="w-4 h-4 text-amber-300" />
                </div>
                <div className="text-2xl font-num font-bold text-amber-300">
                  {formatNumber(financialStats.pendingSar)} ريال
                </div>
                <div className="text-[11px] text-slate-400 font-num">
                  عدد الطلبات المعلقة حاليًا: {financialStats.pendingCount} طلب
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border-sky-500/35 space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-semibold">اقتصاد الجواهر باللعبة</span>
                  <Gem className="w-4 h-4 text-sky-300" />
                </div>
                <div className="text-2xl font-num font-bold text-sky-300">
                  {formatNumber(getTotalGems(state))} جوهرة
                </div>
                <div className="text-[11px] text-slate-400 font-num">
                  مستهلَك باللعبة: {formatDecimal(financialStats.totalSpentGems)} · عمولة سوق: {formatDecimal(financialStats.commissionGems)}
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border-purple-500/35 space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-semibold">نقاط التجارة (منفصلة)</span>
                  <Coins className="w-4 h-4 text-purple-300" />
                </div>
                <div className="text-2xl font-num font-bold text-purple-300">
                  {formatDecimal(state.ledger.tradeBalance)} نقطة
                </div>
                <div className="text-[11px] text-slate-400">
                  المبنى الرئيسي: مستوى {getMainBuildingLevel(state)} · تذاكر مفتوحة: {state.supportTickets.filter((t) => t.status !== 'closed').length}
                </div>
              </div>
            </div>

            {/* 2. Two-Column Readable Breakdown: Real SAR Revenue vs In-Game Economy */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Column A: Real Money SAR Streams */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      <span>أولاً: مصادر الدخل المالي (بالريال السعودي)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      الأموال الفعلية المعتمدة من فواتير التسجيل، باقات الجواهر، والاشتراكات.
                    </p>
                  </div>
                  <span className="font-num font-bold text-sm text-emerald-300">
                    {formatNumber(financialStats.totalSarApproved)} ريال
                  </span>
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      label: 'رسوم تسجيل وتفعيل اللاعبين (200 ريال)',
                      amount: financialStats.regSar,
                      count: financialStats.regCount,
                      barColor: 'bg-emerald-500',
                    },
                    {
                      label: 'مبيعات باقات شحن الجواهر',
                      amount: financialStats.gemPackSar,
                      count: financialStats.gemPackCount,
                      barColor: 'bg-amber-400',
                    },
                    {
                      label: 'اشتراكات المستشار الذكي (حكيم)',
                      amount: financialStats.hakimSar,
                      count: financialStats.hakimCount,
                      barColor: 'bg-sky-400',
                    },
                    {
                      label: 'اشتراكات الباقة الشهرية (VIP)',
                      amount: financialStats.vipSar,
                      count: financialStats.vipCount,
                      barColor: 'bg-purple-400',
                    },
                  ].map((row) => {
                    const pct =
                      financialStats.totalSarApproved > 0
                        ? Math.round((row.amount / financialStats.totalSarApproved) * 100)
                        : 0;
                    return (
                      <div key={row.label} className="glass-subpanel p-3 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-200">{row.label}</span>
                          <span className="font-num font-bold text-slate-100 whitespace-nowrap">
                            {formatNumber(row.amount)} ريال{' '}
                            <span className="text-[10px] text-slate-400">({row.count} عملية)</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.barColor}`}
                            style={{ width: `${Math.max(pct, row.amount > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column B: In-Game Gems & Market Activity */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div>
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                      <Gem className="w-4 h-4" />
                      <span>ثانيًا: حركة الجواهر والسوق داخل اللعبة</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      كيف تُستخدم الجواهر داخل اللعبة وعمولات السوق ونقاط التجارة (ليست مبالغ نقدية).
                    </p>
                  </div>
                  <span className="font-num font-bold text-sm text-amber-300">
                    {formatDecimal(financialStats.totalSpentGems + financialStats.commissionGems)} جوهرة
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="glass-subpanel p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">حجم تداولات السوق بين اللاعبين</div>
                      <div className="text-[10px] text-slate-400">إجمالي صفقات البيع والشراء المنفذة</div>
                    </div>
                    <span className="font-num font-bold text-emerald-300">
                      {formatDecimal(financialStats.marketTradeVolumeGems)} جوهرة
                    </span>
                  </div>

                  <div className="glass-subpanel p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">عمولة السوق المحصلة (5%)</div>
                      <div className="text-[10px] text-slate-400">تُخصم تلقائيًا من صفقات الموارد</div>
                    </div>
                    <span className="font-num font-bold text-amber-300">
                      {formatDecimal(financialStats.commissionGems)} جوهرة
                    </span>
                  </div>

                  <div className="glass-subpanel p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">إنفاق الإنهاء الفوري للبناء</div>
                      <div className="text-[10px] text-slate-400">جواهر مستهلكة لإنهاء المشاريع فورًا</div>
                    </div>
                    <span className="font-num font-bold text-sky-300">
                      {formatDecimal(financialStats.instantFinishGems)} جوهرة
                    </span>
                  </div>

                  <div className="glass-subpanel p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">مشتريات بطاقات التسريع والدروع والتعزيزات</div>
                      <div className="text-[10px] text-slate-400">
                        تسريع: {formatDecimal(financialStats.speedupGems)} · دروع وتعزيزات: {formatDecimal(financialStats.buffsAndShieldsGems)}
                      </div>
                    </div>
                    <span className="font-num font-bold text-slate-100">
                      {formatDecimal(financialStats.speedupGems + financialStats.buffsAndShieldsGems)} جوهرة
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Simplified Quick Filters + Detailed Searchable Table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/45 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm text-slate-100">
                      سجل العمليات المالية المفصّل
                    </span>
                    <span className="text-[11px] text-slate-400 mr-2 font-num">
                      ({filteredFinLogs.length} من أصل {state.financialLogs.length} عملية)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={finSearch}
                        onChange={(e) => setFinSearch(e.target.value)}
                        placeholder="ابحث بالعملية أو المرجع..."
                        className="min-h-[38px] pr-8 pl-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100 w-52"
                      />
                    </div>
                    <select
                      value={finFilter}
                      onChange={(e) => setFinFilter(e.target.value as 'all' | FinancialCategory)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100"
                    >
                      <option value="all">كل التصنيفات (14)</option>
                      {ALL_FINANCIAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {FINANCIAL_CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Clear 5-Button Grouping Bar */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'جميع القيود' },
                      { id: 'sar_income', label: 'الدخل المالي (ريال سعودي)' },
                      { id: 'gems_economy', label: 'حركة الجواهر والسوق' },
                      { id: 'trade_points', label: 'نقاط التجارة' },
                      { id: 'refunds_flags', label: 'الاستردادات والصفقات الملغاة' },
                    ] as const
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setFinGroup(g.id)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl font-bold border transition-colors ${
                        finGroup === g.id
                          ? 'bg-[#1D4ED8] border-blue-400 text-white'
                          : 'glass-subpanel text-slate-300 hover:text-white'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right min-w-[740px]">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-700/45">
                    <tr>
                      <th className="py-2.5 px-3">التاريخ والوقت (UTC)</th>
                      <th className="py-2.5 px-3">القسم</th>
                      <th className="py-2.5 px-3">تفاصيل العملية</th>
                      <th className="py-2.5 px-3">المبلغ بالريال</th>
                      <th className="py-2.5 px-3">الجواهر</th>
                      <th className="py-2.5 px-3">نقاط التجارة</th>
                      <th className="py-2.5 px-3">المرجع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredFinLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          لا توجد عمليات مطابقة للبحث أو التصفية الحالية.
                        </td>
                      </tr>
                    ) : (
                      filteredFinLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/35">
                          <td className="py-2.5 px-3 font-num text-slate-400 whitespace-nowrap">
                            {formatKsaDateTime(log.createdAt)}
                          </td>
                          <td className="py-2.5 px-3 text-sky-300 font-semibold whitespace-nowrap">
                            {FINANCIAL_CATEGORY_LABELS[log.category]}
                          </td>
                          <td className="py-2.5 px-3 text-slate-100">
                            <div className="font-semibold">{log.actionType}</div>
                            <div className="text-[10px] text-slate-400">{log.source}</div>
                          </td>
                          <td className="py-2.5 px-3 font-num font-bold whitespace-nowrap">
                            {log.amountSar !== 0 ? (
                              <span
                                className={
                                  log.category === 'payment_refund' || log.amountSar < 0
                                    ? 'text-rose-300'
                                    : 'text-emerald-300'
                                }
                              >
                                {log.category === 'payment_refund' ? '-' : '+'}
                                {formatNumber(Math.abs(log.amountSar))} ريال
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-num font-bold whitespace-nowrap">
                            {log.amountGems !== 0 ? (
                              <span className="text-amber-300">
                                {formatDecimal(log.amountGems)} جوهرة
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-num font-bold whitespace-nowrap">
                            {log.tradePointsDelta !== 0 ? (
                              <span className="text-purple-300">
                                +{formatDecimal(log.tradePointsDelta)} نقطة
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-num text-[11px] text-slate-400">
                            {log.referenceId}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Market Anti-Manipulation & Oversight */}
        {tab === 'market_ops' && canViewFinance && (
          <div className="space-y-4 text-xs">
            <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>حالة تداول اللاعب في السوق</span>
                </div>
                <div className="text-slate-300 font-num">
                  التجميد الإداري: {state.market.marketFrozenForPlayer ? 'مجمّد ❄️' : 'نشط ✓'} ·{' '}
                  الدين الداخلي من عكس الصفقات: {state.market.playerInternalDebtGems} جوهرة
                </div>
              </div>
              {isFounder && (
                <button
                  type="button"
                  onClick={() =>
                    onToggleMarketFreeze(
                      !state.market.marketFrozenForPlayer,
                      state.market.marketFrozenForPlayer
                        ? 'فك تجميد الحساب بعد المراجعة'
                        : 'تجميد مؤقت للاشتباه بتلاعب سعري'
                    )
                  }
                  className={`min-h-[40px] px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 ${
                    state.market.marketFrozenForPlayer
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  <Snowflake className="w-4 h-4" />
                  <span>
                    {state.market.marketFrozenForPlayer
                      ? 'فك تجميد تداول الحساب'
                      : 'تجميد تداول الحساب في السوق'}
                  </span>
                </button>
              )}
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/45 font-bold text-slate-100">
                عروض السوق الخاضعة للرقابة ({state.market.offers.length})
              </div>
              <div className="divide-y divide-slate-800/70">
                {state.market.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="p-3.5 sm:px-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-num font-bold text-amber-300">{offer.id}</span>
                        <span className="font-bold text-slate-100">
                          {MARKET_RESOURCES_META[offer.resource].name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px]">
                          {offer.status}
                        </span>
                        {offer.suspiciousFlag && (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/50 text-rose-300 text-[10px] font-bold">
                            معلّم للمراجعة
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-num">
                        البائع: {offer.sellerName} ({offer.sellerId}) · الكمية: {offer.remainingQty}/{offer.initialQty} · السعر: {offer.unitPriceGems} جوهرة
                      </div>
                    </div>

                    {isFounder && offer.status !== 'admin_cancelled' && (
                      <button
                        type="button"
                        onClick={() =>
                          onReverseMarketOffer(
                            offer.id,
                            'عكس صفقة لمكافحة غسل الجواهر واسترداد المبالغ'
                          )
                        }
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>إلغاء / عكس الصفقة</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Comprehensive Pricing, Payment Methods & Discounts Editor */}
        {tab === 'config' && canViewFinance && (
          <div className="space-y-4 text-xs">
            <div className="glass-panel p-5 rounded-2xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-amber-300">
                    صفحة الأسعار الشاملة ووسائل الدفع والخصومات
                  </h3>
                  <p className="text-slate-400 mt-0.5">
                    عدّل أسعار جميع المنتجات (التسجيل، باقات الجواهر، الاشتراكات، الدروع، التسريع، السوق) وحدد وسائل الدفع المفعلة ونسبة الخصم لكل وسيلة.
                  </p>
                </div>
                {isFounder && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateAdminConfig(
                        configDraft,
                        'تحديث جدول الأسعار ووسائل الدفع والخصومات وإعدادات السوق'
                      )
                    }
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow"
                  >
                    حفظ وتطبيق جميع الأسعار
                  </button>
                )}
              </div>

              {/* 1. Payment Methods & Per-Method Discount */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-sky-300" />
                    <span>وسائل الدفع المتاحة والخصم المخصص لكل وسيلة</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    أدخل نسبة الخصم (%) بجانب أي وسيلة دفع لتخفيض السعر تلقائيًا عند اختيارها في الدفع
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(Object.keys(PAYMENT_METHODS_META) as PaymentMethodId[]).map((mId) => {
                    const meta = PAYMENT_METHODS_META[mId];
                    const pm = configDraft.paymentMethods?.[mId] ?? {
                      id: mId,
                      enabled: true,
                      discountPct: 0,
                    };
                    const sampleAfter = Number(
                      (
                        (configDraft.registrationFeeSar || 200) *
                        (1 - Math.max(0, Math.min(90, pm.discountPct || 0)) / 100)
                      ).toFixed(2)
                    );
                    return (
                      <div
                        key={mId}
                        className={`glass-subpanel p-3.5 rounded-xl border space-y-2.5 ${
                          pm.enabled ? 'border-slate-700/70' : 'border-rose-500/45 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-slate-100">{meta.name}</div>
                            <div className="text-[10px] text-slate-400">{meta.subtitle}</div>
                          </div>
                          <button
                            type="button"
                            disabled={!isFounder}
                            onClick={() =>
                              setConfigDraft((p) => ({
                                ...p,
                                paymentMethods: {
                                  ...p.paymentMethods,
                                  [mId]: {
                                    ...pm,
                                    enabled: !pm.enabled,
                                  },
                                },
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 ${
                              pm.enabled
                                ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                                : 'bg-rose-500/20 border border-rose-400/50 text-rose-300'
                            }`}
                          >
                            {pm.enabled ? 'مفعّلة' : 'متوقفة'}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 font-num">
                          <label className="text-slate-300 flex items-center gap-1.5">
                            <Percent className="w-3.5 h-3.5 text-emerald-300" />
                            <span>خصم الدفع بهذه الوسيلة (%):</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={90}
                              step="0.5"
                              disabled={!isFounder}
                              value={pm.discountPct}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(90, Number(e.target.value) || 0)
                                );
                                setConfigDraft((p) => ({
                                  ...p,
                                  paymentMethods: {
                                    ...p.paymentMethods,
                                    [mId]: {
                                      ...pm,
                                      discountPct: val,
                                    },
                                  },
                                }));
                              }}
                              className="w-24 min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-emerald-300 font-bold text-center"
                            />
                            <span className="text-[11px] text-slate-400">
                              مثال ({configDraft.registrationFeeSar} ر →{' '}
                              <strong className="text-amber-300">{sampleAfter} ر</strong>)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Registration & Subscriptions Pricing */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                <h4 className="font-bold text-slate-100 text-sm">
                  أسعار التسجيل والاشتراكات (بالريال السعودي)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-num">
                  <div>
                    <label className="block text-slate-300 mb-1">رسوم التسجيل (ريال)</label>
                    <input
                      type="number"
                      min={0}
                      disabled={!isFounder}
                      value={configDraft.registrationFeeSar}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          registrationFeeSar: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">المستشار حكيم (ريال)</label>
                    <input
                      type="number"
                      min={0}
                      disabled={!isFounder}
                      value={configDraft.hakimPriceSar}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          hakimPriceSar: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">مدة حكيم (أيام)</label>
                    <input
                      type="number"
                      min={1}
                      disabled={!isFounder}
                      value={configDraft.hakimDurationDays}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          hakimDurationDays: Math.max(1, Number(e.target.value) || 90),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">الباقة الشهرية VIP (ريال)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      disabled={!isFounder}
                      value={configDraft.vipPriceSar}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          vipPriceSar: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-sky-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">الباقة الشهرية VIP ($)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      disabled={!isFounder}
                      value={configDraft.vipPriceUsd}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          vipPriceUsd: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">مدة VIP (أيام)</label>
                    <input
                      type="number"
                      min={1}
                      disabled={!isFounder}
                      value={configDraft.vipDurationDays}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          vipDurationDays: Math.max(1, Number(e.target.value) || 30),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* 3. All 6 Gem Packages Editor */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <Gem className="w-4 h-4 text-amber-300" />
                  <span>أسعار باقات الجواهر ({configDraft.gemPackages.length} باقات)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-num">
                  {configDraft.gemPackages.map((pack, idx) => (
                    <div key={pack.id} className="glass-subpanel p-3 rounded-xl space-y-2">
                      <input
                        type="text"
                        disabled={!isFounder}
                        value={pack.name}
                        onChange={(e) =>
                          setConfigDraft((p) => ({
                            ...p,
                            gemPackages: p.gemPackages.map((g, i) =>
                              i === idx ? { ...g, name: e.target.value } : g
                            ),
                          }))
                        }
                        className="w-full px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">الأساسي</label>
                          <input
                            type="number"
                            disabled={!isFounder}
                            value={pack.baseGems}
                            onChange={(e) =>
                              setConfigDraft((p) => ({
                                ...p,
                                gemPackages: p.gemPackages.map((g, i) =>
                                  i === idx
                                    ? { ...g, baseGems: Math.max(1, Number(e.target.value) || 1) }
                                    : g
                                ),
                              }))
                            }
                            className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">الإضافي</label>
                          <input
                            type="number"
                            disabled={!isFounder}
                            value={pack.bonusGems}
                            onChange={(e) =>
                              setConfigDraft((p) => ({
                                ...p,
                                gemPackages: p.gemPackages.map((g, i) =>
                                  i === idx
                                    ? { ...g, bonusGems: Math.max(0, Number(e.target.value) || 0) }
                                    : g
                                ),
                              }))
                            }
                            className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-sky-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-amber-300 mb-0.5">السعر (ريال)</label>
                          <input
                            type="number"
                            step="0.5"
                            disabled={!isFounder}
                            value={pack.priceSar}
                            onChange={(e) =>
                              setConfigDraft((p) => ({
                                ...p,
                                gemPackages: p.gemPackages.map((g, i) =>
                                  i === idx
                                    ? { ...g, priceSar: Math.max(1, Number(e.target.value) || 1) }
                                    : g
                                ),
                              }))
                            }
                            className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Shields, Buffs, Instant Finish, March Speedup & Speedup Cards (Gems) */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="font-bold text-slate-100 text-sm">
                  أسعار عناصر المتجر بالجواهر (الدروع · التعزيزات · الإنهاء الفوري · بطاقات التسريع)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-num">
                  {SHIELD_PACKAGES.map((pkg) => (
                    <div key={pkg.id} className="glass-subpanel p-2.5 rounded-xl">
                      <label className="block text-[10px] text-sky-300 mb-1">{pkg.name}</label>
                      <input
                        type="number"
                        disabled={!isFounder}
                        value={configDraft.shieldPricesGems[pkg.id]}
                        onChange={(e) =>
                          setConfigDraft((p) => ({
                            ...p,
                            shieldPricesGems: {
                              ...p.shieldPricesGems,
                              [pkg.id]: Math.max(1, Number(e.target.value) || 1),
                            },
                          }))
                        }
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-num">
                  <div>
                    <label className="block text-slate-300 mb-1">تعزيز الهجوم +10% (جوهرة)</label>
                    <input
                      type="number"
                      disabled={!isFounder}
                      value={configDraft.attackBoostGems}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          attackBoostGems: Math.max(1, Number(e.target.value) || 100),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">تعزيز الدفاع +10% (جوهرة)</label>
                    <input
                      type="number"
                      disabled={!isFounder}
                      value={configDraft.defenseBoostGems}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          defenseBoostGems: Math.max(1, Number(e.target.value) || 100),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">الإنهاء الفوري (لكل 3 د)</label>
                    <input
                      type="number"
                      disabled={!isFounder}
                      value={configDraft.instantFinishGemsPerBlock}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          instantFinishGemsPerBlock: Math.max(1, Number(e.target.value) || 100),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">تسريع المسيرة (/دقيقة)</label>
                    <input
                      type="number"
                      disabled={!isFounder}
                      value={configDraft.marchSpeedUpGemsPerMin}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          marchSpeedUpGemsPerMin: Math.max(1, Number(e.target.value) || 50),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-slate-300">أسعار بطاقات التسريع السبعة (بالجواهر):</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-num">
                    {(Object.keys(SPEEDUP_CARDS_META) as SpeedUpTierId[]).map((tier) => (
                      <div key={tier} className="glass-subpanel p-2 rounded-xl">
                        <div className="text-[10px] text-slate-400">{SPEEDUP_CARDS_META[tier].name}</div>
                        <input
                          type="number"
                          disabled={!isFounder}
                          value={configDraft.speedUpGemCosts[tier]}
                          onChange={(e) =>
                            setConfigDraft((p) => ({
                              ...p,
                              speedUpGemCosts: {
                                ...p.speedUpGemCosts,
                                [tier]: Math.max(1, Number(e.target.value) || 1),
                              },
                            }))
                          }
                          className="w-full mt-1 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Market Commission, Trade Points & Resource Price Bounds */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-num">
                  <div>
                    <label className="block text-slate-300 mb-1">عمولة السوق (%)</label>
                    <input
                      type="number"
                      disabled={!isFounder}
                      value={configDraft.marketFeePct}
                      onChange={(e) =>
                        setConfigDraft((p) => ({ ...p, marketFeePct: Number(e.target.value) || 0 }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">معامل نقاط التجارة (/100 جوهرة صافية)</label>
                    <input
                      type="number"
                      disabled={!isFounder}
                      value={configDraft.tradePointsPer100NetGems}
                      onChange={(e) =>
                        setConfigDraft((p) => ({
                          ...p,
                          tradePointsPer100NetGems: Math.max(1, Number(e.target.value) || 80),
                        }))
                      }
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-emerald-300 font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-200">
                    إعدادات منتجات السوق لكل 1,000 وحدة (السعر المرجعي · الحد الأدنى · الحد الأقصى · حالة المنتج):
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-num">
                  {(Object.keys(MARKET_RESOURCES_META) as MarketResourceId[]).map((rId) => {
                    const rb = configDraft.resourcePriceBounds[rId];
                    return (
                      <div
                        key={rId}
                        className={`glass-subpanel p-3 rounded-xl space-y-2 border ${
                          rb.enabled ? 'border-slate-700/60' : 'border-rose-500/50 opacity-85'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-100">
                            {MARKET_RESOURCES_META[rId].name}
                          </span>
                          <button
                            type="button"
                            disabled={!isFounder}
                            onClick={() =>
                              setConfigDraft((p) => ({
                                ...p,
                                resourcePriceBounds: {
                                  ...p.resourcePriceBounds,
                                  [rId]: {
                                    ...p.resourcePriceBounds[rId],
                                    enabled: !p.resourcePriceBounds[rId].enabled,
                                  },
                                },
                              }))
                            }
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              rb.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                            }`}
                          >
                            {rb.enabled ? 'مفعّل' : 'متوقف'}
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] text-amber-300 mb-0.5">
                            السعر المرجعي (/1,000)
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              disabled={!isFounder}
                              value={rb.referencePrice}
                              onChange={(e) => {
                                const ref = Math.max(0.1, Number(e.target.value) || 1);
                                setConfigDraft((p) => ({
                                  ...p,
                                  resourcePriceBounds: {
                                    ...p.resourcePriceBounds,
                                    [rId]: {
                                      ...p.resourcePriceBounds[rId],
                                      referencePrice: ref,
                                    },
                                  },
                                }));
                              }}
                              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                            />
                            {isFounder && (
                              <button
                                type="button"
                                title="ضبط الحدود تلقائيًا 70% – 150% من المرجعي"
                                onClick={() =>
                                  setConfigDraft((p) => {
                                    const ref = p.resourcePriceBounds[rId].referencePrice;
                                    return {
                                      ...p,
                                      resourcePriceBounds: {
                                        ...p.resourcePriceBounds,
                                        [rId]: {
                                          ...p.resourcePriceBounds[rId],
                                          min: Number((ref * 0.7).toFixed(2)),
                                          max: Number((ref * 1.5).toFixed(2)),
                                        },
                                      },
                                    };
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-sky-300 shrink-0"
                              >
                                70–150%
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">الحد الأدنى</label>
                            <input
                              type="number"
                              step="0.1"
                              disabled={!isFounder}
                              value={rb.min}
                              onChange={(e) =>
                                setConfigDraft((p) => ({
                                  ...p,
                                  resourcePriceBounds: {
                                    ...p.resourcePriceBounds,
                                    [rId]: {
                                      ...p.resourcePriceBounds[rId],
                                      min: Number(e.target.value) || 0.1,
                                    },
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">الحد الأقصى</label>
                            <input
                              type="number"
                              step="0.1"
                              disabled={!isFounder}
                              value={rb.max}
                              onChange={(e) =>
                                setConfigDraft((p) => ({
                                  ...p,
                                  resourcePriceBounds: {
                                    ...p.resourcePriceBounds,
                                    [rId]: {
                                      ...p.resourcePriceBounds[rId],
                                      max: Number(e.target.value) || 1,
                                    },
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Admin Audit Logs */}
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/45 font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-300" />
                <span>سجل التدقيق الإداري ({state.adminAuditLogs.length})</span>
              </div>
              <div className="divide-y divide-slate-800/70 max-h-64 overflow-y-auto">
                {state.adminAuditLogs.length === 0 ? (
                  <div className="p-5 text-center text-slate-400">لا توجد تغييرات إدارية مسجلة بعد.</div>
                ) : (
                  state.adminAuditLogs.map((aud) => (
                    <div key={aud.id} className="p-3 flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-bold text-amber-300">{aud.actorName}</span> ·{' '}
                        <span className="font-bold text-slate-100">{aud.action}</span>
                        <div className="text-[11px] text-slate-400">{aud.details}</div>
                      </div>
                      <span className="font-num text-[11px] text-slate-400">
                        {formatKsaDateTime(aud.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Admin Support Desk */}
        {tab === 'tickets' && canManageSupport && (
          <div className="space-y-4 text-xs">
            <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="بحث برقم التذكرة أو اسم اللاعب أو معرّف الحساب..."
                  className="w-full min-h-[40px] pr-9 pl-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                />
              </div>
              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value as typeof ticketStatusFilter)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
              >
                <option value="all">جميع الحالات</option>
                {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {TICKET_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="glass-panel p-6 rounded-2xl text-center text-slate-400">
                لا توجد تذاكر مطابقة لبحثك.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((t) => (
                  <div key={t.id} className="glass-panel p-4 rounded-2xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div>
                        <span className="font-num font-bold text-amber-300">{t.id}</span> ·{' '}
                        <span className="font-bold text-slate-100">{t.subject}</span>
                        <div className="text-[11px] text-slate-400 font-num mt-0.5">
                          {t.playerName} ({t.accountId}) · {t.category}
                        </div>
                      </div>

                      <select
                        value={t.status}
                        onChange={(e) => onUpdateTicketStatus(t.id, e.target.value as TicketStatus)}
                        className="min-h-[36px] px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-sky-200 font-bold"
                      >
                        {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {TICKET_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {t.messages.map((m) => (
                        <div key={m.id} className="glass-subpanel p-2.5 rounded-xl">
                          <span className="font-bold text-sky-300">{m.senderName}: </span>
                          <span className="text-slate-200">{m.text}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={supportReplyMap[t.id] ?? ''}
                        onChange={(e) =>
                          setSupportReplyMap((p) => ({ ...p, [t.id]: e.target.value }))
                        }
                        placeholder="اكتب رد الدعم الفني هنا..."
                        className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const txt = supportReplyMap[t.id] ?? '';
                          if (!txt.trim()) return;
                          onReplySupportTicket(t.id, txt, []);
                          setSupportReplyMap((p) => ({ ...p, [t.id]: '' }));
                        }}
                        className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>إرسال الرد</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Founder-Only Data Backup & Restore + Source/GDD Vault */}
        {tab === 'backups' && isFounder && (
          <div className="space-y-4 text-xs">
            <Suspense
              fallback={
                <div className="glass-panel p-5 rounded-2xl border-amber-500/35 text-slate-300">
                  جارٍ تجهيز خزنة تنزيل ملفات اللعبة والوثيقة الكاملة...
                </div>
              }
            >
              <FounderVaultSection adminConfig={state.adminConfig} />
            </Suspense>

            <div className="glass-panel p-5 rounded-2xl border-emerald-500/40 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                    <HardDriveDownload className="w-4 h-4" />
                    <span>النسخ الاحتياطي لبيانات اللعبة والحسابات (حصري للمؤسس)</span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1">
                    يحفظ هذا القسم لقطات نسخ احتياطية فورية لبيانات التقدم، الحسابات، السجلات المالية، وإعدادات التوازن مع إمكانية التصدير والاستعادة.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  value={backupLabel}
                  onChange={(e) => setBackupLabel(e.target.value)}
                  placeholder="وصف النسخة الاحتياطية (اختياري)..."
                  className="flex-1 min-w-[200px] min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    onCreateBackupSnapshot(backupLabel);
                    setBackupLabel('');
                    setBackupFeedback('تم إنشاء وحفظ النسخة الاحتياطية لبيانات اللعبة.');
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
                >
                  <Archive className="w-4 h-4" />
                  <span>إنشاء نسخة احتياطية الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(state, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ENGINORA_DATA_BACKUP_${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير ملف بيانات (JSON)</span>
                </button>
                <label className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-200 font-bold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>استيراد واستعادة بيانات</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        onRestoreBackupSnapshot(String(reader.result ?? ''));
                        setBackupFeedback(`تمت استعادة البيانات من الملف "${file.name}".`);
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {backupFeedback && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/45 text-emerald-200 font-semibold">
                  {backupFeedback}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/45 flex items-center justify-between">
                <span className="font-bold text-slate-100">
                  سجل النسخ الاحتياطية المحفوظة ({backupSnapshots.length})
                </span>
                <span className="text-[11px] text-slate-400">الحد الأقصى 15 نسخة محفوظة</span>
              </div>

              {backupSnapshots.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  لم يتم إنشاء أي نسخة احتياطية بعد. اضغط «إنشاء نسخة احتياطية الآن» لحفظ لقطة فورية للبيانات.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/70">
                  {backupSnapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3.5 sm:px-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-num font-bold text-amber-300">{snap.id}</span>
                          <span className="font-bold text-slate-100">{snap.label}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-num">
                          القائد: {snap.commanderName} · الإيراد المعتمد: {formatNumber(snap.totalSarApproved)} ريال · {formatKsaDateTime(snap.createdAt)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreBackupSnapshot(snap.payloadJson);
                            setBackupFeedback(`تمت استعادة النسخة الاحتياطية ${snap.id}.`);
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استعادة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBackupSnapshot(snap.id)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {receiptLightbox && (
          <div
            onClick={() => setReceiptLightbox(null)}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          >
            <img
              src={receiptLightbox}
              alt="إيصال التحويل"
              className="max-h-[82dvh] rounded-xl border border-slate-700"
            />
          </div>
        )}
      </div>
    </div>
  );
};

