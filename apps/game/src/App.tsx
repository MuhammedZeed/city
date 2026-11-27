import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  X,
} from 'lucide-react';
import { AdvisorWidget } from './components/AdvisorWidget';
import {
  AdvisorModalTab,
  BotModal,
  SettingsModal,
} from './components/BotAndSettingsModals';
import { BottomDock } from './components/BottomDock';
import { BuildCatalogView } from './components/BuildCatalogView';
import { RealisticCityCanvas } from './components/RealisticCityCanvas';
import { MilitaryView, ResearchView } from './components/MilitaryAndResearchViews';
import { PlotInspectorPanel } from './components/PlotInspectorPanel';
import { PlayerAuthScreen } from './components/PlayerAuthScreen';
import {
  AlliancesView,
  MarketView,
  QuestsView,
  ReportsView,
  StatisticsView,
} from './components/SecondaryViews';
import { MonthlyRewardsView, StoreView } from './components/ShopAndMonthlyViews';
import { SidebarNav } from './components/SidebarNav';
import { SupportView } from './components/SupportView';
import { TopHud } from './components/TopHud';
import { WorldMapView } from './components/WorldMapView';
import { CITY_PLOTS, SMART_BOT_PLANS } from '@enginora/shared';
import {
  StrategicPlanStep,
  runSmartStrategyCycle,
} from './engine/advisorEngine';
import {
  RegistrationSubmitPayload,
  advanceGameState,
  applySpeedUpToBuild,
  applySpeedUpToResearch,
  applySpeedUpToTraining,
  buildNavalVessel,
  buyCombatBuff,
  buyProtectionShield,
  buySpeedUpCard,
  cancelMarketOffer,
  cancelPendingMarketBuy,
  claimMonthlyRewardDay,
  claimQuest,
  clearSavedState,
  createAlliance,
  createSupportTicket,
  dispatchMaritimeTrade,
  dispatchOffshoreSurvey,
  dispatchPlayerAttack,
  dispatchReconMarch,
  dispatchSmartBotResourceRaid,
  editMarketOffer,
  executeSmartBotPlanStep,
  finalizePendingMarketBuy,
  generateTelegramCode,
  initiateMarketBuy,
  instantFinishBuildJob,
  isShieldActive,
  leaveAlliance,
  linkTelegramAccount,
  loadSavedState,
  publishMarketOffer,
  replyToSupportTicket,
  saveGameState,
  selectCitySpecialization,
  speedUpMarchWithGems,
  startNewBuildingOnPlot,
  startResearchTech,
  startTrainUnits,
  startUpgradeBuilding,
  submitPaymentOrder,
  submitPlayerRegistration,
  unlinkTelegramAccount,
  updateTelegramAlerts,
} from '@enginora/shared';
import { soundFx } from './engine/soundFx';
import {
  apiGetState,
  apiLogin,
  apiLogout,
  apiRegister,
  apiResetCity,
  apiSaveStatePrepared,
  ensureReceiptUploaded,
  getStoredToken,
  hydrateServerState,
  mergeAuthoritative,
  newReceiptId,
  storeToken,
} from './api/client';
import {
  BotConfig,
  BuildingType,
  GameState,
  MarketResourceId,
  NavSection,
  OrderProductType,
  PaymentMethodId,
  SpecializationId,
  SpeedUpTierId,
  TicketAttachment,
  UnitType,
} from '@enginora/shared';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface PendingAttackConfirm {
  tileId: string;
  units: { infantry: number; tank: number; aircraft: number };
}

export default function App() {
  const [state, setState] = useState<GameState>(() => loadSavedState());
  const [now, setNow] = useState<number>(() => Date.now());
  const [activeSection, setActiveSection] = useState<NavSection>('city');
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [pendingBuildType, setPendingBuildType] = useState<BuildingType | null>(null);
  const [showBotModal, setShowBotModal] = useState(false);
  const [botModalTab, setBotModalTab] = useState<AdvisorModalTab>('qa');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sessionAuthenticated, setSessionAuthenticated] = useState<boolean>(false);
  const [apiToken, setApiToken] = useState<string | null>(() => getStoredToken());
  const [restoring, setRestoring] = useState<boolean>(() => Boolean(getStoredToken()));
  const revisionRef = useRef<number>(0);
  const stateRef = useRef<GameState>(state);
  const savingRef = useRef<boolean>(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const [shieldConfirmAttack, setShieldConfirmAttack] =
    useState<PendingAttackConfirm | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Restore an existing server session on page load
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await apiGetState(token);
      if (cancelled) return;
      if (r.ok && r.data.state) {
        revisionRef.current = Number(r.data.revision) || 0;
        const hydrated = hydrateServerState(r.data.state);
        setState(hydrated);
        setApiToken(token);
        if (hydrated.registration.status === 'approved') setSessionAuthenticated(true);
      } else if (r.status === 401) {
        storeToken(null);
        setApiToken(null);
      }
      setRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // While waiting for founder approval, check the server every 20 seconds
  useEffect(() => {
    if (!apiToken || sessionAuthenticated) return;
    const id = window.setInterval(async () => {
      const r = await apiGetState(apiToken);
      if (r.ok && r.data.state) {
        revisionRef.current = Number(r.data.revision) || revisionRef.current;
        const hydrated = hydrateServerState(r.data.state);
        setState(hydrated);
        if (hydrated.registration.status === 'approved') {
          setSessionAuthenticated(true);
          pushToast('تم اعتماد حسابك! أهلاً بك في ENGINORA CITY.', 'success');
        }
      } else if (r.status === 401) {
        storeToken(null);
        setApiToken(null);
      }
    }, 20000);
    return () => window.clearInterval(id);
  }, [apiToken, sessionAuthenticated, pushToast]);

  // Autosave to the server every 60 seconds while playing, and when the tab is hidden
  useEffect(() => {
    if (!apiToken || !sessionAuthenticated) {
      flushRef.current = async () => {};
      return;
    }
    const flush = async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const r = await apiSaveStatePrepared(apiToken, stateRef.current, revisionRef.current);
        if (r.ok) {
          revisionRef.current = Number(r.data.revision) || revisionRef.current;
          setState((prev) => mergeAuthoritative(prev, r.data.state));
        } else if (r.status === 409 && r.data.code === 'REVISION_CONFLICT') {
          revisionRef.current = Number(r.data.serverRevision) || revisionRef.current;
          setState(hydrateServerState(r.data.state));
          pushToast('تم تحديث بيانات حسابك من الخادم.', 'info');
        } else if (r.status === 401) {
          storeToken(null);
          setApiToken(null);
          setSessionAuthenticated(false);
          pushToast('انتهت جلسة الدخول، يرجى تسجيل الدخول من جديد.', 'error');
        }
      } finally {
        savingRef.current = false;
      }
    };
    flushRef.current = flush;
    const id = window.setInterval(flush, 60000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [apiToken, sessionAuthenticated, pushToast]);

  // Save state whenever it mutates
  useEffect(() => {
    saveGameState(state);
  }, [state]);

  // 1-second deterministic world tick (continues catching up offline time)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const tickNow = Date.now();
      setNow(tickNow);
      setState((prev) => {
        const res = advanceGameState(prev, tickNow);
        if (res.completedEvents.length > 0) {
          soundFx.play('complete', prev.soundEnabled);
          pushToast(res.completedEvents[0], 'success');
        }
        return res.state;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [pushToast]);

  const handleSelectPlot = (plotId: string) => {
    const currentNow = Date.now();

    if (pendingBuildType) {
      const plot = CITY_PLOTS.find((p) => p.id === plotId);
      const occupied = state.buildings.some(
        (b) => b.plotId === plotId && b.status !== 'EMPTY'
      );
      const isCoastalBuilding =
        pendingBuildType === 'seaport' || pendingBuildType === 'offshore_rig';
      if (plot?.fixedType || occupied) {
        soundFx.play('error', state.soundEnabled);
        pushToast('اختر أرضًا فارغة غير مشغولة لوضع المبنى.', 'error');
        return;
      }
      if (isCoastalBuilding && (!plot?.isCoastal || plot.suggestedType !== pendingBuildType)) {
        soundFx.play('error', state.soundEnabled);
        pushToast('هذا المبنى البحري يُشيد في الموقع الساحلي أو البحري المخصص له.', 'error');
        return;
      }
      if (!isCoastalBuilding && plot?.isCoastal) {
        soundFx.play('error', state.soundEnabled);
        pushToast('اختر قطعة أرض داخل شوارع المدينة للمباني البرية.', 'error');
        return;
      }

      const result = startNewBuildingOnPlot(
        state,
        plotId,
        pendingBuildType,
        currentNow
      );
      if (result.error) {
        soundFx.play('error', state.soundEnabled);
        pushToast(result.error, 'error');
      } else {
        soundFx.play('build', state.soundEnabled);
        setState(result.state);
        setPendingBuildType(null);
        setSelectedPlotId(plotId);
        pushToast('بدأت أعمال الإنشاء بنجاح.', 'success');
      }
      return;
    }

    soundFx.play('click', state.soundEnabled);
    setSelectedPlotId((curr) => (curr === plotId ? null : plotId));
  };

  const handleBuildNew = (plotId: string, type: BuildingType) => {
    const currentNow = Date.now();
    const res = startNewBuildingOnPlot(state, plotId, type, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast('بدأت عملية الإنشاء وتفعيل المؤقت.', 'success');
  };

  const handleUpgradeBuilding = (buildingId: string) => {
    const currentNow = Date.now();
    const res = startUpgradeBuilding(state, buildingId, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast('بدأت ترقية المبنى.', 'success');
  };

  const handleUseSpeedUp = (queueId: string, tierId: SpeedUpTierId) => {
    const currentNow = Date.now();
    const res = applySpeedUpToBuild(state, queueId, tierId, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم تطبيق بطاقة التسريع على البناء بنجاح.', 'success');
  };

  const handleUseSpeedUpResearch = (queueId: string, tierId: SpeedUpTierId) => {
    const currentNow = Date.now();
    const res = applySpeedUpToResearch(state, queueId, tierId, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم تطبيق بطاقة التسريع على البحث بنجاح.', 'success');
  };

  const handleUseSpeedUpTraining = (queueId: string, tierId: SpeedUpTierId) => {
    const currentNow = Date.now();
    const res = applySpeedUpToTraining(state, queueId, tierId, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم تطبيق بطاقة التسريع على التدريب بنجاح.', 'success');
  };

  const handleInstantFinishBuild = (queueId: string) => {
    const currentNow = Date.now();
    const res = instantFinishBuildJob(state, queueId, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('complete', state.soundEnabled);
    setState(res.state);
    pushToast(
      `تم الإنهاء الفوري للبناء مقابل ${res.gemCost ?? 0} جوهرة!`,
      'success'
    );
  };

  const handleSpeedUpMarch = (marchId: string, minutes: number) => {
    const currentNow = Date.now();
    const res = speedUpMarchWithGems(state, marchId, minutes, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast(
      `تم تسريع المسيرة (${minutes} د) مقابل ${res.gemCost ?? 0} جوهرة.`,
      'success'
    );
  };

  const handleSelectSpecialization = (specId: SpecializationId) => {
    const res = selectCitySpecialization(state, specId);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم اعتماد التخصص الرئيسي للمدينة.', 'success');
  };

  const handleStartResearch = (techId: string) => {
    const currentNow = Date.now();
    const res = startResearchTech(state, techId, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast('بدأ البحث التقني.', 'success');
  };

  const handleTrainUnits = (unitType: UnitType, count: number) => {
    const currentNow = Date.now();
    const res = startTrainUnits(state, unitType, count, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast(`بدأ تدريب ${count} وحدة في الثكنة.`, 'success');
  };

  const handleDispatchRecon = (tileId: string, scoutCount: number) => {
    const currentNow = Date.now();
    const res = dispatchReconMarch(state, tileId, scoutCount, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast('انطلقت حملة الاستطلاع وفق مؤقت الحركة (درعك ما زال محميًا).', 'success');
  };

  const executeConfirmedAttack = (
    tileId: string,
    units: { infantry: number; tank: number; aircraft: number }
  ) => {
    const currentNow = Date.now();
    const res = dispatchPlayerAttack(state, tileId, units, currentNow);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast(
      res.shieldCancelled
        ? 'انطلقت الحملة العسكرية وتم إلغاء درع الحماية فورًا.'
        : 'انطلقت الحملة العسكرية نحو المدينة الهدف.',
      res.shieldCancelled ? 'info' : 'success'
    );
  };

  const handleRequestAttack = (
    tileId: string,
    units: { infantry: number; tank: number; aircraft: number }
  ) => {
    const currentNow = Date.now();
    if (isShieldActive(state, currentNow)) {
      setShieldConfirmAttack({ tileId, units });
      return;
    }
    executeConfirmedAttack(tileId, units);
  };

  const handleClaimQuest = (questId: string) => {
    const res = claimQuest(state, questId);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم استلام مكافأة المهمة!', 'success');
  };

  const handleClaimMonthlyDay = (day: number) => {
    const res = claimMonthlyRewardDay(state, day, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast(`تم استلام مكافأة اليوم ${day} من الباقة الشهرية!`, 'success');
  };

  const handleUpgradeFortifications = () => {
    const wall = state.buildings.find((b) => b.type === 'fortifications');
    if (wall) {
      handleUpgradeBuilding(wall.id);
    }
  };

  const handleToggleSmartBot = () => {
    const currentNow = Date.now();
    const activating = !state.smartBotActive;
    setState((prev) => {
      const nextActivating = !prev.smartBotActive;
      const baseNext: GameState = {
        ...prev,
        smartBotActive: nextActivating,
        smartBotExpiresAt: nextActivating
          ? currentNow + 90 * 24 * 60 * 60 * 1000
          : null,
        botConfig: nextActivating
          ? {
              ...prev.botConfig,
              autoDevelopCity: true,
            }
          : prev.botConfig,
      };
      if (!nextActivating) return baseNext;
      const cycle = runSmartStrategyCycle(baseNext, currentNow, {
        maxActions: 4,
        silent: true,
      });
      return cycle.actionsTaken.length > 0 ? cycle.state : baseNext;
    });
    soundFx.play('claim', state.soundEnabled);
    pushToast(
      activating
        ? 'تم تفعيل المستشار الذكي (4 بناء · 2 بحث) — بدأ تنفيذ الخطة تلقائيًا.'
        : 'تم التحويل إلى المستشار المجاني (2 بناء · 1 بحث).',
      activating ? 'success' : 'info'
    );
  };

  const handleBuildNavalVessel = (vesselType: 'cargo_ship' | 'survey_vessel') => {
    const res = buildNavalVessel(state, vesselType);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast(
      vesselType === 'cargo_ship'
        ? 'تم تدشين سفينة شحن تجارية جديدة بالميناء.'
        : 'تم تدشين سفينة مسح وتنقيب بحري جديدة.',
      'success'
    );
  };

  const handleDispatchMaritimeTrade = () => {
    const res = dispatchMaritimeTrade(state, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast('أبحرت قافلة التجارة البحرية من الميناء.', 'success');
  };

  const handleDispatchOffshoreSurvey = () => {
    const res = dispatchOffshoreSurvey(state, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast('انطلقت بعثة المسح السيزمي لاستكشاف النفط والغاز.', 'success');
  };

  const handleUpdateBotConfig = (patch: Partial<BotConfig>) => {
    const nowTs = Date.now();
    setState((prev) => {
      const isAdoptingPlan = Boolean(patch.planId && patch.planId !== prev.botConfig.planId);
      const shouldAutoStart =
        prev.smartBotActive &&
        (isAdoptingPlan || patch.autoDevelopCity === true);

      const baseNext: GameState = {
        ...prev,
        botConfig: {
          ...prev.botConfig,
          ...patch,
          ...(shouldAutoStart ? { autoDevelopCity: true } : {}),
        },
      };

      if (!shouldAutoStart) return baseNext;
      const cycle = runSmartStrategyCycle(baseNext, nowTs, {
        maxActions: 4,
        silent: true,
      });
      return cycle.actionsTaken.length > 0 ? cycle.state : baseNext;
    });
    soundFx.play('click', state.soundEnabled);
    if (patch.planId) {
      const planName = SMART_BOT_PLANS[patch.planId]?.name ?? patch.planId;
      pushToast(
        state.smartBotActive
          ? `تم اعتماد «${planName}» — بدأ المستشار الذكي العمل عليها تلقائيًا.`
          : `تم اختيار عقيدة «${planName}». فعّل المستشار الذكي للعمل عليها تلقائيًا.`,
        state.smartBotActive ? 'success' : 'info'
      );
    }
  };

  const handleRunBotPlanStep = () => {
    const res = executeSmartBotPlanStep(state, Date.now(), false);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast(res.summary ?? 'تم تنفيذ خطوة الخطة الاستراتيجية.', 'success');
  };

  const handleRunBotResourceRaid = () => {
    const res = dispatchSmartBotResourceRaid(state, Date.now(), false);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast(res.summary ?? 'انطلقت حملة حقول الموارد المفوضة.', 'success');
  };

  const handleRunSmartCycle = () => {
    const res = runSmartStrategyCycle(state, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState(res.state);
    pushToast(res.actionsTaken.join(' · '), 'success');
  };

  const handleExecutePlanStep = (step: StrategicPlanStep) => {
    const nowTs = Date.now();
    const res = step.execute(state, nowTs);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('build', state.soundEnabled);
    setState({
      ...res.state,
      botConfig: {
        ...res.state.botConfig,
        lastActionAt: nowTs,
        lastActionSummary: res.summary ?? step.title,
      },
    });
    pushToast(res.summary ?? step.title, 'success');
  };

  // Store & Payment Handlers
  const handleSubmitPaymentOrder = (
    productType: OrderProductType,
    productId: string,
    paymentMethod: PaymentMethodId,
    transferRef: string,
    receiptName?: string,
    receiptPreviewUrl?: string
  ) => {
    const res = submitPaymentOrder(
      state,
      productType,
      productId,
      paymentMethod,
      transferRef,
      receiptName,
      receiptPreviewUrl,
      Date.now()
    );
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast(
      `تم إرسال طلب الدفع ${res.order?.id ?? ''} بحالة «قيد المراجعة» بانتظار اعتماد المؤسس.`,
      'success'
    );
  };

  const handleBuySpeedUpCard = (tierId: SpeedUpTierId, qty: number) => {
    const res = buySpeedUpCard(state, tierId, qty, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم شراء بطاقة التسريع وإضافتها لحسابك.', 'success');
  };

  const handleBuyCombatBuff = (kind: 'attack' | 'defense') => {
    const res = buyCombatBuff(state, kind, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast(
      kind === 'attack'
        ? 'تم تفعيل / تمديد تعزيز الهجوم +10% (24 ساعة).'
        : 'تم تفعيل / تمديد تعزيز الدفاع +10% (24 ساعة).',
      'success'
    );
  };

  const handleBuyProtectionShield = (tier: '24h' | '3d' | '7d' | '30d') => {
    const res = buyProtectionShield(state, tier, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم تفعيل / تمديد درع الحماية لمدينتك.', 'success');
  };

  // Market Handlers
  const handlePublishMarketOffer = (
    resource: MarketResourceId,
    quantity: number,
    unitPriceGems: number
  ) => {
    const res = publishMarketOffer(state, resource, quantity, unitPriceGems, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم نشر عرض البيع في السوق لمدة 7 أيام.', 'success');
  };

  const handleEditMarketOffer = (offerId: string, newUnitPriceGems: number) => {
    const res = editMarketOffer(state, offerId, newUnitPriceGems, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('click', state.soundEnabled);
    setState(res.state);
    pushToast('تم تعديل سعر العرض في السوق.', 'success');
  };

  const handleCancelMarketOffer = (offerId: string) => {
    const res = cancelMarketOffer(state, offerId, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('click', state.soundEnabled);
    setState(res.state);
    pushToast('تم إلغاء العرض وإعادة الكمية المتبقية لمدينتك.', 'info');
  };

  const handleInitiateMarketBuy = (offerId: string, quantity: number) => {
    const res = initiateMarketBuy(state, offerId, quantity, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('click', state.soundEnabled);
    setState(res.state);
    pushToast('بدأ عداد التأكيد (5 ثوانٍ) — يمكنك الإلغاء مجانًا قبل الاعتماد.', 'info');
  };

  const handleCancelPendingMarketBuy = (pendingId: string) => {
    const res = cancelPendingMarketBuy(state, pendingId);
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('click', state.soundEnabled);
    setState(res.state);
    pushToast('تم إلغاء طلب الشراء وإعادة الكمية للعرض.', 'info');
  };

  const handleFinalizePendingMarketBuy = (pendingId: string) => {
    const res = finalizePendingMarketBuy(state, pendingId, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم تنفيذ صفقة الشراء وتسجيلها في السجل التجاري.', 'success');
  };

  // Alliance Handlers
  const handleCreateAlliance = (name: string, tag: string) => {
    const res = createAlliance(state, name, tag, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم تأسيس التحالف الجديد مجانًا (الحد الأقصى 10 أعضاء).', 'success');
  };

  const handleLeaveAlliance = () => {
    soundFx.play('click', state.soundEnabled);
    setState((prev) => leaveAlliance(prev));
    pushToast('تمت مغادرة التحالف.', 'info');
  };

  // Support Handlers
  const handleCreateTicket = (
    subject: string,
    category: string,
    text: string,
    attachments: TicketAttachment[]
  ) => {
    const res = createSupportTicket(
      state,
      subject,
      category,
      text,
      attachments,
      Date.now()
    );
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast(`تم فتح تذكرة الدعم ${res.ticket?.id ?? ''} بنجاح.`, 'success');
  };

  const handlePlayerReplyTicket = (
    ticketId: string,
    text: string,
    attachments: TicketAttachment[]
  ) => {
    const res = replyToSupportTicket(
      state,
      ticketId,
      'player',
      text,
      attachments,
      Date.now()
    );
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('click', state.soundEnabled);
    setState(res.state);
    pushToast('تم إرسال ردك إلى فريق الدعم.', 'success');
  };

  const handleMarkTicketRead = (ticketId: string) => {
    setState((prev) => ({
      ...prev,
      supportTickets: prev.supportTickets.map((t) =>
        t.id === ticketId ? { ...t, unreadByPlayer: false } : t
      ),
    }));
  };


  // Telegram Linking Handlers
  const handleGenerateTelegramCode = () => {
    soundFx.play('click', state.soundEnabled);
    setState((prev) => generateTelegramCode(prev, Date.now()));
    pushToast('تم توليد كود ربط تيليغرام المؤقت لمدة 15 دقيقة.', 'success');
  };

  const handleLinkTelegram = (username: string) => {
    const res = linkTelegramAccount(state, username, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    setState(res.state);
    pushToast('تم ربط حساب تيليغرام بنجاح وتفعيل التنبيهات الفورية.', 'success');
  };

  const handleUnlinkTelegram = () => {
    soundFx.play('click', state.soundEnabled);
    setState((prev) => unlinkTelegramAccount(prev));
    pushToast('تم فك ربط حساب تيليغرام.', 'info');
  };

  const handleUpdateTelegramAlerts = (
    patch: Partial<GameState['telegram']['alerts']>
  ) => {
    soundFx.play('click', state.soundEnabled);
    setState((prev) => updateTelegramAlerts(prev, patch));
  };

  const handleOpenAdvisorHub = (tab: AdvisorModalTab) => {
    soundFx.play('click', state.soundEnabled);
    setBotModalTab(tab);
    setShowBotModal(true);
  };

  const handleNavigateAndFocus = (section: NavSection, plotId?: string) => {
    soundFx.play('click', state.soundEnabled);
    setActiveSection(section);
    if (plotId) {
      setSelectedPlotId(plotId);
    }
  };

  const applySession = (token: string, serverState: unknown, revision: unknown, fallback?: GameState) => {
    storeToken(token);
    setApiToken(token);
    revisionRef.current = Number(revision) || 0;
    const hydrated = hydrateServerState(serverState, fallback);
    setState(hydrated);
    return hydrated;
  };

  const handleSubmitRegistration = async (
    payload: RegistrationSubmitPayload & { password: string }
  ): Promise<{ error?: string }> => {
    const { password, ...regPayload } = payload;
    if (apiToken) {
      return {
        error: 'لديك حساب مسجل بالفعل. تواصل مع الإدارة إذا تم رفض طلبك السابق.',
      };
    }
    if (typeof password !== 'string' || password.length < 8) {
      return { error: 'كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل.' };
    }
    const res = submitPlayerRegistration(state, regPayload, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      return { error: res.error };
    }
    const receiptId = newReceiptId();
    const dataUrl = res.state.registration.receiptPreviewUrl ?? '';
    const local: GameState = {
      ...res.state,
      registration: { ...res.state.registration, receiptId } as GameState['registration'],
      paymentOrders: res.state.paymentOrders.map((o) =>
        o.productType === 'registration_fee' ? ({ ...o, receiptId } as typeof o) : o
      ),
    };
    // The receipt photo is uploaded separately as an image; keep the save payload small
    const regForServer: Record<string, unknown> = { ...local.registration };
    delete regForServer.receiptPreviewUrl;
    const ordersForServer = local.paymentOrders.map((o) => {
      const copy: Record<string, unknown> = { ...o };
      delete copy.receiptPreviewUrl;
      return copy;
    });
    const r = await apiRegister({
      email: regPayload.email.trim(),
      phone: regPayload.phone.trim(),
      password,
      commanderName: regPayload.nickname.trim(),
      serverId: local.selectedServerId,
      registration: regForServer,
      paymentOrders: ordersForServer,
    });
    if (!r.ok) {
      soundFx.play('error', state.soundEnabled);
      return { error: r.error ?? 'تعذر إنشاء الحساب.' };
    }
    if (!r.data.token) {
      return {
        error:
          r.data.message ||
          'تم إنشاء الحساب لكن لا يمكن الدخول قبل تأكيد البريد الإلكتروني.',
      };
    }
    const hydrated = applySession(r.data.token, r.data.state, r.data.revision, local);
    const uploaded = dataUrl
      ? await ensureReceiptUploaded(r.data.token, receiptId, dataUrl)
      : 'ok';
    // Make sure the server has the pending registration + payment order right away
    const saved = await apiSaveStatePrepared(r.data.token, hydrated, revisionRef.current);
    if (saved.ok) revisionRef.current = Number(saved.data.revision) || revisionRef.current;
    if (uploaded !== 'ok') {
      pushToast('تم إنشاء الحساب لكن تعذر رفع صورة الفاتورة، تواصل مع الإدارة.', 'error');
      return {};
    }
    soundFx.play('claim', state.soundEnabled);
    pushToast('تم استلام طلب تسجيلك وفاتورة الـ 200 ريال وبانتظار اعتماد المؤسس.', 'success');
    return {};
  };

  const activeServer =
    state.adminConfig.servers?.find((s) => s.id === state.selectedServerId) ??
    state.adminConfig.servers?.[0];
  const isServerOpen = Boolean(activeServer?.isOpen);

  const handleSelectServer = (serverId: string) => {
    soundFx.play('click', state.soundEnabled);
    setState((prev) => ({
      ...prev,
      selectedServerId: serverId,
    }));
  };

  const handleLoginApproved = async (
    identifier: string,
    password: string
  ): Promise<{ error?: string }> => {
    const clean = identifier.trim();
    if (!clean || !password) {
      return { error: 'أدخل البريد الإلكتروني أو رقم الجوال وكلمة المرور.' };
    }
    const r = await apiLogin(clean, password);
    if (!r.ok || !r.data.token) {
      soundFx.play('error', state.soundEnabled);
      return { error: r.error ?? 'بيانات الدخول غير صحيحة.' };
    }
    const hydrated = applySession(r.data.token, r.data.state, r.data.revision);
    if (hydrated.registration.status !== 'approved') {
      pushToast(
        hydrated.registration.status === 'pending'
          ? 'طلب تسجيلك قيد المراجعة من المؤسس. سيتم إدخالك تلقائيًا فور الاعتماد.'
          : 'هذا الحساب غير معتمد بعد.',
        'info'
      );
      return {};
    }
    const srv =
      hydrated.adminConfig.servers?.find((sv) => sv.id === hydrated.selectedServerId) ??
      hydrated.adminConfig.servers?.[0];
    if (!srv?.isOpen) {
      return {
        error: 'السيرفر مغلق حاليًا — لا يمكن الدخول إلا بعد فتح السيرفر من لوحة الإدارة.',
      };
    }
    soundFx.play('claim', hydrated.soundEnabled);
    setSessionAuthenticated(true);
    pushToast(
      `أهلاً بك أيها القائد ${hydrated.registration.nickname || hydrated.commanderName}.`,
      'success'
    );
    return {};
  };

  const handleResetCity = async () => {
    if (apiToken) {
      const r = await apiResetCity(apiToken);
      if (!r.ok) {
        pushToast(r.error ?? 'تعذر إعادة ضبط المدينة.', 'error');
        return;
      }
      applySession(apiToken, r.data.state, r.data.revision);
    } else {
      setState(clearSavedState());
    }
    setSelectedPlotId(null);
    setPendingBuildType(null);
    setActiveSection('city');
    pushToast(
      'تمت إعادة ضبط المدينة إلى البداية المتساوية (المبنى الرئيسي المستوى 1).',
      'info'
    );
  };

  const handleLogout = async () => {
    const token = apiToken;
    if (token) {
      await flushRef.current();
      await apiLogout(token);
    }
    storeToken(null);
    setApiToken(null);
    setSessionAuthenticated(false);
    setShowSettingsModal(false);
    setState(clearSavedState());
    setSelectedPlotId(null);
    setPendingBuildType(null);
    setActiveSection('city');
  };


  if (restoring) {
    return (
      <div
        dir="rtl"
        className="min-h-[100dvh] w-screen bg-[#060B17] flex items-center justify-center text-amber-200 text-sm font-bold"
      >
        جارٍ تحميل حسابك...
      </div>
    );
  }

  // Player Registration, Login & Server Gate
  if (state.registration.status !== 'approved' || !sessionAuthenticated || !isServerOpen) {
    return (
      <div className="relative min-h-[100dvh] w-screen overflow-hidden bg-[#060B17]">
        <PlayerAuthScreen
          state={state}
          onSubmitRegistration={handleSubmitRegistration}
          onLoginApproved={handleLoginApproved}
          onSelectServer={handleSelectServer}
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
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#080F1E] text-slate-100">

      {/* Top Bar HUD */}
      <TopHud
        state={state}
        now={now}
        activeSection={activeSection}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenBotModal={() => handleOpenAdvisorHub(state.smartBotActive ? 'strategy' : 'qa')}
        onOpenStore={() => {
          soundFx.play('click', state.soundEnabled);
          setActiveSection('store');
        }}
        onOpenMonthly={() => {
          soundFx.play('click', state.soundEnabled);
          setActiveSection('monthly');
        }}
      />

      {/* Middle Workspace */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        {/* Sidebar */}
        <SidebarNav
          state={state}
          activeSection={activeSection}
          onSelectSection={(sec) => {
            soundFx.play('click', state.soundEnabled);
            setActiveSection(sec);
          }}
        />

        {/* Active View Content */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
          {activeSection === 'city' && (
            <>
              <div className="flex-1 min-w-0 min-h-0 relative">
                <RealisticCityCanvas
                  state={state}
                  now={now}
                  selectedPlotId={selectedPlotId}
                  pendingBuildType={pendingBuildType}
                  onSelectPlot={handleSelectPlot}
                  onCancelPendingBuild={() => setPendingBuildType(null)}
                />
              </div>

              {selectedPlotId && (
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedPlotId(null);
                  }}
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-end lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:backdrop-blur-none lg:block"
                >
                  <PlotInspectorPanel
                    state={state}
                    plotId={selectedPlotId}
                    now={now}
                    onClose={() => setSelectedPlotId(null)}
                    onBuildNew={handleBuildNew}
                    onUpgrade={handleUpgradeBuilding}
                    onUseSpeedUp={handleUseSpeedUp}
                    onInstantFinishBuild={handleInstantFinishBuild}
                    onSelectSpecialization={handleSelectSpecialization}
                    onBuildNavalVessel={handleBuildNavalVessel}
                    onDispatchMaritimeTrade={handleDispatchMaritimeTrade}
                    onDispatchOffshoreSurvey={handleDispatchOffshoreSurvey}
                  />
                </div>
              )}
            </>
          )}

          {activeSection === 'build' && (
            <div className="flex-1 min-w-0 h-full">
              <BuildCatalogView
                state={state}
                now={now}
                onStartPlaceOnMap={(type) => {
                  setPendingBuildType(type);
                  setSelectedPlotId(null);
                  setActiveSection('city');
                }}
                onUpgradeBuilding={handleUpgradeBuilding}
                onFocusPlotOnCity={(plotId) => {
                  setSelectedPlotId(plotId);
                  setActiveSection('city');
                }}
              />
            </div>
          )}

          {activeSection === 'world_map' && (
            <div className="flex-1 min-w-0 h-full">
              <WorldMapView
                state={state}
                now={now}
                onDispatchRecon={handleDispatchRecon}
                onDispatchAttack={handleRequestAttack}
              />
            </div>
          )}

          {activeSection === 'military' && (
            <div className="flex-1 min-w-0 h-full">
              <MilitaryView
                state={state}
                now={now}
                onTrainUnits={handleTrainUnits}
                onUpgradeFortifications={handleUpgradeFortifications}
                onUseSpeedUpTraining={handleUseSpeedUpTraining}
                onSpeedUpMarch={handleSpeedUpMarch}
              />
            </div>
          )}

          {activeSection === 'research' && (
            <div className="flex-1 min-w-0 h-full">
              <ResearchView
                state={state}
                now={now}
                onStartResearch={handleStartResearch}
                onUseSpeedUpResearch={handleUseSpeedUpResearch}
              />
            </div>
          )}

          {activeSection === 'quests' && (
            <div className="flex-1 min-w-0 h-full">
              <QuestsView
                state={state}
                now={now}
                onClaimQuest={handleClaimQuest}
              />
            </div>
          )}

          {activeSection === 'reports' && (
            <div className="flex-1 min-w-0 h-full">
              <ReportsView
                state={state}
                onMarkAllRead={() =>
                  setState((prev) => ({
                    ...prev,
                    reports: prev.reports.map((r) => ({ ...r, read: true })),
                  }))
                }
              />
            </div>
          )}

          {activeSection === 'stats' && (
            <div className="flex-1 min-w-0 h-full">
              <StatisticsView state={state} now={now} />
            </div>
          )}

          {activeSection === 'market' && (
            <div className="flex-1 min-w-0 h-full">
              <MarketView
                state={state}
                now={now}
                onPublishOffer={handlePublishMarketOffer}
                onEditOffer={handleEditMarketOffer}
                onCancelOffer={handleCancelMarketOffer}
                onInitiateBuy={handleInitiateMarketBuy}
                onCancelPendingBuy={handleCancelPendingMarketBuy}
                onFinalizePendingBuy={handleFinalizePendingMarketBuy}
              />
            </div>
          )}

          {activeSection === 'alliances' && (
            <div className="flex-1 min-w-0 h-full">
              <AlliancesView
                state={state}
                now={now}
                onCreateAlliance={handleCreateAlliance}
                onLeaveAlliance={handleLeaveAlliance}
              />
            </div>
          )}

          {activeSection === 'store' && (
            <div className="flex-1 min-w-0 h-full">
              <StoreView
                state={state}
                now={now}
                onSubmitPaymentOrder={handleSubmitPaymentOrder}
                onBuySpeedUpCard={handleBuySpeedUpCard}
                onBuyCombatBuff={handleBuyCombatBuff}
                onBuyProtectionShield={handleBuyProtectionShield}
                onNavigateSupport={() => setActiveSection('support')}
              />
            </div>
          )}

          {activeSection === 'monthly' && (
            <div className="flex-1 min-w-0 h-full">
              <MonthlyRewardsView
                state={state}
                now={now}
                onClaimDay={handleClaimMonthlyDay}
                onGoToStore={() => setActiveSection('store')}
              />
            </div>
          )}

          {activeSection === 'support' && (
            <div className="flex-1 min-w-0 h-full">
              <SupportView
                state={state}
                onCreateTicket={handleCreateTicket}
                onReplyTicket={handlePlayerReplyTicket}
                onMarkTicketRead={handleMarkTicketRead}
              />
            </div>
          )}

          {/* Persistent Interactive Advisor Character Widget */}
          <AdvisorWidget
            state={state}
            activeSection={activeSection}
            now={now}
            onOpenAdvisorHub={handleOpenAdvisorHub}
            onRunPlanStep={handleRunSmartCycle}
            onNavigateAndFocus={handleNavigateAndFocus}
            onToggleSmartBot={handleToggleSmartBot}
          />

          {/* Non-blocking Toast Banner */}
          {toast && (
            <div
              role="status"
              className={`fixed bottom-16 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] text-center px-4 py-2.5 rounded-xl border shadow-2xl text-xs font-bold transition-opacity ${
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

      {/* Bottom Panels */}
      <BottomDock
        state={state}
        now={now}
        onNavigate={setActiveSection}
        onClaimQuest={handleClaimQuest}
        onUseSpeedUp={handleUseSpeedUp}
        onUseSpeedUpResearch={handleUseSpeedUpResearch}
        onUseSpeedUpTraining={handleUseSpeedUpTraining}
        onSpeedUpMarch={handleSpeedUpMarch}
      />

      {/* Active Shield Attack Cancellation Confirmation Modal (§17) */}
      {shieldConfirmAttack && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShieldConfirmAttack(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl glass-panel border border-rose-500/60 p-5 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-rose-300">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/45 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    تحذير: الهجوم يُلغي درع الحماية فورًا
                  </h3>
                  <p className="text-[11px] text-rose-300 mt-0.5">
                    درع مدينتك مفعّل حاليًا
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShieldConfirmAttack(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/35 border border-rose-500/35 text-slate-200 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span>
                شنّ هجوم عسكري على مدينة أخرى سيؤدي إلى إلغاء درع الحماية الخاص بمدينتك فورًا وبدون أي استرجاع لقيمته من الجواهر. هل تؤكد إرسال الحملة؟
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShieldConfirmAttack(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
              >
                تراجع والاحتفاظ بالدرع
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = shieldConfirmAttack;
                  setShieldConfirmAttack(null);
                  executeConfirmedAttack(target.tileId, target.units);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                تأكيد الهجوم وإلغاء الدرع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showBotModal && (
        <BotModal
          state={state}
          now={now}
          initialTab={botModalTab}
          onClose={() => setShowBotModal(false)}
          onToggleSmartBot={handleToggleSmartBot}
          onUpdateBotConfig={handleUpdateBotConfig}
          onRunBotPlanStep={handleRunBotPlanStep}
          onRunSmartCycle={handleRunSmartCycle}
          onExecuteStep={handleExecutePlanStep}
          onRunBotResourceRaid={handleRunBotResourceRaid}
          onNavigateAndFocus={handleNavigateAndFocus}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          state={state}
          now={now}
          onClose={() => setShowSettingsModal(false)}
          onUpdateProfile={(commanderName, cityName) =>
            setState((prev) => ({ ...prev, commanderName, cityName }))
          }
          onToggleSound={() =>
            setState((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
          }
          onResetCity={handleResetCity}
          onLogout={handleLogout}
          onGenerateTelegramCode={handleGenerateTelegramCode}
          onLinkTelegram={handleLinkTelegram}
          onUnlinkTelegram={handleUnlinkTelegram}
          onUpdateTelegramAlerts={handleUpdateTelegramAlerts}
        />
      )}
    </div>
  );
}
