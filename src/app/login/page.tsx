"use client";

import { ArrowLeft, ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-provider";
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth/actions";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [authLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(name, email, password);
      } else if (mode === "reset") {
        await resetPassword(email);
        setResetSent(true);
        return;
      } else {
        await signInWithEmail(email, password);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: "signin" | "signup" | "reset") {
    setMode(next);
    setError(null);
    setResetSent(false);
    setPassword("");
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold tracking-tight">
        {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your workspace" : "Reset your password"}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {mode === "signin"
          ? "Sign in to keep running your companies."
          : mode === "signup"
            ? "One workspace for every company you're building."
            : "Enter your email and we'll send you a reset link."}
      </p>

      {mode !== "reset" && (
        <>
          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full gap-2"
            onClick={handleGoogle}
            disabled={submitting}
          >
            <GoogleIcon className="size-4" />
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground-2">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {mode === "reset" && resetSent ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            If an account exists for {email}, a reset link is on its way.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-1.5"
            onClick={() => switchMode("signin")}
          >
            <ArrowLeft className="size-4" />
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={cn("space-y-4", mode === "reset" && "mt-6")}>
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
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground-2" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="pl-9"
                required
              />
            </div>
          </div>
          {mode !== "reset" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("reset")}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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
          )}

          {error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <Button type="submit" className="w-full gap-1.5" disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "reset" ? (
          !resetSent && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </button>
          )
        ) : (
          <>
            {mode === "signin" ? "New to FounderOS?" : "Already have a workspace?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className={cn("font-medium text-foreground underline-offset-4 hover:underline")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </>
        )}
      </p>
    </AuthShell>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.6H1.27A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.27 5.4z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4 3.11c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}
