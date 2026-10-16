import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders in the browser and invokes only the host action callback", async ({
  page,
}) => {
  const toolbar = page.getByRole("toolbar", { name: "Application toolbar" });
  await expect(toolbar).toBeVisible();
  expect(
    await toolbar.evaluate(
      (element) => getComputedStyle(element.getRootNode().host).position,
    ),
  ).toBe("fixed");
  await page.getByRole("button", { name: "Projects" }).click();
  await expect(page.getByRole("status", { name: "Last action" })).toHaveText(
    "projects",
  );
});

test("supports keyboard navigation and manual collapse/restore", async ({
  page,
}) => {
  const home = page.getByRole("button", { name: "Home" });
  await home.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Projects" })).toBeFocused();

  await page.getByRole("button", { name: "Collapse toolbar" }).click();
  await expect(page.getByRole("button", { name: "Home" })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Restore toolbar" }),
  ).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Restore toolbar" }).click();
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible();
});

test("keeps the dock within a narrow viewport and scrolls its action row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();

  const toolbar = page.getByRole("toolbar");
  const bounds = await toolbar.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  const actionRow = await toolbar
    .locator(".mzk-toolbar__actions")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(actionRow.scrollWidth).toBeGreaterThan(actionRow.clientWidth);
  const towardStart = page.getByRole("button", {
    name: "Scroll toolbar actions toward start",
  });
  const towardEnd = page.getByRole("button", {
    name: "Scroll toolbar actions toward end",
  });
  await expect(towardStart).toBeDisabled();
  await expect(towardEnd).toBeEnabled();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await towardEnd.click();
  await expect(towardStart).toBeEnabled();
  await expect(towardEnd).toBeDisabled();
  await expect(toolbar).toHaveAttribute("data-overflow-end", "false");
  await towardStart.click();
  await expect(towardStart).toBeDisabled();
  await expect(toolbar).toHaveAttribute("data-overflow-end", "true");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test("positions container and fullscreen mounts within their host element", async ({
  page,
}) => {
  const container = page.locator("#container-target");
  const targetPosition = await container.evaluate(
    (element) => getComputedStyle(element).position,
  );
  await page.evaluate(() => window.mountPlacementToolbar("container"));

  let host = container.locator(".mzk-toolbar-host");
  await expect(
    page.getByRole("toolbar", { name: "container toolbar" }),
  ).toBeVisible();
  let placement = await host.evaluate((element) => ({
    position: getComputedStyle(element).position,
    bottom: element.getBoundingClientRect().bottom,
    parentBottom: element.parentElement.getBoundingClientRect().bottom,
  }));
  expect(placement.position).toBe("absolute");
  expect(placement.bottom).toBeLessThanOrEqual(placement.parentBottom);
  expect(targetPosition).toBe("relative");

  await page.evaluate(() => {
    window.placementToolbar.dispose();
    window.mountPlacementToolbar("fullscreen");
  });
  host = container.locator(".mzk-toolbar-host");
  await expect(
    page.getByRole("toolbar", { name: "fullscreen toolbar" }),
  ).toBeVisible();
  placement = await host.evaluate((element) => ({
    position: getComputedStyle(element).position,
    bottom: element.getBoundingClientRect().bottom,
    parentBottom: element.parentElement.getBoundingClientRect().bottom,
  }));
  expect(placement.position).toBe("absolute");
  expect(placement.bottom).toBeLessThanOrEqual(placement.parentBottom);
  expect(
    await container.evaluate((element) => getComputedStyle(element).position),
  ).toBe(targetPosition);
});

test("honors reduced motion and loads only local CSS under a restrictive CSP", async ({
  page,
}) => {
  const externalRequests = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173/")) {
      externalRequests.push(request.url());
    }
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();

  const transitionDuration = await page
    .getByRole("toolbar")
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transitionDuration).toBe("0s");
  expect(externalRequests).toEqual([]);

  const policy = await page.locator("html").evaluate(async () => {
    const response = await fetch("/");
    return response.headers.get("content-security-policy");
  });
  expect(policy).toContain("style-src 'self'");
  expect(policy).not.toContain("unsafe-inline");
});

test("supports scoped Light DOM styling and passes axe checks", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.toolbar.dispose();
    window.mountLightToolbar();
  });
  await expect(
    page.getByRole("toolbar", { name: "Light mode toolbar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.locator("#action-result")).toHaveText("search");

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});

test("dispose removes the mounted interface", async ({ page }) => {
  await page.evaluate(() => window.toolbar.dispose());
  await expect(page.getByRole("toolbar")).toHaveCount(0);
});
