import { expect, test } from "@playwright/test";

test("dispatches only an authorized shortcut in its active scope and cleans up", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => window.mountShortcutManager());
  const home = page.getByRole("button", { name: "Home" });
  await home.focus();

  await page.evaluate(() => window.setShortcutScope("app:view"));
  await page.keyboard.press("Control+k");
  await expect(page.locator("#action-result")).toHaveText("");

  await page.evaluate(() => window.setShortcutScope("app:editor"));
  await page.keyboard.press("Control+k");
  await expect(page.locator("#action-result")).toHaveText("shortcut");

  await page.evaluate(() => {
    window.shortcutManager.dispose();
    document.querySelector("#action-result").textContent = "";
  });
  await page.keyboard.press("Control+k");
  await expect(page.locator("#action-result")).toHaveText("");
});
