import { createServer } from 'node:net';

export interface LocalServicePorts {
  api: number;
  mysql: number;
  redis: number;
}

export type PortAvailabilityProbe = (port: number) => Promise<boolean>;

export interface LocalServicePortSelection {
  current(): LocalServicePorts | undefined;
  require(): Promise<LocalServicePorts>;
  refresh(): Promise<LocalServicePorts>;
  clear(): void;
}

export function createLocalServicePortSelection(
  isAvailable: PortAvailabilityProbe = isLoopbackPortAvailable,
): LocalServicePortSelection {
  let selected: LocalServicePorts | undefined;
  let generation = 0;
  let pending: { generation: number; promise: Promise<LocalServicePorts> } | undefined;
  const select = async () => {
    const requestedGeneration = generation;
    if (!pending || pending.generation !== requestedGeneration) {
      pending = { generation: requestedGeneration, promise: selectLocalServicePorts(isAvailable) };
    }
    const active = pending;
    try {
      const result = await active.promise;
      if (generation === requestedGeneration) selected = result;
      return result;
    } finally {
      if (pending === active) pending = undefined;
    }
  };
  return {
    current: () => selected,
    require: () => selected ? Promise.resolve(selected) : select(),
    refresh: () => {
      selected = undefined;
      generation += 1;
      return select();
    },
    clear: () => {
      selected = undefined;
      generation += 1;
    },
  };
}

export async function selectLocalServicePorts(
  isAvailable: PortAvailabilityProbe = isLoopbackPortAvailable,
): Promise<LocalServicePorts> {
  if (!(await isAvailable(3000))) throw new Error('Serenity API 端口 3000 已被占用');
  return {
    api: 3000,
    mysql: await firstAvailable('MySQL', range(33060, 33069), isAvailable),
    redis: await firstAvailable('Redis', range(36379, 36388), isAvailable),
  };
}

export function isLoopbackPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

export function localServicePortEnvironment(ports: LocalServicePorts): Record<string, string> {
  return {
    SERENITY_MYSQL_PORT: String(ports.mysql),
    SERENITY_REDIS_PORT: String(ports.redis),
  };
}

async function firstAvailable(
  service: 'MySQL' | 'Redis',
  candidates: number[],
  isAvailable: PortAvailabilityProbe,
): Promise<number> {
  for (const port of candidates) if (await isAvailable(port)) return port;
  throw new Error(`Serenity ${service} 候选端口均已被占用`);
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
