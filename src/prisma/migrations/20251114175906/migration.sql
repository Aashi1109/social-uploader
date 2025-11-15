-- CreateEnum
CREATE TYPE "PlatformName" AS ENUM ('instagram', 'youtube');

-- CreateEnum
CREATE TYPE "TraceStatus" AS ENUM ('running', 'success', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('master', 'platform');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "StepName" AS ENUM ('prep', 'upload', 'publish');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('running', 'completed', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webhook_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_platforms" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" "PlatformName" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secrets" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "data_encrypted" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokens" TEXT,

    CONSTRAINT "secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traces" (
    "trace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "status" "TraceStatus" NOT NULL,
    "final_status" "TraceStatus",
    "total_stages" INTEGER NOT NULL DEFAULT 0,
    "completed_stages" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_ms" INTEGER,

    CONSTRAINT "traces_pkey" PRIMARY KEY ("trace_id")
);

-- CreateTable
CREATE TABLE "stages" (
    "stage_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "parent_stage_id" TEXT,
    "kind" "StageKind" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StageStatus" NOT NULL,
    "progress_completed" INTEGER NOT NULL DEFAULT 0,
    "progress_total" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "attrs" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error" JSONB,
    "platform" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("stage_id")
);

-- CreateTable
CREATE TABLE "steps" (
    "step_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "name" "StepName" NOT NULL,
    "status" "StepStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "meta" JSONB,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("step_id")
);

-- CreateTable
CREATE TABLE "events" (
    "event_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "stage_id" TEXT,
    "step_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "data" JSONB,
    "platform" TEXT,
    "step" TEXT,
    "status" TEXT,
    "durationMs" INTEGER,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "project_platforms_project_id_idx" ON "project_platforms"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_platforms_project_id_name_key" ON "project_platforms"("project_id", "name");

-- CreateIndex
CREATE INDEX "secrets_scope_idx" ON "secrets"("scope");

-- CreateIndex
CREATE INDEX "secrets_type_idx" ON "secrets"("type");

-- CreateIndex
CREATE INDEX "traces_project_id_idx" ON "traces"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "traces_project_id_idempotency_key_key" ON "traces"("project_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "stages_trace_id_idx" ON "stages"("trace_id");

-- CreateIndex
CREATE INDEX "steps_stage_id_idx" ON "steps"("stage_id");

-- CreateIndex
CREATE INDEX "steps_trace_id_idx" ON "steps"("trace_id");

-- CreateIndex
CREATE INDEX "events_trace_id_timestamp_idx" ON "events"("trace_id", "timestamp");

-- CreateIndex
CREATE INDEX "events_stage_id_timestamp_idx" ON "events"("stage_id", "timestamp");

-- CreateIndex
CREATE INDEX "events_name_idx" ON "events"("name");

-- AddForeignKey
ALTER TABLE "project_platforms" ADD CONSTRAINT "project_platforms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("trace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_parent_stage_id_fkey" FOREIGN KEY ("parent_stage_id") REFERENCES "stages"("stage_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("stage_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("trace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("trace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("stage_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("step_id") ON DELETE SET NULL ON UPDATE CASCADE;
