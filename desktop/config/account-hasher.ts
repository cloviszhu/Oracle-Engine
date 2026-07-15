import { randomBytes, scrypt } from 'node:crypto';

export interface PlainFamilyAccount {
  actorId: string;
  username: string;
  password: string;
}

export interface FamilyAccountDigest {
  actorId: string;
  username: string;
  passwordScrypt: string;
}

export async function createFamilyAccountDigests(
  inputs: PlainFamilyAccount[],
  previous: FamilyAccountDigest[],
  revokeActorSessions: (actorId: string) => Promise<void>,
): Promise<FamilyAccountDigest[]> {
  if (inputs.length !== 2 || new Set(inputs.map((item) => item.username.trim())).size !== 2) {
    throw new Error('必须配置两个不同用户名的家庭账号');
  }
  if (new Set(inputs.map((item) => item.actorId)).size !== 2) throw new Error('家庭账号身份必须不同');

  const output: FamilyAccountDigest[] = [];
  for (const input of inputs) {
    const existing = previous.find((item) => item.actorId === input.actorId);
    if (input.password.length === 0 && existing && existing.username === input.username.trim()) {
      output.push(existing);
      continue;
    }
    if (input.password.length < 12) throw new Error('家庭账号密码至少需要 12 个字符');
    const passwordScrypt = await hashPassword(input.password);
    output.push({ actorId: input.actorId, username: input.username.trim(), passwordScrypt });
    if (existing) await revokeActorSessions(input.actorId);
  }
  return output;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}
