import { apiFetch } from "./api";

export type WorkerLocationSourceType = "SIMULATED" | "REAL_TRACKER" | "MANUAL";

export interface WorkerLocation {
  worker_id: string;
  worker_name: string;
  role: "administrator" | "mine_manager" | "field_worker";
  current_node_id: string | null;
  node_label: string | null;
  node_type: "JUNCTION" | "EXIT" | "REFUGE_CHAMBER" | "WORK_AREA" | null;
  sector_id: string | null;
  world_x: number | null;
  world_y: number | null;
  world_z: number | null;
  source_type: WorkerLocationSourceType;
  last_moved_at: string | null;
  is_active: boolean;
}

export async function getWorkerLocations(): Promise<WorkerLocation[]> {
  return apiFetch<WorkerLocation[]>("/api/worker-locations");
}
