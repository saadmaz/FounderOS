import { LayoutGrid } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function MeetingsPage() {
  return (
    <ComingSoon
      icon={<LayoutGrid />}
      title="Meetings"
      description="Notes, action items, and automatic task creation from every meeting you run."
    />
  );
}
