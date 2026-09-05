"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Contractor, ContractorStatus } from "../../shared/types/contractors";
import type { ComplianceState } from "../../shared/types/documents";
import { createContractor, getContractors, updateContractorStatus, type CreateContractorInput } from "@/lib/contractorsApi";
import { computeContractorStats } from "@/lib/complianceUtils";

export interface ContractorFilterState {
  searchQuery: string;
  statuses: ContractorStatus[];
  complianceStates: ComplianceState[];
  zoneId: string | null;
  sortBy: "safetyScore" | "headcount" | "contractExpiry" | "compliancePercentage";
  sortDirection: "asc" | "desc";
}

const DEFAULT_FILTERS: ContractorFilterState = {
  searchQuery: "",
  statuses: [],
  complianceStates: [],
  zoneId: null,
  sortBy: "compliancePercentage",
  sortDirection: "asc",
};

export function useContractors(initialFilters?: Partial<ContractorFilterState>) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "mock">("mock");
  const [filters, setFilters] = useState<ContractorFilterState>({ ...DEFAULT_FILTERS, ...initialFilters });

  const refresh = useCallback(async () => {
    try {
      const result = await getContractors();
      setContractors(result.data);
      setSource(result.source);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contractors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const stats = useMemo(() => computeContractorStats(contractors), [contractors]);

  const filteredContractors = useMemo(() => {
    let list = contractors;
    const q = filters.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          (c.registrationNumber ?? "").toLowerCase().includes(q) ||
          c.contacts.some((ct) => ct.name.toLowerCase().includes(q))
      );
    }
    if (filters.statuses.length) list = list.filter((c) => filters.statuses.includes(c.status));
    if (filters.complianceStates.length)
      list = list.filter((c) => filters.complianceStates.includes(c.overallComplianceState));
    if (filters.zoneId) list = list.filter((c) => c.assignedZoneIds.includes(filters.zoneId as string));

    const dir = filters.sortDirection === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (filters.sortBy) {
        case "safetyScore":
          return (a.safetyMetrics.safetyScore - b.safetyMetrics.safetyScore) * dir;
        case "headcount":
          return (a.totalWorkers - b.totalWorkers) * dir;
        case "contractExpiry": {
          const aVal = a.daysUntilContractEnd ?? Number.POSITIVE_INFINITY;
          const bVal = b.daysUntilContractEnd ?? Number.POSITIVE_INFINITY;
          return (aVal - bVal) * dir;
        }
        case "compliancePercentage":
        default:
          return (a.compliancePercentage - b.compliancePercentage) * dir;
      }
    });
  }, [contractors, filters]);

  const setStatus = useCallback(
    async (contractorId: string, status: ContractorStatus, reason: string | null) => {
      await updateContractorStatus(contractorId, status, reason);
      await refresh();
    },
    [refresh]
  );

  const create = useCallback(
    async (input: CreateContractorInput) => {
      const result = await createContractor(input);
      await refresh();
      return result.data;
    },
    [refresh]
  );

  return {
    contractors: filteredContractors,
    stats,
    loading,
    error,
    source,
    filters,
    setFilters,
    refresh,
    setStatus,
    create,
  };
}
