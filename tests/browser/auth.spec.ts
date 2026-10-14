import { test, expect } from "@playwright/test";
test("sign-in errors preserve the restaurant selection", async ({ page }) => {
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      }),
    }),
  );
  await page.goto("/");
  await page
    .getByPlaceholder("An Italian trattoria, a modern bistro…")
    .fill("My restaurant");
  await page
    .locator("header")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill("test@example.invalid");
  await dialog.getByLabel("Password", { exact: true }).fill("incorrect");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Invalid login credentials",
  );
  await dialog.getByRole("button", { name: "Close sign in" }).click();
  await expect(
    page.getByPlaceholder("An Italian trattoria, a modern bistro…"),
  ).toHaveValue("My restaurant");
});
test("confirmation and recovery messages guide account setup", async ({
  page,
}) => {
  await page.route("**/auth/v1/signup**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "test@example.invalid",
          identities: [],
        },
        session: null,
      }),
    }),
  );
  await page.route("**/auth/v1/recover**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/workspace");
  await page
    .getByRole("button", { name: "Sign in or create an account" })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "New here? Create an account" }).click();
  await d.getByLabel("Email address").fill("test@example.invalid");
  await d.getByLabel("Password", { exact: true }).fill("test-password-long");
  await d.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("confirm your account");
  await d.getByRole("button", { name: "Forgot password?" }).click();
  await d.getByRole("button", { name: "Send reset link" }).click();
  await expect(d.getByRole("status")).toContainText("password reset link");
});
test("cross-origin writes are rejected", async ({ request }) => {
  const response = await request.post("/api/recommendations", {
    headers: { Origin: "https://unrelated.example" },
    data: {},
  });
  expect(response.status()).toBe(403);
});
