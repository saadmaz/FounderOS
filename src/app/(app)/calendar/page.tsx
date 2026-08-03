import { Calendar } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function CalendarPage() {
  return (
    <ComingSoon
      icon={<Calendar />}
      title="Calendar"
      description="A unified calendar across every company - meetings, deadlines, and milestones in one view."
    />
  );
}
