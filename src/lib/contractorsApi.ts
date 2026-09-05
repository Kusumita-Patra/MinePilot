import type {
  Contractor,
  ContractorEquipment,
  ContractorStatus,
  ContractorWorker,
  WorkPermit,
} from "../../shared/types/contractors";
import { apiFetch } from "./api";
import mockData from "../../shared/mock-data/sample-contractors.json";

interface MockContractorsFile {
  contractors: Contractor[];
  workers: ContractorWorker[];
  permits: WorkPermit[];
  equipment: ContractorEquipment[];
}

const MOCK = mockData as unknown as MockContractorsFile;

export interface ApiResult<T> {
  data: T;
  source: "api" | "mock";
}

// No real Contractors backend exists yet (net-new scope, not in PLAN.md).
// Every function tries the real endpoint first, falling back to an
// in-memory copy of the mock JSON so status changes persist for the tab.
let sessionContractors: Contractor[] | null = null;
function getSessionContractors(): Contractor[] {
  if (!sessionContractors) sessionContractors = MOCK.contractors.map((c) => ({ ...c }));
  return sessionContractors;
}

export async function getContractors(): Promise<ApiResult<Contractor[]>> {
  try {
    // TODO(Team 3): GET /api/contractors -> ContractorListResponse
    const data = await apiFetch<Contractor[]>("/api/contractors");
    return { data, source: "api" };
  } catch {
    return { data: getSessionContractors(), source: "mock" };
  }
}

export async function getContractor(contractorId: string): Promise<ApiResult<Contractor | undefined>> {
  try {
    // TODO(Team 3): GET /api/contractors/{id} -> Contractor
    const data = await apiFetch<Contractor>(`/api/contractors/${contractorId}`);
    return { data, source: "api" };
  } catch {
    return { data: getSessionContractors().find((c) => c.contractorId === contractorId), source: "mock" };
  }
}

export async function getContractorWorkers(contractorId: string): Promise<ApiResult<ContractorWorker[]>> {
  try {
    // TODO(Team 3): GET /api/contractors/{id}/workers -> ContractorWorker[]
    const data = await apiFetch<ContractorWorker[]>(`/api/contractors/${contractorId}/workers`);
    return { data, source: "api" };
  } catch {
    return { data: MOCK.workers.filter((w) => w.contractorId === contractorId), source: "mock" };
  }
}

export async function getContractorPermits(contractorId: string): Promise<ApiResult<WorkPermit[]>> {
  try {
    // TODO(Team 3): GET /api/contractors/{id}/permits -> WorkPermit[]
    const data = await apiFetch<WorkPermit[]>(`/api/contractors/${contractorId}/permits`);
    return { data, source: "api" };
  } catch {
    return { data: MOCK.permits.filter((p) => p.contractorId === contractorId), source: "mock" };
  }
}

export async function getContractorEquipment(contractorId: string): Promise<ApiResult<ContractorEquipment[]>> {
  try {
    // TODO(Team 3): GET /api/contractors/{id}/equipment -> ContractorEquipment[]
    const data = await apiFetch<ContractorEquipment[]>(`/api/contractors/${contractorId}/equipment`);
    return { data, source: "api" };
  } catch {
    return { data: MOCK.equipment.filter((e) => e.contractorId === contractorId), source: "mock" };
  }
}

export interface CreateContractorInput {
  companyName: string;
  shortCode: string;
  scopeOfWork: string;
  registrationNumber: string | null;
  gstin: string | null;
  pan: string | null;
  clraLicenceNumber: string | null;
  contractNumber: string;
  contractStartDate: string;
  contractEndDate: string;
  assignedZoneIds: string[];
  contacts: Contractor["contacts"];
}

export async function createContractor(input: CreateContractorInput): Promise<ApiResult<Contractor>> {
  try {
    // TODO(Team 3): POST /api/contractors -> Contractor
    const data = await apiFetch<Contractor>("/api/contractors", { method: "POST", body: JSON.stringify(input) });
    return { data, source: "api" };
  } catch {
    const now = new Date().toISOString();
    const newContractor: Contractor = {
      contractorId: `contractor-local-${Date.now()}`,
      companyName: input.companyName,
      shortCode: input.shortCode,
      status: "ONBOARDING",
      registrationNumber: input.registrationNumber,
      gstin: input.gstin,
      pan: input.pan,
      clraLicenceNumber: input.clraLicenceNumber,
      contractNumber: input.contractNumber,
      scopeOfWork: input.scopeOfWork,
      contractValue: null,
      contractCurrency: "INR",
      contractStartDate: input.contractStartDate,
      contractEndDate: input.contractEndDate,
      daysUntilContractEnd: null,
      address: null,
      contacts: input.contacts,
      assignedZoneIds: input.assignedZoneIds,
      complianceItems: [],
      compliancePercentage: 0,
      overallComplianceState: "MISSING",
      totalWorkers: 0,
      workersOnSite: 0,
      workersBlocked: 0,
      safetyMetrics: {
        manHoursTotal: 0,
        manHoursThisMonth: 0,
        incidentCount: 0,
        nearMissCount: 0,
        firstAidCaseCount: 0,
        lostTimeInjuryCount: 0,
        fatalityCount: 0,
        ltifr: 0,
        safetyObservationsRaised: 0,
        safetyObservationsClosed: 0,
        violationCount: 0,
        safetyScore: 0,
        scoreTrend: [],
        aiRiskScore: null,
        aiRiskBand: null,
        aiRiskFactors: [],
      },
      documentIds: [],
      suspensionReason: null,
      suspendedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    getSessionContractors().unshift(newContractor);
    return { data: newContractor, source: "mock" };
  }
}

export async function updateContractorStatus(
  contractorId: string,
  status: ContractorStatus,
  reason: string | null
): Promise<ApiResult<Contractor | undefined>> {
  try {
    // TODO(Team 3): PATCH /api/contractors/{id}/status -> Contractor
    const data = await apiFetch<Contractor>(`/api/contractors/${contractorId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
    return { data, source: "api" };
  } catch {
    const contractors = getSessionContractors();
    const idx = contractors.findIndex((c) => c.contractorId === contractorId);
    if (idx === -1) return { data: undefined, source: "mock" };
    const now = new Date().toISOString();
    const isRestricted = status === "SUSPENDED" || status === "BLACKLISTED";
    contractors[idx] = {
      ...contractors[idx],
      status,
      suspensionReason: isRestricted ? reason : null,
      suspendedAt: isRestricted ? now : null,
      updatedAt: now,
    };
    return { data: contractors[idx], source: "mock" };
  }
}
