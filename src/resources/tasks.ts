import type { RequestFn } from "../client.js";
import type { TaskCreatePayload, TaskSummary, TaskUpdatePayload } from "../types.js";

export class TasksResource {
  constructor(private request: RequestFn) {}

  /**
   * List tasks for the workspace.
   * Requires the `read:tasks` scope.
   */
  list(): Promise<TaskSummary[]> {
    return this.request<TaskSummary[]>("/api/v1/tasks");
  }

  /**
   * Get a single task by ID.
   * Requires the `read:tasks` scope.
   */
  get(taskId: string): Promise<TaskSummary> {
    return this.request<TaskSummary>(
      `/api/v1/tasks/${encodeURIComponent(taskId)}`,
    );
  }

  /**
   * Create a task. Accepts `priority` and `assigned_to` so an external
   * scheduler can place work at the right rank in one call.
   * Requires the `write:tasks` scope.
   *
   * @example
   * await client.tasks.create({
   *   title: "Replate N2001",
   *   category: "transfer",
   *   priority: "urgent",
   *   assigned_to: "teammate-uuid",
   * });
   */
  create(payload: TaskCreatePayload): Promise<TaskSummary> {
    return this.request<TaskSummary>("/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update a task. Only supplied fields change.
   * Requires the `write:tasks` scope.
   *
   * @example
   * await client.tasks.update(taskId, { priority: "high" });
   */
  update(taskId: string, payload: TaskUpdatePayload): Promise<TaskSummary> {
    return this.request<TaskSummary>(
      `/api/v1/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  }
}
