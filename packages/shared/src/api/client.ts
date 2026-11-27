import { GameState } from '../types/game';

export const DEFAULT_API_BASE_URL = 'https://enginora-city-api.mohastore32.workers.dev';

export function resolveApiBaseUrl(explicit?: string): string {
  const candidate = explicit?.trim();
  if (candidate) {
    return candidate.replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE_URL;
}

export class ApiClientError extends Error {
  status: number;
  code?: string;
  payload?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    payload?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
  keepalive?: boolean;
  signal?: AbortSignal;
  baseUrl?: string;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const baseUrl = resolveApiBaseUrl(options.baseUrl);
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      keepalive: options.keepalive,
      signal: options.signal,
    });
  } catch (err) {
    throw new ApiClientError(
      'تعذر الاتصال بخادم اللعبة حاليًا. تحقق من اتصال الإنترنت أو رابط الخادم.',
      0,
      'NETWORK_ERROR',
      { cause: err instanceof Error ? err.message : String(err) }
    );
  }

  let parsed: Record<string, unknown> = {};
  try {
    const text = await response.text();
    if (text) {
      const json = JSON.parse(text);
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        parsed = json as Record<string, unknown>;
      }
    }
  } catch {
    // non-JSON response fallback
  }

  if (!response.ok || parsed.ok === false) {
    const errMsg =
      typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error
        : typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message
          : `فشل الطلب برمز الحالة (${response.status}).`;
    const code = typeof parsed.code === 'string' ? parsed.code : undefined;
    throw new ApiClientError(errMsg, response.status, code, parsed);
  }

  return parsed as unknown as T;
}

export function newReceiptId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `rcp-${hex}`;
}

export async function compressReceiptFile(
  file: File
): Promise<{ name: string; dataUrl: string }> {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('صيغة الفاتورة غير مدعومة — يُسمح فقط بصور PNG أو JPG أو WEBP.');
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('حجم صورة الفاتورة يتجاوز الحد الأقصى المسموح (4MB).');
  }

  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });

  if (rawUrl.length <= 420_000) {
    return { name: file.name, dataUrl: rawUrl };
  }

  return await new Promise<{ name: string; dataUrl: string }>((resolve) => {
    const img = new Image();
    img.onerror = () => resolve({ name: file.name, dataUrl: rawUrl });
    img.onload = () => {
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ name: file.name, dataUrl: rawUrl });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      let compressed = canvas.toDataURL('image/jpeg', 0.8);
      if (compressed.length > 520_000) {
        compressed = canvas.toDataURL('image/jpeg', 0.65);
      }
      resolve({ name: file.name, dataUrl: compressed });
    };
    img.src = rawUrl;
  });
}

export async function uploadReceiptImage(
  token: string,
  id: string,
  dataUrl: string,
  baseUrl?: string
): Promise<boolean> {
  if (!token || !id || !dataUrl.startsWith('data:image/')) return false;
  try {
    await apiRequest<{ ok: true; id: string }>('/api/receipts', {
      method: 'POST',
      token,
      baseUrl,
      body: { id, dataUrl },
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchReceiptBlobUrl(
  token: string,
  id: string,
  baseUrl?: string
): Promise<string | null> {
  if (!token || !id) return null;
  const resolved = resolveApiBaseUrl(baseUrl);
  try {
    const res = await fetch(`${resolved}/api/receipts/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function stripInlineReceiptPreviews(state: GameState): GameState {
  const reg =
    state.registration && state.registration.receiptId
      ? {
          ...state.registration,
          receiptPreviewUrl: undefined,
        }
      : state.registration;

  const paymentOrders = Array.isArray(state.paymentOrders)
    ? state.paymentOrders.map((ord) =>
        ord.receiptId
          ? {
              ...ord,
              receiptPreviewUrl: undefined,
            }
          : ord
      )
    : state.paymentOrders;

  return {
    ...state,
    registration: reg,
    paymentOrders,
  };
}

