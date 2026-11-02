const express = require("express");
const request = require("supertest");

jest.mock("./src/middleware/auth", () => {
  return {
    requireAuth: (req, res, next) => {
      req.user = { id: "admin1", role: "ADMIN", permissions: ["po"] };
      next();
    },
    requirePermission: () => (req, res, next) => next(),
  };
});

jest.mock("./src/models/PurchaseOrder");
jest.mock("./src/models/Party");
jest.mock("./src/utils/idGenerator");

const PurchaseOrder = require("./src/models/PurchaseOrder");
const Party = require("./src/models/Party");
const { nextNumber } = require("./src/utils/idGenerator");

const purchaseOrderRoutes = require("./src/routes/purchaseOrder.routes");

const app = express();
app.use(express.json());
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Internal server error" });
});

describe("Purchase Order Routes - Error Path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/purchase-orders handles database errors", async () => {
    Party.findOne.mockResolvedValue({ _id: "supplier1", name: "Supplier 1", partyType: "vendor" });
    nextNumber.mockResolvedValue("PO-001");

    PurchaseOrder.create.mockRejectedValue(new Error("DB Error"));

    const res = await request(app)
      .post("/api/purchase-orders")
      .send({
        supplierId: "supplier1",
        orderDate: "2023-10-01",
        items: [{ qty: 10, rate: 5, gstRate: 10 }]
      });

    expect(PurchaseOrder.create).toHaveBeenCalled();
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });
});
