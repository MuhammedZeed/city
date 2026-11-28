import {
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_GAME_SERVERS,
  TICKET_STATUS_LABELS,
} from "@enginora/shared";
import {
  AdminConfig,
  AdminRole,
  FinancialCategory,
  GameState,
  PlayerRegistrationStatus,
  SpeedUpTierId,
  TicketStatus,
} from "@enginora/shared";
import {
  DEFAULT_REGISTRATION,
  appendAuditLog,
  appendFinancialLog,
  cloneAdminConfig,
  createInitialState,
  creditGems,
  creditResourceStock,
  formatKsaDateTime,
  getTotalGems,
} from "@enginora/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

export function adminReviewPaymentOrder(
  state: GameState,
  orderId: string,
  decision: 'approve' | 'reject' | 'refund',
  role: AdminRole,
  note: string,
  now: number
): { state: GameState; error?: string } {
  if (role !== 'founder') {
    return {
      state,
      error: 'صلاحية الاعتماد أو الرفض أو الاسترداد المالي حصرية لحساب المؤسس (Founder).',
    };
  }

  const order = state.paymentOrders.find((o) => o.id === orderId);
  if (!order) return { state, error: 'الطلب غير موجود.' };

  if (decision === 'approve') {
    if (order.status !== 'pending') {
      return { state, error: 'يمكن اعتماد الطلبات قيد الانتظار فقط.' };
    }
    let next: GameState = {
      ...state,
      paymentOrders: state.paymentOrders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'approved',
              reviewedAt: now,
              reviewedBy: 'المؤسس (Founder)',
              note: note.trim() || 'تمت المطابقة البنكية والاعتماد',
            }
          : o
      ),
    };

    let cat: FinancialCategory = 'gem_sales';
    let gemsDelta = 0;

    if (order.productType === 'gem_package') {
      const pack = next.adminConfig.gemPackages.find((p) => p.id === order.productId);
      if (pack) {
        next = creditGems(next, 'chargedGems', pack.baseGems);
        if (pack.bonusGems > 0) {
          next = creditGems(next, 'bonusGems', pack.bonusGems);
        }
        gemsDelta = pack.baseGems + pack.bonusGems;
      }
      cat = 'gem_sales';
    } else if (order.productType === 'hakim_sub') {
      const dur = next.adminConfig.hakimDurationDays * DAY_MS;
      const baseEnd = Math.max(now, next.smartBotExpiresAt ?? 0);
      next = {
        ...next,
        smartBotActive: true,
        smartBotExpiresAt: baseEnd + dur,
        hakimSubscription: {
          active: true,
          startedAt: next.hakimSubscription.startedAt ?? now,
          expiresAt: baseEnd + dur,
          renewCount: next.hakimSubscription.renewCount + 1,
        },
        botConfig: { ...next.botConfig, autoDevelopCity: true },
      };
      cat = 'hakim_subscription';
    } else if (order.productType === 'registration_fee') {
      next = {
        ...next,
        commanderName: next.registration.nickname || next.commanderName,
        registration: {
          ...next.registration,
          status: 'approved',
          reviewedAt: now,
          reviewedBy: 'المؤسس (Founder)',
          reviewNote: note.trim() || 'تمت مراجعة فاتورة الـ 200 ريال وقبول الحساب',
        },
      };
      cat = 'admin_adjustment';
    } else {
      const dur = next.adminConfig.vipDurationDays * DAY_MS;
      const baseEnd = Math.max(now, next.vipSubscription.expiresAt ?? 0);
      next = {
        ...next,
        vipSubscription: {
          active: true,
          startedAt: next.vipSubscription.startedAt ?? now,
          expiresAt: baseEnd + dur,
          renewCount: next.vipSubscription.renewCount + 1,
        },
      };
      cat = 'vip_subscription';
    }

    next = appendFinancialLog(next, {
      accountId: order.accountId,
      category: cat,
      actionType: `اعتماد دفع: ${order.productTitle}`,
      amountGems: gemsDelta,
      amountSar: order.amountSar,
      tradePointsDelta: 0,
      source: order.paymentMethod,
      referenceId: order.id,
      createdAt: now,
    });
    next = appendAuditLog(
      { ...next, lastAdminSyncAt: now },
      role,
      'اعتماد طلب دفع',
      `${order.id} — ${order.productTitle} (${order.amountSar} ريال)`,
      now
    );
    return { state: next };
  }

  if (decision === 'reject') {
    if (order.status !== 'pending') {
      return { state, error: 'يمكن رفض الطلبات قيد الانتظار فقط.' };
    }
    let next: GameState = {
      ...state,
      paymentOrders: state.paymentOrders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'rejected',
              reviewedAt: now,
              reviewedBy: 'المؤسس (Founder)',
              note: note.trim() || 'مرفوض لعدم مطابقة التحويل',
            }
          : o
      ),
      ...(order.productType === 'registration_fee'
        ? {
            registration: {
              ...state.registration,
              status: 'rejected',
              reviewedAt: now,
              reviewedBy: 'المؤسس (Founder)',
              reviewNote: note.trim() || 'مرفوض لعدم مطابقة فاتورة الـ 200 ريال',
            },
          }
        : {}),
    };
    next = appendAuditLog(next, role, 'رفض طلب دفع', `${order.id} — ${note || 'عدم المطابقة'}`, now);
    return { state: next };
  }

  // Refund
  if (order.status !== 'approved') {
    return { state, error: 'الاسترداد متاح للطلبات المعتمدة فقط.' };
  }
  let next: GameState = {
    ...state,
    paymentOrders: state.paymentOrders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: 'refunded',
            reviewedAt: now,
            reviewedBy: 'المؤسس (Founder)',
            note: note.trim() || 'تم استرداد العملية ماليًا',
          }
        : o
    ),
  };

  if (order.productType === 'gem_package') {
    const pack = next.adminConfig.gemPackages.find((p) => p.id === order.productId);
    if (pack) {
      const chargedDeduction = Math.min(next.gemLedger.chargedGems, pack.baseGems);
      const bonusDeduction = Math.min(next.gemLedger.bonusGems, pack.bonusGems);
      next.gemLedger = {
        ...next.gemLedger,
        chargedGems: next.gemLedger.chargedGems - chargedDeduction,
        bonusGems: next.gemLedger.bonusGems - bonusDeduction,
      };
      next.ledger.paidGems = getTotalGems(next);
    }
  } else if (order.productType === 'hakim_sub') {
    next.smartBotActive = false;
    next.smartBotExpiresAt = null;
    next.hakimSubscription = { ...next.hakimSubscription, active: false };
  } else if (order.productType === 'registration_fee') {
    next.registration = {
      ...next.registration,
      status: 'rejected',
      reviewedAt: now,
      reviewedBy: 'المؤسس (Founder)',
      reviewNote: note.trim() || 'تم استرداد رسوم التسجيل (200 ريال)',
    };
  } else {
    next.vipSubscription = { ...next.vipSubscription, active: false };
  }

  next = appendFinancialLog(next, {
    accountId: order.accountId,
    category: 'payment_refund',
    actionType: `استرداد مالي: ${order.productTitle}`,
    amountGems: 0,
    amountSar: -order.amountSar,
    tradePointsDelta: 0,
    source: order.paymentMethod,
    referenceId: order.id,
    createdAt: now,
  });
  next = appendAuditLog(next, role, 'استرداد مالي لطلب دفع', `${order.id} (${order.amountSar} ريال)`, now);
  return { state: next };
}

export function adminReverseMarketOfferOrTrade(
  state: GameState,
  offerId: string,
  role: AdminRole,
  reason: string,
  now: number
): { state: GameState; error?: string } {
  if (role !== 'founder') {
    return { state, error: 'صلاحية إلغاء/عكس صفقات السوق حصرية للمؤسس (Founder).' };
  }
  const offer = state.market.offers.find((o) => o.id === offerId);
  if (!offer) return { state, error: 'العرض غير موجود.' };

  const refundBuyerGems = Number(
    (((offer.initialQty - offer.remainingQty) / 1000) * offer.unitPriceGems).toFixed(2)
  );
  const feeRate = state.adminConfig.marketFeePct / 100;
  const cancelledCommission = Number((refundBuyerGems * feeRate).toFixed(2));
  const netSellerClawback = Number((refundBuyerGems - cancelledCommission).toFixed(2));

  let next = { ...state };
  if (offer.sellerId === next.accountId && offer.remainingQty > 0) {
    next = creditResourceStock(next, offer.resource, offer.remainingQty);
  }
  if (offer.sellerId === next.accountId && netSellerClawback > 0) {
    if (next.gemLedger.marketGems >= netSellerClawback) {
      next.gemLedger = {
        ...next.gemLedger,
        marketGems: Number((next.gemLedger.marketGems - netSellerClawback).toFixed(2)),
      };
      next.ledger.paidGems = getTotalGems(next);
    } else {
      const deficit = Number((netSellerClawback - next.gemLedger.marketGems).toFixed(2));
      next.gemLedger = { ...next.gemLedger, marketGems: 0 };
      next.ledger.paidGems = getTotalGems(next);
      next.market = {
        ...next.market,
        playerInternalDebtGems: Number(
          (next.market.playerInternalDebtGems + deficit).toFixed(2)
        ),
      };
    }
  }

  next = {
    ...next,
    market: {
      ...next.market,
      offers: next.market.offers.map((o) =>
        o.id === offerId
          ? {
              ...o,
              remainingQty: 0,
              reservedQty: 0,
              status: 'admin_cancelled',
              suspiciousFlag: true,
              flagReason: reason || 'تم العكس الإداري لمكافحة التلاعب وغسل الجواهر',
            }
          : o
      ),
      tradeLedger: [
        {
          id: `tl-adm-rev-${now}`,
          action: 'admin_reversal',
          resource: offer.resource,
          quantity: offer.initialQty,
          unitPriceGems: offer.unitPriceGems,
          grossGems: refundBuyerGems,
          commissionGems: cancelledCommission,
          netGems: netSellerClawback,
          buyerName: 'المشتري (مسترد)',
          sellerName: offer.sellerName,
          createdAt: now,
          note: reason || 'عكس صفقة/عرض مشبوه وإلغاء العمولة',
        },
        ...next.market.tradeLedger,
      ],
    },
  };

  next = appendFinancialLog(next, {
    accountId: offer.sellerId,
    category: 'cancelled_suspicious',
    actionType: `عكس عرض/تداول مشبوه (${offer.id})`,
    amountGems: -cancelledCommission,
    amountSar: 0,
    tradePointsDelta: 0,
    source: 'مكافحة التلاعب بالسوق',
    referenceId: offer.id,
    createdAt: now,
  });
  next = appendAuditLog(
    next,
    role,
    'عكس صفقة سوق مشبوهة',
    `العرض ${offer.id} — ${reason || 'تداول وهمي'}`,
    now
  );

  return { state: next };
}

export function adminToggleMarketFreeze(
  state: GameState,
  freeze: boolean,
  role: AdminRole,
  reason: string,
  now: number
): { state: GameState; error?: string } {
  if (role !== 'founder') {
    return { state, error: 'صلاحية تجميد السوق أو فك التجميد حصرية للمؤسس (Founder).' };
  }
  let next: GameState = {
    ...state,
    market: {
      ...state.market,
      marketFrozenForPlayer: freeze,
      marketBanUntil: freeze ? now + 7 * DAY_MS : null,
    },
  };
  next = appendAuditLog(
    next,
    role,
    freeze ? 'تجميد تداول الحساب في السوق' : 'إلغاء تجميد تداول الحساب',
    reason || 'قرار إداري لحماية نزاهة السوق',
    now
  );
  return { state: next };
}

export function updateAdminConfig(
  state: GameState,
  patch: Partial<AdminConfig>,
  role: AdminRole,
  summary: string,
  now: number
): { state: GameState; error?: string } {
  if (role !== 'founder') {
    return { state, error: 'تعديل الأسعار أو الإعدادات العامة حصري للمؤسس (Founder).' };
  }
  let next: GameState = {
    ...state,
    adminConfig: {
      ...state.adminConfig,
      ...patch,
    },
  };
  next = appendAuditLog(next, role, 'تحديث إعدادات المنصة', summary, now);
  return { state: next };
}

export function updateSupportTicketStatus(
  state: GameState,
  ticketId: string,
  status: TicketStatus,
  role: AdminRole,
  now: number
): { state: GameState; error?: string } {
  if (role !== 'founder' && role !== 'support') {
    return { state, error: 'تغيير حالة التذاكر متاح للدعم الفني أو المؤسس فقط.' };
  }
  let next: GameState = {
    ...state,
    supportTickets: state.supportTickets.map((t) =>
      t.id === ticketId
        ? { ...t, status, updatedAt: now, unreadBySupport: false }
        : t
    ),
  };
  next = appendAuditLog(
    next,
    role,
    'تحديث حالة تذكرة دعم',
    `${ticketId} → ${TICKET_STATUS_LABELS[status]}`,
    now
  );
  return { state: next };
}


export function adminReviewPlayerRegistration(
  state: GameState,
  decision: 'approve' | 'reject',
  role: AdminRole,
  note: string,
  now: number
): { state: GameState; error?: string } {
  if (role !== 'founder') {
    return {
      state,
      error: 'مراجعة واعتماد طلبات تسجيل اللاعبين حصرية للمؤسس (Founder) فقط.',
    };
  }
  if (state.registration.status !== 'pending') {
    return { state, error: 'لا يوجد طلب تسجيل قيد المراجعة حاليًا.' };
  }

  const pendingOrder = state.paymentOrders.find(
    (o) => o.productType === 'registration_fee' && o.status === 'pending'
  );
  if (pendingOrder) {
    return adminReviewPaymentOrder(state, pendingOrder.id, decision, role, note, now);
  }

  let next: GameState = {
    ...state,
    commanderName:
      decision === 'approve'
        ? state.registration.nickname || state.commanderName
        : state.commanderName,
    registration: {
      ...state.registration,
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewedAt: now,
      reviewedBy: 'المؤسس (Founder)',
      reviewNote:
        note.trim() ||
        (decision === 'approve'
          ? 'تم اعتماد بيانات اللاعب وفاتورة الـ 200 ريال'
          : 'تم رفض طلب التسجيل لعدم اكتمال المطابقة'),
    },
  };

  if (decision === 'approve') {
    next = appendFinancialLog(next, {
      accountId: next.accountId,
      category: 'admin_adjustment',
      actionType: `اعتماد تسجيل لاعب جديد (${next.registration.feeAmountSar} ريال)`,
      amountGems: 0,
      amountSar: next.registration.feeAmountSar,
      tradePointsDelta: 0,
      source: 'فاتورة تسجيل 200 ريال',
      referenceId: `REG-APR-${now}`,
      createdAt: now,
    });
  }

  next = appendAuditLog(
    { ...next, lastAdminSyncAt: now },
    role,
    decision === 'approve' ? 'قبول تسجيل لاعب جديد' : 'رفض تسجيل لاعب جديد',
    `${state.registration.fullName} (${state.registration.nickname}) — هوية ${state.registration.nationalId}`,
    now
  );

  return { state: next };
}

export function buildAdminBackupPayload(
  state: GameState,
  role: AdminRole,
  label: string,
  now: number
): {
  label: string;
  createdBy: string;
  totalSarApproved: number;
  commanderName: string;
  payloadJson: string;
  state: GameState;
  error?: string;
} {
  if (role !== 'founder') {
    return {
      label: '',
      createdBy: '',
      totalSarApproved: 0,
      commanderName: '',
      payloadJson: '',
      state,
      error: 'النسخ الاحتياطي للبيانات متاح للمؤسس (Founder) فقط.',
    };
  }

  const totalSarApproved = state.financialLogs.reduce(
    (s, l) =>
      l.category === 'payment_refund'
        ? s - Math.abs(l.amountSar)
        : s + Math.max(0, l.amountSar),
    0
  );

  const resolvedLabel =
    label.trim() || `نسخة بيانات ${formatKsaDateTime(now)}`;

  const nextWithAudit = appendAuditLog(
    state,
    role,
    'إنشاء نسخة احتياطية لبيانات اللعبة',
    resolvedLabel,
    now
  );

  return {
    label: resolvedLabel,
    createdBy: 'المؤسس (Founder)',
    totalSarApproved,
    commanderName: nextWithAudit.commanderName,
    payloadJson: JSON.stringify(nextWithAudit),
    state: nextWithAudit,
  };
}

export function restoreGameStateFromJson(
  jsonText: string,
  role: AdminRole,
  now: number,
  fallbackAccountId?: string
): { state?: GameState; error?: string } {
  if (role !== 'founder') {
    return { error: 'استعادة النسخ الاحتياطية حصرية لحساب المؤسس (Founder).' };
  }
  try {
    const parsed = JSON.parse(jsonText) as Partial<GameState>;
    if (
      !parsed ||
      (parsed.version !== 2 && parsed.version !== 3) ||
      !Array.isArray(parsed.buildings)
    ) {
      return { error: 'ملف النسخة الاحتياطية غير صالح أو تالف.' };
    }
    const base = createInitialState(parsed.commanderName ?? 'القائد سيف');
    const restored: GameState = {
      ...base,
      ...parsed,
      accountId: parsed.accountId || fallbackAccountId || base.accountId,
      version: 3,
      adminConfig: parsed.adminConfig
        ? cloneAdminConfig({
            ...cloneAdminConfig(DEFAULT_ADMIN_CONFIG),
            ...parsed.adminConfig,
          })
        : cloneAdminConfig(DEFAULT_ADMIN_CONFIG),
      selectedServerId:
        parsed.selectedServerId ??
        parsed.adminConfig?.servers?.[0]?.id ??
        DEFAULT_GAME_SERVERS[0].id,
      registration: parsed.registration ?? { ...DEFAULT_REGISTRATION },
    };
    const audited = appendAuditLog(
      restored,
      role,
      'استعادة نسخة احتياطية',
      `تمت استعادة بيانات الحساب (${restored.commanderName})`,
      now
    );
    return { state: audited };
  } catch {
    return { error: 'تعذر قراءة ملف النسخة الاحتياطية بصيغة JSON.' };
  }
}

export type AdminSubAction = 'keep' | 'add_30d' | 'add_90d' | 'disable';
export type AdminShieldAction =
  | 'keep'
  | 'add_24h'
  | 'add_3d'
  | 'add_7d'
  | 'add_30d'
  | 'clear';

export interface AdminPlayerAccountPatch {
  commanderName: string;
  cityName: string;
  selectedServerId: string;
  registrationStatus: PlayerRegistrationStatus;
  chargedGems: number;
  bonusGems: number;
  marketGems: number;
  tradeBalance: number;
  achievementPoints: number;
  wheat: number;
  wood: number;
  iron: number;
  crudeOilStock: number;
  naturalGasStock: number;
  hakimAction: AdminSubAction;
  vipAction: AdminSubAction;
  shieldAction: AdminShieldAction;
  speedUpCards: Record<SpeedUpTierId, number>;
}

function cleanDecimal(value: number): number {
  return Math.max(0, Number.isFinite(value) ? Number(value.toFixed(2)) : 0);
}

function cleanInt(value: number): number {
  return Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
}

export function adminUpdatePlayerAccount(
  state: GameState,
  patch: AdminPlayerAccountPatch,
  role: AdminRole,
  now: number
): { state: GameState; error?: string } {
  if (role !== 'founder') {
    return {
      state,
      error: 'التعديل الكامل لبيانات حساب اللاعب حصري لحساب المؤسس (Founder).',
    };
  }

  const commanderName = patch.commanderName.trim() || state.commanderName;
  const cityName = patch.cityName.trim() || state.cityName;
  const selectedServerId =
    patch.selectedServerId || state.selectedServerId || DEFAULT_GAME_SERVERS[0].id;

  const gemLedger = {
    chargedGems: cleanDecimal(patch.chargedGems),
    bonusGems: cleanDecimal(patch.bonusGems),
    marketGems: cleanDecimal(patch.marketGems),
  };

  let hakimSubscription = { ...state.hakimSubscription };
  let smartBotActive = state.smartBotActive;
  let smartBotExpiresAt = state.smartBotExpiresAt;
  let botConfig = { ...state.botConfig };

  if (patch.hakimAction === 'disable') {
    hakimSubscription = {
      ...hakimSubscription,
      active: false,
      expiresAt: null,
    };
    smartBotActive = false;
    smartBotExpiresAt = null;
  } else if (patch.hakimAction === 'add_30d' || patch.hakimAction === 'add_90d') {
    const days = patch.hakimAction === 'add_90d' ? 90 : 30;
    const baseEnd = Math.max(
      now,
      state.hakimSubscription.expiresAt ?? state.smartBotExpiresAt ?? 0
    );
    const nextExp = baseEnd + days * DAY_MS;
    hakimSubscription = {
      active: true,
      startedAt: state.hakimSubscription.startedAt ?? now,
      expiresAt: nextExp,
      renewCount: state.hakimSubscription.renewCount + 1,
    };
    smartBotActive = true;
    smartBotExpiresAt = nextExp;
    botConfig = { ...botConfig, autoDevelopCity: true };
  } else {
    const hasPaidHakim =
      Boolean(hakimSubscription.active) &&
      typeof hakimSubscription.expiresAt === 'number' &&
      hakimSubscription.expiresAt > now;
    if (!hasPaidHakim) {
      hakimSubscription = { ...hakimSubscription, active: false };
      smartBotActive = false;
      smartBotExpiresAt = null;
    }
  }

  let vipSubscription = { ...state.vipSubscription };
  if (patch.vipAction === 'disable') {
    vipSubscription = {
      ...vipSubscription,
      active: false,
      expiresAt: null,
    };
  } else if (patch.vipAction === 'add_30d' || patch.vipAction === 'add_90d') {
    const days = patch.vipAction === 'add_90d' ? 90 : 30;
    const baseEnd = Math.max(now, state.vipSubscription.expiresAt ?? 0);
    vipSubscription = {
      active: true,
      startedAt: state.vipSubscription.startedAt ?? now,
      expiresAt: baseEnd + days * DAY_MS,
      renewCount: state.vipSubscription.renewCount + 1,
    };
  }

  let shieldEndsAt = state.shieldEndsAt;
  if (patch.shieldAction === 'clear') {
    shieldEndsAt = null;
  } else if (patch.shieldAction !== 'keep') {
    const hoursMap: Record<Exclude<AdminShieldAction, 'keep' | 'clear'>, number> = {
      add_24h: 24,
      add_3d: 72,
      add_7d: 168,
      add_30d: 720,
    };
    const hours = hoursMap[patch.shieldAction];
    const baseShield = Math.max(now, state.shieldEndsAt ?? 0);
    shieldEndsAt = baseShield + hours * 60 * 60 * 1000;
  }

  const speedUpTiers: SpeedUpTierId[] = ['1m', '5m', '30m', '1h', '24h', '3d', '7d'];
  const speedUpCards = { ...state.speedUpCards };
  for (const tier of speedUpTiers) {
    speedUpCards[tier] = cleanInt(patch.speedUpCards[tier] ?? state.speedUpCards[tier] ?? 0);
  }

  let next: GameState = {
    ...state,
    lastTickAt: now,
    lastAdminSyncAt: now,
    commanderName,
    cityName,
    selectedServerId,
    registration: {
      ...state.registration,
      status: patch.registrationStatus,
      nickname: commanderName,
      serverId: selectedServerId,
    },
    gemLedger,
    ledger: {
      ...state.ledger,
      paidGems: cleanDecimal(gemLedger.chargedGems + gemLedger.bonusGems + gemLedger.marketGems),
      tradeBalance: cleanDecimal(patch.tradeBalance),
      achievementPoints: cleanInt(patch.achievementPoints),
    },
    resources: {
      wheat: cleanInt(patch.wheat),
      wood: cleanInt(patch.wood),
      iron: cleanInt(patch.iron),
    },
    maritime: {
      ...state.maritime,
      crudeOilStock: cleanInt(patch.crudeOilStock),
      naturalGasStock: cleanInt(patch.naturalGasStock),
    },
    hakimSubscription,
    vipSubscription,
    smartBotActive,
    smartBotExpiresAt,
    botConfig,
    shieldEndsAt,
    speedUpCards,
  };

  next = appendAuditLog(
    next,
    role,
    'تعديل شامل لبيانات اللاعب',
    `${commanderName} (${next.accountId}) — جواهر: ${next.ledger.paidGems} | سيرفر: ${selectedServerId} | حكيم: ${patch.hakimAction} | VIP: ${patch.vipAction}`,
    now
  );

  return { state: next };
}


