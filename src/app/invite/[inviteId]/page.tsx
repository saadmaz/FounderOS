"use client";

import { doc, getDoc } from "firebase/firestore";
import { ArrowRight, Loader2, Lock, User } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptInvite,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
} from "@/lib/auth/actions";
import { useAuth } from "@/lib/auth/auth-provider";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { db } from "@/lib/firebase/client";
import { getInvite } from "@/lib/data/invites";
import { getWorkspace } from "@/lib/data/workspace";
import { useUIStore } from "@/lib/store/ui-store";
import { ROLES, type Invite } from "@/lib/types";

export default function InvitePage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const setBootstrapLocked = useUIStore((s) => s.setWorkspaceBootstrapLocked);

  const [invite, setInvite] = useState<Invite | null | undefined>(undefined); // undefined = loading
  const [otherWorkspaceName, setOtherWorkspaceName] = useState<string | null>(null);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    getInvite(inviteId).then(setInvite);
  }, [inviteId]);

  // If a signed-in, matching-email user already belongs to a different
  // workspace, accepting will move them - surface that up front rather than
  // silently reassigning them (this app is one-workspace-per-user; see the
  // accept-invite route for the actual overwrite).
  useEffect(() => {
    if (!user || !invite) return;
    if (user.email?.toLowerCase() !== invite.email) return;
    (async () => {
      const pointerSnap = await getDoc(doc(db, "userWorkspaces", user.uid));
      const currentId = pointerSnap.exists() ? (pointerSnap.data().primaryWorkspaceId as string) : null;
      if (currentId && currentId !== invite.workspaceId) {
        const ws = await getWorkspace(currentId);
        setOtherWorkspaceName(ws?.name ?? "your current workspace");
      }
    })();
  }, [user, invite]);

  const roleLabel = invite ? (ROLES.find((r) => r.value === invite.role)?.label ?? invite.role) : "";
  const expired = invite ? new Date().getTime() > invite.expiresAt : false;

  async function handleAccept() {
    setError(null);
    setSubmitting(true);
    try {
      await acceptInvite(inviteId);
      setAccepted(true);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't accept the invite. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setError(null);
    setSubmitting(true);
    // Held for the whole signup/signin + accept sequence - see the lock's
    // doc comment in ui-store.ts for why this matters.
    setBootstrapLocked(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(name, invite.email, password);
      } else {
        await signInWithEmail(invite.email, password);
      }
      await acceptInvite(inviteId);
      setAccepted(true);
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
      setBootstrapLocked(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    setBootstrapLocked(true);
    try {
      await signInWithGoogle();
      await acceptInvite(inviteId);
      setAccepted(true);
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
      setBootstrapLocked(false);
    }
  }

  if (authLoading || invite === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invite) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold tracking-tight">Invite not found</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This invite link doesn&apos;t exist, or it&apos;s already been removed.
        </p>
      </AuthShell>
    );
  }

  if (invite.status === "revoked") {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold tracking-tight">Invite revoked</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This invite to {invite.workspaceName} has been revoked by its sender.
        </p>
      </AuthShell>
    );
  }

  if (invite.status === "accepted" && !accepted) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold tracking-tight">Already accepted</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This invite to {invite.workspaceName} has already been accepted.
        </p>
      </AuthShell>
    );
  }

  if (expired) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold tracking-tight">Invite expired</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This invite to {invite.workspaceName} has expired. Ask {invite.invitedByName} to send a new one.
        </p>
      </AuthShell>
    );
  }

  // Signed in with a different email than the one invited.
  if (user && user.email?.toLowerCase() !== invite.email) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold tracking-tight">Wrong account</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This invite is for {invite.email}, but you&apos;re signed in as {user.email}.
        </p>
        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={() => signOut().then(() => router.refresh())}
        >
          Sign out and try again
        </Button>
      </AuthShell>
    );
  }

  // Signed in with the matching email - just needs to accept.
  if (user) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold tracking-tight">Join {invite.workspaceName}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {invite.invitedByName} invited you to join as {roleLabel}.
        </p>
        {otherWorkspaceName && (
          <p className="mt-4 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            Accepting will replace {otherWorkspaceName} as your workspace.
          </p>
        )}
        {error && <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button className="mt-6 w-full gap-1.5" onClick={handleAccept} disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Accept invite <ArrowRight className="size-4" /></>}
        </Button>
      </AuthShell>
    );
  }

  // Not signed in - sign up or sign in with the invited email, then accept.
  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold tracking-tight">Join {invite.workspaceName}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {invite.invitedByName} invited you to join as {roleLabel}.{" "}
        {mode === "signup" ? "Create an account to accept." : "Sign in to accept."}
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full gap-2"
        onClick={handleGoogle}
        disabled={submitting}
      >
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground-2">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleAuthSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground-2" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="pl-9"
                required
              />
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={invite.email} disabled className="opacity-70" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground-2" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-9"
              required
              minLength={6}
            />
          </div>
        </div>

        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <Button type="submit" className="w-full gap-1.5" disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              {mode === "signup" ? "Create account & accept" : "Sign in & accept"}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signup" ? "Already have an account?" : "Need to create an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {mode === "signup" ? "Sign in" : "Sign up"}
        </button>
      </p>
    </AuthShell>
  );
}
