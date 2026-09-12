import { apiFetch } from "./api";

export type DataSourceType = "REAL_SENSOR" | "SIMULATED_SENSOR" | "MANUAL_ENTRY" | "CALCULATED" | "AI_ESTIMATE";
export type EnvironmentalCategory =
  | "AIR"
  | "WATER"
  | "WASTE"
  | "EMISSIONS"
  | "LAND"
  | "NOISE"
  | "BIODIVERSITY"
  | "RECLAMATION"
  | "OTHER";
export type SustainabilityCategory =
  | "WATER"
  | "ENERGY"
  | "WASTE"
  | "LAND"
  | "ENVIRONMENTAL"
  | "SAFETY"
  | "COMPLIANCE"
  | "LABOUR"
  | "OVERALL";
export type TargetPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type CorrectiveActionSourceType = "INCIDENT" | "ENVIRONMENTAL_REQUIREMENT" | "INSPECTION" | "MANUAL";
export type CorrectiveActionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CorrectiveActionStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED" | "CANCELLED";

// ---------------------------------------------------------------------------
// Environmental requirements
// ---------------------------------------------------------------------------

export interface EnvironmentalRequirement {
  id: string;
  category: EnvironmentalCategory;
  name: string;
  description: string | null;
  parameter: string;
  unit: string;
  warning_threshold: number | null;
  critical_threshold: number | null;
  regulatory_reference: string | null;
  authority: string | null;
  frequency: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getEnvironmentalRequirements(): Promise<EnvironmentalRequirement[]> {
  return apiFetch<EnvironmentalRequirement[]>("/api/environment/requirements");
}

export async function createEnvironmentalRequirement(payload: {
  category: EnvironmentalCategory;
  name: string;
  description?: string;
  parameter: string;
  unit: string;
  warning_threshold?: number;
  critical_threshold?: number;
  regulatory_reference?: string;
  authority?: string;
  frequency?: string;
}): Promise<EnvironmentalRequirement> {
  return apiFetch<EnvironmentalRequirement>("/api/environment/requirements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Water metrics
// ---------------------------------------------------------------------------

export interface WaterMetric {
  id: string;
  sector_id: string | null;
  recorded_date: string;
  water_consumed_m3: number;
  water_extracted_m3: number;
  water_reused_m3: number;
  water_discharged_m3: number;
  rainwater_collected_m3: number | null;
  production_tonnes: number | null;
  data_source: DataSourceType;
  created_at: string;
  reuse_pct: number | null;
  efficiency_m3_per_tonne: number | null;
}

export interface WaterSummary {
  date: string;
  sector_id: string | null;
  water_used_m3: number;
  water_reused_m3: number;
  reuse_rate_pct: number | null;
  water_discharged_m3: number;
  efficiency_m3_per_tonne: number | null;
  data_source: DataSourceType | null;
}

export async function getWaterMetrics(): Promise<WaterMetric[]> {
  return apiFetch<WaterMetric[]>("/api/water/metrics");
}

export async function createWaterMetric(payload: {
  sector_id?: string;
  recorded_date: string;
  water_consumed_m3: number;
  water_extracted_m3: number;
  water_reused_m3: number;
  water_discharged_m3: number;
  rainwater_collected_m3?: number;
  production_tonnes?: number;
  data_source: "SIMULATED_SENSOR" | "MANUAL_ENTRY";
}): Promise<WaterMetric> {
  return apiFetch<WaterMetric>("/api/water/metrics", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getWaterSummary(): Promise<WaterSummary> {
  return apiFetch<WaterSummary>("/api/water/summary");
}

// ---------------------------------------------------------------------------
// Corrective actions
// ---------------------------------------------------------------------------

export interface CorrectiveAction {
  id: string;
  source_type: CorrectiveActionSourceType;
  source_id: string | null;
  title: string;
  description: string | null;
  priority: CorrectiveActionPriority;
  assigned_to: string | null;
  due_date: string | null;
  status: CorrectiveActionStatus;
  created_at: string;
  completed_at: string | null;
  verification_required: boolean;
  verified_by: string | null;
  verification_date: string | null;
  remarks: string | null;
  evidence_url: string | null;
  is_overdue: boolean;
}

export async function getCorrectiveActions(): Promise<CorrectiveAction[]> {
  return apiFetch<CorrectiveAction[]>("/api/corrective-actions");
}

export async function createCorrectiveAction(payload: {
  source_type: CorrectiveActionSourceType;
  source_id?: string;
  title: string;
  description?: string;
  priority?: CorrectiveActionPriority;
  due_date?: string;
  verification_required?: boolean;
}): Promise<CorrectiveAction> {
  return apiFetch<CorrectiveAction>("/api/corrective-actions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function transitionCorrectiveAction(
  actionId: string,
  status: CorrectiveActionStatus
): Promise<CorrectiveAction> {
  return apiFetch<CorrectiveAction>(`/api/corrective-actions/${actionId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function verifyCorrectiveAction(
  actionId: string,
  payload: { remarks?: string; evidence_url?: string } = {}
): Promise<CorrectiveAction> {
  return apiFetch<CorrectiveAction>(`/api/corrective-actions/${actionId}/verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Sustainability targets, scores, dashboard
// ---------------------------------------------------------------------------

export interface SustainabilityTarget {
  id: string;
  category: SustainabilityCategory;
  metric: string;
  target_value: number;
  unit: string;
  period: TargetPeriod;
  warning_percentage: number | null;
  critical_percentage: number | null;
  is_active: boolean;
}

export async function getSustainabilityTargets(): Promise<SustainabilityTarget[]> {
  return apiFetch<SustainabilityTarget[]>("/api/sustainability/targets");
}

export async function createSustainabilityTarget(payload: {
  category: SustainabilityCategory;
  metric: string;
  target_value: number;
  unit: string;
  period: TargetPeriod;
  warning_percentage?: number;
  critical_percentage?: number;
}): Promise<SustainabilityTarget> {
  return apiFetch<SustainabilityTarget>("/api/sustainability/targets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface SustainabilityScore {
  category: SustainabilityCategory;
  score_pct: number;
  methodology_notes: string;
  data_source: DataSourceType;
  time_range_start: string;
  time_range_end: string;
  computed_at: string;
  contributing_metrics: Record<string, unknown>;
}

export async function getSustainabilityScores(): Promise<SustainabilityScore[]> {
  return apiFetch<SustainabilityScore[]>("/api/sustainability/scores");
}

export interface SustainabilityInsight {
  message: string;
  severity: "info" | "warning" | "critical";
  data_source: DataSourceType;
  metric: string;
}

export interface SustainabilityDashboard {
  overall_score: SustainabilityScore;
  sub_scores: SustainabilityScore[];
  water_summary: WaterSummary;
  open_environmental_actions: CorrectiveAction[];
  insights: SustainabilityInsight[];
}

export async function getSustainabilityDashboard(): Promise<SustainabilityDashboard> {
  return apiFetch<SustainabilityDashboard>("/api/sustainability/dashboard");
}
