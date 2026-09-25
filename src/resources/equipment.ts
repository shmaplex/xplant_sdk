import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  EquipmentEvent,
  EquipmentEventInput,
  EquipmentHistoryEntry,
  EquipmentHistoryParams,
  EquipmentItem,
  EquipmentListParams,
  RequestOptions,
  WriteOptions,
} from "../types.js";

export class EquipmentResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the lab's equipment library.
   * Requires the `read:equipment` scope.
   *
   * @example
   * for await (const item of client.equipment.list({ category: "autoclave_pressure_cooker" })) {
   *   console.log(item.name, item.next_calibration_due_at);
   * }
   */
  list(params: EquipmentListParams = {}, options?: RequestOptions): ListPromise<EquipmentItem> {
    return new ListPromise(
      (page) =>
        this.request<EquipmentItem[]>(
          `/api/v1/equipment${toQuery({
            category: params.category,
            status: params.status,
            limit: page.limit,
            offset: page.offset,
            cursor: page.cursor,
          })}`,
          {},
          options,
        ),
      params,
    );
  }

  /**
   * Get one piece of equipment, with its calibration and maintenance due dates.
   * Requires the `read:equipment` scope.
   *
   * @example
   * const hood = await client.equipment.get(equipmentId);
   */
  async get(equipmentId: string, options?: RequestOptions): Promise<EquipmentItem> {
    const { data } = await this.request<EquipmentItem>(
      `/api/v1/equipment/${encodeURIComponent(equipmentId)}`,
      {},
      options,
    );
    return data;
  }

  /**
   * List an item's history: what it was used on, and its calibrations and
   * preventive maintenance.
   * Requires the `read:equipment` scope. Calibration and maintenance history
   * also needs a plan that includes it — otherwise `402 FEATURE_NOT_INCLUDED`.
   *
   * @example
   * for await (const entry of client.equipment.listEvents(autoclaveId, { kind: "calibration" })) {
   *   console.log(entry.occurred_at, entry.outcome, entry.certificate_number);
   * }
   */
  listEvents(
    equipmentId: string,
    params: EquipmentHistoryParams = {},
    options?: RequestOptions,
  ): ListPromise<EquipmentHistoryEntry> {
    return new ListPromise(
      (page) =>
        this.request<EquipmentHistoryEntry[]>(
          `/api/v1/equipment/${encodeURIComponent(equipmentId)}/events${toQuery({
            kind: params.kind,
            from: params.from,
            to: params.to,
            limit: page.limit,
            offset: page.offset,
            cursor: page.cursor,
          })}`,
          {},
          options,
        ),
      params,
    );
  }

  /**
   * Report on a piece of equipment: that it was used on a record, or that it
   * was calibrated or had preventive maintenance.
   * Requires the `write:equipment_events` scope.
   *
   * `kind: "used"` needs the record it was used on, and that record must be in
   * your workspace. `"calibration"` and `"preventive_maintenance"` take an
   * `outcome`.
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
