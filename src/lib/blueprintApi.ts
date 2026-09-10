import { API_URL, apiFetch } from "./api";
import { useAuthStore } from "./authStore";

/** Mirrors backend/app/schemas/blueprint.py's SectorId — kept in sync by hand
 * (small, stable, shared-contract-style set; see shared/types/telemetry.ts
 * for the same 4 values used by sensor.sector_id). */
export type BlueprintSectorId =
  | "sector_north_wall"
  | "sector_deep_shaft_b"
  | "sector_surface_conveyor"
  | "sector_main_pit";

export interface BlueprintSection {
  id: string;
  blueprint_id: string;
  sector_id: BlueprintSectorId;
  name: string;
  level_label: string;
  depth: number;
  path: [number, number][];
  created_at: string;
  updated_at: string;
}

export interface MineBlueprint {
  id: string;
  name: string;
  original_filename: string;
  content_type: string;
  image_width: number;
  image_height: number;
  uploaded_by: string;
  created_at: string;
  sections: BlueprintSection[];
}

export async function getActiveBlueprint(): Promise<MineBlueprint | null> {
  return apiFetch<MineBlueprint | null>("/api/blueprints/active");
}

export async function uploadBlueprint(params: {
  file: File;
  name: string;
  width: number;
  height: number;
}): Promise<MineBlueprint> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("name", params.name);
  formData.append("width", String(params.width));
  formData.append("height", String(params.height));
  return apiFetch<MineBlueprint>("/api/blueprints", { method: "POST", body: formData });
}

export async function createBlueprintSection(
  blueprintId: string,
  payload: {
    sector_id: BlueprintSectorId;
    name: string;
    level_label: string;
    depth: number;
    path: [number, number][];
  }
): Promise<BlueprintSection> {
  return apiFetch<BlueprintSection>(`/api/blueprints/${blueprintId}/sections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteBlueprintSection(blueprintId: string, sectionId: string): Promise<void> {
  await apiFetch<void>(`/api/blueprints/${blueprintId}/sections/${sectionId}`, { method: "DELETE" });
}

/** The image endpoint requires auth, and a plain <img src="..."> can't send
 * an Authorization header — so fetch it as a blob and hand back an object
 * URL instead. Caller is responsible for revoking the URL when done with it
 * (see useBlueprintImageUrl). */
export async function fetchBlueprintImageBlobUrl(blueprintId: string): Promise<string> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${API_URL}/api/blueprints/${blueprintId}/image`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Failed to load blueprint image: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Reads a File's pixel dimensions client-side (needed by the upload form,
 * since the backend stores width/height as reported by the browser rather
 * than decoding the image itself). */
export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}
