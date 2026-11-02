const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "testsecretKey123";

jest.mock("./src/models/Sku");
const Sku = require("./src/models/Sku");

const skuRoutes = require("./src/routes/sku.routes");
const errorHandler = require("./src/middleware/errorHandler");

const app = express();
app.use(express.json());
app.use("/", skuRoutes);
app.use(errorHandler);

const dummyUserId = "60d5ecb8b5c9c22b8c8b4567";
const token = jwt.sign({ id: dummyUserId, email: "test@example.com", role: "ADMIN", permissions: ["po", "invoice", "masters"] }, process.env.JWT_SECRET);

describe("SKU Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET / should return SKUs on happy path", async () => {
    const mockChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: "1", name: "Test SKU", uid: "123" }]),
    };
    Sku.find.mockReturnValue(mockChain);
    Sku.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get("/")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.skus).toHaveLength(1);
    expect(res.body.pagination).toBeDefined();
  });

  test("GET / should pass error to next() on database exception", async () => {
    Sku.find.mockImplementation(() => {
      throw new Error("Simulated database error");
    });

    const res = await request(app)
      .get("/")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal Server Error");
  });
});
