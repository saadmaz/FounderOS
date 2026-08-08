import {
  Briefcase,
  Building2,
  Handshake,
  HeartHandshake,
  Landmark,
  Puzzle,
  Rocket,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CompanyType } from "@/lib/types";

/** One icon per CompanyType, used wherever the type picker needs to read at
 * a glance (the onboarding quick-picks, the type <Select>). */
export const COMPANY_TYPE_ICONS: Record<CompanyType, LucideIcon> = {
  startup: Rocket,
  company: Building2,
  agency: Users,
  client: Handshake,
  work: Briefcase,
  side_project: Puzzle,
  nonprofit: HeartHandshake,
  investment: Landmark,
  personal: User,
};
