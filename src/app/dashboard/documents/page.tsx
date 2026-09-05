import { FolderOpen } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function DocumentsPage() {
  return (
    <ComingSoon
      title="Documents"
      icon={FolderOpen}
      description="Document storage and upload isn't built yet — there's no file storage backend behind this section."
    />
  );
}
