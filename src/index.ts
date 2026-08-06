// @shmaplex/xplant-sdk — public API surface
// https://github.com/shmaplex/xplant-sdk

export { XPlantClient, XPlantError, DEFAULT_BASE_URL } from "./client.js";
export type { XPlantClientConfig, EnvelopeRequestFn, RequestFn } from "./client.js";

export { SensorReadingsResource } from "./resources/sensor-readings.js";
export { DevicesResource } from "./resources/devices.js";
export { PlantsResource } from "./resources/plants.js";
export { TasksResource } from "./resources/tasks.js";
export { LabelsResource } from "./resources/labels.js";

export type {
  XPlantApiResponse,
  PageParams,
  SensorType,
  SensorUnit,
  SensorReadingPayload,
  SensorReading,
  SensorReadingListParams,
  DeviceType,
  DeviceRegisterPayload,
  DeviceEventType,
  DeviceEventPayload,
  DeviceEvent,
  DeviceHeartbeatPayload,
  HeartbeatResponse,
  DeviceSummary,
  PlantSummary,
  TaskPriority,
  TaskWorkflowStatus,
  TaskCategory,
  PrioritySource,
  TaskSummary,
  TaskListParams,
  TaskCreateInput,
  TaskUpdateInput,
  PriorityWriteReport,
  TaskUpdateResult,
  LabelResolveResult,
} from "./types.js";
