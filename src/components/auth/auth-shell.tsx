"use client";

import { motion } from "framer-motion";
import { Building2, Sparkles, Zap } from "lucide-react";

const PITCH_POINTS = [
  { icon: Building2, text: "Every company you run, in one workspace" },
  { icon: Zap, text: "Tasks, time, and projects that update in real time" },
  { icon: Sparkles, text: "Built for founders juggling more than one thing" },
];

/**
 * Shared two-panel shell for every public, pre-auth page (login, the
 * Firebase Auth action handler at /auth/action, ...) - keeps the branding
 * panel and mobile logo in exactly one place instead of duplicated per page.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden overflow-hidden bg-[#09090B] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at 15% 20%, rgba(37,99,235,0.35), transparent 60%), radial-gradient(500px circle at 85% 80%, rgba(139,92,246,0.25), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2 text-white">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-4.5 text-white" fill="currentColor" />
          </div>
          <span className="text-lg font-semibold tracking-tight">FounderOS</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Run every company you own from one calm place.
          </h1>
          <div className="space-y-4">
            {PITCH_POINTS.map((p, i) => (
              <motion.div
                key={p.text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.4 }}
                className="flex items-center gap-3 text-[#A1A1AA]"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5">
                  <p.icon className="size-4 text-[#93C5FD]" />
                </div>
                <span className="text-sm">{p.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-[#52525B]">© {new Date().getFullYear()} FounderOS</p>
      </div>

      {/* Content */}
      <div className="flex items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="size-4.5 text-white" fill="currentColor" />
            </div>
            <span className="text-lg font-semibold tracking-tight">FounderOS</span>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
