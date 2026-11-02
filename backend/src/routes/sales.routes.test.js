const express = require("express");
const request = require("supertest");

// Mock dependencies
jest.mock("../middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: "testuser", role: "ADMIN", permissions: ["invoice"] };
    next();
  },
  requirePermission: () => (req, res, next) => next(),
}));

const Party = require("../models/Party");
jest.mock("../models/Party", () => ({
  findOne: jest.fn(),
}));

const SaleInvoice = require("../models/SaleInvoice");
jest.mock("../models/SaleInvoice", () => ({
  create: jest.fn(),
}));

// We also need to mock Stock and CreditNote to avoid issues during require
jest.mock("../models/Stock", () => ({}));
jest.mock("../models/CreditNote", () => ({}));

jest.mock("../utils/idGenerator", () => ({
  nextNumber: jest.fn().mockResolvedValue("INV-001"),
}));

jest.mock("../utils/pagination", () => ({
  getPagination: jest.fn(),
  paginationMeta: jest.fn(),
}));

const salesRoutes = require("./sales.routes");
const errorHandler = require("../middleware/errorHandler");

const app = express();
app.use(express.json());
app.use("/api/sales", salesRoutes);
app.use(errorHandler);

describe("Sales Routes - Error Handling", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/sales should handle errors and return 500", async () => {
    // Arrange
    Party.findOne.mockResolvedValue({ _id: "cust1", name: "Test Customer" });
    SaleInvoice.create.mockRejectedValue(new Error("Database error"));

    const payload = {
      customerId: "cust1",
      saleDate: "2023-10-27",
      items: [
        {
          sku: "sku1",
          skuName: "Item 1",
          qty: 2,
          rate: 100,
          mrp: 120,
          gstRate: 18,
          batch: "B001",
          expiryDate: "2025-10-27"
        }
      ]
    };

    // Act
    const response = await request(app)
      .post("/api/sales")
      .send(payload);

    // Assert
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Internal Server Error" });
    expect(Party.findOne).toHaveBeenCalled();
    expect(SaleInvoice.create).toHaveBeenCalled();
  });
});
