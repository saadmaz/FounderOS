import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  FolderKanban,
  Home,
  Lightbulb,
  LayoutGrid,
  Settings,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Every section is built out; kept as an explicit flag rather than removed
   *  outright so a future in-progress page has somewhere to signal it. */
  ready: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: Home, ready: true }],
  },
  {
    title: "Work",
    items: [
      { label: "Companies", href: "/companies", icon: Building2, ready: true },
      { label: "Projects", href: "/projects", icon: FolderKanban, ready: true },
      { label: "Tasks", href: "/tasks", icon: CheckSquare, ready: true },
      { label: "Calendar", href: "/calendar", icon: Calendar, ready: true },
      { label: "Time Tracking", href: "/time", icon: Clock, ready: true },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Finance", href: "/finance", icon: Wallet, ready: true },
      { label: "CRM", href: "/crm", icon: Users, ready: true },
      { label: "Meetings", href: "/meetings", icon: LayoutGrid, ready: true },
      { label: "Documents", href: "/documents", icon: FileText, ready: true },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Goals", href: "/goals", icon: Target, ready: true },
      { label: "Ideas", href: "/ideas", icon: Lightbulb, ready: true },
      { label: "Learning", href: "/learning", icon: BookOpen, ready: true },
      { label: "Analytics", href: "/analytics", icon: BarChart3, ready: true },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
  ready: true,
};

export const ALL_NAV_ITEMS = [...NAV_SECTIONS.flatMap((s) => s.items), SETTINGS_ITEM];
