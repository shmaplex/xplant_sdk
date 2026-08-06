import type { EnvelopeRequestFn } from "../client.js";
import { toQuery } from "../query.js";
import type { LabelResolveResult } from "../types.js";

export class LabelsResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Resolve a barcode or QR code string to its linked xPlant record.
   * Useful for scan stations that need to look up what a label refers to.
   * Requires the `read:labels` scope.
   *
   * Throws {@link XPlantError} with status 404 when nothing in the workspace
   * matches the code.
   *
   * @example
   * const result = await client.labels.resolve("XPL-2025-001");
   * // result.record_type === "explant"
   * // result.url === "/dashboard/explants/..."
   */
  async resolve(barcode: string): Promise<LabelResolveResult> {
    const { data } = await this.request<LabelResolveResult>(
      `/api/v1/labels/resolve${toQuery({ barcode })}`,
    );
    return data;
  }
}
