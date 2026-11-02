const express = require("express");
const request = require("supertest");

jest.mock("./src/middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: "user123", role: "ADMIN" };
    next();
  },
  requirePermission: () => (req, res, next) => next(),
}));

jest.mock("./src/models/DebitNote", () => ({
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock("./src/models/Grn", () => ({
  findById: jest.fn(),
}));

jest.mock("./src/models/Stock", () => ({
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("./src/utils/idGenerator", () => ({
  nextNumber: jest.fn(),
}));

const debitNoteRoutes = require("./src/routes/debitNote.routes");
const Grn = require("./src/models/Grn");

const app = express();
app.use(express.json());
app.use("/api/debit-notes", debitNoteRoutes);
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Internal server error" });
});

describe("Debit Note Routes - Error Path Test", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/debit-notes should pass error to next(err) resulting in 500 when database operation fails", async () => {
    Grn.findById.mockRejectedValue(new Error("Database failure"));

    const payload = {
      grnId: "mockGrnId",
      returnDate: "2023-10-01",
      reason: "Defective items",
      items: [{ sku: "SKU1", batch: "B1", qty: 5 }],
    };

    const res = await request(app)
      .post("/api/debit-notes")
      .send(payload)
      .expect(500);

    expect(res.body.error).toBe("Internal server error");
  });
});
