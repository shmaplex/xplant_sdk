import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
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
  list(params: PageParams = {}, options?: RequestOptions): ListPromise<SopSummary> {
    return new ListPromise(
      (page) =>
        this.request<SopSummary[]>(
          `/api/v1/sops${toQuery({ limit: page.limit, offset: page.offset, cursor: page.cursor })}`,
          {},
          options,
        ),
      params,
    );
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
