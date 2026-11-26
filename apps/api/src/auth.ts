const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input));
  return toHex(new Uint8Array(digest));
}

export async function constantTimeEqualText(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(a)),
    crypto.subtle.digest('SHA-256', textEncoder.encode(b)),
  ]);
  return timingSafeEqualBytes(new Uint8Array(ha), new Uint8Array(hb));
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return hasPlus ? `+${digits}` : digits;
}

export function validatePassword(raw: unknown): { valid: boolean; error?: string } {
  if (typeof raw !== 'string') {
    return { valid: false, error: 'كلمة المرور مطلوبة.' };
  }
  if (raw.length < 8) {
    return { valid: false, error: 'كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل.' };
  }
  if (raw.length > 128) {
    return { valid: false, error: 'كلمة المرور طويلة جدًا (الحد الأقصى 128 حرفًا).' };
  }
  return { valid: true };
}

export function generateAccountId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `ENG-${toHex(bytes).toUpperCase()}`;
}

export function generateId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}-${toHex(bytes)}`;
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function generateSixDigitOtp(): string {
  const buf = new Uint32Array(1);
  // Rejection sampling below 4_294_000_000 eliminates modulo bias across 0..999_999
  const limit = 4_294_000_000;
  let val = 0;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= limit);
  return String(val % 1_000_000).padStart(6, '0');
}

export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hashHex: string; saltHex: string }> {
  let saltBytes: Uint8Array;
  let resolvedSaltHex: string;

  if (saltHex) {
    const parsed = fromHex(saltHex);
    if (!parsed) throw new Error('Invalid password salt');
    saltBytes = parsed;
    resolvedSaltHex = saltHex;
  } else {
    saltBytes = new Uint8Array(SALT_BYTES);
    crypto.getRandomValues(saltBytes);
    resolvedSaltHex = toHex(saltBytes);
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_BYTES * 8
  );

  return {
    hashHex: toHex(new Uint8Array(derivedBits)),
    saltHex: resolvedSaltHex,
  };
}

export async function verifyPassword(
  password: string,
  storedHashHex: string,
  storedSaltHex: string
): Promise<boolean> {
  const storedHashBytes = fromHex(storedHashHex);
  const storedSaltBytes = fromHex(storedSaltHex);
  if (!storedHashBytes || !storedSaltBytes) return false;

  const { hashHex } = await hashPassword(password, storedSaltHex);
  const candidateBytes = fromHex(hashHex);
  if (!candidateBytes) return false;

  return timingSafeEqualBytes(storedHashBytes, candidateBytes);
}

export async function hashOtpCode(
  code: string,
  saltHex?: string
): Promise<{ codeHash: string; codeSalt: string }> {
  const salt = saltHex ?? toHex(crypto.getRandomValues(new Uint8Array(16)));
  const codeHash = await sha256Hex(`${salt}:${code.trim()}`);
  return { codeHash, codeSalt: salt };
}

export async function verifyOtpCodeHash(
  code: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const { codeHash } = await hashOtpCode(code, storedSalt);
  return constantTimeEqualText(codeHash, storedHash);
}
