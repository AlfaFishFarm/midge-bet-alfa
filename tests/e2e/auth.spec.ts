import { test, expect } from "@playwright/test";

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("wrong password shows an error and does not log in", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("wrong-password");
  await page.getByRole("button", { name: "התחבר" }).click();
  await expect(page.getByText("שם משתמש או סיסמה שגויים")).toBeVisible();
});

test("seeded admin can log in and reach the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "התחבר" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByText(/^שלום/)).toBeVisible();
});
