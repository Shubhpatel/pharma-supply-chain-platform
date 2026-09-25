const express = require("express");
const request = require("supertest");
const XLSX = require("xlsx");
const bulkUploadRoutes = require("./src/routes/bulkUpload.routes");

// Mock Sku, Party, BulkUpload models
jest.mock("./src/models/Sku", () => ({
  insertMany: jest.fn().mockResolvedValue([]),
}));
jest.mock("./src/models/Party", () => ({
  insertMany: jest.fn().mockResolvedValue([]),
}));
jest.mock("./src/models/BulkUpload", () => ({
  create: jest.fn().mockImplementation((data) => Promise.resolve({ _id: "bulk123", ...data })),
  find: jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { _id: "bulk123", fileName: "test.csv", masterType: "sku", status: "done", totalRecords: 2, createdAt: new Date() }
      ])
    })
  }),
  findById: jest.fn().mockImplementation((id) => Promise.resolve({
    _id: id,
    fileName: "test.csv",
    errorDetails: [
      { rowNumber: 2, data: { Name: "" }, errorList: ["Name is required"] }
    ]
  }))
}));
jest.mock("./src/middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = { _id: "user123", name: "Test User" };
    next();
  }
}));

const Sku = require("./src/models/Sku");
const Party = require("./src/models/Party");
const BulkUpload = require("./src/models/BulkUpload");

const app = express();
app.use(express.json());
app.use("/api/bulk-uploads", bulkUploadRoutes);

describe("Bulk Masters Upload Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/bulk-uploads/sample should return sample CSV", async () => {
    const res = await request(app)
      .get("/api/bulk-uploads/sample?masterType=sku&format=csv")
      .expect(200);

    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("Name,HSN Code");
  });

  test("GET /api/bulk-uploads/sample should return sample Excel", async () => {
    const res = await request(app)
      .get("/api/bulk-uploads/sample?masterType=vendor&format=excel")
      .expect(200);

    expect(res.headers["content-type"]).toContain("spreadsheetml");
  });

  test("POST /api/bulk-uploads should successfully import valid SKUs", async () => {
    const rows = [
      { "Name": "Paracetamol 500mg", "HSN Code": "3004", "MRP": 25 },
      { "Name": "Amoxicillin 250mg", "HSN Code": "3005", "MRP": 50 }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const res = await request(app)
      .post("/api/bulk-uploads")
      .field("masterType", "sku")
      .attach("file", buffer, "skus.xlsx")
      .expect(201);

    expect(res.body.message).toContain("Successfully imported 2 sku records");
    expect(Sku.insertMany).toHaveBeenCalledTimes(1);
    expect(BulkUpload.create).toHaveBeenCalledWith(expect.objectContaining({
      status: "done",
      totalRecords: 2,
      successRecords: 2,
    }));
  });

  test("POST /api/bulk-uploads should fail atomically if ANY row is invalid", async () => {
    const rows = [
      { "Name": "Valid Vendor", "Phone": "1234567890" },
      { "Name": "", "Phone": "9876543210" } // Invalid row (missing Name)
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "csv" });

    const res = await request(app)
      .post("/api/bulk-uploads")
      .field("masterType", "vendor")
      .attach("file", buffer, "vendors.csv")
      .expect(400);

    expect(res.body.error).toContain("Validation failed for 1 out of 2 rows");
    expect(Party.insertMany).not.toHaveBeenCalled();
    expect(BulkUpload.create).toHaveBeenCalledWith(expect.objectContaining({
      status: "error",
      totalRecords: 2,
      errorRecords: 1,
    }));
  });

  test("GET /api/bulk-uploads/:id/error-file should generate downloadable error file", async () => {
    const res = await request(app)
      .get("/api/bulk-uploads/bulk123/error-file?format=csv")
      .expect(200);

    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("Error Details");
    expect(res.text).toContain("Name is required");
  });

  test("GET /api/bulk-uploads should list history", async () => {
    const res = await request(app)
      .get("/api/bulk-uploads")
      .expect(200);

    expect(res.body.history.length).toBe(1);
  });
});
