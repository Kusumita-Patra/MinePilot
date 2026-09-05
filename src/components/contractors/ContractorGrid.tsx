import type { Contractor } from "../../../shared/types/contractors";
import ContractorCard from "./ContractorCard";

export default function ContractorGrid({ contractors }: { contractors: Contractor[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {contractors.map((c) => (
        <ContractorCard key={c.contractorId} contractor={c} />
      ))}
    </div>
  );
}
