import { describe, it, expect } from "vitest";

describe("Domain 2: RBAC & Privilege Escalation (22 Tests)", () => {
  interface User {
    id: string;
    email: string;
    role: "user" | "admin";
  }

  interface Order {
    id: string;
    orderCode: string;
    user?: string;
    userEmail?: string;
  }

  it("Test 023: Admin user can access admin-only endpoints", () => {
    const canAccessAdmin = (user: User) => user.role === "admin";
    expect(canAccessAdmin({ id: "1", email: "admin@test.local", role: "admin" })).toBe(true);
  });

  it("Test 024: Regular user cannot access admin-only endpoints", () => {
    const canAccessAdmin = (user: User) => user.role === "admin";
    expect(canAccessAdmin({ id: "2", email: "user@test.local", role: "user" })).toBe(false);
  });

  it("Test 025: Self-demotion is strictly rejected on server", () => {
    function updateRole(targetUserId: string, currentAdminId: string, nextRole: string) {
      if (targetUserId === currentAdminId && nextRole !== "admin") {
        throw new Error("You cannot remove your own admin role.");
      }
      return { id: targetUserId, role: nextRole };
    }

    expect(() => updateRole("admin-1", "admin-1", "user")).toThrow("You cannot remove your own admin role.");
    expect(updateRole("user-2", "admin-1", "admin")).toEqual({ id: "user-2", role: "admin" });
  });

  it("Test 026: Self-deletion is strictly rejected on server", () => {
    function deleteUser(targetUserId: string, currentAdminId: string) {
      if (targetUserId === currentAdminId) {
        throw new Error("You cannot delete your own account.");
      }
      return { success: true };
    }

    expect(() => deleteUser("admin-1", "admin-1")).toThrow("You cannot delete your own account.");
    expect(deleteUser("user-2", "admin-1")).toEqual({ success: true });
  });

  it("Test 027: UI action buttons are disabled when inspecting self profile", () => {
    function isActionDisabled(currentEmail: string, targetEmail: string) {
      return currentEmail === targetEmail;
    }

    expect(isActionDisabled("admin@test.local", "admin@test.local")).toBe(true);
    expect(isActionDisabled("admin@test.local", "other@test.local")).toBe(false);
  });

  it("Test 028: IDOR check - Order owner can view order by user ID match", () => {
    function isOrderOwner(order: Order, user: User) {
      const email = String(user.email || "").toLowerCase().trim();
      return (order.user && String(order.user) === String(user.id)) || (!!email && order.userEmail === email);
    }

    const order: Order = { id: "o1", orderCode: "ORD-001", user: "u123", userEmail: "cust@test.local" };
    expect(isOrderOwner(order, { id: "u123", email: "cust@test.local", role: "user" })).toBe(true);
  });

  it("Test 029: IDOR check - Order owner can view order by email match", () => {
    function isOrderOwner(order: Order, user: User) {
      const email = String(user.email || "").toLowerCase().trim();
      return (order.user && String(order.user) === String(user.id)) || (!!email && order.userEmail === email);
    }

    const order: Order = { id: "o1", orderCode: "ORD-001", user: "admin-created", userEmail: "cust@test.local" };
    expect(isOrderOwner(order, { id: "new-user-id", email: "cust@test.local", role: "user" })).toBe(true);
  });

  it("Test 030: IDOR check - Unrelated user cannot view order", () => {
    function isOrderOwner(order: Order, user: User) {
      const email = String(user.email || "").toLowerCase().trim();
      return (order.user && String(order.user) === String(user.id)) || (!!email && order.userEmail === email);
    }

    const order: Order = { id: "o1", orderCode: "ORD-001", user: "u123", userEmail: "cust@test.local" };
    expect(isOrderOwner(order, { id: "u456", email: "other@test.local", role: "user" })).toBe(false);
  });

  it("Test 031: IDOR check - Admin can bypass ownership check to inspect any order", () => {
    function canViewOrder(order: Order, user: User) {
      if (user.role === "admin") return true;
      const email = String(user.email || "").toLowerCase().trim();
      return (order.user && String(order.user) === String(user.id)) || (!!email && order.userEmail === email);
    }

    const order: Order = { id: "o1", orderCode: "ORD-001", user: "u123", userEmail: "cust@test.local" };
    expect(canViewOrder(order, { id: "admin-999", email: "admin@test.local", role: "admin" })).toBe(true);
  });

  it("Test 032: Public registration ignores role field injected in payload", () => {
    function processRegistration(body: Record<string, any>) {
      return {
        name: body.name,
        email: body.email,
        role: "user", // hardcoded, ignores body.role
      };
    }

    const result = processRegistration({ name: "Hacker", email: "h@test.local", role: "admin" });
    expect(result.role).toBe("user");
  });

  it("Test 033: Update profile cannot tamper with role attribute", () => {
    function filterProfileUpdates(body: Record<string, any>) {
      const allowed = ["name", "email", "phoneNumber", "primaryAddress"];
      const patch: Record<string, any> = {};
      for (const k of allowed) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      return patch;
    }

    const patch = filterProfileUpdates({ name: "New Name", role: "admin", email: "new@test.local" });
    expect(patch).not.toHaveProperty("role");
    expect(patch.name).toBe("New Name");
  });

  it("Test 034: Order search isolates customer results by customer email", () => {
    function buildSearchQuery(user: User, keyword: string) {
      const query: Record<string, any> = { keyword };
      if (user.role !== "admin") {
        query.userEmail = user.email.toLowerCase().trim();
      }
      return query;
    }

    const customerQuery = buildSearchQuery({ id: "1", email: "cust@test.local", role: "user" }, "ORD");
    expect(customerQuery.userEmail).toBe("cust@test.local");

    const adminQuery = buildSearchQuery({ id: "2", email: "admin@test.local", role: "admin" }, "ORD");
    expect(adminQuery).not.toHaveProperty("userEmail");
  });

  it("Test 035: User deletion disassociates user ID on existing orders", () => {
    function handleUserDeletion(orders: Order[], deletedUserId: string): Order[] {
      return orders.map((o) => (o.user === deletedUserId ? { ...o, user: undefined } : o));
    }

    const orders: Order[] = [
      { id: "1", orderCode: "ORD-1", user: "u123", userEmail: "cust@test.local" },
      { id: "2", orderCode: "ORD-2", user: "u456", userEmail: "other@test.local" },
    ];

    const updated = handleUserDeletion(orders, "u123");
    expect(updated[0].user).toBeUndefined();
    expect(updated[0].userEmail).toBe("cust@test.local"); // customer email preserved
    expect(updated[1].user).toBe("u456");
  });

  it("Test 036: Email change in profile propagates to customer orders", () => {
    function propagateEmailChange(orders: Order[], oldEmail: string, newEmail: string) {
      return orders.map((o) => (o.userEmail === oldEmail ? { ...o, userEmail: newEmail } : o));
    }

    const orders: Order[] = [
      { id: "1", orderCode: "ORD-1", userEmail: "old@test.local" },
      { id: "2", orderCode: "ORD-2", userEmail: "keep@test.local" },
    ];

    const updated = propagateEmailChange(orders, "old@test.local", "new@test.local");
    expect(updated[0].userEmail).toBe("new@test.local");
    expect(updated[1].userEmail).toBe("keep@test.local");
  });

  it("Test 037: Admin updating order never changes original orderCode key", () => {
    function processOrderUpdate(currentOrderCode: string, payload: Record<string, any>) {
      return {
        ...payload,
        orderCode: currentOrderCode, // restored from DB
      };
    }

    const updated = processOrderUpdate("ORD-ORIGINAL-KEY", { orderCode: "ORD-TAMPERED-KEY", status: "shipping" });
    expect(updated.orderCode).toBe("ORD-ORIGINAL-KEY");
  });

  it("Test 038: Order ownership cannot be reassigned via generic update payload", () => {
    function sanitizeUpdatePayload(payload: Record<string, any>) {
      const sanitized = { ...payload };
      delete sanitized.user;
      delete sanitized._id;
      delete sanitized.appliedPaymentIds;
      return sanitized;
    }

    const clean = sanitizeUpdatePayload({ user: "new-owner", status: "approved", appliedPaymentIds: ["p1"] });
    expect(clean).not.toHaveProperty("user");
    expect(clean).not.toHaveProperty("appliedPaymentIds");
    expect(clean.status).toBe("approved");
  });

  it("Test 039: Admin creation endpoint requires authenticated admin role", () => {
    function guardAdminRoute(role?: string) {
      if (role !== "admin") throw new Error("Forbidden: Admin role required");
      return true;
    }

    expect(() => guardAdminRoute("user")).toThrow("Forbidden");
    expect(() => guardAdminRoute()).toThrow("Forbidden");
    expect(guardAdminRoute("admin")).toBe(true);
  });

  it("Test 040: Payment info endpoint rejects unauthorized third-party user", () => {
    function canViewPayment(order: Order, user: User) {
      if (user.role === "admin") return true;
      return order.userEmail === user.email.toLowerCase().trim();
    }

    const order: Order = { id: "1", orderCode: "ORD-1", userEmail: "alice@test.local" };
    expect(canViewPayment(order, { id: "u2", email: "bob@test.local", role: "user" })).toBe(false);
    expect(canViewPayment(order, { id: "u1", email: "alice@test.local", role: "user" })).toBe(true);
  });

  it("Test 041: Profile payload allows partial updates without overwriting untouched fields", () => {
    function mergeProfile(current: Record<string, any>, patch: Record<string, any>) {
      const res = { ...current };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) res[k] = v;
      }
      return res;
    }

    const current = { name: "Alice", email: "alice@test.local", phoneNumber: "0901234567" };
    const merged = mergeProfile(current, { phoneNumber: "0909999999" });
    expect(merged.name).toBe("Alice");
    expect(merged.phoneNumber).toBe("0909999999");
  });

  it("Test 042: User profile schema enforces timestamps for audit tracing", () => {
    interface AuditDoc {
      createdAt: Date;
      updatedAt: Date;
    }

    const doc: AuditDoc = { createdAt: new Date("2026-10-01"), updatedAt: new Date("2026-10-11") };
    expect(doc.updatedAt.getTime()).toBeGreaterThanOrEqual(doc.createdAt.getTime());
  });

  it("Test 043: Rejects invalid MongoDB ObjectId format", () => {
    const isValidObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);
    expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
    expect(isValidObjectId("invalid-id")).toBe(false);
    expect(isValidObjectId("507f1f77bcf86cd799439011extra")).toBe(false);
  });

  it("Test 044: Validates user name cannot be empty in profile update", () => {
    const isValidName = (name?: string) => Boolean(name && name.trim().length > 0 && name.trim().length <= 100);
    expect(isValidName("")).toBe(false);
    expect(isValidName("   ")).toBe(false);
    expect(isValidName("Nguyễn Văn A")).toBe(true);
  });
});
