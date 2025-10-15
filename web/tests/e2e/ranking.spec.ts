import { expect, test } from "@playwright/test";

const previewConfigured = Boolean(process.env.PLAYWRIGHT_BASE_URL || process.env.PLAYWRIGHT_WS_URL);

test.describe.configure({ mode: "serial" });

test.skip(!previewConfigured, "Ambiente de preview não configurado. Defina PLAYWRIGHT_BASE_URL e PLAYWRIGHT_WS_URL.");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalWebSocket = window.WebSocket;
    const hook: any = (window as any).__MICR_OMEGA_E2E__ ?? {};
    hook.instances = [];
    hook.lastJoin = null;
    hook.lastRanking = null;
    hook.lastError = null;
    class TestWebSocket extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        hook.instances.push(this);
        hook.active = this;
        this.addEventListener("message", (event) => {
          try {
            const payload = typeof event.data === "string" ? JSON.parse(event.data) : null;
            if (payload && typeof payload === "object") {
              if (payload.type === "joined") {
                hook.lastJoin = payload;
              }
              if (payload.type === "ranking") {
                hook.lastRanking = payload;
              }
              if (payload.type === "error") {
                hook.lastError = payload;
              }
            }
          } catch (err) {
            console.error("E2E hook failed to parse message", err);
          }
        });
      }
    }
    Object.defineProperty(TestWebSocket, "CONNECTING", { value: OriginalWebSocket.CONNECTING });
    Object.defineProperty(TestWebSocket, "OPEN", { value: OriginalWebSocket.OPEN });
    Object.defineProperty(TestWebSocket, "CLOSING", { value: OriginalWebSocket.CLOSING });
    Object.defineProperty(TestWebSocket, "CLOSED", { value: OriginalWebSocket.CLOSED });
    (window as any).__MICR_OMEGA_E2E__ = hook;
    window.WebSocket = TestWebSocket as typeof WebSocket;
  });
});

test("permite entrar na sala pública e exibe o jogador local no ranking", async ({ page }) => {
  await page.goto("/");

  const playerName = `E2E-${Date.now()}`;
  await page.getByLabel("Nome do jogador").fill(playerName);
  await page.getByRole("button", { name: "Entrar na partida" }).click();

  await expect(page.getByLabel("Ranking da partida", { exact: false })).toBeVisible();
  await expect(page.getByText("Você")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(playerName)).toBeVisible({ timeout: 15_000 });
});

test("ignora ações de pontuação não autorizadas do cliente", async ({ page }) => {
  await page.goto("/");

  const playerName = `E2E-${Date.now()}-score`;
  await page.getByLabel("Nome do jogador").fill(playerName);
  await page.getByRole("button", { name: "Entrar na partida" }).click();

  await page.waitForFunction(() => {
    const hook = (window as any).__MICR_OMEGA_E2E__;
    return Boolean(hook?.active && hook?.active.readyState === WebSocket.OPEN);
  }, null, { timeout: 15_000 });

  await page.waitForFunction(() => {
    const hook = (window as any).__MICR_OMEGA_E2E__;
    return Boolean(hook?.lastJoin?.playerId);
  }, null, { timeout: 15_000 });

  await page.evaluate(() => {
    const hook = (window as any).__MICR_OMEGA_E2E__;
    const socket: WebSocket | undefined = hook?.active;
    const join = hook?.lastJoin;
    if (!socket || !join?.playerId) {
      throw new Error("WebSocket não disponível para simulação de ações");
    }
    const action = {
      type: "action",
      playerId: join.playerId as string,
      action: { type: "score", amount: 180, comboMultiplier: 2 },
    };
    socket.send(JSON.stringify(action));
  });

  await page.waitForFunction(() => {
    const hook = (window as any).__MICR_OMEGA_E2E__;
    return hook?.lastError?.reason === "invalid_payload";
  }, null, { timeout: 15_000 });

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const hook = (window as any).__MICR_OMEGA_E2E__;
      const join = hook?.lastJoin;
      const ranking = (hook?.lastRanking?.ranking ?? join?.ranking) as
        | { playerId: string; score: number }[]
        | undefined;
      if (!join?.playerId || !ranking) {
        return null;
      }
      const entry = ranking.find((item) => item.playerId === join.playerId);
      return entry?.score ?? null;
    });
  }, { timeout: 15_000 }).toBe(0);
});
