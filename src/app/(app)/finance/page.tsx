import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function FinancePage() {
  return (
    <ComingSoon
      icon={<Wallet />}
      title="Finance"
      description="Expenses, revenue, invoices, and P&L for every company - coming right after the core workflow ships."
    />
  );
}
