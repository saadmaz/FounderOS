"use client";

/**
 * Last-resort boundary for errors thrown by the root layout itself (fonts,
 * Providers, etc.) - extremely rare, but Next.js requires this exact file
 * name/shape for that case, and it must render its own <html>/<body> since
 * the root layout that normally provides them is what failed. No shared
 * components/Tailwind classes on purpose - if the root layout is broken,
 * this can't assume anything else in the app still works.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: "#71717a", maxWidth: 320 }}>
          FounderOS hit an unexpected error while loading. Try again, or reload the page.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#2563eb",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
