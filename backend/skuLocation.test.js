const request = require("supertest");
const express = require("express");

const SkuLocation = require("./src/models/SkuLocation");
const Sku = require("./src/models/Sku");

// Mock the models
jest.mock("./src/models/SkuLocation");
jest.mock("./src/models/Sku");
jest.mock("./src/middleware/auth", () => ({
  requireAuth: (req, res, next) => next(),
}));

const skuLocationRoutes = require("./src/routes/skuLocation.routes");

const app = express();
app.use(express.json());
app.use("/api/sku-locations", skuLocationRoutes);

// Error handler middleware to catch next(err)
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Internal server error" });
});

describe("SKU Location Routes Error Paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/sku-locations", () => {
    it("should handle internal server error on GET /", async () => {
      // Setup mock to throw error on .lean()
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error("Database error")),
      };

      SkuLocation.find.mockReturnValue(mockChain);

      const response = await request(app).get("/api/sku-locations");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Internal server error" });
    });
  });
});
