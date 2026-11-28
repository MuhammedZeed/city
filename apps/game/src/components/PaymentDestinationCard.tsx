import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Landmark,
  Wallet,
} from 'lucide-react';
import {
  PAYMENT_METHODS_META,
  PaymentMethodConfig,
  PaymentMethodId,
} from '@enginora/shared';

function getSafeHttpsUrl(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export const PaymentDestinationCard: React.FC<{
  methodId: PaymentMethodId;
  config?: PaymentMethodConfig;
  amountSar?: number;
}> = ({ methodId, config, amountSar }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const meta = PAYMENT_METHODS_META[methodId];

  const bankOrNetwork = config?.bankOrNetwork?.trim() || '';
  const accountTitle = config?.accountTitle?.trim() || '';
  const accountNumber = config?.accountNumber?.trim() || '';
  const ibanOrAddress = config?.ibanOrAddress?.trim() || '';
  const paymentLink = getSafeHttpsUrl(config?.paymentLink);
  const instructions = config?.instructions?.trim() || '';
  const note = config?.note?.trim() || '';

  const hasAnyDetails = Boolean(
    bankOrNetwork ||
      accountTitle ||
      accountNumber ||
      ibanOrAddress ||
      paymentLink ||
      instructions ||
      note
  );

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-blue-950/35 border border-sky-500/40 space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-sky-200 flex items-center gap-1.5">
          {methodId === 'binance' ? (
            <Wallet className="w-4 h-4 text-amber-300 shrink-0" />
          ) : (
            <Landmark className="w-4 h-4 text-sky-300 shrink-0" />
          )}
          <span>بيانات التحويل / الدفع عبر {meta.name}</span>
        </span>
        {typeof amountSar === 'number' && amountSar > 0 && (
          <span className="font-num font-bold text-emerald-300">
            المبلغ المطلوب: {amountSar} ريال
          </span>
        )}
      </div>

      {!hasAnyDetails ? (
        <p className="text-[11px] text-slate-300 leading-relaxed">
          لم تقم الإدارة بإضافة تفاصيل حساب التحويل لهذه الوسيلة بعد. يمكنك اختيار وسيلة أخرى أو إرفاق الفاتورة والتواصل مع الدعم الفني عند الحاجة.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {bankOrNetwork && (
              <div className="p-2 rounded-lg bg-slate-950/75 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  {methodId === 'binance' ? 'الشبكة / المنصة' : 'اسم البنك / الجهة'}
                </div>
                <div className="font-bold text-slate-100 mt-0.5">{bankOrNetwork}</div>
              </div>
            )}

            {accountTitle && (
              <div className="p-2 rounded-lg bg-slate-950/75 border border-slate-800">
                <div className="text-[10px] text-slate-400">اسم المستفيد / صاحب الحساب</div>
                <div className="font-bold text-slate-100 mt-0.5">{accountTitle}</div>
              </div>
            )}

            {accountNumber && (
              <div className="p-2 rounded-lg bg-slate-950/75 border border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400">
                    {methodId === 'binance' ? 'Binance Pay ID' : 'رقم الحساب / الجوال'}
                  </div>
                  <div className="font-num font-bold text-amber-200 truncate mt-0.5">
                    {accountNumber}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy('acc', accountNumber)}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold inline-flex items-center gap-1"
                >
                  {copiedKey === 'acc' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>نُسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {ibanOrAddress && (
              <div className="p-2 rounded-lg bg-slate-950/75 border border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400">
                    {methodId === 'binance' ? 'عنوان المحفظة (USDT / Address)' : 'رقم الآيبان (IBAN)'}
                  </div>
                  <div className="font-num font-bold text-emerald-200 truncate mt-0.5">
                    {ibanOrAddress}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy('iban', ibanOrAddress)}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold inline-flex items-center gap-1"
                >
                  {copiedKey === 'iban' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>نُسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {paymentLink && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/75 border border-slate-800">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-slate-400">رابط الدفع المباشر</div>
                <div className="font-num text-[11px] text-sky-300 truncate">{paymentLink}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleCopy('link', paymentLink)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold inline-flex items-center gap-1"
                >
                  {copiedKey === 'link' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>نُسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>
                <a
                  href={paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold inline-flex items-center gap-1"
                >
                  <span>فتح رابط الدفع</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {(instructions || note) && (
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/90 text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">
              {instructions || note}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
