"use client";

import { useState } from "react";
import { Users, UserPlus } from "lucide-react";
import { useContractors } from "@/hooks/useContractors";
import { useCurrentUser, canUpload } from "@/hooks/useCurrentUser";
import ContractorStatsStrip from "@/components/contractors/ContractorStatsStrip";
import ContractorFilters from "@/components/contractors/ContractorFilters";
import ContractorGrid from "@/components/contractors/ContractorGrid";
import ContractorOnboardingStepper from "@/components/contractors/ContractorOnboardingStepper";
import EmptyState from "@/components/ui/EmptyState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";

export default function ContractorsPage() {
  const currentUser = useCurrentUser();
  const { contractors, stats, loading, error, source, filters, setFilters, create } = useContractors();
  const [onboardOpen, setOnboardOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Contractors</h1>
        {canUpload(currentUser.role) && (
          <button
            onClick={() => setOnboardOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 rounded-md px-4 py-2 text-sm font-medium"
          >
            <UserPlus size={14} />
            Onboard Contractor
          </button>
        )}
      </div>

      {error && (
        <p className="text-amber-400 text-xs">Can&apos;t reach the backend — showing demo data. ({error})</p>
      )}
      {!error && source === "mock" && (
        <p className="text-neutral-500 text-[11px]">Showing demo data — no live backend connection yet.</p>
      )}

      <ContractorStatsStrip stats={stats} />

      <ContractorFilters filters={filters} onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))} />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : contractors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contractors found"
          description="Try adjusting your filters, or onboard a new contractor."
          actionLabel={canUpload(currentUser.role) ? "Onboard Contractor" : undefined}
          onAction={canUpload(currentUser.role) ? () => setOnboardOpen(true) : undefined}
        />
      ) : (
        <ContractorGrid contractors={contractors} />
      )}

      <ContractorOnboardingStepper open={onboardOpen} onClose={() => setOnboardOpen(false)} onCreate={create} />
    </div>
  );
}
