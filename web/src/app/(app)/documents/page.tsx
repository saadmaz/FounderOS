import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function DocumentsPage() {
  return (
    <ComingSoon
      icon={<FileText />}
      title="Documents"
      description="Contracts, proposals, and brand assets, linked back to the company and project they belong to."
    />
  );
}
