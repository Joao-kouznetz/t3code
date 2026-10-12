import { describe, expect, it } from "vite-plus/test";
import {
  ProjectId,
  ProviderInstanceId,
  ScheduledTaskId,
  type ScheduledTask,
} from "@t3tools/contracts";

import { groupScheduledTasksByProject, scheduledTaskPromptDraft } from "./scheduledTasks.ts";

describe("scheduledTaskPromptDraft", () => {
  it.each(["codex", "claudeCode", "cursor", "grok", "opencode", "antigravity", "custom-provider"])(
    "preserves %s model options and execution settings without binding to the draft thread",
    (instance) => {
      const modelSelection = {
        instanceId: ProviderInstanceId.make(instance),
        model: "selected-model",
        options: [{ id: "reasoning", value: "high" }],
      };
      const workspaceStrategy = {
        type: "worktree" as const,
        baseRef: "release",
        startFromOrigin: false,
      };
      const result = scheduledTaskPromptDraft({
        prompt: "  Audit open issues\nReport any regressions.  ",
        projectId: ProjectId.make("project-on-remote-machine"),
        modelSelection,
        workspaceStrategy,
        runtimeMode: "approval-required",
        interactionMode: "plan",
      });
      expect(result).toMatchObject({
        prompt: "Audit open issues\nReport any regressions.",
        title: "Audit open issues",
        projectId: "project-on-remote-machine",
        threadId: null,
        runtimeMode: "approval-required",
        interactionMode: "plan",
      });
      expect(result.modelSelection).toEqual(modelSelection);
      expect(result.workspaceStrategy).toEqual(workspaceStrategy);
    },
  );
});

it("groups interleaved schedules by project without losing tasks or changing their order", () => {
  const task = (id: string, projectId: string) =>
    ({ id: ScheduledTaskId.make(id), projectId: ProjectId.make(projectId) }) as ScheduledTask;
  const tasks = [task("one", "a"), task("two", "b"), task("three", "a")];
  expect(groupScheduledTasksByProject(tasks)).toEqual([
    { projectId: "a", tasks: [tasks[0], tasks[2]] },
    { projectId: "b", tasks: [tasks[1]] },
  ]);
  expect(tasks.map((task) => task.id)).toEqual(["one", "two", "three"]);
});
