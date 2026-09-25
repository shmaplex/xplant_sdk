import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type {
  PriorityWriteReport,
  RequestOptions,
  TaskCreateInput,
  TaskListParams,
  TaskSummary,
  TaskUpdateInput,
  TaskUpdateResult,
  WriteOptions,
} from "../types.js";

/**
 * Reads `meta.priority_write` without trusting its shape, so an unrecognised
 * report is reported as "not applied" rather than quietly dropped.
 */
function readPriorityWrite(meta: Record<string, unknown> | undefined): PriorityWriteReport | null {
  const report = meta?.priority_write;
  if (report === null || report === undefined || typeof report !== "object") return null;

  const { applied, reason, priority_source, message } = report as Record<string, unknown>;
  return {
    applied: applied === true,
    ...(reason === "manual_override" ? { reason: "manual_override" as const } : {}),
    priority_source: typeof priority_source === "string" ? priority_source : "default",
    message: typeof message === "string" ? message : "",
  };
}

export class TasksResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List tasks for the workspace, soonest due first.
   * Requires the `read:tasks` scope.
   *
   * @example
   * const todo = await client.tasks.list({ status: "todo", limit: 50 });
   */
  async list(params: TaskListParams = {}, options?: RequestOptions): Promise<TaskSummary[]> {
    const { data } = await this.request<TaskSummary[]>(
      `/api/v1/tasks${toQuery({
        limit: params.limit,
        offset: params.offset,
        status: params.status,
        assigned_to: params.assigned_to,
      })}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Get a single task by ID, including its plant or explant link.
   * Requires the `read:tasks` scope.
   *
   * @example
   * const task = await client.tasks.get(taskId);
   */
  async get(taskId: string, options?: RequestOptions): Promise<TaskSummary> {
    const { data } = await this.request<TaskSummary>(
      `/api/v1/tasks/${encodeURIComponent(taskId)}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Create a task.
   * Requires the `write:tasks` scope.
   *
   * A new task has no order for anyone to have set, so `priority` and
   * `priority_rank` always apply here.
   *
   * Safe to retry: the API runs a create once per `Idempotency-Key` and answers
   * a repeat with the task it already made.
   *
   * @example
   * await client.tasks.create(
   *   { title: "Replate N2001 — second pass", priority: "high", assigned_to: memberId },
   *   { idempotencyKey: "replate-N2001-pass-2" },
   * );
   */
  async create(input: TaskCreateInput, options?: WriteOptions): Promise<TaskSummary> {
    const { data } = await this.request<TaskSummary>(
      "/api/v1/tasks",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }

  /**
   * Update a task.
   * Requires the `write:tasks` scope.
   *
   * A write over this API counts as automatic, and an automated write never
   * overwrites an order somebody set by hand. If the task's `priority_source`
   * is `manual`, the ordering part of your patch is **skipped** — the request
   * still succeeds and the non-ordering fields still apply.
   *
   * That skip is reported, not swallowed: check `skipped` before treating a
   * sync as complete. Send `release: true` to take the task back under
   * automatic control.
   *
   * @example
   * const result = await client.tasks.update(taskId, { priority_rank: 1500 });
   * if (result.skipped) {
   *   // Someone positioned this task by hand; re-send with release: true to override.
   *   console.warn(result.priority_write?.message);
   * }
   */
  async update(
    taskId: string,
    input: TaskUpdateInput,
    options?: WriteOptions,
  ): Promise<TaskUpdateResult> {
    const { data, meta } = await this.request<TaskSummary>(
      `/api/v1/tasks/${encodeURIComponent(taskId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
      options,
    );
    const priorityWrite = readPriorityWrite(meta);
    return {
      task: data,
      priority_write: priorityWrite,
      skipped: priorityWrite !== null && !priorityWrite.applied,
    };
  }
}
