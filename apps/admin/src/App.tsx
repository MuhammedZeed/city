import { useCallback, useEffect, useState } from 'react';
import { Clock, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  AdminBackupSnapshot,
  AdminConfig,
  AdminRole,
  GameState,
  TicketAttachment,
  TicketStatus,
  formatKsaTime,
  loadSavedState,
  replyToSupportTicket,
  saveGameState,
} from '@enginora/shared';
import { AdminDashboardView } from './components/AdminDashboardView';
import {
  adminReverseMarketOfferOrTrade,
  adminReviewPaymentOrder,
  adminReviewPlayerRegistration,
  adminToggleMarketFreeze,
  createAdminBackupSnapshot,
  deleteAdminBackupSnapshot,
  listAdminBackupSnapshots,
  restoreGameStateFromJson,
  updateAdminConfig,
  updateSupportTicketStatus,
} from './engine/adminEngine';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

const GAME_APP_URL = import.meta.env.VITE_GAME_APP_URL || '';

export default function App() {
  const [state, setState] = useState<GameState>(() => loadSavedState());
  const [now, setNow] = useState<number>(() => Date.now());
  const [adminRole, setAdminRole] = useState<AdminRole>('founder');
  const [backupSnapshots, setBackupSnapshots] = useState<AdminBackupSnapshot[]>(
    () => listAdminBackupSnapshots('founder')
  );
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    setBackupSnapshots(listAdminBackupSnapshots(adminRole));
  }, [adminRole]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    saveGameState(state);
  }, [state]);

  const pushToast = useCallback(
    (text: string, tone: ToastMessage['tone'] = 'info') => {
      const id = Date.now();
      setToast({ id, text, tone });
      window.setTimeout(() => {
        setToast((curr) => (curr && curr.id === id ? null : curr));
      }, 3600);
    },
    []
  );

  const handleAdminReviewPaymentOrder = (
    orderId: string,
    decision: 'approve' | 'reject' | 'refund',
    note: string
  ) => {
    const res = adminReviewPaymentOrder(
      state,
      orderId,
      decision,
      adminRole,
      note,
      Date.now()
    );
    if (res.error) {
      pushToast(res.error, 'error');
      return;
    }
    setState(res.state);
    pushToast('تم تنفيذ قرار المراجعة وتقييده في السجل المالي.', 'success');
  };

  const handleAdminReviewRegistration = (
    decision: 'approve' | 'reject',
    note: string
  ) => {
    const res = adminReviewPlayerRegistration(
      state,
      decision,
      adminRole,
      note,
      Date.now()
    );
    if (res.error) {
      pushToast(res.error, 'error');
      return;
    }
    setState(res.state);
    pushToast(
      decision === 'approve'
        ? 'تم اعتماد تسجيل اللاعب وفاتورة التفعيل بنجاح.'
        : 'تم رفض طلب التسجيل وتحديث حالته.',
      decision === 'approve' ? 'success' : 'info'
    );
  };

  const handleAdminReverseMarketOffer = (offerId: string, reason: string) => {
    const res = adminReverseMarketOfferOrTrade(
      state,
      offerId,
      adminRole,
      reason,
      Date.now()
    );
    if (res.error) {
      pushToast(res.error, 'error');
      return;
    }
    setState(res.state);
    pushToast('تم إلغاء وعكس العرض لحماية نزاهة السوق.', 'success');
  };

  const handleAdminToggleMarketFreeze = (freeze: boolean, reason: string) => {
    const res = adminToggleMarketFreeze(
      state,
      freeze,
      adminRole,
      reason,
      Date.now()
    );
    if (res.error) {
      pushToast(res.error, 'error');
      return;
    }
    setState(res.state);
    pushToast(
      freeze ? 'تم تجميد تداول الحساب مؤقتًا.' : 'تم فك تجميد الحساب في السوق.',
      'info'
    );
  };

  const handleUpdateAdminConfig = (
    patch: Partial<AdminConfig>,
    summary: string
  ) => {
    const res = updateAdminConfig(state, patch, adminRole, summary, Date.now());
    if (res.error) {
      pushToast(res.error, 'error');
      return;
    }
    setState(res.state);
    pushToast('تم حفظ الإعدادات وتسجيل التعديل في سجل التدقيق.', 'success');
  };

  const handleAdminReplyTicket = (
    ticketId: string,
    text: string,
    attachments: TicketAttachment[]
  ) => {
    if (adminRole !== 'founder' && adminRole !== 'support') {
      pushToast('الرد على تذاكر الدعم متاح للمؤسس أو فريق الدعم فقط.', 'error');
      return;
    }
    const res = replyToSupportTicket(
      state,
      ticketId,
      'support',
      text,
      attachments,
      Date.now()
    );
    if (res.error) {
      pushToast(res.error, 'error');
      return;
    }
    setState(res.state);
    pushToast('تم إرسال رد الدعم الفني للاعب.', 'success');
  };

  const handleAdminUpdateTicketStatus = (
    ticketId: string,
    status: TicketStatus
  ) => {
    const res = updateSupportTicketStatus(
      state,
      ticketId,
      status,
      adminRole,
      Date.now()
    );
    if (res.error) {
      pushToast(res.error, 'error');
      return;
    }
    setState(res.state);
    pushToast('تم تحديث حالة التذكرة.', 'success');
  };

  const handleCreateBackupSnapshot = (label: string) => {
    const res = createAdminBackupSnapshot(state, adminRole, label, Date.now());
    if (res.error) {
      pushToast(res.error, 'error');
      return;
    }
    setState(res.state);
    setBackupSnapshots(res.list);
    pushToast('تم إنشاء نسخة احتياطية لبيانات اللعبة بنجاح.', 'success');
  };

  const handleRestoreBackupSnapshot = (payloadJson: string) => {
    const res = restoreGameStateFromJson(payloadJson, adminRole, Date.now());
    if (res.error || !res.state) {
      pushToast(res.error ?? 'تعذر استعادة النسخة الاحتياطية.', 'error');
      return;
    }
    setState(res.state);
    pushToast('تمت استعادة بيانات اللعبة من النسخة الاحتياطية بنجاح.', 'success');
  };

  const handleDeleteBackupSnapshot = (snapshotId: string) => {
    if (adminRole !== 'founder') {
      pushToast('حذف النسخ الاحتياطية حصري للمؤسس فقط.', 'error');
      return;
    }
    const updated = deleteAdminBackupSnapshot(snapshotId, adminRole);
    setBackupSnapshots(updated);
    pushToast('تم حذف النسخة الاحتياطية من السجل المحلي.', 'info');
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
              ENGINORA CITY ADMIN — لوحة الإدارة المستقلة
            </div>
            <div className="text-[11px] text-slate-400">
              تطبيق مستقل لإدارة المنصة (المرحلة 1: فصل كامل · سيتم ربط الخادم و D1 في المرحلة 2)
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
        <AdminDashboardView
          state={state}
          now={now}
          adminRole={adminRole}
          backupSnapshots={backupSnapshots}
          onChangeAdminRole={setAdminRole}
          onReviewPaymentOrder={handleAdminReviewPaymentOrder}
          onReviewRegistration={handleAdminReviewRegistration}
          onCreateBackupSnapshot={handleCreateBackupSnapshot}
          onRestoreBackupSnapshot={handleRestoreBackupSnapshot}
          onDeleteBackupSnapshot={handleDeleteBackupSnapshot}
          onReverseMarketOffer={handleAdminReverseMarketOffer}
          onToggleMarketFreeze={handleAdminToggleMarketFreeze}
          onUpdateAdminConfig={handleUpdateAdminConfig}
          onReplySupportTicket={handleAdminReplyTicket}
          onUpdateTicketStatus={handleAdminUpdateTicketStatus}
        />

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
