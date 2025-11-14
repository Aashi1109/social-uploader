# Tracing usage

This tracer captures traces, spans, and events with batched delivery. It also supports trace-level events that are not tied to a specific span.

## Initialize a trace

```ts
import { Tracer } from "@features/tracing/service";

const trace = Tracer.init(projectId, requestId, {
  input: { mediaUrl, title },
  context: { ip: req.ip },
  tags: ["publish", "api"],
});

// Emit a trace-level event (between spans)
trace.event("INFO", "publish.request.received", { mediaUrl });
```

### Create spans and emit events

```ts
const master = trace.startSpan({
  name: "master",
  kind: "MASTER",
  parentSpanId: null,
});

master.event("INFO", "platforms.selected", { platforms: ["instagram", "youtube"] });

const ig = trace.startSpan({
  name: "instagram",
  kind: "PLATFORM",
  platform: "instagram",
});

const prep = trace.startSpan({ name: "prep", kind: "STEP", parentSpanId: ig.getId() });
prep.event("INFO", "prep.started");
await doPrep();
prep.end("SUCCESS");

trace.event("INFO", "coordinator.waiting_for_upload"); // trace-level, not tied to a span

const upload = trace.startSpan({ name: "upload", kind: "STEP", parentSpanId: ig.getId() });
upload.event("INFO", "upload.started");
await doUpload();
upload.end("SUCCESS");

// Finish platform/master/trace
ig.end("SUCCESS");
master.end("SUCCESS");
trace.end("SUCCESS");
```

### Ergonomic wrapper

```ts
await trace.withSpan({ name: "master", kind: "MASTER" }, async (s) => {
  s.event("INFO", "master.started");
  // ... your code ...
});

trace.event("INFO", "publish.request.queued", { queue: "master" }); // trace-level event
trace.end("SUCCESS");
```

### Rehydrate an existing trace

```ts
const trace = Tracer.fromExisting(projectId, requestId, traceId);
trace.event("INFO", "worker.resumed");
```

### Flush on shutdown (optional)

```ts
await Tracer.flush();
```

### Environment

- `TRACE_INGEST_URL`: optional HTTP endpoint for batched ingestion. If empty, batches are logged to stdout (JSON).
- `TRACE_BATCH_MAX` (default `100`)
- `TRACE_BATCH_MS` (default `1000`)
- `TRACE_MAX_INFLIGHT` (default `3`)
- `TRACE_POST_TIMEOUT_MS` (default `5000`)

### Notes

- Use trace-level `trace.event` for between-span orchestration, queue states, or external callbacks.
- Use span-level `span.event` for step/platform-local milestones.
- `trace.end` will auto-close any running spans with a terminal status derived from the trace status.
- Do not include secrets in event data; redact sensitive values.
