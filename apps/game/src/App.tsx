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
import {
  PlayerAuthScreen,
  PlayerRegisterPayload,
} from './components/PlayerAuthScreen';
import {
  AlliancesView,
  CoopQuestsViewData,
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
import {
  API_ENDPOINTS,
  ApiClientError,
  AuthSessionResponse,
  CITY_PLOTS,
  CoopQuestClaimResponse,
  CoopQuestsStatusResponse,
  GameConfigResponse,
  GamePaymentOrderResponse,
  GameStateSyncResponse,
  MigrateLocalResponse,
  SMART_BOT_PLANS,
  apiRequest,
  createInitialState,
  hydrateLoadedState,
  newReceiptId,
  readLegacyLocalState,
  resolveApiBaseUrl,
  stripInlineReceiptPreviews,
  uploadReceiptImage,
} from '@enginora/shared';
import {
  StrategicPlanStep,
  runSmartStrategyCycle,
} from './engine/advisorEngine';
import {
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
  publishMarketOffer,
  replyToSupportTicket,
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

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

function hasSubstantialLocalProgress(local: GameState): boolean {
  const hqLevel = local.buildings.find((b) => b.type === 'hq')?.level ?? 1;
  return (
    local.buildings.length > 3 ||
    hqLevel > 1 ||
    local.buildQueue.length > 0 ||
    local.researchQueue.length > 0 ||
    local.trainingQueue.length > 0 ||
    local.paymentOrders.length > 0 ||
    local.supportTickets.length > 0 ||
    local.maritime.cargoShips + local.maritime.surveyVessels > 0
  );
}

function mergeAuthoritativeServerFields(
  local: GameState,
  server: GameState
): GameState {
  const serverOrders = server.paymentOrders ?? [];
  const serverOrderIds = new Set(serverOrders.map((o) => o.id));
  const localPendingOrders = (local.paymentOrders ?? []).filter(
    (o) => o.status === 'pending' && !serverOrderIds.has(o.id)
  );
  const serverAdminTs = Number(server.lastAdminSyncAt ?? 0);
  const localAdminTs = Number(local.lastAdminSyncAt ?? 0);
  const localAuditIds = new Set((local.adminAuditLogs ?? []).map((l) => l.id));
  const serverNewAudit = (server.adminAuditLogs ?? []).some(
    (l) => !localAuditIds.has(l.id)
  );
  const hasNewAdminSync = serverAdminTs > localAdminTs || serverNewAudit;

  return {
    ...local,
    accountId: server.accountId,
    adminConfig: server.adminConfig,
    selectedServerId: server.selectedServerId ?? local.selectedServerId,
    registration: server.registration,
    paymentOrders: [...localPendingOrders, ...serverOrders],
    gemLedger: server.gemLedger,
    ledger: {
      ...local.ledger,
      paidGems: server.ledger?.paidGems ?? local.ledger.paidGems,
      ...(hasNewAdminSync
        ? {
            tradeBalance: server.ledger?.tradeBalance ?? local.ledger.tradeBalance,
            achievementPoints:
              server.ledger?.achievementPoints ?? local.ledger.achievementPoints,
          }
        : {}),
    },
    ...(hasNewAdminSync
      ? {
          commanderName: server.commanderName,
          cityName: server.cityName,
          resources: server.resources,
          maritime: {
            ...local.maritime,
            crudeOilStock:
              server.maritime?.crudeOilStock ?? local.maritime.crudeOilStock,
            naturalGasStock:
              server.maritime?.naturalGasStock ?? local.maritime.naturalGasStock,
          },
          shieldEndsAt: server.shieldEndsAt,
          speedUpCards: server.speedUpCards,
        }
      : {}),
    hakimSubscription: server.hakimSubscription,
    vipSubscription: server.vipSubscription,
    smartBotActive: server.smartBotActive,
    smartBotExpiresAt: server.smartBotExpiresAt,
    supportTickets: server.supportTickets,
    financialLogs: server.financialLogs,
    adminAuditLogs: server.adminAuditLogs,
    coopQuestClaims: server.coopQuestClaims ?? local.coopQuestClaims,
    lastAdminSyncAt: server.lastAdminSyncAt ?? local.lastAdminSyncAt,
    market: {
      ...local.market,
      marketFrozenForPlayer: server.market?.marketFrozenForPlayer,
      marketBanUntil: server.market?.marketBanUntil,
      playerInternalDebtGems: server.market?.playerInternalDebtGems ?? 0,
    },
  };
}

export default function App() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [now, setNow] = useState<number>(() => Date.now());
  const [activeSection, setActiveSection] = useState<NavSection>('city');
  const [alliancesInitialTab, setAlliancesInitialTab] = useState<
    'directory' | 'coop_quests' | 'council' | 'treasury'
  >('directory');
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [pendingBuildType, setPendingBuildType] = useState<BuildingType | null>(null);
  const [showBotModal, setShowBotModal] = useState(false);
  const [botModalTab, setBotModalTab] = useState<AdvisorModalTab>('qa');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [coopQuestsData, setCoopQuestsData] = useState<CoopQuestsViewData | null>(null);
  const [coopLoading, setCoopLoading] = useState(false);
  const [claimingCoopQuestId, setClaimingCoopQuestId] = useState<string | null>(null);
  const [shieldConfirmAttack, setShieldConfirmAttack] =
    useState<PendingAttackConfirm | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const stateRef = useRef<GameState>(state);
  stateRef.current = state;
  const authTokenRef = useRef<string | null>(authToken);
  authTokenRef.current = authToken;
  const serverRevisionRef = useRef<number>(1);
  const dirtyRef = useRef<boolean>(false);
  const syncInFlightRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);

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

  const applyStateSync = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const syncStateToServer = useCallback(
    async (opts?: { keepalive?: boolean; overrideState?: GameState }) => {
      const token = authTokenRef.current;
      if (!token) return false;
      if (syncInFlightRef.current && !opts?.keepalive) return false;

      const payloadState = stripInlineReceiptPreviews(
        opts?.overrideState ?? stateRef.current
      );
      syncInFlightRef.current = true;
      try {
        const res = await apiRequest<GameStateSyncResponse>(
          API_ENDPOINTS.gameState,
          {
            method: 'PUT',
            token,
            baseUrl: API_BASE_URL,
            keepalive: opts?.keepalive,
            body: {
              state: payloadState,
              expectedRevision: serverRevisionRef.current,
            },
          }
        );

        serverRevisionRef.current = res.revision;
        dirtyRef.current = false;
        const hydrated = hydrateLoadedState(res.state, res.serverTimeUtc || Date.now());
        applyStateSync(hydrated);
        return true;
      } catch (err) {
        if (err instanceof ApiClientError) {
          if (err.status === 409 && err.payload?.state) {
            const srvRev = Number(err.payload.serverRevision ?? serverRevisionRef.current);
            serverRevisionRef.current = srvRev;
            const serverHydrated = hydrateLoadedState(
              err.payload.state as Partial<GameState>,
              Number(err.payload.serverTimeUtc ?? Date.now())
            );
            const prevLocalAdminTs = Number(stateRef.current.lastAdminSyncAt ?? 0);
            const srvAdminTs = Number(serverHydrated.lastAdminSyncAt ?? 0);
            const adminUpdatedOnServer = srvAdminTs > prevLocalAdminTs;

            const merged = dirtyRef.current
              ? mergeAuthoritativeServerFields(stateRef.current, serverHydrated)
              : serverHydrated;
            const cleanMerged = stripInlineReceiptPreviews(merged);

            if (adminUpdatedOnServer) {
              if (debounceTimerRef.current) {
                window.clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
              dirtyRef.current = false;
              applyStateSync(cleanMerged);
              pushToast('تم تحديث بيانات حسابك ومواردك من لوحة الإدارة.', 'info');
              return true;
            }

            applyStateSync(cleanMerged);
            // Try saving merged state immediately under the latest revision
            if (dirtyRef.current && !opts?.keepalive) {
              try {
                const retry = await apiRequest<GameStateSyncResponse>(
                  API_ENDPOINTS.gameState,
                  {
                    method: 'PUT',
                    token,
                    baseUrl: API_BASE_URL,
                    body: {
                      state: cleanMerged,
                      expectedRevision: srvRev,
                    },
                  }
                );
                serverRevisionRef.current = retry.revision;
                dirtyRef.current = false;
                applyStateSync(
                  hydrateLoadedState(retry.state, retry.serverTimeUtc || Date.now())
                );
                return true;
              } catch {
                // Next sync cycle will retry
              }
            }
          } else if (err.status === 401) {
            setAuthToken(null);
            dirtyRef.current = false;
            pushToast('انتهت جلسة الدخول أو تم تحديث كلمة المرور. سجل الدخول مجددًا.', 'error');
          }
        }
        return false;
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [applyStateSync, pushToast]
  );

  const commitState = useCallback(
    (updater: GameState | ((prev: GameState) => GameState), immediate = false) => {
      setState((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (p: GameState) => GameState)(prev)
            : updater;
        stateRef.current = next;
        return next;
      });
      if (!authTokenRef.current) return;
      dirtyRef.current = true;
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (immediate) {
        void syncStateToServer();
      } else {
        debounceTimerRef.current = window.setTimeout(() => {
          debounceTimerRef.current = null;
          if (dirtyRef.current) {
            void syncStateToServer();
          }
        }, 1200);
      }
    },
    [syncStateToServer]
  );

  const pullLatestFromServer = useCallback(async () => {
    const token = authTokenRef.current;
    if (!token) {
      try {
        const cfgRes = await apiRequest<GameConfigResponse>(
          API_ENDPOINTS.gameConfig,
          { baseUrl: API_BASE_URL }
        );
        setState((prev) => {
          const next: GameState = {
            ...prev,
            adminConfig: cfgRes.adminConfig,
            selectedServerId:
              cfgRes.adminConfig.servers?.some((s) => s.id === prev.selectedServerId)
                ? prev.selectedServerId
                : cfgRes.adminConfig.servers?.[0]?.id ?? prev.selectedServerId,
          };
          stateRef.current = next;
          return next;
        });
      } catch {
        // Ignore transient offline error
      }
      return;
    }

    if (dirtyRef.current) {
      await syncStateToServer();
      return;
    }

    setIsSyncBusy(true);
    try {
      const res = await apiRequest<GameStateSyncResponse>(
        API_ENDPOINTS.gameState,
        { token, baseUrl: API_BASE_URL }
      );
      serverRevisionRef.current = res.revision;
      const hydrated = hydrateLoadedState(res.state, res.serverTimeUtc || Date.now());
      const prevAdminSync = Number(stateRef.current.lastAdminSyncAt ?? 0);
      const nextAdminSync = Number(hydrated.lastAdminSyncAt ?? 0);
      const sameAccount = stateRef.current.accountId === hydrated.accountId;
      applyStateSync(hydrated);
      if (sameAccount && nextAdminSync > prevAdminSync) {
        pushToast('تم تحديث بيانات حسابك ومواردك من لوحة الإدارة.', 'info');
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setAuthToken(null);
        dirtyRef.current = false;
        pushToast('انتهت الجلسة. يرجى تسجيل الدخول مجددًا.', 'error');
      }
    } finally {
      setIsSyncBusy(false);
    }
  }, [applyStateSync, pushToast, syncStateToServer]);

  // Initial public config fetch & fast periodic refresh so Admin edits arrive promptly
  useEffect(() => {
    void pullLatestFromServer();
    const pollMs = authToken ? 6000 : 8000;
    const id = window.setInterval(() => {
      void pullLatestFromServer();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [authToken, pullLatestFromServer]);

  // Flush dirty state on tab hide/close and pull fresh state immediately on tab focus/return
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (authTokenRef.current && dirtyRef.current) {
          void syncStateToServer({ keepalive: true });
        }
      } else if (document.visibilityState === 'visible') {
        void pullLatestFromServer();
      }
    };
    const handleFocus = () => {
      void pullLatestFromServer();
    };
    const handlePageHide = () => {
      if (authTokenRef.current && dirtyRef.current) {
        void syncStateToServer({ keepalive: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [pullLatestFromServer, syncStateToServer]);

  // 1-second deterministic world tick (local memory only; server syncs on mutations/checkpoints)
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
        commitState(result.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
    pushToast('تم استلام مكافأة المهمة!', 'success');
  };

  const fetchCoopQuests = useCallback(async () => {
    const token = authTokenRef.current;
    if (!token) return;
    setCoopLoading(true);
    try {
      if (dirtyRef.current) {
        await syncStateToServer();
      }
      const res = await apiRequest<CoopQuestsStatusResponse>(
        API_ENDPOINTS.coopQuests,
        { token, baseUrl: API_BASE_URL }
      );
      setCoopQuestsData({
        serverId: res.serverId,
        serverName: res.serverName,
        serverPlayersCount: res.serverPlayersCount,
        eligibleForCoop: res.eligibleForCoop,
        mainLevel: res.mainLevel,
        allianceCenterLevel: res.allianceCenterLevel,
        quests: res.quests,
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        pushToast(err.message, 'error');
      }
    } finally {
      setCoopLoading(false);
    }
  }, [pushToast, syncStateToServer]);

  useEffect(() => {
    if (authToken && activeSection === 'alliances') {
      void fetchCoopQuests();
    }
  }, [authToken, activeSection, fetchCoopQuests]);

  const handleClaimCoopQuest = async (questId: string) => {
    const token = authTokenRef.current;
    if (!token) return;
    setClaimingCoopQuestId(questId);
    try {
      if (dirtyRef.current) {
        await syncStateToServer();
      }
      const res = await apiRequest<CoopQuestClaimResponse>(
        API_ENDPOINTS.coopQuestsClaim,
        {
          method: 'POST',
          token,
          baseUrl: API_BASE_URL,
          body: { questId },
        }
      );
      serverRevisionRef.current = res.revision;
      dirtyRef.current = false;
      const hydrated = hydrateLoadedState(res.state, res.serverTimeUtc || Date.now());
      setState(hydrated);
      stateRef.current = hydrated;
      setCoopQuestsData((prev) =>
        prev ? { ...prev, quests: res.quests } : prev
      );
      soundFx.play('claim', hydrated.soundEnabled);
      pushToast('تم استلام مكافأة المهمة المشتركة للسيرفر!', 'success');
    } catch (err) {
      soundFx.play('error', stateRef.current.soundEnabled);
      pushToast(
        err instanceof ApiClientError
          ? err.message
          : 'تعذر استلام مكافأة المهمة المشتركة.',
        'error'
      );
    } finally {
      setClaimingCoopQuestId(null);
    }
  };

  const handleClaimMonthlyDay = (day: number) => {
    const res = claimMonthlyRewardDay(state, day, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    commitState(res.state);
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
    const hasPaidHakim = Boolean(
      state.hakimSubscription?.active &&
        typeof state.hakimSubscription?.expiresAt === 'number' &&
        state.hakimSubscription.expiresAt > currentNow
    );
    if (!hasPaidHakim) {
      soundFx.play('error', state.soundEnabled);
      setShowBotModal(false);
      setActiveSection('store');
      pushToast(
        'المستشار الذكي «حكيم» يتطلب اشتراكًا مدفوعًا مفعّلًا من المتجر الرسمي ولا يعمل مجانًا.',
        'info'
      );
      return;
    }

    const activating = !state.smartBotActive;
    commitState((prev) => {
      const paidValid = Boolean(
        prev.hakimSubscription?.active &&
          typeof prev.hakimSubscription?.expiresAt === 'number' &&
          prev.hakimSubscription.expiresAt > currentNow
      );
      if (!paidValid) {
        return {
          ...prev,
          smartBotActive: false,
          smartBotExpiresAt: null,
        };
      }
      const nextActivating = !prev.smartBotActive;
      const baseNext: GameState = {
        ...prev,
        smartBotActive: nextActivating,
        smartBotExpiresAt: prev.hakimSubscription.expiresAt,
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
        ? 'تم استئناف التشغيل التلقائي للمستشار الذكي حكيم (4 بناء · 2 بحث).'
        : 'تم إيقاف التشغيل التلقائي مؤقتًا — اشتراكك في حكيم ما زال محفوظًا.',
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
    pushToast('انطلقت بعثة المسح السيزمي لاستكشاف النفط والغاز.', 'success');
  };

  const handleUpdateBotConfig = (patch: Partial<BotConfig>) => {
    const nowTs = Date.now();
    commitState((prev) => {
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState({
      ...res.state,
      botConfig: {
        ...res.state.botConfig,
        lastActionAt: nowTs,
        lastActionSummary: res.summary ?? step.title,
      },
    });
    pushToast(res.summary ?? step.title, 'success');
  };

  // Store & Payment Handlers (Direct Atomic D1 Persistence via POST /api/game/payment-orders)
  const handleSubmitPaymentOrder = async (
    productType: OrderProductType,
    productId: string,
    paymentMethod: PaymentMethodId,
    transferRef: string,
    receiptName?: string,
    receiptPreviewUrl?: string
  ): Promise<{ error?: string }> => {
    const token = authTokenRef.current;
    let uploadedReceiptId: string | undefined;
    if (
      token &&
      receiptPreviewUrl &&
      receiptPreviewUrl.startsWith('data:image/')
    ) {
      const candidateId = newReceiptId();
      const ok = await uploadReceiptImage(
        token,
        candidateId,
        receiptPreviewUrl,
        API_BASE_URL
      );
      if (!ok) {
        const errMsg =
          'تعذر رفع صورة الفاتورة إلى الخادم. تأكد من الاتصال وحجم الصورة وحاول مجددًا.';
        soundFx.play('error', stateRef.current.soundEnabled);
        pushToast(errMsg, 'error');
        return { error: errMsg };
      }
      uploadedReceiptId = candidateId;
    }

    if (token) {
      try {
        const res = await apiRequest<GamePaymentOrderResponse>(
          API_ENDPOINTS.gamePaymentOrders,
          {
            method: 'POST',
            token,
            baseUrl: API_BASE_URL,
            body: {
              productType,
              productId,
              paymentMethod,
              transferRef,
              receiptName,
              receiptId: uploadedReceiptId,
            },
          }
        );

        serverRevisionRef.current = res.revision;
        const hydratedServer = hydrateLoadedState(
          res.state,
          res.serverTimeUtc || Date.now()
        );
        setState((prev) => {
          const existingIds = new Set(hydratedServer.paymentOrders.map((o) => o.id));
          const mergedOrders = existingIds.has(res.order.id)
            ? hydratedServer.paymentOrders
            : [res.order, ...hydratedServer.paymentOrders];
          const nextState: GameState = {
            ...prev,
            adminConfig: hydratedServer.adminConfig,
            paymentOrders: mergedOrders,
          };
          stateRef.current = nextState;
          return nextState;
        });

        soundFx.play('claim', stateRef.current.soundEnabled);
        pushToast(
          `تم إرسال الطلب ${res.order.id} وحفظه في قاعدة البيانات بحالة «قيد المراجعة» ليظهر مباشرة في لوحة الإدارة.`,
          'success'
        );
        return {};
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : 'تعذر حفظ طلب الدفع في الخادم. يرجى المحاولة مجددًا.';
        if (err instanceof ApiClientError && err.status === 401) {
          setAuthToken(null);
          dirtyRef.current = false;
        }
        soundFx.play('error', stateRef.current.soundEnabled);
        pushToast(errMsg, 'error');
        return { error: errMsg };
      }
    }

    const res = submitPaymentOrder(
      stateRef.current,
      productType,
      productId,
      paymentMethod,
      transferRef,
      receiptName,
      uploadedReceiptId ? undefined : receiptPreviewUrl,
      Date.now(),
      uploadedReceiptId
    );
    if (res.error) {
      soundFx.play('error', stateRef.current.soundEnabled);
      pushToast(res.error, 'error');
      return { error: res.error };
    }
    soundFx.play('claim', stateRef.current.soundEnabled);
    commitState(stripInlineReceiptPreviews(res.state), true);
    pushToast(
      `تم إرسال طلب الدفع ${res.order?.id ?? ''} بحالة «قيد المراجعة» بانتظار اعتماد المؤسس.`,
      'success'
    );
    return {};
  };

  const handleBuySpeedUpCard = (tierId: SpeedUpTierId, qty: number) => {
    const res = buySpeedUpCard(state, tierId, qty, Date.now());
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      pushToast(res.error, 'error');
      return;
    }
    soundFx.play('claim', state.soundEnabled);
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
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
    commitState(res.state);
    pushToast('تم تأسيس التحالف الجديد مجانًا (الحد الأقصى 10 أعضاء).', 'success');
  };

  const handleLeaveAlliance = () => {
    soundFx.play('click', state.soundEnabled);
    commitState((prev) => leaveAlliance(prev));
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
    commitState(res.state);
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
    commitState(res.state);
    pushToast('تم إرسال ردك إلى فريق الدعم.', 'success');
  };

  const handleMarkTicketRead = (ticketId: string) => {
    commitState((prev) => ({
      ...prev,
      supportTickets: prev.supportTickets.map((t) =>
        t.id === ticketId ? { ...t, unreadByPlayer: false } : t
      ),
    }));
  };


  // Telegram Linking Handlers
  const handleGenerateTelegramCode = () => {
    soundFx.play('click', state.soundEnabled);
    commitState((prev) => generateTelegramCode(prev, Date.now()));
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
    commitState(res.state);
    pushToast('تم ربط حساب تيليغرام بنجاح وتفعيل التنبيهات الفورية.', 'success');
  };

  const handleUnlinkTelegram = () => {
    soundFx.play('click', state.soundEnabled);
    commitState((prev) => unlinkTelegramAccount(prev));
    pushToast('تم فك ربط حساب تيليغرام.', 'info');
  };

  const handleUpdateTelegramAlerts = (
    patch: Partial<GameState['telegram']['alerts']>
  ) => {
    soundFx.play('click', state.soundEnabled);
    commitState((prev) => updateTelegramAlerts(prev, patch));
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

  const handleSubmitRegistration = async (
    payload: PlayerRegisterPayload
  ): Promise<{ error?: string }> => {
    const currentNow = Date.now();
    const hasInlineReceipt = Boolean(
      payload.receiptPreviewUrl && payload.receiptPreviewUrl.startsWith('data:image/')
    );
    const candidateReceiptId = hasInlineReceipt
      ? newReceiptId()
      : payload.receiptId;

    const res = submitPlayerRegistration(
      state,
      { ...payload, receiptId: candidateReceiptId },
      currentNow
    );
    if (res.error) {
      soundFx.play('error', state.soundEnabled);
      return { error: res.error };
    }

    // Logged-in user resubmitting rejected/pending registration data & receipt
    if (authTokenRef.current) {
      setIsSyncBusy(true);
      try {
        let uploadOk = false;
        if (hasInlineReceipt && candidateReceiptId && payload.receiptPreviewUrl) {
          uploadOk = await uploadReceiptImage(
            authTokenRef.current,
            candidateReceiptId,
            payload.receiptPreviewUrl,
            API_BASE_URL
          );
        }
        const nextStateForServer = uploadOk
          ? stripInlineReceiptPreviews(res.state)
          : {
              ...res.state,
              registration: {
                ...res.state.registration,
                receiptId: hasInlineReceipt ? undefined : res.state.registration.receiptId,
              },
              paymentOrders: res.state.paymentOrders.map((o) =>
                o.productType === 'registration_fee' && hasInlineReceipt
                  ? { ...o, receiptId: undefined }
                  : o
              ),
            };
        const synced = await syncStateToServer({ overrideState: nextStateForServer });
        if (!synced) {
          return { error: 'تعذر تحديث الطلب على الخادم، يرجى المحاولة مرة أخرى.' };
        }
        soundFx.play('claim', state.soundEnabled);
        pushToast('تم تحديث طلب التسجيل وإرساله للمراجعة في قاعدة البيانات.', 'success');
        return {};
      } finally {
        setIsSyncBusy(false);
      }
    }

    if (!payload.password || payload.password.length < 8) {
      return { error: 'كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل.' };
    }

    const leanStateForRegister = stripInlineReceiptPreviews(res.state);

    try {
      const authRes = await apiRequest<AuthSessionResponse>(
        API_ENDPOINTS.authRegister,
        {
          method: 'POST',
          baseUrl: API_BASE_URL,
          body: {
            email: payload.email,
            phone: payload.phone,
            password: payload.password,
            commanderName: payload.nickname,
            nickname: payload.nickname,
            serverId: payload.serverId ?? state.selectedServerId,
            registration: leanStateForRegister.registration,
            paymentOrders: leanStateForRegister.paymentOrders,
          },
        }
      );

      serverRevisionRef.current = authRes.revision;
      dirtyRef.current = false;
      setAuthToken(authRes.token);
      authTokenRef.current = authRes.token;

      let uploadedOk = true;
      if (hasInlineReceipt && candidateReceiptId && payload.receiptPreviewUrl) {
        uploadedOk = await uploadReceiptImage(
          authRes.token,
          candidateReceiptId,
          payload.receiptPreviewUrl,
          API_BASE_URL
        );
      }

      const hydrated = hydrateLoadedState(
        authRes.state,
        authRes.serverTimeUtc || currentNow
      );
      applyStateSync(hydrated);

      if (!uploadedOk && payload.receiptPreviewUrl) {
        // Fallback so receipt is never lost if /api/receipts transiently failed
        await syncStateToServer({
          overrideState: {
            ...hydrated,
            registration: {
              ...hydrated.registration,
              receiptId: undefined,
              receiptPreviewUrl: payload.receiptPreviewUrl,
            },
          },
        });
      }

      soundFx.play('claim', state.soundEnabled);
      pushToast(
        `تم إنشاء الحساب (${authRes.accountId}) وإرسال فاتورتك للمراجعة من الإدارة.`,
        'success'
      );
      return {};
    } catch (err) {
      soundFx.play('error', state.soundEnabled);
      return {
        error:
          err instanceof Error
            ? err.message
            : 'تعذر إرسال طلب التسجيل إلى الخادم حاليًا.',
      };
    }
  };

  const activeServer =
    state.adminConfig.servers?.find((s) => s.id === state.selectedServerId) ??
    state.adminConfig.servers?.[0];
  const isServerOpen = Boolean(activeServer?.isOpen);

  const handleSelectServer = (serverId: string) => {
    soundFx.play('click', state.soundEnabled);
    commitState((prev) => ({
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
      return { error: 'أدخل البريد الإلكتروني أو رقم الجوال أو معرّف الحساب وكلمة المرور.' };
    }

    try {
      const loginRes = await apiRequest<AuthSessionResponse>(
        API_ENDPOINTS.authLogin,
        {
          method: 'POST',
          baseUrl: API_BASE_URL,
          body: { identifier: clean, password },
        }
      );

      let resolvedState = hydrateLoadedState(
        loginRes.state,
        loginRes.serverTimeUtc || Date.now()
      );
      let resolvedRevision = loginRes.revision;

      // One-time safe migration of pre-existing local save if server account is fresh
      if (resolvedRevision === 1) {
        const legacyLocal = readLegacyLocalState();
        if (legacyLocal && hasSubstantialLocalProgress(legacyLocal)) {
          try {
            const migRes = await apiRequest<MigrateLocalResponse>(
              API_ENDPOINTS.gameMigrateLocal,
              {
                method: 'POST',
                token: loginRes.token,
                baseUrl: API_BASE_URL,
                body: { localState: legacyLocal },
              }
            );
            if (migRes.migrated) {
              resolvedRevision = migRes.revision;
              resolvedState = hydrateLoadedState(
                migRes.state,
                migRes.serverTimeUtc || Date.now()
              );
              pushToast('تم ترحيل بيانات مدينتك السابقة إلى السحابة تلقائيًا.', 'success');
            }
          } catch {
            // Non-fatal: continue with cloud state
          }
        }
      }

      serverRevisionRef.current = resolvedRevision;
      dirtyRef.current = false;
      authTokenRef.current = loginRes.token;
      setAuthToken(loginRes.token);
      applyStateSync(resolvedState);
      soundFx.play('claim', resolvedState.soundEnabled);

      if (resolvedState.registration.status === 'approved') {
        const srv =
          resolvedState.adminConfig.servers?.find(
            (s) => s.id === resolvedState.selectedServerId
          ) ?? resolvedState.adminConfig.servers?.[0];
        if (srv?.isOpen) {
          pushToast(
            `أهلاً بك أيها القائد ${resolvedState.registration.nickname || resolvedState.commanderName}.`,
            'success'
          );
        } else {
          pushToast('حسابك معتمد، وبانتظار فتح السيرفر من الإدارة.', 'info');
        }
      } else {
        pushToast('تم تسجيل الدخول — طلبك قيد مراجعة الإدارة.', 'info');
      }
      return {};
    } catch (err) {
      soundFx.play('error', state.soundEnabled);
      return {
        error:
          err instanceof Error
            ? err.message
            : 'بيانات الدخول غير صحيحة أو تعذر الاتصال بالخادم.',
      };
    }
  };

  const handleLogout = async () => {
    const token = authTokenRef.current;
    if (token && dirtyRef.current) {
      await syncStateToServer();
    }
    if (token) {
      try {
        await apiRequest<{ ok: true }>(API_ENDPOINTS.authLogout, {
          method: 'POST',
          token,
          baseUrl: API_BASE_URL,
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    dirtyRef.current = false;
    serverRevisionRef.current = 1;
    setAuthToken(null);
    setSelectedPlotId(null);
    setPendingBuildType(null);
    setActiveSection('city');
    setState((prev) => ({
      ...createInitialState(),
      adminConfig: prev.adminConfig,
      selectedServerId:
        prev.adminConfig.servers?.[0]?.id ?? prev.selectedServerId,
    }));
    pushToast('تم تسجيل الخروج بأمان.', 'info');
  };

  const handleResetCity = async () => {
    const token = authTokenRef.current;
    if (!token) return;
    setIsSyncBusy(true);
    try {
      const res = await apiRequest<GameStateSyncResponse>(
        API_ENDPOINTS.gameReset,
        {
          method: 'POST',
          token,
          baseUrl: API_BASE_URL,
        }
      );
      serverRevisionRef.current = res.revision;
      dirtyRef.current = false;
      setState(hydrateLoadedState(res.state, res.serverTimeUtc || Date.now()));
      setSelectedPlotId(null);
      setPendingBuildType(null);
      setActiveSection('city');
      pushToast(
        'تمت إعادة ضبط المدينة إلى البداية المتساوية (المبنى الرئيسي المستوى 1) مع حفظ الجواهر والاشتراكات.',
        'info'
      );
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : 'تعذر إعادة ضبط المدينة على الخادم.',
        'error'
      );
    } finally {
      setIsSyncBusy(false);
    }
  };

  // Player Registration, Login & Server Gate
  if (!authToken || state.registration.status !== 'approved' || !isServerOpen) {
    return (
      <div className="relative min-h-[100dvh] w-screen overflow-hidden bg-[#060B17]">
        <PlayerAuthScreen
          state={state}
          authToken={authToken}
          apiBaseUrl={API_BASE_URL}
          isAuthenticated={Boolean(authToken)}
          isBusy={isSyncBusy}
          onSubmitRegistration={handleSubmitRegistration}
          onLoginApproved={handleLoginApproved}
          onSelectServer={handleSelectServer}
          onRefreshStatus={pullLatestFromServer}
          onLogout={authToken ? handleLogout : undefined}
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
                onOpenCoopQuests={() => {
                  setAlliancesInitialTab('coop_quests');
                  setActiveSection('alliances');
                }}
              />
            </div>
          )}

          {activeSection === 'reports' && (
            <div className="flex-1 min-w-0 h-full">
              <ReportsView
                state={state}
                onMarkAllRead={() =>
                  commitState((prev) => ({
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
                initialTab={alliancesInitialTab}
                coopQuestsData={coopQuestsData}
                coopLoading={coopLoading}
                claimingCoopQuestId={claimingCoopQuestId}
                onRefreshCoopQuests={() => void fetchCoopQuests()}
                onClaimCoopQuest={(qId) => void handleClaimCoopQuest(qId)}
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
            onOpenStore={() => setActiveSection('store')}
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
          onOpenStore={() => {
            setShowBotModal(false);
            setActiveSection('store');
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          state={state}
          now={now}
          onClose={() => setShowSettingsModal(false)}
          onUpdateProfile={(commanderName, cityName) =>
            commitState((prev) => ({ ...prev, commanderName, cityName }))
          }
          onToggleSound={() =>
            commitState((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
          }
          onResetCity={() => void handleResetCity()}
          onLogout={() => void handleLogout()}
          onGenerateTelegramCode={handleGenerateTelegramCode}
          onLinkTelegram={handleLinkTelegram}
          onUnlinkTelegram={handleUnlinkTelegram}
          onUpdateTelegramAlerts={handleUpdateTelegramAlerts}
        />
      )}
    </div>
  );
}
