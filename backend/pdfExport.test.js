const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-key-pdf";

jest.mock("./src/models/PurchaseOrder");
jest.mock("./src/models/Grn");
jest.mock("./src/models/DebitNote");
jest.mock("./src/models/CreditNote");
jest.mock("./src/models/SaleInvoice");

const PurchaseOrder = require("./src/models/PurchaseOrder");
const Grn = require("./src/models/Grn");
const DebitNote = require("./src/models/DebitNote");
const CreditNote = require("./src/models/CreditNote");
const SaleInvoice = require("./src/models/SaleInvoice");

const poRoutes = require("./src/routes/purchaseOrder.routes");
const grnRoutes = require("./src/routes/grn.routes");
const debitNoteRoutes = require("./src/routes/debitNote.routes");
const creditNoteRoutes = require("./src/routes/creditNote.routes");
const salesRoutes = require("./src/routes/sales.routes");

const app = express();
app.use(express.json());
app.use("/api/purchase-orders", poRoutes);
app.use("/api/grn", grnRoutes);
app.use("/api/debit-notes", debitNoteRoutes);
app.use("/api/credit-notes", creditNoteRoutes);
app.use("/api/sales", salesRoutes);

const token = jwt.sign(
  { id: "user123", email: "test@example.com", role: "ADMIN", permissions: ["po", "grn", "pr", "sr", "invoice"] },
  process.env.JWT_SECRET
);

describe("PDF Generation Endpoints Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockDoc = (data) => ({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(data),
    });

    PurchaseOrder.findById.mockReturnValue(
      mockDoc({
        poNumber: "PO-000001",
        supplierName: "Apex Pharma",
        orderDate: new Date(),
        items: [{ skuName: "Paracetamol", qty: 100, rate: 10, gstRate: 5, amount: 1000 }],
        totalQty: 100,
        totalPrice: 1000,
        gstAmount: 50,
        grandTotal: 1050,
      })
    );

    Grn.findById.mockReturnValue(
      mockDoc({
        grnNumber: "GRN-000001",
        poNumber: "PO-000001",
        supplierName: "Apex Pharma",
        grnDate: new Date(),
        items: [{ skuName: "Paracetamol", qtyReceived: 100, rate: 10, gstRate: 5, amount: 1000 }],
        totalQty: 100,
        totalValue: 1000,
        gstAmount: 50,
        grandTotal: 1050,
      })
    );

    DebitNote.findById.mockReturnValue(
      mockDoc({
        debitNoteNumber: "DN-000001",
        grnNumber: "GRN-000001",
        supplierName: "Apex Pharma",
        returnDate: new Date(),
        items: [{ skuName: "Paracetamol", qty: 10, rate: 10, gstRate: 5, amount: 100 }],
        totalQty: 10,
        totalAmount: 100,
        gstAmount: 5,
        grandTotal: 105,
      })
    );

    CreditNote.findById.mockReturnValue(
      mockDoc({
        creditNoteNumber: "CN-000001",
        invoiceNumber: "INV-000001",
        customerName: "City Hospital",
        returnDate: new Date(),
        items: [{ skuName: "Paracetamol", qty: 5, rate: 15, gstRate: 5, amount: 75 }],
        totalQty: 5,
        totalAmount: 75,
        gstAmount: 3.75,
        grandTotal: 78.75,
      })
    );

    SaleInvoice.findById.mockReturnValue(
      mockDoc({
        invoiceNumber: "INV-000001",
        customerName: "City Hospital",
        saleDate: new Date(),
        items: [{ skuName: "Paracetamol", qty: 20, rate: 15, gstRate: 5, amount: 300 }],
        totalQty: 20,
        totalAmount: 300,
        gstAmount: 15,
        grandTotal: 315,
      })
    );
  });

  test("GET /api/purchase-orders/:id/pdf returns PDF buffer", async () => {
    const res = await request(app)
      .get("/api/purchase-orders/po123/pdf")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("PO-000001.pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
  });

  test("GET /api/grn/:id/pdf returns PDF buffer", async () => {
    const res = await request(app)
      .get("/api/grn/grn123/pdf")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("GRN-000001.pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
  });

  test("GET /api/debit-notes/:id/pdf returns PDF buffer", async () => {
    const res = await request(app)
      .get("/api/debit-notes/dn123/pdf")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("DN-000001.pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
  });

  test("GET /api/credit-notes/:id/pdf returns PDF buffer", async () => {
    const res = await request(app)
      .get("/api/credit-notes/cn123/pdf")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("CN-000001.pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
  });

  test("GET /api/sales/:id/pdf returns PDF buffer", async () => {
    const res = await request(app)
      .get("/api/sales/inv123/pdf")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("INV-000001.pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
  });
});
