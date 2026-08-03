"use client";

import { ChevronsLeft, ChevronsRight, HelpCircle, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, SETTINGS_ITEM, type NavItem } from "./nav-config";

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");

  const link = (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <item.icon className={cn("size-4 shrink-0", active && "text-primary")} />
      {!collapsed && (
        <span className="flex-1 truncate">{item.label}</span>
      )}
      {!collapsed && !item.ready && (
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground-2">
          Soon
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={link} />
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        sidebarCollapsed ? "w-[68px]" : "w-60"
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 px-4", sidebarCollapsed && "justify-center px-0")}>
        <div className="flex size-7 items-center justify-center rounded-md bg-primary">
          <Zap className="size-4 text-white" fill="currentColor" />
        </div>
        {!sidebarCollapsed && <span className="text-sm font-semibold tracking-tight">FounderOS</span>}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2 scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground-2">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={sidebarCollapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-3">
        <NavLink item={SETTINGS_ITEM} collapsed={sidebarCollapsed} />
        <NavLink
          item={{ label: "Help", href: "/help", icon: HelpCircle, ready: false }}
          collapsed={sidebarCollapsed}
        />
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          {sidebarCollapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
