import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bot,
  Compass,
  HelpCircle,
  MessageSquare,
  Play,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { SMART_BOT_PLANS } from '@enginora/shared';
import {
  AdvisorActionLink,
  FREE_ADVISOR_PORTRAIT,
  SMART_ADVISOR_PORTRAIT,
  getContextualAdvisorBriefing,
} from '../engine/advisorEngine';
import { GameState, NavSection } from '@enginora/shared';

interface AdvisorWidgetProps {
  state: GameState;
  activeSection: NavSection;
  now: number;
  onOpenAdvisorHub: (tab: 'qa' | 'strategy' | 'delegation' | 'tiers') => void;
  onRunPlanStep: () => void;
  onNavigateAndFocus: (section: NavSection, plotId?: string) => void;
  onToggleSmartBot: () => void;
}

interface FloatingPos {
  x: number;
  y: number;
}

const ADVISOR_POS_STORAGE_KEY = 'enginora_advisor_pos_v1';
const ORB_SIZE = 68;
const EDGE_PAD = 12;

export const AdvisorWidget: React.FC<AdvisorWidgetProps> = ({
  state,
  activeSection,
  now,
  onOpenAdvisorHub,
  onRunPlanStep,
  onNavigateAndFocus,
  onToggleSmartBot,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [switchEffect, setSwitchEffect] = useState<'to-smart' | 'to-free' | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [pos, setPos] = useState<FloatingPos | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(ADVISOR_POS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<FloatingPos>;
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return { x: parsed.x, y: parsed.y };
      }
      return null;
    } catch {
      return null;
    }
  });

  const dragMetaRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    moved: false,
  });

  const isSmart = state.smartBotActive;
  const prevSmartRef = useRef(isSmart);

  useEffect(() => {
    if (prevSmartRef.current !== isSmart) {
      prevSmartRef.current = isSmart;
      setPortraitFailed(false);
      setSwitchEffect(isSmart ? 'to-smart' : 'to-free');
      const timer = window.setTimeout(() => {
        setSwitchEffect(null);
      }, 950);
      return () => window.clearTimeout(timer);
    }
  }, [isSmart]);

  const clampPosition = useCallback((rawX: number, rawY: number): FloatingPos => {
    const parent = containerRef.current?.parentElement;
    const width = parent?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 390);
    const height = parent?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 640);
    const maxX = Math.max(EDGE_PAD, width - ORB_SIZE - EDGE_PAD);
    const maxY = Math.max(EDGE_PAD, height - ORB_SIZE - EDGE_PAD);
    return {
      x: Math.max(EDGE_PAD, Math.min(maxX, rawX)),
      y: Math.max(EDGE_PAD, Math.min(maxY, rawY)),
    };
  }, []);

  // Initialize default bottom-right anchor inside <main> and clamp on resize
  useEffect(() => {
    const syncBounds = () => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      setPos((curr) => {
        if (!curr) {
          return clampPosition(w - ORB_SIZE - 14, h - ORB_SIZE - 14);
        }
        return clampPosition(curr.x, curr.y);
      });
    };
    syncBounds();
    window.addEventListener('resize', syncBounds);
    return () => window.removeEventListener('resize', syncBounds);
  }, [clampPosition]);

  // Persist position whenever drag completes
  useEffect(() => {
    if (!pos || isDragging || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ADVISOR_POS_STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // ignore storage failure
    }
  }, [pos, isDragging]);

  const portraitSrc = isSmart ? SMART_ADVISOR_PORTRAIT : FREE_ADVISOR_PORTRAIT;
  const briefing = getContextualAdvisorBriefing(state, activeSection, now);
  const activePlanName =
    SMART_BOT_PLANS[state.botConfig.planId]?.name ?? 'النمو الاقتصادي المتوازن';
  const isAutonomous = isSmart && state.botConfig.autoDevelopCity;

  const handleAction = (action?: AdvisorActionLink) => {
    if (!action) return;
    if (action.runStep) {
      onRunPlanStep();
      return;
    }
    if (action.openModalTab) {
      setExpanded(false);
      onOpenAdvisorHub(action.openModalTab);
      return;
    }
    if (action.section) {
      setExpanded(false);
      onNavigateAndFocus(action.section, action.plotId);
    }
  };

  const handleOrbPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    const current = pos ?? { x: EDGE_PAD, y: EDGE_PAD };
    dragMetaRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture unavailable
    }
  };

  const handleOrbPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragMetaRef.current.active || dragMetaRef.current.pointerId !== e.pointerId) {
      return;
    }
    const dx = e.clientX - dragMetaRef.current.startX;
    const dy = e.clientY - dragMetaRef.current.startY;
    if (Math.hypot(dx, dy) > 6) {
      dragMetaRef.current.moved = true;
      setIsDragging(true);
      setPos(clampPosition(dragMetaRef.current.origX + dx, dragMetaRef.current.origY + dy));
    }
  };

  const handleOrbPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragMetaRef.current.active || dragMetaRef.current.pointerId !== e.pointerId) {
      return;
    }
    const wasMoved = dragMetaRef.current.moved;
    dragMetaRef.current.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (!wasMoved) {
      setExpanded((v) => !v);
    }
  };

  const parentWidth = containerRef.current?.parentElement?.clientWidth ?? 400;
  const parentHeight = containerRef.current?.parentElement?.clientHeight ?? 600;
  const currentX = pos?.x ?? Math.max(EDGE_PAD, parentWidth - ORB_SIZE - 14);
  const currentY = pos?.y ?? Math.max(EDGE_PAD, parentHeight - ORB_SIZE - 14);
  const openToRight = currentX < parentWidth / 2;
  const openBelow = currentY < parentHeight * 0.45;

  const borderTone =
    briefing.tone === 'warning'
      ? 'border-rose-500/80'
      : briefing.tone === 'success'
        ? 'border-emerald-500/80'
        : isSmart
          ? 'border-amber-400/85'
          : 'border-sky-400/85';

  return (
    <div
      ref={containerRef}
      style={{
        left: `${currentX}px`,
        top: `${currentY}px`,
        width: `${ORB_SIZE}px`,
        height: `${ORB_SIZE}px`,
      }}
      className={`absolute z-30 select-none ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Compact Animated Floating Character Orb (Draggable Anywhere) */}
      <button
        type="button"
        onPointerDown={handleOrbPointerDown}
        onPointerMove={handleOrbPointerMove}
        onPointerUp={handleOrbPointerUp}
        onPointerCancel={handleOrbPointerUp}
        aria-label="المستشار المساعد — اسحب لتحريك المكان أو اضغط للفتح"
        title="اسحب لتحريك المستشار لأي مكان على الشاشة · اضغط لفتح المساعد"
        className={`relative w-full h-full rounded-2xl border-2 p-0.5 bg-[#090F1E]/95 shadow-2xl touch-none transition-shadow ${borderTone} ${
          isDragging
            ? 'scale-105 cursor-grabbing'
            : 'advisor-float-bob cursor-grab hover:scale-105'
        } ${isSmart ? 'advisor-smart-aura' : 'advisor-free-aura'}`}
      >
        <div
          key={isSmart ? 'orb-smart' : 'orb-free'}
          className="relative w-full h-full rounded-[13px] overflow-hidden advisor-avatar-pop"
        >
          {!portraitFailed ? (
            <img
              src={portraitSrc}
              alt={briefing.speakerName}
              draggable={false}
              referrerPolicy="no-referrer"
              onError={() => setPortraitFailed(true)}
              className="w-full h-full object-cover object-top pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-blue-950 flex items-center justify-center">
              <Bot className="w-7 h-7 text-amber-300" />
            </div>
          )}

          {/* Switch shimmer */}
          {switchEffect && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 advisor-switch-sweep ${
                switchEffect === 'to-smart'
                  ? 'bg-gradient-to-r from-transparent via-amber-300/45 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-sky-300/45 to-transparent'
              }`}
            />
          )}

          {/* Compact Name Footer inside Avatar */}
          <div
            className={`absolute inset-x-0 bottom-0 py-0.5 px-1 text-[9px] font-bold text-center truncate backdrop-blur-xs border-t ${
              isAutonomous
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/45'
                : isSmart
                  ? 'bg-amber-950/90 text-amber-200 border-amber-500/45'
                  : 'bg-slate-950/90 text-sky-200 border-sky-500/40'
            }`}
          >
            {isSmart ? 'حكيم' : 'طارق'}
          </div>
        </div>

        {/* Live Status Dot */}
        <span
          className={`absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full border-2 border-[#090F1E] ${
            isAutonomous
              ? 'bg-emerald-400 animate-pulse'
              : briefing.tone === 'warning'
                ? 'bg-rose-500 animate-pulse'
                : isSmart
                  ? 'bg-amber-400'
                  : 'bg-sky-400'
          }`}
        />
      </button>

      {/* Expandable Compact Popover on Tap */}
      {expanded && (
        <aside
          aria-label="نافذة المستشار السريعة"
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute z-40 w-[min(calc(100vw-1.5rem),340px)] max-h-[min(65dvh,420px)] overflow-y-auto rounded-2xl bg-[#090F1E]/95 backdrop-blur-md border ${borderTone} shadow-2xl advisor-bubble-in ${
            openToRight ? 'left-0' : 'right-0'
          } ${openBelow ? 'top-[76px]' : 'bottom-[76px]'}`}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-950/90 border-b border-slate-800/90">
            <div className="flex items-center gap-1.5 min-w-0">
              {isSmart ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              )}
              <span className="text-[11px] font-bold text-slate-100 truncate">
                {briefing.speakerName}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                  isSmart
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                }`}
              >
                {isSmart ? 'ذكي 4/2' : 'مجاني 2/1'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleSmartBot}
                className={`min-h-[32px] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-colors ${
                  isSmart
                    ? 'bg-sky-950/70 hover:bg-sky-900/80 border-sky-500/50 text-sky-200'
                    : 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/60 text-amber-200'
                }`}
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>{isSmart ? 'للمجاني' : 'للذكي'}</span>
              </button>

              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="إغلاق"
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span
                className={`font-bold px-2 py-0.5 rounded ${
                  isSmart
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-sky-500/15 text-sky-300'
                }`}
              >
                {activePlanName}
              </span>
              {isAutonomous && (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>تنفيذ ذاتي</span>
                </span>
              )}
            </div>

            <div
              className={`font-bold leading-snug ${
                briefing.tone === 'warning'
                  ? 'text-rose-300'
                  : briefing.tone === 'success'
                    ? 'text-emerald-300'
                    : 'text-amber-300'
              }`}
            >
              {briefing.title}
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {briefing.body}
            </p>

            {isSmart && state.botConfig.lastActionSummary && (
              <div className="pt-1.5 border-t border-slate-800/90 text-[10px] text-emerald-300 flex items-center gap-1 truncate">
                <Zap className="w-3 h-3 shrink-0 text-emerald-400" />
                <span className="truncate">
                  آخر تنفيذ: {state.botConfig.lastActionSummary}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {briefing.primaryAction && (
                <button
                  type="button"
                  onClick={() => handleAction(briefing.primaryAction)}
                  className={`min-h-[36px] flex-1 min-w-[120px] px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    briefing.primaryAction.runStep
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-[#1D4ED8] hover:bg-blue-600 text-white'
                  }`}
                >
                  {briefing.primaryAction.runStep ? (
                    <Play className="w-3 h-3" />
                  ) : (
                    <Compass className="w-3 h-3" />
                  )}
                  <span className="truncate">{briefing.primaryAction.label}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  onOpenAdvisorHub('qa');
                }}
                className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-sky-200 flex items-center gap-1 whitespace-nowrap"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-300" />
                <span>اسأل</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  onOpenAdvisorHub('strategy');
                }}
                className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-amber-200 flex items-center gap-1 whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
                <span>الخطط</span>
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
