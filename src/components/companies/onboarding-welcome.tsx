"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { COMPANY_TYPE_ICONS } from "@/lib/company-type-icons";
import { COMPANY_TYPES, type CompanyType } from "@/lib/types";

/**
 * First-run replacement for the Dashboard when a workspace has zero
 * companies - a brand new user otherwise lands on a page of empty widgets
 * and "No X yet" messages with no clear next step. Picking a type here
 * jumps straight into CompanyFormDialog pre-seeded via defaultType, so the
 * very first thing a new user does is answer one concrete question instead
 * of facing a blank form.
 */
export function OnboardingWelcome({
  displayName,
  onPickType,
}: {
  displayName?: string | null;
  onPickType: (type: CompanyType) => void;
}) {
  const firstName = displayName?.split(" ")[0];

  return (
    <div className="flex flex-1 items-center justify-center p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to FounderOS{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything here - projects, tasks, time, finance - hangs off at least one company.
            What are you setting up first?
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COMPANY_TYPES.map((t, i) => {
            const Icon = COMPANY_TYPE_ICONS[t.value];
            return (
              <motion.button
                key={t.value}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                onClick={() => onPickType(t.value)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => onPickType("startup")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Not sure yet? Start blank
            <ArrowRight className="size-3" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
