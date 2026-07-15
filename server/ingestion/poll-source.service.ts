import type { XContentPage } from '../infrastructure/x/content-source.adapter.js';

export const SERENITY_POLL_JOB_ID = 'poll-source--serenity';

export function compareXIds(left: string, right: string): number {
  const leftId = BigInt(left);
  const rightId = BigInt(right);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

interface PageClient {
  listUserContent(input: {
    userId: string;
    sinceId?: string;
    paginationToken?: string;
    maxResults?: number;
  }): Promise<XContentPage>;
}

interface PollRepository {
  beginRun(input: { sourceId: string; mode: 'poll' | 'compensation' }): Promise<string>;
  persistPage(input: { runId: string; sourceId: string; page: XContentPage }): Promise<void>;
  completeRunAndAdvanceCursor(input: {
    runId: string;
    sourceId: string;
    expectedSinceId?: string;
    nextSinceId?: string;
    pages: number;
    items: number;
  }): Promise<boolean>;
  failRun(runId: string, error: unknown): Promise<void>;
}

export class PollSourceService {
  constructor(
    private readonly client: PageClient,
    private readonly repository: PollRepository,
  ) {}

  async poll(input: {
    sourceId: string;
    externalUserId: string;
    sinceId?: string;
    mode: 'poll' | 'compensation';
  }): Promise<{ runId: string; pages: number; items: number; newestId?: string; cursorAdvanced: boolean }> {
    const runId = await this.repository.beginRun({ sourceId: input.sourceId, mode: input.mode });
    let paginationToken: string | undefined;
    let pages = 0;
    let items = 0;
    let newestId: string | undefined;
    try {
      do {
        const page = await this.client.listUserContent({
          userId: input.externalUserId,
          sinceId: input.sinceId,
          paginationToken,
          maxResults: 100,
        });
        await this.repository.persistPage({ runId, sourceId: input.sourceId, page });
        pages += 1;
        items += page.items.length;
        if (page.newestId && (!newestId || compareXIds(page.newestId, newestId) > 0)) {
          newestId = page.newestId;
        }
        paginationToken = page.nextToken;
      } while (paginationToken);

      const cursorAdvanced = await this.repository.completeRunAndAdvanceCursor({
        runId,
        sourceId: input.sourceId,
        expectedSinceId: input.sinceId,
        nextSinceId: newestId ?? input.sinceId,
        pages,
        items,
      });
      return { runId, pages, items, newestId, cursorAdvanced };
    } catch (error) {
      await this.repository.failRun(runId, error);
      throw error;
    }
  }
}
