import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type {
  LabelResolveResult,
  LabelScan,
  LabelScanInput,
  RequestOptions,
  WriteOptions,
} from "../types.js";

export class LabelsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Resolve a barcode or QR code string to its linked xPlant record.
   * Useful for scan stations that need to look up what a label refers to.
   * Requires the `read:labels` scope.
   *
   * Plant and explant labels are tried first, then container labels — which
   * resolve to a location and list its `contents` — then your own external
   * ids. Throws {@link XPlantError} with status 404 when nothing in the
   * workspace matches the code.
   *
   * Resolving leaves no trace. Call {@link recordScan} to record that the scan
   * happened.
   *
   * @example
   * const result = await client.labels.resolve("XPL-2025-001");
   * // result.record_type === "explant"
   * // result.url === "/dashboard/explants/..."
   */
  async resolve(barcode: string, options?: RequestOptions): Promise<LabelResolveResult> {
    const { data } = await this.request<LabelResolveResult>(
      `/api/v1/labels/resolve${toQuery({ barcode })}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Record that a scan happened — who was at which shelf, and when.
   * Requires the `write:label_scans` scope.
   *
   * Append-only. `resolved` in the result is derived from whether you named a
   * plant or explant. Safe to retry with an `Idempotency-Key`, so a scanner on
   * a patchy link records one visit rather than two.
   *
   * @example
   * const hit = await client.labels.resolve(code);
   * await client.labels.recordScan({
   *   barcode: code,
   *   explant_id: hit.record_type === "explant" ? hit.record_id : undefined,
   *   context: "Growth room 2, shelf 3",
   * });
   */
  async recordScan(input: LabelScanInput, options?: WriteOptions): Promise<LabelScan> {
    const { data } = await this.request<LabelScan>(
      "/api/v1/label-scans",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
