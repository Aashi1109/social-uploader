# Social Uploader (MVP)

Backend to publish media to multiple platforms via webhook. Express + BullMQ, Postgres (Sequelize), local AES secrets, Pino, Prometheus.

## Project Overview

Social Uploader is a backend service designed to publish media (videos/images) to multiple social media platforms (Instagram, YouTube) via a unified API. It handles media normalization, upload, and publishing asynchronously using a queue-based architecture.

## How it Works

1. **Request**: Client sends `POST /v1/publish` with media URL and target platforms.
2. **Validation**: API validates payload and checks idempotency (deduplication).
3. **Ingestion**: A job is enqueued in the `master` queue. API returns a `requestId`.
4. **Orchestration**: The Master Worker picks up the job and creates separate jobs for each target platform in the `publish` queue.
5. **Execution**: Platform Workers process these jobs (upload, publish).
6. **Tracing**: Workers emit events which are persisted to the DB to provide a real-time timeline.

## Quick start

1. Set env vars (example below). Use external Postgres + Redis.
2. Install deps: `pnpm install`
3. Build project: `pnpm build`
4. Dev: `pnpm dev:all` (API on :3000)

## Env

- `API_TOKEN` or `API_TOKENS`
- `DATABASE_URL` (Postgres)
- `REDIS_URL`
- `MASTER_KEY` (64 hex chars)
- `PORT` (default 3000)

## Webhook

**POST /v1/publish** (Bearer auth)

```json
{
  "projectId": "default",
  "mediaUrl": "https://.../video.mp4",
  "idempotencyKey": "abc-123",
  "title": "Hello",
  "description": "World",
  "platforms": ["instagram", "youtube"]
}
```

Response: `{ "requestId": "..." }`

**GET /v1/publish/:id** returns timeline.

## Idempotency

Uniq on `(projectId, idempotencyKey)`. Same payload with same key returns original `requestId`.

## Secrets

Local AES-256-GCM. Rotate by writing a new Secret row (higher version) with `MASTER_KEY`-encrypted payload.

## Rate limiting

30 req/min per IP on `POST /v1/publish`.

## E2E smoke

See `scripts/smoke.sh` for example curl commands.

```bash
# prerequisites: DATABASE_URL, REDIS_URL, API_TOKEN, MASTER_KEY
pnpm dev:all &
./scripts/smoke.sh
```
