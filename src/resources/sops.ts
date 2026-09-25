import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type { PageParams, RequestOptions, SopDetail, SopSummary } from "../types.js";

export class SopsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the workspace's protocols, most recently updated first. Summaries
   * only — fetch one with {@link get} for its steps.
   * Requires the `read:sops` scope.
   *
   * @example
   * const sops = await client.sops.list({ limit: 20 });
   */
  async list(params: PageParams = {}, options?: RequestOptions): Promise<SopSummary[]> {
    const { data } = await this.request<SopSummary[]>(
      `/api/v1/sops${toQuery({ limit: params.limit, offset: params.offset })}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Get one protocol and the version the lab works from.
   * Requires the `read:sops` scope.
   *
   * `version` is the version in force — never a draft, and never an approved
   * version that has not taken effect. It is `null` when the lab has no
   * version in force, and then there are no steps to follow: check for that
   * before showing a procedure at the bench.
   *
   * @example
   * const sop = await client.sops.get(sopId);
   * if (!sop.version) throw new Error(`${sop.title} has no version in force`);
   * console.log(sop.version.steps);
   */
  async get(sopId: string, options?: RequestOptions): Promise<SopDetail> {
    const { data } = await this.request<SopDetail>(
      `/api/v1/sops/${encodeURIComponent(sopId)}`,
      {},
      options,
    );
    return data;
  }
}
