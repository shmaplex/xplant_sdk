import type { EnvelopeRequestFn } from "../client.js";
import type { MeResponse, RequestOptions } from "../types.js";

export class MeResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Describe the API key this client was made with: its name and prefix, every
   * scope it holds, and the workspace it acts in.
   * Requires no scope — any valid workspace key may ask what it is.
   *
   * Call it at startup to fail early with a clear message when a key is
   * missing a scope, instead of meeting a 403 halfway through a sync.
   *
   * @example
   * const me = await client.me.get();
   * if (!me.scopes.includes("write:tasks")) {
   *   throw new Error(`Key "${me.key.name}" cannot create tasks`);
   * }
   */
  async get(options?: RequestOptions): Promise<MeResponse> {
    const { data } = await this.request<MeResponse>("/api/v1/me", {}, options);
    return data;
  }
}
