import { useCallback, useEffect, useState } from 'react';
import type { GameState, PaymentOrder } from '@enginora/shared';
import {
  adminReviewPaymentOrder,
  adminReviewPlayerRegistration,
} from './engine/adminEngine';

const DEFAULT_API_BASE = 'https://enginora-city-api.mohastore32.workers.dev';
const API_BASE = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE
).replace(/\/+$/, '');
const TOKEN_KEY = 'enginora_admin_token_v1';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AdminPlayer {
  accountId: string;
  commanderName: string;
  email: string | null;
  phone: string | null;
  registrationStatus: string;
  selectedServerId: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  state: any;
}

async function api(
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  token: string | null,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    const ok = res.ok && data?.ok !== false;
    return { ok, status: res.status, data, error: ok ? undefined : data?.error || data?.message || 'خطأ غير متوقع' };
  } catch {
    return { ok: false, status: 0, data: {}, error: 'تعذر الاتصال بالخادم.' };
  }
}

function normalizeState(raw: any): GameState {
  return {
    ...raw,
    registration: raw.registration ?? { status: 'unregistered' },
    paymentOrders: Array.isArray(raw.paymentOrders) ? raw.paymentOrders : [],
    financialLogs: Array.isArray(raw.financialLogs) ? raw.financialLogs : [],
    adminAuditLogs: Array.isArray(raw.adminAuditLogs) ? raw.adminAuditLogs : [],
  } as GameState;
}

function ReceiptImage({
  id,
  token,
  onZoom,
}: {
  id: string;
  token: string;
  onZoom: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/receipts/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('bad');
        const blob = await res.blob();
        if (cancelled) return;
        revoked = URL.createObjectURL(blob);
        setUrl(revoked);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id, token]);
  if (failed) return <p className="text-rose-300 text-xs">تعذر تحميل صورة الفاتورة.</p>;
  if (!url) return <p className="text-slate-400 text-xs">جارٍ تحميل الفاتورة...</p>;
  return (
    <img
      src={url}
      alt="الفاتورة"
      onClick={() => onZoom(url)}
      className="max-h-40 rounded-lg border border-slate-700 cursor-zoom-in"
    />
  );
}

const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleString('ar-EG') : '—');

export default function ApprovalsApp() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [password, setPassword] = useState('');
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [tab, setTab] = useState<'requests' | 'players' | 'servers'>('requests');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});

  const logout = useCallback(() => {
    try {
      window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    setToken(null);
    setPlayers([]);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const r = await api('/api/admin/overview', 'GET', token);
    setBusy(false);
    if (!r.ok) {
      if (r.status === 401) logout();
      setMsg(r.error ?? 'تعذر تحميل البيانات.');
      return;
    }
    setPlayers(r.data.players ?? []);
    setConfig(r.data.adminConfig ?? null);
  }, [token, logout]);

  useEffect(() => {
    void load();
  }, [load]);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await api('/api/admin/login', 'POST', null, { password, role: 'founder' });
    setBusy(false);
    if (!r.ok || !r.data.token) {
      setMsg(r.error ?? 'تعذر تسجيل الدخول.');
      return;
    }
    try {
      window.sessionStorage.setItem(TOKEN_KEY, r.data.token);
    } catch {
      // ignore
    }
    setPassword('');
    setToken(r.data.token);
  };

  const review = async (
    p: AdminPlayer,
    kind: 'registration' | 'order',
    decision: 'approve' | 'reject',
    orderId?: string
  ) => {
    if (!token) return;
    const key = `${p.accountId}:${orderId ?? 'reg'}`;
    const base = normalizeState(p.state);
    const note = notes[key] ?? '';
    const res =
      kind === 'registration'
        ? adminReviewPlayerRegistration(base, decision, 'founder', note, Date.now())
        : adminReviewPaymentOrder(base, orderId ?? '', decision, 'founder', note, Date.now());
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setBusy(true);
    const r = await api(`/api/admin/players/${encodeURIComponent(p.accountId)}/state`, 'POST', token, {
      state: res.state,
    });
    setBusy(false);
    setMsg(r.ok ? 'تم الحفظ بنجاح.' : r.error ?? 'تعذر الحفظ.');
    if (r.ok) await load();
  };

  const resetPassword = async (p: AdminPlayer) => {
    if (!token) return;
    const newPassword = newPasswords[p.accountId] ?? '';
    if (newPassword.length < 8) {
      setMsg('كلمة المرور الجديدة يجب أن تكون 8 أحرف أو أرقام على الأقل.');
      return;
    }
    setBusy(true);
    const r = await api(`/api/admin/players/${encodeURIComponent(p.accountId)}/password`, 'POST', token, {
      newPassword,
    });
    setBusy(false);
    if (r.ok) {
      setNewPasswords((m) => ({ ...m, [p.accountId]: '' }));
      setMsg(`تم تعيين كلمة مرور جديدة للاعب ${p.commanderName}. أبلغه بها بشكل خاص.`);
    } else {
      setMsg(r.error ?? 'تعذر تعيين كلمة المرور.');
    }
  };

  const toggleServer = async (id: string) => {
    if (!token || !config?.servers) return;
    const servers = (config.servers as any[]).map((s) => (s.id === id ? { ...s, isOpen: !s.isOpen } : s));
    setBusy(true);
    const r = await api('/api/admin/config', 'PUT', token, { adminConfig: { servers } });
    setBusy(false);
    setMsg(r.ok ? 'تم تحديث السيرفر.' : r.error ?? 'تعذر التحديث.');
    if (r.ok) await load();
  };

  if (!token) {
    return (
      <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-[#060B17] p-4">
        <form onSubmit={doLogin} className="w-full max-w-sm space-y-4 p-6 rounded-2xl bg-slate-900 border border-slate-700">
          <h1 className="text-xl font-bold text-amber-300">لوحة إدارة ENGINORA CITY</h1>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة مرور الإدارة"
            className="w-full min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100"
          />
          {msg && <p className="text-rose-300 text-xs">{msg}</p>}
          <button disabled={busy} className="w-full min-h-[44px] rounded-xl bg-amber-500 text-slate-950 font-bold">
            {busy ? 'جارٍ الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    );
  }

  // Build the list of items waiting for review
  const requests: { p: AdminPlayer; kind: 'registration' | 'order'; order?: PaymentOrder }[] = [];
  for (const p of players) {
    const st = p.state ?? {};
    const orders: PaymentOrder[] = Array.isArray(st.paymentOrders) ? st.paymentOrders : [];
    const regOrder = orders.find((o) => o.productType === 'registration_fee' && o.status === 'pending');
    if (st.registration?.status === 'pending') {
      requests.push({ p, kind: 'registration', order: regOrder });
    }
    for (const o of orders) {
      if (o.status === 'pending' && o.productType !== 'registration_fee') {
        requests.push({ p, kind: 'order', order: o });
      }
    }
  }

  const btn = 'min-h-[40px] px-4 rounded-xl font-bold text-sm';

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#060B17] text-slate-100 p-3 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-amber-300">لوحة إدارة ENGINORA CITY</h1>
          <div className="flex gap-2">
            <button onClick={() => void load()} className={`${btn} bg-slate-800 border border-slate-700`}>
              {busy ? '...' : 'تحديث'}
            </button>
            <button onClick={logout} className={`${btn} bg-slate-800 border border-slate-700`}>
              خروج
            </button>
          </div>
        </header>

        <nav className="flex gap-2">
          {(
            [
              ['requests', `الطلبات (${requests.length})`],
              ['players', `اللاعبون (${players.length})`],
              ['servers', 'السيرفرات'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`${btn} ${tab === id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 border border-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {msg && (
          <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-200 text-sm" onClick={() => setMsg(null)}>
            {msg}
          </div>
        )}

        {tab === 'requests' && (
          <div className="space-y-3">
            {requests.length === 0 && <p className="text-slate-400 text-sm">لا توجد طلبات قيد المراجعة.</p>}
            {requests.map(({ p, kind, order }) => {
              const reg = p.state?.registration ?? {};
              const key = `${p.accountId}:${order?.id ?? 'reg'}`;
              const receiptId: string =
                (order as any)?.receiptId || (kind === 'registration' ? reg.receiptId : '') || '';
              const legacyReceipt: string =
                order?.receiptPreviewUrl || (kind === 'registration' ? reg.receiptPreviewUrl : '') || '';
              return (
                <div key={key} className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <b className="text-amber-300">
                      {kind === 'registration' ? 'طلب تسجيل جديد' : order?.productTitle ?? 'طلب دفع'}
                    </b>
                    <span className="font-num text-slate-400">{p.accountId}</span>
                  </div>
                  <div className="text-slate-300 leading-relaxed">
                    الاسم المستعار: {p.commanderName} · البريد: {p.email ?? '—'} · الجوال: {p.phone ?? '—'}
                    {kind === 'registration' && (
                      <>
                        <br />
                        الاسم الكامل: {reg.fullName ?? '—'} · الهوية: {reg.nationalId ?? '—'}
                      </>
                    )}
                    <br />
                    المبلغ: {order?.amountSar ?? reg.feeAmountSar ?? '—'} ريال · الوسيلة: {order?.paymentMethod ?? reg.paymentMethod ?? '—'} · المرجع: {order?.transferRef || reg.transferRef || '—'}
                    <br />
                    وقت الطلب: {fmt(order?.createdAt ?? reg.submittedAt)}
                  </div>
                  {receiptId ? (
                    <ReceiptImage id={receiptId} token={token} onZoom={setZoom} />
                  ) : legacyReceipt ? (
                    <img
                      src={legacyReceipt}
                      alt="الفاتورة"
                      onClick={() => setZoom(legacyReceipt)}
                      className="max-h-40 rounded-lg border border-slate-700 cursor-zoom-in"
                    />
                  ) : (
                    <p className="text-amber-300 text-xs">لا توجد صورة فاتورة مرفقة بهذا الطلب.</p>
                  )}
                  <input
                    value={notes[key] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                    placeholder="ملاحظة (اختياري)"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => void review(p, kind, 'approve', order?.id)}
                      className={`${btn} bg-emerald-600 text-white`}
                    >
                      اعتماد
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void review(p, kind, 'reject', order?.id)}
                      className={`${btn} bg-rose-700 text-white`}
                    >
                      رفض
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'players' && (
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.accountId} className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    <b>{p.commanderName}</b> · {p.email ?? p.phone ?? '—'}
                  </span>
                  <span className="text-slate-400">
                    {p.registrationStatus} · <span className="font-num">{p.accountId}</span> · {fmt(p.createdAt)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPasswords[p.accountId] ?? ''}
                    onChange={(e) => setNewPasswords((m) => ({ ...m, [p.accountId]: e.target.value }))}
                    placeholder="كلمة مرور جديدة (8 أحرف على الأقل)"
                    className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700"
                  />
                  <button
                    disabled={busy}
                    onClick={() => void resetPassword(p)}
                    className={`${btn} bg-slate-700 text-white`}
                  >
                    تعيين كلمة المرور
                  </button>
                </div>
              </div>
            ))}
            {players.length === 0 && <p className="text-slate-400 text-sm">لا يوجد لاعبون بعد.</p>}
          </div>
        )}

        {tab === 'servers' && (
          <div className="space-y-2">
            {(config?.servers as any[] | undefined)?.map((s) => (
              <div key={s.id} className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between gap-2">
                <span>
                  {s.name ?? s.id} <span className="text-slate-400 text-xs">({s.id})</span>
                </span>
                <button
                  disabled={busy}
                  onClick={() => void toggleServer(s.id)}
                  className={`${btn} ${s.isOpen ? 'bg-emerald-600 text-white' : 'bg-rose-700 text-white'}`}
                >
                  {s.isOpen ? 'مفتوح — اضغط للإغلاق' : 'مغلق — اضغط للفتح'}
                </button>
              </div>
            ))}
            {!config?.servers && <p className="text-slate-400 text-sm">لا توجد سيرفرات في الإعدادات.</p>}
          </div>
        )}
      </div>

      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <img src={zoom} alt="الفاتورة" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
