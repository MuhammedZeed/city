import React, { useState } from 'react';
import {
  BookOpenText,
  CheckCircle2,
  FileArchive,
  FolderArchive,
  Loader2,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { AdminConfig, PAYMENT_METHODS_META } from '@enginora/shared';

interface FounderVaultSectionProps {
  adminConfig: AdminConfig;
}

function buildConsolidatedDocument(
  baseGddText: string,
  marketAddendumText: string,
  adminConfig: AdminConfig,
  generatedAt: string
): string {
  const serversSummary = (adminConfig.servers ?? [])
    .map(
      (s) =>
        `- **${s.code} — ${s.name}**: السعة المعتمدة ${s.capacity} لاعبًا · الحالة الحالية: ${
          s.isOpen ? 'مفتوح (مفعّل)' : 'مغلق حاليًا'
        }`
    )
    .join('\n');

  const paymentMethodsSummary = (
    Object.keys(PAYMENT_METHODS_META) as (keyof typeof PAYMENT_METHODS_META)[]
  )
    .map((id) => {
      const meta = PAYMENT_METHODS_META[id];
      const cfg = adminConfig.paymentMethods?.[id];
      const status = cfg?.enabled ?? true ? 'مفعّلة' : 'موقفة';
      const discount = cfg?.discountPct ?? 0;
      return `- **${meta.name}**: الحالة (${status}) · نسبة الخصم المخصصة: ${discount}%`;
    })
    .join('\n');

  const gemPacksSummary = (adminConfig.gemPackages ?? [])
    .map(
      (p) =>
        `| ${p.name} | ${p.baseGems} | ${p.bonusGems} | ${p.baseGems + p.bonusGems} | ${p.priceSar} ريال |`
    )
    .join('\n');

  return `# التحديث التكميلي الشامل (v3.2) — القرارات والتطويرات المنفذة حتى تاريخه

**تاريخ التوليد:** ${generatedAt}  
**نطاق الوثيقة:** تدمج هذه الوثيقة الكاملة المرجع المعتمد (GDD v3.1) مع ملحق تسعير السوق المرجعي والتحديثات البرمجية والمعمارية حتى مرحلة فصل مشروع اللعبة ومشروع الإدارة (**v3.2**).

---

## أ. التحديثات الزمنية والقانونية والحوكمية
1. **التوقيت الرسمي العالمي (UTC):**
   - التوقيت المعتمد للعرض والسجلات هو التوقيت العالمي الموحد (**UTC**).
   - **بداية اليوم الجديد داخل اللعبة:** الساعة **21:00 بتوقيت UTC** (ما يعادل 12:00 منتصف الليل بتوقيت السعودية).
   - **بداية الأسبوع الجديد:** الساعة **21:00 بتوقيت UTC مساء يوم الأحد**.
2. **فصل تطبيق اللعبة عن تطبيق الإدارة:**
   - **ENGINORA CITY GAME (\`apps/game\`):** تطبيق مستقل للاعبين يدخل مباشرة إلى اللعبة دون أي شيفرة أو مسارات إدارية.
   - **ENGINORA CITY ADMIN (\`apps/admin\`):** تطبيق مستقل لصاحب المشروع والإدارة يرتبط مستقبلًا بالخادم المشترك وقاعدة البيانات **Cloudflare D1** مع حماية الصلاحيات من جهة الخادم.
   - **الحزمة المشتركة (\`packages/shared\`):** توحد نماذج البيانات، ثوابت الاقتصاد، ودوال المحرك الأساسية وعقود الـ API.

---

## ب. بوابة تسجيل اللاعبين والسياسات الملزمة
- واجهة دخول استراتيجية مخصصة مع حقول: الاسم المستعار، الاسم الحقيقي، الهوية، البريد، الجوال، السيرفر، وسيلة الدفع، وإرفاق صورة الفاتورة (والرقم المرجعي اختياري).
- الموافقة الإلزامية على السياسات (عدم الاسترداد، عدم الوعد بتحقيق دخل، ومنع التلاعب).

---

## ج. إدارة السيرفرات وبوابة الإغلاق وسعة اللاعبين
${serversSummary}

---

## د. وسائل الدفع الأربع والخصومات وجدول الجواهر
${paymentMethodsSummary}

| الباقة | الجواهر الأساسية | الجواهر الإضافية | الإجمالي | السعر بالريال |
| --- | ---: | ---: | ---: | ---: |
${gemPacksSummary}

---

# القسم المرجعي الكامل (وثيقة التصميم الموحدة v3.1)

${baseGddText.trim()}

---

# الملحق الاقتصادي (الأسعار المرجعية للسوق ونقاط التجارة)

${marketAddendumText.trim()}
`;
}

export const FounderVaultSection: React.FC<FounderVaultSectionProps> = ({
  adminConfig,
}) => {
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadDocument = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setDownloadingDoc(true);
    try {
      const vaultMod = await import('virtual:founder-source-vault');
      const vault = vaultMod.default;
      const fullDoc = buildConsolidatedDocument(
        vault.baseGddText,
        vault.marketAddendumText,
        adminConfig,
        vault.generatedAt
      );
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob(['\uFEFF' + fullDoc], {
        type: 'text/markdown;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ENGINORA_CITY_FULL_DOCUMENT_v3.2_${stamp}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatusMessage('تم تنزيل الوثيقة الكاملة المحدثة (v3.2) بنجاح.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `تعذر تجهيز الوثيقة: ${err.message}`
          : 'تعذر تجهيز الوثيقة الكاملة حاليًا.'
      );
    } finally {
      setDownloadingDoc(false);
    }
  };

  const handleDownloadSourceZip = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setDownloadingZip(true);
    try {
      const [{ default: JSZip }, vaultMod] = await Promise.all([
        import('jszip'),
        import('virtual:founder-source-vault'),
      ]);
      const vault = vaultMod.default;
      const zip = new JSZip();

      let addedFiles = 0;
      for (const [relPath, content] of Object.entries(vault.textFiles)) {
        zip.file(relPath, content);
        addedFiles += 1;
      }

      const fullDoc = buildConsolidatedDocument(
        vault.baseGddText,
        vault.marketAddendumText,
        adminConfig,
        vault.generatedAt
      );
      zip.file('ENGINORA_CITY_FULL_DOCUMENT_v3.2.md', '\uFEFF' + fullDoc);
      addedFiles += 1;

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ENGINORA_CITY_SEPARATED_PROJECTS_v3.2_${stamp}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatusMessage(
        `تم تجهيز وتنزيل حزمة المشروعين والحزمة المشتركة بنجاح (${addedFiles} ملفًا).`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `تعذر ضغط وتنزيل ملفات المشروعين: ${err.message}`
          : 'حدث خطأ أثناء تجهيز أرشيف الملفات.'
      );
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border-amber-500/45 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <FolderArchive className="w-4 h-4 shrink-0" />
            <span>خزنة المؤسس: تنزيل ملفات المشروعين والوثيقة الكاملة</span>
          </h3>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            هذا القسم حصري تمامًا لحساب <strong>المؤسس فقط</strong>؛ لا يظهر للشريك أو الدعم الفني، وغير موجود نهائيًا في مشروع اللعبة.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[11px] font-bold shrink-0">
          <Lock className="w-3.5 h-3.5" />
          <span>سري — للمؤسس فقط</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="glass-subpanel p-4 rounded-xl border border-emerald-500/35 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
              <FileArchive className="w-4 h-4 shrink-0" />
              <span>ملفات المشروعين والحزمة المشتركة (ZIP)</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              حزمة تشمل كود مشروع اللعبة المستقل (apps/game)، كود مشروع الإدارة المستقل (apps/admin)، الحزمة المشتركة (packages/shared)، والوثيقة الكاملة.
            </p>
          </div>
          <button
            type="button"
            disabled={downloadingZip}
            onClick={handleDownloadSourceZip}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            {downloadingZip ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ تجميع وضغط الملفات...</span>
              </>
            ) : (
              <>
                <FileArchive className="w-4 h-4" />
                <span>تنزيل ملفات المشروعين (ZIP)</span>
              </>
            )}
          </button>
        </div>

        <div className="glass-subpanel p-4 rounded-xl border border-sky-500/35 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="font-bold text-sky-300 flex items-center gap-1.5 text-xs">
              <BookOpenText className="w-4 h-4 shrink-0" />
              <span>الوثيقة الكاملة المحدثة (GDD v3.2)</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              ملف توثيقي شامل يدمج الوثيقة المرجعية الكاملة (v3.1)، ملحق تسعير السوق، وجميع التعديلات المنفذة حتى الآن.
            </p>
          </div>
          <button
            type="button"
            disabled={downloadingDoc}
            onClick={handleDownloadDocument}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            {downloadingDoc ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ تجهيز الوثيقة الكاملة...</span>
              </>
            ) : (
              <>
                <BookOpenText className="w-4 h-4" />
                <span>تنزيل الوثيقة الكاملة (GDD v3.2)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/65 border border-emerald-500/45 text-emerald-200 flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/65 border border-rose-500/45 text-rose-200 flex items-center gap-2 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

export default FounderVaultSection;
