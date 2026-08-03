import { HelpCircle } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function HelpPage() {
  return (
    <ComingSoon
      icon={<HelpCircle />}
      title="Help & Support"
      description="Docs, keyboard shortcuts, and a way to reach us - on the way."
    />
  );
}
