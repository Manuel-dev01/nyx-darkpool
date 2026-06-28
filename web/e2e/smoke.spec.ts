import { test, expect } from "@playwright/test";

// Browser E2E driving the real Nyx product UI through the full flow:
//   landing → desk access (generate key) → compose & seal → broadcast →
//   pool (demo-mode auto-counter) → proofs (4 stages) → settled (on-chain).
// Each test gets a fresh browser context (empty localStorage → a new desk).

test("landing → request access → generate desk → desk loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/nyx/i);
  await page.getByRole("link", { name: /request desk access/i }).first().click();
  await expect(page).toHaveURL(/\/app\/access/);

  // Generate flow is the default; authenticate the freshly-minted key.
  await page.getByRole("button", { name: /authenticate/i }).first().click();
  await expect(page).toHaveURL(/\/app(\/?$|\?)/, { timeout: 30_000 });
  await expect(page.getByText("Desk", { exact: true }).first()).toBeVisible();
});

test("compose rejects an invalid price (no broadcast)", async ({ page }) => {
  await page.goto("/app/access");
  await page.getByRole("button", { name: /authenticate/i }).first().click();
  await expect(page).toHaveURL(/\/app(\/?$|\?)/, { timeout: 30_000 });

  await page.goto("/app/compose");
  const price = page.getByLabel("Limit price");
  await price.fill("abc");
  // Seal preview surfaces the validation error and disables broadcast.
  await expect(page.getByText(/invalid price/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /seal & broadcast/i })).toBeDisabled();
});

test("full pipeline: seal → broadcast → match → prove → settle", async ({ page }) => {
  test.slow(); // settles on testnet — give it room
  await page.goto("/app/access");
  await page.getByRole("button", { name: /authenticate/i }).first().click();
  await expect(page).toHaveURL(/\/app(\/?$|\?)/, { timeout: 30_000 });

  // Compose: defaults (BID · 99.84 · 5,000,000) are a valid order; just seal.
  await page.goto("/app/compose");
  // Wait for the live Poseidon commitment to compute (preview leaves "computing…").
  await expect(page.getByText(/SEALED LOCALLY/i)).toBeVisible();
  const broadcast = page.getByRole("button", { name: /seal & broadcast/i });
  await expect(broadcast).toBeEnabled({ timeout: 30_000 });
  await broadcast.click();

  // Pool: demo-mode (default ON) auto-posts a crossing counter ~2.5s later.
  await expect(page).toHaveURL(/\/app\/pool/, { timeout: 30_000 });
  await expect(page.getByText(/MATCH FOUND/i)).toBeVisible({ timeout: 60_000 });

  // Proofs: the ZK proof is generated in the engine.
  await page.goto("/app/proofs");
  await expect(page.getByText("ZK proof generated")).toBeVisible();
  await expect(page.getByText(/stored ✓/i)).toBeVisible({ timeout: 90_000 });

  // Settled: on-chain confirmation flips the heading + reveals the explorer link.
  await page.goto("/app/settled");
  await expect(page.getByText(/Settled/i).first()).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/atomically/i)).toBeVisible({ timeout: 120_000 });
  const explorer = page.getByRole("link", { name: /stellar explorer/i });
  await expect(explorer).toBeVisible();
  await expect(explorer).toHaveAttribute("href", /stellar\.expert\/explorer\/testnet\/tx\//);
});
