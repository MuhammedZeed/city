import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  API_ENDPOINTS,
  AdminBackupRestoreResponse,
  AdminBackupSnapshot,
  AdminBackupsResponse,
  AdminConfig,
  AdminConfigUpdateResponse,
  AdminCredentialsResponse,
  AdminLoginResponse,
  AdminOverviewResponse,
  AdminPlayerRecord,
  AdminPlayerStateUpdateResponse,
  AdminResetPasswordResponse,
  AdminRole,
  AdminRoleCredentialStatus,
  ApiClientError,
  DEFAULT_ADMIN_CONFIG,
  TicketAttachment,
  TicketStatus,
  apiRequest,
  cloneAdminConfig,
  formatKsaTime,
  replyToSupportTicket,
} from '@enginora/shared';
import { AdminDashboardView } from './components/AdminDashboardView';
import {
  AdminPlayerAccountPatch,
  adminReverseMarketOfferOrTrade,
  adminReviewPaymentOrder,
  adminReviewPlayerRegistration,
  adminToggleMarketFreeze,
  adminUpdatePlayerAccount,
  updateAdminConfig,
  updateSupportTicketStatus,
} from './engine/adminEngine';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

const GAME_APP_URL =
  import.meta.env.VITE_GAME_APP_URL || 'https://enginora-city-game.pages.dev';

const ROLE_OPTIONS: { id: AdminRole; title: string; subtitle: string }[] = [
  {
    id: 'founder',
    title: 'المؤسس (Founder)',
    subtitle: 'صلاحية كاملة: السيرفرات، المدفوعات، الأسعار، كلمات المرور، والنسخ الاحتياطي',
  },
  {
    id: 'partner',
    title: 'الشريك (Partner)',
    subtitle: 'اطلاع للقراءة فقط على التقارير المالية والمدفوعات واللاعبين',
  },
  {
    id: 'support',
    title: 'الدعم الفني (Support)',
    subtitle: 'إدارة والرد على تذاكر اللاعبين فقط دون الوصول للبيانات المالية',
  },
];

export default function App() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole>('founder');
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(() =>
    cloneAdminConfig(DEFAULT_ADMIN_CONFIG)
  );
  const [players, setPlayers] = useState<AdminPlayerRecord[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [selectedBackupServerId, setSelectedBackupServerId] = useState<string>(
    DEFAULT_ADMIN_CONFIG.servers[0]?.id ?? 'ALL'
  );
  const [backupSnapshots, setBackupSnapshots] = useState<AdminBackupSnapshot[]>([]);
  const [roleCredentials, setRoleCredentials] = useState<AdminRoleCredentialStatus[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Login gate state
  const [loginRole, setLoginRole] = useState<AdminRole>('founder');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  tokenRef.current = adminToken;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pushToast = useCallback(
    (text: string, tone: ToastMessage['tone'] = 'info') => {
      const id = Date.now();
      setToast({ id, text, tone });
      window.setTimeout(() => {
        setToast((curr) => (curr && curr.id === id ? null : curr));
      }, 3800);
    },
    []
  );

  const handleUnauthorized = useCallback(
    (msg?: string) => {
      tokenRef.current = null;
      setAdminToken(null);
      setPlayers([]);
      setBackupSnapshots([]);
      setRoleCredentials([]);
      setLoginPassword('');
      setLoginError(msg || 'انتهت الجلسة الإدارية. يرجى تسجيل الدخول مرة أخرى.');
    },
    []
  );

  const fetchOverview = useCallback(
    async (explicitToken?: string, silent = false) => {
      const token = explicitToken ?? tokenRef.current;
      if (!token) return;
      if (!silent) setBusyAction(true);
      try {
        const res = await apiRequest<AdminOverviewResponse>(API_ENDPOINTS.adminOverview, {
          token,
        });
        setAdminRole(res.role);
        setAdminConfig(res.adminConfig);
        setPlayers(res.players);
        setSelectedPlayerId((prev) => {
          if (prev && res.players.some((p) => p.accountId === prev)) return prev;
          return res.players[0]?.accountId ?? '';
        });
        setSelectedBackupServerId((prev) => {
          if (prev === 'ALL') return 'ALL';
          if (prev && res.adminConfig.servers.some((s) => s.id === prev)) return prev;
          return res.adminConfig.servers[0]?.id ?? 'ALL';
        });
        setBackupSnapshots(Array.isArray(res.backups) ? res.backups : []);
        if (res.role === 'founder') {
          try {
            const credRes = await apiRequest<AdminCredentialsResponse>(
              API_ENDPOINTS.adminCredentials,
              { token }
            );
            setRoleCredentials(Array.isArray(credRes.credentials) ? credRes.credentials : []);
          } catch {
            // Keep overview alive even if credentials fetch is momentarily unavailable
          }
        } else {
          setRoleCredentials([]);
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          handleUnauthorized(err.message);
        } else if (!silent) {
          pushToast(
            err instanceof Error ? err.message : 'تعذر تحميل بيانات لوحة الإدارة من الخادم.',
            'error'
          );
        }
      } finally {
        if (!silent) setBusyAction(false);
      }
    },
    [handleUnauthorized, pushToast]
  );

  // Periodic background refresh from D1 every 15s while authenticated
  useEffect(() => {
    if (!adminToken) return;
    const timer = window.setInterval(() => {
      void fetchOverview(undefined, true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [adminToken, fetchOverview]);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginPassword) {
      setLoginError('يرجى إدخال كلمة المرور الإدارية.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await apiRequest<AdminLoginResponse>(API_ENDPOINTS.adminLogin, {
        method: 'POST',
        body: {
          password: loginPassword,
          role: loginRole,
        },
      });
      tokenRef.current = res.token;
      setAdminToken(res.token);
      setAdminRole(res.role);
      setLoginPassword('');
      await fetchOverview(res.token, false);
      pushToast('تم فتح الجلسة الإدارية والاتصال بقاعدة D1 بنجاح.', 'success');
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : 'تعذر التحقق من كلمة المرور الإدارية.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = useCallback(async () => {
    const token = tokenRef.current;
    tokenRef.current = null;
    setAdminToken(null);
    setPlayers([]);
    setBackupSnapshots([]);
    setRoleCredentials([]);
    setSelectedPlayerId('');
    setLoginPassword('');
    setLoginError(null);
    if (token) {
      try {
        await apiRequest(API_ENDPOINTS.adminLogout, {
          method: 'POST',
          token,
        });
      } catch {
        // Ignore network errors during logout
      }
    }
    pushToast('تم تسجيل الخروج من لوحة الإدارة.', 'info');
  }, [pushToast]);

  const persistPlayerMutation = useCallback(
    async (
      accountId: string,
      mutator: (player: AdminPlayerRecord) => {
        state: AdminPlayerRecord['state'];
        error?: string;
      },
      successMessage: string
    ): Promise<boolean> => {
      const token = tokenRef.current;
      if (!token) {
        handleUnauthorized();
        return false;
      }

      const target = players.find((p) => p.accountId === accountId);
      if (!target) {
        pushToast('الحساب المستهدف غير موجود في القائمة الحالية.', 'error');
        return false;
      }

      const mutation = mutator(target);
      if (mutation.error) {
        pushToast(mutation.error, 'error');
        return false;
      }

      setBusyAction(true);
      try {
        const res = await apiRequest<AdminPlayerStateUpdateResponse>(
          API_ENDPOINTS.adminPlayerState(accountId),
          {
            method: 'POST',
            token,
            body: { state: mutation.state },
          }
        );

        setAdminConfig(res.adminConfig);
        setPlayers((prev) =>
          prev.map((p) =>
            p.accountId === accountId
              ? {
                  ...p,
                  commanderName: res.state.commanderName,
                  registrationStatus: res.state.registration?.status ?? p.registrationStatus,
                  selectedServerId: res.state.selectedServerId ?? p.selectedServerId,
                  revision: res.revision,
                  updatedAt: res.serverTimeUtc,
                  state: res.state,
                }
              : p
          )
        );
        pushToast(successMessage, 'success');
        return true;
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          handleUnauthorized(err.message);
        } else {
          pushToast(
            err instanceof Error ? err.message : 'تعذر حفظ التعديل في Cloudflare D1.',
            'error'
          );
        }
        return false;
      } finally {
        setBusyAction(false);
      }
    },
    [players, handleUnauthorized, pushToast]
  );

  const handleAdminReviewPaymentOrder = (
    accountId: string,
    orderId: string,
    decision: 'approve' | 'reject' | 'refund',
    note: string
  ) => {
    void persistPlayerMutation(
      accountId,
      (player) =>
        adminReviewPaymentOrder(
          player.state,
          orderId,
          decision,
          adminRole,
          note,
          Date.now()
        ),
      'تم تنفيذ قرار المراجعة وحفظه في السجل المالي بقاعدة D1.'
    );
  };

  const handleAdminReviewRegistration = (
    accountId: string,
    decision: 'approve' | 'reject',
    note: string
  ) => {
    void persistPlayerMutation(
      accountId,
      (player) =>
        adminReviewPlayerRegistration(
          player.state,
          decision,
          adminRole,
          note,
          Date.now()
        ),
      decision === 'approve'
        ? 'تم اعتماد تسجيل اللاعب وفاتورة التفعيل في D1 بنجاح.'
        : 'تم رفض طلب التسجيل وتحديث حالته في D1.'
    );
  };

  const handleAdminReverseMarketOffer = (
    accountId: string,
    offerId: string,
    reason: string
  ) => {
    void persistPlayerMutation(
      accountId,
      (player) =>
        adminReverseMarketOfferOrTrade(
          player.state,
          offerId,
          adminRole,
          reason,
          Date.now()
        ),
      'تم إلغاء وعكس العرض لحماية نزاهة السوق.'
    );
  };

  const handleAdminToggleMarketFreeze = (
    accountId: string,
    freeze: boolean,
    reason: string
  ) => {
    void persistPlayerMutation(
      accountId,
      (player) =>
        adminToggleMarketFreeze(
          player.state,
          freeze,
          adminRole,
          reason,
          Date.now()
        ),
      freeze ? 'تم تجميد تداول الحساب مؤقتًا في D1.' : 'تم فك تجميد الحساب في السوق.'
    );
  };

  const handleAdminUpdatePlayerAccount = (
    accountId: string,
    patch: AdminPlayerAccountPatch
  ): Promise<boolean> => {
    return persistPlayerMutation(
      accountId,
      (player) =>
        adminUpdatePlayerAccount(player.state, patch, adminRole, Date.now()),
      'تم حفظ التعديلات الشاملة على حساب اللاعب في Cloudflare D1 بنجاح.'
    );
  };

  const handleUpdateAdminConfig = async (
    patch: Partial<AdminConfig>,
    summary: string
  ): Promise<boolean> => {
    const token = tokenRef.current;
    if (!token) {
      handleUnauthorized();
      return false;
    }

    const baseState = players[0]?.state;
    if (baseState) {
      const check = updateAdminConfig(
        { ...baseState, adminConfig },
        patch,
        adminRole,
        summary,
        Date.now()
      );
      if (check.error) {
        pushToast(check.error, 'error');
        return false;
      }
    } else if (adminRole !== 'founder') {
      pushToast('تعديل الأسعار أو السيرفرات أو الإعدادات العامة حصري للمؤسس.', 'error');
      return false;
    }

    const nextConfig: AdminConfig = {
      ...adminConfig,
      ...patch,
    };

    setBusyAction(true);
    try {
      const res = await apiRequest<AdminConfigUpdateResponse>(API_ENDPOINTS.adminConfig, {
        method: 'PUT',
        token,
        body: { adminConfig: nextConfig },
      });
      setAdminConfig(res.adminConfig);
      setPlayers((prev) =>
        prev.map((p) => ({
          ...p,
          state: { ...p.state, adminConfig: res.adminConfig },
        }))
      );
      pushToast('تم حفظ الإعدادات وتحديث جميع السيرفرات والأسعار في D1.', 'success');
      return true;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        handleUnauthorized(err.message);
      } else {
        pushToast(
          err instanceof Error ? err.message : 'تعذر حفظ الإعدادات العامة في الخادم.',
          'error'
        );
      }
      return false;
    } finally {
      setBusyAction(false);
    }
  };

  const handleAdminReplyTicket = (
    accountId: string,
    ticketId: string,
    text: string,
    attachments: TicketAttachment[]
  ) => {
    if (adminRole !== 'founder' && adminRole !== 'support') {
      pushToast('الرد على تذاكر الدعم متاح للمؤسس أو فريق الدعم فقط.', 'error');
      return;
    }
    void persistPlayerMutation(
      accountId,
      (player) =>
        replyToSupportTicket(
          player.state,
          ticketId,
          'support',
          text,
          attachments,
          Date.now()
        ),
      'تم إرسال رد الدعم الفني وحفظه في D1.'
    );
  };

  const handleAdminUpdateTicketStatus = (
    accountId: string,
    ticketId: string,
    status: TicketStatus
  ) => {
    void persistPlayerMutation(
      accountId,
      (player) =>
        updateSupportTicketStatus(
          player.state,
          ticketId,
          status,
          adminRole,
          Date.now()
        ),
      'تم تحديث حالة التذكرة في D1.'
    );
  };

  const handleResetPlayerPassword = async (
    accountId: string,
    newPassword: string
  ): Promise<{ error?: string }> => {
    const token = tokenRef.current;
    if (!token) {
      handleUnauthorized();
      return { error: 'انتهت الجلسة الإدارية.' };
    }
    setBusyAction(true);
    try {
      const res = await apiRequest<AdminResetPasswordResponse>(
        API_ENDPOINTS.adminPlayerPassword(accountId),
        {
          method: 'POST',
          token,
          body: { newPassword },
        }
      );
      pushToast(res.message || 'تم تحديث كلمة مرور اللاعب في D1.', 'success');
      return {};
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        handleUnauthorized(err.message);
      }
      const message =
        err instanceof Error ? err.message : 'تعذر تحديث كلمة مرور اللاعب.';
      pushToast(message, 'error');
      return { error: message };
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveRoleCredential = async (
    targetRole: AdminRole,
    newPassword: string
  ): Promise<{ error?: string }> => {
    const token = tokenRef.current;
    if (!token) {
      handleUnauthorized();
      return { error: 'انتهت الجلسة الإدارية.' };
    }
    setBusyAction(true);
    try {
      const res = await apiRequest<AdminCredentialsResponse>(
        API_ENDPOINTS.adminCredentials,
        {
          method: 'POST',
          token,
          body: { role: targetRole, newPassword },
        }
      );
      setRoleCredentials(res.credentials);
      pushToast(
        targetRole === 'founder'
          ? 'تم تحديث كلمة مرور المؤسس وإنهاء الجلسات الأخرى بنجاح.'
          : 'تم تعيين كلمة مرور مستقلة للصلاحية وإنهاء جلساتها السابقة بنجاح.',
        'success'
      );
      return {};
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        handleUnauthorized(err.message);
      }
      const message =
        err instanceof Error ? err.message : 'تعذر تحديث كلمة مرور الصلاحية.';
      pushToast(message, 'error');
      return { error: message };
    } finally {
      setBusyAction(false);
    }
  };

  const handleResetRoleCredential = async (
    targetRole: AdminRole
  ): Promise<{ error?: string }> => {
    const token = tokenRef.current;
    if (!token) {
      handleUnauthorized();
      return { error: 'انتهت الجلسة الإدارية.' };
    }
    setBusyAction(true);
    try {
      const res = await apiRequest<AdminCredentialsResponse>(
        API_ENDPOINTS.adminCredentials,
        {
          method: 'POST',
          token,
          body: { role: targetRole, resetToEnv: true },
        }
      );
      setRoleCredentials(res.credentials);
      pushToast('تمت إعادة ضبط كلمة المرور للاعتماد على متغير الخادم (Secret).', 'info');
      return {};
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        handleUnauthorized(err.message);
      }
      const message =
        err instanceof Error ? err.message : 'تعذر إعادة ضبط كلمة مرور الصلاحية.';
      pushToast(message, 'error');
      return { error: message };
    } finally {
      setBusyAction(false);
    }
  };

  const handleCreateBackupSnapshot = async (
    label: string,
    serverId: string
  ) => {
    const token = tokenRef.current;
    if (!token) {
      handleUnauthorized();
      return;
    }

    setBusyAction(true);
    try {
      const res = await apiRequest<AdminBackupsResponse>(API_ENDPOINTS.adminBackups, {
        method: 'POST',
        token,
        body: {
          serverId: serverId || 'ALL',
          label: label.trim(),
          createdBy: 'المؤسس (Founder)',
        },
      });
      setBackupSnapshots(res.backups);
      pushToast('تم إنشاء نسخة احتياطية كاملة للسيرفر وحفظها في قاعدة D1 بنجاح.', 'success');
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        handleUnauthorized(err.message);
      } else {
        pushToast(
          err instanceof Error ? err.message : 'تعذر حفظ النسخة الاحتياطية في D1.',
          'error'
        );
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleRestoreBackupSnapshot = async (opts: {
    backupId?: string;
    payloadJson?: string;
  }): Promise<boolean> => {
    if (adminRole !== 'founder') {
      pushToast('استعادة النسخ الاحتياطية حصرية لحساب المؤسس (Founder).', 'error');
      return false;
    }
    const token = tokenRef.current;
    if (!token) {
      handleUnauthorized();
      return false;
    }
    setBusyAction(true);
    try {
      const res = await apiRequest<AdminBackupRestoreResponse>(
        API_ENDPOINTS.adminBackupRestore,
        {
          method: 'POST',
          token,
          body: opts,
        }
      );
      setAdminConfig(res.adminConfig);
      setPlayers(res.players);
      setSelectedPlayerId((prev) => {
        if (prev && res.players.some((p) => p.accountId === prev)) return prev;
        return res.players[0]?.accountId ?? '';
      });
      pushToast(
        `تمت استعادة السيرفر "${res.serverName}" بالكامل (${res.restoredPlayersCount} لاعب) إلى D1 بنجاح.`,
        'success'
      );
      return true;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        handleUnauthorized(err.message);
      } else {
        pushToast(
          err instanceof Error ? err.message : 'تعذر استعادة النسخة الاحتياطية في D1.',
          'error'
        );
      }
      return false;
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteBackupSnapshot = async (snapshotId: string) => {
    if (adminRole !== 'founder') {
      pushToast('حذف النسخ الاحتياطية حصري للمؤسس فقط.', 'error');
      return;
    }
    const token = tokenRef.current;
    if (!token) {
      handleUnauthorized();
      return;
    }
    setBusyAction(true);
    try {
      const res = await apiRequest<AdminBackupsResponse>(
        API_ENDPOINTS.adminBackupDelete(snapshotId),
        {
          method: 'DELETE',
          token,
        }
      );
      setBackupSnapshots(res.backups);
      pushToast('تم حذف النسخة الاحتياطية من قاعدة D1.', 'info');
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        handleUnauthorized(err.message);
      } else {
        pushToast(
          err instanceof Error ? err.message : 'تعذر حذف النسخة الاحتياطية.',
          'error'
        );
      }
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#060B17] text-slate-100">
      <header className="w-full bg-[#090F1E]/95 backdrop-blur-md border-b border-amber-500/35 px-3.5 sm:px-6 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/55 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold text-amber-300">
              ENGINORA CITY ADMIN — لوحة الإدارة السحابية (D1)
            </div>
            <div className="text-[11px] text-slate-400">
              إدارة متصلة مباشرة مع Cloudflare Workers وقاعدة بيانات Cloudflare D1
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-num">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>{formatKsaTime(now)} UTC</span>
          </div>

          {GAME_APP_URL && (
            <a
              href={GAME_APP_URL}
              target="_blank"
              rel="noreferrer"
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>فتح رابط اللعبة المستقل</span>
            </a>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden relative">
        {!adminToken ? (
          <div className="h-full overflow-y-auto flex items-center justify-center p-4 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.10),transparent_45%)]">
            <form
              onSubmit={handleAdminLoginSubmit}
              className="w-full max-w-md glass-panel p-6 rounded-2xl border border-amber-500/40 space-y-5 text-xs shadow-2xl"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-amber-300">
                    بوابة الدخول الإداري الموثقة
                  </h1>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    اختر الدور الوظيفي وأدخل كلمة المرور المستقلة الخاصة بهذه الصلاحية للوصول إلى قاعدة D1
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-200">
                  الصلاحية المطلوبة
                </label>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLoginRole(opt.id)}
                      className={`w-full text-right p-3 rounded-xl border transition-colors ${
                        loginRole === opt.id
                          ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                          : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{opt.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-200">
                  كلمة مرور{' '}
                  {ROLE_OPTIONS.find((opt) => opt.id === loginRole)?.title ?? 'الدخول الإداري'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="أدخل كلمة مرور هذه الصلاحية..."
                    className="w-full min-h-[44px] pr-9 pl-10 py-2 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    title={showLoginPassword ? 'إخفاء' : 'إظهار'}
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 font-semibold">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm shadow-lg transition-colors"
              >
                {loginLoading ? 'جارٍ التحقق وفتح الجلسة...' : 'دخول إلى لوحة الإدارة'}
              </button>
            </form>
          </div>
        ) : (
          <AdminDashboardView
            adminToken={adminToken}
            adminConfig={adminConfig}
            players={players}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={setSelectedPlayerId}
            selectedBackupServerId={selectedBackupServerId}
            onSelectBackupServer={setSelectedBackupServerId}
            roleCredentials={roleCredentials}
            onSaveRoleCredential={handleSaveRoleCredential}
            onResetRoleCredential={handleResetRoleCredential}
            now={now}
            adminRole={adminRole}
            backupSnapshots={backupSnapshots}
            busyAction={busyAction}
            onLogout={handleLogout}
            onRefreshOverview={() => void fetchOverview(undefined, false)}
            onReviewPaymentOrder={handleAdminReviewPaymentOrder}
            onReviewRegistration={handleAdminReviewRegistration}
            onUpdatePlayerAccount={handleAdminUpdatePlayerAccount}
            onResetPlayerPassword={handleResetPlayerPassword}
            onCreateBackupSnapshot={handleCreateBackupSnapshot}
            onRestoreBackupSnapshot={handleRestoreBackupSnapshot}
            onDeleteBackupSnapshot={handleDeleteBackupSnapshot}
            onReverseMarketOffer={handleAdminReverseMarketOffer}
            onToggleMarketFreeze={handleAdminToggleMarketFreeze}
            onUpdateAdminConfig={handleUpdateAdminConfig}
            onReplySupportTicket={handleAdminReplyTicket}
            onUpdateTicketStatus={handleAdminUpdateTicketStatus}
            onEnterGameAsAdmin={
              GAME_APP_URL
                ? () => {
                    window.open(GAME_APP_URL, '_blank', 'noopener,noreferrer');
                  }
                : undefined
            }
          />
        )}

        {toast && (
          <div
            role="status"
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] text-center px-4 py-2.5 rounded-xl border shadow-2xl text-xs font-bold ${
              toast.tone === 'error'
                ? 'bg-rose-950/95 border-rose-500/60 text-rose-100'
                : toast.tone === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100'
                  : 'bg-slate-900/95 border-amber-500/50 text-amber-200'
            }`}
          >
            {toast.text}
          </div>
        )}
      </main>
    </div>
  );
}
