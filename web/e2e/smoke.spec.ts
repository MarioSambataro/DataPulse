import { expect, test } from "@playwright/test";

// Smoke E2E in modalità mock: la dashboard si avvia, il globo WebGL renderizza,
// l'HUD mostra dati e il time-travel si attiva. Lo screenshot del globo viene
// allegato al report (artefatto in CI).

test.beforeEach(async ({ page }) => {
  await page.goto("/?mock=1");
});

test("la dashboard si avvia con globo e HUD", async ({ page }) => {
  await expect(page).toHaveTitle(/DataPulse/i);

  // Canvas WebGL montato (scena three.js).
  await expect(page.locator("canvas")).toBeVisible();

  // HUD: brand (nell'header: lo splash ha lo stesso testo), stat e filtri.
  await expect(page.getByRole("banner").getByText("Geo-Tectonic Monitor")).toBeVisible();
  await expect(page.getByLabel("Statistiche 24 ore")).toBeVisible();
  await expect(page.getByLabel("Filtri")).toBeVisible();

  // Il feed mock è caricato: il contatore eventi appare nella top bar.
  await expect(page.getByText(/eventi/i).first()).toBeVisible({ timeout: 15_000 });
});

test("il replay time-travel si attiva e si chiude", async ({ page }) => {
  // Attendi che i dati mock siano caricati (il bottone Replay si abilita).
  const replay = page.getByRole("button", { name: "Replay" });
  await expect(replay).toBeEnabled({ timeout: 15_000 });

  await replay.click();
  await expect(page.getByLabel("Timeline eventi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Torna al live" })).toBeVisible();

  await page.getByRole("button", { name: "Torna al live" }).click();
  await expect(page.getByLabel("Timeline eventi")).toHaveCount(0);
});

test("screenshot del globo per il report", async ({ page }, testInfo) => {
  // Lascia finire l'intro (dolly-in ~2.5s) e stabilizzare il rendering.
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(4_000);

  const shot = await page.screenshot({ fullPage: false });
  await testInfo.attach("globe", { body: shot, contentType: "image/png" });
});
