import { cn } from "@/lib/utils";

/**
 * The FounderOS mark. `variant="auto"` (the default) follows the current
 * theme - black on light backgrounds, white on dark ones - via the same
 * `.dark` class Tailwind's `dark:` variant already keys off (see
 * providers.tsx), so it swaps with zero JS and no hydration flash. Pass an
 * explicit "black"/"white" for surfaces whose background doesn't follow the
 * site theme (e.g. the always-dark auth branding panel).
 */
export function Logo({
  className,
  variant = "auto",
}: {
  className?: string;
  variant?: "auto" | "black" | "white";
}) {
  if (variant === "black") {
    return <img src="/founderos-black.svg" alt="FounderOS" className={className} />;
  }
  if (variant === "white") {
    return <img src="/founderos-white.svg" alt="FounderOS" className={className} />;
  }
  return (
    <>
      <img src="/founderos-black.svg" alt="FounderOS" className={cn(className, "dark:hidden")} />
      <img
        src="/founderos-white.svg"
        alt="FounderOS"
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}
