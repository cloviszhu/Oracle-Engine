export type EvidenceKind = 'mock' | 'real_api';

export interface XNormalizedContent {
  id: string;
  authorId: string;
  text: string;
  createdAt?: string;
  conversationId?: string;
  inReplyToUserId?: string;
  replyToId?: string;
  quoteIds: string[];
  editHistoryIds: string[];
  raw: Record<string, unknown>;
}

export interface XContentPage {
  items: XNormalizedContent[];
  included: XNormalizedContent[];
  newestId?: string;
  nextToken?: string;
  providerRequestId?: string;
  evidenceKind: EvidenceKind;
  rawAudit: Record<string, unknown>;
}

export interface XContentSourceAdapter {
  resolveAccount(username: string): Promise<{
    externalUserId: string;
    username: string;
    displayName?: string;
    providerRequestId?: string;
    evidenceKind: EvidenceKind;
  }>;
  listUserContent(input: {
    userId: string;
    sinceId?: string;
    paginationToken?: string;
    maxResults?: number;
  }): Promise<XContentPage>;
  lookupContent(ids: string[]): Promise<XContentPage>;
}
