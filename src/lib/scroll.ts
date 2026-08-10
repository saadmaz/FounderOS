/**
 * Every route shares one scroll container - the `<main>` in
 * src/app/(app)/layout.tsx (the app uses its own overflow-y-auto element
 * instead of window scroll, so Next.js's built-in "scroll to top on
 * navigation" doesn't reach it). Switching a `<Tabs>` panel can swap in
 * content of a very different height without changing the URL, so nothing
 * resets the scroll offset on its own: land deep in a tall "Overview" tab,
 * tap "Expenses", and you're dropped at the same pixel offset in unrelated
 * content instead of at the top of it - it reads as the page randomly
 * jumping. Call this from a `<Tabs onValueChange={scrollMainToTop}>` (fires
 * on real tab changes only, not on the initial mount) to keep tab switches
 * anchored to the top like users expect.
 */
export function scrollMainToTop() {
  document.querySelector("main")?.scrollTo({ top: 0, behavior: "instant" });
}
