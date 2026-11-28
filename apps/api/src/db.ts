import {
  constantTimeEqualText,
  generateAccountId,
  generateId,
  generateSessionToken,
  generateSixDigitOtp,
  hashOtpCode,
  hashPassword,
  sha256Hex,
  validatePassword,
  verifyOtpCodeHash,
  verifyPassword,
} from './auth';
import {
  COOP_QUESTS_CATALOG,
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

function normalizeAdminPaymentMethods(
  rawPm: unknown,
  defaultPm: JsonObject
): JsonObject {
  const parsedPm = asObject(rawPm) ?? {};
  const result: JsonObject = {};
  for (const key of ['apple_pay', 'mada', 'bank_transfer', 'binance']) {
    const base = asObject(defaultPm[key]) ?? { id: key, enabled: true, discountPct: 0 };
    const incoming = asObject(parsedPm[key]) ?? {};
    const merged: JsonObject = { ...base, ...incoming, id: key };
    if (typeof merged.paymentLink === 'string') {
      const trimmedLink = merged.paymentLink.trim();
      if (!trimmedLink) {
        merged.paymentLink = '';
      } else {
        try {
          const parsedUrl = new URL(trimmedLink);
          merged.paymentLink = parsedUrl.protocol === 'https:' ? parsedUrl.toString() : '';
        } catch {
          merged.paymentLink = '';
        }
      }
    }
    result[key] = merged;
  }
  return result;
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
    return {
      ...defaultCfg,
      ...parsed,
      paymentMethods: normalizeAdminPaymentMethods(
        parsed.paymentMethods,
        asObject(defaultCfg.paymentMethods) ?? {}
      ),
    };
  } catch {
    return defaultCfg;
  }
}

export async function updatePlatformConfig(
  db: D1Database,
  nextConfig: JsonObject,
  now: number
): Promise<JsonObject> {
  const defaultCfg = createDefaultAdminConfig();
  const current = await ensurePlatformConfig(db, now);
  const merged = {
    ...current,
    ...nextConfig,
    paymentMethods: normalizeAdminPaymentMethods(
      nextConfig.paymentMethods ?? current.paymentMethods,
      asObject(defaultCfg.paymentMethods) ?? {}
    ),
  };
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

export async function findPlayerByIdentifier(
  db: D1Database,
  rawIdentifier: string,
  normalizeEmailFn: (v: unknown) => string | null,
  normalizePhoneFn: (v: unknown) => string | null
): Promise<PlayerRow | null> {
  const trimmed = rawIdentifier.trim();
  if (!trimmed) return null;

  const asEmail = normalizeEmailFn(trimmed);
  if (asEmail) {
    return findPlayerByEmail(db, asEmail);
  }

  if (/^ENG-[0-9A-F]{4,16}$/i.test(trimmed)) {
    return findPlayerById(db, trimmed.toUpperCase());
  }

  const asPhone = normalizePhoneFn(trimmed);
  if (asPhone) {
    const byPhone = await findPlayerByPhone(db, asPhone);
    if (byPhone) return byPhone;
  }

  return (
    (await db
      .prepare('SELECT * FROM players WHERE LOWER(commander_name) = ? LIMIT 1')
      .bind(trimmed.toLowerCase())
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

  // Preserve Admin-reviewed registration status; allow resubmission when rejected with receipt
  const existingReg = asObject(existingState.registration) ?? {};
  const clientReg = asObject(clientState.registration) ?? {};
  const existingRegStatus = String(existingReg.status ?? 'unregistered');
  const clientRegStatus = String(clientReg.status ?? existingRegStatus);
  const clientHasReceipt =
    (typeof clientReg.receiptPreviewUrl === 'string' &&
      clientReg.receiptPreviewUrl.trim().length > 0) ||
    (typeof clientReg.receiptId === 'string' &&
      /^rcp-[a-f0-9]{16}$/.test(clientReg.receiptId));

  let mergedReg: JsonObject;
  if (existingRegStatus === 'approved') {
    mergedReg = {
      ...clientReg,
      ...existingReg,
      status: 'approved',
    };
  } else if (existingRegStatus === 'rejected') {
    if (clientRegStatus === 'pending' && clientHasReceipt) {
      mergedReg = {
        ...existingReg,
        ...clientReg,
        status: 'pending',
      };
      delete mergedReg.reviewedAt;
      delete mergedReg.reviewedBy;
      delete mergedReg.reviewNote;
    } else {
      mergedReg = {
        ...clientReg,
        ...existingReg,
        status: 'rejected',
      };
    }
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

  // Preserve Hakim / SmartBot & VIP subscription locks (SmartBot ONLY allowed when paid Hakim subscription is active)
  const existingHakim = asObject(existingState.hakimSubscription) ?? {};
  const existingHakimExpiresAt =
    typeof existingHakim.expiresAt === 'number' ? existingHakim.expiresAt : null;
  const hakimSubValid =
    Boolean(existingHakim.active) &&
    existingHakimExpiresAt !== null &&
    existingHakimExpiresAt > now;

  // Protect tradeBalance: oil ships, natural gas, crude oil, and maritime gathering NEVER add to tradeBalance.
  // Only verified new market sales of wheat/wood/iron for this player's commanderName can increase tradeBalance.
  const existingCommanderName = String(existingState.commanderName ?? '').trim();
  const existingTradeLedgerIds = new Set(
    asArray(existingMarket.tradeLedger)
      .map(asObject)
      .map((t) => String(t?.id ?? ''))
      .filter(Boolean)
  );
  const legitimateMarketTradePoints = asArray(clientMarket.tradeLedger)
    .map(asObject)
    .filter(
      (t): t is JsonObject =>
        Boolean(t && typeof t.id === 'string' && !existingTradeLedgerIds.has(String(t.id)))
    )
    .reduce((acc, entry) => {
      const resType = String(entry.resource ?? '');
      if (
        entry.action !== 'buy' ||
        resType === 'crude_oil' ||
        resType === 'natural_gas' ||
        String(entry.sellerName ?? '').trim() !== existingCommanderName
      ) {
        return acc;
      }
      const pts = Number(entry.tradePointsEarned ?? 0);
      return acc + (Number.isFinite(pts) && pts > 0 ? pts : 0);
    }, 0);
  const serverTradeBalance = clampNonNegativeFinite(existingLedger.tradeBalance, 0);
  const requestedTradeBalance = clampNonNegativeFinite(
    clientLedger.tradeBalance,
    serverTradeBalance
  );
  const safeTradeBalance = Number(
    Math.min(requestedTradeBalance, serverTradeBalance + legitimateMarketTradePoints).toFixed(2)
  );

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
      tradeBalance: safeTradeBalance,
      achievementPoints: clampNonNegativeFinite(
        clientLedger.achievementPoints,
        clampNonNegativeFinite(existingLedger.achievementPoints, 0)
      ),
    },
    hakimSubscription: {
      ...existingHakim,
      active: hakimSubValid,
      expiresAt: hakimSubValid ? existingHakimExpiresAt : null,
    },
    vipSubscription: existingState.vipSubscription,
    smartBotActive: hakimSubValid ? Boolean(clientState.smartBotActive ?? true) : false,
    smartBotExpiresAt: hakimSubValid ? existingHakimExpiresAt : null,
    registration: mergedReg,
    paymentOrders: mergedOrders,
    coopQuestClaims: asObject(existingState.coopQuestClaims) ?? {},
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

export async function submitPlayerPaymentOrderSafely(
  db: D1Database,
  params: {
    accountId: string;
    productType: 'gem_package' | 'hakim_sub' | 'vip_sub' | 'registration_fee';
    productId: string;
    paymentMethod: 'apple_pay' | 'mada' | 'bank_transfer' | 'binance';
    transferRef?: string;
    receiptName?: string;
    receiptId?: string;
    now: number;
  }
): Promise<
  | {
      ok: true;
      order: JsonObject;
      revision: number;
      state: JsonObject;
      adminConfig: JsonObject;
    }
  | { ok: false; status: number; error: string }
> {
  const adminConfig = await ensurePlatformConfig(db, params.now);
  const player = await findPlayerById(db, params.accountId);
  if (!player) {
    return { ok: false, status: 404, error: 'الحساب غير موجود في قاعدة البيانات.' };
  }

  const paymentMethodsObj = asObject(adminConfig.paymentMethods) ?? {};
  const pmCfg = asObject(paymentMethodsObj[params.paymentMethod]);
  const pmEnabled = pmCfg ? pmCfg.enabled !== false : true;
  if (!pmEnabled) {
    return { ok: false, status: 400, error: 'وسيلة الدفع المختارة متوقفة حاليًا من الإدارة.' };
  }

  let title = '';
  let baseAmountSar = 0;
  if (params.productType === 'gem_package') {
    const gemPacks = asArray(adminConfig.gemPackages)
      .map(asObject)
      .filter((p): p is JsonObject => Boolean(p && typeof p.id === 'string'));
    const pack = gemPacks.find((p) => String(p.id) === params.productId);
    if (!pack) {
      return { ok: false, status: 400, error: 'باقة الجواهر المحددة غير موجودة.' };
    }
    const baseGems = clampNonNegativeFinite(pack.baseGems, 0);
    const bonusGems = clampNonNegativeFinite(pack.bonusGems, 0);
    baseAmountSar = clampNonNegativeFinite(pack.priceSar, 0);
    title = `${String(pack.name ?? 'باقة جواهر')} (${baseGems} + ${bonusGems} جوهرة)`;
  } else if (params.productType === 'hakim_sub') {
    const days = clampNonNegativeFinite(adminConfig.hakimDurationDays, 90);
    baseAmountSar = clampNonNegativeFinite(adminConfig.hakimPriceSar, 250);
    title = `اشتراك المساعد الذكي حكيم (${days} يومًا)`;
  } else if (params.productType === 'registration_fee') {
    baseAmountSar = clampNonNegativeFinite(adminConfig.registrationFeeSar, 200) || 200;
    title = `رسوم تسجيل وتفعيل حساب لاعب (${baseAmountSar} ريال)`;
  } else {
    const days = clampNonNegativeFinite(adminConfig.vipDurationDays, 30);
    baseAmountSar = clampNonNegativeFinite(adminConfig.vipPriceSar, 75);
    title = `اشتراك الباقة الشهرية VIP (${days} يومًا)`;
  }

  const rawDiscount = pmCfg ? Number(pmCfg.discountPct ?? 0) : 0;
  const discountPct = Math.max(0, Math.min(90, Number.isFinite(rawDiscount) ? rawDiscount : 0));
  const finalSar = Number((baseAmountSar * (1 - discountPct / 100)).toFixed(2));
  if (discountPct > 0) {
    title = `${title} — خصم وسيلة الدفع ${discountPct}%`;
  }

  const cleanReceiptId =
    typeof params.receiptId === 'string' && /^rcp-[a-f0-9]{16}$/.test(params.receiptId.trim())
      ? params.receiptId.trim()
      : undefined;

  if (
    (params.paymentMethod === 'bank_transfer' || params.paymentMethod === 'binance') &&
    !cleanReceiptId
  ) {
    return {
      ok: false,
      status: 400,
      error:
        params.paymentMethod === 'binance'
          ? 'يرجى إرفاق صورة إيصال تحويل بايننس (رقم العملية المرجعي اختياري).'
          : 'يرجى إرفاق صورة الفاتورة / إيصال التحويل البنكي (رقم العملية المرجعي اختياري).',
    };
  }

  if (cleanReceiptId) {
    const receiptOwner = await db
      .prepare('SELECT account_id FROM receipts WHERE id = ? LIMIT 1')
      .bind(cleanReceiptId)
      .first<{ account_id: string }>();
    if (!receiptOwner || receiptOwner.account_id !== params.accountId) {
      return {
        ok: false,
        status: 400,
        error: 'تعذر التحقق من صورة الفاتورة المرفقة. يرجى إعادة إرفاق الصورة ثم المحاولة مجددًا.',
      };
    }
  }

  const cleanTransferRef =
    typeof params.transferRef === 'string' ? params.transferRef.trim().slice(0, 120) : '';
  const cleanReceiptName =
    typeof params.receiptName === 'string' ? params.receiptName.trim().slice(0, 140) : '';

  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db
      .prepare('SELECT * FROM player_states WHERE account_id = ? LIMIT 1')
      .bind(params.accountId)
      .first<PlayerStateRow>();

    if (!row) {
      return { ok: false, status: 404, error: 'حالة اللاعب غير موجودة.' };
    }

    const existingState = JSON.parse(row.state_json) as JsonObject;
    const existingOrders = asArray(existingState.paymentOrders)
      .map(asObject)
      .filter((o): o is JsonObject => Boolean(o && typeof o.id === 'string'));

    const order: JsonObject = {
      id: `ORD-${params.now}-${generateId('p').slice(-4).toUpperCase()}`,
      accountId: params.accountId,
      playerName:
        typeof existingState.commanderName === 'string' && existingState.commanderName.trim()
          ? existingState.commanderName.trim()
          : player.commander_name,
      productType: params.productType,
      productId: params.productId,
      productTitle: title,
      amountSar: finalSar,
      paymentMethod: params.paymentMethod,
      ...(cleanTransferRef ? { transferRef: cleanTransferRef } : {}),
      ...(cleanReceiptName ? { receiptName: cleanReceiptName } : {}),
      ...(cleanReceiptId ? { receiptId: cleanReceiptId } : {}),
      status: 'pending',
      createdAt: params.now,
    };

    const nextState: JsonObject = {
      ...existingState,
      accountId: params.accountId,
      adminConfig,
      paymentOrders: [order, ...existingOrders].slice(0, 100),
    };

    const serialized = JSON.stringify(nextState);
    if (serialized.length > 1_600_000) {
      return {
        ok: false,
        status: 413,
        error: 'حجم بيانات الحساب تجاوز الحد المسموح. يرجى التواصل مع الدعم الفني.',
      };
    }

    const updateRes = await db
      .prepare(
        `UPDATE player_states
         SET state_json = ?, version = 3, revision = revision + 1, updated_at = ?
         WHERE account_id = ? AND revision = ?`
      )
      .bind(serialized, params.now, params.accountId, row.revision)
      .run();

    if (updateRes.meta && updateRes.meta.changes === 1) {
      return {
        ok: true,
        order,
        revision: row.revision + 1,
        state: nextState,
        adminConfig,
      };
    }
  }

  return {
    ok: false,
    status: 409,
    error: 'حدث تزامن متزامن على الحساب، يرجى المحاولة مرة أخرى خلال لحظة.',
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

  // Preserve chargedGems & PAID active subscriptions on city reset so paid account benefits aren't lost
  const prevHakim = asObject(prevState.hakimSubscription) ?? {};
  const prevHakimExp = typeof prevHakim.expiresAt === 'number' ? prevHakim.expiresAt : null;
  const hasPaidHakim = Boolean(prevHakim.active) && prevHakimExp !== null && prevHakimExp > params.now;
  fresh.gemLedger = prevState.gemLedger ?? fresh.gemLedger;
  fresh.ledger = prevState.ledger ?? fresh.ledger;
  fresh.hakimSubscription = {
    ...prevHakim,
    active: hasPaidHakim,
    expiresAt: hasPaidHakim ? prevHakimExp : null,
  };
  fresh.vipSubscription = prevState.vipSubscription ?? fresh.vipSubscription;
  fresh.smartBotActive = hasPaidHakim ? Boolean(prevState.smartBotActive) : false;
  fresh.smartBotExpiresAt = hasPaidHakim ? prevHakimExp : null;
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

export async function adminResetPlayerPassword(
  db: D1Database,
  params: {
    accountId: string;
    passwordHash: string;
    passwordSalt: string;
    actorRole: string;
    now: number;
  }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (params.actorRole !== 'founder') {
    return {
      ok: false,
      status: 403,
      error: 'تعديل كلمة مرور اللاعبين يدويًا حصري للمؤسس (Founder) فقط.',
    };
  }

  const player = await findPlayerById(db, params.accountId);
  const stateRow = await db
    .prepare('SELECT state_json FROM player_states WHERE account_id = ? LIMIT 1')
    .bind(params.accountId)
    .first<{ state_json: string }>();

  if (!player || !stateRow) {
    return { ok: false, status: 404, error: 'الحساب غير موجود في قاعدة البيانات.' };
  }

  let nextStateJson = stateRow.state_json;
  try {
    const parsed = JSON.parse(stateRow.state_json) as JsonObject;
    const prevAudit = asArray(parsed.adminAuditLogs);
    const auditEntry: JsonObject = {
      id: generateId('aud'),
      actorRole: 'founder',
      actorName: 'المؤسس (Founder)',
      action: 'تعديل كلمة مرور اللاعب يدويًا',
      details: `تم تعيين كلمة مرور جديدة للحساب ${params.accountId} وإنهاء الجلسات السابقة`,
      createdAt: params.now,
    };
    parsed.adminAuditLogs = [auditEntry, ...prevAudit].slice(0, 200);
    nextStateJson = JSON.stringify(parsed);
  } catch {
    // keep state_json as-is if unexpected JSON
  }

  await db.batch([
    db
      .prepare(
        `UPDATE players
         SET password_hash = ?, password_salt = ?, updated_at = ?
         WHERE account_id = ?`
      )
      .bind(params.passwordHash, params.passwordSalt, params.now, params.accountId),
    db.prepare('DELETE FROM sessions WHERE account_id = ?').bind(params.accountId),
    db
      .prepare(
        `UPDATE player_states
         SET state_json = ?, revision = revision + 1, updated_at = ?
         WHERE account_id = ?`
      )
      .bind(nextStateJson, params.now, params.accountId),
  ]);

  return { ok: true };
}

export interface AdminBackupRow {
  id: string;
  label: string;
  createdBy: string;
  totalSarApproved: number;
  commanderName: string;
  backupType: 'server_snapshot_v1' | 'legacy_player_snapshot';
  serverId: string;
  serverName: string;
  playersCount: number;
  payloadJson: string;
  createdAt: number;
}

function parseBackupMetadata(
  payloadJson: string,
  fallbackCommander: string
): {
  backupType: 'server_snapshot_v1' | 'legacy_player_snapshot';
  serverId: string;
  serverName: string;
  playersCount: number;
} {
  try {
    const parsed = JSON.parse(payloadJson) as JsonObject;
    if (parsed.backupType === 'server_snapshot_v1' && Array.isArray(parsed.players)) {
      const srvId = typeof parsed.serverId === 'string' && parsed.serverId ? parsed.serverId : 'ALL';
      const srvName =
        typeof parsed.serverName === 'string' && parsed.serverName
          ? parsed.serverName
          : srvId === 'ALL'
            ? 'جميع السيرفرات'
            : srvId;
      return {
        backupType: 'server_snapshot_v1',
        serverId: srvId,
        serverName: srvName,
        playersCount: parsed.players.length,
      };
    }
    const srvId =
      typeof parsed.selectedServerId === 'string' && parsed.selectedServerId
        ? parsed.selectedServerId
        : 'legacy';
    return {
      backupType: 'legacy_player_snapshot',
      serverId: srvId,
      serverName: fallbackCommander ? `لاعب: ${fallbackCommander}` : 'نسخة فردية سابقة',
      playersCount: 1,
    };
  } catch {
    return {
      backupType: 'legacy_player_snapshot',
      serverId: 'unknown',
      serverName: fallbackCommander || 'غير معروف',
      playersCount: 0,
    };
  }
}

export async function ensureAdminBackupsTable(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS admin_backups (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        created_by TEXT NOT NULL,
        total_sar_approved REAL NOT NULL DEFAULT 0,
        commander_name TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_admin_backups_created ON admin_backups(created_at DESC)`
    ),
  ]);
}

export async function listAdminBackups(db: D1Database): Promise<AdminBackupRow[]> {
  await ensureAdminBackupsTable(db);
  const res = await db
    .prepare(
      `SELECT id, label, created_by, total_sar_approved, commander_name, payload_json, created_at
       FROM admin_backups
       ORDER BY created_at DESC
       LIMIT 15`
    )
    .all<{
      id: string;
      label: string;
      created_by: string;
      total_sar_approved: number;
      commander_name: string;
      payload_json: string;
      created_at: number;
    }>();

  return (res.results ?? []).map((r) => {
    const meta = parseBackupMetadata(r.payload_json, r.commander_name);
    return {
      id: r.id,
      label: r.label,
      createdBy: r.created_by,
      totalSarApproved: Number(r.total_sar_approved ?? 0),
      commanderName: r.commander_name,
      backupType: meta.backupType,
      serverId: meta.serverId,
      serverName: meta.serverName,
      playersCount: meta.playersCount,
      payloadJson: r.payload_json,
      createdAt: r.created_at,
    };
  });
}

export async function createAdminBackup(
  db: D1Database,
  params: {
    label: string;
    createdBy: string;
    totalSarApproved: number;
    commanderName: string;
    payloadJson: string;
    now: number;
  }
): Promise<
  | { ok: true; snapshot: AdminBackupRow; list: AdminBackupRow[] }
  | { ok: false; status: number; error: string }
> {
  await ensureAdminBackupsTable(db);
  if (params.payloadJson.length > 1_800_000) {
    return {
      ok: false,
      status: 413,
      error: 'حجم النسخة الاحتياطية يتجاوز الحد المسموح للحفظ في القاعدة.',
    };
  }

  const id = `BKP-${params.now}-${generateId('s').slice(-4).toUpperCase()}`;
  const label = params.label.trim() || `نسخة احتياطية (${new Date(params.now).toISOString().slice(0, 16)})`;

  await db
    .prepare(
      `INSERT INTO admin_backups (
        id, label, created_by, total_sar_approved, commander_name, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      label,
      params.createdBy,
      params.totalSarApproved,
      params.commanderName,
      params.payloadJson,
      params.now
    )
    .run();

  // Keep latest 15 snapshots cleanly
  await db
    .prepare(
      `DELETE FROM admin_backups
       WHERE id NOT IN (
         SELECT id FROM admin_backups ORDER BY created_at DESC LIMIT 15
       )`
    )
    .run();

  const list = await listAdminBackups(db);
  const meta = parseBackupMetadata(params.payloadJson, params.commanderName);
  const snapshot = list.find((item) => item.id === id) ?? {
    id,
    label,
    createdBy: params.createdBy,
    totalSarApproved: params.totalSarApproved,
    commanderName: params.commanderName,
    backupType: meta.backupType,
    serverId: meta.serverId,
    serverName: meta.serverName,
    playersCount: meta.playersCount,
    payloadJson: params.payloadJson,
    createdAt: params.now,
  };
  return { ok: true, snapshot, list };
}

export async function createServerBackup(
  db: D1Database,
  params: {
    serverId: string;
    label: string;
    createdBy: string;
    now: number;
  }
): Promise<
  | { ok: true; snapshot: AdminBackupRow; list: AdminBackupRow[] }
  | { ok: false; status: number; error: string }
> {
  const adminConfig = await ensurePlatformConfig(db, params.now);
  const servers = asArray(adminConfig.servers)
    .map(asObject)
    .filter((s): s is JsonObject => Boolean(s && typeof s.id === 'string'));

  const targetServerId = params.serverId.trim() || 'ALL';
  const isAllServers = targetServerId === 'ALL';
  const matchedServer = isAllServers
    ? null
    : servers.find((s) => String(s.id) === targetServerId);

  if (!isAllServers && !matchedServer) {
    return { ok: false, status: 404, error: 'السيرفر المحدد غير موجود في الإعدادات.' };
  }

  const serverName = isAllServers
    ? 'جميع السيرفرات والمنصة بالكامل'
    : `[${String(matchedServer?.code ?? targetServerId)}] ${String(matchedServer?.name ?? targetServerId)}`;

  const query = isAllServers
    ? db.prepare(
        `SELECT p.account_id, p.commander_name, p.email, p.phone, p.email_verified,
                p.selected_server_id, p.registration_status, s.revision, s.state_json
         FROM players p
         JOIN player_states s ON s.account_id = p.account_id
         ORDER BY p.created_at ASC`
      )
    : db
        .prepare(
          `SELECT p.account_id, p.commander_name, p.email, p.phone, p.email_verified,
                  p.selected_server_id, p.registration_status, s.revision, s.state_json
           FROM players p
           JOIN player_states s ON s.account_id = p.account_id
           WHERE p.selected_server_id = ?
           ORDER BY p.created_at ASC`
        )
        .bind(targetServerId);

  const res = await query.all<PlayerRow & { state_json: string; revision: number }>();
  const rows = res.results ?? [];

  let totalSarApproved = 0;
  const serializedPlayers: JsonObject[] = [];
  for (const r of rows) {
    let parsedState: JsonObject = {};
    try {
      parsedState = JSON.parse(r.state_json) as JsonObject;
    } catch {
      parsedState = {};
    }
    const orders = asArray(parsedState.paymentOrders).map(asObject).filter(Boolean) as JsonObject[];
    for (const o of orders) {
      if (o.status === 'approved') {
        totalSarApproved += clampNonNegativeFinite(o.amountSar, 0);
      }
    }
    const reg = asObject(parsedState.registration);
    if (reg && reg.status === 'approved') {
      totalSarApproved += clampNonNegativeFinite(reg.feeAmountSar, 0);
    }
    serializedPlayers.push({
      accountId: r.account_id,
      commanderName: r.commander_name,
      email: r.email,
      phone: r.phone,
      emailVerified: r.email_verified === 1,
      selectedServerId: r.selected_server_id,
      registrationStatus: r.registration_status,
      revision: r.revision,
      state: parsedState,
    });
  }

  const snapshotPayload: JsonObject = {
    backupType: 'server_snapshot_v1',
    exportedAt: params.now,
    serverId: targetServerId,
    serverName,
    playersCount: serializedPlayers.length,
    serverConfig: matchedServer ?? null,
    adminConfig,
    players: serializedPlayers,
  };

  const payloadJson = JSON.stringify(snapshotPayload);
  const autoLabel =
    params.label.trim() ||
    `نسخة ${serverName} (${serializedPlayers.length} لاعب)`;

  return createAdminBackup(db, {
    label: autoLabel,
    createdBy: params.createdBy,
    totalSarApproved: Number(totalSarApproved.toFixed(2)),
    commanderName: `${serverName} (${serializedPlayers.length} لاعب)`,
    payloadJson,
    now: params.now,
  });
}

export async function restoreServerBackupSafely(
  db: D1Database,
  params: {
    backupId?: string;
    payloadJson?: string;
    now: number;
  }
): Promise<
  | {
      ok: true;
      serverId: string;
      serverName: string;
      restoredPlayersCount: number;
      adminConfig: JsonObject;
      players: Awaited<ReturnType<typeof listPlayersForAdmin>>['players'];
    }
  | { ok: false; status: number; error: string }
> {
  await ensureAdminBackupsTable(db);
  let rawJson = typeof params.payloadJson === 'string' ? params.payloadJson.trim() : '';
  if (!rawJson && params.backupId) {
    const row = await db
      .prepare('SELECT payload_json FROM admin_backups WHERE id = ? LIMIT 1')
      .bind(params.backupId)
      .first<{ payload_json: string }>();
    if (!row) {
      return { ok: false, status: 404, error: 'النسخة الاحتياطية المطلوبة غير موجودة.' };
    }
    rawJson = row.payload_json;
  }

  if (!rawJson) {
    return { ok: false, status: 400, error: 'يجب تحديد نسخة محفوظة أو لصق ملف JSON صالح للاستعادة.' };
  }

  let parsed: JsonObject;
  try {
    const obj = JSON.parse(rawJson);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, status: 400, error: 'ملف النسخة الاحتياطية غير صالح.' };
    }
    parsed = obj as JsonObject;
  } catch {
    return { ok: false, status: 400, error: 'تعذر قراءة ملف JSON للنسخة الاحتياطية.' };
  }

  // Branch A: Full server snapshot
  if (parsed.backupType === 'server_snapshot_v1' && Array.isArray(parsed.players)) {
    const serverId =
      typeof parsed.serverId === 'string' && parsed.serverId ? parsed.serverId : 'ALL';
    const serverName =
      typeof parsed.serverName === 'string' && parsed.serverName
        ? parsed.serverName
        : serverId;

    let adminConfig = await ensurePlatformConfig(db, params.now);
    const snapshotCfg = asObject(parsed.adminConfig);
    if (snapshotCfg) {
      if (serverId === 'ALL') {
        adminConfig = await updatePlatformConfig(db, snapshotCfg, params.now);
      } else {
        const snapshotServer = asObject(parsed.serverConfig);
        if (snapshotServer && typeof snapshotServer.id === 'string') {
          const currentServers = asArray(adminConfig.servers)
            .map(asObject)
            .filter((s): s is JsonObject => Boolean(s && typeof s.id === 'string'));
          const idx = currentServers.findIndex((s) => s.id === snapshotServer.id);
          const nextServers =
            idx >= 0
              ? currentServers.map((s, i) => (i === idx ? snapshotServer : s))
              : [...currentServers, snapshotServer];
          adminConfig = await updatePlatformConfig(
            db,
            { ...adminConfig, servers: nextServers },
            params.now
          );
        }
      }
    }

    const existingPlayersRes = await db
      .prepare('SELECT account_id FROM players')
      .all<{ account_id: string }>();
    const existingIds = new Set(
      (existingPlayersRes.results ?? []).map((r) => r.account_id)
    );

    const statements: D1PreparedStatement[] = [];
    let restoredPlayersCount = 0;

    for (const rawEntry of parsed.players) {
      const entry = asObject(rawEntry);
      if (!entry) continue;
      const accountId =
        typeof entry.accountId === 'string' ? entry.accountId.trim() : '';
      const entryState = asObject(entry.state);
      if (!accountId || !entryState || !existingIds.has(accountId)) continue;

      const sanitizedState: JsonObject = {
        ...entryState,
        version: 3,
        accountId,
        adminConfig,
      };
      const serializedState = JSON.stringify(sanitizedState);
      if (serializedState.length > 1_600_000) continue;

      const commanderName =
        typeof sanitizedState.commanderName === 'string' && sanitizedState.commanderName.trim()
          ? sanitizedState.commanderName.trim()
          : typeof entry.commanderName === 'string' && entry.commanderName.trim()
            ? entry.commanderName.trim()
            : 'القائد سيف';
      const playerServerId =
        typeof sanitizedState.selectedServerId === 'string' && sanitizedState.selectedServerId
          ? sanitizedState.selectedServerId
          : typeof entry.selectedServerId === 'string'
            ? entry.selectedServerId
            : serverId === 'ALL'
              ? 'srv-1'
              : serverId;
      const reg = asObject(sanitizedState.registration);
      const regStatus = String(reg?.status ?? entry.registrationStatus ?? 'unregistered');

      statements.push(
        db
          .prepare(
            `UPDATE player_states
             SET state_json = ?, version = 3, revision = revision + 1, updated_at = ?
             WHERE account_id = ?`
          )
          .bind(serializedState, params.now, accountId),
        db
          .prepare(
            `UPDATE players
             SET commander_name = ?, selected_server_id = ?, registration_status = ?, updated_at = ?
             WHERE account_id = ?`
          )
          .bind(commanderName, playerServerId, regStatus, params.now, accountId)
      );
      restoredPlayersCount++;
    }

    for (let i = 0; i < statements.length; i += 40) {
      await db.batch(statements.slice(i, i + 40));
    }

    const overview = await listPlayersForAdmin(db, params.now, 'founder');
    return {
      ok: true,
      serverId,
      serverName,
      restoredPlayersCount,
      adminConfig: overview.adminConfig,
      players: overview.players,
    };
  }

  // Branch B: Backward compatibility with legacy single-player snapshot JSON
  const legacyVersion = Number(parsed.version ?? 0);
  const legacyAccountId =
    typeof parsed.accountId === 'string' ? parsed.accountId.trim() : '';
  if (
    (legacyVersion === 2 || legacyVersion === 3) &&
    Array.isArray(parsed.buildings) &&
    legacyAccountId
  ) {
    const saved = await adminSavePlayerState(db, {
      accountId: legacyAccountId,
      nextState: parsed,
      role: 'founder',
      now: params.now,
    });
    if (!saved.ok) {
      return { ok: false, status: saved.status, error: saved.error };
    }
    const overview = await listPlayersForAdmin(db, params.now, 'founder');
    return {
      ok: true,
      serverId: String(parsed.selectedServerId ?? 'srv-1'),
      serverName: `استعادة لاعب فردي (${legacyAccountId})`,
      restoredPlayersCount: 1,
      adminConfig: overview.adminConfig,
      players: overview.players,
    };
  }

  return {
    ok: false,
    status: 400,
    error: 'تنسيق النسخة الاحتياطية غير مدعوم. استخدم نسخة سيرفر صالحة.',
  };
}

export async function deleteAdminBackup(
  db: D1Database,
  id: string
): Promise<AdminBackupRow[]> {
  await ensureAdminBackupsTable(db);
  await db.prepare('DELETE FROM admin_backups WHERE id = ?').bind(id).run();
  return listAdminBackups(db);
}

function redactStateForSupport(
  state: JsonObject,
  accountId: string,
  adminConfig: JsonObject
): JsonObject {
  const reg = asObject(state.registration) ?? {};
  const redactedReg: JsonObject = {
    status: reg.status ?? 'unregistered',
    nickname: reg.nickname ?? state.commanderName ?? '',
    fullName: reg.fullName ?? '',
    nationalId: reg.nationalId ? '****' : '',
    email: reg.email ?? '',
    phone: reg.phone ?? '',
    feeAmountSar: 0,
    acceptedPolicies: Boolean(reg.acceptedPolicies),
  };

  return {
    ...state,
    accountId,
    adminConfig,
    registration: redactedReg,
    paymentOrders: [],
    financialLogs: [],
    adminAuditLogs: [],
  };
}

export async function listPlayersForAdmin(
  db: D1Database,
  now: number,
  role: string = 'founder'
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
    const baseState: JsonObject = { ...parsedState, accountId: r.account_id, adminConfig };
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
      state:
        role === 'support'
          ? redactStateForSupport(baseState, r.account_id, adminConfig)
          : baseState,
    };
  });

  return { adminConfig, players };
}

export async function adminSavePlayerState(
  db: D1Database,
  params: { accountId: string; nextState: JsonObject; role?: string; now: number }
): Promise<
  | { ok: true; revision: number; state: JsonObject; adminConfig: JsonObject }
  | { ok: false; status: number; error: string }
> {
  const role = params.role ?? 'founder';
  if (role === 'partner') {
    return {
      ok: false,
      status: 403,
      error: 'حساب الشريك للعرض المالي والتقارير فقط ولا يملك صلاحية التعديل.',
    };
  }

  const adminConfig = await ensurePlatformConfig(db, params.now);
  const player = await findPlayerById(db, params.accountId);
  const row = await db
    .prepare('SELECT revision, state_json FROM player_states WHERE account_id = ? LIMIT 1')
    .bind(params.accountId)
    .first<{ revision: number; state_json: string }>();

  if (!player || !row) {
    return { ok: false, status: 404, error: 'اللاعب غير موجود في قاعدة البيانات.' };
  }

  let nextState: JsonObject;
  if (role === 'support') {
    // Support can ONLY update supportTickets and audit logs; never financial/registration/gem fields
    let existingState: JsonObject = {};
    try {
      existingState = JSON.parse(row.state_json) as JsonObject;
    } catch {
      existingState = {};
    }
    nextState = {
      ...existingState,
      version: 3,
      accountId: params.accountId,
      adminConfig,
      supportTickets: Array.isArray(params.nextState.supportTickets)
        ? params.nextState.supportTickets
        : existingState.supportTickets ?? [],
      adminAuditLogs: Array.isArray(params.nextState.adminAuditLogs)
        ? params.nextState.adminAuditLogs
        : existingState.adminAuditLogs ?? [],
    };
  } else {
    nextState = {
      ...params.nextState,
      version: 3,
      accountId: params.accountId,
      adminConfig,
    };
  }

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

  const returnedState =
    role === 'support'
      ? redactStateForSupport(nextState, params.accountId, adminConfig)
      : nextState;

  return {
    ok: true,
    revision: row.revision + 1,
    state: returnedState,
    adminConfig,
  };
}

/* -------------------------------------------------------------------------- */
/*  Isolated Per-Role Admin Credentials (Founder / Partner / Support)         */
/* -------------------------------------------------------------------------- */

export type AdminRoleType = 'founder' | 'partner' | 'support';
const ADMIN_ROLES_LIST: AdminRoleType[] = ['founder', 'partner', 'support'];

export interface AdminRoleEnvSecrets {
  ADMIN_PASSWORD?: string;
  ADMIN_FOUNDER_PASSWORD?: string;
  ADMIN_PARTNER_PASSWORD?: string;
  ADMIN_SUPPORT_PASSWORD?: string;
}

export async function ensureAdminCredentialsTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_credentials (
        role TEXT PRIMARY KEY CHECK (role IN ('founder', 'partner', 'support')),
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();
}

export function getEnvSecretForAdminRole(
  role: AdminRoleType,
  envSecrets: AdminRoleEnvSecrets
): string | null {
  if (role === 'founder') {
    const val =
      envSecrets.ADMIN_FOUNDER_PASSWORD?.trim() ||
      envSecrets.ADMIN_PASSWORD?.trim() ||
      '';
    return val || null;
  }
  if (role === 'partner') {
    const val = envSecrets.ADMIN_PARTNER_PASSWORD?.trim() || '';
    return val || null;
  }
  const val = envSecrets.ADMIN_SUPPORT_PASSWORD?.trim() || '';
  return val || null;
}

async function matchRoleSecretOrDb(
  db: D1Database,
  role: AdminRoleType,
  candidatePassword: string,
  envSecrets: AdminRoleEnvSecrets
): Promise<{ configured: boolean; matched: boolean }> {
  await ensureAdminCredentialsTable(db);
  const dbRow = await db
    .prepare(
      'SELECT password_hash, password_salt FROM admin_credentials WHERE role = ? LIMIT 1'
    )
    .bind(role)
    .first<{ password_hash: string; password_salt: string }>();

  if (dbRow) {
    const matched = await verifyPassword(
      candidatePassword,
      dbRow.password_hash,
      dbRow.password_salt
    );
    return { configured: true, matched };
  }

  const envSecret = getEnvSecretForAdminRole(role, envSecrets);
  if (!envSecret) {
    return { configured: false, matched: false };
  }
  const matched = await constantTimeEqualText(candidatePassword, envSecret);
  return { configured: true, matched };
}

export async function verifyAdminRolePassword(
  db: D1Database,
  params: {
    role: AdminRoleType;
    password: string;
    envSecrets: AdminRoleEnvSecrets;
  }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await matchRoleSecretOrDb(
    db,
    params.role,
    params.password,
    params.envSecrets
  );
  if (!res.configured) {
    const roleLabel =
      params.role === 'founder'
        ? 'المؤسس (Founder)'
        : params.role === 'partner'
          ? 'الشريك (Partner)'
          : 'الدعم الفني (Support)';
    return {
      ok: false,
      status: 503,
      error: `كلمة مرور صلاحية ${roleLabel} غير مهيأة بعد. يجب على المؤسس تعيين كلمة مرور مستقلة لهذه الصلاحية أو إضافتها في Cloudflare Secrets.`,
    };
  }
  if (!res.matched) {
    return {
      ok: false,
      status: 401,
      error: 'كلمة المرور غير صحيحة لهذه الصلاحية.',
    };
  }
  return { ok: true };
}

export async function getAdminCredentialsStatus(
  db: D1Database,
  envSecrets: AdminRoleEnvSecrets
): Promise<
  Array<{
    role: AdminRoleType;
    source: 'database' | 'env_secret' | 'unconfigured';
    updatedAt: number | null;
  }>
> {
  await ensureAdminCredentialsTable(db);
  const res = await db
    .prepare('SELECT role, updated_at FROM admin_credentials')
    .all<{ role: AdminRoleType; updated_at: number }>();
  const dbMap = new Map<AdminRoleType, number>();
  for (const row of res.results ?? []) {
    dbMap.set(row.role, Number(row.updated_at ?? 0));
  }

  return ADMIN_ROLES_LIST.map((role) => {
    const dbUpdated = dbMap.get(role);
    if (dbUpdated !== undefined) {
      return { role, source: 'database', updatedAt: dbUpdated };
    }
    const envSecret = getEnvSecretForAdminRole(role, envSecrets);
    if (envSecret) {
      return { role, source: 'env_secret', updatedAt: null };
    }
    return { role, source: 'unconfigured', updatedAt: null };
  });
}

export async function setAdminRoleCredential(
  db: D1Database,
  params: {
    targetRole: AdminRoleType;
    newPassword?: string;
    resetToEnv?: boolean;
    currentTokenHash?: string;
    envSecrets: AdminRoleEnvSecrets;
    now: number;
  }
): Promise<
  | {
      ok: true;
      credentials: Awaited<ReturnType<typeof getAdminCredentialsStatus>>;
    }
  | { ok: false; status: number; error: string }
> {
  await ensureAdminCredentialsTable(db);

  if (params.resetToEnv) {
    const envSecret = getEnvSecretForAdminRole(params.targetRole, params.envSecrets);
    if (params.targetRole === 'founder' && !envSecret) {
      return {
        ok: false,
        status: 400,
        error: 'لا يمكن إزالة كلمة مرور المؤسس لعدم وجود متغير ADMIN_FOUNDER_PASSWORD أو ADMIN_PASSWORD في الخادم.',
      };
    }
    const stmts: D1PreparedStatement[] = [
      db
        .prepare('DELETE FROM admin_credentials WHERE role = ?')
        .bind(params.targetRole),
    ];
    if (params.targetRole !== 'founder') {
      stmts.push(
        db
          .prepare(
            "DELETE FROM sessions WHERE subject_type = 'admin' AND admin_role = ?"
          )
          .bind(params.targetRole)
      );
    }
    await db.batch(stmts);
    return {
      ok: true,
      credentials: await getAdminCredentialsStatus(db, params.envSecrets),
    };
  }

  const pwCheck = validatePassword(params.newPassword);
  if (!pwCheck.valid) {
    return { ok: false, status: 400, error: pwCheck.error ?? 'كلمة المرور غير صالحة.' };
  }
  const plainPassword = String(params.newPassword);

  // Enforce strict role separation: reject if identical to another role's active password
  for (const otherRole of ADMIN_ROLES_LIST) {
    if (otherRole === params.targetRole) continue;
    const otherMatch = await matchRoleSecretOrDb(
      db,
      otherRole,
      plainPassword,
      params.envSecrets
    );
    if (otherMatch.configured && otherMatch.matched) {
      return {
        ok: false,
        status: 400,
        error: 'يجب أن تكون كلمة مرور كل صلاحية مختلفة ومستقلة تمامًا عن باقي الصلاحيات.',
      };
    }
  }

  const { hashHex, saltHex } = await hashPassword(plainPassword);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO admin_credentials (role, password_hash, password_salt, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(role) DO UPDATE SET
           password_hash = excluded.password_hash,
           password_salt = excluded.password_salt,
           updated_at = excluded.updated_at`
      )
      .bind(params.targetRole, hashHex, saltHex, params.now),
  ];

  if (params.targetRole !== 'founder') {
    stmts.push(
      db
        .prepare(
          "DELETE FROM sessions WHERE subject_type = 'admin' AND admin_role = ?"
        )
        .bind(params.targetRole)
    );
  } else if (params.currentTokenHash) {
    stmts.push(
      db
        .prepare(
          "DELETE FROM sessions WHERE subject_type = 'admin' AND admin_role = 'founder' AND token_hash != ?"
        )
        .bind(params.currentTokenHash)
    );
  }

  await db.batch(stmts);
  return {
    ok: true,
    credentials: await getAdminCredentialsStatus(db, params.envSecrets),
  };
}

/* -------------------------------------------------------------------------- */
/*  Server-Wide Cooperative Shared Quests (HQ 10 + Alliance Center)           */
/* -------------------------------------------------------------------------- */

function getBuildingLvFromState(state: JsonObject, buildingType: string): number {
  const buildings = asArray(state.buildings).map(asObject).filter(Boolean) as JsonObject[];
  let maxLv = 0;
  for (const b of buildings) {
    if (b.type === buildingType) {
      const lv = Math.floor(Number(b.level ?? 0));
      if (Number.isFinite(lv) && lv > maxLv) maxLv = lv;
    }
  }
  return maxLv;
}

interface CoopMetricsSummary {
  serverPlayersCount: number;
  metrics: Record<
    | 'total_building_upgrades'
    | 'hq10_players'
    | 'alliance_center_levels'
    | 'total_research_levels'
    | 'total_army_units'
    | 'maritime_energy_stock',
    { value: number; contributorsCount: number }
  >;
}

async function computeServerCoopMetrics(
  db: D1Database,
  serverId: string
): Promise<CoopMetricsSummary> {
  const res = await db
    .prepare(
      `SELECT p.account_id, s.state_json
       FROM players p
       JOIN player_states s ON s.account_id = p.account_id
       WHERE p.selected_server_id = ?`
    )
    .bind(serverId)
    .all<{ account_id: string; state_json: string }>();

  const rows = res.results ?? [];
  const summary: CoopMetricsSummary = {
    serverPlayersCount: rows.length,
    metrics: {
      total_building_upgrades: { value: 0, contributorsCount: 0 },
      hq10_players: { value: 0, contributorsCount: 0 },
      alliance_center_levels: { value: 0, contributorsCount: 0 },
      total_research_levels: { value: 0, contributorsCount: 0 },
      total_army_units: { value: 0, contributorsCount: 0 },
      maritime_energy_stock: { value: 0, contributorsCount: 0 },
    },
  };

  for (const r of rows) {
    let st: JsonObject = {};
    try {
      st = JSON.parse(r.state_json) as JsonObject;
    } catch {
      continue;
    }

    const buildings = asArray(st.buildings).map(asObject).filter(Boolean) as JsonObject[];
    let playerUpgrades = 0;
    let hqLv = 0;
    let acLv = 0;
    for (const b of buildings) {
      const bType = String(b.type ?? '');
      const lv = Math.max(0, Math.floor(Number(b.level ?? 0) || 0));
      const baseLv = bType === 'hq' || bType === 'warehouse' ? 1 : 0;
      playerUpgrades += Math.max(0, lv - baseLv);
      if (bType === 'hq' && lv > hqLv) hqLv = lv;
      if (bType === 'alliance_center' && lv > acLv) acLv = lv;
    }
    if (playerUpgrades > 0) {
      summary.metrics.total_building_upgrades.value += playerUpgrades;
      summary.metrics.total_building_upgrades.contributorsCount += 1;
    }
    if (hqLv >= 10) {
      summary.metrics.hq10_players.value += 1;
      summary.metrics.hq10_players.contributorsCount += 1;
    }
    if (acLv > 0) {
      summary.metrics.alliance_center_levels.value += acLv;
      summary.metrics.alliance_center_levels.contributorsCount += 1;
    }

    const researchObj = asObject(st.researchLevels) ?? {};
    let researchSum = 0;
    for (const v of Object.values(researchObj)) {
      const n = Math.max(0, Math.floor(Number(v ?? 0) || 0));
      researchSum += n;
    }
    if (researchSum > 0) {
      summary.metrics.total_research_levels.value += researchSum;
      summary.metrics.total_research_levels.contributorsCount += 1;
    }

    const unitsObj = asObject(st.units) ?? {};
    const armySum =
      Math.max(0, Math.floor(Number(unitsObj.infantry ?? 0) || 0)) +
      Math.max(0, Math.floor(Number(unitsObj.tank ?? 0) || 0)) +
      Math.max(0, Math.floor(Number(unitsObj.aircraft ?? 0) || 0)) +
      Math.max(0, Math.floor(Number(unitsObj.scout ?? 0) || 0));
    if (armySum > 0) {
      summary.metrics.total_army_units.value += armySum;
      summary.metrics.total_army_units.contributorsCount += 1;
    }

    const maritimeObj = asObject(st.maritime) ?? {};
    const energySum =
      Math.max(0, Math.floor(Number(maritimeObj.crudeOilStock ?? 0) || 0)) +
      Math.max(0, Math.floor(Number(maritimeObj.naturalGasStock ?? 0) || 0));
    if (energySum > 0) {
      summary.metrics.maritime_energy_stock.value += energySum;
      summary.metrics.maritime_energy_stock.contributorsCount += 1;
    }
  }

  return summary;
}

function buildCoopQuestStatuses(
  summary: CoopMetricsSummary,
  playerState: JsonObject
) {
  const mainLevel = getBuildingLvFromState(playerState, 'hq');
  const allianceCenterLevel = getBuildingLvFromState(playerState, 'alliance_center');
  const claims = asObject(playerState.coopQuestClaims) ?? {};
  const eligibleForCoop = mainLevel >= 10 && allianceCenterLevel >= 1;

  const quests = COOP_QUESTS_CATALOG.map((quest) => {
    const m = summary.metrics[quest.metricKey];
    const currentValue = m?.value ?? 0;
    const progressPct = Math.min(
      100,
      Math.round((currentValue / Math.max(1, quest.targetValue)) * 100)
    );
    const completed = currentValue >= quest.targetValue;
    const claimed = Boolean(claims[quest.id]);
    const meetsBuildingGate =
      mainLevel >= quest.minHqRequired &&
      (!quest.requiresAllianceCenter || allianceCenterLevel >= 1);
    const canClaim = completed && !claimed && meetsBuildingGate;

    return {
      quest,
      currentValue,
      targetValue: quest.targetValue,
      progressPct,
      completed,
      claimed,
      canClaim,
      contributorsCount: m?.contributorsCount ?? 0,
    };
  });

  return { mainLevel, allianceCenterLevel, eligibleForCoop, quests };
}

export async function getPlayerCoopQuestsStatus(
  db: D1Database,
  accountId: string,
  now: number
): Promise<
  | {
      ok: true;
      serverId: string;
      serverName: string;
      serverPlayersCount: number;
      eligibleForCoop: boolean;
      mainLevel: number;
      allianceCenterLevel: number;
      quests: ReturnType<typeof buildCoopQuestStatuses>['quests'];
    }
  | { ok: false; status: number; error: string }
> {
  const player = await findPlayerById(db, accountId);
  const loaded = await getPlayerStateWithConfig(db, accountId, now);
  if (!player || !loaded) {
    return { ok: false, status: 404, error: 'بيانات اللاعب غير موجودة.' };
  }

  const serverId = String(
    loaded.state.selectedServerId ?? player.selected_server_id ?? 'srv-1'
  );
  const servers = asArray(loaded.adminConfig.servers).map(asObject).filter(Boolean) as JsonObject[];
  const matchedSrv = servers.find((s) => String(s.id) === serverId);
  const serverName = matchedSrv
    ? `[${String(matchedSrv.code ?? serverId)}] ${String(matchedSrv.name ?? serverId)}`
    : serverId;

  const summary = await computeServerCoopMetrics(db, serverId);
  const built = buildCoopQuestStatuses(summary, loaded.state);

  return {
    ok: true,
    serverId,
    serverName,
    serverPlayersCount: summary.serverPlayersCount,
    eligibleForCoop: built.eligibleForCoop,
    mainLevel: built.mainLevel,
    allianceCenterLevel: built.allianceCenterLevel,
    quests: built.quests,
  };
}

export async function claimPlayerCoopQuest(
  db: D1Database,
  params: { accountId: string; questId: string; now: number }
): Promise<
  | {
      ok: true;
      questId: string;
      state: JsonObject;
      revision: number;
      quests: ReturnType<typeof buildCoopQuestStatuses>['quests'];
    }
  | { ok: false; status: number; error: string }
> {
  const quest = COOP_QUESTS_CATALOG.find((q) => q.id === params.questId);
  if (!quest) {
    return { ok: false, status: 404, error: 'المهمة المشتركة المطلوبة غير موجودة.' };
  }

  const adminConfig = await ensurePlatformConfig(db, params.now);
  const player = await findPlayerById(db, params.accountId);
  const row = await db
    .prepare('SELECT * FROM player_states WHERE account_id = ? LIMIT 1')
    .bind(params.accountId)
    .first<PlayerStateRow>();

  if (!player || !row) {
    return { ok: false, status: 404, error: 'بيانات المدينة غير موجودة.' };
  }

  const currentState = JSON.parse(row.state_json) as JsonObject;
  const mainLevel = getBuildingLvFromState(currentState, 'hq');
  const allianceCenterLevel = getBuildingLvFromState(currentState, 'alliance_center');

  if (mainLevel < quest.minHqRequired) {
    return {
      ok: false,
      status: 403,
      error: `استلام جوائز المهام المشتركة يتطلب المبنى الرئيسي مستوى ${quest.minHqRequired}.`,
    };
  }
  if (quest.requiresAllianceCenter && allianceCenterLevel < 1) {
    return {
      ok: false,
      status: 403,
      error: 'يجب تشييد مبنى «مركز التحالف» أولًا قبل استلام مكافآت المهام المشتركة.',
    };
  }

  const prevClaims = asObject(currentState.coopQuestClaims) ?? {};
  if (prevClaims[quest.id]) {
    return {
      ok: false,
      status: 409,
      error: 'تم استلام مكافأة هذه المهمة المشتركة مسبقًا.',
    };
  }

  const serverId = String(
    currentState.selectedServerId ?? player.selected_server_id ?? 'srv-1'
  );
  const summary = await computeServerCoopMetrics(db, serverId);
  const metricVal = summary.metrics[quest.metricKey]?.value ?? 0;
  if (metricVal < quest.targetValue) {
    return {
      ok: false,
      status: 400,
      error: `لم يكتمل الهدف الجماعي للسيرفر بعد (${metricVal} / ${quest.targetValue}).`,
    };
  }

  const prevResources = asObject(currentState.resources) ?? {};
  const nextResources: JsonObject = {
    wheat: clampNonNegativeFinite(prevResources.wheat, 0) + quest.rewards.wheat,
    wood: clampNonNegativeFinite(prevResources.wood, 0) + quest.rewards.wood,
    iron: clampNonNegativeFinite(prevResources.iron, 0) + quest.rewards.iron,
  };

  const prevLedger = asObject(currentState.ledger) ?? {};
  const nextLedger: JsonObject = {
    ...prevLedger,
    achievementPoints:
      clampNonNegativeFinite(prevLedger.achievementPoints, 0) +
      quest.rewards.achievementPoints,
  };

  const prevCards = asObject(currentState.speedUpCards) ?? {};
  const nextCards: JsonObject = { ...prevCards };
  if (quest.rewards.speedUp) {
    const tier = quest.rewards.speedUp.tier;
    nextCards[tier] =
      clampNonNegativeFinite(prevCards[tier], 0) + quest.rewards.speedUp.count;
  }

  const prevReports = asArray(currentState.reports);
  const claimReport: JsonObject = {
    id: generateId('rep'),
    category: 'bot',
    title: `مكافأة المهمة المشتركة: ${quest.title}`,
    summary: `اكتمل الهدف الجماعي على السيرفر (${quest.targetValue} ${quest.unitLabel}) وتم صرف حصتك من المكافأة.`,
    details: [
      `+${quest.rewards.wheat} قمح، +${quest.rewards.wood} خشب، +${quest.rewards.iron} حديد`,
      `+${quest.rewards.achievementPoints} نقطة إنجاز${quest.rewards.speedUp ? ` + ${quest.rewards.speedUp.count} بطاقة تسريع (${quest.rewards.speedUp.tier})` : ''}`,
    ],
    createdAt: params.now,
    read: false,
  };

  const nextState: JsonObject = {
    ...currentState,
    accountId: params.accountId,
    adminConfig,
    resources: nextResources,
    ledger: nextLedger,
    speedUpCards: nextCards,
    coopQuestClaims: { ...prevClaims, [quest.id]: true },
    reports: [claimReport, ...prevReports].slice(0, 80),
  };

  const updateRes = await db
    .prepare(
      `UPDATE player_states
       SET state_json = ?, revision = revision + 1, updated_at = ?
       WHERE account_id = ? AND revision = ?`
    )
    .bind(JSON.stringify(nextState), params.now, params.accountId, row.revision)
    .run();

  if (!updateRes.meta || updateRes.meta.changes !== 1) {
    return {
      ok: false,
      status: 409,
      error: 'تحديث متزامن للبيانات، يرجى إعادة المحاولة.',
    };
  }

  const built = buildCoopQuestStatuses(summary, nextState);
  return {
    ok: true,
    questId: quest.id,
    state: nextState,
    revision: row.revision + 1,
    quests: built.quests,
  };
}

