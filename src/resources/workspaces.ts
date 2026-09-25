import type { EnvelopeRequestFn } from "../client.js";
import type { RequestOptions, Workspace } from "../types.js";

export class WorkspacesResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the workspaces this key can act in.
   * Requires the `read:workspace` scope.
   *
   * A key is created in one workspace and can only act there, so this holds
   * exactly one entry today. It is a list so the shape survives if that ever
   * changes — iterate it rather than reading `[0]` blindly.
   *
   * @example
   * const [workspace] = await client.workspaces.list();
   * console.log(`Writing to ${workspace.name}`);
   */
  async list(options?: RequestOptions): Promise<Workspace[]> {
    const { data } = await this.request<Workspace[]>("/api/v1/workspaces", {}, options);
    return data;
  }
}
