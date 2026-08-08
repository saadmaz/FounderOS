"use client";

import { useEffect, useRef } from "react";
import { formatDuration } from "@/components/meetings/meeting-card";
import { itemsForDay, layoutTimedItems, startOfDay, type CalendarItem } from "@/lib/calendar-items";
import { cn } from "@/lib/utils";

const HOUR_PX = 48;
const TOTAL_HEIGHT = HOUR_PX * 24;
const GRID_HEIGHT = 576; // ~12 hours visible before scrolling

function hourLabel(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function minutesSinceMidnight(ms: number, dayStart: number) {
  return (ms - dayStart) / 60_000;
}

/**
 * Shared hour-by-hour grid for the Calendar page's Day and Week views (Day
 * passes one date, Week passes seven) - a single scroll container holding
 * the hour-label rail and every day column side by side, so they scroll
 * together while the day-header row above stays fixed.
 */
export function HourGrid({
  days,
  items,
  onItemClick,
}: {
  days: Date[];
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // `new Date()` (not Date.now()) - matches the impure-read convention used
  // throughout this codebase (see src/lib/format.ts's sumHours).
  const today = startOfDay(new Date().getTime());
  const now = new Date().getTime();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: Math.max(0, 7 * HOUR_PX - 32) });
  }, []);

  const columns = days.map((day) => {
    const dayStart = startOfDay(day.getTime());
    const dayItems = itemsForDay(items, dayStart);
    const allDayItems = dayItems.filter((i) => i.allDay);
    const timedItems = layoutTimedItems(dayItems.filter((i) => !i.allDay));
    return { day, dayStart, allDayItems, timedItems, isToday: dayStart === today };
  });

  const hasAllDay = columns.some((c) => c.allDayItems.length > 0);
  // Week view's 7 columns get a min-width each so they never squeeze
  // unusably thin on a narrow phone - the outer overflow-x-auto lets the
  // whole grid (headers included, so they stay aligned) scroll sideways
  // instead. Day view's single column always just fills the width.
  const dayColClass = days.length > 1 ? "min-w-[110px] flex-1" : "flex-1";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto scrollbar-thin">
        {/* day headers - horizontally scrolls with the grid, vertically fixed */}
        <div className="flex border-b border-border">
          <div className="sticky left-0 z-20 w-12 shrink-0 bg-card sm:w-14" />
          {columns.map(({ day, isToday }) => (
            <div
              key={day.toISOString()}
              className={cn(dayColClass, "border-l border-border px-2 py-2 text-center", isToday && "bg-primary/5")}
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground-2">
                {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}
              </p>
              <p className={cn("text-sm font-semibold", isToday && "text-primary")}>{day.getDate()}</p>
            </div>
          ))}
        </div>

        {/* all-day / task strip */}
        {hasAllDay && (
          <div className="flex border-b border-border">
            <div className="sticky left-0 z-20 flex w-12 shrink-0 items-center justify-center bg-card text-[9px] text-muted-foreground-2 sm:w-14">
              All day
            </div>
            {columns.map(({ day, allDayItems, isToday }) => (
              <div
                key={day.toISOString()}
                className={cn(dayColClass, "space-y-1 border-l border-border p-1", isToday && "bg-primary/5")}
              >
                {allDayItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemClick(item)}
                    className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-white"
                    style={{ backgroundColor: item.color }}
                    title={item.title}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* hour grid - the one vertically-scrollable region */}
        <div ref={scrollRef} className="flex overflow-y-auto scrollbar-thin" style={{ maxHeight: GRID_HEIGHT }}>
          <div className="sticky left-0 z-20 w-12 shrink-0 bg-card sm:w-14" style={{ height: TOTAL_HEIGHT }}>
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="border-t border-border pr-1.5 text-right text-[10px] text-muted-foreground-2"
                style={{ height: HOUR_PX }}
              >
                {h > 0 && <span className="relative -top-1.5">{hourLabel(h)}</span>}
              </div>
            ))}
          </div>

          {columns.map(({ day, dayStart, timedItems, isToday }) => (
            <div
              key={day.toISOString()}
              className={cn(dayColClass, "relative border-l border-border", isToday && "bg-primary/5")}
              style={{ height: TOTAL_HEIGHT }}
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="border-t border-border" style={{ height: HOUR_PX }} />
              ))}

              {isToday && (
                <div
                  className="absolute inset-x-0 z-10 flex items-center"
                  style={{ top: (minutesSinceMidnight(now, dayStart) / 1440) * TOTAL_HEIGHT }}
                >
                  <span className="-ml-0.5 size-1.5 shrink-0 rounded-full bg-danger" />
                  <span className="h-px flex-1 bg-danger" />
                </div>
              )}

              {timedItems.map(({ item, column, columnCount }) => {
                const startMin = Math.max(0, minutesSinceMidnight(item.at, dayStart));
                const endMin = Math.min(
                  1440,
                  minutesSinceMidnight(item.endAt ?? item.at + 30 * 60_000, dayStart)
                );
                const top = (startMin / 1440) * TOTAL_HEIGHT;
                const height = Math.max(18, ((endMin - startMin) / 1440) * TOTAL_HEIGHT);
                const widthPct = 100 / columnCount;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemClick(item)}
                    className="absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-white shadow-sm ring-1 ring-black/10 transition-opacity hover:opacity-90"
                    style={{
                      top,
                      height,
                      left: `${column * widthPct}%`,
                      width: `calc(${widthPct}% - 2px)`,
                      backgroundColor: item.color,
                    }}
                    title={item.title}
                  >
                    <span className="block truncate text-[11px] font-medium leading-tight">{item.title}</span>
                    {height > 32 && item.kind === "meeting" && (
                      <span className="block truncate text-[10px] leading-tight text-white/80">
                        {formatDuration(Math.round(((item.endAt ?? item.at) - item.at) / 60_000))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
