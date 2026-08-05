"use client";

import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { CheckCircle2, Loader2, Lock, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { auth } from "@/lib/firebase/client";

type Status = "loading" | "resetForm" | "resetDone" | "verifyDone" | "recoverDone" | "error";

/**
 * Handles every Firebase Auth action-code link (password reset, email
 * verification, email-change recovery) in FounderOS's own UI instead of
 * Firebase's generic hosted page. Requires the "Action URL" for each
 * template in Firebase Console > Authentication > Templates to be pointed
 * at this route (e.g. https://work.saadmaz.com/auth/action) - without that,
 * emails still link to the default firebaseapp.com page regardless of what
 * this page does.
 */
function AuthActionContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  const [status, setStatus] = useState<Status>(() => (mode && oobCode ? "loading" : "error"));
  const [errorMessage, setErrorMessage] = useState(() =>
    mode && oobCode ? "" : "This link is missing required information."
  );
  const [targetEmail, setTargetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mode || !oobCode) return;

    (async () => {
      try {
        if (mode === "resetPassword") {
          const email = await verifyPasswordResetCode(auth, oobCode);
          setTargetEmail(email);
          setStatus("resetForm");
        } else if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          setStatus("verifyDone");
        } else if (mode === "recoverEmail") {
          const info = await checkActionCode(auth, oobCode);
          await applyActionCode(auth, oobCode);
          setTargetEmail(info.data.email ?? "");
          setStatus("recoverDone");
        } else {
          setErrorMessage("This link isn't a recognized action.");
          setStatus("error");
        }
      } catch (err) {
        setErrorMessage(authErrorMessage(err));
        setStatus("error");
      }
    })();
  }, [mode, oobCode]);

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oobCode) return;
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("resetDone");
    } catch (err) {
      setErrorMessage(authErrorMessage(err));
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Verifying your link…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-5">
        <div className="flex size-12 items-center justify-center rounded-full bg-danger/10">
          <XCircle className="size-5 text-danger" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">This link isn&apos;t valid</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {errorMessage || "It may have expired, already been used, or the link was copied incorrectly."}
          </p>
        </div>
        <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
          Back to sign in
        </Button>
      </div>
    );
  }

  if (status === "resetForm") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">for {targetEmail}</p>
        </div>
        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground-2" />
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
                required
                minLength={6}
                autoFocus
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Save new password"}
          </Button>
        </form>
      </div>
    );
  }

  if (status === "resetDone") {
    return (
      <div className="space-y-5">
        <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="size-5 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Password updated</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            You can sign in with your new password now.
          </p>
        </div>
        <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
          Back to sign in
        </Button>
      </div>
    );
  }

  if (status === "verifyDone") {
    return (
      <div className="space-y-5">
        <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="size-5 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Email verified</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Thanks - your address is confirmed.</p>
        </div>
        <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
          Continue
        </Button>
      </div>
    );
  }

  // recoverDone
  return (
    <div className="space-y-5">
      <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="size-5 text-success" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Email restored</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {targetEmail ? `Your account's email is back to ${targetEmail}. ` : ""}
          If you didn&apos;t request the original change, consider resetting your password too.
        </p>
      </div>
      <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
        Back to sign in
      </Button>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <AuthActionContent />
      </Suspense>
    </AuthShell>
  );
}
