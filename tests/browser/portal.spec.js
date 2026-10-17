import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const portalUrl = `http://127.0.0.1:${process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ?? "4174"}`;

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
  const toolbar = page.getByRole("toolbar", {
    name: "Moorkyz Toolbar website navigation",
  });
  await expect(toolbar).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const dockBackground = await toolbar.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(dockBackground).toBe("rgba(27, 34, 29, 0.96)");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("visual configurator validates drafts before applying a real preview", async ({
  page,
}) => {
  await page.goto(portalUrl);
  const actionLabel = page.getByRole("textbox", { name: "Action label" });
  const apply = page.getByRole("button", { name: "Apply to live preview" });
  const preview = page.getByRole("toolbar", { name: "Preview toolbar" });
  await expect(
    preview.getByRole("button", { name: "Documentation" }),
  ).toBeVisible();

  await actionLabel.fill("Run task");
  await page.getByLabel("Theme", { exact: true }).selectOption("midnight");
  await apply.click();
  await expect(preview).toHaveAttribute("data-theme", "midnight");
  await expect(preview.getByRole("button", { name: "Run task" })).toBeVisible();
  await expect(page.locator(".configurator-code")).toContainText(
    '"label": "Run task"',
  );
  await preview.getByRole("button", { name: "Run task" }).click();
  await expect(page.locator(".configurator-status")).toHaveText(
    'The host received action "docs".',
  );

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await actionLabel.fill("");
  await expect(page.locator(".configurator-validation")).toContainText(
    "actions.0.label: Action labels must be non-empty strings.",
  );
  await expect(apply).toBeDisabled();
  await expect(preview.getByRole("button", { name: "Run task" })).toBeVisible();
  const invalidDraftScan = await new AxeBuilder({ page }).analyze();
  expect(invalidDraftScan.violations).toEqual([]);

  await page.reload();
  await expect(page.getByLabel("Action label")).toHaveValue("Documentation");
  await expect(
    page.getByRole("toolbar", { name: "Preview toolbar" }),
  ).toHaveAttribute("data-theme", "signature");
});

test("toolbar preferences persist in the portal's explicit local namespace", async ({
  page,
}) => {
  await page.goto(portalUrl);
  const toolbar = page.getByRole("toolbar", {
    name: "Moorkyz Toolbar website navigation",
  });
  await page.getByRole("button", { name: "Customize toolbar" }).click();
  await page.getByRole("button", { name: /Theme: Signature/ }).click();
  await expect(toolbar).toHaveAttribute("data-theme", "frosted-glass");
  await page
    .getByRole("button", { name: /finish customizing toolbar/i })
    .click();

  await page.reload();
  await expect(
    page.getByRole("toolbar", {
      name: "Moorkyz Toolbar website navigation",
    }),
  ).toHaveAttribute("data-theme", "frosted-glass");
});

test("portal landing page has no automated axe violations", async ({
  page,
}) => {
  await page.goto(portalUrl);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});
