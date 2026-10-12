import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import {
  EnvironmentId,
  ScheduledTaskId,
  ThreadId,
  type ScheduledTaskUpsertInput,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as ThreadManagement from "../orchestration-v2/ThreadManagementService.ts";
import * as ProviderAdapterRegistry from "../orchestration-v2/ProviderAdapterRegistry.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as ScheduledTasks from "../scheduledTasks/ScheduledTaskService.ts";
import * as SecretRequests from "../secrets/SecretRequests.ts";
import * as ServerSettings from "../serverSettings.ts";
import type { McpInvocationScope } from "./McpInvocationContext.ts";
import { idleThreadProjection, liveThreadShell } from "./McpToolAccess.testkit.ts";
import * as OrchestratorMcp from "./OrchestratorMcpService.ts";

it.effect.each(
  [undefined, false, true].flatMap((bindToCurrentThread) =>
    [null, "release"].map((branch) => ({ bindToCurrentThread, branch })),
  ),
)(
  "schedule_task preserves binding $bindToCurrentThread defaults on branch $branch",
  ({ bindToCurrentThread, branch }) => {
    const parent = {
      ...liveThreadShell(ThreadId.make("caller"), {
        runtimeMode: "approval-required",
        interactionMode: "plan",
      }),
      branch,
    };
    const scope: McpInvocationScope = {
      environmentId: EnvironmentId.make("remote-machine"),
      requestNamespace: "provider-session",
      thread: {
        threadId: parent.id,
        providerSessionId: "provider-session",
        providerInstanceId: parent.providerInstanceId,
      },
      client: undefined,
      capabilities: new Set(["orchestration"]),
      issuedAt: 1,
    };
    let saved: ScheduledTaskUpsertInput | undefined;
    const dependencies = Layer.mergeAll(
      NodeServices.layer,
      ServerSettings.layerTest(),
      Layer.mock(ThreadManagement.ThreadManagementService)({
        getThreadRecords: () => Effect.succeed(idleThreadProjection(parent)),
        getThreadShell: () => Effect.succeed(parent),
      }),
      Layer.mock(ProviderRegistry.ProviderRegistry)({ getProviders: Effect.succeed([]) }),
      Layer.mock(ProviderAdapterRegistry.ProviderAdapterRegistryV2)({
        list: () => Effect.succeed([]),
      }),
      Layer.mock(SecretRequests.SecretRequests)({}),
      Layer.mock(ProjectService.ProjectService)({
        getById: () =>
          Effect.succeed(
            Option.some({
              id: parent.projectId,
              title: "Project",
              workspaceRoot: "/remote/project",
              defaultModelSelection: parent.modelSelection,
              scripts: [],
              createdAt: "2026-10-12T00:00:00.000Z",
              updatedAt: "2026-10-12T00:00:00.000Z",
              deletedAt: null,
            }),
          ),
      }),
      Layer.mock(ScheduledTasks.ScheduledTaskService)({
        upsert: (input) =>
          Effect.sync(() => {
            saved = input;
            return {
              task: {
                ...input,
                id: ScheduledTaskId.make("saved-task"),
                threadId: input.threadId ?? null,
                schedule: { type: "interval" as const, everyMs: 60_000 },
                createdBy: input.createdBy ?? "agent",
                creationSource: input.creationSource ?? "mcp",
                createdAt: "2026-10-12T00:00:00.000Z",
                updatedAt: "2026-10-12T00:00:00.000Z",
                nextRunAt: "2026-10-12T00:01:00.000Z",
                lastRunAt: null,
                lastRunStatus: "never" as const,
                lastRunError: null,
                runCount: 0,
              },
            };
          }),
      }),
    );
    return Effect.gen(function* () {
      const mcp = yield* OrchestratorMcp.OrchestratorMcpService;
      const task = yield* mcp.scheduleTask(scope, {
        prompt: "Review the project every minute",
        schedule: { type: "interval", everyMs: 60_000 },
        ...(bindToCurrentThread === undefined ? {} : { bindToCurrentThread }),
      });
      const bound = bindToCurrentThread ?? true;
      assert.equal(task.boundThreadId, bound ? parent.id : null);
      assert.equal(saved?.projectId, parent.projectId);
      assert.deepEqual(saved?.modelSelection, parent.modelSelection);
      assert.equal(saved?.runtimeMode, "approval-required");
      assert.equal(saved?.interactionMode, "plan");
      assert.deepEqual(
        saved?.workspaceStrategy,
        bound || branch === null
          ? { type: "root" }
          : { type: "worktree", baseRef: branch, startFromOrigin: false },
      );
    }).pipe(Effect.provide(OrchestratorMcp.layer.pipe(Layer.provide(dependencies))));
  },
);
