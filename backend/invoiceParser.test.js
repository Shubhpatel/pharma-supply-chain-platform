const express = require("express");
const request = require("supertest");

// Mock dependencies
jest.mock("./src/models/Party", () => ({
  find: jest.fn(),
}));

jest.mock("./src/models/PurchaseOrder", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("./src/models/Sku", () => ({
  find: jest.fn(),
}));

jest.mock("./src/models/Grn", () => {
  const mockGrn = jest.fn();
  mockGrn.findOne = jest.fn();
  mockGrn.find = jest.fn();
  mockGrn.findById = jest.fn();
  mockGrn.create = jest.fn();
  return mockGrn;
});

jest.mock("./src/models/Stock", () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
}));

jest.mock("./src/models/DebitNote", () => ({
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    }),
  }),
}));

jest.mock("./src/middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: "user123", name: "Test User" };
    next();
  },
}));

jest.mock("./src/utils/idGenerator", () => ({
  nextNumber: jest.fn().mockResolvedValue("GRN000100"),
}));

const Party = require("./src/models/Party");
const PurchaseOrder = require("./src/models/PurchaseOrder");
const Sku = require("./src/models/Sku");
const Grn = require("./src/models/Grn");
const Stock = require("./src/models/Stock");
const { matchEntities, parseInvoiceDocument } = require("./src/utils/aiInvoiceParser");
const grnRoutes = require("./src/routes/grn.routes");

const app = express();
app.use(express.json());
app.use("/api/grn", grnRoutes);

describe("AI Purchase Invoice to GRN Draft Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Unit tests: matchEntities", () => {
    test("Successful entity matching with exact GSTIN, PO number, and SKU code", async () => {
      Party.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: "party123", name: "Pharma Corp", gstin: "27AAAAA0000A1Z5", type: "supplier" },
        ]),
      });
      PurchaseOrder.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "po123", poNumber: "PO-2026-001" }),
      });
      Sku.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: "sku123", code: "SKU-PCM-500", name: "Paracetamol 500mg" },
        ]),
      });

      const rawExtracted = {
        vendor: { name: "Pharma Corp", gstNumber: "27AAAAA0000A1Z5", confidence: 0.95 },
        invoice: { number: "INV-1001", date: "2026-03-01", totalAmount: 500, confidence: 0.9 },
        purchaseOrder: { number: "PO-2026-001", confidence: 0.9 },
        items: [
          {
            description: "Paracetamol 500mg Tab",
            skuCode: "SKU-PCM-500",
            batchNumber: "B123",
            expiryDate: "2027-12-31",
            quantity: 100,
            freeQuantity: 10,
            unitPrice: 5,
            confidence: 0.95,
          },
        ],
        warnings: [],
        overallConfidence: 0.92,
      };

      const result = await matchEntities(rawExtracted);

      expect(result.vendor.matchedPartyId).toBe("party123");
      expect(result.purchaseOrder.matchedPurchaseOrderId).toBe("po123");
      expect(result.items[0].matchedSkuId).toBe("sku123");
      expect(result.items[0].batchNumber).toBe("B123");
      expect(result.items[0].expiryDate).toBe("2027-12-31");
      expect(result.items[0].quantity).toBe(100);
      expect(result.items[0].freeQuantity).toBe(10);
    });

    test("Missing vendor match adds explicit warning", async () => {
      Party.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      PurchaseOrder.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      Sku.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const rawExtracted = {
        vendor: { name: "Unknown Pharma Ltd", gstNumber: "99XXXXX0000X1Z1", confidence: 0.5 },
        invoice: { number: "INV-999", date: "2026-03-01", confidence: 0.8 },
        purchaseOrder: { number: "", confidence: 0 },
        items: [],
        warnings: [],
        overallConfidence: 0.5,
      };

      const result = await matchEntities(rawExtracted);

      expect(result.vendor.matchedPartyId).toBeNull();
      expect(result.warnings.some((w) => w.includes("could not be matched"))).toBe(true);
    });

    test("Missing SKU match adds warning and returns matchedSkuId as null", async () => {
      Party.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      PurchaseOrder.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      Sku.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const rawExtracted = {
        vendor: { name: "Supplier A" },
        invoice: { number: "INV-01", date: "2026-01-01" },
        purchaseOrder: { number: "" },
        items: [
          {
            description: "Unregistered Drug XYZ",
            skuCode: "SKU-UNKNOWN",
            batchNumber: "BATCH1",
            expiryDate: "2028-01-01",
            quantity: 50,
          },
        ],
      };

      const result = await matchEntities(rawExtracted);

      expect(result.items[0].matchedSkuId).toBeNull();
      expect(result.warnings.some((w) => w.includes("could not be matched to an existing SKU"))).toBe(true);
    });

    test("Missing batch number or expiry date triggers clear warnings", async () => {
      Party.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      PurchaseOrder.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      Sku.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const rawExtracted = {
        vendor: { name: "", gstNumber: "" },
        invoice: { number: "", date: null },
        purchaseOrder: { number: "" },
        items: [
          {
            description: "Aspirin",
            skuCode: "SKU-ASP",
            batchNumber: "",
            expiryDate: null,
            quantity: 20,
          },
        ],
      };

      const result = await matchEntities(rawExtracted);

      expect(result.warnings.some((w) => w.includes("Batch number missing"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("Expiry date missing or invalid"))).toBe(true);
    });
  });

  describe("API Endpoint tests: POST /api/grn/parse-invoice", () => {
    test("Invalid file type returns 400 error", async () => {
      const res = await request(app)
        .post("/api/grn/parse-invoice")
        .attach("file", Buffer.from("dummy text content"), "test.txt")
        .expect(400);

      expect(res.body.error).toContain("Invalid file type");
    });

    test("Empty file upload returns 400 error", async () => {
      const res = await request(app)
        .post("/api/grn/parse-invoice")
        .attach("file", Buffer.alloc(0), "empty.pdf")
        .expect(400);

      expect(res.body.error).toContain("No invoice file uploaded or file is empty");
    });

    test("Duplicate invoice detection adds warning flag", async () => {
      Party.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: "p1", name: "Supplier 1", gstin: "GST123" }]),
      });
      PurchaseOrder.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      Sku.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      // Mock Gemini API call
      const globalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      vendor: { name: "Supplier 1", gstNumber: "GST123" },
                      invoice: { number: "INV-DUP-1", date: "2026-02-01" },
                      purchaseOrder: { number: "" },
                      items: [],
                      warnings: [],
                      overallConfidence: 0.9,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      Grn.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "existingGrn1", grnNumber: "GRN000001" }),
      });

      process.env.GEMINI_API_KEY = "dummy_key";

      const res = await request(app)
        .post("/api/grn/parse-invoice")
        .attach("file", Buffer.from("%PDF-1.4 dummy pdf content"), "invoice.pdf")
        .expect(200);

      expect(res.body.isDuplicate).toBe(true);
      expect(res.body.warnings.some((w) => w.includes("already exists for Invoice Number"))).toBe(true);

      global.fetch = globalFetch;
    });

    test("Malformed AI response returns 500 error gracefully", async () => {
      const globalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          candidates: [{ content: { parts: [{ text: "Invalid JSON non-string response" }] } }],
        }),
      });

      process.env.GEMINI_API_KEY = "dummy_key";

      const res = await request(app)
        .post("/api/grn/parse-invoice")
        .attach("file", Buffer.from("%PDF-1.4 pdf content"), "test.pdf")
        .expect(500);

      expect(res.body.error).toContain("AI service returned invalid or malformed JSON");

      global.fetch = globalFetch;
    });
  });

  describe("Draft GRN saving vs Stock confirmation behavior", () => {
    test("Saving a parsed invoice as draft GRN does NOT update inventory stock", async () => {
      const mockPo = {
        _id: "po123",
        poNumber: "PO001",
        supplier: "sup123",
        supplierName: "Test Supplier",
        status: "placed",
        items: [{ sku: "sku123", qty: 10, rate: 100, gstRate: 12 }],
      };

      PurchaseOrder.findById.mockResolvedValue(mockPo);
      Grn.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });
      Grn.create.mockImplementation((data) => Promise.resolve({ _id: "grn123", ...data, status: "draft" }));

      const payload = {
        purchaseOrderId: "po123",
        grnDate: "2026-03-01",
        purchaseInvoiceNumber: "INV-DRAFT-123",
        purchaseInvoiceDate: "2026-03-01",
        items: [
          {
            sku: "sku123",
            skuName: "Paracetamol",
            qtyOrdered: 10,
            qtyReceived: 5,
            batch: "B001",
            expiryDate: "2027-12-31",
            mrp: 120,
            rate: 100,
            gstRate: 12,
          },
        ],
      };

      const res = await request(app)
        .post("/api/grn")
        .send(payload)
        .expect(201);

      expect(res.body.grn.status).toBe("draft");
      expect(Grn.create).toHaveBeenCalledTimes(1);
      // Verify stock model was never called
      expect(Stock.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("Only GRN confirmation updates inventory stock", async () => {
      const mockPo = {
        _id: "po123",
        poNumber: "PO001",
        supplier: "sup123",
        supplierName: "Test Supplier",
        status: "placed",
        items: [{ sku: "sku123", qty: 10, rate: 100, gstRate: 12 }],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockDraftGrn = {
        _id: "grn123",
        status: "draft",
        purchaseOrder: "po123",
        items: [
          {
            sku: "sku123",
            skuName: "Paracetamol",
            qtyReceived: 5,
            batch: "B001",
            expiryDate: "2027-12-31",
            mrp: 120,
            rate: 100,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Grn.findById.mockResolvedValue(mockDraftGrn);
      PurchaseOrder.findById.mockResolvedValue(mockPo);
      Grn.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .patch("/api/grn/grn123/confirm")
        .expect(200);

      expect(res.body.grn.status).toBe("confirmed");
      // Verify Stock was updated upon confirmation
      expect(Stock.findOneAndUpdate).toHaveBeenCalledWith(
        { sku: "sku123", batch: "B001", expiryDate: "2027-12-31", mrp: 120, rate: 100 },
        { $inc: { qty: 5 } },
        { upsert: true }
      );
    });
  });
});
