"use client";

import { useCallback, useEffect, useState } from "react";
import type { Contractor, ContractorEquipment, ContractorWorker, WorkPermit } from "../../shared/types/contractors";
import {
  getContractor,
  getContractorEquipment,
  getContractorPermits,
  getContractorWorkers,
} from "@/lib/contractorsApi";
import { getDaysUntilExpiry } from "@/lib/complianceUtils";

// Extends the wire types with expiry countdowns computed once at fetch time
// (inside this callback, not in JSX) so no component needs to call
// Date.now()/new Date() during render - react-hooks/purity forbids that.
export interface EnrichedContractorWorker extends ContractorWorker {
  pmeDaysUntilExpiry: number | null;
}
export interface EnrichedContractorEquipment extends ContractorEquipment {
  fitnessDaysUntilExpiry: number | null;
}

export function useContractorDetail(contractorId: string | null) {
  const [contractor, setContractor] = useState<Contractor | undefined>(undefined);
  const [workers, setWorkers] = useState<EnrichedContractorWorker[]>([]);
  const [permits, setPermits] = useState<WorkPermit[]>([]);
  const [equipment, setEquipment] = useState<EnrichedContractorEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contractorId) {
      setLoading(false);
      return;
    }
    try {
      const [contractorRes, workersRes, permitsRes, equipmentRes] = await Promise.all([
        getContractor(contractorId),
        getContractorWorkers(contractorId),
        getContractorPermits(contractorId),
        getContractorEquipment(contractorId),
      ]);
      setContractor(contractorRes.data);
      setWorkers(
        workersRes.data.map((w) => ({ ...w, pmeDaysUntilExpiry: getDaysUntilExpiry(w.pmeExpiryDate) }))
      );
      setPermits(permitsRes.data);
      setEquipment(
        equipmentRes.data.map((e) => ({
          ...e,
          fitnessDaysUntilExpiry: getDaysUntilExpiry(e.fitnessCertificateExpiry),
        }))
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contractor");
    } finally {
      setLoading(false);
    }
  }, [contractorId]);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  return { contractor, workers, permits, equipment, loading, error, refresh };
}
