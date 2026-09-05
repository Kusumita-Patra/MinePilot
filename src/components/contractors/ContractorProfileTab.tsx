import type { Contractor } from "../../../shared/types/contractors";

export default function ContractorProfileTab({ contractor }: { contractor: Contractor }) {
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Registration Number" value={contractor.registrationNumber} />
        <Field label="GSTIN" value={contractor.gstin} />
        <Field label="PAN" value={contractor.pan} />
        <Field label="CLRA Licence" value={contractor.clraLicenceNumber} />
        <Field label="Contract Number" value={contractor.contractNumber} />
        <Field
          label="Contract Value"
          value={contractor.contractValue ? `₹${contractor.contractValue.toLocaleString("en-IN")}` : null}
        />
        <Field label="Contract Start" value={contractor.contractStartDate} tabular />
        <Field label="Contract End" value={contractor.contractEndDate} tabular />
        <Field label="Address" value={contractor.address} />
      </dl>

      <div>
        <p className="text-[11px] text-neutral-500 mb-1">Scope of Work</p>
        <p className="text-neutral-300">{contractor.scopeOfWork}</p>
      </div>

      <div>
        <p className="text-[11px] text-neutral-500 mb-1">Assigned Zones</p>
        <div className="flex flex-wrap gap-1.5">
          {contractor.assignedZoneIds.map((zone) => (
            <span key={zone} className="px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-neutral-400">
              {zone}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] text-neutral-500 mb-1">Contacts</p>
        <ul className="space-y-1.5">
          {contractor.contacts.map((c) => (
            <li key={c.name} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="font-medium">
                {c.name} <span className="text-neutral-500 font-normal">· {c.designation}</span>
                {c.isPrimary && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    Primary
                  </span>
                )}
              </p>
              <p className="text-[11px] text-neutral-500">
                {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, value, tabular }: { label: string; value: string | null; tabular?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className={tabular ? "tabular-nums" : undefined}>{value ?? "—"}</dd>
    </div>
  );
}
