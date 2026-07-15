import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';

export interface SessionRecord {
  tokenHash: string;
  actorId: string;
  expiresAt: string;
}

interface SessionStore {
  put(record: SessionRecord): Promise<void>;
  get(tokenHash: string): Promise<SessionRecord | undefined>;
  delete(tokenHash: string): Promise<void>;
  deleteActor(actorId: string): Promise<void>;
}

interface LoginLimiter {
  consume(key: string): Promise<boolean>;
}

interface FamilyAccount {
  actorId: string;
  username: string;
  passwordScrypt: string;
}

interface FamilyAuthOptions {
  accounts: FamilyAccount[];
  sessionSecret: string;
  sessionTtlSeconds: number;
  secureCookies: boolean;
  store: SessionStore;
  limiter: LoginLimiter;
  now?: () => Date;
}

export class FamilyAuthError extends Error {
  constructor(public readonly code: 'invalid_credentials' | 'rate_limited' | 'invalid_session' | 'csrf') {
    super(code);
    this.name = 'FamilyAuthError';
  }
}

export class FamilyAuthService {
  private readonly now: () => Date;

  constructor(private readonly options: FamilyAuthOptions) {
    if (options.sessionSecret.length < 32) throw new Error('sessionSecret must be at least 32 characters');
    if (!Number.isInteger(options.sessionTtlSeconds) || options.sessionTtlSeconds <= 0) {
      throw new Error('sessionTtlSeconds must be positive');
    }
    this.now = options.now ?? (() => new Date());
  }

  async login(username: string, password: string, ipAddress: string) {
    const [accountAllowed, ipAllowed] = await Promise.all([
      this.options.limiter.consume(`account:${username.toLocaleLowerCase('en-US')}`),
      this.options.limiter.consume(`ip:${ipAddress}`),
    ]);
    if (!accountAllowed || !ipAllowed) throw new FamilyAuthError('rate_limited');

    const account = this.options.accounts.find((item) => item.username === username);
    const comparisonDigest = account?.passwordScrypt ?? this.options.accounts[0]?.passwordScrypt;
    const passwordMatches = comparisonDigest
      ? await verifyPassword(password, comparisonDigest)
      : false;
    if (!account || !passwordMatches) throw new FamilyAuthError('invalid_credentials');

    const token = randomBytes(32).toString('base64url');
    const signedToken = `${token}.${this.sign(token)}`;
    const expiresAt = new Date(this.now().getTime() + this.options.sessionTtlSeconds * 1_000);
    await this.options.store.put({
      tokenHash: hashToken(token),
      actorId: account.actorId,
      expiresAt: expiresAt.toISOString(),
    });
    return {
      actorId: account.actorId,
      csrfToken: this.sign(`csrf:${token}`),
      expiresAt: expiresAt.toISOString(),
      sessionCookie: serializeSessionCookie(signedToken, this.options.sessionTtlSeconds, this.options.secureCookies),
    };
  }

  async authenticate(cookieValue: string): Promise<{ actorId: string; csrfToken: string }> {
    const token = this.verifySignedCookie(cookieValue);
    const tokenHash = hashToken(token);
    const record = await this.options.store.get(tokenHash);
    if (!record || new Date(record.expiresAt).getTime() <= this.now().getTime()) {
      if (record) await this.options.store.delete(tokenHash);
      throw new FamilyAuthError('invalid_session');
    }
    return { actorId: record.actorId, csrfToken: this.sign(`csrf:${token}`) };
  }

  async authorizeStateChange(input: {
    cookieValue: string;
    csrfToken: string;
    origin: string;
    expectedOrigin: string;
  }): Promise<{ actorId: string }> {
    if (input.origin !== input.expectedOrigin) throw new FamilyAuthError('csrf');
    const token = this.verifySignedCookie(input.cookieValue);
    if (!safeEqual(input.csrfToken, this.sign(`csrf:${token}`))) throw new FamilyAuthError('csrf');
    return this.authenticate(input.cookieValue);
  }

  async logout(cookieValue: string): Promise<void> {
    const token = this.verifySignedCookie(cookieValue);
    await this.options.store.delete(hashToken(token));
  }

  async revokeActorSessions(actorId: string): Promise<void> {
    await this.options.store.deleteActor(actorId);
  }

  private verifySignedCookie(cookieValue: string): string {
    const separator = cookieValue.lastIndexOf('.');
    if (separator <= 0) throw new FamilyAuthError('invalid_session');
    const token = cookieValue.slice(0, separator);
    const signature = cookieValue.slice(separator + 1);
    if (!safeEqual(signature, this.sign(token))) throw new FamilyAuthError('invalid_session');
    return token;
  }

  private sign(value: string): string {
    return createHmac('sha256', this.options.sessionSecret).update(value).digest('base64url');
  }
}

export async function verifyPassword(password: string, encodedDigest: string): Promise<boolean> {
  const parts = encodedDigest.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (!n || !r || !p || n > 1_048_576 || r > 32 || p > 16) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4] as string, 'base64url');
    expected = Buffer.from(parts[5] as string, 'base64url');
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 16 || expected.length > 128) return false;
  const actual = await new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, expected.length, { N: n, r, p }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
  return timingSafeEqual(actual, expected);
}

export function serializeSessionCookie(value: string, ttlSeconds: number, secure: boolean): string {
  return [
    `serenity_session=${value}`,
    'Path=/',
    `Max-Age=${ttlSeconds}`,
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  return [
    'serenity_session=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
