import { randomBytes, scrypt } from 'node:crypto';

const password = await readHidden('输入家庭账号密码（不会回显）: ');
if (password.length < 12) {
  throw new Error('密码至少需要 12 个字符');
}
const salt = randomBytes(16);
const digest = await new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, value) => {
    if (error) reject(error);
    else resolve(value);
  });
});
process.stdout.write(
  `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}\n`,
);

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('请在交互式终端中运行 pnpm account:hash');
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk: string) => {
      if (chunk === '\u0003') {
        cleanup();
        reject(new Error('已取消'));
      } else if (chunk === '\r' || chunk === '\n') {
        cleanup();
        resolve(value);
      } else if (chunk === '\u0008' || chunk === '\u007f') {
        value = value.slice(0, -1);
      } else if (!/^[\u0000-\u001f]$/.test(chunk)) {
        value += chunk;
      }
    };
    process.stdin.on('data', onData);
  });
}
