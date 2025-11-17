import { Event } from "@/features/tracing/models";
import { Op } from "sequelize";

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
      where[Op.or] = [
        { timestamp: { [Op.gt]: new Date(parsed.ts) } },
        {
          [Op.and]: [
            { timestamp: new Date(parsed.ts) },
            { id: { [Op.gt]: parsed.id } },
          ],
        },
      ];
    }

    const events = await Event.findAll({
      where,
      order: [
        ["timestamp", "ASC"],
        ["id", "ASC"],
      ],
      limit,
    });

    if (events.length === 0) {
      return { events: [] };
    }

    const last = events[events.length - 1];
    if (!last) {
      return { events: [] };
    }

    const nextCursor = encodeCursor({
      ts: last.timestamp.toISOString(),
      id: last.id,
    });
    return { events, nextCursor };
  }
}

export default new EventsService();
