import { getProjectById } from "@/lib/projects/service";
import { formatClock, formatPercent } from "@/lib/utils";
import { generateLocalProjectInsights, getLocalLlmHealth } from "@/lib/ai/provider";
import type { ProjectInsightResult } from "@/lib/ai/types";
import type { ProjectDetail } from "@/lib/domain/cadris";

function buildProjectInsightPrompt(project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>) {
  const latestRecording = project.recordings[0];
  const shotBreakdown = project.shotEvents.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.shotType] = (accumulator[event.shotType] || 0) + 1;
    return accumulator;
  }, {});

  const shotTimeline = project.shotEvents.slice(0, 18).map((event) => ({
    at: formatClock(event.timestampMs),
    shotType: event.shotType,
    targetTrackId: event.targetTrackId,
    confidence: formatPercent(event.confidence),
    notes: event.notes
  }));

  return `
You are helping review a recorded multi-person conversation captured by an AI camera director.
Analyze the session and return JSON only.

Project:
- title: ${project.title}
- mode: ${project.mode}
- style: ${project.style}
- status: ${project.status}
- duration: ${latestRecording ? formatClock(latestRecording.durationMs) : "00:00"}
- shotEvents: ${project.shotEvents.length}
- breakdown: ${JSON.stringify(shotBreakdown)}

Timeline sample:
${JSON.stringify(shotTimeline, null, 2)}

Return valid JSON with this exact shape:
{
  "summary": "2-3 sentence summary",
  "strengths": ["short bullet", "short bullet"],
  "risks": ["short bullet", "short bullet"],
  "nextSteps": ["short bullet", "short bullet"],
  "operatorNotes": "short paragraph for the creator"
}

Keep the notes practical for creators recording interviews or podcasts with one phone.
Focus on framing behavior, switching stability, overlap handling, and what to improve next.
`;
}

function buildFallbackInsights(project: ProjectDetail): ProjectInsightResult {
  const latestRecording = project.recordings[0];
  const shotEvents = project.shotEvents;
  const eventCount = shotEvents.length;
  const averageConfidence =
    eventCount > 0 ? shotEvents.reduce((sum, event) => sum + event.confidence, 0) / eventCount : 0;
  const wideCount = shotEvents.filter((event) => event.shotType === "wide").length;
  const mediumCount = shotEvents.filter((event) => event.shotType === "medium").length;
  const closeCount = shotEvents.filter((event) => event.shotType === "close").length;
  const durationMs = latestRecording?.durationMs ?? 0;
  const switchesPerMinute = durationMs > 0 ? eventCount / Math.max(durationMs / 60_000, 1) : eventCount;
  const stableConfidence = averageConfidence >= 0.7;
  const wideHeavy = eventCount > 0 && wideCount / eventCount >= 0.45;
  const closeHeavy = eventCount > 0 && closeCount / eventCount >= 0.3;

  return {
    source: "fallback",
    summary: `This ${project.mode} session ran for ${formatClock(durationMs)} and produced ${eventCount} shot events. The planner leaned ${wideHeavy ? "wide for safety and overlap control" : mediumCount >= wideCount ? "toward medium speaker framing" : "toward broader scene coverage"}, with average shot confidence around ${formatPercent(averageConfidence)}.`,
    strengths: [
      stableConfidence ? "Shot confidence stayed reasonably stable for a prototype session." : "The system still produced a usable directed timeline despite lower confidence moments.",
      mediumCount >= closeCount ? "Medium framing remained the default emphasis, which fits interviews and podcasts well." : "Close framing appeared often enough to give the speaker emphasis when the planner felt confident.",
      wideCount > 0 ? "Wide resets were present to protect overlap and scene energy spikes." : "The planner stayed mostly focused on speaker-driven framing without constant resets."
    ],
    risks: [
      switchesPerMinute > 18 ? "Shot changes may feel busy and could benefit from a longer minimum hold." : "Switch pacing looks testable, but it can still become jumpy when the speaker heuristic spikes.",
      !stableConfidence ? "Confidence is below the preferred range, so the tracker or speaker heuristic may still wobble on-device." : "Confidence looks decent overall, but overlap and motion spikes can still interrupt a clean cut rhythm.",
      closeHeavy ? "Close framing is relatively frequent, which may feel aggressive in multi-person conversations." : "The planner may still be conservative about close-ups when confidence rises."
    ],
    nextSteps: [
      "Test with a wider setup so every participant stays fully visible throughout the session.",
      "Compare Calm and Dynamic modes on the same scene to tune switching cadence.",
      "Upgrade to face landmarks or mouth-activity signals next so speaker confidence becomes more reliable."
    ],
    operatorNotes: stableConfidence
      ? "This flow is ready for hands-on testing. Keep the phone locked off, give everyone a little extra headroom, and review where wide resets helped or interrupted the conversation."
      : "This is still good enough to test end to end. For the next pass, improve lighting, reduce background noise, and make sure every speaker stays clearly visible so the planner gets steadier inputs."
  };
}

export async function getProjectInsights(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    return null;
  }

  const prompt = buildProjectInsightPrompt(project);
  const health = await getLocalLlmHealth();
  let insight: ProjectInsightResult;

  if (health.reachable && health.availableModels.includes(health.model)) {
    try {
      insight = await generateLocalProjectInsights({ prompt });
    } catch {
      insight = buildFallbackInsights(project);
    }
  } else {
    insight = buildFallbackInsights(project);
  }

  return {
    projectId: project.id,
    insight
  };
}
