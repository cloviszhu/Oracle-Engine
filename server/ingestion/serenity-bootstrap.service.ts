import type { EvidenceKind } from '../infrastructure/x/content-source.adapter.js';

interface AccountResolver {
  resolveAccount(username: string): Promise<{
    externalUserId: string;
    username: string;
    displayName?: string;
    providerRequestId?: string;
    evidenceKind: EvidenceKind;
  }>;
}

interface SourceAccountRepository {
  upsertStableAccount(input: {
    provider: 'x';
    externalUserId: string;
    username: string;
    displayName?: string;
  }): Promise<string>;
}

export async function bootstrapSerenitySource(
  resolver: AccountResolver,
  repository: SourceAccountRepository,
): Promise<{ sourceId: string; externalUserId: string; evidenceKind: EvidenceKind }> {
  const account = await resolver.resolveAccount('aleabitoreddit');
  const sourceId = await repository.upsertStableAccount({
    provider: 'x',
    externalUserId: account.externalUserId,
    username: account.username,
    displayName: account.displayName,
  });
  return { sourceId, externalUserId: account.externalUserId, evidenceKind: account.evidenceKind };
}
