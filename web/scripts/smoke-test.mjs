import { chromium } from "playwright";

const errors = [];
const shots = "C:/Users/saadm/AppData/Local/Temp/claude/c--Users-saadm-Downloads-FounderOS/42d3cbbf-20f7-480a-be55-7b8ebda93d3a/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

console.log("Navigating to /login...");
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.screenshot({ path: `${shots}/01-login.png` });

console.log("Signing in...");
await page.fill("#email", "demo@founderos.app");
await page.fill("#password", "founderos123");
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
console.log("URL after submit:", page.url());
console.log("Errors so far:", errors);
const bodyText = await page.locator("body").innerText();
console.log("Body text snippet:", bodyText.slice(0, 500));

await page.waitForURL("**/dashboard", { timeout: 15000 });
await page.waitForTimeout(1500); // let Firestore snapshots settle
await page.screenshot({ path: `${shots}/02-dashboard.png`, fullPage: true });
console.log("Dashboard loaded:", page.url());

console.log("Navigating to /companies...");
await page.goto("http://localhost:3000/companies", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/03-companies.png`, fullPage: true });

console.log("Navigating to a company detail page...");
const firstCompanyCard = page.locator('a[href^="/companies/"]').first();
await firstCompanyCard.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/04-company-detail.png`, fullPage: true });
console.log("Company detail URL:", page.url());

console.log("Navigating to /tasks (board view)...");
await page.goto("http://localhost:3000/tasks", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/05-tasks-board.png`, fullPage: true });

console.log("Switching to table view...");
await page.click("text=Table");
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/06-tasks-table.png`, fullPage: true });

console.log("Navigating to /time...");
await page.goto("http://localhost:3000/time", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/07-time.png`, fullPage: true });

console.log("Testing command palette (Cmd+K)...");
await page.keyboard.press("Control+k");
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/08-command-palette.png` });
await page.keyboard.press("Escape");

console.log("Testing light mode toggle...");
await page.goto("http://localhost:3000/settings", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.click("text=Light");
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/09-settings-light.png`, fullPage: true });

console.log("\n--- Console/page errors captured ---");
if (errors.length === 0) {
  console.log("NONE");
} else {
  errors.forEach((e) => console.log(e));
}

await browser.close();
console.log("\nDONE");
