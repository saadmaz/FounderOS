"use client";

import { Building2, Check, Mail, Moon, Palette, Sun, Trash2, UserPlus, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsField, SettingsSection } from "@/components/shared/settings-section";
import { cn } from "@/lib/utils";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { sendInviteEmail } from "@/lib/auth/actions";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { createInvite, revokeInvite, useInvites } from "@/lib/data/invites";
import { removeMember, updateMemberRole, useMembers } from "@/lib/data/members";
import { initials } from "@/lib/format";
import { ROLES, type Role } from "@/lib/types";
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
  const { user } = useAuth();
  const { workspace, role } = useWorkspace();
  const confirm = useConfirm();
  const { data: members } = useMembers(workspace?.id ?? null);
  const { data: invites } = useInvites(workspace?.id ?? null);
  const { setTheme, resolvedTheme } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmailInput, setInviteEmailInput] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<Role, "owner">>("employee");
  const [inviting, setInviting] = useState(false);

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

  async function handleInvite() {
    if (!workspace || !user) return;
    const email = inviteEmailInput.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    try {
      const inviteId = await createInvite(
        workspace,
        { email, role: inviteRole },
        { uid: user.uid, displayName: user.displayName ?? user.email ?? "A teammate" }
      );
      await sendInviteEmail(inviteId);
      toast.success(`Invite sent to ${email}`);
      setInviteEmailInput("");
      setInviteRole("employee");
      setInviteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the invite. Try again.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(inviteId: string, email: string) {
    if (!(await confirm(`Revoke the invite to ${email}?`))) return;
    try {
      await revokeInvite(inviteId);
      toast.success("Invite revoked");
    } catch {
      toast.error("Couldn't revoke the invite.");
    }
  }

  async function handleRoleChange(memberId: string, newRole: Exclude<Role, "owner">) {
    if (!workspace) return;
    try {
      await updateMemberRole(workspace.id, memberId, newRole);
      toast.success("Role updated");
    } catch {
      toast.error("Couldn't update the role.");
    }
  }

  async function handleRemove(memberId: string, displayName: string) {
    if (!workspace) return;
    if (!(await confirm(`Remove ${displayName} from this workspace?`))) return;
    try {
      await removeMember(workspace.id, memberId);
      toast.success(`${displayName} removed`);
    } catch {
      toast.error("Couldn't remove that member.");
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Workspace, members, and preferences." />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 lg:p-8">
        <SettingsSection
          icon={Building2}
          title="Workspace"
          description="The name shown to everyone in this workspace."
          footer={
            canEdit ? (
              <Button onClick={saveName} disabled={saving || !name.trim() || name === workspace?.name}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            ) : (
              <p className="mr-auto text-xs text-muted-foreground">
                Only owners and admins can edit the workspace.
              </p>
            )
          }
        >
          <SettingsField label="Workspace name" htmlFor="workspaceName">
            <Input
              id="workspaceName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
            />
          </SettingsField>
        </SettingsSection>

        <SettingsSection
          icon={Users}
          title="Members"
          description={`${members.length} ${members.length === 1 ? "member" : "members"} and their roles.`}
          action={
            canEdit && (
              <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-3.5" />
                Invite
              </Button>
            )
          }
          bodyClassName="p-0 sm:p-0"
        >
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const isOwner = m.role === "owner";
              const isSelf = m.id === user?.uid;
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <Avatar className="size-9">
                    <AvatarImage src={m.photoURL} />
                    <AvatarFallback className="text-xs">{initials(m.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.displayName}
                      {isSelf && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {canEdit && !isOwner && !isSelf ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) => v && handleRoleChange(m.id, v as Exclude<Role, "owner">)}
                    >
                      <SelectTrigger size="sm" className="h-8 w-32 justify-between">
                        <SelectValue>
                          {(v: string) => (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[v]}`}
                            >
                              {v}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[m.role]}`}
                    >
                      {m.role}
                    </span>
                  )}
                  {canEdit && (
                    <div className="size-8 shrink-0">
                      {!isOwner && !isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground-2 hover:text-danger"
                          aria-label={`Remove ${m.displayName}`}
                          onClick={() => handleRemove(m.id, m.displayName)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {invites.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-y border-border bg-muted/30 px-5 py-2.5 sm:px-6">
                <Mail className="size-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pending invites
                </h3>
              </div>
              <ul className="divide-y divide-border">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                      <Mail className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{inv.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Invited by {inv.invitedByName}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[inv.role]}`}
                    >
                      {inv.role}
                    </span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-muted-foreground hover:text-danger"
                        onClick={() => handleRevoke(inv.id, inv.email)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </SettingsSection>

        <SettingsSection
          icon={Palette}
          title="Appearance"
          description="Choose how FounderOS looks on this device."
        >
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            {(
              [
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
              ] as const
            ).map(({ value, label, icon: Icon }) => {
              const active = resolvedTheme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                  {active && <Check className="ml-auto size-4" />}
                </button>
              );
            })}
          </div>
        </SettingsSection>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="teammate@company.com"
                autoFocus
                value={inviteEmailInput}
                onChange={(e) => setInviteEmailInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as Exclude<Role, "owner">)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => ROLES.find((r) => r.value === v)?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmailInput.trim()}>
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
