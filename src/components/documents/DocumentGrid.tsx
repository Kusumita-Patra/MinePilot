import type { MineDocument } from "../../../shared/types/documents";
import DocumentCard from "./DocumentCard";

export default function DocumentGrid({
  documents,
  onOpen,
}: {
  documents: MineDocument[];
  onOpen: (document: MineDocument) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {documents.map((doc) => (
        <DocumentCard key={doc.documentId} document={doc} onOpen={() => onOpen(doc)} />
      ))}
    </div>
  );
}
