import {
  constantTimeEqualText,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  validatePassword,
  verifyPassword,
} from './auth';
import {
  adminSavePlayerState,
  createPlayerAccount,
  createSession,
  deleteEmailCodeById,
  ensurePlatformConfig,
  findPlayerByEmail,
  findPlayerById,
  findPlayerByPhone,
  getPlayerStateWithConfig,
  issueEmailCode,
  listPlayersForAdmin,
  migrateLocalStateSafely,
  resetPlayerCitySafely,
  resolveSessionByToken,
  revokeSessionByToken,
  savePlayerStateSafely,
  updatePlatformConfig,
  verifyAndConsumeEmailCode,
} from './db';
import { JsonObject } from './defaults';
import { EmailEnv, sendOtpEmail } from './email';

export interface Env extends EmailEnv {
  DB?: D1Database;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  ADMIN_PASSWORD?: string;
}

const API_VERSION = 2;
const PROJECT_NAME = 'ENGINORA CITY';

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

        // Player registered with email -> MUST verify email before receiving a game session
        if (email) {
          const otpResult = await issueEmailCode(env.DB, {
            accountId: created.player.account_id,
            email,
            purpose: 'verify_email',
            now,
          });

          if (!otpResult.ok) {
            return jsonResponse(
              {
                ok: true,
                accountId: created.player.account_id,
                requiresEmailVerification: true,
                emailVerified: false,
                emailSent: false,
                email,
                error: otpResult.error,
                serverTimeUtc: now,
              },
              201,
              corsHeaders
            );
          }

          const mailRes = await sendOtpEmail(env, {
            to: email,
            purpose: 'verify_email',
            code: otpResult.code,
            commanderName,
          });

          if (!mailRes.sent) {
            // Remove unsent code so cooldown does not block once service is configured
            await deleteEmailCodeById(env.DB, otpResult.codeId);
            return jsonResponse(
              {
                ok: true,
                accountId: created.player.account_id,
                requiresEmailVerification: true,
                emailVerified: false,
                emailSent: false,
                email,
                emailError: mailRes.error,
                message:
                  'تم إنشاء الحساب بنجاح، لكن تعذر إرسال كود التأكيد عبر البريد حاليًا. لا يمكن الدخول قبل تأكيد البريد الإلكتروني.',
                serverTimeUtc: now,
              },
              201,
              corsHeaders
            );
          }

          return jsonResponse(
            {
              ok: true,
              accountId: created.player.account_id,
              requiresEmailVerification: true,
              emailVerified: false,
              emailSent: true,
              email,
              message:
                'تم إنشاء الحساب وإرسال كود التحقق (6 أرقام) إلى بريدك الإلكتروني. يرجى تأكيد البريد قبل تسجيل الدخول.',
              serverTimeUtc: now,
            },
            201,
            corsHeaders
          );
        }

        // Player registered with phone only -> can enter immediately and add email later
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
            email: null,
            phone: created.player.phone,
            emailVerified: false,
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
            { ok: false, error: 'أدخل البريد الإلكتروني أو رقم الجوال وكلمة المرور.' },
            400,
            corsHeaders
          );
        }

        const asEmail = normalizeEmail(rawIdentifier);
        const asPhone = asEmail ? null : normalizePhone(rawIdentifier);
        const player = asEmail
          ? await findPlayerByEmail(env.DB, asEmail)
          : asPhone
            ? await findPlayerByPhone(env.DB, asPhone)
            : null;

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

        if (player.email && player.email_verified !== 1) {
          return jsonResponse(
            {
              ok: false,
              code: 'EMAIL_NOT_VERIFIED',
              requiresEmailVerification: true,
              email: player.email,
              error: 'يجب تأكيد البريد الإلكتروني بالكود أولًا قبل تسجيل الدخول.',
            },
            403,
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
        const body = await readJsonBody(request);
        const email = normalizeEmail(body?.email);
        if (!email) {
          return jsonResponse(
            { ok: false, error: 'أدخل بريدًا إلكترونيًا صالحًا.' },
            400,
            corsHeaders
          );
        }

        // Fail honestly if Resend isn't configured yet so we never claim an email was sent
        if (!env.RESEND_API_KEY?.trim() || !env.EMAIL_FROM?.trim()) {
          return jsonResponse(
            {
              ok: false,
              emailSent: false,
              error:
                'خدمة إرسال البريد الإلكتروني غير مفعلة بعد على الخادم (مطلوب إعداد RESEND_API_KEY وEMAIL_FROM).',
            },
            503,
            corsHeaders
          );
        }

        const player = await findPlayerByEmail(env.DB, email);
        if (!player || player.email_verified !== 1) {
          return jsonResponse(
            {
              ok: true,
              emailSent: false,
              message:
                'إذا كان هذا البريد الإلكتروني مسجلًا ومؤكدًا في النظام، فسيصلك كود استعادة كلمة المرور خلال لحظات.',
            },
            200,
            corsHeaders
          );
        }

        const otpResult = await issueEmailCode(env.DB, {
          accountId: player.account_id,
          email,
          purpose: 'reset_password',
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
          purpose: 'reset_password',
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
            message: 'تم إرسال كود استعادة كلمة المرور إلى بريدك الإلكتروني.',
            serverTimeUtc: now,
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

      // Authenticated Player Game Routes (/api/game/*)
      if (
        path === '/api/game/state' ||
        path === '/api/game/migrate-local' ||
        path === '/api/game/reset'
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
        if (session.player.email && session.player.email_verified !== 1) {
          return jsonResponse(
            {
              ok: false,
              code: 'EMAIL_NOT_VERIFIED',
              error: 'يجب تأكيد البريد الإلكتروني أولًا قبل الوصول إلى بيانات اللعبة.',
            },
            403,
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
        const configuredPassword = env.ADMIN_PASSWORD?.trim();
        if (!configuredPassword) {
          return jsonResponse(
            {
              ok: false,
              error: 'كلمة مرور الإدارة غير مهيأة على الخادم (مطلوب إضافة ADMIN_PASSWORD في Cloudflare Secrets).',
            },
            503,
            corsHeaders
          );
        }
        const body = await readJsonBody(request);
        const inputPassword =
          typeof body?.password === 'string' ? body.password : '';
        const role =
          body?.role === 'partner' || body?.role === 'support'
            ? body.role
            : 'founder';

        const valid = await constantTimeEqualText(
          inputPassword,
          configuredPassword
        );
        if (!valid) {
          return jsonResponse(
            { ok: false, error: 'كلمة مرور الإدارة غير صحيحة.' },
            401,
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

      if (path === '/api/admin/overview' || path === '/api/admin/config' || path.startsWith('/api/admin/players/')) {
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

        if (path === '/api/admin/overview') {
          if (request.method !== 'GET') {
            return jsonResponse(
              { ok: false, error: 'Method Not Allowed' },
              405,
              corsHeaders,
              { Allow: 'GET, OPTIONS' }
            );
          }
          const data = await listPlayersForAdmin(env.DB, now);
          return jsonResponse(
            {
              ok: true,
              role: session.adminRole ?? 'founder',
              adminConfig: data.adminConfig,
              players: data.players,
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
          if ((session.adminRole ?? 'founder') !== 'founder') {
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
