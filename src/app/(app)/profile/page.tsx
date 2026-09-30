"use client";

import { Camera, KeyRound, Loader2, LogOut, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleCalendarCard } from "@/components/integrations/google-calendar-card";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsField, SettingsSection } from "@/components/shared/settings-section";
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

  const nameChanged = name.trim() !== (user?.displayName ?? "") && !!name.trim();

  return (
    <>
      <PageHeader title="My Profile" description="Your account, across every workspace." />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 lg:p-8">
        <SettingsSection
          icon={UserRound}
          title="Account"
          description="Your name and photo are visible to your teammates."
          footer={
            <Button onClick={handleSaveName} disabled={savingProfile || !nameChanged}>
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          }
          bodyClassName="space-y-6"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Change photo"
            >
              <Avatar size="lg" className="size-16 ring-2 ring-border">
                <AvatarImage src={user?.photoURL ?? undefined} />
                <AvatarFallback className="text-base">
                  {initials(user?.displayName ?? user?.email ?? "F")}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {uploadingPhoto ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold tracking-tight">
                  {user?.displayName ?? "Founder"}
                </p>
                {role && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                    {role}
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              {workspace && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground-2">in {workspace.name}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="hidden shrink-0 sm:inline-flex"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              Change photo
            </Button>
          </div>

          <div className="border-t border-border pt-6">
            <SettingsField label="Display name" htmlFor="displayName">
              <Input
                id="displayName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && nameChanged && handleSaveName()}
              />
            </SettingsField>
          </div>
        </SettingsSection>

        <GoogleCalendarCard />

        {hasPasswordProvider && (
          <SettingsSection
            icon={KeyRound}
            title="Password"
            description="Change the password used to sign in."
            bodyClassName="space-y-5"
            footer={
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword}
              >
                {changingPassword ? "Updating…" : "Update password"}
              </Button>
            }
          >
            <SettingsField label="Current password" htmlFor="currentPassword">
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </SettingsField>
            <SettingsField label="New password" htmlFor="newPassword" hint="At least 6 characters.">
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </SettingsField>
          </SettingsSection>
        )}

        <SettingsSection
          icon={LogOut}
          title="Session"
          description="Sign out of FounderOS on this device."
          action={
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          }
        />
      </div>
    </>
  );
}
