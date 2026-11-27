import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  FileCheck2,
  FileText,
  IdCard,
  Lock,
  LogIn,
  Mail,
  Phone,
  Receipt,
  Server,
  Upload,
  User,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import sovereignHeroImg from '../assets/images/login_sovereign_command_1795519264931.jpg';
import { PAYMENT_METHODS_META } from '@enginora/shared';
import {
  formatKsaDateTime,
  getPaymentMethodDiscountedSar,
  RegistrationSubmitPayload,
} from '@enginora/shared';
import { GameState, PaymentMethodId } from '@enginora/shared';
import { LegalPoliciesModal } from './LegalPoliciesModal';
import { compressReceiptFile } from '../api/client';

interface PlayerAuthScreenProps {
  state: GameState;
  onSubmitRegistration: (
    payload: RegistrationSubmitPayload & { password: string }
  ) => Promise<{ error?: string }>;
  onLoginApproved: (identifier: string, password: string) => Promise<{ error?: string }>;
  onSelectServer: (serverId: string) => void;
}

export const PlayerAuthScreen: React.FC<PlayerAuthScreenProps> = ({
  state,
  onSubmitRegistration,
  onLoginApproved,
  onSelectServer,
}) => {
  const reg = state.registration;
  const baseFeeSar = state.adminConfig.registrationFeeSar || 200;
  const servers = state.adminConfig.servers ?? [];
  const activeServer =
    servers.find((s) => s.id === state.selectedServerId) ?? servers[0];
  const isServerOpen = Boolean(activeServer?.isOpen);

  const enabledPayMethods = (Object.keys(PAYMENT_METHODS_META) as PaymentMethodId[]).filter(
    (id) => state.adminConfig.paymentMethods?.[id]?.enabled !== false
  );

  const [mode, setMode] = useState<'register' | 'login'>(
    reg.status === 'approved' ? 'login' : 'register'
  );
  const [nickname, setNickname] = useState(reg.nickname || '');
  const [fullName, setFullName] = useState(reg.fullName || '');
  const [nationalId, setNationalId] = useState(reg.nationalId || '');
  const [email, setEmail] = useState(reg.email || '');
  const [phone, setPhone] = useState(reg.phone || '');
  const [transferRef, setTransferRef] = useState(reg.transferRef || '');
  const [receiptName, setReceiptName] = useState(reg.receiptName || '');
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(reg.receiptPreviewUrl || '');
  const [acceptedPolicies, setAcceptedPolicies] = useState<boolean>(
    Boolean(reg.acceptedPolicies)
  );
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(
    reg.paymentMethod && enabledPayMethods.includes(reg.paymentMethod)
      ? reg.paymentMethod
      : enabledPayMethods[0] ?? 'bank_transfer'
  );
  const activePayMethod: PaymentMethodId = enabledPayMethods.includes(paymentMethod)
    ? paymentMethod
    : enabledPayMethods[0] ?? 'bank_transfer';
  const regDiscount = getPaymentMethodDiscountedSar(
    baseFeeSar,
    activePayMethod,
    state.adminConfig
  );
  const feeSar = regDiscount.finalSar;

  const [loginIdentifier, setLoginIdentifier] = useState(reg.email || reg.nickname || '');
  const [password, setPassword] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewLightbox, setPreviewLightbox] = useState<string | null>(null);
  const [allowResubmit, setAllowResubmit] = useState(false);

  const isPending = reg.status === 'pending' && !allowResubmit;
  const isRejected = reg.status === 'rejected' && !allowResubmit;

  const handleReceiptChange = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    compressReceiptFile(file)
      .then((out) => {
        setFormError(null);
        setReceiptName(file.name);
        setReceiptPreviewUrl(out);
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : 'تعذر معالجة صورة الفاتورة.');
      });
  };

  const handleSubmitReg = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!receiptPreviewUrl) {
      setFormError(`يرجى إرفاق صورة فاتورة دفع الـ ${feeSar} ريال لإتمام الطلب.`);
      return;
    }
    if (!acceptedPolicies) {
      setFormError(
        'يجب قراءة والموافقة على سياسة الخصوصية والشروط والأحكام (لا يوجد استرداد ولا وعد بتحقيق دخل) للمتابعة.'
      );
      return;
    }
    if (password.length < 8) {
      setFormError('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل.');
      return;
    }
    setBusy(true);
    const res = await onSubmitRegistration({
      password,
      nickname,
      fullName,
      nationalId,
      email,
      phone,
      paymentMethod: activePayMethod,
      serverId: activeServer?.id,
      transferRef,
      receiptName,
      receiptPreviewUrl,
      acceptedPolicies,
    });
    setBusy(false);
    if (res.error) {
      setFormError(res.error);
    } else {
      setPassword('');
      setAllowResubmit(false);
    }
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    const res = await onLoginApproved(loginIdentifier, loginPassword);
    setBusy(false);
    if (res.error) {
      setFormError(res.error);
    } else {
      setLoginPassword('');
    }
  };

  return (
    <div
      dir="rtl"
      className="relative min-h-[100dvh] w-screen overflow-y-auto bg-[#050A16] text-slate-100 flex flex-col"
    >
      {/* Sovereign Head-of-State Strategic Background */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <img
          src={sovereignHeroImg}
          alt="مركز القيادة السيادي لمدينة ENGINORA CITY"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-left opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#040914]/95 via-[#071022]/85 to-[#040914]/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#040914] via-transparent to-[#040914]/70" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex flex-col justify-between gap-8">
        {/* Clean Player Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-center shadow-lg">
              <Crown className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-amber-300 whitespace-nowrap">
                ENGINORA CITY
              </h1>
              <p className="text-xs text-slate-300">
                لعبة البناء الاستراتيجي وإدارة المدن والموارد
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPoliciesModal(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-amber-300 shrink-0" />
              <span>سياسة الخصوصية والشروط والأحكام</span>
            </button>
          </div>
        </header>

        {/* Primary Split: Auth/Registration Card + Strategic Narrative */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center my-auto">
          {/* Right Column (RTL): Registration / Login Gate */}
          <div className="lg:col-span-7 xl:col-span-6">
            <div className="rounded-2xl bg-[#0B1325]/90 backdrop-blur-xl border border-slate-700/65 shadow-2xl p-5 sm:p-7 space-y-5">
              {/* Server Selector & Live Gate Status */}
              {servers.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-sky-300 shrink-0" />
                      <span>اختر السيرفر:</span>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg border font-bold text-[11px] flex items-center gap-1 ${
                        isServerOpen
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                          : 'bg-rose-500/15 border-rose-400/50 text-rose-300'
                      }`}
                    >
                      {!isServerOpen && <Lock className="w-3 h-3" />}
                      <span>{isServerOpen ? 'السيرفر مفتوح للدخول' : 'السيرفر مغلق حاليًا'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {servers.map((srv) => {
                      const selected = activeServer?.id === srv.id;
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            onSelectServer(srv.id);
                          }}
                          className={`p-2.5 rounded-xl border text-right transition-colors flex items-center justify-between gap-2 ${
                            selected
                              ? 'bg-blue-950/55 border-amber-400/75 text-slate-100'
                              : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold truncate">
                              [{srv.code}] {srv.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-num">
                              السعة الاستيعابية: {srv.capacity} لاعب
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              srv.isOpen
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {srv.isOpen ? 'مفتوح' : 'مغلق'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {!isServerOpen && (
                    <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/45 text-rose-200 text-[11px] leading-relaxed">
                      <strong>السيرفر مغلق حاليًا:</strong> لا يتم فتح الدخول إلى المدينة إلا بعد تفعيل السيرفر للجميع من الإدارة. يمكنك تسجيل حسابك وإرفاق الفاتورة مسبقًا لتجهيز الاعتماد.
                    </div>
                  )}
                </div>
              )}
              {/* Pending Approval View */}
              {isPending && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-amber-300" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base sm:text-lg font-bold text-amber-300">
                        طلب التسجيل قيد المراجعة
                      </h2>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        تم استلام بياناتك وصورة فاتورة دفع رسوم التفعيل ({reg.feeAmountSar} ريال). ستتم مراجعة الفاتورة والبيانات وتفعيل حسابك فور الاعتماد.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/65 border border-slate-800 rounded-xl p-4">
                    <div>
                      <span className="text-slate-400">الاسم المستعار باللعبة:</span>
                      <div className="font-bold text-slate-100 mt-0.5">{reg.nickname}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">الاسم الحقيقي:</span>
                      <div className="font-bold text-slate-100 mt-0.5">{reg.fullName}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">رقم الهوية:</span>
                      <div className="font-num font-bold text-slate-100 mt-0.5">{reg.nationalId}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">رقم الجوال:</span>
                      <div className="font-num font-bold text-slate-100 mt-0.5">{reg.phone}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">البريد الإلكتروني:</span>
                      <div className="font-num text-sky-300 mt-0.5 break-all">{reg.email}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">رسوم التسجيل المرفقة:</span>
                      <div className="font-num font-bold text-emerald-300 mt-0.5">
                        {reg.feeAmountSar} ريال سعودي
                      </div>
                    </div>
                  </div>

                  {reg.receiptPreviewUrl && (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 text-xs">
                      <div className="flex items-center gap-3">
                        <img
                          src={reg.receiptPreviewUrl}
                          alt="فاتورة التسجيل"
                          className="w-12 h-12 rounded-lg object-cover border border-slate-600"
                        />
                        <div>
                          <div className="font-bold text-slate-100">
                            {reg.receiptName || 'فاتورة السداد'}
                          </div>
                          {reg.submittedAt && (
                            <div className="text-[11px] text-slate-400 font-num">
                              {formatKsaDateTime(reg.submittedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewLightbox(reg.receiptPreviewUrl!)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold flex items-center gap-1.5"
                      >
                        <Eye className="w-4 h-4" />
                        <span>معاينة الفاتورة</span>
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                    <span className="text-[11px] text-slate-400">
                      حالة الموافقة على السياسات: مؤكدة · الطلب قيد المراجعة
                    </span>
                    <button
                      type="button"
                      onClick={() => setAllowResubmit(true)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                    >
                      تعديل البيانات أو إعادة إرفاق الفاتورة
                    </button>
                  </div>
                </div>
              )}

              {/* Rejected Banner */}
              {isRejected && (
                <div className="p-4 rounded-xl bg-rose-950/55 border border-rose-500/60 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 font-bold text-rose-200 text-sm">
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>تعذر اعتماد طلب التسجيل السابق</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    السبب: {reg.reviewNote || 'يرجى التحقق من وضوح صورة فاتورة دفع الـ 200 ريال ومطابقة البيانات وإعادة الإرسال.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAllowResubmit(true)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                  >
                    تعديل وإعادة إرسال الطلب
                  </button>
                </div>
              )}

              {/* Registration / Login Tabs */}
              {!isPending && !isRejected && (
                <>
                  <div className="space-y-2">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                      بوابة دخول القادة وتفعيل العضوية
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      سجّل بياناتك وأرفق صورة فاتورة التفعيل ({feeSar} ريال سعودي) مع الموافقة على سياسة الخصوصية والشروط، أو سجّل الدخول بحسابك المعتمد.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/85 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setMode('register');
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        mode === 'register'
                          ? 'bg-[#1D4ED8] text-white shadow'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <UserPlus className="w-4 h-4 shrink-0" />
                      <span>تسجيل حساب ({feeSar} ريال)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setMode('login');
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        mode === 'login'
                          ? 'bg-[#1D4ED8] text-white shadow'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <LogIn className="w-4 h-4 shrink-0" />
                      <span>دخول حساب معتمد</span>
                    </button>
                  </div>

                  {formError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs font-semibold"
                    >
                      {formError}
                    </div>
                  )}

                  {mode === 'register' ? (
                    <form onSubmit={handleSubmitReg} className="space-y-3.5 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            الاسم المستعار باللعبة *
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              value={nickname}
                              onChange={(e) => setNickname(e.target.value)}
                              placeholder="مثال: القائد سيف"
                              className="w-full min-h-[44px] pr-9 pl-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            الاسم الحقيقي الكامل *
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="الاسم الثلاثي كما في الهوية"
                              className="w-full min-h-[44px] pr-9 pl-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            رقم الهوية الوطنية / الإقامة *
                          </label>
                          <div className="relative">
                            <IdCard className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              value={nationalId}
                              onChange={(e) => setNationalId(e.target.value)}
                              placeholder="10 أرقام"
                              className="w-full min-h-[44px] pr-9 pl-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 font-num text-slate-100 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            رقم الجوال *
                          </label>
                          <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="tel"
                              required
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="05XXXXXXXX"
                              className="w-full min-h-[44px] pr-9 pl-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 font-num text-slate-100 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            البريد الإلكتروني *
                          </label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="name@example.com"
                              className="w-full min-h-[44px] pr-9 pl-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 font-num text-slate-100 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            رقم العملية المرجعي <span className="text-slate-400 font-normal">(اختياري)</span>
                          </label>
                          <div className="relative">
                            <Receipt className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={transferRef}
                              onChange={(e) => setTransferRef(e.target.value)}
                              placeholder="اختياري — المهم إرفاق الفاتورة"
                              className="w-full min-h-[44px] pr-9 pl-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 font-num text-slate-100 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          كلمة المرور * <span className="text-slate-400 font-normal">(8 أحرف أو أرقام على الأقل)</span>
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="password"
                            required
                            minLength={8}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="كلمة مرور لدخول حسابك لاحقًا"
                            className="w-full min-h-[44px] pr-9 pl-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 font-num text-slate-100 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      {/* Payment Method Selection with Per-Method Discounts */}
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-slate-200 font-bold">
                            وسيلة الدفع المفضلة *
                          </label>
                          <span className="font-num text-[11px] text-emerald-300 font-bold">
                            {regDiscount.discountPct > 0
                              ? `الإجمالي بعد خصم ${regDiscount.discountPct}%: ${feeSar} ريال (بدلاً من ${baseFeeSar} ريال)`
                              : `المبلغ المطلوب: ${baseFeeSar} ريال سعودي`}
                          </span>
                        </div>
                        {enabledPayMethods.length === 0 ? (
                          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200">
                            جميع وسائل الدفع متوقفة مؤقتًا من الإدارة.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(Object.keys(PAYMENT_METHODS_META) as PaymentMethodId[]).map((mId) => {
                              const pm = PAYMENT_METHODS_META[mId];
                              const disc = getPaymentMethodDiscountedSar(
                                baseFeeSar,
                                mId,
                                state.adminConfig
                              );
                              const selected = activePayMethod === mId && disc.enabled;
                              return (
                                <button
                                  key={mId}
                                  type="button"
                                  disabled={!disc.enabled}
                                  onClick={() => setPaymentMethod(mId)}
                                  className={`min-h-[46px] p-2 rounded-xl border text-right transition-colors flex flex-col justify-between gap-0.5 ${
                                    !disc.enabled
                                      ? 'bg-slate-950/50 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                                      : selected
                                        ? 'bg-blue-950/70 border-amber-400 text-slate-100'
                                        : 'bg-slate-950/85 border-slate-700 text-slate-300 hover:border-slate-500'
                                  }`}
                                >
                                  <span className="font-bold text-[11px] leading-tight">
                                    {pm.name}
                                  </span>
                                  {!disc.enabled ? (
                                    <span className="text-[10px] text-rose-300">متوقفة</span>
                                  ) : disc.discountPct > 0 ? (
                                    <span className="text-[10px] font-num font-bold text-emerald-300">
                                      خصم {disc.discountPct}% ({disc.finalSar} ر)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-num text-slate-400">
                                      {disc.finalSar} ريال
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Mandatory Registration Invoice Upload */}
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/45 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-amber-300 flex items-center gap-1.5">
                            <FileCheck2 className="w-4 h-4 shrink-0" />
                            <span>
                              صورة فاتورة دفع الـ {feeSar} ريال سعودي عبر{' '}
                              {PAYMENT_METHODS_META[activePayMethod].name} (مطلوبة) *
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-300">PNG / JPG / WEBP · حد 2MB</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <label className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-200 font-bold flex items-center gap-2 cursor-pointer transition-colors">
                            <Upload className="w-4 h-4 text-amber-300 shrink-0" />
                            <span>
                              {receiptPreviewUrl ? 'تغيير صورة الفاتورة' : `إرفاق صورة فاتورة الـ ${feeSar} ريال`}
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(e) => handleReceiptChange(e.target.files)}
                              className="hidden"
                            />
                          </label>

                          {receiptPreviewUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewLightbox(receiptPreviewUrl)}
                              className="min-h-[44px] px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/45 text-emerald-200 flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="max-w-[160px] truncate">{receiptName || 'تم إرفاق الفاتورة'}</span>
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mandatory Privacy Policy, No-Refund, & No-Income Agreement */}
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-700/80 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-100 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-amber-300 shrink-0" />
                            <span>الإقرار بسياسة الخصوصية والشروط والأحكام *</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPoliciesModal(true)}
                            className="text-[11px] font-bold text-sky-300 hover:text-sky-200 underline underline-offset-4"
                          >
                            قراءة الوثيقة الكاملة (8 بنود)
                          </button>
                        </div>

                        <ul className="text-[11px] text-slate-300 space-y-1 leading-relaxed list-disc pr-4">
                          <li>تُستخدم بياناتك الشخصية وصورة الفاتورة لتوثيق الحساب وتفعيله وحمايته فقط.</li>
                          <li>
                            <strong className="text-rose-300">لا يوجد استرداد مالي نهائيًا</strong> مقابل رسوم التسجيل ({feeSar} ريال) أو أي جواهر أو باقات أو عناصر رقمية يتم شراؤها.
                          </li>
                          <li>
                            <strong className="text-amber-300">لعبة ترفيهية فقط — لا توجد أي وعود بتحقيق دخل</strong> أو أرباح أو عوائد مالية من اللعب أو العناصر الافتراضية.
                          </li>
                        </ul>

                        <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={acceptedPolicies}
                            onChange={(e) => setAcceptedPolicies(e.target.checked)}
                            className="mt-0.5 w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] font-semibold text-slate-100 leading-relaxed">
                            أقر بأنني قرأت ووافقت على{' '}
                            <button
                              type="button"
                              onClick={() => setShowPoliciesModal(true)}
                              className="text-amber-300 underline hover:text-amber-200"
                            >
                              سياسة الخصوصية والشروط والأحكام الكاملة
                            </button>{' '}
                            بما يشمل عدم الاسترداد النهائي وعدم وجود أي وعد بتحقيق دخل أو أرباح.
                          </span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm shadow-lg transition-colors"
                      >
                        {busy ? 'جارٍ إرسال الطلب...' : `إرسال طلب التسجيل وفاتورة الـ ${feeSar} ريال للمراجعة`}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleSubmitLogin} className="space-y-4 text-xs">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          البريد الإلكتروني أو رقم الجوال أو الاسم المستعار المعتمد
                        </label>
                        <input
                          type="text"
                          required
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          placeholder="أدخل البريد الإلكتروني أو رقم الجوال أو معرّف الحساب"
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          كلمة المرور
                        </label>
                        <input
                          type="password"
                          required
                          autoComplete="current-password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="كلمة المرور"
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div
                        className={`p-3.5 rounded-xl border text-[11px] leading-relaxed ${
                          reg.status === 'approved' && !isServerOpen
                            ? 'bg-rose-950/45 border-rose-500/50 text-rose-200'
                            : 'bg-slate-900/75 border-slate-800 text-slate-300'
                        }`}
                      >
                        {reg.status === 'approved'
                          ? isServerOpen
                            ? `حسابك معتمد باسم «${reg.nickname}» (${reg.email}). اضغط دخول للانتقال إلى مدينتك.`
                            : `حسابك معتمد باسم «${reg.nickname}»، لكن السيرفر مغلق حاليًا — لا يمكن الدخول إلا بعد فتح السيرفر للجميع من الإدارة.`
                          : `ملاحظة: لا يتم فتح حسابات جديدة للدخول إلا بعد مطابقة صورة فاتورة الـ ${baseFeeSar} ريال وقبول الطلب وتفعيل السيرفر.`}
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className={`w-full min-h-[46px] px-5 py-3 rounded-xl font-bold text-sm shadow-lg transition-colors ${
                          !busy
                            ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        {busy ? 'جارٍ الدخول...' : 'دخول إلى عاصمة القيادة'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Left Column (RTL): Strategic Narrative Anchor */}
          <div className="lg:col-span-5 xl:col-span-6 space-y-5 text-right lg:pr-4">
            <div className="space-y-3">
              <div className="text-xs font-bold text-amber-300 tracking-wide">
                البناء الاستراتيجي · التوسع البحري · التحالفات
              </div>
              <h2
                className="text-2xl sm:text-4xl font-bold text-white leading-snug"
                style={{ textWrap: 'balance' }}
              >
                ابنِ عاصمتك الاستراتيجية وتزعّم أسواق الموارد والطاقة
              </h2>
              <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-xl">
                إدارة متكاملة للمباني والموانئ البحرية، استكشاف آبار النفط والغاز، تداول منظم للموارد داخل اللعبة، وتطوير مستمر لأبحاثك وجيشك بالتوقيت العالمي الموحّد (UTC).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl bg-[#0B1325]/80 backdrop-blur-md border border-slate-700/60 p-3.5 space-y-1">
                <div className="text-xs font-bold text-amber-300">بداية متكافئة</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  المبنى الرئيسي مستوى 1 وحماية مبتدئ 14 يومًا لجميع القادة الجدد.
                </p>
              </div>
              <div className="rounded-xl bg-[#0B1325]/80 backdrop-blur-md border border-slate-700/60 p-3.5 space-y-1">
                <div className="text-xs font-bold text-sky-300">توثيق العضوية</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  مراجعة كل طلب تسجيل وصورة الفاتورة لضمان بيئة تنافسية منظمة.
                </p>
              </div>
              <div className="rounded-xl bg-[#0B1325]/80 backdrop-blur-md border border-slate-700/60 p-3.5 space-y-1">
                <div className="text-xs font-bold text-emerald-300">لعب وتنافس مستمر</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  مستشارون متاحون على مدار الساعة، تحالفات، وأسطول بحري وتجاري متكامل.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
          <div className="flex flex-wrap items-center gap-3">
            <span>ENGINORA CITY — جميع الحقوق محفوظة</span>
            <button
              type="button"
              onClick={() => setShowPoliciesModal(true)}
              className="text-amber-300/90 hover:text-amber-200 underline underline-offset-4"
            >
              سياسة الخصوصية والشروط والأحكام
            </button>
          </div>
          <span>التوقيت الرسمي المعتمد: التوقيت العالمي (UTC) — بداية اليوم الجديد 21:00 UTC</span>
        </footer>
      </div>

      {/* Receipt Preview Lightbox */}
      {previewLightbox && (
        <div
          onClick={() => setPreviewLightbox(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl max-h-[85dvh]"
          >
            <button
              type="button"
              onClick={() => setPreviewLightbox(null)}
              className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-slate-900 border border-slate-600 text-white flex items-center justify-center"
              aria-label="إغلاق المعاينة"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewLightbox}
              alt="معاينة فاتورة رسوم التسجيل 200 ريال"
              className="max-h-[82dvh] rounded-xl border border-slate-700"
            />
          </div>
        </div>
      )}

      {/* Full Legal Policies & Privacy Modal */}
      {showPoliciesModal && (
        <LegalPoliciesModal
          onClose={() => setShowPoliciesModal(false)}
          alreadyAccepted={acceptedPolicies}
          onAccept={() => {
            setAcceptedPolicies(true);
            setFormError(null);
          }}
        />
      )}
    </div>
  );
};
