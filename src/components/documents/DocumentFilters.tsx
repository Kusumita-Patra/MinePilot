"use client";

import { Search, X, ArrowUpDown } from "lucide-react";
import clsx from "clsx";
import type { DocumentCategory, DocumentFilterState, DocumentStatus } from "../../../shared/types/documents";

const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  STATUTORY_LICENCE: "Statutory Licence",
  SAFETY_SOP: "Safety SOP",
  RISK_ASSESSMENT: "Risk Assessment",
  INSPECTION_REPORT: "Inspection Report",
  AUDIT_REPORT: "Audit Report",
  TRAINING_CERTIFICATE: "Training Certificate",
  EQUIPMENT_CERTIFICATE: "Equipment Certificate",
  BLASTING_RECORD: "Blasting Record",
  ENVIRONMENTAL_REPORT: "Environmental Report",
  INCIDENT_REPORT: "Incident Report",
  CONTRACTOR_DOCUMENT: "Contractor Document",
  DRAWING_PLAN: "Drawing / Plan",
  OTHER: "Other",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
  SUPERSEDED: "Superseded",
};

const SORT_OPTIONS: { value: DocumentFilterState["sortBy"]; label: string }[] = [
  { value: "expiryDate", label: "Expiry date" },
  { value: "title", label: "Title" },
  { value: "createdAt", label: "Upload date" },
  { value: "category", label: "Category" },
];

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function DocumentFilters({
  filters,
  onChange,
}: {
  filters: DocumentFilterState;
  onChange: (patch: Partial<DocumentFilterState>) => void;
}) {
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...filters.categories.map((c) => ({
      key: `cat-${c}`,
      label: CATEGORY_LABEL[c],
      onRemove: () => onChange({ categories: toggleValue(filters.categories, c) }),
    })),
    ...filters.statuses.map((s) => ({
      key: `status-${s}`,
      label: STATUS_LABEL[s],
      onRemove: () => onChange({ statuses: toggleValue(filters.statuses, s) }),
    })),
    ...(filters.expiringWithinDays !== null
      ? [{ key: "expiring", label: "Expiring soon", onRemove: () => onChange({ expiringWithinDays: null }) }]
      : []),
  ];

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value, page: 1 })}
            placeholder="Search title, document number, tags, issuing authority…"
            className="w-full bg-black/30 border border-white/10 rounded-md pl-8 pr-3 py-2 text-sm outline-none focus:border-blue-500/50"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-400 whitespace-nowrap">
          <input
            type="checkbox"
            checked={filters.expiringWithinDays !== null}
            onChange={(e) => onChange({ expiringWithinDays: e.target.checked ? 30 : null, page: 1 })}
            className="accent-amber-500"
          />
          Expiring soon only
        </label>

        <select
          value={filters.sortBy}
          onChange={(e) => onChange({ sortBy: e.target.value as DocumentFilterState["sortBy"] })}
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
        {(Object.keys(CATEGORY_LABEL) as DocumentCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => onChange({ categories: toggleValue(filters.categories, cat), page: 1 })}
            className={clsx(
              "px-2 py-1 rounded-full text-[11px] border transition-colors",
              filters.categories.includes(cat)
                ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                : "border-white/10 text-neutral-400 hover:bg-white/5"
            )}
          >
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(STATUS_LABEL) as DocumentStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => onChange({ statuses: toggleValue(filters.statuses, status), page: 1 })}
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

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
          <span className="text-[11px] text-neutral-500">Active filters:</span>
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-neutral-300"
            >
              {chip.label}
              <button onClick={chip.onRemove} className="hover:text-white">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
