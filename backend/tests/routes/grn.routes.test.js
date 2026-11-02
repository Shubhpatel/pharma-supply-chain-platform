const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const grnRoutes = require("../../src/routes/grn.routes");
const Grn = require("../../src/models/Grn");
const PurchaseOrder = require("../../src/models/PurchaseOrder");
const SkuLocation = require("../../src/models/SkuLocation");
const { nextNumber } = require("../../src/utils/idGenerator");
const errorHandler = require("../../src/middleware/errorHandler");

process.env.JWT_SECRET = "testsecretKey123";

const app = express();
app.use(express.json());
app.use("/api/grn", grnRoutes);
app.use(errorHandler);

// Mock models and utils
jest.mock("../../src/models/Grn");
jest.mock("../../src/models/PurchaseOrder");
jest.mock("../../src/models/SkuLocation");
jest.mock("../../src/utils/idGenerator");

describe("GRN Routes Error Handling", () => {
  let token;
  let consoleErrorSpy;

  beforeAll(() => {
    token = jwt.sign(
      { id: "user123", role: "ADMIN", permissions: ["grn"] },
      process.env.JWT_SECRET
    );
    // Suppress console.error during tests to avoid cluttering test output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/grn", () => {
    it("should handle internal server errors correctly in POST /api/grn via errorHandler", async () => {
      PurchaseOrder.findById.mockResolvedValue({
        _id: "po123",
        status: "placed",
        items: [{ sku: "sku1", qty: 10, gstRate: 5 }],
        supplier: "sup1",
        poNumber: "PO001",
        supplierName: "Supplier One"
      });
      Grn.find.mockResolvedValue([]);
      SkuLocation.find.mockResolvedValue({ select: jest.fn().mockResolvedValue([]) });
      nextNumber.mockResolvedValue("GRN001");

      Grn.create.mockRejectedValue(new Error("Database error POST"));

      const payload = {
        purchaseOrderId: "po123",
        grnDate: "2023-10-27",
        purchaseInvoiceNumber: "INV-001",
        purchaseInvoiceDate: "2023-10-26",
        items: [{ sku: "sku1", skuName: "SKU One", qtyReceived: 5, rate: 100, gstRate: 5 }]
      };

      const res = await request(app)
        .post("/api/grn")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
      expect(console.error).toHaveBeenCalledWith("Unhandled Error:", expect.any(Error));
    });
  });

  describe("PUT /api/grn/:id", () => {
    it("should handle internal server errors correctly in PUT /api/grn/:id via errorHandler", async () => {
      Grn.findById.mockRejectedValue(new Error("Database error PUT"));

      const payload = {
        grnDate: "2023-10-28",
        purchaseInvoiceNumber: "INV-002",
        purchaseInvoiceDate: "2023-10-27",
        items: [{ sku: "sku1", skuName: "SKU One", qtyReceived: 5, rate: 100, gstRate: 5 }]
      };

      const res = await request(app)
        .put("/api/grn/grn123")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
      expect(console.error).toHaveBeenCalledWith("Unhandled Error:", expect.any(Error));
    });
  });

  describe("DELETE /api/grn/:id", () => {
    it("should handle internal server errors correctly in DELETE /api/grn/:id via errorHandler", async () => {
      Grn.findById.mockRejectedValue(new Error("Database error DELETE"));

      const res = await request(app)
        .delete("/api/grn/grn123")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
      expect(console.error).toHaveBeenCalledWith("Unhandled Error:", expect.any(Error));
    });
  });

  describe("PATCH /api/grn/:id/confirm", () => {
    it("should handle internal server errors correctly in PATCH /api/grn/:id/confirm via errorHandler", async () => {
      Grn.findById.mockRejectedValue(new Error("Database error PATCH confirm"));

      const res = await request(app)
        .patch("/api/grn/grn123/confirm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
      expect(console.error).toHaveBeenCalledWith("Unhandled Error:", expect.any(Error));
    });
  });

  describe("GET /api/grn", () => {
    it("should handle internal server errors correctly in GET /api/grn via errorHandler", async () => {
      Grn.find.mockImplementation(() => {
        throw new Error("Database error GET list");
      });

      const res = await request(app)
        .get("/api/grn")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
      expect(console.error).toHaveBeenCalledWith("Unhandled Error:", expect.any(Error));
    });
  });

  describe("GET /api/grn/:id", () => {
    it("should handle internal server errors correctly in GET /api/grn/:id via errorHandler", async () => {
      Grn.findById.mockImplementation(() => {
        throw new Error("Database error GET details");
      });

      const res = await request(app)
        .get("/api/grn/grn123")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
      expect(console.error).toHaveBeenCalledWith("Unhandled Error:", expect.any(Error));
    });
  });
});
