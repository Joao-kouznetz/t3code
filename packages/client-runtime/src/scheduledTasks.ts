import type { ProjectId, ScheduledTask, ScheduledTaskUpsertInput } from "@t3tools/contracts";

/** A prompt's execution settings, captured before opening either client's schedule editor. */
export type ScheduledTaskPromptSource = Pick<
  ScheduledTaskUpsertInput,
  | "prompt"
  | "projectId"
  | "modelSelection"
  | "runtimeMode"
  | "interactionMode"
  | "workspaceStrategy"
>;

export function scheduledTaskPromptDraft(source: ScheduledTaskPromptSource) {
  const prompt = source.prompt.trim();
  return {
    ...source,
    prompt,
    title: prompt.split("\n")[0]?.slice(0, 80) || "Recurring task",
    enabled: true,
    // A draft thread is only the source of the prompt, never the destination of runs.
    threadId: null,
  } satisfies Omit<ScheduledTaskUpsertInput, "schedule">;
}

/** Call once per environment: project IDs are local to their machine. */
export function groupScheduledTasksByProject(tasks: readonly ScheduledTask[]) {
  const groups = new Map<ProjectId, ScheduledTask[]>();
  for (const task of tasks) {
    const group = groups.get(task.projectId);
    if (group) group.push(task);
    else groups.set(task.projectId, [task]);
  }
  return [...groups].map(([projectId, tasks]) => ({ projectId, tasks }));
}
