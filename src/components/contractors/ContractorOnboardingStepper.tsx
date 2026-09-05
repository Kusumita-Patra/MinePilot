"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import clsx from "clsx";
import Modal from "../ui/Modal";
import type { CreateContractorInput } from "@/lib/contractorsApi";

const STEPS = ["Company details", "Statutory registrations", "Document upload", "Zone assignment", "Safety induction", "Activate"];
const ZONES = ["sector-1", "sector-2", "sector-3", "sector-4"];

export default function ContractorOnboardingStepper({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateContractorInput) => Promise<unknown>;
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [registrationNumber, setRegistrationNumber] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [clra, setClra] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");

  const [documentsAcknowledged, setDocumentsAcknowledged] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [safetyInductionScheduled, setSafetyInductionScheduled] = useState(false);

  function reset() {
    setStep(0);
    setError(null);
    setCompanyName("");
    setShortCode("");
    setScopeOfWork("");
    setContactName("");
    setContactPhone("");
    setRegistrationNumber("");
    setGstin("");
    setPan("");
    setClra("");
    setContractNumber("");
    setContractStartDate("");
    setContractEndDate("");
    setDocumentsAcknowledged(false);
    setZones([]);
    setSafetyInductionScheduled(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!companyName.trim() || !shortCode.trim() || !scopeOfWork.trim() || !contactName.trim()) {
        return "Company name, short code, scope of work and a contact person are required.";
      }
    }
    if (step === 1) {
      if (!contractNumber.trim() || !contractStartDate || !contractEndDate) {
        return "Contract number, start date and end date are required.";
      }
      if (contractEndDate <= contractStartDate) return "Contract end date must be after the start date.";
    }
    if (step === 2 && !documentsAcknowledged) {
      return "Confirm that statutory documents will be uploaded via the Documents panel.";
    }
    if (step === 3 && zones.length === 0) {
      return "Assign at least one mine zone.";
    }
    if (step === 4 && !safetyInductionScheduled) {
      return "Confirm safety induction has been scheduled before activation.";
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleActivate() {
    const err = validateStep();
    if (err) return setError(err);
    setSubmitting(true);
    try {
      await onCreate({
        companyName: companyName.trim(),
        shortCode: shortCode.trim().toUpperCase(),
        scopeOfWork: scopeOfWork.trim(),
        registrationNumber: registrationNumber || null,
        gstin: gstin || null,
        pan: pan || null,
        clraLicenceNumber: clra || null,
        contractNumber: contractNumber.trim(),
        contractStartDate,
        contractEndDate,
        assignedZoneIds: zones,
        contacts: [{ name: contactName.trim(), designation: "Primary Contact", email: null, phone: contactPhone || null, isPrimary: true }],
      });
      handleClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Onboard New Contractor" widthClassName="w-full max-w-xl">
      <div className="space-y-4">
        <div className="flex items-center gap-1">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div
                className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium border-2 shrink-0",
                  idx < step
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : idx === step
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "bg-white/5 border-white/10 text-neutral-500"
                )}
              >
                {idx < step ? <Check size={12} /> : idx + 1}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={clsx("h-0.5 flex-1 mx-1", idx < step ? "bg-emerald-500" : "bg-white/10")} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500">{STEPS[step]}</p>

        {step === 0 && (
          <div className="space-y-2">
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
            <input value={shortCode} onChange={(e) => setShortCode(e.target.value)} placeholder="Short code (e.g. BMC)" className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
            <input value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} placeholder="Scope of work" className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact person" className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Contact phone" className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="Registration number" className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
              <input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="GSTIN" className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
              <input value={pan} onChange={(e) => setPan(e.target.value)} placeholder="PAN" className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
              <input value={clra} onChange={(e) => setClra(e.target.value)} placeholder="CLRA licence number" className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
            </div>
            <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="Contract number" className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
              <input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
            </div>
          </div>
        )}

        {step === 2 && (
          <label className="flex items-start gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={documentsAcknowledged} onChange={(e) => setDocumentsAcknowledged(e.target.checked)} className="accent-blue-500 mt-1" />
            I confirm CLRA licence, insurance and registration documents for this contractor will be uploaded via the Documents panel once activated.
          </label>
        )}

        {step === 3 && (
          <div className="flex flex-wrap gap-1.5">
            {ZONES.map((zone) => (
              <button
                key={zone}
                onClick={() => setZones((z) => (z.includes(zone) ? z.filter((x) => x !== zone) : [...z, zone]))}
                className={clsx(
                  "px-2 py-1 rounded-full text-[11px] border",
                  zones.includes(zone) ? "bg-blue-600/20 border-blue-500/40 text-blue-400" : "border-white/10 text-neutral-400"
                )}
              >
                {zone}
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <label className="flex items-start gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={safetyInductionScheduled} onChange={(e) => setSafetyInductionScheduled(e.target.checked)} className="accent-blue-500 mt-1" />
            Safety induction has been scheduled for this contractor&apos;s workforce.
          </label>
        )}

        {step === 5 && (
          <div className="text-sm text-neutral-300 space-y-1">
            <p>
              <strong>{companyName}</strong> ({shortCode}) will be activated with status <em>Onboarding</em> and can
              be moved to <em>Active</em> once compliance documents are verified.
            </p>
            <p className="text-neutral-500 text-xs">Zones: {zones.join(", ")}</p>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 text-sm rounded-md border border-white/10 text-neutral-400 disabled:opacity-30"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 rounded-md px-4 py-2 text-sm font-medium">
              Next
            </button>
          ) : (
            <button
              onClick={handleActivate}
              disabled={submitting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Activate
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
