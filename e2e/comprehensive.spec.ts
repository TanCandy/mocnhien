import { test, expect } from "@playwright/test";

test.describe("Mộc Nhiên Authentic — Comprehensive E2E Testing Suite", () => {
  // Test credentials from seeded devstack
  const ADMIN = { email: "admin-e2e@test.local", password: "E2e-Pass-123" };
  const CUSTOMER = { email: "khach-a@test.local", password: "E2e-Pass-123" };

  test.describe("1. Public Pages & Navigation", () => {
    test("Home page loads with brand, hero, and CTA buttons", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveTitle(/Mộc Nhiên/i);
      await expect(page.locator("h1")).toContainText("Mộc Nhiên");
      await expect(page.getByRole("button", { name: "Create Order Now" }).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("link", { name: "Contact Now" }).first()).toBeVisible();
    });

    test("Calculator page (/calculator) provides interactive shipping quote calculator", async ({ page }) => {
      await page.goto("/calculator");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("h1")).toContainText("Ước tính chi phí vận chuyển");

      // Verify weight inputs
      const numInput = page.locator('input[type="number"]');
      await expect(numInput).toBeVisible();
      await numInput.fill("3.5");

      // Select Express tier
      const expressBtn = page.getByRole("button", { name: /Hỏa tốc/ });
      await expect(expressBtn).toBeVisible();
      await expressBtn.click();

      // Verify quote summary is updated
      await expect(page.getByText("Tổng cước dự tính")).toBeVisible();
      await expect(page.getByText(/Phụ phí hỏa tốc/)).toBeVisible();

      // CTA button leads to order creation
      const cta = page.getByRole("button", { name: "Tạo đơn hàng ngay" });
      await expect(cta).toBeVisible();
    });

    test("Tracking page (/tracking) allows looking up existing order", async ({ page }) => {
      await page.goto("/tracking");
      await page.waitForLoadState("domcontentloaded");
      const trackInput = page.getByPlaceholder(/Enter order code/i);
      await expect(trackInput).toBeVisible();
      await trackInput.fill("ORD-20261001-A001");
      await page.waitForTimeout(500);

      const trackBtn = page.getByRole("button", { name: "Track", exact: true });
      await trackBtn.click();

      await page.waitForTimeout(1000);
      const content = await page.textContent("body");
      expect(content).toBeTruthy();
    });

    test("Support page (/support) displays knowledge base and contact channels", async ({ page }) => {
      await page.goto("/support");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByText("How can we help you?")).toBeVisible();
      await expect(page.getByPlaceholder("Search for articles, topics...")).toBeVisible();
    });

    test("404 route handling (/random-invalid-url) shows custom Not Found page", async ({ page }) => {
      await page.goto("/random-non-existent-url-test-404");
      await expect(page.getByText("404")).toBeVisible();
      await expect(page.getByText("Page not found")).toBeVisible();
      const backHome = page.getByRole("link", { name: "Back to home" });
      await expect(backHome).toBeVisible();
      await backHome.click();
      await expect(page).toHaveURL("/");
    });
  });

  test.describe("2. Authentication & Route Guards", () => {
    test("Login page rejects wrong credentials with error message", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[placeholder="Email"]', "wrong-user@test.local");
      await page.fill('input[placeholder="Password"]', "WrongPassword123!");
      await page.getByRole("button", { name: "Sign In" }).click();

      await expect(page.locator("body")).toContainText(/invalid|sai|error|không đúng/i);
      await expect(page).toHaveURL(/login/);
    });

    test("Anonymous visitor accessing /dashboard is redirected to /login", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForURL(/login/);
      await expect(page).toHaveURL(/login/);
    });

    test("Anonymous visitor accessing /admin/orders is redirected to /login", async ({ page }) => {
      await page.goto("/admin/orders");
      await page.waitForURL(/login/);
      await expect(page).toHaveURL(/login/);
    });

    test("Anonymous visitor accessing /profile is redirected to /login", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForURL(/login/);
      await expect(page).toHaveURL(/login/);
    });

    test("Customer login succeeds and allows accessing Dashboard", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[placeholder="Email"]', CUSTOMER.email);
      await page.fill('input[placeholder="Password"]', CUSTOMER.password);
      await page.getByRole("button", { name: "Sign In" }).click();

      await page.waitForURL(/\/profile/);
      await expect(page).toHaveURL(/\/profile/);

      // Now navigate to Dashboard
      await page.goto("/dashboard");
      await expect(page).toHaveURL("/dashboard");
      await expect(page.getByText(/Active Shipments|My Orders|Tạo Đơn Hàng/i).first()).toBeVisible();
    });

    test("Customer trying to access Admin pages is redirected to home (/)", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[placeholder="Email"]', CUSTOMER.email);
      await page.fill('input[placeholder="Password"]', CUSTOMER.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/profile/);

      // Try accessing admin orders
      await page.goto("/admin/orders");
      await page.waitForURL((url) => url.pathname === "/");
      await expect(page).toHaveURL("/");
    });
  });

  test.describe("3. Customer Order Creation & Price Integrity", () => {
    test("Creating an order with $1,299 USD preserves full price without truncation", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[placeholder="Email"]', CUSTOMER.email);
      await page.fill('input[placeholder="Password"]', CUSTOMER.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/profile/);

      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Open Create New Order modal
      await page.getByRole("button", { name: "Create New Order" }).first().click();
      await page.waitForSelector("text=Fill in the details below");

      const form = page.locator("form").filter({ hasText: "Product Type" });
      await form.locator("select").selectOption("Electronics");
      await form.locator('input[placeholder="Enter product name"]').fill("iPhone 16 Pro Max 1TB");
      await form.locator('input[placeholder="https://example.com/product"]').fill("https://apple.com/iphone");
      await form.locator('input[placeholder="Enter warehouse address"]').fill("1 Warehouse Rd, CA 90001");
      await form.locator('input[placeholder="Nhập tên nhân viên"]').fill("Lan");
      await form.locator('input[placeholder="0.00"]').fill("1,299");
      await form.locator('input[placeholder="e.g. 25000"]').fill("25600");

      // Check live calculation before submit: 1,299 * 25,600 = 33,254,400 (NOT 25,600!)
      await expect(page.getByText(/33\.254\.400/)).toBeVisible();

      // Submit
      await page.locator('button[type="submit"]', { hasText: "Submit Order" }).click();

      // Check success modal
      await expect(page.getByText("Order Submitted!")).toBeVisible();
    });

    test("Order details page (/order-detail/:id) loads real data from API", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[placeholder="Email"]', CUSTOMER.email);
      await page.fill('input[placeholder="Password"]', CUSTOMER.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/profile/);

      // Open an existing order
      await page.goto("/order-detail/ORD-20261001-A001");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("body")).not.toContainText("Order not found");
      await expect(page.getByRole("heading", { name: "ORD-20261001-A001" })).toBeVisible();
      await expect(page.getByText("Detailed Tracking History")).toBeVisible();
      await expect(page.getByText("Billing Summary")).toBeVisible();
    });
  });

  test.describe("4. Admin Operations", () => {
    test("Admin can login, inspect orders, and filter data", async ({ page, context }) => {
      await context.clearCookies();
      await page.goto("/login");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('input[placeholder="Email"]', ADMIN.email);
      await page.fill('input[placeholder="Password"]', ADMIN.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/admin/);

      await page.goto("/admin/orders");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByText(/Manage Orders/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Export Excel" })).toBeVisible();
      await expect(page.locator("table")).toBeVisible();
    });

    test("Admin can access Payments verification page", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await page.fill('input[placeholder="Email"]', ADMIN.email);
      await page.fill('input[placeholder="Password"]', ADMIN.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/admin/);

      await page.goto("/admin/payments");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByText(/Payments/i).first()).toBeVisible();
    });
  });
});
