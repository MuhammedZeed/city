import { loadSavedState } from '@enginora/shared';
import type { GameState } from '@enginora/shared';

const DEFAULT_API_BASE = 'https://enginora-city-api.mohastore32.workers.dev';
const API_BASE = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE
).replace(/\/+$/, '');

const TOKEN_KEY = 'enginora_session_token_v1';
// Must match STORAGE_KEY inside the shared game engine (loadSavedState reads it)
const GAME_SAVE_KEY = 'empire_gdd_v2_save_state';

export interface ApiResult {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error?: string;
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage failures
  }
}

async function request(
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: unknown,
  token?: string | null
): Promise<ApiResult> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const ok = res.ok && data?.ok !== false;
    return {
      ok,
      status: res.status,
      data: data ?? {},
      error: ok ? undefined : data?.error || data?.message || 'حدث خطأ غير متوقع.',
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: {},
      error: 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',
    };
  }
}

export const apiRegister = (body: Record<string, unknown>) =>
  request('/api/auth/register', 'POST', body);

export const apiLogin = (identifier: string, password: string) =>
  request('/api/auth/login', 'POST', { identifier, password });

export const apiGetState = (token: string) =>
  request('/api/game/state', 'GET', undefined, token);

export const apiSaveState = (token: string, state: GameState, expectedRevision: number) =>
  request('/api/game/state', 'PUT', { state, expectedRevision }, token);

export const apiResetCity = (token: string) =>
  request('/api/game/reset', 'POST', {}, token);

export const apiLogout = (token: string) =>
  request('/api/auth/logout', 'POST', {}, token);

/**
 * Turns a server-side player state into a full client GameState by running it
 * through the engine's own loader (which fills any missing fields with defaults
 * and catches up offline time). `fallback` is used only right after registering,
 * to make sure the pending registration/payment order are never lost.
 */
export function hydrateServerState(raw: unknown, fallback?: GameState): GameState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    window.localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(src));
  } catch {
    // ignore
  }
  const hydrated = loadSavedState();

  let registration = { ...hydrated.registration };
  if (
    fallback &&
    registration.status === 'unregistered' &&
    fallback.registration.status === 'pending'
  ) {
    registration = { ...fallback.registration };
  }

  const serverOrders = Array.isArray(src.paymentOrders) ? src.paymentOrders : [];
  const paymentOrders =
    serverOrders.length > 0 || !fallback ? hydrated.paymentOrders : fallback.paymentOrders;

  return {
    ...hydrated,
    accountId: typeof src.accountId === 'string' ? src.accountId : hydrated.accountId,
    registration,
    paymentOrders,
  };
}

function finiteOr(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * After a successful autosave, copy back only the fields the server owns
 * (registration review result, payment order statuses, and gem clamping) so we
 * never roll the player's progress back.
 */
export function mergeAuthoritative(prev: GameState, srv: unknown): GameState {
  if (!srv || typeof srv !== 'object') return prev;
  const s = srv as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const next: GameState = { ...prev };

  if (s.registration && typeof s.registration === 'object') {
    next.registration = { ...prev.registration, ...s.registration };
  }

  if (Array.isArray(s.paymentOrders)) {
    const ids = new Set(s.paymentOrders.map((o: { id?: string }) => o?.id));
    next.paymentOrders = [
      ...prev.paymentOrders.filter((o) => !ids.has(o.id)),
      ...s.paymentOrders,
    ];
  }

  if (s.gemLedger && typeof s.gemLedger === 'object') {
    const p = prev.gemLedger;
    const charged = Math.min(p.chargedGems, finiteOr(s.gemLedger.chargedGems, p.chargedGems));
    const bonus = Math.min(p.bonusGems, finiteOr(s.gemLedger.bonusGems, p.bonusGems));
    next.gemLedger = { ...p, chargedGems: charged, bonusGems: bonus };
    next.ledger = {
      ...prev.ledger,
      paidGems: Math.floor(charged) + Math.floor(bonus) + Math.floor(p.marketGems),
    };
  }

  return next;
}

// ---------------------------------------------------------------------------
// Receipts: stored on the server as real images (not inside the game save JSON)
// ---------------------------------------------------------------------------

const RECEIPT_IDS_KEY = 'enginora_receipt_ids_v1';
const RECEIPT_DONE_KEY = 'enginora_receipt_done_v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function newReceiptId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return 'rcp-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function receiptIdFor(key: string): string {
  const map = readJson<Record<string, string>>(RECEIPT_IDS_KEY, {});
  if (!map[key]) {
    map[key] = newReceiptId();
    writeJson(RECEIPT_IDS_KEY, map);
  }
  return map[key];
}

/** Resize/compress a receipt photo so it is small enough to upload (JPEG, <= ~380KB). */
export function compressReceiptFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      reject(new Error('صيغة الفاتورة غير مدعومة — يُسمح فقط بصور PNG أو JPG أو WEBP.'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('حجم صورة الفاتورة كبير جدًا (الحد الأقصى 10MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة صورة الفاتورة، جرّب صورة أخرى.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذر قراءة صورة الفاتورة، جرّب صورة أخرى.'));
      img.onload = () => {
        const maxSide = 1100;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('تعذر معالجة صورة الفاتورة، جرّب صورة أخرى.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.75;
        let out = canvas.toDataURL('image/jpeg', quality);
        while (out.length > 380_000 && quality > 0.3) {
          quality -= 0.1;
          out = canvas.toDataURL('image/jpeg', quality);
        }
        if (out.length > 380_000) {
          reject(new Error('صورة الفاتورة معقدة جدًا، التقط لقطة شاشة أصغر للفاتورة.'));
          return;
        }
        resolve(out);
      };
      img.src = String(reader.result ?? '');
    };
    reader.readAsDataURL(file);
  });
}

export const apiUploadReceipt = (token: string, id: string, dataUrl: string) =>
  request('/api/receipts', 'POST', { id, dataUrl }, token);

/** 'ok' = stored, 'retry' = temporary failure (try again later), 'fail' = rejected for good */
export async function ensureReceiptUploaded(
  token: string,
  id: string,
  dataUrl: string
): Promise<'ok' | 'retry' | 'fail'> {
  const done = readJson<string[]>(RECEIPT_DONE_KEY, []);
  if (done.includes(id)) return 'ok';
  let last: ApiResult | null = null;
  for (let i = 0; i < 3; i++) {
    last = await apiUploadReceipt(token, id, dataUrl);
    if (last.ok) {
      writeJson(RECEIPT_DONE_KEY, [...done.slice(-200), id]);
      return 'ok';
    }
    if (last.status >= 400 && last.status < 500 && last.status !== 429) return 'fail';
  }
  return 'retry';
}

const isDataUrl = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith('data:');

/**
 * Returns a copy of the state that is safe to send to the server: receipt photos are
 * uploaded as images and replaced by a small `receiptId`. Returns null on a temporary
 * failure so the caller simply tries again on the next save.
 */
export async function prepareStateForServer(
  token: string,
  state: GameState
): Promise<GameState | null> {
  const reg: Record<string, any> = { ...state.registration }; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (isDataUrl(reg.receiptPreviewUrl)) {
    const id: string = reg.receiptId || receiptIdFor('reg:' + state.accountId);
    const status = await ensureReceiptUploaded(token, id, reg.receiptPreviewUrl);
    if (status === 'retry') return null;
    if (status === 'ok') reg.receiptId = id;
    delete reg.receiptPreviewUrl;
  }

  const orders: unknown[] = [];
  for (const o of state.paymentOrders as unknown as Record<string, any>[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (isDataUrl(o.receiptPreviewUrl)) {
      const id: string = o.receiptId || receiptIdFor('ord:' + o.id);
      const status = await ensureReceiptUploaded(token, id, o.receiptPreviewUrl);
      if (status === 'retry') return null;
      const copy: Record<string, any> = { ...o }; // eslint-disable-line @typescript-eslint/no-explicit-any
      delete copy.receiptPreviewUrl;
      if (status === 'ok') copy.receiptId = id;
      orders.push(copy);
    } else {
      orders.push(o);
    }
  }

  return { ...state, registration: reg, paymentOrders: orders } as unknown as GameState;
}

export async function apiSaveStatePrepared(
  token: string,
  state: GameState,
  expectedRevision: number
): Promise<ApiResult> {
  const prepared = await prepareStateForServer(token, state);
  if (!prepared) {
    return {
      ok: false,
      status: 0,
      data: {},
      error: 'تعذر رفع صورة الفاتورة حاليًا، ستتم إعادة المحاولة تلقائيًا.',
    };
  }
  return apiSaveState(token, prepared, expectedRevision);
}
