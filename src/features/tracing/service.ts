// tracer.ts
// Minimal, production-ready-ish tracer with batching and Langfuse-style ergonomics.

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
  INGEST_URL: process.env.TRACE_INGEST_URL ?? "", // if empty, logs to console
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
class BatchIngestor {
  private queue: BatchRecord[] = [];
  private timer: NodeJS.Timeout | null = null;
  private inflight = 0;

  enqueue(item: BatchRecord) {
    this.queue.push(item);
    if (this.queue.length >= CFG.BATCH_MAX) this.flush();
    else this.arm();
  }

  private arm() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, CFG.BATCH_MS);
  }

  async flush() {
    if (!this.queue.length) return;
    if (this.inflight >= CFG.MAX_INFLIGHT) return; // simple backpressure
    const take = this.queue.splice(0, CFG.BATCH_MAX);
    this.inflight++;
    try {
      await this.post(take);
    } catch (e) {
      // On failure, push back to the front (bounded retry would be nicer)
      this.queue = take.concat(this.queue);
    } finally {
      this.inflight--;
      if (this.queue.length) this.arm();
    }
  }

  private async post(batch: BatchRecord[]) {
    if (!CFG.INGEST_URL) {
      // Fallback: log (dev/local)
      // eslint-disable-next-line no-console
      console.log("[trace:dev-sink]", JSON.stringify(batch));
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), CFG.TIMEOUT_MS);
    try {
      const res = await fetch(CFG.INGEST_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batch }),
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`ingest ${res.status}`);
    } finally {
      clearTimeout(t);
    }
  }
}

const INGESTOR = new BatchIngestor();

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
    const traceId = ulid();
    const startedAt = nowISO();

    INGESTOR.enqueue({
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
    return new Trace(projectId, requestId, traceId, startedAt ?? nowISO());
  }

  static async flush(): Promise<void> {
    // @ts-ignore
    if (INGESTOR?.flush) await INGESTOR.flush();
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
    INGESTOR.enqueue(rec);
  }

  startSpan(params: {
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

    INGESTOR.enqueue({
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
  public readonly spanId: string = ulid();
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
    INGESTOR.enqueue(rec);
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
    INGESTOR.enqueue(rec);
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
    INGESTOR.enqueue(rec);
  }

  endIfRunning(status: SpanStatus, endedAt?: ISODate) {
    if (this.status === "RUNNING") {
      this.end(status, undefined, endedAt ?? nowISO());
    }
  }
}

// Optional: flush on process exit (best-effort)
process.once("beforeExit", async () => {
  // @ts-ignore
  if (INGESTOR?.flush) await INGESTOR.flush();
});
process.once("SIGTERM", async () => {
  // @ts-ignore
  if (INGESTOR?.flush) await INGESTOR.flush();
});
process.once("SIGINT", async () => {
  // @ts-ignore
  if (INGESTOR?.flush) await INGESTOR.flush();
});
