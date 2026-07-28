"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ComingSoon({
  icon,
  title,
  description,
}: {
  // A rendered element, not a component reference - Server Component
  // callers can't pass a function/component across the client boundary.
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex max-w-sm flex-col items-center text-center"
      >
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-6">
          {icon}
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          In development
        </div>
        <Button render={<Link href="/dashboard" />} variant="outline" className="mt-6">
          Back to dashboard
        </Button>
      </motion.div>
    </div>
  );
}
