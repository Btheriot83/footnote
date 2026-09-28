// Captures the dream-loop comparison shots: node scripts/qa/capture.mjs <outDir> [baseUrl]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] || ".dream-loop/shots/latest";
const base = process.argv[3] || "http://localhost:3000";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

await page.goto(base + "/");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/landing.png` });
await page.screenshot({ path: `${out}/landing-full.png`, fullPage: true });

await page.goto(base + "/app?sample=1");
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/workspace-live.png` });
await page.getByRole("button", { name: /Skip to end/ }).click();
await page.waitForTimeout(800);
await page.keyboard.press("ControlOrMeta+Enter");
await page.getByRole("heading", { name: "Enhanced notes" }).waitFor({ timeout: 90000 });
await page.waitForFunction(() => !document.body.innerText.includes("Enhancing"), null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1500);
const mark = page.locator(".fn-mark").nth(2);
if (await mark.count()) await mark.hover();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/workspace-enhanced.png` });

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p2 = await phone.newPage();
await p2.goto(base + "/");
await p2.waitForTimeout(800);
await p2.screenshot({ path: `${out}/phone-landing.png` });
await p2.goto(base + "/app?sample=1");
await p2.waitForTimeout(5000);
await p2.screenshot({ path: `${out}/phone-app.png` });
console.log(JSON.stringify({ out, errors }, null, 1));
await browser.close();
