import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const portalUrl = "http://127.0.0.1:4174";

test("portal mounts the actual library and updates its actions by context", async ({
  page,
}) => {
  const externalRequests = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(`${portalUrl}/`)) {
      externalRequests.push(request.url());
    }
  });
  const response = await page.goto(portalUrl);
  const policy = response.headers()["content-security-policy"];
  expect(policy).toContain("script-src 'self' 'nonce-");
  expect(policy).toContain("style-src 'self' 'nonce-");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain("unsafe-inline");
  const socialCard = await page.request.get(
    `${portalUrl}/moorkyz-toolbar-github.png`,
  );
  expect(socialCard.ok()).toBe(true);
  expect(socialCard.headers()["content-type"]).toContain("image/png");

  const toolbar = page.getByRole("toolbar", {
    name: "Moorkyz Toolbar website navigation",
  });
  await expect(toolbar).toBeVisible();
  await expect(page.getByRole("button", { name: "Explore" })).toBeVisible();

  await page.getByRole("button", { name: "Dashboard" }).click();
  await expect(
    page.getByRole("button", { name: "Built for control" }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test("portal theme persists locally and updates the mounted dock tokens", async ({
  page,
}) => {
  await page.goto(portalUrl);
  await expect(page.getByRole("toolbar")).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const dockBackground = await page
    .getByRole("toolbar")
    .evaluate((toolbar) => getComputedStyle(toolbar).backgroundColor);
  expect(dockBackground).toBe("rgba(27, 34, 29, 0.96)");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("portal landing page has no automated axe violations", async ({
  page,
}) => {
  await page.goto(portalUrl);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});
