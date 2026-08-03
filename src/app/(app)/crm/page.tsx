import { Users } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function CrmPage() {
  return (
    <ComingSoon
      icon={<Users />}
      title="CRM"
      description="Clients, leads, and deal pipelines - relationship-focused, Attio-style profiles for every contact."
    />
  );
}
