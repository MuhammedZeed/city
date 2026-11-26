import {
  generateAccountId,
  generateId,
  generateSessionToken,
  generateSixDigitOtp,
  hashOtpCode,
  sha256Hex,
  verifyOtpCodeHash,
} from './auth';
import {
  JsonObject,
  buildInitialPlayerState,
  createDefaultAdminConfig,
} from './defaults';
import { EmailPurpose } from './email';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;

export interface PlayerRow {
  account_id: string;
  email: string | null;
  phone: string | null;
  email_verified: number;
  email_verified_at: number | null;
  password_hash: string;
  password_salt: string;
  commander_name: string;
  selected_server_id: string;
  registration_status: string;
  created_at: number;
  updated_at: number;
}

export interface PlayerStateRow {
  account_id: string;
  state_json: string;
  version: number;
  revision: number;
  last_tick_at: number;
  updated_at: number;
}

export interface ResolvedSession {
  tokenHash: string;
  subjectType: 'player' | 'admin';
  accountId: string | null;
  adminRole: string | null;
  expiresAt: number;
  player?: PlayerRow;
}

function asObject(val: unknown): JsonObject | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as JsonObject)
    : null;
}

function asArray(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [];
}

function clampNonNegativeFinite(val: unknown, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function ensurePlatformConfig(
  db: D1Database,
  now: number
): Promise<JsonObject> {
  const defaultCfg = createDefaultAdminConfig();
  await db
    .prepare(
      'INSERT OR IGNORE INTO platform_config (id, config_json, updated_at) VALUES (?, ?, ?)'
    )
    .bind('default', JSON.stringify(defaultCfg), now)
    .run();

  const row = await db
    .prepare('SELECT config_json FROM platform_config WHERE id = ?')
    .bind('default')
    .first<{ config_json: string }>();

  if (!row?.config_json) return defaultCfg;
  try {
    const parsed = JSON.parse(row.config_json) as JsonObject;
    return { ...defaultCfg, ...parsed };
  } catch {
    return defaultCfg;
  }
}

export async function updatePlatformConfig(
  db: D1Database,
  nextConfig: JsonObject,
  now: number
): Promise<JsonObject> {
  const current = await ensurePlatformConfig(db, now);
  const merged = { ...current, ...nextConfig };
  await db
    .prepare(
      'UPDATE platform_config SET config_json = ?, updated_at = ? WHERE id = ?'
    )
    .bind(JSON.stringify(merged), now, 'default')
    .run();
  return merged;
}

export async function findPlayerByEmail(
  db: D1Database,
  email: string
): Promise<PlayerRow | null> {
  return (
    (await db
      .prepare('SELECT * FROM players WHERE email = ? LIMIT 1')
      .bind(email)
      .first<PlayerRow>()) ?? null
  );
}

export async function findPlayerByPhone(
  db: D1Database,
  phone: string
): Promise<PlayerRow | null> {
  return (
    (await db
      .prepare('SELECT * FROM players WHERE phone = ? LIMIT 1')
      .bind(phone)
      .first<PlayerRow>()) ?? null
  );
}

export async function findPlayerById(
  db: D1Database,
  accountId: string
): Promise<PlayerRow | null> {
  return (
    (await db
      .prepare('SELECT * FROM players WHERE account_id = ? LIMIT 1')
      .bind(accountId)
      .first<PlayerRow>()) ?? null
  );
}

export async function createPlayerAccount(
  db: D1Database,
  params: {
    email: string | null;
    phone: string | null;
    passwordHash: string;
    passwordSalt: string;
    commanderName: string;
    serverId: string;
    adminConfig: JsonObject;
    now: number;
    registration?: JsonObject;
    paymentOrders?: JsonObject[];
  }
): Promise<{ ok: true; player: PlayerRow; state: JsonObject; revision: number } | { ok: false; status: number; error: string }> {
  if (params.email) {
    const dupEmail = await findPlayerByEmail(db, params.email);
    if (dupEmail) {
      return { ok: false, status: 409, error: 'البريد الإلكتروني مسجل مسبقًا.' };
    }
  }
  if (params.phone) {
    const dupPhone = await findPlayerByPhone(db, params.phone);
    if (dupPhone) {
      return { ok: false, status: 409, error: 'رقم الجوال مسجل مسبقًا.' };
    }
  }

  const servers = asArray(params.adminConfig.servers) as JsonObject[];
  const validServer =
    servers.find((s) => s.id === params.serverId)?.id ??
    servers[0]?.id ??
    'srv-1';
  const regStatus =
    typeof params.registration?.status === 'string' &&
    params.registration.status === 'pending'
      ? 'pending'
      : 'unregistered';

  for (let attempt = 0; attempt < 6; attempt++) {
    const accountId = generateAccountId();
    const initialState = buildInitialPlayerState({
      accountId,
      commanderName: params.commanderName,
      email: params.email,
      phone: params.phone,
      serverId: String(validServer),
      adminConfig: params.adminConfig,
      now: params.now,
      registration: params.registration,
      paymentOrders: params.paymentOrders,
    });

    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO players (
              account_id, email, phone, email_verified, email_verified_at,
              password_hash, password_salt, commander_name, selected_server_id,
              registration_status, created_at, updated_at
            ) VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            accountId,
            params.email,
            params.phone,
            params.passwordHash,
            params.passwordSalt,
            params.commanderName,
            String(validServer),
            regStatus,
            params.now,
            params.now
          ),
        db
          .prepare(
            `INSERT INTO player_states (
              account_id, state_json, version, revision, last_tick_at, updated_at
            ) VALUES (?, ?, 3, 1, ?, ?)`
          )
          .bind(accountId, JSON.stringify(initialState), params.now, params.now),
      ]);

      const player = await findPlayerById(db, accountId);
      if (!player) {
        return { ok: false, status: 500, error: 'تعذر قراءة الحساب بعد إنشائه.' };
      }
      return { ok: true, player, state: initialState, revision: 1 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('players.email')) {
        return { ok: false, status: 409, error: 'البريد الإلكتروني مسجل مسبقًا.' };
      }
      if (msg.includes('players.phone')) {
        return { ok: false, status: 409, error: 'رقم الجوال مسجل مسبقًا.' };
      }
      if (msg.includes('players.account_id') || msg.includes('PRIMARY KEY')) {
        continue; // Retry with a fresh random account_id
      }
      throw err;
    }
  }

  return {
    ok: false,
    status: 500,
    error: 'تعذر توليد معرّف حساب فريد، يرجى إعادة المحاولة.',
  };
}

export async function createSession(
  db: D1Database,
  params: {
    subjectType: 'player' | 'admin';
    accountId: string | null;
    adminRole: string | null;
    now: number;
  }
): Promise<{ token: string; expiresAt: number }> {
  const token = generateSessionToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = params.now + SESSION_TTL_MS;

  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(params.now),
    db
      .prepare(
        `INSERT INTO sessions (token_hash, subject_type, account_id, admin_role, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        tokenHash,
        params.subjectType,
        params.accountId,
        params.adminRole,
        expiresAt,
        params.now
      ),
  ]);

  return { token, expiresAt };
}

export async function resolveSessionByToken(
  db: D1Database,
  token: string,
  now: number
): Promise<ResolvedSession | null> {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT token_hash, subject_type, account_id, admin_role, expires_at
       FROM sessions
       WHERE token_hash = ? AND expires_at > ?
       LIMIT 1`
    )
    .bind(tokenHash, now)
    .first<{
      token_hash: string;
      subject_type: 'player' | 'admin';
      account_id: string | null;
      admin_role: string | null;
      expires_at: number;
    }>();

  if (!row) return null;

  if (row.subject_type === 'player') {
    if (!row.account_id) return null;
    const player = await findPlayerById(db, row.account_id);
    if (!player) return null;
    return {
      tokenHash: row.token_hash,
      subjectType: 'player',
      accountId: row.account_id,
      adminRole: null,
      expiresAt: row.expires_at,
      player,
    };
  }

  return {
    tokenHash: row.token_hash,
    subjectType: 'admin',
    accountId: null,
    adminRole: row.admin_role ?? 'founder',
    expiresAt: row.expires_at,
  };
}

export async function revokeSessionByToken(
  db: D1Database,
  token: string
): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await db
    .prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}

export async function issueEmailCode(
  db: D1Database,
  params: {
    accountId: string;
    email: string;
    purpose: EmailPurpose;
    now: number;
  }
): Promise<
  | { ok: true; codeId: string; code: string; expiresAt: number }
  | { ok: false; status: number; retryAfterSec: number; error: string }
> {
  const recent = await db
    .prepare(
      `SELECT created_at FROM email_codes
       WHERE email = ? AND purpose = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(params.email, params.purpose)
    .first<{ created_at: number }>();

  if (recent && params.now - recent.created_at < OTP_RESEND_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (params.now - recent.created_at)) / 1000
    );
    return {
      ok: false,
      status: 429,
      retryAfterSec,
      error: `يرجى الانتظار ${retryAfterSec} ثانية قبل طلب كود جديد.`,
    };
  }

  const code = generateSixDigitOtp();
  const { codeHash, codeSalt } = await hashOtpCode(code);
  const codeId = generateId('otp');
  const expiresAt = params.now + OTP_TTL_MS;

  await db.batch([
    db
      .prepare(
        `UPDATE email_codes
         SET used_at = ?
         WHERE account_id = ? AND purpose = ? AND used_at IS NULL`
      )
      .bind(params.now, params.accountId, params.purpose),
    db
      .prepare(
        `INSERT INTO email_codes (
          id, account_id, email, purpose, code_hash, code_salt, attempts, expires_at, used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)`
      )
      .bind(
        codeId,
        params.accountId,
        params.email,
        params.purpose,
        codeHash,
        codeSalt,
        expiresAt,
        params.now
      ),
  ]);

  return { ok: true, codeId, code, expiresAt };
}

export async function deleteEmailCodeById(
  db: D1Database,
  codeId: string
): Promise<void> {
  await db.prepare('DELETE FROM email_codes WHERE id = ?').bind(codeId).run();
}

export async function verifyAndConsumeEmailCode(
  db: D1Database,
  params: {
    email: string;
    purpose: EmailPurpose;
    code: string;
    now: number;
  }
): Promise<
  | { ok: true; accountId: string; email: string }
  | { ok: false; status: number; error: string }
> {
  const cleanCode = params.code.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, status: 400, error: 'يجب إدخال كود مكون من 6 أرقام.' };
  }

  const row = await db
    .prepare(
      `SELECT id, account_id, email, code_hash, code_salt, attempts, expires_at, used_at
       FROM email_codes
       WHERE email = ? AND purpose = ? AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(params.email, params.purpose)
    .first<{
      id: string;
      account_id: string;
      email: string;
      code_hash: string;
      code_salt: string;
      attempts: number;
      expires_at: number;
      used_at: number | null;
    }>();

  if (!row) {
    return {
      ok: false,
      status: 400,
      error: 'لا يوجد كود نشط لهذا البريد الإلكتروني. اطلب كودًا جديدًا.',
    };
  }

  if (row.expires_at <= params.now) {
    return {
      ok: false,
      status: 400,
      error: 'انتهت صلاحية الكود (15 دقيقة). يرجى طلب كود جديد.',
    };
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      status: 429,
      error: 'تم تجاوز الحد الأقصى لمحاولات التحقق. يرجى طلب كود جديد.',
    };
  }

  const matched = await verifyOtpCodeHash(cleanCode, row.code_hash, row.code_salt);
  if (!matched) {
    const nextAttempts = row.attempts + 1;
    await db
      .prepare(
        `UPDATE email_codes
         SET attempts = ?, used_at = CASE WHEN ? >= ? THEN ? ELSE used_at END
         WHERE id = ? AND used_at IS NULL`
      )
      .bind(nextAttempts, nextAttempts, OTP_MAX_ATTEMPTS, params.now, row.id)
      .run();

    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
    return {
      ok: false,
      status: 400,
      error:
        remaining > 0
          ? `الكود غير صحيح. المحاولات المتبقية: ${remaining}.`
          : 'الكود غير صحيح وتم إبطاله لكثرة المحاولات. يرجى طلب كود جديد.',
    };
  }

  const consumeRes = await db
    .prepare(
      `UPDATE email_codes
       SET used_at = ?
       WHERE id = ? AND used_at IS NULL AND expires_at > ? AND attempts < ?`
    )
    .bind(params.now, row.id, params.now, OTP_MAX_ATTEMPTS)
    .run();

  if (!consumeRes.meta || consumeRes.meta.changes !== 1) {
    return {
      ok: false,
      status: 400,
      error: 'تم استخدام هذا الكود مسبقًا أو انتهت صلاحيته.',
    };
  }

  return { ok: true, accountId: row.account_id, email: row.email };
}

export async function getPlayerStateWithConfig(
  db: D1Database,
  accountId: string,
  now: number
): Promise<{
  state: JsonObject;
  revision: number;
  adminConfig: JsonObject;
} | null> {
  const adminConfig = await ensurePlatformConfig(db, now);
  const row = await db
    .prepare('SELECT * FROM player_states WHERE account_id = ? LIMIT 1')
    .bind(accountId)
    .first<PlayerStateRow>();

  if (!row) return null;
  const parsed = JSON.parse(row.state_json) as JsonObject;
  const syncedState: JsonObject = {
    ...parsed,
    accountId,
    adminConfig,
  };
  return {
    state: syncedState,
    revision: row.revision,
    adminConfig,
  };
}

function sanitizeClientStateAgainstServer(params: {
  accountId: string;
  clientState: JsonObject;
  existingState: JsonObject;
  platformConfig: JsonObject;
  now: number;
}): JsonObject {
  const { accountId, clientState, existingState, platformConfig, now } = params;

  const existingGemLedger = asObject(existingState.gemLedger) ?? {
    chargedGems: 0,
    bonusGems: 0,
    marketGems: 0,
  };
  const clientGemLedger = asObject(clientState.gemLedger) ?? {};

  const serverCharged = clampNonNegativeFinite(existingGemLedger.chargedGems, 0);
  const serverBonus = clampNonNegativeFinite(existingGemLedger.bonusGems, 0);
  const requestedCharged = clampNonNegativeFinite(
    clientGemLedger.chargedGems,
    serverCharged
  );
  const requestedBonus = clampNonNegativeFinite(
    clientGemLedger.bonusGems,
    serverBonus
  );
  const requestedMarket = clampNonNegativeFinite(
    clientGemLedger.marketGems,
    clampNonNegativeFinite(existingGemLedger.marketGems, 0)
  );

  // Charged gems can only increase via Admin approval, never from client autosave
  const safeCharged = Math.min(serverCharged, requestedCharged);

  // Bonus gems can decrease on spending, or increase up to 100 ONLY on active VIP Day-30 monthly reward
  const existingVip = asObject(existingState.vipSubscription) ?? {};
  const vipActive =
    Boolean(existingVip.active) &&
    typeof existingVip.expiresAt === 'number' &&
    existingVip.expiresAt > now;
  const existingMonthly = asObject(existingState.monthlyRewards) ?? {};
  const clientMonthly = asObject(clientState.monthlyRewards) ?? {};
  const claimedVipDay30 =
    vipActive &&
    asArray(clientMonthly.vipClaimsByDay).includes(30) &&
    !asArray(existingMonthly.vipClaimsByDay).includes(30);
  const maxAllowedBonus = serverBonus + (claimedVipDay30 ? 100 : 0);
  const safeBonus = Math.min(maxAllowedBonus, requestedBonus);

  const existingLedger = asObject(existingState.ledger) ?? {};
  const clientLedger = asObject(clientState.ledger) ?? {};
  const safeTotalGems =
    Math.floor(safeCharged) + Math.floor(safeBonus) + Math.floor(requestedMarket);

  // Preserve Admin-reviewed registration status
  const existingReg = asObject(existingState.registration) ?? {};
  const clientReg = asObject(clientState.registration) ?? {};
  const existingRegStatus = String(existingReg.status ?? 'unregistered');
  const clientRegStatus = String(clientReg.status ?? existingRegStatus);

  let mergedReg: JsonObject;
  if (existingRegStatus === 'approved' || existingRegStatus === 'rejected') {
    mergedReg = {
      ...clientReg,
      ...existingReg,
      status: existingRegStatus,
    };
  } else {
    const allowedStatus =
      clientRegStatus === 'pending' ? 'pending' : 'unregistered';
    mergedReg = {
      ...existingReg,
      ...clientReg,
      status: allowedStatus,
    };
    delete mergedReg.reviewedAt;
    delete mergedReg.reviewedBy;
    delete mergedReg.reviewNote;
  }

  // Preserve existing payment orders' statuses & admin reviews; allow only new pending orders
  const existingOrders = asArray(existingState.paymentOrders)
    .map(asObject)
    .filter((o): o is JsonObject => Boolean(o && typeof o.id === 'string'));
  const existingOrdersMap = new Map<string, JsonObject>();
  for (const ord of existingOrders) {
    existingOrdersMap.set(String(ord.id), ord);
  }

  const clientOrders = asArray(clientState.paymentOrders)
    .map(asObject)
    .filter((o): o is JsonObject => Boolean(o && typeof o.id === 'string'));

  const newPendingOrders: JsonObject[] = [];
  for (const ord of clientOrders) {
    const id = String(ord.id);
    if (!existingOrdersMap.has(id)) {
      newPendingOrders.push({
        ...ord,
        accountId,
        status: 'pending',
        reviewedAt: undefined,
        reviewedBy: undefined,
      });
    }
  }
  const mergedOrders = [...newPendingOrders, ...existingOrders];

  // Preserve market admin controls (freeze, ban, internal debt, admin_cancelled offers)
  const existingMarket = asObject(existingState.market) ?? {};
  const clientMarket = asObject(clientState.market) ?? {};
  const existingOffers = asArray(existingMarket.offers)
    .map(asObject)
    .filter((o): o is JsonObject => Boolean(o && typeof o.id === 'string'));
  const adminCancelledIds = new Set(
    existingOffers
      .filter((o) => o.status === 'admin_cancelled')
      .map((o) => String(o.id))
  );
  const clientOffers = asArray(clientMarket.offers)
    .map(asObject)
    .filter((o): o is JsonObject => Boolean(o && typeof o.id === 'string'));
  const seenOfferIds = new Set<string>();
  const mergedOffers = clientOffers.map((o) => {
    const id = String(o.id);
    seenOfferIds.add(id);
    if (adminCancelledIds.has(id)) {
      return existingOffers.find((e) => String(e.id) === id) ?? o;
    }
    return o;
  });
  for (const existingOffer of existingOffers) {
    const id = String(existingOffer.id);
    if (adminCancelledIds.has(id) && !seenOfferIds.has(id)) {
      mergedOffers.push(existingOffer);
    }
  }

  const mergedMarket: JsonObject = {
    ...existingMarket,
    ...clientMarket,
    offers: mergedOffers,
    marketFrozenForPlayer: Boolean(existingMarket.marketFrozenForPlayer),
    marketBanUntil: existingMarket.marketBanUntil ?? null,
    playerInternalDebtGems: clampNonNegativeFinite(
      existingMarket.playerInternalDebtGems,
      0
    ),
  };

  // Preserve Hakim / SmartBot & VIP subscription locks
  const existingSmartBotExpiresAt =
    typeof existingState.smartBotExpiresAt === 'number'
      ? existingState.smartBotExpiresAt
      : null;
  const smartBotStillValid =
    Boolean(existingState.smartBotActive) &&
    (existingSmartBotExpiresAt === null || existingSmartBotExpiresAt > now);

  // Preserve existing server financialLogs & all adminAuditLogs
  const existingFinLogs = asArray(existingState.financialLogs)
    .map(asObject)
    .filter((f): f is JsonObject => Boolean(f && typeof f.id === 'string'));
  const existingFinIds = new Set(existingFinLogs.map((f) => String(f.id)));
  const clientFinLogs = asArray(clientState.financialLogs)
    .map(asObject)
    .filter(
      (f): f is JsonObject =>
        Boolean(f && typeof f.id === 'string' && !existingFinIds.has(String(f.id)))
    );

  // Validate selectedServerId
  const validServerIds = new Set(
    asArray(platformConfig.servers)
      .map(asObject)
      .map((s) => String(s?.id ?? ''))
      .filter(Boolean)
  );
  const requestedServerId =
    typeof clientState.selectedServerId === 'string'
      ? clientState.selectedServerId
      : String(existingState.selectedServerId ?? 'srv-1');
  const safeServerId = validServerIds.has(requestedServerId)
    ? requestedServerId
    : String(existingState.selectedServerId ?? 'srv-1');

  return {
    ...existingState,
    ...clientState,
    version: 3,
    accountId,
    createdAt: existingState.createdAt ?? now,
    protectionEndsAt: existingState.protectionEndsAt ?? now,
    adminConfig: platformConfig,
    selectedServerId: safeServerId,
    gemLedger: {
      chargedGems: Number(safeCharged.toFixed(2)),
      bonusGems: Number(safeBonus.toFixed(2)),
      marketGems: Number(requestedMarket.toFixed(2)),
    },
    ledger: {
      paidGems: safeTotalGems,
      tradeBalance: clampNonNegativeFinite(
        clientLedger.tradeBalance,
        clampNonNegativeFinite(existingLedger.tradeBalance, 0)
      ),
      achievementPoints: clampNonNegativeFinite(
        clientLedger.achievementPoints,
        clampNonNegativeFinite(existingLedger.achievementPoints, 0)
      ),
    },
    hakimSubscription: existingState.hakimSubscription,
    vipSubscription: existingState.vipSubscription,
    smartBotActive: smartBotStillValid ? Boolean(clientState.smartBotActive ?? true) : false,
    smartBotExpiresAt: existingSmartBotExpiresAt,
    registration: mergedReg,
    paymentOrders: mergedOrders,
    market: mergedMarket,
    adminAuditLogs: asArray(existingState.adminAuditLogs),
    financialLogs: [...clientFinLogs, ...existingFinLogs],
  };
}

export async function savePlayerStateSafely(
  db: D1Database,
  params: {
    accountId: string;
    clientState: JsonObject;
    expectedRevision: number;
    now: number;
  }
): Promise<
  | { ok: true; revision: number; state: JsonObject; adminConfig: JsonObject }
  | {
      ok: false;
      conflict: true;
      serverRevision: number;
      state: JsonObject;
      adminConfig: JsonObject;
    }
  | { ok: false; conflict: false; status: number; error: string }
> {
  const adminConfig = await ensurePlatformConfig(db, params.now);
  const row = await db
    .prepare('SELECT * FROM player_states WHERE account_id = ? LIMIT 1')
    .bind(params.accountId)
    .first<PlayerStateRow>();

  if (!row) {
    return { ok: false, conflict: false, status: 404, error: 'حالة اللاعب غير موجودة.' };
  }

  const existingState = JSON.parse(row.state_json) as JsonObject;
  if (params.expectedRevision !== row.revision) {
    return {
      ok: false,
      conflict: true,
      serverRevision: row.revision,
      state: { ...existingState, accountId: params.accountId, adminConfig },
      adminConfig,
    };
  }

  const sanitizedState = sanitizeClientStateAgainstServer({
    accountId: params.accountId,
    clientState: params.clientState,
    existingState,
    platformConfig: adminConfig,
    now: params.now,
  });

  const serialized = JSON.stringify(sanitizedState);
  if (serialized.length > 1_600_000) {
    return {
      ok: false,
      conflict: false,
      status: 413,
      error: 'حجم بيانات الحالة كبير جدًا (يرجى ضغط صور الفواتير والمرفقات قبل الإرسال).',
    };
  }

  const commanderName =
    typeof sanitizedState.commanderName === 'string' &&
    sanitizedState.commanderName.trim()
      ? sanitizedState.commanderName.trim()
      : 'القائد سيف';
  const serverId = String(sanitizedState.selectedServerId ?? 'srv-1');
  const regObj = asObject(sanitizedState.registration);
  const regStatus = String(regObj?.status ?? 'unregistered');

  const updateRes = await db
    .prepare(
      `UPDATE player_states
       SET state_json = ?, version = 3, revision = revision + 1, last_tick_at = ?, updated_at = ?
       WHERE account_id = ? AND revision = ?`
    )
    .bind(serialized, params.now, params.now, params.accountId, params.expectedRevision)
    .run();

  if (!updateRes.meta || updateRes.meta.changes !== 1) {
    const latestRow = await db
      .prepare('SELECT * FROM player_states WHERE account_id = ? LIMIT 1')
      .bind(params.accountId)
      .first<PlayerStateRow>();
    const latestState = latestRow
      ? ({ ...(JSON.parse(latestRow.state_json) as JsonObject), accountId: params.accountId, adminConfig })
      : existingState;
    return {
      ok: false,
      conflict: true,
      serverRevision: latestRow?.revision ?? row.revision,
      state: latestState,
      adminConfig,
    };
  }

  await db
    .prepare(
      `UPDATE players
       SET commander_name = ?, selected_server_id = ?, registration_status = ?, updated_at = ?
       WHERE account_id = ?`
    )
    .bind(commanderName, serverId, regStatus, params.now, params.accountId)
    .run();

  return {
    ok: true,
    revision: row.revision + 1,
    state: sanitizedState,
    adminConfig,
  };
}

function hasServerGameplayProgress(state: JsonObject, revision: number): boolean {
  if (revision > 1) return true;
  const buildings = asArray(state.buildings).map(asObject).filter(Boolean) as JsonObject[];
  if (buildings.length > 3) return true;
  const hq = buildings.find((b) => b.type === 'hq');
  if (hq && Number(hq.level ?? 1) > 1) return true;
  if (asArray(state.buildQueue).length > 0) return true;
  if (asArray(state.researchQueue).length > 0) return true;
  if (asArray(state.trainingQueue).length > 0) return true;
  if (asArray(state.paymentOrders).length > 0) return true;
  const reg = asObject(state.registration);
  if (reg && reg.status === 'approved') return true;
  return false;
}

export async function migrateLocalStateSafely(
  db: D1Database,
  params: {
    accountId: string;
    localState: JsonObject;
    now: number;
  }
): Promise<
  | {
      ok: true;
      migrated: boolean;
      reason?: string;
      revision: number;
      state: JsonObject;
      adminConfig: JsonObject;
    }
  | { ok: false; status: number; error: string }
> {
  const adminConfig = await ensurePlatformConfig(db, params.now);
  const player = await findPlayerById(db, params.accountId);
  const row = await db
    .prepare('SELECT * FROM player_states WHERE account_id = ? LIMIT 1')
    .bind(params.accountId)
    .first<PlayerStateRow>();

  if (!player || !row) {
    return { ok: false, status: 404, error: 'الحساب غير موجود.' };
  }

  const existingState = JSON.parse(row.state_json) as JsonObject;
  if (hasServerGameplayProgress(existingState, row.revision)) {
    return {
      ok: true,
      migrated: false,
      reason: 'SERVER_STATE_ALREADY_ACTIVE',
      revision: row.revision,
      state: { ...existingState, accountId: params.accountId, adminConfig },
      adminConfig,
    };
  }

  const version = Number(params.localState.version ?? 0);
  if ((version !== 2 && version !== 3) || !Array.isArray(params.localState.buildings)) {
    return { ok: false, status: 400, error: 'بيانات الحفظ المحلي غير صالحة للترحيل.' };
  }

  const sanitized = sanitizeClientStateAgainstServer({
    accountId: params.accountId,
    clientState: params.localState,
    existingState,
    platformConfig: adminConfig,
    now: params.now,
  });

  // Ensure verified email/phone identity on player record isn't clobbered by old local registration stub
  const regObj = asObject(sanitized.registration) ?? {};
  if (player.email) regObj.email = player.email;
  if (player.phone) regObj.phone = player.phone;
  sanitized.registration = regObj;

  const serialized = JSON.stringify(sanitized);
  if (serialized.length > 1_600_000) {
    return { ok: false, status: 413, error: 'حجم بيانات الحفظ المحلي يتجاوز الحد المسموح.' };
  }

  const updateRes = await db
    .prepare(
      `UPDATE player_states
       SET state_json = ?, version = 3, revision = revision + 1, last_tick_at = ?, updated_at = ?
       WHERE account_id = ? AND revision = ?`
    )
    .bind(serialized, params.now, params.now, params.accountId, row.revision)
    .run();

  if (!updateRes.meta || updateRes.meta.changes !== 1) {
    const latest = await getPlayerStateWithConfig(db, params.accountId, params.now);
    return {
      ok: true,
      migrated: false,
      reason: 'CONCURRENT_UPDATE',
      revision: latest?.revision ?? row.revision,
      state: latest?.state ?? existingState,
      adminConfig,
    };
  }

  const migratedCommander =
    typeof sanitized.commanderName === 'string' && sanitized.commanderName.trim()
      ? sanitized.commanderName.trim()
      : player.commander_name;
  const migratedServerId = String(sanitized.selectedServerId ?? player.selected_server_id);
  const migratedRegStatus = String(regObj.status ?? player.registration_status);
  await db
    .prepare(
      `UPDATE players
       SET commander_name = ?, selected_server_id = ?, registration_status = ?, updated_at = ?
       WHERE account_id = ?`
    )
    .bind(migratedCommander, migratedServerId, migratedRegStatus, params.now, params.accountId)
    .run();

  return {
    ok: true,
    migrated: true,
    revision: row.revision + 1,
    state: sanitized,
    adminConfig,
  };
}

export async function resetPlayerCitySafely(
  db: D1Database,
  params: { accountId: string; now: number }
): Promise<{
  ok: true;
  revision: number;
  state: JsonObject;
  adminConfig: JsonObject;
} | null> {
  const adminConfig = await ensurePlatformConfig(db, params.now);
  const player = await findPlayerById(db, params.accountId);
  const row = await db
    .prepare('SELECT * FROM player_states WHERE account_id = ? LIMIT 1')
    .bind(params.accountId)
    .first<PlayerStateRow>();

  if (!player || !row) return null;
  const prevState = JSON.parse(row.state_json) as JsonObject;

  const fresh = buildInitialPlayerState({
    accountId: params.accountId,
    commanderName: player.commander_name,
    email: player.email,
    phone: player.phone,
    serverId: player.selected_server_id,
    adminConfig,
    now: params.now,
    registration: asObject(prevState.registration) ?? undefined,
    paymentOrders: asArray(prevState.paymentOrders) as JsonObject[],
  });

  // Preserve chargedGems & active subscriptions on city reset so paid account benefits aren't lost
  fresh.gemLedger = prevState.gemLedger ?? fresh.gemLedger;
  fresh.ledger = prevState.ledger ?? fresh.ledger;
  fresh.hakimSubscription = prevState.hakimSubscription ?? fresh.hakimSubscription;
  fresh.vipSubscription = prevState.vipSubscription ?? fresh.vipSubscription;
  fresh.smartBotActive = prevState.smartBotActive ?? false;
  fresh.smartBotExpiresAt = prevState.smartBotExpiresAt ?? null;
  fresh.financialLogs = prevState.financialLogs ?? [];
  fresh.adminAuditLogs = prevState.adminAuditLogs ?? [];

  await db
    .prepare(
      `UPDATE player_states
       SET state_json = ?, version = 3, revision = revision + 1, last_tick_at = ?, updated_at = ?
       WHERE account_id = ?`
    )
    .bind(JSON.stringify(fresh), params.now, params.now, params.accountId)
    .run();

  return {
    ok: true,
    revision: row.revision + 1,
    state: fresh,
    adminConfig,
  };
}

export async function listPlayersForAdmin(
  db: D1Database,
  now: number
): Promise<{
  adminConfig: JsonObject;
  players: Array<{
    accountId: string;
    commanderName: string;
    email: string | null;
    phone: string | null;
    emailVerified: boolean;
    registrationStatus: string;
    selectedServerId: string;
    revision: number;
    createdAt: number;
    updatedAt: number;
    state: JsonObject;
  }>;
}> {
  const adminConfig = await ensurePlatformConfig(db, now);
  const res = await db
    .prepare(
      `SELECT
         p.account_id, p.commander_name, p.email, p.phone, p.email_verified,
         p.registration_status, p.selected_server_id, p.created_at, p.updated_at,
         s.state_json, s.revision
       FROM players p
       JOIN player_states s ON s.account_id = p.account_id
       ORDER BY p.updated_at DESC
       LIMIT 200`
    )
    .all<PlayerRow & { state_json: string; revision: number }>();

  const players = (res.results ?? []).map((r) => {
    let parsedState: JsonObject = {};
    try {
      parsedState = JSON.parse(r.state_json) as JsonObject;
    } catch {
      parsedState = {};
    }
    return {
      accountId: r.account_id,
      commanderName: r.commander_name,
      email: r.email,
      phone: r.phone,
      emailVerified: r.email_verified === 1,
      registrationStatus: r.registration_status,
      selectedServerId: r.selected_server_id,
      revision: r.revision,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      state: { ...parsedState, accountId: r.account_id, adminConfig },
    };
  });

  return { adminConfig, players };
}

export async function adminSavePlayerState(
  db: D1Database,
  params: { accountId: string; nextState: JsonObject; now: number }
): Promise<
  | { ok: true; revision: number; state: JsonObject; adminConfig: JsonObject }
  | { ok: false; status: number; error: string }
> {
  const adminConfig = await ensurePlatformConfig(db, params.now);
  const player = await findPlayerById(db, params.accountId);
  const row = await db
    .prepare('SELECT revision FROM player_states WHERE account_id = ? LIMIT 1')
    .bind(params.accountId)
    .first<{ revision: number }>();

  if (!player || !row) {
    return { ok: false, status: 404, error: 'اللاعب غير موجود في قاعدة البيانات.' };
  }

  const nextState: JsonObject = {
    ...params.nextState,
    version: 3,
    accountId: params.accountId,
    adminConfig,
  };

  const serialized = JSON.stringify(nextState);
  if (serialized.length > 1_600_000) {
    return { ok: false, status: 413, error: 'حجم الحالة يتجاوز الحد المسموح.' };
  }

  const reg = asObject(nextState.registration);
  const regStatus = String(reg?.status ?? player.registration_status);
  const commanderName =
    typeof nextState.commanderName === 'string' && nextState.commanderName.trim()
      ? nextState.commanderName.trim()
      : player.commander_name;
  const serverId =
    typeof nextState.selectedServerId === 'string'
      ? nextState.selectedServerId
      : player.selected_server_id;

  await db.batch([
    db
      .prepare(
        `UPDATE player_states
         SET state_json = ?, version = 3, revision = revision + 1, updated_at = ?
         WHERE account_id = ?`
      )
      .bind(serialized, params.now, params.accountId),
    db
      .prepare(
        `UPDATE players
         SET commander_name = ?, selected_server_id = ?, registration_status = ?, updated_at = ?
         WHERE account_id = ?`
      )
      .bind(commanderName, serverId, regStatus, params.now, params.accountId),
  ]);

  return {
    ok: true,
    revision: row.revision + 1,
    state: nextState,
    adminConfig,
  };
}
