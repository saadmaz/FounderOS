"use client";

import { Bell, LogOut, Menu, Moon, Search, Settings, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RunningTimerIndicator } from "@/components/time/running-timer-indicator";
import { signOut } from "@/lib/auth/actions";
import { useAuth } from "@/lib/auth/auth-provider";
import { ALL_NAV_ITEMS } from "./nav-config";
import { useUIStore } from "@/lib/store/ui-store";

function useBreadcrumb() {
  const pathname = usePathname();
  const match = ALL_NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  );
  return match?.label ?? "FounderOS";
}

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const breadcrumb = useBreadcrumb();
  const { user } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);

  const initials = (user?.displayName ?? user?.email ?? "F")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </Button>
        {/* Redundant with the page's own title on mobile (PageHeader renders
         * it right below) - dropped there to leave room for the timer
         * indicator and action icons instead of forcing horizontal overflow. */}
        <span className="hidden truncate text-sm font-medium text-foreground sm:inline-block">
          {breadcrumb}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <RunningTimerIndicator />

        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="Search"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded border border-border bg-background px-1 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>

        <Popover>
          <PopoverTrigger
            render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
          >
            <Bell className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-sm font-medium">Notifications</p>
            </div>
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="ml-1 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" />
            }
          >
            <Avatar className="size-8">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user?.displayName ?? "Founder"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <User className="size-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} variant="destructive">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
