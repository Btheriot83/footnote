import { expect, test } from "@playwright/test";
import cached from "../../src/lib/sample/cached-enhancement.json";

/** The enhance API is mocked with the bundled sample enhancement, streamed as NDJSON. */
async function mockEnhance(page: import("@playwright/test").Page) {
  await page.route("**/api/enhance", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.template).toBe("sales");
    expect(body.transcriptSegments.length).toBe(22);
    expect(body.userNotes).toContain("series B");
    const first = { ...cached, sections: cached.sections.slice(0, 1) };
    const lines = [
      { type: "partial", notes: first },
      { type: "final", notes: cached, report: { droppedCites: 0, droppedBullets: 0 } },
    ];
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/x-ndjson" },
      body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    });
  });
}

test("landing page leads to the sample meeting", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meeting notes");
  await page.getByRole("link", { name: "Try a sample meeting" }).first().click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator("#meeting-title")).toHaveValue("Acme renewal — sales call");
});

test("sample meeting: plays, enhances with receipts, shows originals, shares", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockEnhance(page);
  await page.goto("/app?sample=1");

  // Plays like a live meeting: transcript lines and typed notes appear.
  const transcript = page.getByRole("complementary", { name: "Transcript" });
  await expect(transcript.getByText("Hi Dana, thanks for making time today.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Your notes")).toHaveValue(/acme renewal/);

  // Skip ahead and get nudged to enhance.
  await page.getByRole("button", { name: /Skip to end/ }).click();
  await expect(transcript.getByText("22 lines")).toBeVisible();
  await expect(page.getByText("Now hit Enhance")).toBeVisible();

  // Cmd/Ctrl+Enter enhances.
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("heading", { name: "Enhanced notes" })).toBeVisible();
  const firstBullet = cached.sections[0].bullets[0];
  await expect(page.locator("[data-bullet='0:0']")).toContainText(firstBullet.text);

  // Receipts: hovering a footnote highlights the cited transcript line.
  const marker = page.locator("[data-bullet='0:0'] .fn-mark").first();
  await marker.hover();
  const cited = transcript.locator(`[data-segment='${firstBullet.cites[0]}'] > div`);
  await expect(cited).toHaveClass(/bg-accent-soft/);

  // Clicking a cited line shows which bullets cite it.
  await cited.click();
  await expect(transcript.getByText("Cited in your notes")).toBeVisible();

  // Original notes are one click away.
  await page.getByRole("button", { name: "Show my original notes" }).click();
  await expect(page.getByLabel("Your notes")).toHaveValue(/series B closed/);
  await page.getByRole("button", { name: "Show enhanced notes" }).click();

  // Share link opens a read-only page with the same notes.
  await page.getByRole("button", { name: "Share" }).click();
  const url = await page.locator("#share-url").inputValue();
  expect(url).toContain("/s#");
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acme renewal — sales call");
  await expect(page.getByText(firstBullet.text)).toBeVisible();
});

test("history persists and search finds transcript text", async ({ page }) => {
  await mockEnhance(page);
  await page.goto("/app?sample=1");
  await page.getByRole("button", { name: /Skip to end/ }).click();
  await page.reload();
  await expect(page.locator("#meeting-title")).toHaveValue("Acme renewal — sales call");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Search").fill("Northstar");
  const nav = page.getByRole("navigation", { name: "Meetings" });
  await expect(nav.getByText(/led by Northstar/)).toBeVisible();
  // Example meetings seeded on the first visit are searchable too.
  await page.getByPlaceholder("Search").fill("Brightline");
  await expect(nav.getByRole("button", { name: /Weekly 1:1 with Priya/ })).toBeVisible();
  await page.getByPlaceholder("Search").fill("zzzz-not-there");
  await expect(page.getByText(/No meetings match/)).toBeVisible();
});

test("receipts you can hear: a footnote plays the cited moment", async ({ page }) => {
  await mockEnhance(page);
  await page.goto("/app?sample=1");
  await page.getByRole("button", { name: /Skip to end/ }).click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("heading", { name: "Enhanced notes" })).toBeVisible();
  const marker = page.locator("[data-bullet='0:0'] .fn-mark").first();
  await marker.click();
  await expect(marker).toHaveAttribute("data-playing", "true");
  await expect(page.getByRole("button", { name: "Stop playback" })).toBeVisible();
  await page.getByRole("button", { name: "Stop playback" }).click();
  await expect(marker).not.toHaveAttribute("data-playing", "true");
});

test("recipes and asking across meetings answer with receipts", async ({ page }) => {
  await mockEnhance(page);
  await page.route("**/api/ask", async (route) => {
    const body = route.request().postDataJSON();
    if (body.recipe === "follow-up") {
      return route.fulfill({
        json: {
          sentences: [
            { text: "Hi Dana,", cites: [] },
            { text: "I'll send two pricing options by Thursday.", cites: ["s19"], newParagraph: true },
          ],
        },
      });
    }
    // Across meetings: ids are "<ref>:<segment>" and the example 1:1 is included.
    expect(body.meetings.length).toBeGreaterThan(1);
    const ref = body.meetings.find((m: { title: string }) => m.title === "Weekly 1:1 with Priya").ref;
    return route.fulfill({ json: { sentences: [{ text: "Brightline closed with 42 seats.", cites: [`${ref}:s2`] }] } });
  });
  await page.goto("/app?sample=1");
  await page.getByRole("button", { name: /Skip to end/ }).click();

  await page.getByRole("button", { name: "Draft a follow-up email" }).click();
  await expect(page.getByText("I'll send two pricing options by Thursday.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy email" })).toBeVisible();

  await page.getByRole("button", { name: "Ask your meetings", exact: true }).click();
  await page.getByPlaceholder("What did we decide about pricing?").fill("What did Brightline buy?");
  await page.getByPlaceholder("What did we decide about pricing?").press("Enter");
  await page.getByRole("button", { name: /Source: Weekly 1:1 with Priya/ }).click();
  await expect(page.locator("#meeting-title")).toHaveValue("Weekly 1:1 with Priya");
  await expect(page.locator("[data-segment='s2'] > div").first()).toHaveClass(/bg-accent-soft/);
});
