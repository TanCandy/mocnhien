import { test, expect } from "@playwright/test";

test.describe("Mộc Nhiên Authentic — Deep Interactive & Bug Remediation E2E Suite", () => {
  const ADMIN = { email: "admin-e2e@test.local", password: "E2e-Pass-123" };
  const CUSTOMER = { email: "khach-a@test.local", password: "E2e-Pass-123" };

  test.describe("1. Tracking Page Direct Code Traversal & Auth Boundaries", () => {
    test("Unauthenticated visitor on /tracking sees friendly prompt when tracking directly", async ({ page }) => {
      await page.goto("/tracking");
      await page.waitForLoadState("domcontentloaded");

      const trackInput = page.getByPlaceholder(/Enter order code/i);
      await expect(trackInput).toBeVisible();
      await trackInput.fill("ORD-20261001-A001");

      const trackBtn = page.getByRole("button", { name: "Track", exact: true });
      await trackBtn.click();

      // Should show prompt to log in instead of broken/silent error
      await expect(page.getByText(/Please log in to track your order/i)).toBeVisible();
    });

    test("Authenticated customer can track directly by typing orderCode without selecting suggestion", async ({ page }) => {
      // 1. Login
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await page.fill('input[placeholder="Email"]', CUSTOMER.email);
      await page.fill('input[placeholder="Password"]', CUSTOMER.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/profile/);

      // 2. Go to Tracking page
      await page.goto("/tracking");
      await page.waitForLoadState("domcontentloaded");

      const trackInput = page.getByPlaceholder(/Enter order code/i);
      await trackInput.fill("ORD-20261001-A001");

      // 3. Click Track directly
      const trackBtn = page.getByRole("button", { name: "Track", exact: true });
      await trackBtn.click();

      // 4. Order journey loads
      await expect(page.getByText("ORD-20261001-A001")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Current Status")).toBeVisible();
    });
  });

  test.describe("2. Interactive Calculator Smooth Typing & Tiers", () => {
    test("Weight numeric input allows fluid typing, backspacing and category toggling", async ({ page }) => {
      await page.goto("/calculator");
      await page.waitForLoadState("domcontentloaded");

      const numInput = page.locator('input[type="number"]');
      await expect(numInput).toBeVisible();

      // Clear and type 4.2
      await numInput.fill("4.2");
      await expect(page.getByText("4.2 kg").first()).toBeVisible();

      // Toggle category to Cosmetics
      const cosmeticBtn = page.getByRole("button", { name: /Mỹ phẩm/i });
      if (await cosmeticBtn.isVisible()) {
        await cosmeticBtn.click();
      }

      // Toggle to Express
      const expressBtn = page.getByRole("button", { name: /Hỏa tốc/i });
      await expressBtn.click();

      // Calculations remain robust
      await expect(page.getByText(/Tổng cước dự tính/i)).toBeVisible();
    });
  });

  test.describe("3. Modal Keyboard Accessibility & Escape Key Dismissal", () => {
    test("Create Order modal on Dashboard can be dismissed with Escape key", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[placeholder="Email"]', CUSTOMER.email);
      await page.fill('input[placeholder="Password"]', CUSTOMER.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/profile/);

      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Open Modal
      await page.getByRole("button", { name: "Create New Order" }).first().click();
      await expect(page.getByText("Fill in the details below")).toBeVisible();

      // Press Escape
      await page.keyboard.press("Escape");

      // Modal is dismissed
      await expect(page.getByText("Fill in the details below")).not.toBeVisible();
    });
  });

  test.describe("4. Registration & Profile Realtime Sync", () => {
    test("Updating profile persists and displays success toast", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[placeholder="Email"]', CUSTOMER.email);
      await page.fill('input[placeholder="Password"]', CUSTOMER.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/profile/);

      // Verify profile loaded
      await expect(page.getByText(/Heritage Collector/i)).toBeVisible();

      // Click Edit Profile if available
      const editBtn = page.getByRole("button", { name: /Edit/i });
      if (await editBtn.isVisible()) {
        await editBtn.click();
        const addressInput = page.locator('input[value*="Warehouse"], input[placeholder*="Address"]').first();
        if (await addressInput.isVisible()) {
          await addressInput.fill("123 Test Updated Blvd, District 1");
          await page.getByRole("button", { name: /Save/i }).click();
          await expect(page.getByText(/Profile Updated/i)).toBeVisible();
        }
      }
    });
  });

  test.describe("5. Admin Self-Protection & OrderDetail VietQR Experience", () => {
    test("Admin dashboard protects against self-deletion and self-demotion", async ({ page, context }) => {
      await context.clearCookies();
      await page.goto("/login");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.fill('input[placeholder="Email"]', ADMIN.email);
      await page.fill('input[placeholder="Password"]', ADMIN.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/admin/);

      // Navigate to /admin (User Management)
      await page.goto("/admin");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();

      // Find row for current admin
      const adminRow = page.locator(`tr:has-text("${ADMIN.email}")`);
      await expect(adminRow).toBeVisible();

      // Verify that Toggle Role and Delete buttons for self are disabled
      const toggleBtn = adminRow.getByRole("button", { name: "Toggle Role" });
      const deleteBtn = adminRow.getByRole("button", { name: "Delete" });
      await expect(toggleBtn).toBeDisabled();
      await expect(deleteBtn).toBeDisabled();
    });

    test("OrderDetail page allows viewing VietQR payment option", async ({ page, context }) => {
      await context.clearCookies();
      await page.goto("/login");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.fill('input[placeholder="Email"]', CUSTOMER.email);
      await page.fill('input[placeholder="Password"]', CUSTOMER.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/profile/);

      // View seeded order detail
      await page.goto("/order-detail/ORD-20261001-A001");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("heading", { name: "ORD-20261001-A001" })).toBeVisible();

      // Check if VietQR payment button is visible or toggleable
      const vietQrBtn = page.getByRole("button", { name: /VietQR/i });
      if (await vietQrBtn.isVisible()) {
        await vietQrBtn.click();
        // PaymentQR container or VietQR instructions should appear
        await expect(page.getByText(/sao chép/i).or(page.getByText(/thanh toán/i)).first()).toBeVisible();
      }
    });
  });
});
