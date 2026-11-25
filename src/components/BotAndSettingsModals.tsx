import React, { useState } from 'react';
import {
  Anchor,
  Bot,
  Check,
  CheckCircle2,
  Compass,
  FileText,
  FlaskConical,
  Hammer,
  HelpCircle,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { LegalPoliciesModal } from './LegalPoliciesModal';
import { SMART_BOT_PLANS, SPEEDUP_CARDS_META } from '../data/gameData';
import {
  ADVISOR_QUICK_CATEGORIES,
  AdvisorActionLink,
  AdvisorQaResponse,
  FREE_ADVISOR_PORTRAIT,
  SMART_ADVISOR_PORTRAIT,
  StrategicPlanStep,
  answerPlayerQuestion,
  buildSmartStrategicPlan,
} from '../engine/advisorEngine';
import { formatDuration } from '../engine/gameEngine';
import {
  BotConfig,
  GameState,
  NavSection,
  SmartBotPlanId,
  SpeedUpTierId,
} from '../types/game';

export type AdvisorModalTab = 'qa' | 'strategy' | 'delegation' | 'tiers';

interface ChatMessage {
  id: string;
  sender: 'player' | 'advisor';
  text?: string;
  qa?: AdvisorQaResponse;
}

export const BotModal: React.FC<{
  state: GameState;
  now: number;
  initialTab?: AdvisorModalTab;
  onClose: () => void;
  onToggleSmartBot: () => void;
  onUpdateBotConfig: (patch: Partial<BotConfig>) => void;
  onRunBotPlanStep: () => void;
  onRunSmartCycle: () => void;
  onExecuteStep: (step: StrategicPlanStep) => void;
  onRunBotResourceRaid: () => void;
  onNavigateAndFocus: (section: NavSection, plotId?: string) => void;
}> = ({
  state,
  now,
  initialTab = 'qa',
  onClose,
  onToggleSmartBot,
  onUpdateBotConfig,
  onRunBotPlanStep,
  onRunSmartCycle,
  onExecuteStep,
  onRunBotResourceRaid,
  onNavigateAndFocus,
}) => {
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [tab, setTab] = useState<AdvisorModalTab>(initialTab);
  const [selectedQaCategory, setSelectedQaCategory] = useState(
    ADVISOR_QUICK_CATEGORIES[0].id
  );
  const [questionInput, setQuestionInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init-greeting',
      sender: 'advisor',
      qa: answerPlayerQuestion('ملخص', state),
    },
  ]);

  const isSmart = state.smartBotActive;
  const portraitSrc = isSmart ? SMART_ADVISOR_PORTRAIT : FREE_ADVISOR_PORTRAIT;
  const speakerName = isSmart
    ? 'كبير المستشارين الاستراتيجيين: حكيم'
    : 'المستشار الميداني: طارق (المساعد المجاني)';

  const analysis = buildSmartStrategicPlan(state, now);
  const activePlan =
    SMART_BOT_PLANS[state.botConfig.planId] ?? SMART_BOT_PLANS.balanced_economy;

  const handleAskQuestion = (qText: string) => {
    const trimmed = qText.trim();
    if (!trimmed) return;
    const response = answerPlayerQuestion(trimmed, state);
    const stamp = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `u-${stamp}`, sender: 'player', text: trimmed },
      { id: `a-${stamp + 1}`, sender: 'advisor', qa: response },
    ]);
    setQuestionInput('');
  };

  const handleActionLink = (action?: AdvisorActionLink) => {
    if (!action) return;
    if (action.runStep) {
      onRunBotPlanStep();
      return;
    }
    if (action.openModalTab) {
      setTab(action.openModalTab);
      return;
    }
    if (action.section) {
      onNavigateAndFocus(action.section, action.plotId);
      onClose();
    }
  };

  const stepCategoryMeta = (cat: StrategicPlanStep['category']) => {
    switch (cat) {
      case 'hq':
        return { label: 'المبنى الرئيسي', icon: Compass, badge: 'bg-amber-500/20 text-amber-300 border-amber-400/50' };
      case 'research':
        return { label: 'أبحاث', icon: FlaskConical, badge: 'bg-sky-500/20 text-sky-300 border-sky-400/50' };
      case 'maritime':
        return { label: 'بحري', icon: Anchor, badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' };
      case 'military':
      case 'raid':
        return { label: 'عسكري', icon: Swords, badge: 'bg-rose-500/20 text-rose-300 border-rose-400/50' };
      default:
        return { label: 'بناء', icon: Hammer, badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-4xl rounded-2xl glass-panel shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        {/* Character-Driven Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 bg-[#0B1222]/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {!portraitFailed ? (
              <img
                src={portraitSrc}
                alt={speakerName}
                referrerPolicy="no-referrer"
                onError={() => setPortraitFailed(true)}
                className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl object-cover shrink-0 border-2 ${
                  isSmart ? 'border-amber-400' : 'border-sky-400'
                }`}
              />
            ) : (
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-blue-950 border border-amber-400/50 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                  {speakerName}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    isSmart
                      ? 'bg-amber-500/15 border-amber-400/60 text-amber-300'
                      : 'bg-sky-500/15 border-sky-400/60 text-sky-300'
                  }`}
                >
                  {isSmart ? 'الوضع الذكي: 4 بناء · 2 بحث' : 'الوضع المجاني: 2 بناء · 1 بحث'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {analysis.currentPhaseLabel} · الخطة: {activePlan.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100 shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-3 sm:px-5 py-2 bg-slate-950/75 border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'qa', label: 'اسأل المستشار (أساسيات اللعبة)', icon: HelpCircle },
            { id: 'strategy', label: 'الخطط الاستراتيجية والتنفيذ', icon: Compass },
            { id: 'delegation', label: 'تفويض المهام وحقول الموارد', icon: Wrench },
            { id: 'tiers', label: 'المساعد المجاني مقابل الذكي', icon: Sparkles },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as AdvisorModalTab)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                  tab === t.id
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Bodies */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* TAB 1: Free Assistant Interactive Knowledge Q&A */}
          {tab === 'qa' && (
            <div className="space-y-4">
              {/* Quick Question Categories */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sky-300 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    <span>موسوعة القواعد والأساسيات — اختر سؤالاً أو اكتب استفسارك:</span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {ADVISOR_QUICK_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedQaCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                        selectedQaCategory === cat.id
                          ? 'bg-sky-600 border-sky-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {(
                    ADVISOR_QUICK_CATEGORIES.find((c) => c.id === selectedQaCategory) ??
                    ADVISOR_QUICK_CATEGORIES[0]
                  ).questions.map((qText) => (
                    <button
                      key={qText}
                      type="button"
                      onClick={() => handleAskQuestion(qText)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950/90 hover:bg-blue-950/70 border border-slate-700 hover:border-sky-400/70 text-[11px] text-slate-200 text-right transition-colors"
                    >
                      {qText}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {messages.map((msg) =>
                  msg.sender === 'player' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] px-3.5 py-2 rounded-xl bg-[#1D4ED8] text-white font-semibold">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    msg.qa && (
                      <div key={msg.id} className="flex items-start gap-2.5">
                        <img
                          src={FREE_ADVISOR_PORTRAIT}
                          alt="المستشار طارق"
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-lg object-cover border border-sky-400/60 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 p-3.5 rounded-xl bg-slate-900 border border-sky-500/35 space-y-2">
                          <div className="font-bold text-amber-300 text-sm">
                            {msg.qa.topicTitle}
                          </div>
                          <div className="space-y-1.5 text-slate-200 leading-relaxed">
                            {msg.qa.answerLines.map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                          {msg.qa.tips.length > 0 && (
                            <div className="pt-2 border-t border-slate-800 space-y-1">
                              {msg.qa.tips.map((tip, i) => (
                                <div key={i} className="text-[11px] text-emerald-300">
                                  · نصيحة: {tip}
                                </div>
                              ))}
                            </div>
                          )}
                          {msg.qa.action && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => handleActionLink(msg.qa?.action)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1.5"
                              >
                                <Compass className="w-3.5 h-3.5" />
                                <span>{msg.qa.action.label}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>

              {/* Free Text Question Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskQuestion(questionInput);
                }}
                className="flex items-center gap-2 pt-2 border-t border-slate-800"
              >
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="اسأل المستشار عن المبنى الرئيسي، المخزن، الميناء، النفط، السوق، أو الجيش..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-sky-400 outline-none text-slate-100"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>اسأل</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: Smart Advisor Multi-Step Strategy & Execution */}
          {tab === 'strategy' && (
            <>
              {/* Real-Time City Diagnostics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">خانات البناء</div>
                  <div className="text-sm font-num font-bold text-amber-300 mt-0.5">
                    {analysis.buildSlotsUsed} / {analysis.buildSlotsMax}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">خانات الأبحاث</div>
                  <div className="text-sm font-num font-bold text-sky-300 mt-0.5">
                    {analysis.researchSlotsUsed} / {analysis.researchSlotsMax}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">امتلاء المخزن</div>
                  <div
                    className={`text-sm font-num font-bold mt-0.5 ${
                      analysis.warehouseFillPct >= 85 ? 'text-rose-400' : 'text-emerald-300'
                    }`}
                  >
                    {analysis.warehouseFillPct}%
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">العمليات البحرية</div>
                  <div className="text-sm font-num font-bold text-cyan-300 mt-0.5">
                    {state.maritime.cargoShips + state.maritime.surveyVessels} سفن
                  </div>
                </div>
              </div>

              {/* Critical-Path Bottleneck Diagnosis + Batch Execution */}
              <div className="p-4 rounded-xl bg-blue-950/35 border border-sky-500/45 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-sky-200">
                    <Compass className="w-4 h-4 text-amber-400" />
                    <span>تشخيص المسار الحرج ({activePlan.name})</span>
                  </div>
                  <button
                    type="button"
                    onClick={onRunSmartCycle}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {isSmart ? 'تنفيذ حزمة الخطة الذكية' : 'تنفيذ الخطوة المثلى الآن'}
                    </span>
                  </button>
                </div>
                <p className="text-slate-200 leading-relaxed">{analysis.bottleneckSummary}</p>
                {state.botConfig.lastActionSummary && (
                  <div className="text-[11px] text-emerald-300 pt-1.5 border-t border-sky-500/20">
                    آخر تنفيذ: {state.botConfig.lastActionSummary}
                  </div>
                )}
              </div>

              {/* Prioritized Tactical Action Queue */}
              <div className="space-y-2">
                <div className="font-bold text-slate-200 text-sm">
                  جدول التنفيذ المرتب حسب الأولوية الاستراتيجية:
                </div>
                <div className="space-y-2">
                  {analysis.steps.map((step, idx) => {
                    const meta = stepCategoryMeta(step.category);
                    const Icon = meta.icon;
                    return (
                      <div
                        key={step.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-num text-[11px] font-bold text-slate-400">
                              #{idx + 1}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold inline-flex items-center gap-1 ${meta.badge}`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{meta.label}</span>
                            </span>
                            <span className="font-bold text-slate-100">{step.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">{step.reason}</p>
                          {step.cost && (
                            <div className="text-[10px] font-num text-slate-400">
                              التكلفة: {step.cost.wheat} قمح · {step.cost.wood} خشب · {step.cost.iron} حديد
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {step.status === 'ready' ? (
                            <button
                              type="button"
                              onClick={() => onExecuteStep(step)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" />
                              <span>تنفيذ</span>
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-amber-300 font-semibold">
                              {step.status === 'queue_full'
                                ? 'الخانات مشغولة'
                                : step.missingText ?? 'قيد الانتظار'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selectable Long-Term Plans */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-200 text-sm">
                    خطط التطوير للمدى المتوسط والطويل:
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      isSmart && state.botConfig.autoDevelopCity
                        ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isSmart && state.botConfig.autoDevelopCity
                      ? 'تُنفذ تلقائيًا فور الاختيار دون تدخل يدوي'
                      : 'اختر خطة وفعّل المستشار الذكي للتنفيذ التلقائي'}
                  </span>
                </div>

                {!isSmart && (
                  <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/45 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-amber-200 text-[11px]">
                      عند اعتماد خطة مع المستشار الذكي، يقوم بالبناء والبحث وتسيير السفن تلقائيًا دون الحاجة لأي تنفيذ يدوي.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleSmartBot();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shrink-0"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>اعتماد الخطة وتفعيل العمل التلقائي</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(SMART_BOT_PLANS) as SmartBotPlanId[]).map((pid) => {
                    const p = SMART_BOT_PLANS[pid];
                    const selected = state.botConfig.planId === pid;
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => {
                          onUpdateBotConfig({ planId: pid, autoDevelopCity: true });
                          if (!isSmart) {
                            onToggleSmartBot();
                          }
                        }}
                        className={`p-3.5 rounded-xl border text-right transition-colors space-y-1.5 ${
                          selected
                            ? 'bg-amber-950/25 border-amber-400/75 text-slate-100'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-amber-300">{p.name}</span>
                          {selected ? (
                            <span className="text-[10px] font-bold text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35">
                              {isSmart ? 'قيد التنفيذ التلقائي' : 'خطة محددة'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              اعتماد وتشغيل تلقائي
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {p.tagline}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Horizon Roadmap */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {activePlan.horizons.map((h) => (
                  <div
                    key={h.phase}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                  >
                    <div className="font-bold text-sky-300">{h.phase}</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{h.goal}</p>
                  </div>
                ))}
              </div>

              {/* Strategic Milestones */}
              <div className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200">
                  مؤشرات التقدم في الخطة الاستراتيجية:
                </div>
                <div className="space-y-1.5">
                  {analysis.milestones.map((m) => (
                    <div key={m.label} className="flex items-center gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          m.completed ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                      />
                      <span
                        className={
                          m.completed ? 'text-emerald-200 font-semibold' : 'text-slate-400'
                        }
                      >
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: Execution Delegation Controls */}
          {tab === 'delegation' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Auto City Development Delegation */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="font-bold text-slate-100 text-sm">
                        تفويض تطوير المدينة والأبحاث والميناء
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBotConfig({
                          autoDevelopCity: !state.botConfig.autoDevelopCity,
                        })
                      }
                      className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                        state.botConfig.autoDevelopCity
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {state.botConfig.autoDevelopCity ? 'مفوض ✓' : 'معطل'}
                    </button>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    ينفذ المستشار تلقائيًا خطوات المسار الحرج للمبنى الرئيسي، يوسع المخزن لتقليل الفائض المكشوف، يطلق الأبحاث المتوافقة مع «{activePlan.name}»، ويشغّل القوافل البحرية ومسح النفط.
                  </p>
                  <button
                    type="button"
                    onClick={onRunSmartCycle}
                    className="w-full py-2 px-3 rounded-lg bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold"
                  >
                    تشغيل دورة تنفيذ ذكية الآن
                  </button>
                </div>

                {/* Auto Resource Field Raids Delegation */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Swords className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold text-slate-100 text-sm">
                        تفويض مهاجمة حقول الموارد
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBotConfig({
                          autoRaidResourceFields:
                            !state.botConfig.autoRaidResourceFields,
                        })
                      }
                      className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                        state.botConfig.autoRaidResourceFields
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {state.botConfig.autoRaidResourceFields ? 'مفوض ✓' : 'معطل'}
                    </button>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    يرسل حملات آلية إلى حقول الموارد الاستراتيجية لجلب القمح والخشب والحديد دون المساس بمدن اللاعبين.
                  </p>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">نسبة الحامية الدفاعية المحجوزة بالمدينة</span>
                      <span className="font-num font-bold text-amber-300">
                        {state.botConfig.minGarrisonReservePct}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[30, 50, 70].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            onUpdateBotConfig({ minGarrisonReservePct: pct })
                          }
                          className={`py-1 rounded border font-num font-bold ${
                            state.botConfig.minGarrisonReservePct === pct
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onRunBotResourceRaid}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                  >
                    إرسال حملة حقول موارد الآن
                  </button>
                </div>
              </div>

              {!state.smartBotActive && (
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/45 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-200">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      التشغيل التلقائي المستمر يتطلب تفعيل وضع المستشار الذكي (4 خانات بناء · 2 بحث).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleSmartBot}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                  >
                    تفعيل المستشار الذكي
                  </button>
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>حدود التفويض السيادي (لا ينفذها المستشار أبدًا دون أمر اللاعب):</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  صفقات البيع والشراء في السوق · الهجوم على مدن اللاعبين · إعلان الحروب التحالفية · اختيار التخصص الرئيسي والثانوي.
                </p>
              </div>
            </>
          )}

          {/* TAB 4: Free Advisor vs Smart Advisor Tiers */}
          {tab === 'tiers' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-900 border border-sky-500/35 space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={FREE_ADVISOR_PORTRAIT}
                      alt="المساعد المجاني طارق"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover border border-sky-400"
                    />
                    <div>
                      <div className="font-bold text-sky-300 text-sm">
                        المستشار المجاني (طارق) — دائم
                      </div>
                      <div className="text-[11px] text-slate-400">
                        مرشد الأساسيات وإدارة المدينة
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-slate-300">
                    <li>· خانتا بناء متزامنتان (2) + خانة بحث واحدة (1)</li>
                    <li>· إجابات تفاعلية كاملة عن كل قوانين وأساسيات ENGINORA CITY</li>
                    <li>· قراءة لحظية لنواقص المبنى الرئيسي والمخزن والميناء والأبحاث</li>
                    <li>· تنفيذ فوري لخطوة الخطة يدويًا بضغطة زر</li>
                  </ul>
                </div>

                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    state.smartBotActive
                      ? 'bg-amber-950/20 border-amber-400/70'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={SMART_ADVISOR_PORTRAIT}
                        alt="المستشار الذكي حكيم"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-amber-400"
                      />
                      <div>
                        <div className="font-bold text-amber-300 text-sm">
                          المستشار الذكي (حكيم) — 3 أشهر
                        </div>
                        <div className="text-[11px] text-slate-400">
                          مخطط استراتيجي ومنفذ ذاتي
                        </div>
                      </div>
                    </div>
                    {state.smartBotActive && state.smartBotExpiresAt && (
                      <span className="font-num text-[11px] text-amber-200">
                        متبقي {formatDuration((state.smartBotExpiresAt - now) / 1000)}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5 text-slate-300">
                    <li>· 4 خانات بناء متزامنة + خانتا أبحاث متزامنتان (2)</li>
                    <li>· تحليل المسار الحرج ومنع امتلاء المخزن تلقائيًا</li>
                    <li>· تشغيل آلي للبناء، الأبحاث، القوافل البحرية، ومسح النفط</li>
                    <li>· تفويض حملات حقول الموارد وحفظ الحامية (بدون تجديد تلقائي)</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <span className="text-slate-400">
                  تبديل وضع المستشار في النسخة التجريبية:
                </span>
                <button
                  type="button"
                  onClick={onToggleSmartBot}
                  className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
                    state.smartBotActive
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {state.smartBotActive
                      ? 'العودة إلى المساعد المجاني (2/1)'
                      : 'تفعيل معاينة المستشار الذكي (4/2)'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<{
  state: GameState;
  now?: number;
  onClose: () => void;
  onUpdateProfile: (commanderName: string, cityName: string) => void;
  onToggleSound: () => void;
  onResetCity: () => void;
  onGenerateTelegramCode?: () => void;
  onLinkTelegram?: (username: string) => void;
  onUnlinkTelegram?: () => void;
  onUpdateTelegramAlerts?: (patch: Partial<GameState['telegram']['alerts']>) => void;
  isAdminTesting?: boolean;
  onReturnToAdminPortal?: () => void;
}> = ({
  state,
  now = Date.now(),
  onClose,
  onUpdateProfile,
  onToggleSound,
  onResetCity,
  onGenerateTelegramCode,
  onLinkTelegram,
  onUnlinkTelegram,
  onUpdateTelegramAlerts,
  isAdminTesting = false,
  onReturnToAdminPortal,
}) => {
  const [cmdName, setCmdName] = useState(state.commanderName);
  const [cityName, setCityName] = useState(state.cityName);
  const [tgUsername, setTgUsername] = useState(state.telegram.username || '');
  const [confirmReset, setConfirmReset] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);

  const tgCodeRemainingSec =
    state.telegram.codeExpiresAt && state.telegram.codeExpiresAt > now
      ? Math.ceil((state.telegram.codeExpiresAt - now) / 1000)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl glass-panel shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 bg-[#0B1222]/90 shrink-0">
          <h3 className="text-base font-bold text-slate-100">إعدادات المدينة والحساب</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5 text-xs overflow-y-auto flex-1">
          {/* Commander & City Rename */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 mb-1">اسم القائد</label>
              <input
                type="text"
                value={cmdName}
                onChange={(e) => setCmdName(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">اسم المدينة</label>
              <input
                type="text"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onUpdateProfile(cmdName.trim() || 'القائد سيف', cityName.trim() || 'عاصمة التاج');
                onClose();
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold"
            >
              حفظ البيانات
            </button>
          </div>

          {/* Account-bound Speed-Up Cards (7 Tiers) */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>بطاقات التسريع المرتبطة بالحساب (7 فئات — غير قابلة للتداول)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(SPEEDUP_CARDS_META) as SpeedUpTierId[]).map((tier) => (
                <div
                  key={tier}
                  className="p-2.5 rounded-xl glass-subpanel flex items-center justify-between"
                >
                  <span className="text-slate-300">{SPEEDUP_CARDS_META[tier].name}</span>
                  <span className="font-num font-bold text-amber-300">
                    ×{state.speedUpCards[tier] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Telegram Linking & Notification Preferences (§52-§54) */}
          {onGenerateTelegramCode && onLinkTelegram && onUnlinkTelegram && onUpdateTelegramAlerts && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-sky-400" />
                  <span>ربط حساب تيليغرام والتنبيهات</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    state.telegram.linked
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {state.telegram.linked ? `مربوط (${state.telegram.username})` : 'غير مربوط'}
                </span>
              </div>

              {state.telegram.linked ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {(
                      [
                        { key: 'market', label: 'تنبيهات السوق والصفقات' },
                        { key: 'purchases', label: 'اعتماد المدفوعات والمشتريات' },
                        { key: 'offerExpiry', label: 'انتهاء مهلة عروض السوق' },
                        { key: 'construction', label: 'اكتمال البناء والترقية' },
                        { key: 'research', label: 'اكتمال الأبحاث التقنية' },
                        { key: 'army', label: 'تحركات الجيش والهجمات' },
                        { key: 'important', label: 'التنبيهات الأمنية الهامة' },
                      ] as const
                    ).map((item) => {
                      const active = state.telegram.alerts[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => onUpdateTelegramAlerts({ [item.key]: !active })}
                          className={`px-3 py-2 rounded-xl border text-right flex items-center justify-between text-[11px] font-semibold transition-colors ${
                            active
                              ? 'bg-sky-950/50 border-sky-400/50 text-sky-100'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className={active ? 'text-emerald-300' : 'text-slate-500'}>
                            {active ? 'مفعّل' : 'معطّل'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={onUnlinkTelegram}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 font-bold text-[11px]"
                  >
                    إلغاء ربط تيليغرام
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={onGenerateTelegramCode}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px]"
                    >
                      توليد كود ربط مؤقت (15 دقيقة)
                    </button>
                    {state.telegram.verificationCode && tgCodeRemainingSec > 0 && (
                      <div className="font-num text-amber-300 font-bold">
                        {state.telegram.verificationCode}{' '}
                        <span className="text-[10px] text-slate-400">
                          ({formatDuration(tgCodeRemainingSec)})
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tgUsername}
                      onChange={(e) => setTgUsername(e.target.value)}
                      placeholder="@username"
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-num text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => onLinkTelegram(tgUsername)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      تأكيد الربط
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audio, Policies & City Reset */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onToggleSound}
                className="min-h-[42px] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
              >
                {state.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <span>{state.soundEnabled ? 'الأصوات مفعلة' : 'الأصوات مكتومة'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPoliciesModal(true)}
                className="min-h-[42px] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-200"
              >
                <FileText className="w-4 h-4 text-amber-300" />
                <span>سياسة الخصوصية والشروط</span>
              </button>

              {isAdminTesting && onReturnToAdminPortal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReturnToAdminPortal();
                  }}
                  className="min-h-[42px] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>العودة إلى لوحة الإدارة</span>
                </button>
              )}
            </div>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-700/40 text-rose-300 font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط المدينة (المستوى 1)</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetCity();
                    onClose();
                  }}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  تأكيد البدء من المستوى 1
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPoliciesModal && (
        <LegalPoliciesModal onClose={() => setShowPoliciesModal(false)} />
      )}
    </div>
  );
};
