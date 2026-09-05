"use client";

import { Search, ArrowUpDown } from "lucide-react";
import clsx from "clsx";
import type { ContractorStatus } from "../../../shared/types/contractors";
import type { ContractorFilterState } from "@/hooks/useContractors";

const STATUS_LABEL: Record<ContractorStatus, string> = {
  ACTIVE: "Active",
  ONBOARDING: "Onboarding",
  SUSPENDED: "Suspended",
  BLACKLISTED: "Blacklisted",
  CONTRACT_EXPIRED: "Contract Expired",
};

const SORT_OPTIONS: { value: ContractorFilterState["sortBy"]; label: string }[] = [
  { value: "compliancePercentage", label: "Compliance %" },
  { value: "safetyScore", label: "Safety score" },
  { value: "headcount", label: "Headcount" },
  { value: "contractExpiry", label: "Contract expiry" },
];

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ContractorFilters({
  filters,
  onChange,
}: {
  filters: ContractorFilterState;
  onChange: (patch: Partial<ContractorFilterState>) => void;
}) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
            placeholder="Search company name, registration number, contact person…"
            className="w-full bg-black/30 border border-white/10 rounded-md pl-8 pr-3 py-2 text-sm outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={filters.sortBy}
          onChange={(e) => onChange({ sortBy: e.target.value as ContractorFilterState["sortBy"] })}
          className="bg-black/30 border border-white/10 rounded-md px-2 py-2 text-xs outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => onChange({ sortDirection: filters.sortDirection === "asc" ? "desc" : "asc" })}
          className="p-2 rounded-md border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
          title="Toggle sort direction"
        >
          <ArrowUpDown size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(STATUS_LABEL) as ContractorStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => onChange({ statuses: toggleValue(filters.statuses, status) })}
            className={clsx(
              "px-2 py-1 rounded-full text-[11px] border transition-colors",
              filters.statuses.includes(status)
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                : "border-white/10 text-neutral-400 hover:bg-white/5"
            )}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>
    </div>
  );
}
