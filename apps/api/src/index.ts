import {
  hashPassword,
  normalizeEmail,
  normalizePhone,
  validatePassword,
  verifyPassword,
} from './auth';
import {
  AdminRoleType,
  adminResetPlayerPassword,
  adminSavePlayerState,
  claimPlayerCoopQuest,
  createAdminBackup,
  createPlayerAccount,
  createServerBackup,
  createSession,
  deleteAdminBackup,
  deleteEmailCodeById,
  ensurePlatformConfig,
  findPlayerByEmail,
  findPlayerById,
  findPlayerByIdentifier,
  getAdminCredentialsStatus,
  getPlayerCoopQuestsStatus,
  getPlayerStateWithConfig,
  issueEmailCode,
  listAdminBackups,
  listPlayersForAdmin,
  migrateLocalStateSafely,
  resetPlayerCitySafely,
  resolveSessionByToken,
  restoreServerBackupSafely,
  revokeSessionByToken,
  savePlayerStateSafely,
  setAdminRoleCredential,
  submitPlayerPaymentOrderSafely,
  updatePlatformConfig,
  verifyAdminRolePassword,
  verifyAndConsumeEmailCode,
} from './db';
import { JsonObject } from './defaults';
import { EmailEnv, sendOtpEmail } from './email';

export interface Env extends EmailEnv {
  DB?: D1Database;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_FOUNDER_PASSWORD?: string;
  ADMIN_PARTNER_PASSWORD?: string;
  ADMIN_SUPPORT_PASSWORD?: string;
}

const API_VERSION = 2;
const PROJECT_NAME = 'ENGINORA CITY';

let receiptsTableReady = false;
async function ensureReceiptsTable(db: D1Database): Promise<void> {
  if (receiptsTableReady) return;
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, mime TEXT NOT NULL, data_base64 TEXT NOT NULL, created_at INTEGER NOT NULL)'
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_receipts_account ON receipts(account_id)'
    ),
  ]);
  receiptsTableReady = true;
}

function parseAllowedOrigins(raw?: string): Set<string> {
  const origins = new Set<string>();
  if (!raw) return origins;
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        origins.add(parsed.origin);
      }
    } catch {
      // Ignore malformed origin entries safely
    }
  }
  return origins;
}

function buildCorsHeaders(
  request: Request,
  allowedOrigins: Set<string>
): { headers: Record<string, string>; originAllowed: boolean } {
  const requestOrigin = request.headers.get('Origin');
  if (!requestOrigin) {
    return { headers: {}, originAllowed: true };
  }

  let normalizedOrigin: string | null = null;
  try {
    normalizedOrigin = new URL(requestOrigin).origin;
  } catch {
    return { headers: {}, originAllowed: false };
  }

  if (!allowedOrigins.has(normalizedOrigin)) {
    return { headers: {}, originAllowed: false };
  }

  return {
    originAllowed: true,
    headers: {
      'Access-Control-Allow-Origin': normalizedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    },
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+([A-Za-z0-9._-]+)$/i);
  return match ? match[1] : null;
}

async function readJsonBody(request: Request): Promise<JsonObject | null> {
  try {
    const raw = await request.text();
    if (!raw) return {};
    if (raw.length > 1_800_000) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as JsonObject;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const { headers: corsHeaders, originAllowed } = buildCorsHeaders(
      request,
      allowedOrigins
    );

    if (request.method === 'OPTIONS') {
      if (!originAllowed) {
        return jsonResponse(
          {
            ok: false,
            error: 'Forbidden',
            message: 'المصدر غير مصرح له بالوصول إلى واجهة البرمجة.',
          },
          403,
          {}
        );
      }
      return new Response(null, {
        status: 204,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          ...corsHeaders,
        },
      });
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    const now = Date.now();

    if (path === '/api/health') {
      if (request.method !== 'GET') {
        return jsonResponse(
          { ok: false, error: 'Method Not Allowed', message: 'طريقة HTTP غير مدعومة.' },
          405,
          corsHeaders,
          { Allow: 'GET, OPTIONS' }
        );
      }
      return jsonResponse(
        {
          ok: true,
          project: PROJECT_NAME,
          service: 'api',
          status: 'ok',
          version: API_VERSION,
          timestamp: new Date(now).toISOString(),
        },
        200,
        corsHeaders
      );
    }

    if (!env.DB) {
      return jsonResponse(
        {
          ok: false,
          project: PROJECT_NAME,
          status: 'error',
          database: 'unavailable',
          message: 'تعذر التحقق من اتصال قاعدة البيانات حاليًا.',
        },
        503,
        corsHeaders
      );
    }

    if (path === '/api/db-check') {
      if (request.method !== 'GET') {
        return jsonResponse(
          { ok: false, error: 'Method Not Allowed', message: 'طريقة HTTP غير مدعومة.' },
          405,
          corsHeaders,
          { Allow: 'GET, OPTIONS' }
        );
      }
      try {
        const row = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
        if (row && row.ok === 1) {
          return jsonResponse(
            {
              ok: true,
              project: PROJECT_NAME,
              status: 'ok',
              database: 'connected',
              version: API_VERSION,
            },
            200,
            corsHeaders
          );
        }
      } catch {
        // fall through to generic 503
      }
      return jsonResponse(
        {
          ok: false,
          project: PROJECT_NAME,
          status: 'error',
          database: 'disconnected',
          message: 'تعذر التحقق من اتصال قاعدة البيانات حاليًا.',
        },
        503,
        corsHeaders
      );
    }

    try {
      // GET /api/game/config — shared platform config & servers status
      if (path === '/api/game/config') {
        if (request.method !== 'GET') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'GET, OPTIONS' }
          );
        }
        const adminConfig = await ensurePlatformConfig(env.DB, now);
        return jsonResponse(
          {
            ok: true,
            adminConfig,
            servers: adminConfig.servers ?? [],
            serverTimeUtc: now,
          },
          200,
          corsHeaders
        );
      }

      // POST /api/auth/register
      if (path === '/api/auth/register') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const body = await readJsonBody(request);
        if (!body) {
          return jsonResponse(
            { ok: false, error: 'بيانات الطلب غير صالحة.' },
            400,
            corsHeaders
          );
        }

        const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
        const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const email = rawEmail ? normalizeEmail(rawEmail) : null;
        const phone = rawPhone ? normalizePhone(rawPhone) : null;

        if (rawEmail && !email) {
          return jsonResponse(
            { ok: false, error: 'صيغة البريد الإلكتروني غير صالحة.' },
            400,
            corsHeaders
          );
        }
        if (rawPhone && !phone) {
          return jsonResponse(
            { ok: false, error: 'صيغة رقم الجوال غير صالحة.' },
            400,
            corsHeaders
          );
        }
        if (!email && !phone) {
          return jsonResponse(
            { ok: false, error: 'يرجى إدخال البريد الإلكتروني أو رقم الجوال على الأقل.' },
            400,
            corsHeaders
          );
        }

        const pwCheck = validatePassword(body.password);
        if (!pwCheck.valid) {
          return jsonResponse(
            { ok: false, error: pwCheck.error },
            400,
            corsHeaders
          );
        }

        const adminConfig = await ensurePlatformConfig(env.DB, now);
        const servers = Array.isArray(adminConfig.servers)
          ? (adminConfig.servers as JsonObject[])
          : [];
        const requestedServerId =
          typeof body.serverId === 'string' && body.serverId.trim()
            ? body.serverId.trim()
            : String(servers[0]?.id ?? 'srv-1');
        const commanderName =
          typeof body.commanderName === 'string' && body.commanderName.trim().length >= 2
            ? body.commanderName.trim().slice(0, 40)
            : typeof body.nickname === 'string' && body.nickname.trim().length >= 2
              ? body.nickname.trim().slice(0, 40)
              : 'القائد سيف';

        const registrationPayload =
          body.registration && typeof body.registration === 'object' && !Array.isArray(body.registration)
            ? (body.registration as JsonObject)
            : undefined;
        const paymentOrders = Array.isArray(body.paymentOrders)
          ? (body.paymentOrders as JsonObject[]).map((o) => ({
              ...o,
              status: 'pending',
            }))
          : undefined;

        const { hashHex, saltHex } = await hashPassword(String(body.password));
        const created = await createPlayerAccount(env.DB, {
          email,
          phone,
          passwordHash: hashHex,
          passwordSalt: saltHex,
          commanderName,
          serverId: requestedServerId,
          adminConfig,
          now,
          registration: registrationPayload,
          paymentOrders,
        });

        if (!created.ok) {
          return jsonResponse(
            { ok: false, error: created.error },
            created.status,
            corsHeaders
          );
        }

        // Immediate session on registration (no Resend email verification gate; Founder reviews account/password manually)
        const session = await createSession(env.DB, {
          subjectType: 'player',
          accountId: created.player.account_id,
          adminRole: null,
          now,
        });

        return jsonResponse(
          {
            ok: true,
            token: session.token,
            expiresAt: session.expiresAt,
            accountId: created.player.account_id,
            email: created.player.email,
            phone: created.player.phone,
            emailVerified: created.player.email_verified === 1,
            requiresEmailVerification: false,
            state: created.state,
            revision: created.revision,
            adminConfig,
            serverTimeUtc: now,
          },
          201,
          corsHeaders
        );
      }

      // POST /api/auth/resend-verification
      if (path === '/api/auth/resend-verification') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const body = await readJsonBody(request);
        const email = normalizeEmail(body?.email);
        if (!email) {
          return jsonResponse(
            { ok: false, error: 'يرجى إدخال بريد إلكتروني صالح.' },
            400,
            corsHeaders
          );
        }

        const player = await findPlayerByEmail(env.DB, email);
        if (!player) {
          return jsonResponse(
            { ok: false, error: 'لا يوجد حساب مسجل بهذا البريد الإلكتروني.' },
            404,
            corsHeaders
          );
        }
        if (player.email_verified === 1) {
          return jsonResponse(
            { ok: true, alreadyVerified: true, message: 'البريد الإلكتروني مؤكد بالفعل.' },
            200,
            corsHeaders
          );
        }

        const otpResult = await issueEmailCode(env.DB, {
          accountId: player.account_id,
          email,
          purpose: 'verify_email',
          now,
        });
        if (!otpResult.ok) {
          return jsonResponse(
            { ok: false, emailSent: false, error: otpResult.error },
            otpResult.status,
            corsHeaders
          );
        }

        const mailRes = await sendOtpEmail(env, {
          to: email,
          purpose: 'verify_email',
          code: otpResult.code,
          commanderName: player.commander_name,
        });
        if (!mailRes.sent) {
          await deleteEmailCodeById(env.DB, otpResult.codeId);
          return jsonResponse(
            { ok: false, emailSent: false, error: mailRes.error },
            mailRes.status,
            corsHeaders
          );
        }

        return jsonResponse(
          {
            ok: true,
            emailSent: true,
            message: 'تم إرسال كود تأكيد جديد إلى بريدك الإلكتروني.',
            serverTimeUtc: now,
          },
          200,
          corsHeaders
        );
      }

      // POST /api/auth/verify-email
      if (path === '/api/auth/verify-email') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const body = await readJsonBody(request);
        const email = normalizeEmail(body?.email);
        const code = typeof body?.code === 'string' ? body.code : '';
        if (!email) {
          return jsonResponse(
            { ok: false, error: 'يرجى إدخال بريد إلكتروني صالح.' },
            400,
            corsHeaders
          );
        }

        const consumed = await verifyAndConsumeEmailCode(env.DB, {
          email,
          purpose: 'verify_email',
          code,
          now,
        });
        if (!consumed.ok) {
          return jsonResponse(
            { ok: false, error: consumed.error },
            consumed.status,
            corsHeaders
          );
        }

        // Ensure another account didn't claim this email meanwhile
        const existingOwner = await findPlayerByEmail(env.DB, email);
        if (existingOwner && existingOwner.account_id !== consumed.accountId) {
          return jsonResponse(
            { ok: false, error: 'هذا البريد الإلكتروني مستخدم بالفعل لحساب آخر.' },
            409,
            corsHeaders
          );
        }

        await env.DB.prepare(
          `UPDATE players
           SET email = ?, email_verified = 1, email_verified_at = ?, updated_at = ?
           WHERE account_id = ?`
        )
          .bind(email, now, now, consumed.accountId)
          .run();

        const loaded = await getPlayerStateWithConfig(env.DB, consumed.accountId, now);
        const player = await findPlayerById(env.DB, consumed.accountId);
        const session = await createSession(env.DB, {
          subjectType: 'player',
          accountId: consumed.accountId,
          adminRole: null,
          now,
        });

        return jsonResponse(
          {
            ok: true,
            verified: true,
            token: session.token,
            expiresAt: session.expiresAt,
            accountId: consumed.accountId,
            email,
            phone: player?.phone ?? null,
            emailVerified: true,
            state: loaded?.state ?? null,
            revision: loaded?.revision ?? 1,
            adminConfig: loaded?.adminConfig ?? null,
            serverTimeUtc: now,
          },
          200,
          corsHeaders
        );
      }

      // POST /api/auth/login
      if (path === '/api/auth/login') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const body = await readJsonBody(request);
        const rawIdentifier =
          typeof body?.identifier === 'string' ? body.identifier.trim() : '';
        const password = typeof body?.password === 'string' ? body.password : '';

        if (!rawIdentifier || !password) {
          return jsonResponse(
            { ok: false, error: 'أدخل البريد الإلكتروني أو رقم الجوال أو معرّف الحساب وكلمة المرور.' },
            400,
            corsHeaders
          );
        }

        const player = await findPlayerByIdentifier(
          env.DB,
          rawIdentifier,
          normalizeEmail,
          normalizePhone
        );

        if (!player) {
          return jsonResponse(
            { ok: false, error: 'بيانات الدخول غير صحيحة.' },
            401,
            corsHeaders
          );
        }

        const pwOk = await verifyPassword(
          password,
          player.password_hash,
          player.password_salt
        );
        if (!pwOk) {
          return jsonResponse(
            { ok: false, error: 'بيانات الدخول غير صحيحة.' },
            401,
            corsHeaders
          );
        }

        const loaded = await getPlayerStateWithConfig(env.DB, player.account_id, now);
        if (!loaded) {
          return jsonResponse(
            { ok: false, error: 'تعذر تحميل بيانات المدينة لهذا الحساب.' },
            500,
            corsHeaders
          );
        }

        const session = await createSession(env.DB, {
          subjectType: 'player',
          accountId: player.account_id,
          adminRole: null,
          now,
        });

        return jsonResponse(
          {
            ok: true,
            token: session.token,
            expiresAt: session.expiresAt,
            accountId: player.account_id,
            email: player.email,
            phone: player.phone,
            emailVerified: player.email_verified === 1,
            state: loaded.state,
            revision: loaded.revision,
            adminConfig: loaded.adminConfig,
            serverTimeUtc: now,
          },
          200,
          corsHeaders
        );
      }

      // POST /api/auth/forgot-password
      if (path === '/api/auth/forgot-password') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        return jsonResponse(
          {
            ok: false,
            manualAdminReset: true,
            message:
              'استعادة كلمة المرور تتم يدويًا عبر التواصل مع الإدارة من لوحة الإدارة لإعادة تعيين كلمة المرور.',
            error:
              'تواصل مع الإدارة لتعديل كلمة المرور يدويًا من لوحة الإدارة.',
          },
          200,
          corsHeaders
        );
      }

      // POST /api/auth/reset-password
      if (path === '/api/auth/reset-password') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const body = await readJsonBody(request);
        const email = normalizeEmail(body?.email);
        const code = typeof body?.code === 'string' ? body.code : '';
        const newPassword =
          typeof body?.newPassword === 'string' ? body.newPassword : '';

        if (!email) {
          return jsonResponse(
            { ok: false, error: 'أدخل بريدًا إلكترونيًا صالحًا.' },
            400,
            corsHeaders
          );
        }
        const pwCheck = validatePassword(newPassword);
        if (!pwCheck.valid) {
          return jsonResponse(
            { ok: false, error: pwCheck.error },
            400,
            corsHeaders
          );
        }

        const player = await findPlayerByEmail(env.DB, email);
        if (!player || player.email_verified !== 1) {
          return jsonResponse(
            { ok: false, error: 'الكود غير صالح أو البريد غير مؤكد.' },
            400,
            corsHeaders
          );
        }

        const consumed = await verifyAndConsumeEmailCode(env.DB, {
          email,
          purpose: 'reset_password',
          code,
          now,
        });
        if (!consumed.ok) {
          return jsonResponse(
            { ok: false, error: consumed.error },
            consumed.status,
            corsHeaders
          );
        }

        const { hashHex, saltHex } = await hashPassword(newPassword);
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE players
             SET password_hash = ?, password_salt = ?, updated_at = ?
             WHERE account_id = ?`
          ).bind(hashHex, saltHex, now, consumed.accountId),
          // Invalidate all existing sessions for security after password reset
          env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(
            consumed.accountId
          ),
        ]);

        return jsonResponse(
          {
            ok: true,
            message: 'تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
          },
          200,
          corsHeaders
        );
      }

      // POST /api/auth/logout
      if (path === '/api/auth/logout') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const token = extractBearerToken(request);
        if (token) {
          await revokeSessionByToken(env.DB, token);
        }
        return jsonResponse({ ok: true }, 200, corsHeaders);
      }

      // POST /api/auth/email/add — phone-registered players can attach & verify an email
      if (path === '/api/auth/email/add') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const token = extractBearerToken(request);
        const session = token
          ? await resolveSessionByToken(env.DB, token, now)
          : null;
        if (!session || session.subjectType !== 'player' || !session.player) {
          return jsonResponse(
            { ok: false, error: 'يلزم تسجيل الدخول أولًا.' },
            401,
            corsHeaders
          );
        }

        const body = await readJsonBody(request);
        const email = normalizeEmail(body?.email);
        if (!email) {
          return jsonResponse(
            { ok: false, error: 'صيغة البريد الإلكتروني غير صالحة.' },
            400,
            corsHeaders
          );
        }

        const existingOwner = await findPlayerByEmail(env.DB, email);
        if (existingOwner && existingOwner.account_id !== session.player.account_id) {
          return jsonResponse(
            { ok: false, error: 'هذا البريد الإلكتروني مستخدم بالفعل لحساب آخر.' },
            409,
            corsHeaders
          );
        }

        const otpResult = await issueEmailCode(env.DB, {
          accountId: session.player.account_id,
          email,
          purpose: 'verify_email',
          now,
        });
        if (!otpResult.ok) {
          return jsonResponse(
            { ok: false, emailSent: false, error: otpResult.error },
            otpResult.status,
            corsHeaders
          );
        }

        const mailRes = await sendOtpEmail(env, {
          to: email,
          purpose: 'verify_email',
          code: otpResult.code,
          commanderName: session.player.commander_name,
        });
        if (!mailRes.sent) {
          await deleteEmailCodeById(env.DB, otpResult.codeId);
          return jsonResponse(
            { ok: false, emailSent: false, error: mailRes.error },
            mailRes.status,
            corsHeaders
          );
        }

        return jsonResponse(
          {
            ok: true,
            emailSent: true,
            email,
            message: 'تم إرسال كود التأكيد إلى البريد الإلكتروني. أدخله لإكمال الربط.',
            serverTimeUtc: now,
          },
          200,
          corsHeaders
        );
      }

      // Payment receipts stored as dedicated binary images (/api/receipts)
      if (path === '/api/receipts' || path.startsWith('/api/receipts/')) {
        const rToken = extractBearerToken(request);
        const rSession = rToken
          ? await resolveSessionByToken(env.DB, rToken, now)
          : null;
        if (!rSession) {
          return jsonResponse(
            { ok: false, error: 'يلزم تسجيل الدخول.' },
            401,
            corsHeaders
          );
        }
        await ensureReceiptsTable(env.DB);

        if (path === '/api/receipts') {
          if (request.method !== 'POST') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'POST, OPTIONS' }
            );
          }
          if (rSession.subjectType !== 'player' || !rSession.accountId) {
            return jsonResponse(
              { ok: false, error: 'رفع الفواتير متاح للاعبين فقط.' },
              403,
              corsHeaders
            );
          }
          const rBody = await readJsonBody(request);
          const rId = typeof rBody?.id === 'string' ? rBody.id : '';
          const rDataUrl = typeof rBody?.dataUrl === 'string' ? rBody.dataUrl : '';
          const rMatch = rDataUrl.match(
            /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/
          );
          if (!/^rcp-[a-f0-9]{16}$/.test(rId) || !rMatch) {
            return jsonResponse(
              { ok: false, error: 'صورة الفاتورة غير صالحة.' },
              400,
              corsHeaders
            );
          }
          if (rMatch[2].length > 600_000) {
            return jsonResponse(
              { ok: false, error: 'صورة الفاتورة كبيرة جدًا.' },
              413,
              corsHeaders
            );
          }
          const rExisting = await env.DB
            .prepare('SELECT account_id FROM receipts WHERE id = ?')
            .bind(rId)
            .first<{ account_id: string }>();
          if (rExisting && rExisting.account_id !== rSession.accountId) {
            return jsonResponse(
              { ok: false, error: 'معرّف الفاتورة مستخدم.' },
              409,
              corsHeaders
            );
          }
          if (!rExisting) {
            const rCount = await env.DB
              .prepare('SELECT COUNT(*) AS c FROM receipts WHERE account_id = ?')
              .bind(rSession.accountId)
              .first<{ c: number }>();
            if ((rCount?.c ?? 0) >= 30) {
              return jsonResponse(
                { ok: false, error: 'تم الوصول إلى الحد الأقصى لعدد الفواتير.' },
                429,
                corsHeaders
              );
            }
          }
          await env.DB
            .prepare(
              'INSERT OR REPLACE INTO receipts (id, account_id, mime, data_base64, created_at) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(rId, rSession.accountId, rMatch[1], rMatch[2], now)
            .run();
          return jsonResponse({ ok: true, id: rId }, 200, corsHeaders);
        }

        const receiptId = decodeURIComponent(path.slice('/api/receipts/'.length));
        if (request.method !== 'GET') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'GET, OPTIONS' }
          );
        }
        if (!/^rcp-[a-f0-9]{16}$/.test(receiptId)) {
          return jsonResponse(
            { ok: false, error: 'معرّف الفاتورة غير صالح.' },
            400,
            corsHeaders
          );
        }
        if (rSession.subjectType === 'admin' && rSession.adminRole === 'support') {
          return jsonResponse(
            { ok: false, error: 'صلاحية الدعم الفني لا تسمح بعرض الفواتير المالية.' },
            403,
            corsHeaders
          );
        }
        const rRow = await env.DB
          .prepare('SELECT account_id, mime, data_base64 FROM receipts WHERE id = ?')
          .bind(receiptId)
          .first<{ account_id: string; mime: string; data_base64: string }>();
        if (!rRow) {
          return jsonResponse(
            { ok: false, error: 'الفاتورة غير موجودة.' },
            404,
            corsHeaders
          );
        }
        if (rSession.subjectType === 'player' && rSession.accountId !== rRow.account_id) {
          return jsonResponse(
            { ok: false, error: 'غير مصرح.' },
            403,
            corsHeaders
          );
        }
        const rBinary = atob(rRow.data_base64);
        const rBytes = new Uint8Array(rBinary.length);
        for (let i = 0; i < rBinary.length; i++) rBytes[i] = rBinary.charCodeAt(i);
        return new Response(rBytes, {
          status: 200,
          headers: {
            'Content-Type': rRow.mime,
            'Cache-Control': 'private, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
            ...corsHeaders,
          },
        });
      }

      // Authenticated Player Game Routes (/api/game/*)
      if (
        path === '/api/game/state' ||
        path === '/api/game/payment-orders' ||
        path === '/api/game/migrate-local' ||
        path === '/api/game/reset' ||
        path === '/api/game/coop-quests' ||
        path === '/api/game/coop-quests/claim'
      ) {
        const token = extractBearerToken(request);
        const session = token
          ? await resolveSessionByToken(env.DB, token, now)
          : null;
        if (!session || session.subjectType !== 'player' || !session.player || !session.accountId) {
          return jsonResponse(
            { ok: false, error: 'جلسة الدخول غير صالحة أو منتهية.' },
            401,
            corsHeaders
          );
        }

        if (path === '/api/game/state') {
          if (request.method === 'GET') {
            const loaded = await getPlayerStateWithConfig(
              env.DB,
              session.accountId,
              now
            );
            if (!loaded) {
              return jsonResponse(
                { ok: false, error: 'بيانات المدينة غير موجودة.' },
                404,
                corsHeaders
              );
            }
            return jsonResponse(
              {
                ok: true,
                accountId: session.accountId,
                email: session.player.email,
                phone: session.player.phone,
                emailVerified: session.player.email_verified === 1,
                state: loaded.state,
                revision: loaded.revision,
                adminConfig: loaded.adminConfig,
                serverTimeUtc: now,
              },
              200,
              corsHeaders
            );
          }

          if (request.method === 'PUT') {
            const body = await readJsonBody(request);
            if (
              !body ||
              !body.state ||
              typeof body.state !== 'object' ||
              Array.isArray(body.state) ||
              typeof body.expectedRevision !== 'number'
            ) {
              return jsonResponse(
                { ok: false, error: 'صيغة طلب حفظ الحالة غير صالحة.' },
                400,
                corsHeaders
              );
            }

            const saved = await savePlayerStateSafely(env.DB, {
              accountId: session.accountId,
              clientState: body.state as JsonObject,
              expectedRevision: body.expectedRevision,
              now,
            });

            if (!saved.ok) {
              if (saved.conflict) {
                return jsonResponse(
                  {
                    ok: false,
                    code: 'REVISION_CONFLICT',
                    error: 'توجد نسخة أحدث على الخادم.',
                    serverRevision: saved.serverRevision,
                    state: saved.state,
                    adminConfig: saved.adminConfig,
                    serverTimeUtc: now,
                  },
                  409,
                  corsHeaders
                );
              }
              return jsonResponse(
                { ok: false, error: saved.error },
                saved.status,
                corsHeaders
              );
            }

            return jsonResponse(
              {
                ok: true,
                revision: saved.revision,
                state: saved.state,
                adminConfig: saved.adminConfig,
                serverTimeUtc: now,
              },
              200,
              corsHeaders
            );
          }

          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'GET, PUT, OPTIONS' }
          );
        }

        if (path === '/api/game/payment-orders') {
          if (request.method !== 'POST') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'POST, OPTIONS' }
            );
          }
          const body = await readJsonBody(request);
          const productType = body?.productType;
          const paymentMethod = body?.paymentMethod;
          const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';

          if (
            (productType !== 'gem_package' &&
              productType !== 'hakim_sub' &&
              productType !== 'vip_sub' &&
              productType !== 'registration_fee') ||
            (paymentMethod !== 'apple_pay' &&
              paymentMethod !== 'mada' &&
              paymentMethod !== 'bank_transfer' &&
              paymentMethod !== 'binance') ||
            !productId
          ) {
            return jsonResponse(
              { ok: false, error: 'بيانات طلب الدفع غير صالحة أو غير مكتملة.' },
              400,
              corsHeaders
            );
          }

          const orderRes = await submitPlayerPaymentOrderSafely(env.DB, {
            accountId: session.accountId,
            productType,
            productId,
            paymentMethod,
            transferRef: typeof body?.transferRef === 'string' ? body.transferRef : undefined,
            receiptName: typeof body?.receiptName === 'string' ? body.receiptName : undefined,
            receiptId: typeof body?.receiptId === 'string' ? body.receiptId : undefined,
            now,
          });
          if (!orderRes.ok) {
            return jsonResponse(
              { ok: false, error: orderRes.error },
              orderRes.status,
              corsHeaders
            );
          }
          return jsonResponse(
            {
              ok: true,
              order: orderRes.order,
              revision: orderRes.revision,
              state: orderRes.state,
              adminConfig: orderRes.adminConfig,
              serverTimeUtc: now,
            },
            201,
            corsHeaders
          );
        }

        if (path === '/api/game/migrate-local') {
          if (request.method !== 'POST') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'POST, OPTIONS' }
            );
          }
          const body = await readJsonBody(request);
          if (
            !body ||
            !body.localState ||
            typeof body.localState !== 'object' ||
            Array.isArray(body.localState)
          ) {
            return jsonResponse(
              { ok: false, error: 'بيانات الحفظ المحلي مفقودة أو غير صالحة.' },
              400,
              corsHeaders
            );
          }

          const res = await migrateLocalStateSafely(env.DB, {
            accountId: session.accountId,
            localState: body.localState as JsonObject,
            now,
          });
          if (!res.ok) {
            return jsonResponse(
              { ok: false, error: res.error },
              res.status,
              corsHeaders
            );
          }

          return jsonResponse(
            {
              ok: true,
              migrated: res.migrated,
              reason: res.reason,
              revision: res.revision,
              state: res.state,
              adminConfig: res.adminConfig,
              serverTimeUtc: now,
            },
            200,
            corsHeaders
          );
        }

        if (path === '/api/game/reset') {
          if (request.method !== 'POST') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'POST, OPTIONS' }
            );
          }
          const res = await resetPlayerCitySafely(env.DB, {
            accountId: session.accountId,
            now,
          });
          if (!res) {
            return jsonResponse(
              { ok: false, error: 'تعذر إعادة ضبط المدينة.' },
              404,
              corsHeaders
            );
          }
          return jsonResponse(
            {
              ok: true,
              revision: res.revision,
              state: res.state,
              adminConfig: res.adminConfig,
              serverTimeUtc: now,
            },
            200,
            corsHeaders
          );
        }

        if (path === '/api/game/coop-quests') {
          if (request.method !== 'GET') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'GET, OPTIONS' }
            );
          }
          const res = await getPlayerCoopQuestsStatus(env.DB, session.accountId, now);
          if (!res.ok) {
            return jsonResponse(
              { ok: false, error: res.error },
              res.status,
              corsHeaders
            );
          }
          return jsonResponse(
            {
              ok: true,
              serverId: res.serverId,
              serverName: res.serverName,
              serverPlayersCount: res.serverPlayersCount,
              eligibleForCoop: res.eligibleForCoop,
              mainLevel: res.mainLevel,
              allianceCenterLevel: res.allianceCenterLevel,
              quests: res.quests,
              serverTimeUtc: now,
            },
            200,
            corsHeaders
          );
        }

        if (path === '/api/game/coop-quests/claim') {
          if (request.method !== 'POST') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'POST, OPTIONS' }
            );
          }
          const body = await readJsonBody(request);
          const questId = typeof body?.questId === 'string' ? body.questId.trim() : '';
          if (!questId) {
            return jsonResponse(
              { ok: false, error: 'معرّف المهمة المشتركة مطلوب.' },
              400,
              corsHeaders
            );
          }
          const res = await claimPlayerCoopQuest(env.DB, {
            accountId: session.accountId,
            questId,
            now,
          });
          if (!res.ok) {
            return jsonResponse(
              { ok: false, error: res.error },
              res.status,
              corsHeaders
            );
          }
          return jsonResponse(
            {
              ok: true,
              questId: res.questId,
              state: res.state,
              revision: res.revision,
              quests: res.quests,
              serverTimeUtc: now,
            },
            200,
            corsHeaders
          );
        }
      }

      // Admin Authentication & Operations (/api/admin/*)
      if (path === '/api/admin/login') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const body = await readJsonBody(request);
        const inputPassword =
          typeof body?.password === 'string' ? body.password : '';
        const role: AdminRoleType =
          body?.role === 'partner' || body?.role === 'support'
            ? body.role
            : 'founder';

        if (!inputPassword) {
          return jsonResponse(
            { ok: false, error: 'يرجى إدخال كلمة المرور الخاصة بهذه الصلاحية.' },
            400,
            corsHeaders
          );
        }

        const check = await verifyAdminRolePassword(env.DB, {
          role,
          password: inputPassword,
          envSecrets: env,
        });
        if (!check.ok) {
          return jsonResponse(
            { ok: false, error: check.error },
            check.status,
            corsHeaders
          );
        }

        const session = await createSession(env.DB, {
          subjectType: 'admin',
          accountId: null,
          adminRole: role,
          now,
        });
        return jsonResponse(
          {
            ok: true,
            token: session.token,
            role,
            expiresAt: session.expiresAt,
            serverTimeUtc: now,
          },
          200,
          corsHeaders
        );
      }

      if (path === '/api/admin/logout') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'POST, OPTIONS' }
          );
        }
        const token = extractBearerToken(request);
        if (token) {
          await revokeSessionByToken(env.DB, token);
        }
        return jsonResponse({ ok: true }, 200, corsHeaders);
      }

      if (
        path === '/api/admin/overview' ||
        path === '/api/admin/config' ||
        path === '/api/admin/credentials' ||
        path === '/api/admin/backups' ||
        path === '/api/admin/backups/restore' ||
        path.startsWith('/api/admin/backups/') ||
        path.startsWith('/api/admin/players/')
      ) {
        const token = extractBearerToken(request);
        const session = token
          ? await resolveSessionByToken(env.DB, token, now)
          : null;
        if (!session || session.subjectType !== 'admin') {
          return jsonResponse(
            { ok: false, error: 'صلاحية الإدارة مطلوبة. يرجى تسجيل الدخول.' },
            401,
            corsHeaders
          );
        }
        const role = session.adminRole ?? 'founder';

        if (path === '/api/admin/overview') {
          if (request.method !== 'GET') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'GET, OPTIONS' }
            );
          }
          const data = await listPlayersForAdmin(env.DB, now, role);
          const backups =
            role === 'founder' ? await listAdminBackups(env.DB) : undefined;
          return jsonResponse(
            {
              ok: true,
              role,
              adminConfig: data.adminConfig,
              players: data.players,
              ...(backups ? { backups } : {}),
              serverTimeUtc: now,
            },
            200,
            corsHeaders
          );
        }

        if (path === '/api/admin/config') {
          if (request.method !== 'PUT') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'PUT, OPTIONS' }
            );
          }
          if (role !== 'founder') {
            return jsonResponse(
              { ok: false, error: 'تعديل الإعدادات العامة حصري للمؤسس.' },
              403,
              corsHeaders
            );
          }
          const body = await readJsonBody(request);
          if (
            !body ||
            !body.adminConfig ||
            typeof body.adminConfig !== 'object' ||
            Array.isArray(body.adminConfig)
          ) {
            return jsonResponse(
              { ok: false, error: 'بيانات الإعدادات غير صالحة.' },
              400,
              corsHeaders
            );
          }
          const updated = await updatePlatformConfig(
            env.DB,
            body.adminConfig as JsonObject,
            now
          );
          return jsonResponse(
            { ok: true, adminConfig: updated, serverTimeUtc: now },
            200,
            corsHeaders
          );
        }

        if (path === '/api/admin/credentials') {
          if (role !== 'founder') {
            return jsonResponse(
              { ok: false, error: 'إدارة كلمات مرور الصلاحيات حصرية للمؤسس (Founder) فقط.' },
              403,
              corsHeaders
            );
          }
          if (request.method === 'GET') {
            const credentials = await getAdminCredentialsStatus(env.DB, env);
            return jsonResponse(
              { ok: true, credentials, serverTimeUtc: now },
              200,
              corsHeaders
            );
          }
          if (request.method === 'POST') {
            const body = await readJsonBody(request);
            const targetRole =
              body?.role === 'founder' ||
              body?.role === 'partner' ||
              body?.role === 'support'
                ? body.role
                : null;
            if (!targetRole) {
              return jsonResponse(
                { ok: false, error: 'يرجى تحديد الصلاحية المطلوبة (founder / partner / support).' },
                400,
                corsHeaders
              );
            }
            const resetToEnv = Boolean(body?.resetToEnv);
            const newPassword =
              typeof body?.newPassword === 'string' ? body.newPassword : undefined;
            const res = await setAdminRoleCredential(env.DB, {
              targetRole,
              newPassword,
              resetToEnv,
              currentTokenHash: session.tokenHash,
              envSecrets: env,
              now,
            });
            if (!res.ok) {
              return jsonResponse(
                { ok: false, error: res.error },
                res.status,
                corsHeaders
              );
            }
            return jsonResponse(
              { ok: true, credentials: res.credentials, serverTimeUtc: now },
              200,
              corsHeaders
            );
          }
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'GET, POST, OPTIONS' }
          );
        }

        if (path === '/api/admin/backups') {
          if (role !== 'founder') {
            return jsonResponse(
              { ok: false, error: 'النسخ الاحتياطي حصري للمؤسس (Founder) فقط.' },
              403,
              corsHeaders
            );
          }
          if (request.method === 'GET') {
            const backups = await listAdminBackups(env.DB);
            return jsonResponse(
              { ok: true, backups, serverTimeUtc: now },
              200,
              corsHeaders
            );
          }
          if (request.method === 'POST') {
            const body = await readJsonBody(request);
            const label = typeof body?.label === 'string' ? body.label : '';
            const createdBy =
              typeof body?.createdBy === 'string' && body.createdBy.trim()
                ? body.createdBy.trim()
                : 'المؤسس (Founder)';
            const payloadJson =
              typeof body?.payloadJson === 'string' ? body.payloadJson : '';

            if (!payloadJson) {
              const serverId =
                typeof body?.serverId === 'string' && body.serverId.trim()
                  ? body.serverId.trim()
                  : 'ALL';
              const created = await createServerBackup(env.DB, {
                serverId,
                label,
                createdBy,
                now,
              });
              if (!created.ok) {
                return jsonResponse(
                  { ok: false, error: created.error },
                  created.status,
                  corsHeaders
                );
              }
              return jsonResponse(
                {
                  ok: true,
                  snapshot: created.snapshot,
                  backups: created.list,
                  serverTimeUtc: now,
                },
                201,
                corsHeaders
              );
            }

            const commanderName =
              typeof body?.commanderName === 'string' ? body.commanderName : '';
            const totalSarApproved = Number(body?.totalSarApproved ?? 0) || 0;

            const created = await createAdminBackup(env.DB, {
              label,
              createdBy,
              totalSarApproved,
              commanderName,
              payloadJson,
              now,
            });
            if (!created.ok) {
              return jsonResponse(
                { ok: false, error: created.error },
                created.status,
                corsHeaders
              );
            }
            return jsonResponse(
              {
                ok: true,
                snapshot: created.snapshot,
                backups: created.list,
                serverTimeUtc: now,
              },
              201,
              corsHeaders
            );
          }
          return jsonResponse(
            { ok: false, error: 'Method Not Allowed' },
            405,
            corsHeaders,
            { Allow: 'GET, POST, OPTIONS' }
          );
        }

        if (path === '/api/admin/backups/restore') {
          if (request.method !== 'POST') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'POST, OPTIONS' }
            );
          }
          if (role !== 'founder') {
            return jsonResponse(
              { ok: false, error: 'استعادة النسخ الاحتياطية حصرية للمؤسس (Founder) فقط.' },
              403,
              corsHeaders
            );
          }
          const body = await readJsonBody(request);
          const backupId =
            typeof body?.backupId === 'string' ? body.backupId.trim() : undefined;
          const payloadJson =
            typeof body?.payloadJson === 'string' ? body.payloadJson : undefined;
          const restored = await restoreServerBackupSafely(env.DB, {
            backupId,
            payloadJson,
            now,
          });
          if (!restored.ok) {
            return jsonResponse(
              { ok: false, error: restored.error },
              restored.status,
              corsHeaders
            );
          }
          return jsonResponse(
            {
              ok: true,
              serverId: restored.serverId,
              serverName: restored.serverName,
              restoredPlayersCount: restored.restoredPlayersCount,
              adminConfig: restored.adminConfig,
              players: restored.players,
              serverTimeUtc: now,
            },
            200,
            corsHeaders
          );
        }

        const backupMatch = path.match(/^\/api\/admin\/backups\/([^/]+)$/);
        if (backupMatch) {
          if (request.method !== 'DELETE') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'DELETE, OPTIONS' }
            );
          }
          if (role !== 'founder') {
            return jsonResponse(
              { ok: false, error: 'حذف النسخ الاحتياطية حصري للمؤسس (Founder) فقط.' },
              403,
              corsHeaders
            );
          }
          const backupId = decodeURIComponent(backupMatch[1]);
          const backups = await deleteAdminBackup(env.DB, backupId);
          return jsonResponse(
            { ok: true, backups, serverTimeUtc: now },
            200,
            corsHeaders
          );
        }

        const playerPasswordMatch = path.match(
          /^\/api\/admin\/players\/([^/]+)\/password$/
        );
        if (playerPasswordMatch) {
          if (request.method !== 'POST') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'POST, OPTIONS' }
            );
          }
          if (role !== 'founder') {
            return jsonResponse(
              { ok: false, error: 'تعديل كلمة مرور اللاعبين يدويًا حصري للمؤسس (Founder) فقط.' },
              403,
              corsHeaders
            );
          }
          const targetAccountId = decodeURIComponent(playerPasswordMatch[1]);
          const body = await readJsonBody(request);
          const pwCheck = validatePassword(body?.newPassword);
          if (!pwCheck.valid) {
            return jsonResponse(
              { ok: false, error: pwCheck.error },
              400,
              corsHeaders
            );
          }

          const { hashHex, saltHex } = await hashPassword(String(body?.newPassword));
          const resetRes = await adminResetPlayerPassword(env.DB, {
            accountId: targetAccountId,
            passwordHash: hashHex,
            passwordSalt: saltHex,
            actorRole: role,
            now,
          });
          if (!resetRes.ok) {
            return jsonResponse(
              { ok: false, error: resetRes.error },
              resetRes.status,
              corsHeaders
            );
          }
          return jsonResponse(
            {
              ok: true,
              accountId: targetAccountId,
              message: 'تم تعديل كلمة مرور اللاعب بنجاح وإلغاء جلساته السابقة.',
              serverTimeUtc: now,
            },
            200,
            corsHeaders
          );
        }

        const playerMatch = path.match(/^\/api\/admin\/players\/([^/]+)\/state$/);
        if (playerMatch) {
          if (request.method !== 'POST' && request.method !== 'PUT') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'POST, PUT, OPTIONS' }
            );
          }
          const targetAccountId = decodeURIComponent(playerMatch[1]);
          const body = await readJsonBody(request);
          if (
            !body ||
            !body.state ||
            typeof body.state !== 'object' ||
            Array.isArray(body.state)
          ) {
            return jsonResponse(
              { ok: false, error: 'بيانات حالة اللاعب غير صالحة.' },
              400,
              corsHeaders
            );
          }

          const saved = await adminSavePlayerState(env.DB, {
            accountId: targetAccountId,
            nextState: body.state as JsonObject,
            role,
            now,
          });
          if (!saved.ok) {
            return jsonResponse(
              { ok: false, error: saved.error },
              saved.status,
              corsHeaders
            );
          }

          return jsonResponse(
            {
              ok: true,
              accountId: targetAccountId,
              revision: saved.revision,
              state: saved.state,
              adminConfig: saved.adminConfig,
              serverTimeUtc: now,
            },
            200,
            corsHeaders
          );
        }
      }

      return jsonResponse(
        {
          ok: false,
          error: 'Not Found',
          message: 'المسار المطلوب غير موجود.',
        },
        404,
        corsHeaders
      );
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: 'Internal Server Error',
          message: 'حدث خطأ غير متوقع في الخادم.',
        },
        500,
        corsHeaders
      );
    }
  },
};
