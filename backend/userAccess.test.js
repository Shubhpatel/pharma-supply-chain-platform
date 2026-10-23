const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "testsecretKey123";

// Mock User model
jest.mock("./src/models/User", () => {
  const ALL_PERMISSIONS = ["po", "grn", "pr", "invoice", "sr", "inventory", "masters", "reports", "users"];
  const ROLE_PERMISSIONS = {
    PURCHASE: ["po"],
    GRN: ["grn", "pr"],
    SALES: ["invoice", "sr"],
    ADMIN: ALL_PERMISSIONS,
  };
  function getDefaultPermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
  }

  const mockUserStore = [
    {
      _id: "admin1",
      name: "Admin User",
      email: "admin@test.com",
      passwordHash: "hashed",
      role: "ADMIN",
      permissions: ALL_PERMISSIONS,
      save: jest.fn().mockResolvedValue(true),
    },
    {
      _id: "purch1",
      name: "Purchase User",
      email: "purch@test.com",
      passwordHash: "hashed",
      role: "PURCHASE",
      permissions: ["po"],
      save: jest.fn().mockResolvedValue(true),
    },
  ];

  return {
    ALL_PERMISSIONS,
    ROLE_PERMISSIONS,
    getDefaultPermissions,
    findOne: jest.fn().mockImplementation(({ email }) => {
      const u = mockUserStore.find((item) => item.email === email);
      return Promise.resolve(u || null);
    }),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockUserStore.map(({ passwordHash, ...rest }) => rest)),
      }),
    }),
    findById: jest.fn().mockImplementation((id) => {
      const u = mockUserStore.find((item) => item._id === id);
      return Promise.resolve(u || null);
    }),
    create: jest.fn().mockImplementation((data) =>
      Promise.resolve({
        _id: "newuser123",
        ...data,
        save: jest.fn().mockResolvedValue(true),
      })
    ),
    findByIdAndDelete: jest.fn().mockImplementation((id) => {
      const idx = mockUserStore.findIndex((item) => item._id === id);
      if (idx !== -1) return Promise.resolve(mockUserStore[idx]);
      return Promise.resolve(null);
    }),
  };
});

// Mock dependencies for routes
jest.mock("./src/models/PurchaseOrder", () => ({
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    }),
  }),
}));
jest.mock("./src/models/Grn", () => ({
  aggregate: jest.fn().mockResolvedValue([]),
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    }),
  }),
}));

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const purchaseOrderRoutes = require("./src/routes/purchaseOrder.routes");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);

describe("User Role & Access Control Unit Tests", () => {
  let adminToken;
  let purchaseToken;

  beforeAll(() => {
    adminToken = jwt.sign(
      { id: "admin1", name: "Admin User", role: "ADMIN", permissions: ["po", "grn", "pr", "invoice", "sr", "inventory", "masters", "reports", "users"] },
      process.env.JWT_SECRET
    );
    purchaseToken = jwt.sign(
      { id: "purch1", name: "Purchase User", role: "PURCHASE", permissions: ["po"] },
      process.env.JWT_SECRET
    );
  });

  test("Registration endpoint should no longer exist (404 on POST /api/auth/register)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "New User", email: "new@test.com", password: "password" })
      .expect(404);
  });

  test("PURCHASE role should be allowed to access PO endpoints", async () => {
    await request(app)
      .get("/api/purchase-orders")
      .set("Authorization", `Bearer ${purchaseToken}`)
      .expect(200);
  });

  test("PURCHASE role should be DENIED access to Admin User Management", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${purchaseToken}`)
      .expect(403);

    expect(res.body.error).toContain("Access denied");
  });

  test("ADMIN role should be ALLOWED to list users", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.users).toBeDefined();
  });

  test("ADMIN should be able to create a new user with specific role & permissions", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Sales Agent",
        email: "salesagent@test.com",
        password: "password123",
        role: "SALES",
      })
      .expect(201);

    expect(res.body.user.role).toBe("SALES");
    expect(res.body.user.permissions).toEqual(["invoice", "sr"]);
  });
});
