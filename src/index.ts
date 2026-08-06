// @shmaplex/xplant-sdk — public API surface
// https://github.com/shmaplex/xplant-sdk

export { XPlantClient, XPlantError } from "./client.js";
export type { XPlantClientConfig, RequestFn } from "./client.js";

export { SensorReadingsResource } from "./resources/sensor-readings.js";
export { DevicesResource } from "./resources/devices.js";
export { PlantsResource } from "./resources/plants.js";
export { TasksResource } from "./resources/tasks.js";
export { LabelsResource } from "./resources/labels.js";

export type {
  XPlantApiResponse,
  SensorType,
  SensorUnit,
  SensorReadingPayload,
  SensorReading,
  DeviceEventPayload,
  DeviceEvent,
  DeviceHeartbeatPayload,
  HeartbeatResponse,
  DeviceSummary,
  PlantSummary,
  TaskSummary,
  TaskPriority,
  TaskCategory,
  WorkflowStatus,
  TaskCreatePayload,
  TaskUpdatePayload,
  LabelResolveResult,
} from "./types.js";
