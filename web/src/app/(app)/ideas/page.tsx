import { Lightbulb } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function IdeasPage() {
  return (
    <ComingSoon
      icon={<Lightbulb />}
      title="Idea Vault"
      description="Capture product, marketing, and business ideas before they slip - triaged by company and potential."
    />
  );
}
