import { expect, test } from "@playwright/test";

// Mock-mode E2E covering startup, WebGL rendering, HUD data, and replay controls.

test.beforeEach(async ({ page }) => {
  await page.goto("/?mock=1");
});

test("the dashboard starts with the globe and HUD", async ({ page }) => {
  await expect(page).toHaveTitle(/DataPulse/i);

  // The Three.js WebGL canvas is mounted.
  await expect(page.locator("canvas")).toBeVisible();

  // Verify brand, statistics, and filters in the HUD.
  await expect(page.getByRole("banner").getByText("Geo-Tectonic Monitor")).toBeVisible();
  await expect(page.getByLabel("Statistiche 24 ore")).toBeVisible();
  await expect(page.getByLabel("Filtri")).toBeVisible();

  // The top bar displays an event count after the mock feed loads.
  await expect(page.getByRole("banner")).toContainText(/eventi/i, { timeout: 15_000 });
});

test("replay can be opened and closed", async ({ page }) => {
  // Wait for mock data to enable replay.
  const replay = page.getByRole("button", { name: "Replay" });
  await expect(replay).toBeEnabled({ timeout: 15_000 });

  await replay.click();
  await expect(page.getByLabel("Timeline eventi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Torna al live" })).toBeVisible();

  await page.getByRole("button", { name: "Torna al live" }).click();
  await expect(page.getByLabel("Timeline eventi")).toHaveCount(0);
});

test("capture the globe for the report", async ({ page }, testInfo) => {
  // Allow the intro dolly to finish and rendering to stabilize.
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(4_000);

  const shot = await page.screenshot({ fullPage: false });
  await testInfo.attach("globe", { body: shot, contentType: "image/png" });
});

test("the mobile HUD fits the viewport and exposes every tool", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mock=1");

  await expect(page.getByRole("banner")).toBeVisible();
  const menu = page.getByRole("button", { name: "Apri menu" });
  await expect(menu).toBeVisible();
  await menu.click();

  const drawer = page.getByRole("dialog", { name: "Control Center" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("navigation", { name: "Strumenti dashboard" })).toBeVisible();

  await expect(drawer.getByLabel("Statistiche 24 ore")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "AI" })).toHaveCount(0);

  await drawer.getByRole("button", { name: "Filtri" }).click();
  await expect(drawer.locator("#mobile-hud-panel").getByLabel("Filtri")).toBeVisible();

  await drawer.getByRole("button", { name: "Chiudi pannello" }).click();
  const aiButton = page.getByRole("button", { name: "Apri DataPulse AI" });
  await expect(aiButton).toBeVisible();
  await aiButton.click();

  const aiChat = page.getByRole("dialog", { name: "DataPulse AI" });
  await expect(aiChat).toBeVisible();
  await expect(aiChat.getByPlaceholder("Chiedi a DataPulse…")).toBeVisible();
  await aiChat.getByRole("button", { name: "Chiudi DataPulse AI" }).click();
  await expect(aiChat).toHaveCount(0);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
