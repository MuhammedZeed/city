import React from 'react';
import { CheckCircle2, FileText, Shield, X } from 'lucide-react';

export interface PolicyClause {
  number: string;
  title: string;
  points: string[];
}

export const LEGAL_POLICY_CLAUSES: PolicyClause[] = [
  {
    number: 'أولاً',
    title: 'نطاق الاتفاقية والأهلية النظامية',
    points: [
      'يُعد إنشاء الحساب أو رفع طلب التسجيل أو استخدام أي من خدمات لعبة ENGINORA CITY إقرارًا صريحًا وموافقة كاملة غير مشروطة على كافة بنود سياسة الخصوصية والشروط والأحكام الواردة في هذه الوثيقة.',
      'يقر المستخدم بأنه يتمتع بالأهلية النظامية الكاملة للتعاقد وإتمام المدفوعات، وفي حال كان دون السن النظامي يلتزم بالحصول على موافقة ولي الأمر وتحت مسؤوليته الكاملة.',
    ],
  },
  {
    number: 'ثانياً',
    title: 'سياسة الخصوصية وحماية البيانات الشخصية',
    points: [
      'تجمع المنصة البيانات المطلوبة عند التسجيل (الاسم المستعار باللعبة، الاسم الحقيقي الكامل، رقم الهوية الوطنية أو الإقامة، البريد الإلكتروني، رقم الجوال، وصورة فاتورة السداد) حصريًا لأغراض توثيق العضوية، منع تعدد الحسابات الوهمية، التحقق من صحة المدفوعات، وتقديم الدعم الفني.',
      'تلتزم الإدارة بالحفاظ على سرية بيانات اللاعبين وعدم بيعها أو تأجيرها أو تداولها مع أي جهات تسويقية أو أطراف ثالثة، ويقتصر الاطلاع عليها على الفريق المخوّل بمراجعة الطلبات وحماية النظام.',
      'يحق للمنصة الاحتفاظ بسجلات الدخول والمعاملات داخل اللعبة والطلبات المالية لأغراض التدقيق المالي والتنظيمي ومكافحة الاحتيال طوال مدة بقاء الحساب وبعد إغلاقه وفق المتطلبات النظامية.',
    ],
  },
  {
    number: 'ثالثاً',
    title: 'سياسة عدم الاسترداد النهائي لجميع المدفوعات والمشتريات',
    points: [
      'جميع المبالغ المدفوعة داخل المنصة — وتشمل على سبيل المثال لا الحصر: رسوم التسجيل وتفعيل الحساب (200 ريال سعودي)، باقات شحن الجواهر، اشتراكات المساعد الذكي، الاشتراكات الشهرية، بطاقات التسريع، دروع الحماية، التعزيزات، وأي خدمات أو عناصر رقمية — هي مدفوعات نهائية وغير قابلة للاسترداد أو الإلغاء أو الاسترجاع أو الاستبدال النقدي تحت أي ظرف.',
      'بمجرد إرسال طلب التسجيل مع صورة الفاتورة أو تنفيذ عملية شراء رقمية واعتمادها في الحساب، يسقط حق المطالبة بالاسترجاع سواء استخدم اللاعب العناصر أم لم يستخدمها، وسواء رغب في التوقف عن اللعب أو تم تعليق حسابه لمخالفة الشروط.',
      'تُراجع طلبات الدفع وفواتير التحويل عبر صورة الفاتورة المرفقة (ويُعد الرقم المرجعي اختياريًا)، ولا تتحمل الإدارة أي مسؤولية عن تحويلات خاطئة إلى حسابات غير معتمدة أو فواتير غير واضحة أو مزورة.',
    ],
  },
  {
    number: 'رابعاً',
    title: 'إخلاء المسؤولية المالية وعدم الوعد بتحقيق دخل أو أرباح',
    points: [
      'ENGINORA CITY هي لعبة استراتيجية ترفيهية بحتة، ولا تُعد بأي شكل من الأشكال مشروعًا استثماريًا أو أداة ادخار أو برنامج ربح أو وسيلة للكسب المالي.',
      'تؤكد الإدارة بشكل قاطع أنها لا تقدم أي وعود أو ضمانات صريحة أو ضمنية بتحقيق أي دخل مادي أو عوائد مالية أو أرباح نقدية للاعبين نتيجة اللعب أو تطوير المدن أو التداول في سوق الموارد.',
      'جميع الجواهر (ENGINORA GEMS) والموارد ونقاط التجارة داخل اللعبة هي وحدات لعب افتراضية مخصصة للتنافس وتطوير المدينة فقط، ولا تمثل أموالاً حقيقية أو أصولاً مالية، ولا تلتزم الإدارة بتحويلها إلى نقد أو استبدالها بمبالغ مالية.',
    ],
  },
  {
    number: 'خامساً',
    title: 'طبيعة العناصر الافتراضية وحظر التداول الخارجي',
    points: [
      'جميع الحسابات والمدن والمباني والأساطيل والموارد والجواهر ونقاط التجارة تظل مملوكة للمنصة، ويُمنح اللاعب ترخيص استخدام شخصي محدود غير قابل للتحويل أو التنازل.',
      'يُحظر حظرًا تامًا بيع الحسابات أو تأجيرها أو تداول الجواهر أو الموارد أو نقاط التجارة مقابل مبالغ مالية أو خدمات خارج المنصة، ويُعد أي اتفاق خارجي باطلاً ويؤدي إلى إغلاق الحساب نهائيًا دون أي تعويض أو استرداد.',
    ],
  },
  {
    number: 'سادساً',
    title: 'نزاهة اللعب وحقوق الإدارة في الرقابة والإغلاق',
    points: [
      'يحق للإدارة مراجعة وقبول أو رفض أي طلب تسجيل جديد وفق تقديرها لضمان نزاهة البيئة التنافسية، كما يحق لها تعليق أو تجميد أو إنهاء أي حساب يثبت تورطه في تلاعب بالأسعار، غسل جواهر، استغلال ثغرات برمجية، استخدام برمجيات غير مصرح بها، أو إرفاق فواتير غير صحيحة.',
      'في جميع حالات الإيقاف أو الحظر الناتجة عن مخالفة الشروط، لا تلتزم الإدارة برد أي رسوم أو مبالغ مدفوعة مسبقًا.',
    ],
  },
  {
    number: 'سابعاً',
    title: 'الملكية الفكرية وحق تعديل الأنظمة والسياسات',
    points: [
      'كافة التصاميم والأكواد والأنظمة والشعارات والنصوص والصور داخل ENGINORA CITY محمية بموجب حقوق الملكية الفكرية، ويُحظر نسخها أو استخراجها أو إعادة نشرها أو محاولة فك تشفيرها.',
      'تحتفظ الإدارة بالحق الكامل في تحديث أو تعديل قواعد اللعبة، توازن القوى، الأسعار، المكافآت، أو بنود هذه السياسة في أي وقت، ويُعد استمرار اللاعب في استخدام المنصة موافقة نافذة على النسخة المحدّثة.',
    ],
  },
  {
    number: 'ثامناً',
    title: 'حدود المسؤولية والتوقيت المعتمد داخل اللعبة',
    points: [
      'تُقدَّم الخدمة وفق حالتها التقنية المتاحة دون ضمان خلوها المطلق من الأعطال الطارئة أو انقطاعات الشبكة الخارجة عن السيطرة، ولا تتحمل الإدارة مسؤولية أي أضرار غير مباشرة.',
      'التوقيت الرسمي المعتمد لكافة العمليات والمراجعات والدورات اليومية والأسبوعية داخل اللعبة هو التوقيت العالمي (UTC)، وتبدأ دورة اليوم الجديد عند الساعة 21:00 بتوقيت UTC.',
    ],
  },
];

interface LegalPoliciesModalProps {
  onClose: () => void;
  onAccept?: () => void;
  alreadyAccepted?: boolean;
}

export const LegalPoliciesModal: React.FC<LegalPoliciesModalProps> = ({
  onClose,
  onAccept,
  alreadyAccepted,
}) => {
  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90dvh] rounded-2xl bg-[#0A1224] border border-amber-500/40 shadow-2xl flex flex-col overflow-hidden text-xs"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/45 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-amber-300">
                سياسة الخصوصية والشروط والأحكام وضمان الحقوق
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                وثيقة تنظيمية ملزمة لاستخدام لعبة ومنصة ENGINORA CITY
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Highlights Banner */}
        <div className="px-4 sm:px-6 py-3 bg-rose-950/30 border-b border-rose-500/30 grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0 text-[11px]">
          <div className="flex items-center gap-2 text-amber-200 font-semibold">
            <Shield className="w-4 h-4 text-amber-300 shrink-0" />
            <span>حماية بيانات التوثيق وعدم مشاركتها</span>
          </div>
          <div className="flex items-center gap-2 text-rose-200 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>لا يوجد استرداد مالي مقابل العناصر أو الرسوم</span>
          </div>
          <div className="flex items-center gap-2 text-sky-200 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span>لعبة ترفيهية — لا وعود بتحقيق دخل أو أرباح</span>
          </div>
        </div>

        {/* Ordered Clauses */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {LEGAL_POLICY_CLAUSES.map((clause) => (
            <section
              key={clause.number}
              className="rounded-xl bg-slate-900/75 border border-slate-800 p-4 space-y-2"
            >
              <h4 className="text-sm font-bold text-amber-300">
                {clause.number}: {clause.title}
              </h4>
              <ul className="space-y-1.5 text-slate-200 leading-relaxed list-disc pr-5">
                {clause.points.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-400">
            ENGINORA CITY — القبول بهذه البنود شرط أساسي لإتمام التسجيل واستخدام المنصة.
          </span>
          <div className="flex items-center gap-2">
            {onAccept ? (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {alreadyAccepted
                    ? 'تمت الموافقة — إغلاق'
                    : 'أوافق على سياسة الخصوصية والشروط الكاملة'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
