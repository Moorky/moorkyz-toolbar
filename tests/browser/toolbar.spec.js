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
  await expect(host).toHaveCSS("position", "absolute");
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
  await expect(host).toHaveCSS("position", "absolute");
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
  await page.locator('[data-toolbar-control="action:search"]').click();
  await expect(page.locator("#action-result")).toHaveText("search");

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});

test("built-in theme families render without axe violations", async ({
  page,
}) => {
  const themes = [
    "signature",
    "frosted-glass",
    "midnight",
    "warm-minimal",
    "high-contrast",
    "project-adaptive",
  ];

  for (const theme of themes) {
    const result = await page.evaluate(
      (name) => window.toolbar.update({ theme: name, colorScheme: "light" }),
      theme,
    );
    expect(result.ok).toBe(true);
    await expect(page.getByRole("toolbar")).toHaveAttribute(
      "data-theme",
      theme,
    );
    const background = await page
      .getByRole("toolbar")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background).not.toBe("rgba(0, 0, 0, 0)");

    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  }
});

test("customization mode supports accessible reordering and never dispatches edits", async ({
  page,
}) => {
  const toolbar = page.getByRole("toolbar");
  await page.getByRole("button", { name: "Customize toolbar" }).click();
  await expect(
    page.getByRole("button", { name: /finish customizing toolbar/i }),
  ).toHaveAttribute("aria-pressed", "true");

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await page.getByRole("button", { name: /Theme: Signature/ }).click();
  await expect(toolbar).toHaveAttribute("data-theme", "frosted-glass");
  const moveHomeLater = page.getByRole("button", { name: "Move Home later" });
  await moveHomeLater.focus();
  await page.keyboard.press("Enter");
  expect(
    await toolbar
      .locator(".mzk-toolbar__action")
      .evaluateAll((actions) =>
        actions.map((action) =>
          action.getAttribute("data-toolbar-control").slice("action:".length),
        ),
      ),
  ).toEqual(["projects", "home", "documentation", "settings", "support"]);
  await expect(
    page.getByRole("button", { name: "Home", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#action-result")).toBeEmpty();
  await page
    .getByRole("button", { name: /finish customizing toolbar/i })
    .click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.locator("#action-result")).toHaveText("home");
});

test("Task Center presents safe host-fed state only while enabled", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.toolbar.dispose();
    window.mountTaskToolbar();
  });
  const toolbar = page.getByRole("toolbar", {
    name: "Task Center test toolbar",
  });
  const updateResult = await page.evaluate(() =>
    window.taskToolbar.updateTasks([
      {
        id: "build",
        label: "<img src=x onerror=alert(1)>",
        status: "running",
      },
    ]),
  );
  expect(updateResult.ok).toBe(true);
  const tasksButton = page.getByRole("button", { name: "Tasks (1)" });
  await tasksButton.focus();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("region", { name: "Task Center" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("<img src=x onerror=alert(1)>");
  await expect(panel.locator("img")).toHaveCount(0);

  const themeSelections = [
    ["signature", "light"],
    ["frosted-glass", "light"],
    ["midnight", "light"],
    ["warm-minimal", "light"],
    ["high-contrast", "light"],
    ["project-adaptive", "light"],
    ["signature", "dark"],
    ["midnight", "dark"],
    ["warm-minimal", "dark"],
    ["high-contrast", "dark"],
  ];
  for (const [theme, colorScheme] of themeSelections) {
    const result = await page.evaluate(
      ({ nextTheme, nextScheme }) =>
        window.taskToolbar.update({
          theme: nextTheme,
          colorScheme: nextScheme,
        }),
      { nextTheme: theme, nextScheme: colorScheme },
    );
    expect(result.ok).toBe(true);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  }

  await page.evaluate(() =>
    window.taskToolbar.update({ features: { tasks: false } }),
  );
  await expect(toolbar.getByRole("button", { name: /^Tasks/ })).toHaveCount(0);
  await expect(panel).toHaveCount(0);
});

test("notifications remain quiet until the user opens them and never restore collapse", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.toolbar.dispose();
    window.mountNotificationsToolbar();
  });
  const toolbar = page.getByRole("toolbar", {
    name: "Notifications test toolbar",
  });
  const initial = await page.evaluate(() =>
    window.notificationToolbar.updateNotifications([
      {
        id: "connection",
        title: "Connection lost",
        message: "<img src=x onerror=alert(1)>",
        severity: "warning",
        unread: true,
      },
    ]),
  );
  expect(initial.ok).toBe(true);
  const panel = page.getByRole("region", { name: "Notifications" });
  await expect(panel).toBeHidden();

  const collapsed = await page.evaluate(() =>
    window.notificationToolbar.collapse(),
  );
  expect(collapsed.ok).toBe(true);
  const update = await page.evaluate(() =>
    window.notificationToolbar.updateNotifications([
      {
        id: "connection",
        title: "Connection lost",
        message: "<img src=x onerror=alert(1)>",
        severity: "warning",
        unread: true,
      },
      {
        id: "recovered",
        title: "Connection restored",
        message: "Changes are syncing again.",
        severity: "success",
        unread: true,
      },
    ]),
  );
  expect(update.ok).toBe(true);
  await expect(toolbar).toHaveAttribute("data-collapsed", "true");
  await expect(panel).toBeHidden();
  const button = page.getByRole("button", { name: "Notifications (2)" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("<img src=x onerror=alert(1)>");
  await expect(panel.locator("img")).toHaveCount(0);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await page.evaluate(() =>
    window.notificationToolbar.update({ features: { notifications: false } }),
  );
  await expect(
    toolbar.getByRole("button", { name: /^Notifications/ }),
  ).toHaveCount(0);
  await expect(panel).toHaveCount(0);
});

test("offline status is explicit host state and does not change collapse or fetch", async ({
  page,
}) => {
  const externalRequests = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173/")) {
      externalRequests.push(request.url());
    }
  });
  await page.evaluate(() => {
    window.toolbar.dispose();
    window.mountOfflineToolbar();
  });
  const toolbar = page.getByRole("toolbar", {
    name: "Offline status test toolbar",
  });
  const status = toolbar.locator(".mzk-toolbar__connectivity");
  await expect(status).toHaveText("Connection status unknown");
  await page.evaluate(() => window.offlineToolbar.collapse());
  const updated = await page.evaluate(() =>
    window.offlineToolbar.updateConnectivityStatus("offline"),
  );
  expect(updated.ok).toBe(true);
  await expect(toolbar).toHaveAttribute("data-collapsed", "true");
  await expect(status).toHaveText("Offline");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
  expect(externalRequests).toEqual([]);

  await page.evaluate(() =>
    window.offlineToolbar.update({ features: { offline: false } }),
  );
  await expect(toolbar.locator(".mzk-toolbar__connectivity")).toHaveCount(0);
});

test("advanced gestures stay opt-in, ignore scrolling and edge gestures, and do not cancel browser events", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.toolbar.dispose();
    window.mountGestureManager(false);
  });
  const beforeEnable = await page.evaluate(() => {
    const target = document.querySelector("#gesture-target");
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: 100,
        clientY: 100,
      }),
    );
    target.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: 200,
        clientY: 100,
      }),
    );
    return window.gestureResults.length;
  });
  expect(beforeEnable).toBe(0);

  const outcomes = await page.evaluate(() => {
    const target = document.querySelector("#gesture-target");
    window.gestureManager.setEnabled(true);
    const send = (type, properties, element = target) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          pointerId: properties.pointerId,
          pointerType: properties.pointerType ?? "touch",
          isPrimary: true,
          button: 0,
          cancelable: true,
          clientX: properties.clientX,
          clientY: properties.clientY,
        }),
      );

    send("pointerdown", { pointerId: 2, clientX: 100, clientY: 100 });
    const notPrevented = send("pointerup", {
      pointerId: 2,
      clientX: 200,
      clientY: 110,
    });

    send("pointerdown", { pointerId: 3, clientX: 100, clientY: 100 });
    send("pointermove", { pointerId: 3, clientX: 105, clientY: 190 });
    send("pointerup", { pointerId: 3, clientX: 106, clientY: 200 });

    send("pointerdown", { pointerId: 4, clientX: 10, clientY: 100 });
    send("pointerup", { pointerId: 4, clientX: 110, clientY: 100 });

    send("pointerdown", {
      pointerId: 5,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    send("pointerup", { pointerId: 5, clientX: 200, clientY: 100 });

    const button = document.createElement("button");
    target.appendChild(button);
    send("pointerdown", { pointerId: 6, clientX: 100, clientY: 100 }, button);
    send("pointerup", { pointerId: 6, clientX: 200, clientY: 100 });
    button.remove();

    send("pointerdown", { pointerId: 7, clientX: 200, clientY: 100 });
    send("pointercancel", { pointerId: 7, clientX: 100, clientY: 100 });
    send("pointerup", { pointerId: 7, clientX: 100, clientY: 100 });

    send("pointerdown", {
      pointerId: 8,
      pointerType: "pen",
      clientX: 200,
      clientY: 100,
    });
    send("pointerup", {
      pointerId: 8,
      pointerType: "pen",
      clientX: 100,
      clientY: 100,
    });
    const beforeDisable = window.gestureResults.length;

    send("pointerdown", { pointerId: 9, clientX: 100, clientY: 100 });
    window.gestureManager.setEnabled(false);
    send("pointerup", { pointerId: 9, clientX: 200, clientY: 100 });
    return {
      beforeDisable,
      results: window.gestureResults,
      enabled: window.gestureManager.enabled,
      notPrevented,
    };
  });
  expect(outcomes.results).toEqual([
    { direction: "right", pointerType: "touch", distance: 100 },
    { direction: "left", pointerType: "pen", distance: 100 },
  ]);
  expect(outcomes.beforeDisable).toBe(2);
  expect(outcomes.enabled).toBe(false);
  expect(outcomes.notPrevented).toBe(true);
});

test("search panel is keyboard-usable and dispatches local results only through the host", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const panel = page.getByRole("region", { name: "Search" });
  await expect(panel).toBeVisible();
  const input = page.getByRole("searchbox", {
    name: "Search toolbar actions and content",
  });
  await input.fill("projects");
  await page.keyboard.press("Enter");
  await expect(panel).toContainText("Projects");

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await panel.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator("#action-result")).toHaveText("projects");
  await expect(panel).toBeHidden();
});

test("AI panel waits for a user prompt and renders plain-text provider output", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.toolbar.dispose();
    window.mountAIToolbar();
  });
  const toolbar = page.getByRole("toolbar", { name: "AI test toolbar" });
  const button = page.getByRole("button", { name: "Ask AI" });
  await expect(button).toBeVisible();
  await expect(page.locator(".mzk-toolbar__ai-panel")).toBeHidden();
  expect(await page.evaluate(() => window.aiRequests)).toEqual([]);

  await button.click();
  const panel = page.getByRole("region", { name: "AI assistant" });
  await expect(panel).toBeVisible();
  const prompt = page.getByRole("textbox", { name: "Prompt" });
  await prompt.fill("Summarize this note");
  expect(await page.evaluate(() => window.aiRequests)).toEqual([]);
  await page.getByRole("button", { name: "Generate response" }).click();
  await expect(panel).toContainText("<img src=x onerror=alert(1)> AI response");
  await expect(panel.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.aiRequests)).toEqual([
    "Summarize this note",
  ]);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.locator(".mzk-toolbar__ai-panel textarea")).toHaveValue("");
  await expect(toolbar).toHaveAttribute("data-collapsed", "false");
});

test("dispose removes the mounted interface", async ({ page }) => {
  await page.evaluate(() => window.toolbar.dispose());
  await expect(page.getByRole("toolbar")).toHaveCount(0);
});
