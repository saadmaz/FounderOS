"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps a horizontally-overflowing tab strip with tap-to-scroll chevrons.
 * The strip is still a plain `overflow-x-auto` div underneath - touch-drag
 * scrolling keeps working exactly as before - but a chevron tap is a
 * completely unambiguous fallback that can't be swallowed by scroll
 * chaining, a parent's gesture handling, or any other touch-event quirk a
 * given browser/embedding might have. Arrows only render while there's
 * actually more to reach in that direction, and re-check on resize/scroll.
 */
export function ScrollableTabStrip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function scrollByStep(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * 160, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll tabs left"
          onClick={() => scrollByStep(-1)}
          className="absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-background via-background/90 to-transparent pl-0.5 pr-4 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div ref={scrollerRef} className={cn("overflow-x-auto overscroll-x-contain scrollbar-thin", className)}>
        {children}
      </div>
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scroll tabs right"
          onClick={() => scrollByStep(1)}
          className="absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-background via-background/90 to-transparent pl-4 pr-0.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
