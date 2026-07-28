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
  /** Core-loop pages are fully built; the rest route to a "coming soon" state. */
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
      { label: "Calendar", href: "/calendar", icon: Calendar, ready: false },
      { label: "Time Tracking", href: "/time", icon: Clock, ready: true },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Finance", href: "/finance", icon: Wallet, ready: false },
      { label: "CRM", href: "/crm", icon: Users, ready: false },
      { label: "Meetings", href: "/meetings", icon: LayoutGrid, ready: false },
      { label: "Documents", href: "/documents", icon: FileText, ready: false },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Goals", href: "/goals", icon: Target, ready: false },
      { label: "Ideas", href: "/ideas", icon: Lightbulb, ready: false },
      { label: "Learning", href: "/learning", icon: BookOpen, ready: false },
      { label: "Analytics", href: "/analytics", icon: BarChart3, ready: false },
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
