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
  await expect(page.getByText(/eventi/i).first()).toBeVisible({ timeout: 15_000 });
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
  await expect(page.getByRole("navigation", { name: "Strumenti dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Dati" }).click();
  const mobilePanel = page.getByRole("complementary", { name: "Dati" });
  await expect(mobilePanel.getByLabel("Statistiche 24 ore")).toBeVisible();

  await page.getByRole("button", { name: "Filtri" }).click();
  await expect(page.getByRole("complementary", { name: "Filtri" }).getByLabel("Filtri")).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
