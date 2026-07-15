export interface InfrastructureProbes {
  databasePing(): Promise<void>;
  redisPing(): Promise<string>;
}

export async function checkInfrastructureReadiness(
  probes: InfrastructureProbes,
): Promise<{ database: 'ready'; redis: 'ready' }> {
  await probes.databasePing();
  const redisResponse = await probes.redisPing();
  if (redisResponse !== 'PONG') {
    throw new Error('Redis readiness probe returned an unexpected response');
  }
  return { database: 'ready', redis: 'ready' };
}
