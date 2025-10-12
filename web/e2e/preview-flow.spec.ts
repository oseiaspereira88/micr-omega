import { test, expect } from "@playwright/test";

const previewBaseUrl = process.env.PREVIEW_BASE_URL;

if (!previewBaseUrl) {
  test.describe.skip("preview flow", () => {
    test("skipped", () => {
      // Explicit skip when PREVIEW_BASE_URL is not provided.
    });
  });
} else {
  test.describe("Public room preview flow", () => {
    test("player can join the public room and see ranking updates", async ({ page }) => {
      const uniqueName = `Playwright-${Date.now()}`;

      await page.goto("/");

      await page.getByLabel("Nome do jogador").fill(uniqueName);
      await page.getByRole("button", { name: "Entrar na partida" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });

      const rankingPanel = page.getByRole("complementary", { name: "Ranking da partida" });
      await expect(rankingPanel).toBeVisible();
      await expect(rankingPanel.getByRole("heading", { name: "Ranking" })).toBeVisible();

      await expect(rankingPanel.getByText("Você")).toBeVisible({ timeout: 30_000 });
    });
  });
}
