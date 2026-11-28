import React, { useState } from 'react';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  FileText,
  Gem,
  Lock,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Upload,
  Zap,
} from 'lucide-react';
import {
  MARKET_RESOURCES_META,
  PAYMENT_METHODS_META,
  SHIELD_PACKAGES,
  SPEEDUP_CARDS_META,
  compressReceiptFile,
} from '@enginora/shared';
import {
  formatDuration,
  formatKsaDateTime,
  formatNumber,
  getActiveShieldEndsAt,
  getKsaDayKey,
  getPaymentMethodDiscountedSar,
  getSecondsUntilKsaMidnight,
  getTotalGems,
  isAttackBoostActive,
  isDefenseBoostActive,
  isShieldActive,
} from '@enginora/shared';
import {
  GameState,
  OrderProductType,
  PaymentMethodId,
  SpeedUpTierId,
} from '@enginora/shared';
import { LegalPoliciesModal } from './LegalPoliciesModal';
import { PanelHeader } from '@enginora/shared';
import { PaymentDestinationCard } from './PaymentDestinationCard';

interface StoreViewProps {
  state: GameState;
  now: number;
  onSubmitPaymentOrder: (
    productType: OrderProductType,
    productId: string,
    paymentMethod: PaymentMethodId,
    transferRef: string,
    receiptName?: string,
    receiptPreviewUrl?: string
  ) => Promise<{ error?: string } | void> | { error?: string } | void;
  onBuySpeedUpCard: (tierId: SpeedUpTierId, qty: number) => void;
  onBuyCombatBuff: (kind: 'attack' | 'defense') => void;
  onBuyProtectionShield: (tier: '24h' | '3d' | '7d' | '30d') => void;
  onNavigateSupport?: () => void;
}

interface CheckoutTarget {
  productType: OrderProductType;
  productId: string;
  title: string;
  priceSar: number;
}

export const StoreView: React.FC<StoreViewProps> = ({
  state,
  now,
  onSubmitPaymentOrder,
  onBuySpeedUpCard,
  onBuyCombatBuff,
  onBuyProtectionShield,
  onNavigateSupport,
}) => {
  const [tab, setTab] = useState<'packages' | 'speedups' | 'buffs'>('packages');
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethodId>('apple_pay');
  const [transferRef, setTransferRef] = useState('');
  const [receiptName, setReceiptName] = useState<string | undefined>(undefined);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | undefined>(undefined);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [speedUpQtys, setSpeedUpQtys] = useState<Record<SpeedUpTierId, number>>({
    '1m': 1,
    '5m': 1,
    '30m': 1,
    '1h': 1,
    '24h': 1,
    '3d': 1,
    '7d': 1,
  });

  const totalGems = getTotalGems(state);
  const activeShieldEnd = getActiveShieldEndsAt(state, now);
  const shieldActive = isShieldActive(state, now);
  const atkActive = isAttackBoostActive(state, now);
  const defActive = isDefenseBoostActive(state, now);

  const vipActive = Boolean(
    state.vipSubscription.active &&
      state.vipSubscription.expiresAt &&
      state.vipSubscription.expiresAt > now
  );

  const enabledPaymentMethods = (Object.keys(PAYMENT_METHODS_META) as PaymentMethodId[]).filter(
    (mId) => state.adminConfig.paymentMethods?.[mId]?.enabled !== false
  );
  const activePayMethod: PaymentMethodId = enabledPaymentMethods.includes(payMethod)
    ? payMethod
    : enabledPaymentMethods[0] ?? 'apple_pay';
  const checkoutDiscount = checkout
    ? getPaymentMethodDiscountedSar(checkout.priceSar, activePayMethod, state.adminConfig)
    : { finalSar: 0, discountPct: 0, enabled: true };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    compressReceiptFile(file)
      .then((out) => {
        setReceiptName(out.name);
        setReceiptPreviewUrl(out.dataUrl);
      })
      .catch((err: unknown) => {
        setReceiptError(
          err instanceof Error ? err.message : 'تعذر معالجة صورة الإيصال.'
        );
      });
  };

  const submitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkout || submittingOrder) return;
    if (enabledPaymentMethods.length === 0) {
      setReceiptError('جميع وسائل الدفع متوقفة مؤقتًا من الإدارة.');
      return;
    }
    if ((activePayMethod === 'bank_transfer' || activePayMethod === 'binance') && !receiptPreviewUrl) {
      setReceiptError(
        activePayMethod === 'binance'
          ? 'يرجى إرفاق صورة إيصال تحويل بايننس لإتمام الطلب (رقم العملية المرجعي اختياري).'
          : 'يرجى إرفاق صورة الفاتورة / إيصال التحويل لإتمام الطلب (رقم العملية المرجعي اختياري).'
      );
      return;
    }
    setReceiptError(null);
    setSubmittingOrder(true);
    try {
      const result = await onSubmitPaymentOrder(
        checkout.productType,
        checkout.productId,
        activePayMethod,
        transferRef,
        receiptName,
        receiptPreviewUrl
      );
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        setReceiptError(result.error);
        return;
      }
      setCheckout(null);
      setTransferRef('');
      setReceiptName(undefined);
      setReceiptPreviewUrl(undefined);
      setReceiptError(null);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const orderStatusBadge = (status: GameState['paymentOrders'][number]['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
      case 'rejected':
        return 'bg-rose-500/20 text-rose-300 border-rose-400/40';
      case 'refunded':
        return 'bg-purple-500/20 text-purple-300 border-purple-400/40';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
    }
  };

  const orderStatusLabel = (status: GameState['paymentOrders'][number]['status']) => {
    switch (status) {
      case 'approved':
        return 'معتمد وتمت الإضافة';
      case 'rejected':
        return 'مرفوض';
      case 'refunded':
        return 'ملغى';
      default:
        return 'قيد المراجعة';
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.13),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(29,78,216,0.14),transparent_45%)]">
      <div className="max-w-6xl mx-auto space-y-5 pb-8">
        <PanelHeader
          icon={ShoppingBag}
          title="المتجر الرسمي والجواهر (ENGINORA GEMS)"
          subtitle="اشحن الجواهر، اشترك في المستشار الذكي حكيم أو الباقة الشهرية VIP، واشترِ بطاقات التسريع ودروع الحماية."
          rightSlot={
            <div className="flex items-center gap-1 p-1 rounded-xl glass-subpanel overflow-x-auto no-scrollbar max-w-full">
              {[
                { id: 'packages', label: 'الباقات والاشتراكات', icon: Gem },
                { id: 'speedups', label: 'بطاقات التسريع (7 فئات)', icon: Zap },
                { id: 'buffs', label: 'التعزيزات والدروع', icon: Shield },
              ].map((t) => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id as typeof tab)}
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

        {/* Strictly Separated Financial Ledgers Banner (§8-§23) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 text-xs">
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/45 flex items-center justify-center shrink-0">
                  <Gem className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="font-bold text-sm text-amber-300">محفظة ENGINORA GEMS</div>
                  <div className="text-[11px] text-slate-400 font-num">
                    10 جواهر = 1 ريال سعودي · 1 دولار = 3.75 ريال
                  </div>
                </div>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-slate-400">الإجمالي المتاح للاستخدام</div>
                <div className="text-xl font-num font-bold text-amber-300">
                  {formatNumber(totalGems)} جوهرة
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-num text-center">
              <div className="glass-subpanel p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400">جواهر الشحن</div>
                <div className="font-bold text-slate-100 mt-0.5">
                  {formatNumber(state.gemLedger.chargedGems)}
                </div>
              </div>
              <div className="glass-subpanel p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400">الجواهر الإضافية</div>
                <div className="font-bold text-sky-300 mt-0.5">
                  {formatNumber(state.gemLedger.bonusGems)}
                </div>
              </div>
              <div className="glass-subpanel p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400">جواهر السوق</div>
                <div className="font-bold text-emerald-300 mt-0.5">
                  {formatNumber(state.gemLedger.marketGems)}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border-emerald-500/35 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/45 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <div className="font-bold text-sm text-emerald-300">
                    رصيد نقاط التجارة (دفتر منفصل تمامًا)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    لا يُدمج أبدًا مع ENGINORA GEMS · يُكتسب حصريًا من مبيعات الموارد في السوق الرسمي
                  </div>
                </div>
              </div>
              <div className="text-xl font-num font-bold text-emerald-300 shrink-0">
                {formatNumber(state.ledger.tradeBalance)} نقطة
              </div>
            </div>

            <div className="glass-subpanel px-3 py-2 rounded-xl text-[11px] text-slate-300 leading-relaxed">
              تُحتسب نقاط التجارة وفق مبيعات الموارد الأساسية في سوق التجارة (بدءًا من المبنى الرئيسي مستوى 10) دون احتساب موارد النفط والغاز أو الإمدادات البحرية، وتبقى مفصولة تمامًا عن محفظة الجواهر.
            </div>
          </div>
        </div>

        {/* TAB 1: Gem Packages & Subscriptions + Checkout */}
        {tab === 'packages' && (
          <div className="space-y-5">
            {/* Gem Packs */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 px-1">
                <Gem className="w-4 h-4 text-amber-300" />
                <span>باقات شحن ENGINORA GEMS (بالريال السعودي)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {state.adminConfig.gemPackages.map((pack) => {
                  const totalPackGems = pack.baseGems + pack.bonusGems;
                  return (
                    <div
                      key={pack.id}
                      className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-3.5 hover:border-amber-400/55 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-100">
                            {pack.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/45 text-[11px] font-num font-bold text-amber-300">
                            {pack.priceSar} ريال
                          </span>
                        </div>

                        <div className="text-2xl font-num font-bold text-amber-300">
                          {formatNumber(totalPackGems)} <span className="text-xs font-normal text-slate-300">جوهرة</span>
                        </div>

                        <div className="text-[11px] text-slate-300 font-num flex flex-wrap gap-2">
                          <span>أساسي: {formatNumber(pack.baseGems)}</span>
                          {pack.bonusGems > 0 && (
                            <span className="text-emerald-300 font-bold">
                              + {formatNumber(pack.bonusGems)} إضافية مجانًا
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setCheckout({
                            productType: 'gem_package',
                            productId: pack.id,
                            title: `${pack.name} (${formatNumber(totalPackGems)} جوهرة)`,
                            priceSar: pack.priceSar,
                          })
                        }
                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>شراء الآن ({pack.priceSar} ريال)</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Hakim & VIP Subscriptions */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="glass-panel p-5 rounded-2xl border-amber-400/45 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-amber-300 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      <span>المستشار الذكي «حكيم»</span>
                    </span>
                    <span className="font-num font-bold text-slate-100 bg-amber-500/20 border border-amber-400/45 px-2.5 py-1 rounded-lg">
                      {formatNumber(state.adminConfig.hakimPriceSar)} ريال / {state.adminConfig.hakimDurationDays} يومًا
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    يرفع الطوابير إلى 4 بناء + 2 بحث، يضيف +5% حصة سوق شهرية (حتى 35%)، يسمح بنشر عرضين نشطين في السوق، وينفذ التطوير والأبحاث والأسطول وغارات حقول الموارد تلقائيًا. بدون تجديد تلقائي.
                  </p>
                  {state.smartBotActive && state.smartBotExpiresAt && (
                    <div className="text-emerald-300 font-num font-bold">
                      نشط حاليًا · متبقي {formatDuration((state.smartBotExpiresAt - now) / 1000)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCheckout({
                      productType: 'hakim_sub',
                      productId: 'hakim_90d',
                      title: `اشتراك المستشار الذكي حكيم (${state.adminConfig.hakimDurationDays} يومًا)`,
                      priceSar: state.adminConfig.hakimPriceSar,
                    })
                  }
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
                >
                  {state.smartBotActive ? 'تمديد اشتراك حكيم (+90 يومًا)' : 'طلب تفعيل المستشار حكيم'}
                </button>
              </div>

              <div className="glass-panel p-5 rounded-2xl border-sky-400/45 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-sky-300 flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-300" />
                      <span>الباقة الشهرية VIP</span>
                    </span>
                    <span className="font-num font-bold text-slate-100 bg-sky-500/20 border border-sky-400/45 px-2.5 py-1 rounded-lg">
                      {state.adminConfig.vipPriceUsd}$ ({state.adminConfig.vipPriceSar} ريال) / {state.adminConfig.vipDurationDays} يومًا
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    تفتح المسار الإضافي اليومي لمدة 30 يومًا في الباقة الشهرية (موارد إضافية + جواهر في اليوم 30 + بطاقات تسريع مميزة) بالتوقيت العالمي UTC (تبدأ دورة اليوم عند 21:00 UTC). بدون تجديد تلقائي.
                  </p>
                  {vipActive && state.vipSubscription.expiresAt && (
                    <div className="text-emerald-300 font-num font-bold">
                      VIP نشط حاليًا · متبقي {formatDuration((state.vipSubscription.expiresAt - now) / 1000)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCheckout({
                      productType: 'vip_sub',
                      productId: 'vip_30d',
                      title: `اشتراك الباقة الشهرية VIP (${state.adminConfig.vipDurationDays} يومًا)`,
                      priceSar: state.adminConfig.vipPriceSar,
                    })
                  }
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold transition-colors"
                >
                  {vipActive ? 'تمديد VIP (+30 يومًا)' : 'طلب تفعيل VIP الشهرية'}
                </button>
              </div>
            </section>

            {/* Checkout Form Panel when item selected */}
            {checkout && (
              <form
                onSubmit={submitCheckout}
                className="glass-panel p-5 rounded-2xl border-amber-400/70 space-y-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-700/50">
                  <div>
                    <div className="text-sm font-bold text-amber-300">
                      إتمام طلب الدفع: {checkout.title}
                    </div>
                    <div className="text-slate-300 font-num mt-0.5 flex flex-wrap items-center gap-2">
                      {checkoutDiscount.discountPct > 0 ? (
                        <>
                          <span className="line-through text-slate-500">{checkout.priceSar} ريال</span>
                          <span className="text-emerald-300 font-bold">
                            المبلغ بعد خصم {checkoutDiscount.discountPct}%: {checkoutDiscount.finalSar} ريال سعودي
                          </span>
                        </>
                      ) : (
                        <span>المبلغ المطلوب: {checkout.priceSar} ريال سعودي</span>
                      )}
                      <span>· الحالة الابتدائية: قيد المراجعة</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckout(null)}
                    className="min-h-[38px] px-3 py-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                  >
                    إلغاء
                  </button>
                </div>

                {enabledPaymentMethods.length === 0 ? (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200">
                    جميع وسائل الدفع متوقفة مؤقتًا من الإدارة. يرجى التواصل مع الدعم الفني.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {(Object.keys(PAYMENT_METHODS_META) as PaymentMethodId[]).map((mId) => {
                      const pm = PAYMENT_METHODS_META[mId];
                      const pmPricing = getPaymentMethodDiscountedSar(
                        checkout.priceSar,
                        mId,
                        state.adminConfig
                      );
                      const selected = activePayMethod === mId && pmPricing.enabled;
                      return (
                        <button
                          key={mId}
                          type="button"
                          disabled={!pmPricing.enabled}
                          onClick={() => setPayMethod(mId)}
                          className={`min-h-[68px] p-3 rounded-xl border text-right transition-colors flex flex-col justify-between gap-1 ${
                            !pmPricing.enabled
                              ? 'bg-slate-950/60 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                              : selected
                                ? 'bg-blue-950/60 border-amber-400 text-slate-100'
                                : 'glass-subpanel text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-sm">{pm.name}</span>
                            {!pmPricing.enabled ? (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                                متوقف
                              </span>
                            ) : pmPricing.discountPct > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-num font-bold">
                                خصم {pmPricing.discountPct}%
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug">{pm.subtitle}</div>
                          {pmPricing.enabled && pmPricing.discountPct > 0 && (
                            <div className="text-[11px] font-num font-bold text-emerald-300">
                              السعر: {pmPricing.finalSar} ريال
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <PaymentDestinationCard
                  methodId={activePayMethod}
                  config={state.adminConfig.paymentMethods?.[activePayMethod]}
                  amountSar={checkoutDiscount.finalSar}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1.5">
                      رقم العملية المرجعي <span className="text-slate-400">(اختياري)</span>
                    </label>
                    <input
                      type="text"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      placeholder="اختياري — المهم إرفاق صورة الفاتورة"
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100 font-num"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1.5">
                      صورة الفاتورة / إيصال الدفع{' '}
                      {activePayMethod === 'bank_transfer' || activePayMethod === 'binance'
                        ? '(مطلوبة)'
                        : '(اختيارية — يُفضّل إرفاقها)'}
                    </label>
                    <label className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-700 hover:border-sky-400 text-slate-200 flex items-center justify-between gap-2 cursor-pointer">
                      <span className="truncate">{receiptName ?? 'اختر صورة الفاتورة (PNG/JPG/WEBP)...'}</span>
                      <Upload className="w-4 h-4 text-sky-300 shrink-0" />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleReceiptChange}
                        className="hidden"
                      />
                    </label>
                    {receiptError && (
                      <div className="text-rose-400 mt-1">{receiptError}</div>
                    )}
                  </div>
                </div>

                {receiptPreviewUrl && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/75 border border-slate-800">
                    <img
                      src={receiptPreviewUrl}
                      alt="معاينة الإيصال"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-700"
                    />
                    <div className="text-[11px] text-emerald-300">
                      تم إرفاق صورة الفاتورة بنجاح ({receiptName}) — سيتم مراجعتها وتفعيل الطلب.
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/40 text-amber-100 text-[11px] leading-relaxed space-y-1.5">
                  <div>
                    تنبيه هام: جميع المشتريات الرقمية والباقات والجواهر داخل اللعبة نهائية و<strong>غير قابلة للاسترداد المالي</strong>، واللعبة ترفيهية ولا تقدم أي وعود بتحقيق دخل أو أرباح.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPoliciesModal(true)}
                    className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 underline font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>مراجعة سياسة الخصوصية والشروط الكاملة</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={enabledPaymentMethods.length === 0 || submittingOrder}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold transition-colors"
                >
                  {submittingOrder
                    ? 'جارٍ إرسال الطلب وحفظه في قاعدة البيانات...'
                    : `إرسال الطلب والفاتورة للمراجعة (${checkoutDiscount.finalSar} ريال)`}
                </button>
              </form>
            )}

            {/* Player Payment Orders Log */}
            <section className="glass-panel rounded-2xl overflow-hidden text-xs">
              <div className="px-4 py-3.5 border-b border-slate-700/45 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  سجل طلبات الدفع الخاصة بك ({state.paymentOrders.length})
                </h3>
                {onNavigateSupport && (
                  <button
                    type="button"
                    onClick={onNavigateSupport}
                    className="text-[11px] text-sky-300 hover:text-sky-200 font-semibold"
                  >
                    استفسار عن دفعة؟ افتح الدعم الفني ←
                  </button>
                )}
              </div>

              {state.paymentOrders.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  لم تُرسل أي طلبات دفع بعد.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/70">
                  {state.paymentOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3.5 sm:px-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-num font-bold text-slate-300">{ord.id}</span>
                          <span className="font-bold text-slate-100">{ord.productTitle}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-num">
                          {PAYMENT_METHODS_META[ord.paymentMethod].name} · {ord.amountSar} ريال ·{' '}
                          {formatKsaDateTime(ord.createdAt)}
                          {ord.note ? ` · ${ord.note}` : ''}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold shrink-0 ${orderStatusBadge(
                          ord.status
                        )}`}
                      >
                        {orderStatusLabel(ord.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: 7 Speed-up Card Tiers */}
        {tab === 'speedups' && (
          <div className="space-y-4">
            <div className="glass-panel p-4 rounded-2xl text-xs text-slate-200">
              جميع بطاقات التسريع السبعة مرتبطة بالحساب وغير قابلة للتداول في السوق، وتُستخدم لتقليص أوقات البناء أو الأبحاث أو التدريب.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              {(Object.keys(SPEEDUP_CARDS_META) as SpeedUpTierId[]).map((tier) => {
                const meta = SPEEDUP_CARDS_META[tier];
                const unitGems = state.adminConfig.speedUpGemCosts[tier] ?? meta.gemCost;
                const qty = speedUpQtys[tier] ?? 1;
                const totalCost = unitGems * qty;
                const affordable = totalGems >= totalCost;

                return (
                  <div
                    key={tier}
                    className="glass-panel p-4 rounded-2xl flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                          <Zap className="w-4 h-4" />
                          <span>{meta.name}</span>
                        </span>
                        <span className="font-num text-[11px] text-slate-300">
                          تملك: ×{state.speedUpCards[tier] ?? 0}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-num">
                        سعر البطاقة: {formatNumber(unitGems)} جوهرة
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-slate-700/45">
                      <div className="flex items-center gap-2">
                        <label className="text-slate-400 shrink-0">الكمية:</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={qty}
                          onChange={(e) =>
                            setSpeedUpQtys((prev) => ({
                              ...prev,
                              [tier]: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 py-1 rounded-xl bg-slate-950/85 border border-slate-700 font-num text-slate-100 text-center"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => onBuySpeedUpCard(tier, qty)}
                        className={`w-full min-h-[42px] py-2 px-3 rounded-xl font-bold transition-colors ${
                          affordable
                            ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                            : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        شراء ({formatNumber(totalCost)} جوهرة)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Combat Buffs (+10%) & Protection Shields */}
        {tab === 'buffs' && (
          <div className="space-y-5 text-xs">
            {/* Combat Buffs */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel p-5 rounded-2xl space-y-3 border-rose-500/35">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-rose-300 flex items-center gap-2">
                    <Swords className="w-4 h-4" />
                    <span>تعزيز الهجوم +10% (24 ساعة)</span>
                  </span>
                  <span className="font-num font-bold text-amber-300">
                    {state.adminConfig.attackBoostGems} جوهرة
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  يرفع قوة الهجوم +10%. تكرار الشراء يمدد المدة المتراكمة بدون حد أقصى دون زيادة النسبة عن 10%.
                </p>
                {atkActive && state.combatBuffs.attackBoostEndsAt && (
                  <div className="glass-subpanel px-3 py-2 rounded-xl font-num text-emerald-300 font-bold">
                    نشط حاليًا · متبقي {formatDuration((state.combatBuffs.attackBoostEndsAt - now) / 1000)}
                  </div>
                )}
                <button
                  type="button"
                  disabled={totalGems < state.adminConfig.attackBoostGems}
                  onClick={() => onBuyCombatBuff('attack')}
                  className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold transition-colors ${
                    totalGems >= state.adminConfig.attackBoostGems
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {atkActive
                    ? `تمديد +24 ساعة (${state.adminConfig.attackBoostGems} جوهرة)`
                    : `تفعيل الآن (${state.adminConfig.attackBoostGems} جوهرة)`}
                </button>
              </div>

              <div className="glass-panel p-5 rounded-2xl space-y-3 border-sky-500/35">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-sky-300 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>تعزيز الدفاع +10% (24 ساعة)</span>
                  </span>
                  <span className="font-num font-bold text-amber-300">
                    {state.adminConfig.defenseBoostGems} جوهرة
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  يرفع قوة الدفاع +10%. تكرار الشراء يمدد المدة المتراكمة بدون حد أقصى دون زيادة النسبة عن 10%.
                </p>
                {defActive && state.combatBuffs.defenseBoostEndsAt && (
                  <div className="glass-subpanel px-3 py-2 rounded-xl font-num text-emerald-300 font-bold">
                    نشط حاليًا · متبقي {formatDuration((state.combatBuffs.defenseBoostEndsAt - now) / 1000)}
                  </div>
                )}
                <button
                  type="button"
                  disabled={totalGems < state.adminConfig.defenseBoostGems}
                  onClick={() => onBuyCombatBuff('defense')}
                  className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold transition-colors ${
                    totalGems >= state.adminConfig.defenseBoostGems
                      ? 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                      : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {defActive
                    ? `تمديد +24 ساعة (${state.adminConfig.defenseBoostGems} جوهرة)`
                    : `تفعيل الآن (${state.adminConfig.defenseBoostGems} جوهرة)`}
                </button>
              </div>
            </section>

            {/* Protection Shields */}
            <section className="space-y-3">
              <div className="glass-panel p-4 rounded-2xl border-sky-400/45 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-sm text-sky-200 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-sky-300" />
                    <span>دروع الحماية (تمديد متراكم)</span>
                  </div>
                  <p className="text-slate-300">
                    إرسال الاستطلاع يُبقي الدرع مفعلًا، بينما شن هجوم على مدينة لاعب آخر يُلغي درع الحماية فورًا بدون أي استرجاع للجواهر.
                  </p>
                </div>
                <div className="glass-subpanel px-3.5 py-2 rounded-xl font-num">
                  {shieldActive && activeShieldEnd ? (
                    <span className="text-sky-300 font-bold">
                      الدرع نشط · متبقي {formatDuration((activeShieldEnd - now) / 1000)}
                    </span>
                  ) : (
                    <span className="text-amber-300 font-bold">لا يوجد درع حماية نشط</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {SHIELD_PACKAGES.map((pkg) => {
                  const costGems = state.adminConfig.shieldPricesGems[pkg.id] ?? pkg.defaultGems;
                  const affordable = totalGems >= costGems;
                  return (
                    <div
                      key={pkg.id}
                      className="glass-panel p-4 rounded-2xl flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-100">{pkg.name}</div>
                        <div className="text-xl font-num font-bold text-amber-300">
                          {formatNumber(costGems)} جوهرة
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => onBuyProtectionShield(pkg.id)}
                        className={`w-full min-h-[42px] py-2 px-3 rounded-xl font-bold transition-colors ${
                          affordable
                            ? 'bg-sky-600 hover:bg-sky-500 text-white'
                            : 'bg-slate-800/80 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        تفعيل / تمديد الدرع
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      {showPoliciesModal && (
        <LegalPoliciesModal onClose={() => setShowPoliciesModal(false)} />
      )}
    </div>
  );
};

export const MonthlyRewardsView: React.FC<{
  state: GameState;
  now: number;
  onClaimDay: (day: number) => void;
  onGoToStore: () => void;
}> = ({ state, now, onClaimDay, onGoToStore }) => {
  const todayKsa = getKsaDayKey(now);
  const alreadyClaimedToday = state.monthlyRewards.lastClaimKsaDayKey === todayKsa;
  const nextDay =
    state.monthlyRewards.claimedDays.length >= 30
      ? 1
      : state.monthlyRewards.claimedDays.length + 1;
  const secUntilReset = getSecondsUntilKsaMidnight(now);
  const vipActive = Boolean(
    state.vipSubscription.active &&
      state.vipSubscription.expiresAt &&
      state.vipSubscription.expiresAt > now
  );

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(14,165,233,0.14),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(245,158,11,0.12),transparent_45%)]">
      <div className="max-w-6xl mx-auto space-y-5 pb-8">
        <PanelHeader
          icon={CalendarCheck2}
          title="الباقة الشهرية والمكافآت اليومية (30 يومًا)"
          subtitle="استلم مكافأة كل يوم بالتوقيت العالمي (UTC) — يبدأ اليوم الجديد الساعة 21:00 UTC عبر المسار المجاني ومسار VIP الإضافي."
          rightSlot={
            <div className="glass-subpanel px-3.5 py-2 rounded-xl text-xs font-num flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-300" />
              <span className="text-slate-300">التجديد بعد:</span>
              <span className="font-bold text-amber-300">{formatDuration(secUntilReset)}</span>
            </div>
          }
        />

        {/* VIP Status + Adjustable Quantities Notice (§45-§51) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 text-xs">
          <div className="lg:col-span-2 glass-panel p-4 rounded-2xl border-sky-400/45 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-sm text-sky-200 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-300" />
                <span>
                  حالة مسار VIP:{' '}
                  {vipActive ? 'نشط ومفعل الآن' : 'غير مفعل — يمكنك الترقية مقابل 10$ (37.50 ريال) / 30 يومًا'}
                </span>
              </div>
              <div className="text-slate-300 font-num">
                التوقيت العالمي الحالي: {formatKsaDateTime(now)} · الأيام المستلمة:{' '}
                {state.monthlyRewards.claimedDays.length} / 30
              </div>
            </div>
            {!vipActive && (
              <button
                type="button"
                onClick={onGoToStore}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0"
              >
                الاشتراك في VIP الآن
              </button>
            )}
          </div>

          <div className="glass-panel p-4 rounded-2xl border-amber-500/40 flex items-center gap-2.5 text-amber-100 leading-relaxed">
            <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
            <span>
              الأيام 1 إلى 29 تقدم هدايا موارد وبطاقات تسريع مناسبة للمسارين دون جواهر، واليوم 30 فقط يمنح 100 جوهرة لمشتركي VIP.
            </span>
          </div>
        </div>

        {/* 30-Day Interactive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {state.adminConfig.monthlyRewards.map((cfg) => {
            const isClaimed =
              state.monthlyRewards.claimedDays.includes(cfg.day) &&
              !(state.monthlyRewards.claimedDays.length >= 30 && nextDay === 1);
            const isCurrentReady = cfg.day === nextDay && !alreadyClaimedToday;
            const isFuture = cfg.day > nextDay || (cfg.day === nextDay && alreadyClaimedToday);

            return (
              <div
                key={cfg.day}
                className={`glass-panel p-3.5 rounded-2xl flex flex-col justify-between gap-3 transition-colors ${
                  isCurrentReady
                    ? 'border-amber-400/80 bg-amber-950/20'
                    : isClaimed
                      ? 'border-emerald-500/40 opacity-85'
                      : cfg.day === 30
                        ? 'border-amber-500/50'
                        : ''
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-num font-bold text-sm text-amber-300">
                      اليوم {cfg.day}
                    </span>
                    {isClaimed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isFuture ? (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    ) : null}
                  </div>

                  {/* Free Track */}
                  <div className="glass-subpanel p-2.5 rounded-xl space-y-1">
                    <div className="text-[10px] font-bold text-sky-300">المسار المجاني</div>
                    <div className="text-[11px] text-slate-100 leading-snug">{cfg.freeLabel}</div>
                    <div className="text-[10px] font-num text-slate-400">
                      {formatNumber(cfg.freeWheat)} قمح · {formatNumber(cfg.freeWood)} خشب · {formatNumber(cfg.freeIron)} حديد
                    </div>
                    {cfg.freeSpeedUpTier && (
                      <div className="text-[10px] text-amber-300 font-bold">
                        + {SPEEDUP_CARDS_META[cfg.freeSpeedUpTier].name}
                      </div>
                    )}
                  </div>

                  {/* VIP Track */}
                  <div
                    className={`p-2.5 rounded-xl border space-y-1 ${
                      vipActive
                        ? 'bg-amber-950/25 border-amber-500/40'
                        : 'bg-slate-950/50 border-slate-800/80 opacity-85'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between">
                      <span>مسار VIP</span>
                      {!vipActive && <Lock className="w-3 h-3 text-slate-500" />}
                    </div>
                    <div className="text-[11px] text-slate-200 leading-snug">{cfg.vipLabel}</div>
                    <div className="text-[10px] font-num text-slate-300">
                      {formatNumber(cfg.vipWheat)} قمح · {formatNumber(cfg.vipWood)} خشب · {formatNumber(cfg.vipIron)} حديد
                    </div>
                    {cfg.vipSpeedUpTier && (
                      <div className="text-[10px] text-sky-300 font-bold">
                        + {SPEEDUP_CARDS_META[cfg.vipSpeedUpTier].name}
                      </div>
                    )}
                    {cfg.vipGems > 0 && (
                      <div className="text-[11px] font-num font-bold text-amber-300">
                        +{cfg.vipGems} جوهرة (جائزة اليوم 30)
                      </div>
                    )}
                  </div>
                </div>

                {isClaimed ? (
                  <div className="min-h-[38px] rounded-xl bg-emerald-950/35 border border-emerald-500/35 text-emerald-300 font-bold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تم الاستلام</span>
                  </div>
                ) : isCurrentReady ? (
                  <button
                    type="button"
                    onClick={() => onClaimDay(cfg.day)}
                    className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
                  >
                    استلام مكافأة اليوم
                  </button>
                ) : (
                  <div className="min-h-[38px] rounded-xl bg-slate-900/75 border border-slate-800 text-slate-400 font-semibold flex items-center justify-center text-[11px]">
                    {cfg.day === nextDay && alreadyClaimedToday
                      ? 'يتجدد عند 21:00 UTC'
                      : 'بانتظار اليوم السابق'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tiny resource reference footer so unused import warning stays clear if needed */}
        <div className="text-[11px] text-slate-400 text-center">
          تُضاف الموارد المستلمة فورًا إلى مخزون ({MARKET_RESOURCES_META.wheat.name}، {MARKET_RESOURCES_META.wood.name}، {MARKET_RESOURCES_META.iron.name}) دون توقف للإنتاج.
        </div>
      </div>
    </div>
  );
};
