export interface Env {
  DB?: D1Database;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
}

const API_VERSION = 1;
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    const knownRoutes = new Set(['/api/health', '/api/db-check']);

    if (!knownRoutes.has(path)) {
      return jsonResponse(
        {
          ok: false,
          error: 'Not Found',
          message: 'المسار المطلوب غير موجود.',
        },
        404,
        corsHeaders
      );
    }

    if (request.method !== 'GET') {
      return jsonResponse(
        {
          ok: false,
          error: 'Method Not Allowed',
          message: 'طريقة HTTP غير مدعومة لهذا المسار.',
        },
        405,
        corsHeaders,
        { Allow: 'GET, OPTIONS' }
      );
    }

    if (path === '/api/health') {
      return jsonResponse(
        {
          ok: true,
          project: PROJECT_NAME,
          service: 'api',
          status: 'ok',
          version: API_VERSION,
          timestamp: new Date().toISOString(),
        },
        200,
        corsHeaders
      );
    }

    // GET /api/db-check — strictly read-only check; never creates tables or mutates data
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
    } catch {
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
  },
};
