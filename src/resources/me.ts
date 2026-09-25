import type { EnvelopeRequestFn } from "../client.js";
import type { MeResponse, RequestOptions } from "../types.js";

export class MeResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Describe the API key this client was made with: its name and prefix, its
   * scopes, what it can use right now, its owner's role, and the workspace it
   * acts in.
   * Requires no scope — any valid workspace key may ask what it is.
   *
   * Call it at startup to fail early with a clear message, instead of meeting
   * a 402 or 403 halfway through a sync. `effectiveScopes` already accounts
   * for the owner's role and the workspace's plan.
   *
   * @example
   * const me = await client.me.get();
   * if (!me.effectiveScopes.includes("write:tasks")) {
   *   throw new Error(
   *     `Key "${me.key.name}" cannot create tasks (role: ${me.role}, API access: ${me.apiAccess})`,
   *   );
   * }
   */
  async get(options?: RequestOptions): Promise<MeResponse> {
    const { data } = await this.request<MeResponse>("/api/v1/me", {}, options);
    return data;
  }
}
