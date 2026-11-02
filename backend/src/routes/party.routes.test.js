const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "testsecretKey123";

// Create express app and setup error handler
const app = express();
app.use(express.json());

// Mock User model to pass requireAuth/requirePermission
jest.mock("../models/User", () => ({
  findById: jest.fn().mockResolvedValue({
    _id: "admin1",
    role: "ADMIN",
    permissions: ["masters", "po", "grn", "invoice", "sr", "pr"],
  }),
}));

const partyRoutes = require("./party.routes");
app.use("/api/parties", partyRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Internal server error" });
});

// Mock Party model
const Party = require("../models/Party");
jest.mock("../models/Party", () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  updateOne: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn()
}));

describe("Party Routes", () => {
  let adminToken;

  beforeAll(() => {
    adminToken = jwt.sign(
      { id: "admin1", name: "Admin User", role: "ADMIN", permissions: ["masters", "po", "grn", "invoice", "sr", "pr"] },
      process.env.JWT_SECRET
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /", () => {
    test("should return 500 when database throws an error", async () => {
      // Setup mock to throw an error for countDocuments which is also called in the Promise.all
      // Also the chain needs to properly reflect what is in the code
      Party.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      Party.countDocuments.mockRejectedValue(new Error("Database connection failed"));

      const res = await request(app)
        .get("/api/parties")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal server error");
    });
  });
});
