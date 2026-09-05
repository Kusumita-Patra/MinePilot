import { Download } from "lucide-react";
import clsx from "clsx";
import type { DocumentVersion } from "../../../shared/types/documents";

export default function DocumentVersionHistory({ versions }: { versions: DocumentVersion[] }) {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  if (sorted.length === 0) {
    return <p className="text-sm text-neutral-500">No versions recorded.</p>;
  }

  return (
    <ul className="space-y-2">
      {sorted.map((version) => (
        <li
          key={version.versionId}
          className={clsx(
            "flex items-start justify-between gap-3 rounded-lg p-3 border",
            version.isCurrent ? "border-blue-500/30 bg-blue-500/5" : "border-white/10 bg-white/5"
          )}
        >
          <div>
            <p className="text-sm font-medium">
              v{version.versionNumber} — {version.fileName}
              {version.isCurrent && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  Current
                </span>
              )}
            </p>
            <p className="text-[11px] text-neutral-500">
              {version.uploadedBy} · {new Date(version.uploadedAt).toLocaleString()}
            </p>
            {version.changeNote && <p className="text-xs text-neutral-400 mt-1">{version.changeNote}</p>}
          </div>
          <a
            href={version.fileUrl}
            className="shrink-0 flex items-center gap-1 text-xs text-blue-400 hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            <Download size={12} />
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}
