import { getUUIDv7 } from "@/shared/utils/ids";
import { Trace as TraceModel, Step, Event as EventModel } from "./models";
import { logger } from "@/core/logger";
import { getDBConnection } from "@/shared/connections";

type TraceStatus =
  | "RUNNING"
  | "SUCCESS"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT";
type SpanStatus =
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT"
  | "SKIPPED";
type SpanKind = "MASTER" | "PLATFORM" | "STEP";
type EventLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type ISODate = string;

interface TraceRecord {
  _t: "trace_start" | "trace_end";
  traceId: string;
  projectId: string;
  requestId: string;
  status?: TraceStatus;
  startedAt?: ISODate;
  endedAt?: ISODate;
  durationMs?: number;
  input?: unknown;
  context?: Record<string, unknown>;
  tags?: string[];
}

interface SpanStartRecord {
  _t: "span_start";
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  kind: SpanKind;
  name: string;
  platform?: string | null;
  attemptNo: number;
  maxAttempts?: number;
  attrs?: Record<string, unknown>;
  startedAt: ISODate;
}

interface SpanEndRecord {
  _t: "span_end";
  spanId: string;
  status: SpanStatus;
  error?: {
    type?: string;
    message?: string;
    code?: string | number;
    retriable?: boolean;
  };
  endedAt: ISODate;
  durationMs: number;
}

interface EventRecord {
  _t: "span_event";
  spanId: string;
  ts: ISODate;
  level: EventLevel;
  name: string;
  data?: Record<string, unknown>;
  seq: number;
}

interface TraceEventRecord {
  _t: "trace_event";
  traceId: string;
  ts: ISODate;
  level: EventLevel;
  name: string;
  data?: Record<string, unknown>;
  seq: number;
}

type BatchRecord =
  | TraceRecord
  | SpanStartRecord
  | SpanEndRecord
  | EventRecord
  | TraceEventRecord;

// ---- Config (read from env; only ctor requires projectId, requestId) ----
const CFG = {
  BATCH_MAX: Number(process.env.TRACE_BATCH_MAX ?? 100),
  BATCH_MS: Number(process.env.TRACE_BATCH_MS ?? 1000),
  MAX_INFLIGHT: Number(process.env.TRACE_MAX_INFLIGHT ?? 3),
  TIMEOUT_MS: Number(process.env.TRACE_POST_TIMEOUT_MS ?? 5000),
};

// ---- Utils ----
function nowISO(): ISODate {
  return new Date().toISOString();
}
function ulid(): string {
  // Tiny ULID-ish (sortable enough for most cases)
  const ts = Date.now().toString(36).padStart(8, "0");
  const rand = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join("");
  return `${ts}${rand}`;
}

// Add this helper near the top
function childStatusFor(traceStatus: TraceStatus): SpanStatus {
  switch (traceStatus) {
    case "TIMEOUT":
      return "TIMEOUT";
    case "CANCELLED":
      return "CANCELLED";
    // For SUCCESS/FAILED/PARTIAL we typically cancel stragglers;
    // "SKIPPED" is also reasonable for SUCCESS if you prefer.
    default:
      return "CANCELLED";
  }
}

// ---- Transport + Batching ----
class BatchIngestor<T> {
  private queue: T[] = [];
  private timer: NodeJS.Timeout | null = null;
  private inflight = 0;
  private preFlushFn?: () => Promise<void>;

  constructor(
    private readonly postFn: (batch: T[]) => Promise<void>,
    preFlush?: () => Promise<void>
  ) {
    this.preFlushFn = preFlush;
  }

  enqueue(item: T) {
    this.queue.push(item);
    if (this.queue.length >= CFG.BATCH_MAX) {
      // Clear timer since we're flushing immediately
      this.clearTimer();
      this.flush();
    } else {
      this.arm();
    }
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private arm() {
    if (this.timer) return; // Timer already armed
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, CFG.BATCH_MS);
  }

  async flush() {
    if (!this.queue.length) {
      this.clearTimer(); // Clear timer if queue is empty
      return;
    }

    // Clear any existing timer since we're flushing now
    this.clearTimer();

    if (this.inflight >= CFG.MAX_INFLIGHT) {
      // If we're at max inflight, wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (this.inflight >= CFG.MAX_INFLIGHT) {
        // Re-arm timer since we couldn't flush
        this.arm();
        return;
      }
    }

    // Run pre-flush if defined (e.g., flush traces before steps)
    if (this.preFlushFn) {
      await this.preFlushFn();
    }

    const take = this.queue.splice(0, CFG.BATCH_MAX);
    this.inflight++;
    try {
      await this.postFn(take);
    } catch (e) {
      logger.error(
        { err: e, queueLength: this.queue.length },
        "Batch ingestor flush failed"
      );
      // On failure, push back to the front (bounded retry would be nicer)
      this.queue = take.concat(this.queue);
    } finally {
      this.inflight--;
      // Re-arm timer if there are still items in the queue
      if (this.queue.length) {
        this.arm();
      }
    }
  }
}

// Create separate ingestors for each type to maintain insertion order
const TRACE_INGESTOR = new BatchIngestor<TraceRecord>(async (batch) => {
  const now = new Date();
  const tracesToUpsert: any[] = [];
  const traceUpdates: Array<{
    traceId: string;
    status?: TraceStatus;
    endedAt?: ISODate;
    durationMs?: number;
  }> = [];

  for (const record of batch) {
    if (record._t === "trace_start") {
      tracesToUpsert.push({
        id: record.traceId,
        projectId: record.projectId,
        requestId: record.requestId,
        payload: record.input,
        createdAt: now,
        updatedAt: now,
      });
    } else if (record._t === "trace_end") {
      traceUpdates.push({
        traceId: record.traceId,
        status: record.status,
        endedAt: record.endedAt,
        durationMs: record.durationMs,
      });
    }
  }

  if (tracesToUpsert.length > 0) {
    await TraceModel.bulkCreate(tracesToUpsert, {
      updateOnDuplicate: ["updatedAt", "payload"],
    });
  }

  if (traceUpdates.length > 0) {
    // Batch update all traces in a single query using raw SQL with VALUES clause
    const sequelize = getDBConnection();
    const bindParams: any[] = [now];
    const valuePlaceholders: string[] = [];

    traceUpdates.forEach((update, index) => {
      const baseIndex = index * 4 + 2; // +2 because $1 is 'now'
      const status = update.status ? update.status.toLowerCase() : null;
      const endedAt = update.endedAt
        ? new Date(update.endedAt).toISOString()
        : null;
      const durationMs = update.durationMs ?? null;

      valuePlaceholders.push(
        `($${baseIndex}::uuid, $${baseIndex + 1}::text, $${baseIndex + 2}::timestamp, $${baseIndex + 3}::integer)`
      );
      bindParams.push(update.traceId, status, endedAt, durationMs);
    });

    const query = `
      UPDATE traces AS t
      SET
        status = COALESCE(v.status, t.status),
        ended_at = COALESCE(v.ended_at, t.ended_at),
        duration_ms = COALESCE(v.duration_ms, t.duration_ms),
        updated_at = $1
      FROM (VALUES ${valuePlaceholders.join(", ")}) AS v(id, status, ended_at, duration_ms)
      WHERE t.id = v.id
    `;

    await sequelize.query(query, {
      bind: bindParams,
      type: sequelize.QueryTypes.UPDATE,
    });
  }
});

const STEP_NO_REF_INGESTOR = new BatchIngestor<SpanStartRecord>(
  async (batch) => {
    const now = new Date();
    const stepsToCreate: any[] = [];

    for (const record of batch) {
      const stepKind =
        record.kind === "MASTER"
          ? "master"
          : record.kind === "PLATFORM"
            ? "platform"
            : "step";
      stepsToCreate.push({
        id: record.spanId,
        traceId: record.traceId,
        parentStepId: null,
        kind: stepKind,
        name: record.name,
        status: "running",
        attempt: record.attemptNo,
        attrs: record.attrs || null,
        startedAt: new Date(record.startedAt),
        platform: record.platform || null,
        meta: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (stepsToCreate.length > 0) {
      await Step.bulkCreate(stepsToCreate, {
        updateOnDuplicate: [
          "status",
          "attempt",
          "attrs",
          "startedAt",
          "updatedAt",
        ],
      });
    }
  },
  // Pre-flush: ensure traces exist before creating steps
  async () => await TRACE_INGESTOR.flush()
);

const STEP_WITH_REF_INGESTOR = new BatchIngestor<SpanStartRecord>(
  async (batch) => {
    const now = new Date();
    const stepsToCreate: any[] = [];

    for (const record of batch) {
      const stepKind =
        record.kind === "MASTER"
          ? "master"
          : record.kind === "PLATFORM"
            ? "platform"
            : "step";
      stepsToCreate.push({
        id: record.spanId,
        traceId: record.traceId,
        parentStepId: record.parentSpanId,
        kind: stepKind,
        name: record.name,
        status: "running",
        attempt: record.attemptNo,
        attrs: record.attrs || null,
        startedAt: new Date(record.startedAt),
        platform: record.platform || null,
        meta: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (stepsToCreate.length > 0) {
      await Step.bulkCreate(stepsToCreate, {
        updateOnDuplicate: [
          "status",
          "attempt",
          "attrs",
          "startedAt",
          "updatedAt",
        ],
      });
    }
  },
  // Pre-flush: ensure traces and parent steps exist
  async () => {
    await TRACE_INGESTOR.flush();
    await STEP_NO_REF_INGESTOR.flush();
  }
);

const STEP_UPDATE_INGESTOR = new BatchIngestor<SpanEndRecord>(async (batch) => {
  const now = new Date();
  const updates: Array<{ spanId: string; updates: any }> = [];

  for (const record of batch) {
    let stepStatus: "running" | "completed" | "failed" | "skipped";
    switch (record.status) {
      case "SUCCESS":
        stepStatus = "completed";
        break;
      case "SKIPPED":
        stepStatus = "skipped";
        break;
      case "FAILED":
      case "TIMEOUT":
      case "CANCELLED":
        stepStatus = "failed";
        break;
      default:
        stepStatus = "running";
    }

    updates.push({
      spanId: record.spanId,
      updates: {
        status: stepStatus,
        endedAt: new Date(record.endedAt),
        durationMs: record.durationMs,
        error: record.error,
        updatedAt: now,
      },
    });
  }

  if (updates.length > 0) {
    // Batch update all steps in a single query using raw SQL with VALUES clause
    const sequelize = getDBConnection();
    const bindParams: any[] = [now];
    const valuePlaceholders: string[] = [];

    updates.forEach(({ spanId, updates: updateData }, index) => {
      const baseIndex = index * 5 + 2; // +2 because $1 is 'now'
      const endedAt = updateData.endedAt
        ? new Date(updateData.endedAt).toISOString()
        : null;
      const durationMs = updateData.durationMs ?? null;
      const errorJson = updateData.error
        ? JSON.stringify(updateData.error)
        : null;

      valuePlaceholders.push(
        `($${baseIndex}::uuid, $${baseIndex + 1}::text, $${baseIndex + 2}::timestamp, $${baseIndex + 3}::integer, $${baseIndex + 4}::jsonb)`
      );
      bindParams.push(
        spanId,
        updateData.status,
        endedAt,
        durationMs,
        errorJson
      );
    });

    const query = `
      UPDATE steps AS s
      SET
        status = v.status,
        ended_at = v.ended_at,
        duration_ms = v.duration_ms,
        error = v.error,
        updated_at = $1
      FROM (VALUES ${valuePlaceholders.join(", ")}) AS v(id, status, ended_at, duration_ms, error)
      WHERE s.id = v.id
    `;

    await sequelize.query(query, {
      bind: bindParams,
      type: sequelize.QueryTypes.UPDATE,
    });
  }
});

const EVENT_INGESTOR = new BatchIngestor<EventRecord | TraceEventRecord>(
  async (batch) => {
    const now = new Date();
    const eventsToCreate: any[] = [];

    // Get all unique spanIds for span events to fetch steps in bulk
    const spanIds = [
      ...new Set(
        batch
          .filter((r) => r._t === "span_event")
          .map((r) => (r as EventRecord).spanId)
      ),
    ];

    const steps =
      spanIds.length > 0 ? await Step.findAll({ where: { id: spanIds } }) : [];
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    for (const record of batch) {
      if (record._t === "span_event") {
        const step = stepMap.get(record.spanId);
        if (step) {
          eventsToCreate.push({
            traceId: step.traceId,
            stepId: record.spanId,
            name: record.name,
            level: record.level,
            data: record.data,
            createdAt: now,
          });
        }
      } else if (record._t === "trace_event") {
        eventsToCreate.push({
          traceId: record.traceId,
          stepId: null,
          name: record.name,
          level: record.level,
          data: record.data,
          createdAt: now,
        });
      }
    }

    if (eventsToCreate.length > 0) {
      await EventModel.bulkCreate(eventsToCreate);
    }
  },
  // Pre-flush: ensure traces and steps exist before creating events
  async () => {
    await TRACE_INGESTOR.flush();
    await STEP_NO_REF_INGESTOR.flush();
    await STEP_WITH_REF_INGESTOR.flush();
  }
);

// ---- Public API: Tracer → Trace → Span ----
export class Tracer {
  static init(
    projectId: string,
    requestId: string,
    opts?: {
      input?: unknown;
      context?: Record<string, unknown>;
      tags?: string[];
    }
  ): Trace {
    const traceId = getUUIDv7();
    const startedAt = nowISO();

    TRACE_INGESTOR.enqueue({
      _t: "trace_start",
      traceId,
      projectId,
      requestId,
      startedAt,
      input: opts?.input,
      context: opts?.context,
      tags: opts?.tags ?? [],
    });

    return new Trace(projectId, requestId, traceId, startedAt);
  }

  static fromExisting(
    projectId: string,
    requestId: string,
    traceId: string,
    startedAt?: ISODate
  ): Trace {
    const effectiveStartedAt = startedAt ?? nowISO();

    // Enqueue trace_start to ensure the trace exists in DB
    // This uses upsert behavior, so it's safe to call multiple times
    TRACE_INGESTOR.enqueue({
      _t: "trace_start",
      traceId,
      projectId,
      requestId,
      startedAt: effectiveStartedAt,
    });

    return new Trace(projectId, requestId, traceId, effectiveStartedAt);
  }

  static async flush(): Promise<void> {
    // Flush in order: traces → steps without refs → steps with refs → updates → events
    await TRACE_INGESTOR.flush();
    await STEP_NO_REF_INGESTOR.flush();
    await STEP_WITH_REF_INGESTOR.flush();
    await STEP_UPDATE_INGESTOR.flush();
    await EVENT_INGESTOR.flush();
  }
}

export class Trace {
  private status: TraceStatus = "RUNNING";
  private endedAt?: ISODate;
  private spans: Span[] = [];
  private traceEventSeq = 0;

  constructor(
    public readonly projectId: string,
    public readonly requestId: string,
    public readonly traceId: string,
    private readonly startedAt: ISODate
  ) {}

  getStatus(): TraceStatus {
    return this.status;
  }

  getId(): string {
    return this.traceId;
  }

  // Trace-level events (not bound to any span)
  event(
    level: EventLevel,
    name: string,
    data?: Record<string, unknown>,
    ts: ISODate = nowISO()
  ) {
    const rec: TraceEventRecord = {
      _t: "trace_event",
      traceId: this.traceId,
      ts,
      level,
      name,
      data,
      seq: ++this.traceEventSeq,
    };
    EVENT_INGESTOR.enqueue(rec);
  }

  span(params: {
    name: string;
    kind?: SpanKind; // default "STEP"
    parentSpanId?: string | null; // null for root/master
    platform?: string | null;
    attemptNo?: number; // default 1
    maxAttempts?: number;
    attrs?: Record<string, unknown>;
    startedAt?: ISODate;
  }): Span {
    const span = new Span({
      traceId: this.traceId,
      name: params.name,
      kind: params.kind ?? "STEP",
      parentSpanId: params.parentSpanId ?? null,
      platform: params.platform ?? null,
      attemptNo: params.attemptNo ?? 1,
      maxAttempts: params.maxAttempts,
      attrs: params.attrs,
      startedAt: params.startedAt ?? nowISO(),
    });
    this.spans.push(span);
    return span;
  }

  // In class Trace
  end(
    status: TraceStatus = "SUCCESS",
    endedAt: ISODate = nowISO(),
    opts?: { closeChildren?: boolean }
  ) {
    if (this.status !== "RUNNING") return;

    const closeChildren = opts?.closeChildren ?? true; // default ON
    const childTerminal = childStatusFor(status);

    // 1) Close any RUNNING child spans first
    if (closeChildren) {
      for (const s of this.spans) {
        if (s.isRunning()) {
          s.end(childTerminal, undefined, endedAt); // reuse same endedAt for clean timeline
        }
      }
    }

    // 2) End the trace
    this.status = status;
    this.endedAt = endedAt;
    const durationMs = Math.max(
      0,
      new Date(endedAt).getTime() - new Date(this.startedAt).getTime()
    );

    TRACE_INGESTOR.enqueue({
      _t: "trace_end",
      traceId: this.traceId,
      projectId: this.projectId,
      requestId: this.requestId,
      status,
      endedAt,
      durationMs,
    });
  }
}

class Span {
  public readonly spanId: string = getUUIDv7();
  private status: SpanStatus = "RUNNING";
  private eventSeq = 0;
  private endedAt?: ISODate;
  private startedAt: ISODate;

  private readonly meta: {
    traceId: string;
    parentSpanId?: string | null;
    kind: SpanKind;
    name: string;
    platform?: string | null;
    attemptNo: number;
    maxAttempts?: number;
    attrs?: Record<string, unknown>;
  };

  constructor(params: {
    traceId: string;
    parentSpanId?: string | null;
    kind: SpanKind;
    name: string;
    platform?: string | null;
    attemptNo: number;
    maxAttempts?: number;
    attrs?: Record<string, unknown>;
    startedAt: ISODate;
  }) {
    this.meta = {
      traceId: params.traceId,
      parentSpanId: params.parentSpanId ?? null,
      kind: params.kind,
      name: params.name,
      platform: params.platform ?? null,
      attemptNo: params.attemptNo,
      maxAttempts: params.maxAttempts,
      attrs: params.attrs,
    };
    this.startedAt = params.startedAt;

    const rec: SpanStartRecord = {
      _t: "span_start",
      traceId: params.traceId,
      spanId: this.spanId,
      parentSpanId: this.meta.parentSpanId ?? undefined,
      kind: this.meta.kind,
      name: this.meta.name,
      platform: this.meta.platform ?? undefined,
      attemptNo: this.meta.attemptNo,
      maxAttempts: this.meta.maxAttempts,
      attrs: this.meta.attrs,
      startedAt: this.startedAt,
    };
    // Route to the correct ingestor based on whether it has a parent
    if (this.meta.parentSpanId) {
      STEP_WITH_REF_INGESTOR.enqueue(rec);
    } else {
      STEP_NO_REF_INGESTOR.enqueue(rec);
    }
  }

  getId(): string {
    return this.spanId;
  }

  getStatus(): SpanStatus {
    return this.status;
  }

  isRunning(): boolean {
    return this.status === "RUNNING";
  }

  event(
    level: EventLevel,
    name: string,
    data?: Record<string, unknown>,
    ts: ISODate = nowISO()
  ) {
    const rec: EventRecord = {
      _t: "span_event",
      spanId: this.spanId,
      ts,
      level,
      name,
      data,
      seq: ++this.eventSeq,
    };
    EVENT_INGESTOR.enqueue(rec);
  }

  end(
    status: SpanStatus = "SUCCESS",
    error?: SpanEndRecord["error"],
    endedAt: ISODate = nowISO()
  ) {
    if (this.status !== "RUNNING") return;
    this.status = status;
    this.endedAt = endedAt;

    const durationMs = Math.max(
      0,
      new Date(endedAt).getTime() - new Date(this.startedAt).getTime()
    );

    const rec: SpanEndRecord = {
      _t: "span_end",
      spanId: this.spanId,
      status,
      error,
      endedAt,
      durationMs,
    };
    STEP_UPDATE_INGESTOR.enqueue(rec);
  }

  endIfRunning(status: SpanStatus, endedAt?: ISODate) {
    if (this.status === "RUNNING") {
      this.end(status, undefined, endedAt ?? nowISO());
    }
  }
}

// Optional: flush on process exit (best-effort)
process.once("beforeExit", async () => {
  await Tracer.flush();
});
process.once("SIGTERM", async () => {
  await Tracer.flush();
});
process.once("SIGINT", async () => {
  await Tracer.flush();
});
