"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useMembers } from "@/lib/data/members";
import { initials } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  admin: "bg-analytics-purple/10 text-analytics-purple",
  manager: "bg-analytics-cyan/10 text-analytics-cyan",
  employee: "bg-muted text-muted-foreground",
  accountant: "bg-warning/10 text-warning",
  viewer: "bg-muted text-muted-foreground-2",
};

export default function SettingsPage() {
  const { workspace, role } = useWorkspace();
  const { data: members } = useMembers(workspace?.id ?? null);
  const { setTheme, resolvedTheme } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync the editable draft from the loaded workspace name during render
  // (React's documented pattern for this - avoids an extra effect + render).
  const [syncedWorkspaceId, setSyncedWorkspaceId] = useState<string | null>(null);
  if (workspace && workspace.id !== syncedWorkspaceId) {
    setSyncedWorkspaceId(workspace.id);
    setName(workspace.name);
  }

  const canEdit = role === "owner" || role === "admin";

  async function saveName() {
    if (!workspace || !name.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "workspaces", workspace.id), { name: name.trim() });
      toast.success("Workspace updated");
    } catch {
      toast.error("Couldn't update workspace name.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Workspace, members, and preferences." />

      <div className="max-w-2xl flex-1 space-y-8 p-4 lg:p-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Workspace</h2>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="workspaceName">Name</Label>
            <div className="flex gap-2">
              <Input
                id="workspaceName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
              />
              {canEdit && (
                <Button onClick={saveName} disabled={saving || name === workspace?.name}>
                  Save
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Members</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Role-based access controls what each member can see and edit.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar className="size-8">
                  <AvatarImage src={m.photoURL} />
                  <AvatarFallback className="text-xs">{initials(m.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[m.role]}`}
                >
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Appearance</h2>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant={resolvedTheme === "dark" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setTheme("dark")}
            >
              <Moon className="size-3.5" />
              Dark
            </Button>
            <Button
              variant={resolvedTheme === "light" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setTheme("light")}
            >
              <Sun className="size-3.5" />
              Light
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
