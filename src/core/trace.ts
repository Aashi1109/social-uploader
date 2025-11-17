import { Trace, Stage, Step, Event } from "@/features/tracing/models";
import { eventBus } from "@/core/events";
import type { CanonicalEvent } from "@/shared/types/events";
import { nowIso } from "@/shared/utils/time";
import { EventName } from "@/shared/constants";

export async function createTrace(params: {
  projectId: string;
  idempotencyKey?: string | null;
}): Promise<{ traceId: string }> {
  const trace = await Trace.create({
    projectId: params.projectId,
    idempotencyKey: params.idempotencyKey || null,
    status: "running" as any,
    totalStages: 0,
    completedStages: 0,
  });
  return { traceId: trace.id };
}

async function ensureStage(
  traceId: string,
  name: string,
  platform?: string | null
) {
  const existing = await Stage.findOne({
    where: { traceId, name },
  });
  if (existing) return existing;
  return Stage.create({
    traceId,
    name,
    platform: platform || null,
    kind: (platform ? "platform" : "master") as any,
    status: "running" as any,
    order: 0,
  });
}

async function ensureStep(traceId: string, stageId: string, name: string) {
  const existing = await Step.findOne({ where: { stageId, name } });
  if (existing) return existing;
  return Step.create({
    traceId,
    stageId,
    name: name as any,
    status: "running" as any,
  });
}

async function updateProgress(traceId: string) {
  const stages = await Stage.findAll({
    where: { traceId },
    attributes: ["status"],
  });
  const total = stages.length;
  const completed = stages.filter(
    (s: { status: string }) => s.status === "completed"
  ).length;
  await Trace.update(
    { totalStages: total, completedStages: completed },
    { where: { id: traceId } }
  );
}

async function ensureTraceExists(traceId: string, projectId: string) {
  const existing = await Trace.findOne({ where: { id: traceId } });
  if (existing) return;
  await Trace.create({
    id: traceId,
    projectId,
    status: "running" as any,
    totalStages: 0,
    completedStages: 0,
  });
}

async function handleEvent(e: CanonicalEvent) {
  // Ensure a trace exists for this event (event-sourced bootstrap)
  await ensureTraceExists(e.traceId, e.projectId);
  // Persist event
  await Event.create({
    traceId: e.traceId,
    name: e.name,
    timestamp: new Date(e.timestamp || nowIso()),
    platform: e.platform || null,
    step: e.step || null,
    status: e.status || null,
    durationMs: e.duration_ms || null,
    meta: (e.meta as any) || null,
  });

  // Update stages/steps
  if (e.name === EventName.PUBLISH_COMPLETED) {
    await Trace.update(
      { status: "completed" as any },
      { where: { id: e.traceId } }
    );
    await updateProgress(e.traceId);
    return;
  }

  if (e.name.startsWith("platform.") || e.platform) {
    const stage = await ensureStage(
      e.traceId,
      e.platform || "platform",
      e.platform
    );
    if (e.name === EventName.PLATFORM_STARTED) {
      await Stage.update(
        { status: "running" as any },
        { where: { id: stage.id } }
      );
    }
    if (e.name === EventName.PLATFORM_FINISHED) {
      await Stage.update(
        { status: "completed" as any },
        { where: { id: stage.id } }
      );
      await updateProgress(e.traceId);
    }
  }

  if (e.step) {
    const stageName = e.platform || "platform";
    const stage = await ensureStage(e.traceId, stageName, e.platform);
    const step = await ensureStep(e.traceId, stage.id, e.step);
    if (e.status === "success") {
      await Step.update(
        {
          status: "completed" as any,
          durationMs: e.duration_ms || step.durationMs || null,
        },
        { where: { id: step.id } }
      );
    } else if (e.status === "failed") {
      await Step.update(
        { status: "failed" as any },
        { where: { id: step.id } }
      );
      await Stage.update(
        { status: "failed" as any },
        { where: { id: stage.id } }
      );
      await Trace.update(
        { status: "failed" as any },
        { where: { id: e.traceId } }
      );
    } else if (e.status === "skipped") {
      await Step.update(
        { status: "skipped" as any },
        { where: { id: step.id } }
      );
    }
  }
}

// Subscribe once
eventBus.onEvent((e) => {
  // Fire and forget; log errors to avoid crashing process
  handleEvent(e).catch(() => {
    // swallow in MVP; logger could be used here
  });
});
