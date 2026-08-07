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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav}>
          <Menu className="size-4" />
        </Button>
        <span className="text-sm font-medium text-foreground">{breadcrumb}</span>
      </div>

      <div className="flex items-center gap-2">
        <RunningTimerIndicator />

        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded border border-border bg-background px-1 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>

        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
            <Bell className="size-4" />
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-sm font-medium">Notifications</p>
            </div>
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
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
