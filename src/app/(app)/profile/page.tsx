"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { changeUserPassword, signOut, updateUserProfile } from "@/lib/auth/actions";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { useAuth } from "@/lib/auth/auth-provider";
import { initials } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

export default function ProfilePage() {
  const { user } = useAuth();
  const { workspace, role } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.displayName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const hasPasswordProvider = user?.providerData.some((p) => p.providerId === "password") ?? false;

  async function handleSaveName() {
    if (!workspace || !name.trim()) return;
    setSavingProfile(true);
    try {
      await updateUserProfile(workspace.id, { displayName: name.trim() });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !workspace) return;
    setUploadingPhoto(true);
    try {
      await updateUserProfile(workspace.id, { photoFile: file });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password changed");
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <>
      <PageHeader title="My Profile" description="Your account, across every workspace." />

      <div className="max-w-2xl flex-1 space-y-8 p-4 lg:p-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Account</h2>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar size="lg" className="size-16">
                <AvatarImage src={user?.photoURL ?? undefined} />
                <AvatarFallback className="text-base">
                  {initials(user?.displayName ?? user?.email ?? "F")}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {uploadingPhoto ? "…" : "Change"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.displayName ?? "Founder"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <div className="flex gap-2">
              <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} />
              <Button
                onClick={handleSaveName}
                disabled={savingProfile || !name.trim() || name === user?.displayName}
              >
                Save
              </Button>
            </div>
          </div>

          {role && (
            <p className="mt-4 text-xs text-muted-foreground">
              Role in {workspace?.name}: <span className="font-medium capitalize">{role}</span>
            </p>
          )}
        </section>

        {hasPasswordProvider && (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Password</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Change the password used to sign in.
            </p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword}
              >
                Update password
              </Button>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Session</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Sign out of this device.</p>
          <Button variant="outline" className="mt-4" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>
      </div>
    </>
  );
}
