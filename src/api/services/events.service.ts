import prisma from "../../prisma";

export interface EventsPage {
  events: any[];
  nextCursor?: string;
}

function encodeCursor(cur: { ts: string; id: string }): string {
  return Buffer.from(JSON.stringify(cur)).toString("base64url");
}

function decodeCursor(cursor?: string): { ts: string; id: string } | null {
  if (!cursor) return null;
  try {
    const obj = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof obj?.ts === "string" && typeof obj?.id === "string") return obj;
  } catch {
    // ignore
  }
  return null;
}

class EventsService {
  async getTraceEvents(
    traceId: string,
    opts: { cursor?: string; limit?: number }
  ): Promise<EventsPage> {
    const parsed = decodeCursor(opts.cursor);
    const limit =
      typeof opts.limit === "number"
        ? Math.max(1, Math.min(500, opts.limit))
        : 100;
    const where: any = { traceId };
    if (parsed) {
      where.AND = [
        {
          OR: [
            { timestamp: { gt: new Date(parsed.ts) } },
            {
              AND: [
                { timestamp: new Date(parsed.ts) },
                { id: { gt: parsed.id } },
              ],
            },
          ],
        },
      ];
    }
    const events = await prisma.event.findMany({
      where,
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      take: limit,
    });
    if (events.length === 0) {
      return { events };
    }
    const last = events[events.length - 1];
    const nextCursor = encodeCursor({
      ts: last.timestamp.toISOString(),
      id: last.id,
    });
    return { events, nextCursor };
  }
}

export default new EventsService();
