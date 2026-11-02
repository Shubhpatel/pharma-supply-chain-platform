const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-key-123";

// Mock models and utils
jest.mock("../models/CreditNote");
jest.mock("../models/SaleInvoice");
jest.mock("../models/Stock");
jest.mock("../utils/idGenerator");

const CreditNote = require("../models/CreditNote");
const SaleInvoice = require("../models/SaleInvoice");
const Stock = require("../models/Stock");
const { nextNumber } = require("../utils/idGenerator");

const creditNoteRoutes = require("./creditNote.routes");

const app = express();
app.use(express.json());
app.use("/api/credit-notes", creditNoteRoutes);

// Error handling middleware to catch next(err) and respond with 500
app.use((err, req, res, next) => {
  res.status(501).json({ error: "Internal server error handler", message: err.message });
});

const JWT_SECRET = process.env.JWT_SECRET;
const dummyUserId = "60d5ecb8b5c9c22b8c8b4567";
const token = jwt.sign({ id: dummyUserId, email: "test@example.com", role: "ADMIN", permissions: ["sr"] }, JWT_SECRET);

describe("Credit Note Routes Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/credit-notes error path", () => {
    test("should handle internal errors gracefully", async () => {
      // Force SaleInvoice.findById to throw an error to simulate a database failure
      SaleInvoice.findById.mockRejectedValue(new Error("Database connection failed"));

      const res = await request(app)
        .post("/api/credit-notes")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoiceId: "dummyInvoiceId123",
          returnDate: "2023-10-10",
          reason: "Defective items",
          items: [{ sku: "sku1", batch: "b1", qty: 2 }],
        });

      // Assert that the error was caught and passed to the error handler
      expect(res.status).toBe(501);
      expect(res.body.error).toBe("Internal server error handler");
      expect(res.body.message).toBe("Database connection failed");
    });
  });
});
