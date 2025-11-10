import prisma from "../prisma";
import { eventBus } from "@/core/events";
import type { CanonicalEvent } from "@/shared/types/events";
import { nowIso } from "@/shared/utils/time";
import { EventName } from "@/shared/constants";

export async function createTrace(params: {
  projectId: string;
  idempotencyKey?: string | null;
}): Promise<{ traceId: string }> {
  const trace = await prisma.trace.create({
    data: {
      projectId: params.projectId,
      idempotencyKey: params.idempotencyKey || null,
      status: "running",
      totalStages: 0,
      completedStages: 0,
    },
    select: { id: true },
  });
  return { traceId: trace.id };
}

async function ensureStage(
  traceId: string,
  name: string,
  platform?: string | null
) {
  const existing = await prisma.stage.findFirst({
    where: { traceId, name },
  });
  if (existing) return existing;
  return prisma.stage.create({
    data: {
      traceId,
      name,
      platform: platform || null,
      kind: platform ? "platform" : "master",
      status: "running",
      order: 0,
    },
  });
}

async function ensureStep(traceId: string, stageId: string, name: string) {
  const existing = await prisma.step.findFirst({ where: { stageId, name } });
  if (existing) return existing;
  return prisma.step.create({
    data: { traceId, stageId, name, status: "running" },
  });
}

async function updateProgress(traceId: string) {
  const stages = await prisma.stage.findMany({
    where: { traceId },
    select: { status: true },
  });
  const total = stages.length;
  const completed = stages.filter(
    (s: { status: string }) => s.status === "completed"
  ).length;
  await prisma.trace.update({
    where: { id: traceId },
    data: { totalStages: total, completedStages: completed },
  });
}

async function ensureTraceExists(traceId: string, projectId: string) {
  const existing = await prisma.trace.findUnique({ where: { id: traceId } });
  if (existing) return;
  await prisma.trace.create({
    data: {
      id: traceId,
      projectId,
      status: "running",
      totalStages: 0,
      completedStages: 0,
    },
  });
}

async function handleEvent(e: CanonicalEvent) {
  // Ensure a trace exists for this event (event-sourced bootstrap)
  await ensureTraceExists(e.traceId, e.projectId);
  // Persist event
  await prisma.event.create({
    data: {
      traceId: e.traceId,
      name: e.name,
      timestamp: new Date(e.timestamp || nowIso()),
      platform: e.platform || null,
      step: e.step || null,
      status: e.status || null,
      durationMs: e.duration_ms || null,
      meta: (e.meta as object) || undefined,
    },
  });

  // Update stages/steps
  if (e.name === EventName.PUBLISH_COMPLETED) {
    await prisma.trace.update({
      where: { id: e.traceId },
      data: { status: "completed" },
    });
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
      await prisma.stage.update({
        where: { id: stage.id },
        data: { status: "running" },
      });
    }
    if (e.name === EventName.PLATFORM_FINISHED) {
      await prisma.stage.update({
        where: { id: stage.id },
        data: { status: "completed" },
      });
      await updateProgress(e.traceId);
    }
  }

  if (e.step) {
    const stageName = e.platform || "platform";
    const stage = await ensureStage(e.traceId, stageName, e.platform);
    const step = await ensureStep(e.traceId, stage.id, e.step);
    if (e.status === "success") {
      await prisma.step.update({
        where: { id: step.id },
        data: {
          status: "completed",
          durationMs: e.duration_ms || step.durationMs || null,
        },
      });
    } else if (e.status === "failed") {
      await prisma.step.update({
        where: { id: step.id },
        data: { status: "failed" },
      });
      await prisma.stage.update({
        where: { id: stage.id },
        data: { status: "failed" },
      });
      await prisma.trace.update({
        where: { id: e.traceId },
        data: { status: "failed" },
      });
    } else if (e.status === "skipped") {
      await prisma.step.update({
        where: { id: step.id },
        data: { status: "skipped" },
      });
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
