import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function AnalyticsPage() {
  return (
    <ComingSoon
      icon={<BarChart3 />}
      title="Analytics"
      description="Executive-level reporting - company rankings, time allocation, burn rate, and forecasts."
    />
  );
}
