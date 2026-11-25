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
import { AdminConfig } from '../types/game';
import { PAYMENT_METHODS_META } from '../data/gameData';

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

  const v32Addendum = `# التحديث التكميلي الشامل (v3.2) — القرارات والتطويرات المنفذة حتى تاريخه

**تاريخ التوليد:** ${generatedAt}  
**نطاق الوثيقة:** تدمج هذه الوثيقة الكاملة المرجع المعتمد (GDD v3.1) مع ملحق تسعير السوق المرجعي والتحديثات البرمجية والإدارية المعتمدة والمنفذة فعليًا في المشروع حتى الإصدار الحالي (**v3.2**).

---

## أ. التحديثات الزمنية والقانونية والحوكمية
1. **التوقيت الرسمي العالمي (UTC):**
   - تم استبدال العرض الإقليمي بالتوقيت العالمي الموحد (**UTC**) في جميع واجهات اللعبة والسجلات الإدارية لضمان ثبات النتائج عالميًا بغض النظر عن منطقة اللاعب.
   - **بداية اليوم الجديد داخل اللعبة:** الساعة **21:00 بتوقيت UTC** (وهو ما يعادل 12:00 منتصف الليل بتوقيت السعودية).
   - **بداية الأسبوع الجديد:** الساعة **21:00 بتوقيت UTC مساء يوم الأحد** (المعادل لبداية يوم الاثنين 12:00 صباحًا بتوقيت السعودية).
2. **إخفاء تفاصيل الحوكمة الداخلية عن اللاعبين:**
   - لا يظهر أي ذكر لعبارة «الأمن والحوكمة» أو آليات الرقابة والتدقيق الداخلية في شاشة دخول اللاعب أو واجهاته.
   - إزالة الإشارات إلى الأنظمة السعودية المحلية من سياسات الدخول والاكتفاء بصياغة دولية تحمي حقوق مالك المشروع.

---

## ب. بوابة تسجيل اللاعبين والسياسات الملزمة
1. **واجهة دخول استراتيجية مخصصة:**
   - شاشة دخول بخلفية قيادية استراتيجية خاصة باللعبة.
   - حقول التسجيل المطلوبة: الاسم المستعار باللعبة، الاسم الحقيقي، رقم الهوية، البريد الإلكتروني، رقم الجوال، اختيار وسيلة الدفع، وإرفاق **صورة فاتورة دفع رسوم التفعيل** (الافتراضي **${adminConfig.registrationFeeSar ?? 200} ريال سعودي** قبل خصم وسيلة الدفع).
   - **الرقم المرجعي للعملية اختياري**؛ وتُعد صورة الفاتورة/الإيصال المرفقة هي الأساس لمراجعة المؤسس واعتماد الحساب يدويًا.
2. **السياسات والشروط الملزمة قبل الإرسال (موافقة إجبارية):**
   - عدم استرداد قيمة أي عناصر رقمية أو باقات أو اشتراكات أو رسوم تفعيل بعد الاعتماد والتسليم داخل اللعبة.
   - عدم تقديم أي وعد أو ضمان بتحقيق دخل أو أرباح مالية من اللعب أو من سوق التجارة أو نقاط المكافآت.
   - رصيد التجارة ونقاط المكافآت مخصص للتطوير المستقبلي ولا يمثل التزامًا ماليًا بالسحب حاليًا.
   - منع تعدد الحسابات أو التحايل التجاري، مع مراجعة يدوية كاملة قبل أي تفعيل.

---

## ج. إدارة السيرفرات وبوابة الإغلاق وسعة اللاعبين
1. **سعة السيرفر المعتمدة:**
   - السعة القياسية المبدئية للسيرفر الواحد **150 لاعبًا** (مناسب للتشغيل الفعلي من 100 إلى 150 لاعبًا قابلة للتعديل من لوحة المؤسس).
2. **التحكم الفوري بفتح وإغلاق كل سيرفر (تبويب «السيرفرات»):**
   - تبدأ السيرفرات الافتراضية **مغلقة** لحين قرار المؤسس بافتتاحها للجميع.
   - عند إيقاف السيرفر، تظهر للاعب في شاشة الدخول رسالة واضحة: **«السيرفر مغلق حاليًا»** ويُمنع من الدخول حتى تفعيله من لوحة الإدارة.
3. **حالة السيرفرات الحالية وقت التصدير:**
${serversSummary}

---

## د. لوحة الأسعار الشاملة ووسائل الدفع والخصومات (تبويب «الأسعار والدفع»)
1. **وسائل الدفع الأربع المتاحة وإعدادات الخصم لكل وسيلة:**
${paymentMethodsSummary}
   - عند تحديد نسبة خصم مئوية على وسيلة دفع معينة (مثلاً بايننس أو Apple Pay)، تُحتسب القيمة المخفضة تلقائيًا للاعب في شاشة تسجيل الدخول، وشحن الجواهر، واشتراك حكيم، وباقة VIP.
2. **باقات شحن الجواهر الحالية:**
| الباقة | الجواهر الأساسية | الجواهر الإضافية | الإجمالي | السعر بالريال |
| --- | ---: | ---: | ---: | ---: |
${gemPacksSummary}
3. **الأسعار والمعاملات الأخرى المعتمدة حاليًا:**
   - رسوم تفعيل الحساب الجديد: **${adminConfig.registrationFeeSar ?? 200} ريال**.
   - اشتراك المستشار الذكي (حكيم): **${adminConfig.hakimPriceSar} ريال** لمدة **${adminConfig.hakimDurationDays} يومًا**.
   - اشتراك الباقة الشهرية VIP: **${adminConfig.vipPriceSar} ريال** (${adminConfig.vipPriceUsd} دولار) لمدة **${adminConfig.vipDurationDays} يومًا**.
   - تعزيز الهجوم (+10% لمدة 24 ساعة): **${adminConfig.attackBoostGems} جوهرة** · تعزيز الدفاع (+10% لمدة 24 ساعة): **${adminConfig.defenseBoostGems} جوهرة**.
   - الإنهاء الفوري للبناء: **${adminConfig.instantFinishGemsPerBlock} جوهرة** لكل **${adminConfig.instantFinishBlockMinutes} دقائق** (أو جزء منها).
   - تسريع حركة الجيش: **${adminConfig.marchSpeedUpGemsPerMin} جوهرة** لكل دقيقة مختصرة.
   - دروع الحماية: 24 ساعة (**${adminConfig.shieldPricesGems['24h']}**)، 3 أيام (**${adminConfig.shieldPricesGems['3d']}**)، أسبوع (**${adminConfig.shieldPricesGems['7d']}**)، شهر (**${adminConfig.shieldPricesGems['30d']}**) جوهرة.
   - عمولة السوق: **${adminConfig.marketFeePct}%** · مدة العرض: **${adminConfig.marketOfferDurationDays} أيام** · حظر إعادة بيع الموارد المشتراة: **${adminConfig.marketResaleHoldDays} يومًا** · معامل نقاط التجارة: **${adminConfig.tradePointsPer100NetGems} نقطة لكل 100 جوهرة صافية** (بحد أدنى بين قيمة البيع الفعلية والقيمة المرجعية للكمية).

---

## هـ. تحديث نظام المكافآت الشهرية (30 يومًا)
- **المسار المجاني:** موارد يومية وبطاقات تسريع متدرجة طوال 30 يومًا **دون منح جواهر**.
- **مسار VIP المدفوع:** موارد أعلى وبطاقات تسريع يومية من اليوم 1 إلى اليوم 29 (**0 جواهر**)، وتُمنح الجائزة الكبرى **100 جوهرة في اليوم 30 فقط** لحفظ توازن الاقتصاد.

---

## و. دخول المؤسس للاختبار والحماية المطلقة للسورس كود
1. **دخول المؤسس المباشر للعبة:**
   - تتوفر أزرار مخصصة للمؤسس في أعلى شاشة الدخول (**«دخول الإدارة للعبة»** و**«لوحة الإدارة»**) وداخل لوحة الإدارة (**«دخول مباشر للعبة للاختبار»**) مع إمكانية العودة للوحة الإدارة في أي لحظة.
2. **التقارير المالية الواضحة (تبويب «التقارير المالية»):**
   - فصل الإيرادات المعتمدة بالريال حسب المصدر (رسوم التفعيل، باقات الجواهر، حكيم، VIP) عن الجواهر المتداولة والمنفقة وعمولات السوق ونقاط التجارة والمبالغ المستردة.
3. **حصرية النسخ الاحتياطي والسورس كود والوثيقة للمؤسس فقط:**
   - تبويب **«النسخ الاحتياطي»** محصور برمجيًا على حساب **المؤسس فقط (founder)** وممنوع تمامًا على الشريك والدعم الفني واللاعبين.
   - يتضمن هذا القسم أدوات حفظ/استعادة بيانات التشغيل (JSON) بالإضافة إلى **تنزيل ملفات اللعبة الكاملة (ZIP)** و**تنزيل الوثيقة الكاملة** دون استضافة أي ملفات مصدرية على روابط عامة.

---

# القسم المرجعي الكامل (وثيقة التصميم الموحدة v3.1)

${baseGddText.trim()}

---

# الملحق الاقتصادي (الأسعار المرجعية للسوق ونقاط التجارة)

${marketAddendumText.trim()}
`;

  return v32Addendum;
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

      if (vault.baseGddText) {
        zip.file('docs/ENGINORA_CITY_GDD_v3.1.txt', vault.baseGddText);
        addedFiles += 1;
      }
      if (vault.marketAddendumText) {
        zip.file('docs/MARKET_PRICING_ADDENDUM.txt', vault.marketAddendumText);
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

      const imageResults = await Promise.allSettled(
        vault.imageFiles.map(async (imgName) => {
          const res = await fetch(`/src/assets/images/${encodeURIComponent(imgName)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = await res.arrayBuffer();
          return { imgName, buffer };
        })
      );

      let addedImages = 0;
      for (const item of imageResults) {
        if (item.status === 'fulfilled') {
          zip.file(`src/assets/images/${item.value.imgName}`, item.value.buffer);
          addedImages += 1;
        }
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ENGINORA_CITY_SOURCE_CODE_v3.2_${stamp}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatusMessage(
        `تم تجهيز وتنزيل حزمة ملفات اللعبة الكاملة بنجاح (${addedFiles} ملفًا برمجيًا وتوثيقيًا + ${addedImages} صورة أصلية).`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `تعذر ضغط وتنزيل ملفات اللعبة: ${err.message}`
          : 'حدث خطأ أثناء تجهيز أرشيف ملفات اللعبة.'
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
            <span>خزنة المؤسس: تنزيل ملفات اللعبة والوثيقة الكاملة</span>
          </h3>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            هذا القسم حصري تمامًا لحساب <strong>المؤسس فقط</strong>؛ لا يظهر للشريك أو الدعم الفني أو اللاعبين، ولا توجد أي روابط عامة لملفات المشروع.
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
              <span>ملفات اللعبة الكاملة (السورس كود)</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              حزمة ZIP محدثة تشمل كامل ملفات الكود (src)، الإعدادات (package.json, vite.config, index.html)، الصور الأصلية، والوثيقة الكاملة وجاهزة للرفع على GitHub و Cloudflare Pages.
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
                <span>جارٍ تجميع وضغط ملفات اللعبة...</span>
              </>
            ) : (
              <>
                <FileArchive className="w-4 h-4" />
                <span>تنزيل ملفات اللعبة الكاملة (ZIP)</span>
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
              ملف توثيقي شامل يدمج الوثيقة المرجعية الكاملة (v3.1)، ملحق تسعير السوق، وجميع التعديلات المنفذة حتى الآن (السيرفرات، الأسعار، الدفع والخصومات، التوقيت العالمي UTC، والسياسات).
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
