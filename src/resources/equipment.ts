import type { EnvelopeRequestFn } from "../client.js";
import type { EquipmentEvent, EquipmentEventInput, WriteOptions } from "../types.js";

export class EquipmentResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * Report on a piece of equipment: that it was used on a record, or that it
   * was calibrated, serviced, verified, or faulted.
   * Requires the `write:equipment_events` scope.
   *
   * `kind: "used"` needs the record it was used on, and that record must be in
   * your workspace. Every other kind is a maintenance event, with an `outcome`
   * that defaults to `"pass"`.
   *
   * Append-only, and safe to retry with an `Idempotency-Key` — an autoclave on
   * a flaky link records one calibration, not two.
   *
   * @example
   * await client.equipment.recordEvent(autoclaveId, {
   *   kind: "calibration",
   *   outcome: "pass",
   *   result_summary: "121.1 °C held for 15 min",
   * });
   *
   * @example
   * await client.equipment.recordEvent(hoodId, {
   *   kind: "used",
   *   subject_type: "sop_log",
   *   subject_id: runId,
   * });
   */
  async recordEvent(
    equipmentId: string,
    event: EquipmentEventInput,
    options?: WriteOptions,
  ): Promise<EquipmentEvent> {
    const { data } = await this.request<EquipmentEvent>(
      `/api/v1/equipment/${encodeURIComponent(equipmentId)}/events`,
      { method: "POST", body: JSON.stringify(event) },
      { ...options, idempotent: true },
    );
    return data;
  }
}
