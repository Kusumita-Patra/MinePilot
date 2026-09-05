"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";
import type { ContractorStatus } from "../../../../../shared/types/contractors";
import { useContractorDetail } from "@/hooks/useContractorDetail";
import { useContractors } from "@/hooks/useContractors";
import Tabs from "@/components/ui/Tabs";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import ProgressRing from "@/components/ui/ProgressRing";
import SafetyScoreRing from "@/components/contractors/SafetyScoreRing";
import ContractorProfileTab from "@/components/contractors/ContractorProfileTab";
import ContractorComplianceTab from "@/components/contractors/ContractorComplianceTab";
import ContractorWorkforceTab from "@/components/contractors/ContractorWorkforceTab";
import WorkPermitsTab from "@/components/contractors/WorkPermitsTab";
import ContractorSafetyTab from "@/components/contractors/ContractorSafetyTab";
import ContractorDocumentsTab from "@/components/contractors/ContractorDocumentsTab";
import ContractorEquipmentTab from "@/components/contractors/ContractorEquipmentTab";
import ContractorStatusModal from "@/components/contractors/ContractorStatusModal";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "compliance", label: "Compliance" },
  { id: "workforce", label: "Workforce" },
  { id: "permits", label: "Work Permits" },
  { id: "safety", label: "Safety" },
  { id: "documents", label: "Documents" },
  { id: "equipment", label: "Equipment" },
];

const STATUS_STYLES: Record<ContractorStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  ONBOARDING: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  SUSPENDED: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  BLACKLISTED: "bg-red-500/10 text-red-400 border border-red-500/30",
  CONTRACT_EXPIRED: "bg-white/5 text-neutral-400 border border-white/10",
};

export default function ContractorDetailPage() {
  const params = useParams<{ contractorId: string }>();
  const router = useRouter();
  const contractorId = params.contractorId;
  const { contractor, workers, permits, equipment, loading, refresh } = useContractorDetail(contractorId);
  const { setStatus } = useContractors();
  const [activeTab, setActiveTab] = useState("profile");
  const [statusTarget, setStatusTarget] = useState<ContractorStatus | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-8 w-48" />
        <SkeletonLoader className="h-40 w-full" />
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/contractors" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
          <ArrowLeft size={12} /> Back to Contractors
        </Link>
        <p className="text-sm text-neutral-500">Contractor not found.</p>
      </div>
    );
  }

  const restricted = contractor.status === "SUSPENDED" || contractor.status === "BLACKLISTED";

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.push("/dashboard/contractors")}
        className="text-xs text-blue-400 hover:underline flex items-center gap-1"
      >
        <ArrowLeft size={12} /> Back to Contractors
      </button>

      {restricted && (
        <div className="bg-red-600/20 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
          {contractor.status === "BLACKLISTED" ? "Blacklisted" : "Suspended"}
          {contractor.suspensionReason && ` — ${contractor.suspensionReason}`}
        </div>
      )}

      <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{contractor.companyName}</h1>
          <p className="text-xs text-neutral-500">{contractor.scopeOfWork}</p>
          <span className={clsx("inline-block mt-2 px-2 py-0.5 rounded-full text-[11px]", STATUS_STYLES[contractor.status])}>
            {contractor.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ProgressRing percentage={contractor.compliancePercentage} size={56} />
          <SafetyScoreRing score={contractor.safetyMetrics.safetyScore} size={56} />
          <div className="flex flex-col gap-1">
            {contractor.status !== "SUSPENDED" && contractor.status !== "BLACKLISTED" && (
              <button
                onClick={() => setStatusTarget("SUSPENDED")}
                className="text-xs px-3 py-1.5 rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                Suspend
              </button>
            )}
            {contractor.status !== "BLACKLISTED" && (
              <button
                onClick={() => setStatusTarget("BLACKLISTED")}
                className="text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Blacklist
              </button>
            )}
            {(contractor.status === "SUSPENDED" || contractor.status === "BLACKLISTED") && (
              <button
                onClick={() => setStatusTarget("ACTIVE")}
                className="text-xs px-3 py-1.5 rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                Reactivate
              </button>
            )}
          </div>
        </div>
      </div>

      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
        {activeTab === "profile" && <ContractorProfileTab contractor={contractor} />}
        {activeTab === "compliance" && <ContractorComplianceTab contractor={contractor} />}
        {activeTab === "workforce" && <ContractorWorkforceTab workers={workers} />}
        {activeTab === "permits" && <WorkPermitsTab permits={permits} />}
        {activeTab === "safety" && <ContractorSafetyTab contractor={contractor} />}
        {activeTab === "documents" && <ContractorDocumentsTab contractorId={contractor.contractorId} />}
        {activeTab === "equipment" && <ContractorEquipmentTab equipment={equipment} />}
      </div>

      <ContractorStatusModal
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        targetStatus={statusTarget}
        companyName={contractor.companyName}
        onConfirm={async (status, reason) => {
          await setStatus(contractor.contractorId, status, reason);
          await refresh();
        }}
      />
    </div>
  );
}
