import { Target } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function GoalsPage() {
  return (
    <ComingSoon
      icon={<Target />}
      title="Goals"
      description="Yearly goals that cascade down to quarters, months, weeks, and the tasks that actually move them."
    />
  );
}
